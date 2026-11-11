import Papa from 'papaparse';
import prisma from '../prisma';
import { StockLedgerService } from './stock-ledger';

export interface CsvRow {
  SKU: string;
  'Item Name': string;
  Category?: string;
  Brand?: string;
  Barcode?: string;
  Unit?: string;
  'Cost Price': string | number;
  'Selling Price': string | number;
  'Opening Stock'?: string | number;
  'Reorder Level'?: string | number;
  Description?: string;
}

export interface ValidationError {
  row: number;
  sku: string;
  field: string;
  message: string;
}

export interface ImportPreviewResult {
  totalRows: number;
  validCount: number;
  invalidCount: number;
  validRows: Array<{
    sku: string;
    name: string;
    category?: string;
    brand?: string;
    barcode?: string;
    unit?: string;
    purchaseCost: number;
    sellingPrice: number;
    openingStock: number;
    reorderLevel: number;
    description?: string;
  }>;
  errors: ValidationError[];
}

export class CsvEngineService {
  /**
   * Generates sanitized standard CSV template. Prevents formula injection.
   */
  static generateTemplate(): string {
    const headers = [
      'SKU',
      'Item Name',
      'Category',
      'Brand',
      'Barcode',
      'Unit',
      'Cost Price',
      'Selling Price',
      'Opening Stock',
      'Reorder Level',
      'Description',
    ];

    const sampleRows = [
      [
        'LOGI-MXM3S-01',
        'Logitech MX Master 3S Mouse',
        'Peripherals & Accessories',
        'Logitech',
        '097855173737',
        'PCS',
        '65.00',
        '99.99',
        '50',
        '10',
        'Ergonomic wireless productivity mouse with MagSpeed scroll',
      ],
      [
        'DELL-KB216-BLK',
        'Dell Wired Keyboard KB216',
        'Peripherals & Accessories',
        'Dell Technologies',
        '884116200215',
        'PCS',
        '12.50',
        '24.99',
        '100',
        '20',
        'Standard full-sized chiclet office keyboard',
      ],
    ];

    const rows = [headers, ...sampleRows];
    return Papa.unparse(rows);
  }

  /**
   * Sanitizes string values to prevent formula injection in CSV exports.
   * Prepends a single quote if string begins with =, +, -, @, \t, \r.
   */
  static sanitizeCsvValue(val: any): string {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (/^[=+\-@\t\r]/.test(str)) {
      return `'${str}`;
    }
    return str;
  }

  /**
   * Validates CSV text, checks headers, data types, and detects duplicates (Dry-Run).
   */
  static async validateCsv(orgId: string, csvContent: string): Promise<ImportPreviewResult> {
    const parsed = Papa.parse<CsvRow>(csvContent, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (h) => h.trim(),
    });

    if (parsed.errors.length > 0 && parsed.data.length === 0) {
      throw new Error(`CSV parsing error: ${parsed.errors.map((e) => e.message).join(', ')}`);
    }

    const rows = parsed.data;
    const errors: ValidationError[] = [];
    const validRows: ImportPreviewResult['validRows'] = [];

    // Check required header presence
    const requiredHeaders = ['SKU', 'Item Name', 'Cost Price', 'Selling Price'];
    const fields = parsed.meta.fields || [];
    for (const req of requiredHeaders) {
      if (!fields.includes(req)) {
        throw new Error(`Missing mandatory CSV column: "${req}". Please use the official CSV template.`);
      }
    }

    // Existing SKUs and Barcodes in database for this organization
    const existingProducts = await prisma.product.findMany({
      where: { orgId },
      select: { sku: true, barcode: true },
    });
    const dbSkus = new Set(existingProducts.map((p) => p.sku.toUpperCase()));
    const dbBarcodes = new Set(
      existingProducts.filter((p) => p.barcode).map((p) => p.barcode!.toUpperCase())
    );

    const fileSkus = new Set<string>();
    const fileBarcodes = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2; // header is line 1
      const row = rows[i];
      const sku = (row.SKU || '').trim();
      const name = (row['Item Name'] || '').trim();
      const barcode = (row.Barcode || '').trim();
      const costStr = String(row['Cost Price'] || '').trim();
      const priceStr = String(row['Selling Price'] || '').trim();
      const stockStr = String(row['Opening Stock'] || '0').trim();
      const reorderStr = String(row['Reorder Level'] || '10').trim();

      // Validate SKU
      if (!sku) {
        errors.push({ row: rowNum, sku: '', field: 'SKU', message: 'SKU is required.' });
        continue;
      }
      if (fileSkus.has(sku.toUpperCase())) {
        errors.push({ row: rowNum, sku, field: 'SKU', message: `Duplicate SKU "${sku}" found within CSV.` });
        continue;
      }
      if (dbSkus.has(sku.toUpperCase())) {
        errors.push({ row: rowNum, sku, field: 'SKU', message: `SKU "${sku}" already exists in the database.` });
        continue;
      }
      fileSkus.add(sku.toUpperCase());

      // Validate Name
      if (!name) {
        errors.push({ row: rowNum, sku, field: 'Item Name', message: 'Item Name is required.' });
        continue;
      }

      // Validate Barcode uniqueness
      if (barcode) {
        if (fileBarcodes.has(barcode.toUpperCase())) {
          errors.push({ row: rowNum, sku, field: 'Barcode', message: `Duplicate Barcode "${barcode}" in CSV.` });
          continue;
        }
        if (dbBarcodes.has(barcode.toUpperCase())) {
          errors.push({ row: rowNum, sku, field: 'Barcode', message: `Barcode "${barcode}" already registered.` });
          continue;
        }
        fileBarcodes.add(barcode.toUpperCase());
      }

