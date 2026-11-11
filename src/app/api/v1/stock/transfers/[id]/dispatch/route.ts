import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthSession, checkPermission } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { StockLedgerService } from '@/lib/services/stock-ledger';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAuthSession(req);
    const authCheck = checkPermission(session, 'stock.transfer');
    if (authCheck) return authCheck;

    const { id } = params;

    const updated = await prisma.$transaction(async (tx) => {
      return StockLedgerService.dispatchTransfer(tx, session!.orgId, id, session!.userId);
    });

    return apiSuccess({
      message: 'Transfer successfully dispatched. Source inventory decremented and placed in-transit.',
      data: updated,
    });
  } catch (error: any) {
    return apiError({
      code: 'DISPATCH_ERROR',
      message: error.message || 'Failed to dispatch transfer.',
      status: 400,
    });
  }
}

