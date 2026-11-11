import { NextResponse } from 'next/server';
import { CsvEngineService } from '@/lib/services/csv-engine';

export async function GET() {
  const csv = CsvEngineService.generateTemplate();

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="inventory_pro_product_import_template.csv"',
    },
  });
}

