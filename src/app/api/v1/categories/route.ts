import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthSession, checkPermission } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/api-response';

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    const authCheck = checkPermission(session, 'inventory.view');
    if (authCheck) return authCheck;

    const categories = await prisma.category.findMany({
      where: { orgId: session!.orgId },
      include: {
        _count: { select: { products: true } },
      },
      orderBy: { name: 'asc' },
    });

    return apiSuccess({
      data: categories.map((c) => ({
        id: c.id,
        name: c.name,
        code: c.code,
        description: c.description,
        productCount: c._count.products,
      })),
    });
  } catch (error: any) {
    return apiError({
      code: 'SERVER_ERROR',
      message: error.message || 'Failed to fetch categories.',
      status: 500,
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    const authCheck = checkPermission(session, 'inventory.create');
    if (authCheck) return authCheck;

    const { name, code, description } = await req.json();

    if (!name || !code) {
      return apiError({
        code: 'VALIDATION_ERROR',
        message: 'Name and Code are required for category.',
        status: 400,
      });
    }

    const cleanCode = code.trim().toUpperCase();

    const existing = await prisma.category.findUnique({
      where: { orgId_code: { orgId: session!.orgId, code: cleanCode } },
    });

    if (existing) {
      return apiError({
        code: 'DUPLICATE_CODE',
        message: `Category code "${cleanCode}" already exists.`,
        status: 400,
      });
    }

    const category = await prisma.category.create({
      data: {
        orgId: session!.orgId,
        name: name.trim(),
        code: cleanCode,
        description: description?.trim() || null,
      },
    });

    return apiSuccess({
      message: 'Category created successfully',
      data: category,
      status: 201,
    });
  } catch (error: any) {
    return apiError({
      code: 'SERVER_ERROR',
      message: error.message || 'Failed to create category.',
      status: 500,
    });
  }
}

