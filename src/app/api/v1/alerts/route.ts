import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthSession, checkPermission } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { AlertEngineService } from '@/lib/services/alert-engine';

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    const authCheck = checkPermission(session, 'inventory.view');
    if (authCheck) return authCheck;

    // Trigger proactive scan
    await AlertEngineService.scanInventoryAlerts(session!.orgId);

    const alerts = await prisma.inventoryAlert.findMany({
      where: {
        orgId: session!.orgId,
        status: { in: ['NEW', 'READ', 'ACKNOWLEDGED'] },
      },
      include: {
        product: { select: { id: true, name: true, sku: true, barcode: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return apiSuccess({
      data: alerts.map((a) => ({
        id: a.id,
        productId: a.productId,
        productName: a.product.name,
        sku: a.product.sku,
        alertType: a.alertType,
        severity: a.severity,
        status: a.status,
        message: a.message,
        details: a.details ? JSON.parse(a.details) : null,
        createdAt: a.createdAt,
      })),
      meta: {
        total: alerts.length,
        criticalCount: alerts.filter((a) => a.severity === 'CRITICAL').length,
        warningCount: alerts.filter((a) => a.severity === 'WARNING').length,
      },
    });
  } catch (error: any) {
    return apiError({
      code: 'SERVER_ERROR',
      message: error.message || 'Failed to fetch inventory alerts.',
      status: 500,
    });
  }
}

