import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthSession, checkPermission } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/api-response';

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    const authCheck = checkPermission(session, 'sales.view');
    if (authCheck) return authCheck;

    const customers = await prisma.customer.findMany({
      where: { orgId: session!.orgId },
      include: {
        _count: { select: { salesOrders: true } },
      },
      orderBy: { name: 'asc' },
    });

    return apiSuccess({
      data: customers.map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        address: c.address,
        customerType: c.customerType,
        openingBalance: Number(c.openingBalance),
        currentBalance: Number(c.currentBalance),
        status: c.status,
        totalOrders: c._count.salesOrders,
        createdAt: c.createdAt,
      })),
    });
  } catch (error: any) {
    return apiError({
      code: 'SERVER_ERROR',
      message: error.message || 'Failed to fetch customers.',
      status: 500,
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    const authCheck = checkPermission(session, 'sales.create');
    if (authCheck) return authCheck;

    const body = await req.json();
    const { name, phone, email, address, customerType = 'RETAIL', openingBalance = 0 } = body;

    if (!name) {
      return apiError({
        code: 'VALIDATION_ERROR',
        message: 'Customer name is required.',
        status: 400,
      });
    }

    const customer = await prisma.customer.create({
      data: {
        orgId: session!.orgId,
        name: name.trim(),
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        address: address?.trim() || null,
        customerType,
        openingBalance: Number(openingBalance),
        currentBalance: Number(openingBalance),
        status: 'ACTIVE',
      },
    });

    return apiSuccess({
      message: 'Customer created successfully',
      data: customer,
      status: 201,
    });
  } catch (error: any) {
    return apiError({
      code: 'SERVER_ERROR',
      message: error.message || 'Failed to create customer.',
      status: 500,
    });
  }
}

