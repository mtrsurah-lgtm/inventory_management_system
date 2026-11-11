import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthSession, checkPermission } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/api-response';

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    const authCheck = checkPermission(session, 'inventory.view');
    if (authCheck) return authCheck;

    const brands = await prisma.brand.findMany({
      where: { orgId: session!.orgId },
      include: {
        _count: { select: { products: true } },
      },
      orderBy: { name: 'asc' },
    });

    return apiSuccess({
      data: brands.map((b) => ({
        id: b.id,
        name: b.name,
        description: b.description,
        productCount: b._count.products,
      })),
    });
  } catch (error: any) {
    return apiError({
      code: 'SERVER_ERROR',
      message: error.message || 'Failed to fetch brands.',
      status: 500,
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    const authCheck = checkPermission(session, 'inventory.create');
    if (authCheck) return authCheck;

    const { name, description } = await req.json();

    if (!name) {
      return apiError({
        code: 'VALIDATION_ERROR',
        message: 'Brand name is required.',
        status: 400,
      });
    }

    const cleanName = name.trim();

    const existing = await prisma.brand.findUnique({
      where: { orgId_name: { orgId: session!.orgId, name: cleanName } },
    });

    if (existing) {
      return apiError({
        code: 'DUPLICATE_BRAND',
        message: `Brand "${cleanName}" already exists.`,
        status: 400,
      });
    }

    const brand = await prisma.brand.create({
      data: {
        orgId: session!.orgId,
        name: cleanName,
        description: description?.trim() || null,
      },
    });

    return apiSuccess({
      message: 'Brand created successfully',
      data: brand,
      status: 201,
    });
  } catch (error: any) {
    return apiError({
      code: 'SERVER_ERROR',
      message: error.message || 'Failed to create brand.',
      status: 500,
    });
  }
}

