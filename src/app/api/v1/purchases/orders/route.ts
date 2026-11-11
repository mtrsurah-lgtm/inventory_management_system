import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthSession, checkPermission } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/api-response';

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    const authCheck = checkPermission(session, 'purchases.view');
    if (authCheck) return authCheck;

    const { searchParams } = new URL(req.url);
    const supplierId = searchParams.get('supplierId');
    const locationId = searchParams.get('locationId');
    const status = searchParams.get('status');

    const where: any = { orgId: session!.orgId };
    if (supplierId) where.supplierId = supplierId;
    if (locationId) where.locationId = locationId;
    if (status && status !== 'ALL') where.status = status;

    const orders = await prisma.purchaseOrder.findMany({
      where,
      include: {
        supplier: { select: { id: true, name: true } },
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
      data: orders.map((o) => ({
        id: o.id,
        poNumber: o.poNumber,
        supplier: o.supplier,
        location: o.location,
        status: o.status,
        subtotal: Number(o.subtotal),
        taxAmount: Number(o.taxAmount),
        discountAmount: Number(o.discountAmount),
        totalAmount: Number(o.totalAmount),
        paymentStatus: o.paymentStatus,
        orderDate: o.orderDate,
        expectedDate: o.expectedDate,
        notes: o.notes,
        createdAt: o.createdAt,
        itemCount: o.items.length,
        items: o.items.map((i) => ({
          id: i.id,
          productId: i.productId,
          productName: i.product.name,
          sku: i.product.sku,
          quantity: Number(i.quantity),
          receivedQuantity: Number(i.receivedQuantity),
          unitCost: Number(i.unitCost),
          totalAmount: Number(i.totalAmount),
        })),
      })),
    });
  } catch (error: any) {
    return apiError({
      code: 'SERVER_ERROR',
      message: error.message || 'Failed to fetch purchase orders.',
      status: 500,
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    const authCheck = checkPermission(session, 'purchases.create');
    if (authCheck) return authCheck;

    const body = await req.json();
    const { supplierId, locationId, items, expectedDate, notes, status = 'CONFIRMED' } = body;

    if (!supplierId || !locationId || !items || items.length === 0) {
      return apiError({
        code: 'VALIDATION_ERROR',
        message: 'Supplier, location, and items are required.',
        status: 400,
      });
    }

    const count = await prisma.purchaseOrder.count({ where: { orgId: session!.orgId } });
    const poNumber = `PO-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    let subtotal = 0;
    const poItemsData = [];

    for (const item of items) {
      const prod = await prisma.product.findUnique({ where: { id: item.productId } });
      if (!prod) continue;

      const qty = Number(item.quantity);
      const unitCost = item.unitCost !== undefined ? Number(item.unitCost) : Number(prod.purchaseCost);
      const lineTotal = qty * unitCost;

      subtotal += lineTotal;
      poItemsData.push({
        productId: prod.id,
        quantity: qty,
        receivedQuantity: 0,
        unitCost,
        totalAmount: lineTotal,
      });
    }

    const org = await prisma.organization.findUnique({ where: { id: session!.orgId } });
    const taxRate = Number(org?.taxRate || 0);
    const taxAmount = Number(((subtotal * taxRate) / 100).toFixed(2));
    const totalAmount = Number((subtotal + taxAmount).toFixed(2));

    const po = await prisma.purchaseOrder.create({
      data: {
        orgId: session!.orgId,
        poNumber,
        supplierId,
        locationId,
        status, // 'DRAFT' or 'CONFIRMED' - Stock does NOT increase here!
        subtotal,
        taxAmount,
        totalAmount,
        paymentStatus: 'PENDING',
        expectedDate: expectedDate ? new Date(expectedDate) : null,
        notes: notes?.trim() || null,
        createdById: session!.userId,
        items: {
          create: poItemsData,
        },
      },
      include: {
        items: true,
      },
    });

    return apiSuccess({
      message: 'Purchase Order created successfully (Stock unchanged until goods receipt posted).',
      data: po,
      status: 201,
    });
  } catch (error: any) {
    return apiError({
      code: 'SERVER_ERROR',
      message: error.message || 'Failed to create purchase order.',
      status: 500,
    });
  }
}

