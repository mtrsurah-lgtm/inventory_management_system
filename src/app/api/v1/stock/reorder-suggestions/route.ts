import { NextRequest } from 'next/server';
import { getAuthSession, checkPermission } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { AlertEngineService } from '@/lib/services/alert-engine';

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    const authCheck = checkPermission(session, 'inventory.view');
    if (authCheck) return authCheck;

    const { searchParams } = new URL(req.url);
    const locationId = searchParams.get('locationId') || undefined;

    const suggestions = await AlertEngineService.calculateReorderSuggestions(
      session!.orgId,
      locationId
    );

    return apiSuccess({
      data: suggestions,
      meta: {
        totalSuggestions: suggestions.length,
        totalEstimatedRestockCost: Number(
          suggestions.reduce((sum, s) => sum + s.estimatedCost, 0).toFixed(2)
        ),
      },
    });
  } catch (error: any) {
    return apiError({
      code: 'SERVER_ERROR',
      message: error.message || 'Failed to calculate reorder suggestions.',
      status: 500,
    });
  }
}

