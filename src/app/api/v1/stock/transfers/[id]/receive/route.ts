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
    const { receivedItems } = await req.json();

    if (!receivedItems || !Array.isArray(receivedItems)) {
      return apiError({
        code: 'VALIDATION_ERROR',
        message: 'receivedItems array is required.',
        status: 400,
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      return StockLedgerService.receiveTransfer(tx, {
        orgId: session!.orgId,
        transferId: id,
        receivedItems,
        userId: session!.userId,
      });
    });

    return apiSuccess({
      message: 'Transfer goods received successfully. Destination inventory credited with ledger entries.',
      data: updated,
    });
  } catch (error: any) {
    return apiError({
      code: 'RECEIVE_ERROR',
      message: error.message || 'Failed to receive transfer.',
      status: 400,
    });
  }
}

