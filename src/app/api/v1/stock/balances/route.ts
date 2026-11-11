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
    const locationId = searchParams.get('locationId');
    const search = searchParams.get('search')?.trim();
    const status = searchParams.get('status'); // LOW_STOCK, OUT_OF_STOCK, HEALTHY
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '25')));

    const where: any = {
      orgId: session!.orgId,
      product: { status: 'ACTIVE' },
    };

    if (locationId) where.locationId = locationId;

    if (search) {
      where.product = {
        ...where.product,
        OR: [
          { name: { contains: search } },
          { sku: { contains: search } },
          { barcode: { contains: search } },
        ],
      };
    }

    const balances = await prisma.stockBalance.findMany({
      where,
      include: {
        product: {
          include: {
            category: { select: { name: true } },
            unit: { select: { symbol: true } },
          },
        },
        location: { select: { id: true, name: true, code: true } },
      },
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const totalCount = await prisma.stockBalance.count({ where });

    const items = balances.map((b) => {
      const onHand = Number(b.onHand);
      const reserved = Number(b.reserved);
      const inTransit = Number(b.inTransit);
      const available = onHand - reserved;
      const minStock = Number(b.product.minStock);
      const cost = Number(b.product.purchaseCost);

      let healthStatus = 'HEALTHY';
      if (available <= 0) {
        healthStatus = 'OUT_OF_STOCK';
      } else if (available <= minStock) {
        healthStatus = 'LOW_STOCK';
      }

      return {
        id: b.id,
        productId: b.productId,
        productName: b.product.name,
        sku: b.product.sku,
        barcode: b.product.barcode,
        category: b.product.category?.name || 'Uncategorized',
        unit: b.product.unit?.symbol || 'pcs',
        location: b.location,
        onHand,
        reserved,
        available,
        inTransit,
        minStock,
        unitCost: cost,
        valuation: Number((onHand * cost).toFixed(2)),
        healthStatus,
        updatedAt: b.updatedAt,
      };
    });

    let filtered = items;
    if (status && status !== 'ALL') {
      filtered = items.filter((i) => i.healthStatus === status);
    }

    return apiSuccess({
      data: filtered,
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
      message: error.message || 'Failed to fetch stock balances.',
      status: 500,
    });
  }
}

