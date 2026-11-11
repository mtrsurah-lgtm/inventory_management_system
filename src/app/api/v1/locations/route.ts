import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthSession, checkPermission } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/api-response';

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    const authCheck = checkPermission(session, 'inventory.view');
    if (authCheck) return authCheck;

    const locations = await prisma.location.findMany({
      where: { orgId: session!.orgId },
      include: {
        _count: { select: { stockBalances: true } },
      },
      orderBy: { isPrimary: 'desc' },
    });

    return apiSuccess({
      data: locations.map((l) => ({
        id: l.id,
        name: l.name,
        code: l.code,
        address: l.address,
        isPrimary: l.isPrimary,
        isActive: l.isActive,
        productCount: l._count.stockBalances,
      })),
    });
  } catch (error: any) {
    return apiError({
      code: 'SERVER_ERROR',
      message: error.message || 'Failed to fetch locations.',
      status: 500,
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    const authCheck = checkPermission(session, 'settings.manage');
    if (authCheck) return authCheck;

    const { name, code, address, isPrimary = false } = await req.json();

    if (!name || !code) {
      return apiError({
        code: 'VALIDATION_ERROR',
        message: 'Location name and unique code are required.',
        status: 400,
      });
    }

    const cleanCode = code.trim().toUpperCase();

    const existing = await prisma.location.findUnique({
      where: { orgId_code: { orgId: session!.orgId, code: cleanCode } },
    });

    if (existing) {
      return apiError({
        code: 'DUPLICATE_LOCATION',
        message: `Location code "${cleanCode}" already exists.`,
        status: 400,
      });
    }

    const location = await prisma.location.create({
      data: {
        orgId: session!.orgId,
        name: name.trim(),
        code: cleanCode,
        address: address?.trim() || null,
        isPrimary: Boolean(isPrimary),
      },
    });

    return apiSuccess({
      message: 'Location created successfully',
      data: location,
      status: 201,
    });
  } catch (error: any) {
    return apiError({
      code: 'SERVER_ERROR',
      message: error.message || 'Failed to create location.',
      status: 500,
    });
  }
}

