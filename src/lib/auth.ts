import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';
import prisma from './prisma';
import { apiError } from './api-response';

const JWT_SECRET = process.env.JWT_SECRET || 'inventory-pro-default-secure-key-2026';

export interface TokenPayload {
  userId: string;
  email: string;
  orgId: string;
}

export interface UserSession {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  orgId: string;
  orgName: string;
  roleId: string;
  roleName: string;
  permissions: string[];
  assignedLocationIds: string[];
  defaultLocationId?: string;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(payload: TokenPayload, expiresIn: string = '7d'): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn } as jwt.SignOptions);
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch (err) {
    return null;
  }
}

export async function getAuthSession(req: NextRequest): Promise<UserSession | null> {
  let token: string | null = null;
  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else {
    // Check cookie
    const cookie = req.cookies.get('token');
    if (cookie) token = cookie.value;
  }

  if (!token) return null;

  const payload = verifyToken(token);
  if (!payload || !payload.userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    include: {
      memberships: {
        where: payload.orgId ? { orgId: payload.orgId } : undefined,
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
      userLocations: true,
    },
  });

  if (!user || !user.isActive || user.memberships.length === 0) {
    return null;
  }

  const membership = user.memberships[0];
  const permissions = membership.role.rolePermissions.map((rp) => rp.permission.code);
  const assignedLocationIds = user.userLocations.map((ul) => ul.locationId);
  const defaultLoc = user.userLocations.find((ul) => ul.isDefault);

  return {
    userId: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    orgId: membership.orgId,
    orgName: membership.organization.name,
    roleId: membership.roleId,
    roleName: membership.role.name,
    permissions,
    assignedLocationIds,
    defaultLocationId: defaultLoc?.locationId || assignedLocationIds[0],
  };
}

export function hasPermission(session: UserSession, permissionCode: string): boolean {
  if (session.roleName === 'Super Admin' || session.roleName === 'Company Admin') {
    return true;
  }
  return session.permissions.includes(permissionCode);
}

export function checkPermission(session: UserSession | null, permissionCode: string) {
  if (!session) {
    return apiError({
      code: 'UNAUTHORIZED',
      message: 'Authentication required. Please log in.',
      status: 401,
    });
  }
  if (!hasPermission(session, permissionCode)) {
    return apiError({
      code: 'FORBIDDEN',
      message: `Access denied. Missing permission: ${permissionCode}`,
      status: 403,
    });
  }
  return null;
}

