import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthSession, checkPermission } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { StockLedgerService } from '@/lib/services/stock-ledger';

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    const authCheck = checkPermission(session, 'inventory.view');
    if (authCheck) return authCheck;

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.trim();
    const categoryId = searchParams.get('categoryId');
    const brandId = searchParams.get('brandId');
    const locationId = searchParams.get('locationId');
    const stockStatus = searchParams.get('stockStatus'); // IN_STOCK, LOW_STOCK, OUT_OF_STOCK
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';

    const where: any = {
      orgId: session!.orgId,
      status: { not: 'ARCHIVED' },
    };

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { sku: { contains: search } },
        { barcode: { contains: search } },
      ];
    }

    if (categoryId) where.categoryId = categoryId;
    if (brandId) where.brandId = brandId;

    const totalCount = await prisma.product.count({ where });

    const products = await prisma.product.findMany({
      where,
      include: {
        category: { select: { id: true, name: true, code: true } },
        brand: { select: { id: true, name: true } },
        unit: { select: { id: true, name: true, symbol: true } },
        stockBalances: {
          where: locationId ? { locationId } : undefined,
          include: { location: { select: { id: true, name: true, code: true } } },
        },
      },
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Compute aggregated onHand, reserved, available
    const enriched = products.map((p) => {
      let totalOnHand = 0;
      let totalReserved = 0;
      let totalInTransit = 0;

      for (const sb of p.stockBalances) {
        totalOnHand += Number(sb.onHand);
        totalReserved += Number(sb.reserved);
        totalInTransit += Number(sb.inTransit);
      }

      const available = totalOnHand - totalReserved;
      const minStock = Number(p.minStock);

      let status = 'HEALTHY';
      if (available <= 0) {
        status = 'OUT_OF_STOCK';
      } else if (available <= minStock) {
        status = 'LOW_STOCK';
      }

      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        barcode: p.barcode,
        description: p.description,
        category: p.category,
        brand: p.brand,
        unit: p.unit,
        purchaseCost: Number(p.purchaseCost),
        sellingPrice: Number(p.sellingPrice),
        taxRate: Number(p.taxRate),
        minStock: Number(p.minStock),
        maxStock: p.maxStock ? Number(p.maxStock) : null,
        status: p.status,
        image: p.image,
        trackSerial: p.trackSerial,
        trackBatch: p.trackBatch,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        inventory: {
          onHand: totalOnHand,
          reserved: totalReserved,
          available,
          inTransit: totalInTransit,
          healthStatus: status,
          balances: p.stockBalances.map((sb) => ({
            locationId: sb.locationId,
            locationName: sb.location.name,
            locationCode: sb.location.code,
            onHand: Number(sb.onHand),
            reserved: Number(sb.reserved),
            available: Number(sb.onHand) - Number(sb.reserved),
          })),
        },
      };
    });

    // Filter by stockStatus in memory if requested
    let finalItems = enriched;
    if (stockStatus && stockStatus !== 'ALL') {
      finalItems = enriched.filter((p) => p.inventory.healthStatus === stockStatus);
    }

    return apiSuccess({
      data: finalItems,
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
      message: error.message || 'Failed to fetch products.',
      status: 500,
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    const authCheck = checkPermission(session, 'inventory.create');
    if (authCheck) return authCheck;

    const body = await req.json();
    const {
      name,
      sku,
      barcode,
      description,
      categoryId,
      brandId,
      unitId,
      purchaseCost = 0,
      sellingPrice = 0,
      taxRate = 0,
      minStock = 10,
      maxStock,
      trackSerial = false,
      trackBatch = false,
      openingStock = 0,
      locationId,
    } = body;

    if (!name || !sku) {
      return apiError({
        code: 'VALIDATION_ERROR',
        message: 'Product name and SKU are required.',
        status: 400,
      });
    }

    const cleanSku = sku.trim().toUpperCase();

    // Check SKU uniqueness in organization
    const existing = await prisma.product.findUnique({
      where: { orgId_sku: { orgId: session!.orgId, sku: cleanSku } },
    });
    if (existing) {
      return apiError({
        code: 'DUPLICATE_SKU',
        message: `A product with SKU "${cleanSku}" already exists in your company.`,
        status: 400,
      });
    }

    // Check Barcode uniqueness if provided
    if (barcode) {
      const existingBarcode = await prisma.productBarcode.findFirst({
        where: {
          barcode: barcode.trim(),
          product: { orgId: session!.orgId },
        },
      });
      if (existingBarcode) {
        return apiError({
          code: 'DUPLICATE_BARCODE',
          message: `Barcode "${barcode}" is already registered to another product.`,
          status: 400,
        });
      }
    }

    // Determine target location for opening stock
    const targetLocationId = locationId || session!.defaultLocationId;
    if (!targetLocationId) {
      return apiError({
        code: 'LOCATION_REQUIRED',
        message: 'A valid location is required for inventory tracking.',
        status: 400,
      });
    }

    const newProduct = await prisma.$transaction(async (tx) => {
      const prod = await tx.product.create({
        data: {
          orgId: session!.orgId,
          name: name.trim(),
          sku: cleanSku,
          barcode: barcode ? barcode.trim() : null,
          description: description?.trim() || null,
          categoryId: categoryId || null,
          brandId: brandId || null,
          unitId: unitId || null,
          purchaseCost,
          sellingPrice,
          taxRate,
          minStock,
          maxStock: maxStock ? Number(maxStock) : null,
          trackSerial,
          trackBatch,
          status: 'ACTIVE',
        },
      });

      if (barcode) {
        await tx.productBarcode.create({
          data: {
            productId: prod.id,
            barcode: barcode.trim(),
            isPrimary: true,
          },
        });
      }

      // Record opening stock if > 0
      if (Number(openingStock) > 0) {
        await StockLedgerService.recordMovement(tx, {
          orgId: session!.orgId,
          productId: prod.id,
          locationId: targetLocationId,
          type: 'OPENING_BALANCE',
          quantity: Number(openingStock),
          unitCost: Number(purchaseCost),
          reason: 'Initial stock recorded at product creation',
          userId: session!.userId,
        });
      } else {
        // Initialize 0 stock balance
        await tx.stockBalance.create({
          data: {
            orgId: session!.orgId,
            productId: prod.id,
            locationId: targetLocationId,
            onHand: 0,
            reserved: 0,
            inTransit: 0,
          },
        });
      }

      return prod;
    });

    return apiSuccess({
      message: 'Product created successfully',
      data: newProduct,
      status: 201,
    });
  } catch (error: any) {
    return apiError({
      code: 'SERVER_ERROR',
      message: error.message || 'Failed to create product.',
      status: 500,
    });
  }
}

