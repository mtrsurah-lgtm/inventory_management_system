import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthSession, checkPermission } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { z } from 'zod';

const createSerialSchema = z.object({
  productId: z.string().min(1, 'Product is required'),
  locationId: z.string().optional(),
  serialNumbers: z.array(z.string().min(1)).min(1, 'At least one serial number required'),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession(request);
    const authCheck = checkPermission(session, 'inventory.view');
    if (authCheck) return authCheck;

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');
    const locationId = searchParams.get('locationId');
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const where: any = { orgId: session!.orgId };
    if (productId) where.productId = productId;
    if (locationId) where.locationId = locationId;
    if (status) where.status = status;
    if (search) {
      where.serialNumber = { contains: search };
    }

    const serials = await prisma.serialNumber.findMany({
      where,
      include: {
        product: { select: { id: true, name: true, sku: true } },
        location: { select: { id: true, name: true, code: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return apiSuccess({ data: serials });
  } catch (error: any) {
    return apiError({ message: error.message || 'Failed to fetch serial numbers', status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession(request);
    const authCheck = checkPermission(session, 'inventory.create');
    if (authCheck) return authCheck;

    const body = await request.json();
    const validated = createSerialSchema.parse(body);

    const created = await prisma.$transaction(async (tx) => {
      const results = [];
      for (const sn of validated.serialNumbers) {
        const item = await tx.serialNumber.create({
          data: {
            orgId: session!.orgId,
            productId: validated.productId,
            locationId: validated.locationId || null,
            serialNumber: sn.trim(),
            status: 'IN_STOCK',
          },
        });
        results.push(item);
      }
      return results;
    });

    return apiSuccess({
      data: created,
      message: `Successfully registered ${created.length} serial numbers`,
      status: 201,
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return apiError({ message: 'One or more serial numbers already exist', status: 409 });
    }
    if (error instanceof z.ZodError) {
      return apiError({
        message: 'Validation failed',
        details: error.errors.map((e) => e.message),
        status: 400,
      });
    }
    return apiError({ message: error.message || 'Failed to register serial numbers', status: 500 });
  }
}
