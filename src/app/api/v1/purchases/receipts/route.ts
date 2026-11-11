import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthSession, checkPermission } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { StockLedgerService } from '@/lib/services/stock-ledger';

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    const authCheck = checkPermission(session, 'purchases.view');
    if (authCheck) return authCheck;

    const receipts = await prisma.purchaseReceipt.findMany({
      where: { orgId: session!.orgId },
      include: {
        supplier: { select: { id: true, name: true } },
        location: { select: { id: true, name: true, code: true } },
        purchaseOrder: { select: { id: true, poNumber: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return apiSuccess({
      data: receipts.map((r) => ({
        id: r.id,
        receiptNumber: r.receiptNumber,
        poNumber: r.purchaseOrder?.poNumber || null,
        supplier: r.supplier,
        location: r.location,
        status: r.status,
        receivedDate: r.receivedDate,
        notes: r.notes,
        createdAt: r.createdAt,
        items: r.items.map((i) => ({
          id: i.id,
          productId: i.productId,
          productName: i.product.name,
          sku: i.product.sku,
          quantityReceived: Number(i.quantityReceived),
          quantityRejected: Number(i.quantityRejected),
          unitCost: Number(i.unitCost),
          totalAmount: Number(i.totalAmount),
        })),
      })),
    });
  } catch (error: any) {
    return apiError({
      code: 'SERVER_ERROR',
      message: error.message || 'Failed to fetch receipts.',
      status: 500,
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    const authCheck = checkPermission(session, 'purchases.approve');
    if (authCheck) return authCheck;

    const body = await req.json();
    const { poId, supplierId, locationId, items, notes } = body;

    if (!locationId || !items || items.length === 0) {
      return apiError({
        code: 'VALIDATION_ERROR',
        message: 'Location and received items are required.',
        status: 400,
      });
    }

    const count = await prisma.purchaseReceipt.count({ where: { orgId: session!.orgId } });
    const receiptNumber = `GRN-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    const receipt = await prisma.$transaction(async (tx) => {
      // Create receipt record
      const grn = await tx.purchaseReceipt.create({
        data: {
          orgId: session!.orgId,
          receiptNumber,
          poId: poId || null,
          supplierId: supplierId || (poId ? (await tx.purchaseOrder.findUnique({ where: { id: poId } }))!.supplierId : ''),
          locationId,
          status: 'POSTED',
          notes: notes?.trim() || null,
          createdById: session!.userId,
        },
      });

      let totalAllReceived = 0;

      for (const item of items) {
        const prod = await tx.product.findUnique({ where: { id: item.productId } });
        if (!prod) continue;

        const qtyReceived = Number(item.quantityReceived);
        const qtyRejected = Number(item.quantityRejected || 0);
        const unitCost = item.unitCost !== undefined ? Number(item.unitCost) : Number(prod.purchaseCost);
        const totalAmount = qtyReceived * unitCost;

        totalAllReceived += qtyReceived;

        // Create receipt item
        await tx.purchaseReceiptItem.create({
          data: {
            receiptId: grn.id,
            productId: prod.id,
            poItemId: item.poItemId || null,
            quantityReceived: qtyReceived,
            quantityRejected: qtyRejected,
            unitCost,
            totalAmount,
          },
        });

        // 1. INCREASE INVENTORY VIA STOCK LEDGER ONLY NOW
        if (qtyReceived > 0) {
          await StockLedgerService.recordMovement(tx, {
            orgId: session!.orgId,
            productId: prod.id,
            locationId,
            type: 'PURCHASE_RECEIPT',
            quantity: qtyReceived,
            unitCost,
            referenceType: 'PURCHASE_RECEIPT',
            referenceId: grn.id,
            reason: `Goods received against receipt ${receiptNumber}`,
            userId: session!.userId,
          });
        }

        // 2. Update PO Item received quantity if linked to a PO
        if (item.poItemId) {
          const poItem = await tx.purchaseOrderItem.findUnique({ where: { id: item.poItemId } });
          if (poItem) {
            await tx.purchaseOrderItem.update({
              where: { id: item.poItemId },
              data: {
                receivedQuantity: Number(poItem.receivedQuantity) + qtyReceived,
              },
            });
          }
        }
      }

      // 3. Update PO overall status if linked
      if (poId) {
        const poItems = await tx.purchaseOrderItem.findMany({ where: { poId } });
        const allReceived = poItems.every((pi) => Number(pi.receivedQuantity) >= Number(pi.quantity));
        const anyReceived = poItems.some((pi) => Number(pi.receivedQuantity) > 0);

        await tx.purchaseOrder.update({
          where: { id: poId },
          data: {
            status: allReceived ? 'RECEIVED' : anyReceived ? 'PARTIALLY_RECEIVED' : 'CONFIRMED',
          },
        });
      }

      return grn;
    });

    return apiSuccess({
      message: 'Goods receipt posted. Inventory successfully credited in the stock ledger.',
      data: receipt,
      status: 201,
    });
  } catch (error: any) {
    return apiError({
      code: 'SERVER_ERROR',
      message: error.message || 'Failed to post purchase receipt.',
      status: 500,
    });
  }
}

