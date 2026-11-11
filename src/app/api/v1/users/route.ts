import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthSession, checkPermission, hashPassword } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/api-response';

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    const authCheck = checkPermission(session, 'users.manage');
    if (authCheck) return authCheck;

    const members = await prisma.organizationMember.findMany({
      where: { orgId: session!.orgId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            isActive: true,
            createdAt: true,
            userLocations: {
              include: { location: { select: { id: true, name: true, code: true } } },
            },
          },
        },
        role: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return apiSuccess({
      data: members.map((m) => ({
        id: m.user.id,
        email: m.user.email,
        firstName: m.user.firstName,
        lastName: m.user.lastName,
        phone: m.user.phone,
        isActive: m.user.isActive,
        role: m.role,
        locations: m.user.userLocations.map((ul) => ul.location),
        joinedAt: m.createdAt,
      })),
    });
  } catch (error: any) {
    return apiError({
      code: 'SERVER_ERROR',
      message: error.message || 'Failed to fetch users.',
      status: 500,
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    const authCheck = checkPermission(session, 'users.manage');
    if (authCheck) return authCheck;

    const body = await req.json();
    const { email, password, firstName, lastName, phone, roleId, locationIds } = body;

    if (!email || !password || !firstName || !lastName || !roleId) {
      return apiError({
        code: 'VALIDATION_ERROR',
        message: 'Email, password, first name, last name, and role are required.',
        status: 400,
      });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Check if user already exists
    let user = await prisma.user.findUnique({ where: { email: cleanEmail } });

    if (!user) {
      const passwordHash = await hashPassword(password);
      user = await prisma.user.create({
        data: {
          email: cleanEmail,
          passwordHash,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone?.trim() || null,
        },
      });
    }

    // Check existing membership in organization
    const existingMember = await prisma.organizationMember.findUnique({
      where: { orgId_userId: { orgId: session!.orgId, userId: user.id } },
    });

    if (existingMember) {
      return apiError({
        code: 'USER_ALREADY_MEMBER',
        message: 'This user is already a member of your company.',
        status: 400,
      });
    }

    // Create membership
    await prisma.organizationMember.create({
      data: {
        orgId: session!.orgId,
        userId: user.id,
        roleId,
      },
    });

    // Assign locations
    if (locationIds && Array.isArray(locationIds)) {
      for (const locId of locationIds) {
        await prisma.userLocation.upsert({
          where: { userId_locationId: { userId: user.id, locationId: locId } },
          update: {},
          create: { userId: user.id, locationId: locId },
        });
      }
    }

    return apiSuccess({
      message: 'User added to organization successfully',
      data: { id: user.id, email: user.email, name: `${user.firstName} ${user.lastName}` },
      status: 201,
    });
  } catch (error: any) {
    return apiError({
      code: 'SERVER_ERROR',
      message: error.message || 'Failed to add user.',
      status: 500,
    });
  }
}

