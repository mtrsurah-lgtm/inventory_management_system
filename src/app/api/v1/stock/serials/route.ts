import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { z } from 'zod';

const createSerialSchema = z.object({
  productId: z.string().min(1, 'Product is required'),
  locationId: z.string().optional(),
  serialNumbers: z.array(z.string().min(1)).min(1, 'At least one serial number required'),
});

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');
    const locationId = searchParams.get('locationId');
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const where: any = { orgId: user.orgId };
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

    return successResponse(serials);
  } catch (error: any) {
    return errorResponse(error.message || 'Failed to fetch serial numbers', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    const body = await request.json();
    const validated = createSerialSchema.parse(body);

    const created = await prisma.$transaction(async (tx) => {
      const results = [];
      for (const sn of validated.serialNumbers) {
        const item = await tx.serialNumber.create({
          data: {
            orgId: user.orgId,
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

    return successResponse(created, `Successfully registered ${created.length} serial numbers`, 201);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return errorResponse('One or more serial numbers already exist', 409);
    }
    if (error instanceof z.ZodError) {
      return errorResponse('Validation failed', 400, error.errors.map((e) => e.message));
    }
    return errorResponse(error.message || 'Failed to register serial numbers', 500);
  }
}

