import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyPassword, signToken } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/api-response';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return apiError({
        code: 'VALIDATION_ERROR',
        message: 'Email and password are required.',
        status: 400,
      });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: {
        memberships: {
          include: {
            organization: true,
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
        userLocations: {
          include: {
            location: true,
          },
        },
      },
    });

    if (!user || !user.isActive) {
      return apiError({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password.',
        status: 401,
      });
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return apiError({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password.',
        status: 401,
      });
    }

    if (user.memberships.length === 0) {
      return apiError({
        code: 'NO_ORGANIZATION',
        message: 'User is not assigned to any organization.',
        status: 403,
      });
    }

    const membership = user.memberships[0];
    const permissions = membership.role.rolePermissions.map((rp) => rp.permission.code);
    const assignedLocations = user.userLocations.map((ul) => ({
      id: ul.location.id,
      name: ul.location.name,
      code: ul.location.code,
      isDefault: ul.isDefault,
    }));
    const defaultLocation = assignedLocations.find((l) => l.isDefault) || assignedLocations[0];

    const token = signToken({
      userId: user.id,
      email: user.email,
      orgId: membership.orgId,
    });

    const response = apiSuccess({
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          organization: {
            id: membership.orgId,
            name: membership.organization.name,
            slug: membership.organization.slug,
            currency: membership.organization.currency,
            timezone: membership.organization.timezone,
            taxRate: Number(membership.organization.taxRate),
            negativeStockEnabled: membership.organization.negativeStockEnabled,
          },
          role: {
            id: membership.role.id,
            name: membership.role.name,
          },
          permissions,
          assignedLocations,
          defaultLocationId: defaultLocation?.id,
        },
      },
    });

    // Set HTTP-only Cookie for security
    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    return response;
  } catch (error: any) {
    return apiError({
      code: 'SERVER_ERROR',
      message: error.message || 'Failed to authenticate user.',
      status: 500,
    });
  }
}

