import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthSession, checkPermission } from '@/lib/auth';
import { CsvEngineService } from '@/lib/services/csv-engine';
import Papa from 'papaparse';

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    const authCheck = checkPermission(session, 'reports.export');
    if (authCheck) return authCheck;

    const products = await prisma.product.findMany({
      where: { orgId: session!.orgId, status: { not: 'ARCHIVED' } },
      include: {
        category: true,
        brand: true,
        unit: true,
        stockBalances: true,
      },
      orderBy: { name: 'asc' },
    });

    const headers = [
      'SKU',
      'Item Name',
      'Category',
      'Brand',
      'Barcode',
      'Unit',
      'Cost Price',
      'Selling Price',
      'Total On Hand',
      'Total Reserved',
      'Available Stock',
      'Status',
    ];

    const rows = products.map((p) => {
      let onHand = 0;
      let reserved = 0;
      for (const sb of p.stockBalances) {
        onHand += Number(sb.onHand);
        reserved += Number(sb.reserved);
      }

      return [
        CsvEngineService.sanitizeCsvValue(p.sku),
        CsvEngineService.sanitizeCsvValue(p.name),
        CsvEngineService.sanitizeCsvValue(p.category?.name || ''),
        CsvEngineService.sanitizeCsvValue(p.brand?.name || ''),
        CsvEngineService.sanitizeCsvValue(p.barcode || ''),
        CsvEngineService.sanitizeCsvValue(p.unit?.symbol || 'pcs'),
        Number(p.purchaseCost).toFixed(2),
        Number(p.sellingPrice).toFixed(2),
        onHand,
        reserved,
        onHand - reserved,
        p.status,
      ];
    });

    const csv = Papa.unparse([headers, ...rows]);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="inventory_pro_products_${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

