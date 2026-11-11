import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthSession, checkPermission } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { StockLedgerService } from '@/lib/services/stock-ledger';

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    const authCheck = checkPermission(session, 'sales.refund');
    if (authCheck) return authCheck;

    const returns = await prisma.salesReturn.findMany({
      where: { orgId: session!.orgId },
      include: {
        customer: { select: { id: true, name: true } },
        salesOrder: { select: { id: true, orderNumber: true } },
        items: {
          include: {
            salesOrderItem: {
              include: {
                product: { select: { id: true, name: true, sku: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return apiSuccess({
      data: returns.map((r) => ({
        id: r.id,
        returnNumber: r.returnNumber,
        orderNumber: r.salesOrder?.orderNumber || null,
        customer: r.customer,
        status: r.status,
        refundAmount: Number(r.refundAmount),
        refundStatus: r.refundStatus,
        restockApproved: r.restockApproved,
        reason: r.reason,
        createdAt: r.createdAt,
        items: r.items.map((i) => ({
          id: i.id,
          productName: i.salesOrderItem?.product.name,
          sku: i.salesOrderItem?.product.sku,
          quantity: Number(i.quantity),
          unitPrice: Number(i.unitPrice),
          condition: i.condition,
          restockApproved: i.restockApproved,
          reason: i.reason,
        })),
      })),
    });
  } catch (error: any) {
    return apiError({
      code: 'SERVER_ERROR',
      message: error.message || 'Failed to fetch sales returns.',
      status: 500,
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    const authCheck = checkPermission(session, 'sales.refund');
    if (authCheck) return authCheck;

    const body = await req.json();
    const {
      salesOrderId,
      customerId,
      locationId,
      items,
      refundAmount = 0,
      restockApproved = true,
      reason,
    } = body;

    if (!items || items.length === 0) {
      return apiError({
        code: 'VALIDATION_ERROR',
        message: 'At least one return item is required.',
        status: 400,
      });
    }

    const count = await prisma.salesReturn.count({ where: { orgId: session!.orgId } });
    const returnNumber = `RET-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    const result = await prisma.$transaction(async (tx) => {
      const salesReturn = await tx.salesReturn.create({
        data: {
          orgId: session!.orgId,
          returnNumber,
          salesOrderId: salesOrderId || null,
          customerId: customerId || null,
          locationId: locationId || session!.defaultLocationId!,
          status: restockApproved ? 'RESTOCKED' : 'DISCARDED',
          refundAmount: Number(refundAmount),
          refundStatus: 'COMPLETED',
          restockApproved: Boolean(restockApproved),
          reason: reason?.trim() || 'Customer return',
          createdById: session!.userId,
        },
      });

      for (const item of items) {
        const qty = Number(item.quantity);
        const itemApproved = item.restockApproved !== undefined ? Boolean(item.restockApproved) : Boolean(restockApproved);

        await tx.salesReturnItem.create({
          data: {
            returnId: salesReturn.id,
            salesOrderItemId: item.salesOrderItemId || null,
            productId: item.productId,
            quantity: qty,
            unitPrice: Number(item.unitPrice || 0),
            condition: item.condition || 'GOOD',
            restockApproved: itemApproved,
            reason: item.reason || reason,
          },
        });

        // CRITICAL: Only increase sellable stock if returned goods have been inspected & approved for restocking!
        if (itemApproved && qty > 0) {
          const prod = await tx.product.findUnique({ where: { id: item.productId } });
          await StockLedgerService.recordMovement(tx, {
            orgId: session!.orgId,
            productId: item.productId,
            locationId: locationId || session!.defaultLocationId!,
            type: 'CUSTOMER_RETURN',
            quantity: qty,
            unitCost: prod ? Number(prod.purchaseCost) : 0,
            referenceType: 'SALES_RETURN',
            referenceId: salesReturn.id,
            reason: `Return ${returnNumber} restocked: ${reason || 'Approved customer return'}`,
            userId: session!.userId,
          });
        }
      }

      return salesReturn;
    });

    return apiSuccess({
      message: 'Sales return processed successfully.',
      data: result,
      status: 201,
    });
  } catch (error: any) {
    return apiError({
      code: 'RETURN_FAILED',
      message: error.message || 'Failed to process return.',
      status: 400,
    });
  }
}