      // Validate Cost Price
      const cost = parseFloat(costStr);
      if (isNaN(cost) || cost < 0) {
        errors.push({ row: rowNum, sku, field: 'Cost Price', message: 'Cost Price must be a non-negative number.' });
        continue;
      }

      // Validate Selling Price
      const price = parseFloat(priceStr);
      if (isNaN(price) || price < 0) {
        errors.push({ row: rowNum, sku, field: 'Selling Price', message: 'Selling Price must be a non-negative number.' });
        continue;
      }

      // Validate Opening Stock & Reorder Level
      const openingStock = parseFloat(stockStr);
      if (isNaN(openingStock) || openingStock < 0) {
        errors.push({ row: rowNum, sku, field: 'Opening Stock', message: 'Opening Stock must be non-negative.' });
        continue;
      }

      const reorderLevel = parseFloat(reorderStr);
      if (isNaN(reorderLevel) || reorderLevel < 0) {
        errors.push({ row: rowNum, sku, field: 'Reorder Level', message: 'Reorder Level must be non-negative.' });
        continue;
      }

      validRows.push({
        sku,
        name,
        category: (row.Category || '').trim() || undefined,
        brand: (row.Brand || '').trim() || undefined,
        barcode: barcode || undefined,
        unit: (row.Unit || '').trim() || undefined,
        purchaseCost: cost,
        sellingPrice: price,
        openingStock,
        reorderLevel,
        description: (row.Description || '').trim() || undefined,
      });
    }

    return {
      totalRows: rows.length,
      validCount: validRows.length,
      invalidCount: errors.length,
      validRows,
      errors,
    };
  }

  /**
   * Commits validated CSV rows inside an atomic transaction, resolving
   * categories, brands, and units, and recording opening stock ledger movements.
   */
  static async processImport(
    orgId: string,
    locationId: string,
    validRows: ImportPreviewResult['validRows'],
    userId?: string
  ) {
    if (validRows.length === 0) {
      throw new Error('No valid product rows to import.');
    }

    let successCount = 0;

    await prisma.$transaction(async (tx) => {
      // Pre-fetch or create units
      const existingUnits = await tx.unit.findMany({ where: { orgId } });
      const unitMap = new Map(existingUnits.map((u) => [u.code.toUpperCase(), u.id]));

      // Pre-fetch or create categories
      const existingCats = await tx.category.findMany({ where: { orgId } });
      const catMap = new Map(existingCats.map((c) => [c.name.toLowerCase(), c.id]));

      // Pre-fetch or create brands
      const existingBrands = await tx.brand.findMany({ where: { orgId } });
      const brandMap = new Map(existingBrands.map((b) => [b.name.toLowerCase(), b.id]));

      for (const row of validRows) {
        // Resolve Category
        let categoryId: string | undefined = undefined;
        if (row.category) {
          const key = row.category.toLowerCase();
          if (catMap.has(key)) {
            categoryId = catMap.get(key);
          } else {
            const newCat = await tx.category.create({
              data: {
                orgId,
                name: row.category,
                code: `CAT-${row.category.slice(0, 4).toUpperCase()}-${Math.floor(Math.random() * 899 + 100)}`,
              },
            });
            categoryId = newCat.id;
            catMap.set(key, newCat.id);
          }
        }

        // Resolve Brand
        let brandId: string | undefined = undefined;
        if (row.brand) {
          const key = row.brand.toLowerCase();
          if (brandMap.has(key)) {
            brandId = brandMap.get(key);
          } else {
            const newBrand = await tx.brand.create({
              data: {
                orgId,
                name: row.brand,
              },
            });
            brandId = newBrand.id;
            brandMap.set(key, newBrand.id);
          }
        }

        // Resolve Unit
        let unitId: string | undefined = undefined;
        if (row.unit) {
          const key = row.unit.toUpperCase();
          if (unitMap.has(key)) {
            unitId = unitMap.get(key);
          } else {
            const newUnit = await tx.unit.create({
              data: {
                orgId,
                name: row.unit,
                code: key,
                symbol: key.toLowerCase(),
              },
            });
            unitId = newUnit.id;
            unitMap.set(key, newUnit.id);
          }
        }

        // Create Product
        const product = await tx.product.create({
          data: {
            orgId,
            name: row.name,
            sku: row.sku,
            barcode: row.barcode,
            categoryId,
            brandId,
            unitId,
            purchaseCost: row.purchaseCost,
            sellingPrice: row.sellingPrice,
            minStock: row.reorderLevel,
            description: row.description,
            status: 'ACTIVE',
          },
        });

        // If barcode is present, register in productBarcode
        if (row.barcode) {
          await tx.productBarcode.create({
            data: {
              productId: product.id,
              barcode: row.barcode,
              isPrimary: true,
            },
          });
        }

        // Record opening stock and create stock ledger movement if stock > 0
        if (row.openingStock > 0) {
          await StockLedgerService.recordMovement(tx, {
            orgId,
            productId: product.id,
            locationId,
            type: 'OPENING_BALANCE',
            quantity: row.openingStock,
            unitCost: row.purchaseCost,
            reason: 'Opening stock from CSV bulk import',
            userId,
          });
        } else {
          // Initialize empty stock balance
          await tx.stockBalance.create({
            data: {
              orgId,
              productId: product.id,
              locationId,
              onHand: 0,
              reserved: 0,
              inTransit: 0,
            },
          });
        }

        successCount++;
      }
    });

    return { importedCount: successCount };
  }
}

