import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthSession, checkPermission } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/api-response';

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    const authCheck = checkPermission(session, 'settings.manage');
    if (authCheck) return authCheck;

    const org = await prisma.organization.findUnique({
      where: { id: session!.orgId },
    });

    return apiSuccess({
      data: org ? {
        id: org.id,
        name: org.name,
        slug: org.slug,
        currency: org.currency,
        timezone: org.timezone,
        taxRate: Number(org.taxRate),
        dateFormat: org.dateFormat,
        negativeStockEnabled: org.negativeStockEnabled,
      } : null,
    });
  } catch (error: any) {
    return apiError({
      code: 'SERVER_ERROR',
      message: error.message || 'Failed to fetch company settings.',
      status: 500,
    });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    const authCheck = checkPermission(session, 'settings.manage');
    if (authCheck) return authCheck;

    const body = await req.json();
    const { name, currency, timezone, taxRate, dateFormat, negativeStockEnabled } = body;

    const updated = await prisma.organization.update({
      where: { id: session!.orgId },
      data: {
        name: name !== undefined ? name.trim() : undefined,
        currency: currency !== undefined ? currency.trim().toUpperCase() : undefined,
        timezone: timezone !== undefined ? timezone.trim() : undefined,
        taxRate: taxRate !== undefined ? Number(taxRate) : undefined,
        dateFormat: dateFormat !== undefined ? dateFormat.trim() : undefined,
        negativeStockEnabled: negativeStockEnabled !== undefined ? Boolean(negativeStockEnabled) : undefined,
      },
    });

    return apiSuccess({
      message: 'Company settings updated successfully',
      data: updated,
    });
  } catch (error: any) {
    return apiError({
      code: 'SERVER_ERROR',
      message: error.message || 'Failed to update company settings.',
      status: 500,
    });
  }
}

