import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { z } from 'zod';

const createBatchSchema = z.object({
  productId: z.string().min(1, 'Product is required'),
  locationId: z.string().optional(),
  batchNumber: z.string().min(1, 'Batch number is required'),
  quantity: z.number().min(0, 'Quantity must be non-negative'),
  manufactureDate: z.string().optional(),
  expiryDate: z.string().optional(),
  status: z.enum(['ACTIVE', 'EXPIRED', 'QUARANTINED']).default('ACTIVE'),
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

    const where: any = { orgId: user.orgId };
    if (productId) where.productId = productId;
    if (locationId) where.locationId = locationId;
    if (status) where.status = status;

    const batches = await prisma.productBatch.findMany({
      where,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            unit: { select: { code: true } },
          },
        },
        location: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
      orderBy: { expiryDate: 'asc' },
    });

    const now = new Date();
    const formatted = batches.map((b) => {
      const isExpiringSoon = b.expiryDate
        ? (new Date(b.expiryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24) <= 30 &&
          new Date(b.expiryDate).getTime() > now.getTime()
        : false;

      const isExpired = b.expiryDate ? new Date(b.expiryDate).getTime() <= now.getTime() : false;

      return {
        ...b,
        quantity: Number(b.quantity),
        isExpiringSoon,
        isExpired,
      };
    });

    return successResponse(formatted);
  } catch (error: any) {
    return errorResponse(error.message || 'Failed to fetch batches', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    const body = await request.json();
    const validated = createBatchSchema.parse(body);

    const existing = await prisma.productBatch.findUnique({
      where: {
        orgId_productId_batchNumber: {
          orgId: user.orgId,
          productId: validated.productId,
          batchNumber: validated.batchNumber,
        },
      },
    });

    if (existing) {
      return errorResponse('Batch number already exists for this product', 409);
    }

    const batch = await prisma.productBatch.create({
      data: {
        orgId: user.orgId,
        productId: validated.productId,
        locationId: validated.locationId || null,
        batchNumber: validated.batchNumber,
        quantity: validated.quantity,
        manufactureDate: validated.manufactureDate ? new Date(validated.manufactureDate) : null,
        expiryDate: validated.expiryDate ? new Date(validated.expiryDate) : null,
        status: validated.status,
      },
      include: {
        product: { select: { id: true, name: true, sku: true } },
        location: { select: { id: true, name: true } },
      },
    });

    return successResponse(batch, 'Batch created successfully', 201);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return errorResponse('Validation failed', 400, error.errors.map((e) => e.message));
    }
    return errorResponse(error.message || 'Failed to create batch', 500);
  }
}
