import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthSession, checkPermission } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/api-response';

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    const authCheck = checkPermission(session, 'sales.view');
    if (authCheck) return authCheck;

    const { searchParams } = new URL(req.url);
    const locationId = searchParams.get('locationId');
    const customerId = searchParams.get('customerId');
    const status = searchParams.get('status');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '25')));

    const where: any = { orgId: session!.orgId };
    if (locationId) where.locationId = locationId;
    if (customerId) where.customerId = customerId;
    if (status && status !== 'ALL') where.status = status;

    const totalCount = await prisma.salesOrder.count({ where });

    const orders = await prisma.salesOrder.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        location: { select: { id: true, name: true, code: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true } },
          },
        },
        payments: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return apiSuccess({
      data: orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        customer: o.customer,
        location: o.location,
        orderType: o.orderType,
        status: o.status,
        fulfilmentStatus: o.fulfilmentStatus,
        paymentStatus: o.paymentStatus,
        subtotal: Number(o.subtotal),
        discountAmount: Number(o.discountAmount),
        taxAmount: Number(o.taxAmount),
        totalAmount: Number(o.totalAmount),
        paidAmount: Number(o.paidAmount),
        createdAt: o.createdAt,
        itemCount: o.items.length,
        items: o.items.map((i) => ({
          id: i.id,
          productId: i.productId,
          productName: i.product.name,
          sku: i.product.sku,
          quantity: Number(i.quantity),
          unitPrice: Number(i.unitPrice),
          totalAmount: Number(i.totalAmount),
        })),
        payments: o.payments.map((p) => ({
          id: p.id,
          paymentNumber: p.paymentNumber,
          amount: Number(p.amount),
          paymentMethod: p.paymentMethod,
          paymentDate: p.paymentDate,
        })),
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
      message: error.message || 'Failed to fetch sales orders.',
      status: 500,
    });
  }
}

