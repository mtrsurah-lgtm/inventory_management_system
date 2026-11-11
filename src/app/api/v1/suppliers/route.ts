import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthSession, checkPermission } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/api-response';

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    const authCheck = checkPermission(session, 'purchases.view');
    if (authCheck) return authCheck;

    const suppliers = await prisma.supplier.findMany({
      where: { orgId: session!.orgId },
      include: {
        _count: { select: { purchaseOrders: true } },
      },
      orderBy: { name: 'asc' },
    });

    return apiSuccess({
      data: suppliers.map((s) => ({
        id: s.id,
        name: s.name,
        contactPerson: s.contactPerson,
        phone: s.phone,
        email: s.email,
        address: s.address,
        taxNumber: s.taxNumber,
        openingBalance: Number(s.openingBalance),
        currentBalance: Number(s.currentBalance),
        status: s.status,
        totalOrders: s._count.purchaseOrders,
        createdAt: s.createdAt,
      })),
    });
  } catch (error: any) {
    return apiError({
      code: 'SERVER_ERROR',
      message: error.message || 'Failed to fetch suppliers.',
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
    const { name, contactPerson, phone, email, address, taxNumber, openingBalance = 0 } = body;

    if (!name) {
      return apiError({
        code: 'VALIDATION_ERROR',
        message: 'Supplier name is required.',
        status: 400,
      });
    }

    const supplier = await prisma.supplier.create({
      data: {
        orgId: session!.orgId,
        name: name.trim(),
        contactPerson: contactPerson?.trim() || null,
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        address: address?.trim() || null,
        taxNumber: taxNumber?.trim() || null,
        openingBalance: Number(openingBalance),
        currentBalance: Number(openingBalance),
        status: 'ACTIVE',
      },
    });

    return apiSuccess({
      message: 'Supplier created successfully',
      data: supplier,
      status: 201,
    });
  } catch (error: any) {
    return apiError({
      code: 'SERVER_ERROR',
      message: error.message || 'Failed to create supplier.',
      status: 500,
    });
  }
}

