import { NextRequest } from 'next/server';
import { getAuthSession, checkPermission } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { CsvEngineService } from '@/lib/services/csv-engine';

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    const authCheck = checkPermission(session, 'inventory.create');
    if (authCheck) return authCheck;

    const body = await req.json();
    const { csvContent } = body;

    if (!csvContent || typeof csvContent !== 'string') {
      return apiError({
        code: 'VALIDATION_ERROR',
        message: 'CSV text content is required.',
        status: 400,
      });
    }

    const preview = await CsvEngineService.validateCsv(session!.orgId, csvContent);

    return apiSuccess({
      message: `Validation complete. ${preview.validCount} valid rows, ${preview.invalidCount} errors found.`,
      data: preview,
    });
  } catch (error: any) {
    return apiError({
      code: 'IMPORT_VALIDATION_FAILED',
      message: error.message || 'Failed to validate CSV.',
      status: 400,
    });
  }
}

