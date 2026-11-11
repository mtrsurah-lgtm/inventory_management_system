import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthSession, checkPermission } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { StockLedgerService } from '@/lib/services/stock-ledger';

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    const authCheck = checkPermission(session, 'sales.create');
    if (authCheck) return authCheck;

    const body = await req.json();
    const {
      locationId,
      customerId,
      orderType = 'POS',
      items,
      discountAmount = 0,
      paymentMethod = 'CASH',
      amountTendered = 0,
      registerSessionId,
      notes,
    } = body;

    const targetLocationId = locationId || session!.defaultLocationId;
    if (!targetLocationId || !items || !Array.isArray(items) || items.length === 0) {
      return apiError({
        code: 'VALIDATION_ERROR',
        message: 'Location and shopping cart items are required.',
        status: 400,
      });
    }

    // Generate Order & Payment Numbers
    const orderCount = await prisma.salesOrder.count({ where: { orgId: session!.orgId } });
    const orderNumber = `SO-${new Date().getFullYear()}-${String(orderCount + 1).padStart(5, '0')}`;
    const paymentNumber = `PAY-${new Date().getFullYear()}-${String(orderCount + 1).padStart(5, '0')}`;

    // Execute atomic checkout transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch organization settings for tax and negative stock
      const org = await tx.organization.findUnique({
        where: { id: session!.orgId },
      });
      const taxRate = Number(org?.taxRate || 0);
      const allowNegative = org?.negativeStockEnabled || false;

      let subtotal = 0;
      const orderItemsToCreate = [];

      // 2. Validate stock availability and prepare items
      for (const cartItem of items) {
        const prod = await tx.product.findUnique({
          where: { id: cartItem.productId },
        });

        if (!prod || prod.orgId !== session!.orgId) {
          throw new Error(`Product ID ${cartItem.productId} not found.`);
        }

        const qty = Number(cartItem.quantity);
        if (qty <= 0) {
          throw new Error(`Invalid quantity ${qty} for ${prod.name}`);
        }

        // Verify stock balance at location
        const balance = await tx.stockBalance.findFirst({
          where: {
            orgId: session!.orgId,
            productId: prod.id,
            locationId: targetLocationId,
          },
        });

        const currentOnHand = balance ? Number(balance.onHand) : 0;
        const currentReserved = balance ? Number(balance.reserved) : 0;
        const available = currentOnHand - currentReserved;

        if (!allowNegative && available < qty) {
          throw new Error(
            `Insufficient stock for "${prod.name}" (${prod.sku}). Available: ${available}, Requested: ${qty}.`
          );
        }

        const unitPrice = cartItem.unitPrice !== undefined ? Number(cartItem.unitPrice) : Number(prod.sellingPrice);
        const itemDiscount = Number(cartItem.discount || 0);
        const lineTotal = Number((qty * unitPrice - itemDiscount).toFixed(2));
        subtotal += lineTotal;

        orderItemsToCreate.push({
          productId: prod.id,
          productName: prod.name,
          sku: prod.sku,
          quantity: qty,
          unitPrice,
          unitCostSnapshot: Number(prod.purchaseCost),
          taxRateSnapshot: taxRate,
          discountSnapshot: itemDiscount,
          totalAmount: lineTotal,
        });
      }

      const discTotal = Number(discountAmount);
      const netSubtotal = Math.max(0, subtotal - discTotal);
      const taxAmount = Number(((netSubtotal * taxRate) / 100).toFixed(2));
      const grandTotal = Number((netSubtotal + taxAmount).toFixed(2));

      // Calculate Cash Change if CASH
      let changeAmount = 0;
      const tendered = Number(amountTendered || grandTotal);
      if (paymentMethod === 'CASH' && tendered > grandTotal) {
        changeAmount = Number((tendered - grandTotal).toFixed(2));
      }

      // 3. Create Sales Order with snapshots
      const salesOrder = await tx.salesOrder.create({
        data: {
          orgId: session!.orgId,
          orderNumber,
          customerId: customerId || null,
          locationId: targetLocationId,
          orderType,
          status: 'COMPLETED',
          fulfilmentStatus: 'FULFILLED',
          paymentStatus: 'PAID',
          subtotal: Number(subtotal.toFixed(2)),
          discountAmount: discTotal,
          taxAmount,
          totalAmount: grandTotal,
          paidAmount: grandTotal,
          registerSessionId: registerSessionId || null,
          notes: notes?.trim() || null,
          createdById: session!.userId,
          items: {
            create: orderItemsToCreate.map((oi) => ({
              productId: oi.productId,
              quantity: oi.quantity,
              fulfilledQuantity: oi.quantity,
              unitPrice: oi.unitPrice,
              unitCostSnapshot: oi.unitCostSnapshot,
              taxRateSnapshot: oi.taxRateSnapshot,
              discountSnapshot: oi.discountSnapshot,
              totalAmount: oi.totalAmount,
            })),
          },
        },
        include: {
          items: true,
          customer: true,
          location: true,
        },
      });

      // 4. Create Customer Payment Record
      const payment = await tx.customerPayment.create({
        data: {
          orgId: session!.orgId,
          paymentNumber,
          customerId: customerId || null,
          salesOrderId: salesOrder.id,
          registerSessionId: registerSessionId || null,
          amount: grandTotal,
          changeAmount,
          paymentMethod,
          referenceNumber: body.referenceNumber || `POS-REC-${Date.now()}`,
          createdById: session!.userId,
        },
      });

      // 5. ATOMICALLY DEDUCT INVENTORY AND RECORD STOCK LEDGER MOVEMENT
      for (const item of orderItemsToCreate) {
        await StockLedgerService.recordMovement(tx, {
          orgId: session!.orgId,
          productId: item.productId,
          locationId: targetLocationId,
          type: 'SALE',
          quantity: -item.quantity,
          unitCost: item.unitCostSnapshot,
          referenceType: 'SALES_ORDER',
          referenceId: salesOrder.id,
          reason: `Fulfilled in sale ${orderNumber}`,
          userId: session!.userId,
          allowNegative,
        });
      }

      return {
        order: salesOrder,
        payment,
        receipt: {
          orderNumber,
          date: salesOrder.createdAt,
          location: salesOrder.location.name,
          customer: salesOrder.customer?.name || 'Walk-in Customer',
          items: orderItemsToCreate,
          subtotal: netSubtotal,
          taxAmount,
          grandTotal,
          amountTendered: tendered,
          changeAmount,
          paymentMethod,
        },
      };
    });

    return apiSuccess({
      message: 'Checkout completed successfully. Inventory ledger updated.',
      data: result,
      status: 201,
    });
  } catch (error: any) {
    return apiError({
      code: 'CHECKOUT_FAILED',
      message: error.message || 'Failed to complete checkout.',
      status: 400,
    });
  }
}

