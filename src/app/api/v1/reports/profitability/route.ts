import { NextRequest } from 'next/server';
import { getAuthSession, checkPermission } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ReportingService } from '@/lib/services/reporting';

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    const authCheck = checkPermission(session, 'reports.view');
    if (authCheck) return authCheck;

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const categoryId = searchParams.get('categoryId') || undefined;
    const locationId = searchParams.get('locationId') || undefined;

    const report = await ReportingService.getProfitabilityReport(session!.orgId, {
      startDate,
      endDate,
      categoryId,
      locationId,
    });

    return apiSuccess({
      data: report,
    });
  } catch (error: any) {
    return apiError({
      code: 'SERVER_ERROR',
      message: error.message || 'Failed to fetch profitability report.',
      status: 500,
    });
  }
}

