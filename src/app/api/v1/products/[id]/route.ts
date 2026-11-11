import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthSession, checkPermission } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/api-response';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAuthSession(req);
    const authCheck = checkPermission(session, 'inventory.view');
    if (authCheck) return authCheck;

    const { id } = params;

    const product = await prisma.product.findFirst({
      where: {
        id,
        orgId: session!.orgId,
      },
      include: {
        category: true,
        brand: true,
        unit: true,
        variants: true,
        productBarcodes: true,
        suppliers: {
          include: { supplier: true },
        },
        stockBalances: {
          include: { location: true },
        },
        stockMovements: {
          take: 25,
          orderBy: { createdAt: 'desc' },
          include: { location: { select: { name: true, code: true } } },
        },
        salesOrderItems: {
          take: 10,
          orderBy: { salesOrder: { createdAt: 'desc' } },
          include: {
            salesOrder: {
              select: {
                orderNumber: true,
                createdAt: true,
                customer: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    if (!product) {
      return apiError({
        code: 'NOT_FOUND',
        message: 'Product not found.',
        status: 404,
      });
    }

    let totalOnHand = 0;
    let totalReserved = 0;
    let totalInTransit = 0;

    for (const sb of product.stockBalances) {
      totalOnHand += Number(sb.onHand);
      totalReserved += Number(sb.reserved);
      totalInTransit += Number(sb.inTransit);
    }

    const available = totalOnHand - totalReserved;
    const minStock = Number(product.minStock);

    let healthStatus = 'HEALTHY';
    if (available <= 0) {
      healthStatus = 'OUT_OF_STOCK';
    } else if (available <= minStock) {
      healthStatus = 'LOW_STOCK';
    }

    return apiSuccess({
      data: {
        ...product,
        purchaseCost: Number(product.purchaseCost),
        sellingPrice: Number(product.sellingPrice),
        taxRate: Number(product.taxRate),
        minStock: Number(product.minStock),
        maxStock: product.maxStock ? Number(product.maxStock) : null,
        inventory: {
          onHand: totalOnHand,
          reserved: totalReserved,
          available,
          inTransit: totalInTransit,
          healthStatus,
        },
      },
    });
  } catch (error: any) {
    return apiError({
      code: 'SERVER_ERROR',
      message: error.message || 'Failed to fetch product details.',
      status: 500,
    });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAuthSession(req);
    const authCheck = checkPermission(session, 'inventory.update');
    if (authCheck) return authCheck;

    const { id } = params;
    const body = await req.json();
    const {
      name,
      barcode,
      description,
      categoryId,
      brandId,
      unitId,
      purchaseCost,
      sellingPrice,
      taxRate,
      minStock,
      maxStock,
      status,
    } = body;

    const existing = await prisma.product.findFirst({
      where: { id, orgId: session!.orgId },
    });

    if (!existing) {
      return apiError({
        code: 'NOT_FOUND',
        message: 'Product not found.',
        status: 404,
      });
    }

    const updated = await prisma.product.update({
      where: { id },
      data: {
        name: name !== undefined ? name.trim() : undefined,
        barcode: barcode !== undefined ? barcode.trim() || null : undefined,
        description: description !== undefined ? description?.trim() || null : undefined,
        categoryId: categoryId !== undefined ? categoryId || null : undefined,
        brandId: brandId !== undefined ? brandId || null : undefined,
        unitId: unitId !== undefined ? unitId || null : undefined,
        purchaseCost: purchaseCost !== undefined ? Number(purchaseCost) : undefined,
        sellingPrice: sellingPrice !== undefined ? Number(sellingPrice) : undefined,
        taxRate: taxRate !== undefined ? Number(taxRate) : undefined,
        minStock: minStock !== undefined ? Number(minStock) : undefined,
        maxStock: maxStock !== undefined ? (maxStock ? Number(maxStock) : null) : undefined,
        status: status !== undefined ? status : undefined,
      },
    });

    return apiSuccess({
      message: 'Product updated successfully',
      data: updated,
    });
  } catch (error: any) {
    return apiError({
      code: 'SERVER_ERROR',
      message: error.message || 'Failed to update product.',
      status: 500,
    });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAuthSession(req);
    const authCheck = checkPermission(session, 'inventory.delete');
    if (authCheck) return authCheck;

    const { id } = params;

    const existing = await prisma.product.findFirst({
      where: { id, orgId: session!.orgId },
      include: {
        salesOrderItems: { take: 1 },
        purchaseOrderItems: { take: 1 },
      },
    });

    if (!existing) {
      return apiError({
        code: 'NOT_FOUND',
        message: 'Product not found.',
        status: 404,
      });
    }

    // If transactions exist, soft-archive to protect historical reports
    if (existing.salesOrderItems.length > 0 || existing.purchaseOrderItems.length > 0) {
      await prisma.product.update({
        where: { id },
        data: { status: 'ARCHIVED' },
      });
      return apiSuccess({
        message: 'Product has historical transactions and was safely archived.',
        data: { archived: true },
      });
    }

    // If zero transactions, delete completely
    await prisma.product.delete({ where: { id } });

    return apiSuccess({
      message: 'Product deleted successfully',
      data: { deleted: true },
    });
  } catch (error: any) {
    return apiError({
      code: 'SERVER_ERROR',
      message: error.message || 'Failed to delete product.',
      status: 500,
    });
  }
}

