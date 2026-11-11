import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthSession, checkPermission } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { StockLedgerService, MovementType } from '@/lib/services/stock-ledger';

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    const authCheck = checkPermission(session, 'inventory.adjust');
    if (authCheck) return authCheck;

    const adjustments = await prisma.stockAdjustment.findMany({
      where: { orgId: session!.orgId },
      include: {
        location: { select: { id: true, name: true, code: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return apiSuccess({
      data: adjustments.map((adj) => ({
        id: adj.id,
        adjustmentNumber: adj.adjustmentNumber,
        location: adj.location,
        status: adj.status,
        reason: adj.reason,
        totalCost: Number(adj.totalCost),
        createdAt: adj.createdAt,
        items: adj.items.map((i) => ({
          id: i.id,
          productId: i.productId,
          productName: i.product.name,
          sku: i.product.sku,
          currentStock: Number(i.currentStock),
          adjustedStock: Number(i.adjustedStock),
          diffQuantity: Number(i.diffQuantity),
          type: i.type,
          unitCost: Number(i.unitCost),
          reason: i.reason,
        })),
      })),
    });
  } catch (error: any) {
    return apiError({
      code: 'SERVER_ERROR',
      message: error.message || 'Failed to fetch adjustments.',
      status: 500,
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    const authCheck = checkPermission(session, 'inventory.adjust');
    if (authCheck) return authCheck;

    const { locationId, reason, items, notes } = await req.json();

    if (!locationId || !reason || !items || items.length === 0) {
      return apiError({
        code: 'VALIDATION_ERROR',
        message: 'Location, adjustment reason, and items are required.',
        status: 400,
      });
    }

    const count = await prisma.stockAdjustment.count({ where: { orgId: session!.orgId } });
    const adjustmentNumber = `ADJ-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    const adjustment = await prisma.$transaction(async (tx) => {
      let totalCostValue = 0;

      // Create main adjustment record
      const adj = await tx.stockAdjustment.create({
        data: {
          orgId: session!.orgId,
          adjustmentNumber,
          locationId,
          status: 'APPROVED',
          reason: reason.trim(),
          notes: notes?.trim() || null,
          createdById: session!.userId,
          approvedById: session!.userId,
        },
      });

      for (const it of items) {
        const prod = await tx.product.findUnique({
          where: { id: it.productId },
        });
        if (!prod) continue;

        const balance = await tx.stockBalance.findFirst({
          where: { orgId: session!.orgId, productId: prod.id, locationId },
        });

        const currentStock = balance ? Number(balance.onHand) : 0;
        const adjustedStock = Number(it.adjustedStock);
        const diffQuantity = adjustedStock - currentStock;
        const unitCost = Number(prod.purchaseCost);

        totalCostValue += Math.abs(diffQuantity) * unitCost;

        let movementType: MovementType = diffQuantity >= 0 ? 'ADJUSTMENT_INCREASE' : 'ADJUSTMENT_DECREASE';
        if (it.type === 'DAMAGE') {
          movementType = 'DAMAGE_WRITE_OFF';
        }

        // Record Item
        await tx.stockAdjustmentItem.create({
          data: {
            adjustmentId: adj.id,
            productId: prod.id,
            currentStock,
            adjustedStock,
            diffQuantity,
            type: it.type || (diffQuantity >= 0 ? 'INCREASE' : 'DECREASE'),
            unitCost,
            reason: it.reason || reason,
          },
        });

        // Record Stock Ledger Movement if diff != 0
        if (diffQuantity !== 0) {
          await StockLedgerService.recordMovement(tx, {
            orgId: session!.orgId,
            productId: prod.id,
            locationId,
            type: movementType,
            quantity: diffQuantity,
            unitCost,
            referenceType: 'ADJUSTMENT',
            referenceId: adj.id,
            reason: `Stock adjustment ${adjustmentNumber}: ${reason}`,
            userId: session!.userId,
          });
        }
      }

      await tx.stockAdjustment.update({
        where: { id: adj.id },
        data: { totalCost: totalCostValue },
      });

      return adj;
    });

    return apiSuccess({
      message: 'Stock adjustment posted and inventory ledger synchronized.',
      data: adjustment,
      status: 201,
    });
  } catch (error: any) {
    return apiError({
      code: 'SERVER_ERROR',
      message: error.message || 'Failed to post stock adjustment.',
      status: 500,
    });
  }
}

