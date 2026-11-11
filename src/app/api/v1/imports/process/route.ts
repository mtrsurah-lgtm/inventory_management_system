import { NextRequest } from 'next/server';
import { getAuthSession, checkPermission } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { CsvEngineService } from '@/lib/services/csv-engine';
import prisma from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    const authCheck = checkPermission(session, 'inventory.create');
    if (authCheck) return authCheck;

    const body = await req.json();
    const { validRows, locationId, filename = 'products_import.csv' } = body;

    const targetLocationId = locationId || session!.defaultLocationId;
    if (!targetLocationId) {
      return apiError({
        code: 'LOCATION_REQUIRED',
        message: 'A destination location is required for importing stock balances.',
        status: 400,
      });
    }

    if (!validRows || !Array.isArray(validRows) || validRows.length === 0) {
      return apiError({
        code: 'VALIDATION_ERROR',
        message: 'No valid rows provided to commit.',
        status: 400,
      });
    }

    const result = await CsvEngineService.processImport(
      session!.orgId,
      targetLocationId,
      validRows,
      session!.userId
    );

    // Save Import History
    await prisma.importHistory.create({
      data: {
        orgId: session!.orgId,
        userId: session!.userId,
        filename,
        totalRows: validRows.length,
        successRows: result.importedCount,
        errorRows: 0,
        status: 'COMPLETED',
      },
    });

    return apiSuccess({
      message: `Successfully imported ${result.importedCount} products and created initial ledger records.`,
      data: result,
      status: 201,
    });
  } catch (error: any) {
    return apiError({
      code: 'IMPORT_EXECUTION_FAILED',
      message: error.message || 'Failed to process product import.',
      status: 500,
    });
  }
}

