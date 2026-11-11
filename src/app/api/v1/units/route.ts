import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthSession, checkPermission } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/api-response';

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    const authCheck = checkPermission(session, 'inventory.view');
    if (authCheck) return authCheck;

    const units = await prisma.unit.findMany({
      where: { orgId: session!.orgId },
      orderBy: { name: 'asc' },
    });

    return apiSuccess({
      data: units,
    });
  } catch (error: any) {
    return apiError({
      code: 'SERVER_ERROR',
      message: error.message || 'Failed to fetch units of measurement.',
      status: 500,
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    const authCheck = checkPermission(session, 'inventory.create');
    if (authCheck) return authCheck;

    const { name, code, symbol } = await req.json();

    if (!name || !code) {
      return apiError({
        code: 'VALIDATION_ERROR',
        message: 'Name and Code are required for unit.',
        status: 400,
      });
    }

    const cleanCode = code.trim().toUpperCase();

    const existing = await prisma.unit.findUnique({
      where: { orgId_code: { orgId: session!.orgId, code: cleanCode } },
    });

    if (existing) {
      return apiError({
        code: 'DUPLICATE_UNIT',
        message: `Unit code "${cleanCode}" already exists.`,
        status: 400,
      });
    }

    const unit = await prisma.unit.create({
      data: {
        orgId: session!.orgId,
        name: name.trim(),
        code: cleanCode,
        symbol: symbol ? symbol.trim() : cleanCode.toLowerCase(),
      },
    });

    return apiSuccess({
      message: 'Unit created successfully',
      data: unit,
      status: 201,
    });
  } catch (error: any) {
    return apiError({
      code: 'SERVER_ERROR',
      message: error.message || 'Failed to create unit.',
      status: 500,
    });
  }
}

