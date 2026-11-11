import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthSession, checkPermission } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/api-response';

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    const authCheck = checkPermission(session, 'stock.transfer');
    if (authCheck) return authCheck;

    const transfers = await prisma.stockTransfer.findMany({
      where: { orgId: session!.orgId },
      include: {
        sourceLocation: { select: { id: true, name: true, code: true } },
        destinationLocation: { select: { id: true, name: true, code: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return apiSuccess({
      data: transfers.map((t) => ({
        id: t.id,
        transferNumber: t.transferNumber,
        sourceLocation: t.sourceLocation,
        destinationLocation: t.destinationLocation,
        status: t.status,
        dispatchDate: t.dispatchDate,
        receiveDate: t.receiveDate,
        notes: t.notes,
        createdAt: t.createdAt,
        itemCount: t.items.length,
        items: t.items.map((i) => ({
          id: i.id,
          productId: i.productId,
          productName: i.product.name,
          sku: i.product.sku,
          quantityDispatched: Number(i.quantityDispatched),
          quantityReceived: Number(i.quantityReceived),
          quantityDamaged: Number(i.quantityDamaged),
          notes: i.notes,
        })),
      })),
    });
  } catch (error: any) {
    return apiError({
      code: 'SERVER_ERROR',
      message: error.message || 'Failed to fetch transfers.',
      status: 500,
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    const authCheck = checkPermission(session, 'stock.transfer');
    if (authCheck) return authCheck;

    const { sourceLocationId, destinationLocationId, items, notes } = await req.json();

    if (!sourceLocationId || !destinationLocationId || !items || items.length === 0) {
      return apiError({
        code: 'VALIDATION_ERROR',
        message: 'Source, destination, and at least one item are required.',
        status: 400,
      });
    }

    if (sourceLocationId === destinationLocationId) {
      return apiError({
        code: 'INVALID_TRANSFER',
        message: 'Source and destination locations cannot be identical.',
        status: 400,
      });
    }

    const transferCount = await prisma.stockTransfer.count({ where: { orgId: session!.orgId } });
    const transferNumber = `TRF-${new Date().getFullYear()}-${String(transferCount + 1).padStart(4, '0')}`;

    const transfer = await prisma.stockTransfer.create({
      data: {
        orgId: session!.orgId,
        transferNumber,
        sourceLocationId,
        destinationLocationId,
        status: 'DRAFT',
        notes: notes?.trim() || null,
        createdById: session!.userId,
        items: {
          create: items.map((it: any) => ({
            productId: it.productId,
            quantityDispatched: Number(it.quantity),
            notes: it.notes,
          })),
        },
      },
      include: {
        items: true,
      },
    });

    return apiSuccess({
      message: 'Transfer draft created successfully',
      data: transfer,
      status: 201,
    });
  } catch (error: any) {
    return apiError({
      code: 'SERVER_ERROR',
      message: error.message || 'Failed to create transfer.',
      status: 500,
    });
  }
}

