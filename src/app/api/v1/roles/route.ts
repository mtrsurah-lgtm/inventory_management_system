import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthSession, checkPermission } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/api-response';

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    const authCheck = checkPermission(session, 'roles.manage');
    if (authCheck) return authCheck;

    const roles = await prisma.role.findMany({
      where: {
        OR: [
          { orgId: session!.orgId },
          { isSystem: true, orgId: null },
        ],
      },
      include: {
        rolePermissions: {
          include: { permission: true },
        },
        _count: { select: { members: true } },
      },
      orderBy: { name: 'asc' },
    });

    const allPermissions = await prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { code: 'asc' }],
    });

    return apiSuccess({
      data: {
        roles: roles.map((r) => ({
          id: r.id,
          name: r.name,
          description: r.description,
          isSystem: r.isSystem,
          userCount: r._count.members,
          permissions: r.rolePermissions.map((rp) => rp.permission.code),
        })),
        availablePermissions: allPermissions,
      },
    });
  } catch (error: any) {
    return apiError({
      code: 'SERVER_ERROR',
      message: error.message || 'Failed to fetch roles and permissions.',
      status: 500,
    });
  }
}

