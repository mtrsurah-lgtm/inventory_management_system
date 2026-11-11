import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthSession, checkPermission } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
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
    const session = await getAuthSession(request);
    const authCheck = checkPermission(session, 'inventory.view');
    if (authCheck) return authCheck;

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');
    const locationId = searchParams.get('locationId');
    const status = searchParams.get('status');

    const where: any = { orgId: session!.orgId };
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

    return apiSuccess({ data: formatted });
  } catch (error: any) {
    return apiError({ message: error.message || 'Failed to fetch batches', status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession(request);
    const authCheck = checkPermission(session, 'inventory.create');
    if (authCheck) return authCheck;

    const body = await request.json();
    const validated = createBatchSchema.parse(body);

    const existing = await prisma.productBatch.findUnique({
      where: {
        orgId_productId_batchNumber: {
          orgId: session!.orgId,
          productId: validated.productId,
          batchNumber: validated.batchNumber,
        },
      },
    });

    if (existing) {
      return apiError({ message: 'Batch number already exists for this product', status: 409 });
    }

    const batch = await prisma.productBatch.create({
      data: {
        orgId: session!.orgId,
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

    return apiSuccess({ data: batch, message: 'Batch created successfully', status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return apiError({
        message: 'Validation failed',
        details: error.errors.map((e) => e.message),
        status: 400,
      });
    }
    return apiError({ message: error.message || 'Failed to create batch', status: 500 });
  }
}
