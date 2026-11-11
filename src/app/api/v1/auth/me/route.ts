import { NextRequest } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) {
      return apiError({
        code: 'UNAUTHORIZED',
        message: 'No active session found.',
        status: 401,
      });
    }

    const org = await prisma.organization.findUnique({
      where: { id: session.orgId },
    });

    const locations = await prisma.location.findMany({
      where: { orgId: session.orgId, isActive: true },
    });

    return apiSuccess({
      data: {
        user: {
          id: session.userId,
          email: session.email,
          firstName: session.firstName,
          lastName: session.lastName,
          organization: {
            id: session.orgId,
            name: session.orgName,
            currency: org?.currency || 'USD',
            timezone: org?.timezone || 'UTC',
            taxRate: Number(org?.taxRate || 0),
            negativeStockEnabled: org?.negativeStockEnabled || false,
          },
          role: {
            id: session.roleId,
            name: session.roleName,
          },
          permissions: session.permissions,
          assignedLocationIds: session.assignedLocationIds,
          defaultLocationId: session.defaultLocationId,
          allLocations: locations.map((l) => ({
            id: l.id,
            name: l.name,
            code: l.code,
            isPrimary: l.isPrimary,
          })),
        },
      },
    });
  } catch (error: any) {
    return apiError({
      code: 'SERVER_ERROR',
      message: error.message || 'Failed to retrieve session.',
      status: 500,
    });
  }
}

