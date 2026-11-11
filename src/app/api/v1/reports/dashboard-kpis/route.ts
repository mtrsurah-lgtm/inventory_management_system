import { NextRequest } from 'next/server';
import { getAuthSession, checkPermission } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ReportingService } from '@/lib/services/reporting';
import { AlertEngineService } from '@/lib/services/alert-engine';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    const authCheck = checkPermission(session, 'reports.view');
    if (authCheck) return authCheck;

    const { searchParams } = new URL(req.url);
    const period = searchParams.get('period') || 'this_month';
    const locationId = searchParams.get('locationId') || undefined;

    // 1. Calculate Core KPIs
    const kpis = await ReportingService.getDashboardKPIs(session!.orgId, locationId, period);

    // 2. Revenue Trends
    const trends = await ReportingService.getRevenueTrends(session!.orgId, locationId, period);

    // 3. Top-Selling Products
    const topSelling = await AlertEngineService.getHotSellingProducts(session!.orgId, 14, locationId);

    // 4. Inventory Composition
    const composition = await ReportingService.getInventoryComposition(session!.orgId, locationId);

    // 5. Stock Health by Location
    const stockHealth = await ReportingService.getStockHealth(session!.orgId);

    // 6. Slow-Moving Products
    const slowMoving = await AlertEngineService.getSlowMovingProducts(session!.orgId, 30, locationId);

    // 7. Recent Sales Activity Data Grid
    const recentActivity = await prisma.salesOrder.findMany({
      where: {
        orgId: session!.orgId,
        locationId: locationId || undefined,
      },
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: { select: { name: true } },
        location: { select: { name: true } },
        _count: { select: { items: true } },
      },
    });

    return apiSuccess({
      data: {
        kpis,
        trends,
        topSelling: topSelling.slice(0, 10),
        composition,
        stockHealth,
        slowMoving: slowMoving.slice(0, 10),
        recentActivity: recentActivity.map((ra) => ({
          id: ra.id,
          orderNumber: ra.orderNumber,
          date: ra.createdAt,
          customer: ra.customer?.name || 'Walk-in Customer',
          location: ra.location.name,
          itemsCount: ra._count.items,
          totalAmount: Number(ra.totalAmount),
          paymentStatus: ra.paymentStatus,
          status: ra.status,
        })),
      },
    });
  } catch (error: any) {
    return apiError({
      code: 'SERVER_ERROR',
      message: error.message || 'Failed to fetch dashboard metrics.',
      status: 500,
    });
  }
}

