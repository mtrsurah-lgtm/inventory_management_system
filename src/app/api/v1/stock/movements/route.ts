import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthSession, checkPermission } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/api-response';

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    const authCheck = checkPermission(session, 'inventory.view');
    if (authCheck) return authCheck;

    const { searchParams } = new URL(req.url);
    const productId = searchParams.get('productId');
    const locationId = searchParams.get('locationId');
    const type = searchParams.get('type');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '30')));

    const where: any = {
      orgId: session!.orgId,
    };

    if (productId) where.productId = productId;
    if (locationId) where.locationId = locationId;
    if (type && type !== 'ALL') where.type = type;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const totalCount = await prisma.stockMovement.count({ where });

    const movements = await prisma.stockMovement.findMany({
      where,
      include: {
        product: { select: { id: true, name: true, sku: true, barcode: true } },
        location: { select: { id: true, name: true, code: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return apiSuccess({
      data: movements.map((m) => ({
        id: m.id,
        productId: m.productId,
        productName: m.product.name,
        sku: m.product.sku,
        barcode: m.product.barcode,
        location: m.location,
        type: m.type,
        quantity: Number(m.quantity),
        unitCost: Number(m.unitCost),
        totalCost: Number((Number(m.quantity) * Number(m.unitCost)).toFixed(2)),
        balanceBefore: Number(m.balanceBefore),
        balanceAfter: Number(m.balanceAfter),
        referenceType: m.referenceType,
        referenceId: m.referenceId,
        reason: m.reason,
        createdAt: m.createdAt,
      })),
      meta: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error: any) {
    return apiError({
      code: 'SERVER_ERROR',
      message: error.message || 'Failed to fetch stock movements.',
      status: 500,
    });
  }
}

