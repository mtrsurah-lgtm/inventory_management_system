const test = require('node:test');
const assert = require('node:assert');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

test('Inventory Pro Critical Inventory & Ledger Verification Suite', async (t) => {
  let org;
  let locSource;
  let locDest;
  let testProduct;

  await t.test('Setup Test Tenant & Test Locations', async () => {
    org = await prisma.organization.upsert({
      where: { slug: 'test-org-ledger' },
      update: { negativeStockEnabled: false },
      create: {
        name: 'Test Tenant Corp',
        slug: 'test-org-ledger',
        negativeStockEnabled: false,
      },
    });

    locSource = await prisma.location.upsert({
      where: { orgId_code: { orgId: org.id, code: 'TEST-LOC-SRC' } },
      update: {},
      create: { orgId: org.id, name: 'Source Test Warehouse', code: 'TEST-LOC-SRC' },
    });

    locDest = await prisma.location.upsert({
      where: { orgId_code: { orgId: org.id, code: 'TEST-LOC-DST' } },
      update: {},
      create: { orgId: org.id, name: 'Dest Test Warehouse', code: 'TEST-LOC-DST' },
    });

    const sku = `TEST-PROD-${Date.now()}`;
    testProduct = await prisma.product.create({
      data: {
        orgId: org.id,
        name: 'Test Inventory Item',
        sku,
        purchaseCost: 50.0,
        sellingPrice: 100.0,
        minStock: 10,
      },
    });

    assert.ok(testProduct.id, 'Product created');
  });

  await t.test('Critical Formula: Opening(100) + Purchase(+50) - Sale(-20) - Adjustment(-5) = 125', async () => {
    const { StockLedgerService } = require('./stock-ledger-helper');

    // 1. Opening stock = 100
    await StockLedgerService.recordMovement(prisma, {
      orgId: org.id,
      productId: testProduct.id,
      locationId: locSource.id,
      type: 'OPENING_BALANCE',
      quantity: 100,
      unitCost: 50.0,
      reason: 'Opening stock count',
    });

    let bal = await prisma.stockBalance.findFirst({
      where: { orgId: org.id, productId: testProduct.id, locationId: locSource.id },
    });
    assert.strictEqual(Number(bal.onHand), 100, 'On-hand stock must be 100 after opening');

    // 2. Purchase receipt = +50
    await StockLedgerService.recordMovement(prisma, {
      orgId: org.id,
      productId: testProduct.id,
      locationId: locSource.id,
      type: 'PURCHASE_RECEIPT',
      quantity: 50,
      unitCost: 50.0,
      reason: 'PO delivery received',
    });

    bal = await prisma.stockBalance.findFirst({
      where: { orgId: org.id, productId: testProduct.id, locationId: locSource.id },
    });
    assert.strictEqual(Number(bal.onHand), 150, 'On-hand stock must be 150 after purchase receipt');

    // 3. Completed sale = -20
    await StockLedgerService.recordMovement(prisma, {
      orgId: org.id,
      productId: testProduct.id,
      locationId: locSource.id,
      type: 'SALE',
      quantity: -20,
      unitCost: 50.0,
      reason: 'Sale invoice fulfilled',
    });

    bal = await prisma.stockBalance.findFirst({
      where: { orgId: org.id, productId: testProduct.id, locationId: locSource.id },
    });
    assert.strictEqual(Number(bal.onHand), 130, 'On-hand stock must be 130 after sale');

    // 4. Stock adjustment = -5
    await StockLedgerService.recordMovement(prisma, {
      orgId: org.id,
      productId: testProduct.id,
      locationId: locSource.id,
      type: 'ADJUSTMENT_DECREASE',
      quantity: -5,
      unitCost: 50.0,
      reason: 'Cycle count difference',
    });

    bal = await prisma.stockBalance.findFirst({
      where: { orgId: org.id, productId: testProduct.id, locationId: locSource.id },
    });
    assert.strictEqual(Number(bal.onHand), 125, 'Expected on-hand stock must equal exactly 125');

    // Verify all 4 movements exist in the permanent ledger
    const movements = await prisma.stockMovement.findMany({
      where: { orgId: org.id, productId: testProduct.id, locationId: locSource.id },
      orderBy: { createdAt: 'asc' },
    });
    assert.strictEqual(movements.length, 4, 'Permanent ledger must have exactly 4 movement entries');
    assert.strictEqual(movements[0].type, 'OPENING_BALANCE');
    assert.strictEqual(movements[1].type, 'PURCHASE_RECEIPT');
    assert.strictEqual(movements[2].type, 'SALE');
    assert.strictEqual(movements[3].type, 'ADJUSTMENT_DECREASE');
    assert.strictEqual(Number(movements[3].balanceAfter), 125);
  });

  await t.test('Reserved Stock reduces Available Stock and Cancelling releases Reservation', async () => {
    const { StockLedgerService } = require('./stock-ledger-helper');

    // Current onHand is 125, reserved is 0. Available = 125.
    // Reserve 25 units for an order
    const res = await StockLedgerService.reserveStock(prisma, {
      orgId: org.id,
      productId: testProduct.id,
      locationId: locSource.id,
      quantity: 25,
      referenceType: 'SALES_ORDER',
      referenceId: 'SO-TEST-RESERVE-01',
    });

    let bal = await prisma.stockBalance.findFirst({
      where: { orgId: org.id, productId: testProduct.id, locationId: locSource.id },
    });
    assert.strictEqual(Number(bal.onHand), 125, 'On-hand remains 125 while order is pending');
    assert.strictEqual(Number(bal.reserved), 25, 'Reserved stock increases to 25');
    const available = Number(bal.onHand) - Number(bal.reserved);
    assert.strictEqual(available, 100, 'Available stock = 125 - 25 = 100');

    // Now cancel the order and release reservation
    await StockLedgerService.releaseReservation(prisma, org.id, res.id);

    bal = await prisma.stockBalance.findFirst({
      where: { orgId: org.id, productId: testProduct.id, locationId: locSource.id },
    });
    assert.strictEqual(Number(bal.reserved), 0, 'Reserved stock returns to 0 upon release');
    assert.strictEqual(Number(bal.onHand) - Number(bal.reserved), 125, 'Available returns to 125');
  });

  await t.test('Purchase Order does not increase stock before receipt is confirmed', async () => {
    const sup = await prisma.supplier.findFirst({ where: { orgId: org.id } }) ||
      await prisma.supplier.create({
        data: { orgId: org.id, name: 'PO Test Supplier' },
      });

    const balBefore = await prisma.stockBalance.findFirst({
      where: { orgId: org.id, productId: testProduct.id, locationId: locSource.id },
    });
    const onHandBefore = Number(balBefore.onHand);

    // Create PO
    const po = await prisma.purchaseOrder.create({
      data: {
        orgId: org.id,
        poNumber: `PO-TEST-${Date.now()}`,
        supplierId: sup.id,
        locationId: locSource.id,
        status: 'CONFIRMED',
        items: {
          create: [{
            productId: testProduct.id,
            quantity: 500,
            unitCost: 50.0,
            totalAmount: 25000.0,
          }],
        },
      },
    });

    const balAfter = await prisma.stockBalance.findFirst({
      where: { orgId: org.id, productId: testProduct.id, locationId: locSource.id },
    });
    assert.strictEqual(Number(balAfter.onHand), onHandBefore, 'Stock must NOT increase upon PO creation');
  });

  await t.test('Partially received purchase increases stock only by received quantity', async () => {
    const { StockLedgerService } = require('./stock-ledger-helper');

    const balBefore = await prisma.stockBalance.findFirst({
      where: { orgId: org.id, productId: testProduct.id, locationId: locSource.id },
    });
    const onHandBefore = Number(balBefore.onHand);

    // Partially receive 30 units (out of 500 ordered)
    await StockLedgerService.recordMovement(prisma, {
      orgId: org.id,
      productId: testProduct.id,
      locationId: locSource.id,
      type: 'PURCHASE_RECEIPT',
      quantity: 30,
      unitCost: 50.0,
      reason: 'Partial delivery received',
    });

    const balAfter = await prisma.stockBalance.findFirst({
      where: { orgId: org.id, productId: testProduct.id, locationId: locSource.id },
    });
    assert.strictEqual(Number(balAfter.onHand), onHandBefore + 30, 'Only the received quantity (+30) must be credited');
  });

  await t.test('Negative inventory prevention: Sale cannot oversell when negative stock disabled', async () => {
    const { StockLedgerService } = require('./stock-ledger-helper');

    const bal = await prisma.stockBalance.findFirst({
      where: { orgId: org.id, productId: testProduct.id, locationId: locSource.id },
    });
    const currentOnHand = Number(bal.onHand);

    await assert.rejects(
      async () => {
        // Attempt to deduct 1,000,000 units
        await StockLedgerService.recordMovement(prisma, {
          orgId: org.id,
          productId: testProduct.id,
          locationId: locSource.id,
          type: 'SALE',
          quantity: -(currentOnHand + 500),
          allowNegative: false,
        });
      },
      /Insufficient inventory/,
      'Must reject overselling when negativeStockEnabled is false'
    );
  });

  await t.test('Stock transfer correctly tracks Source, In-Transit, and Destination quantities', async () => {
    const { StockLedgerService } = require('./stock-ledger-helper');

    const transfer = await prisma.stockTransfer.create({
      data: {
        orgId: org.id,
        transferNumber: `TRF-TEST-${Date.now()}`,
        sourceLocationId: locSource.id,
        destinationLocationId: locDest.id,
        status: 'DRAFT',
        items: {
          create: [{
            productId: testProduct.id,
            quantityDispatched: 40,
          }],
        },
      },
      include: { items: true },
    });

    const sourceBalBefore = await prisma.stockBalance.findFirst({
      where: { orgId: org.id, productId: testProduct.id, locationId: locSource.id },
    });
    const sourceOnHandBefore = Number(sourceBalBefore.onHand);

    // 1. Dispatch Transfer
    await StockLedgerService.dispatchTransfer(prisma, org.id, transfer.id);

    const sourceBalDispatched = await prisma.stockBalance.findFirst({
      where: { orgId: org.id, productId: testProduct.id, locationId: locSource.id },
    });
    assert.strictEqual(Number(sourceBalDispatched.onHand), sourceOnHandBefore - 40, 'Source on-hand decreased by 40');
    assert.strictEqual(Number(sourceBalDispatched.inTransit), 40, 'Source in-transit set to 40');

    // 2. Receive at Destination
    await StockLedgerService.receiveTransfer(prisma, {
      orgId: org.id,
      transferId: transfer.id,
      receivedItems: [{
        itemId: transfer.items[0].id,
        quantityReceived: 40,
        quantityDamaged: 0,
      }],
    });

    const sourceBalFinal = await prisma.stockBalance.findFirst({
      where: { orgId: org.id, productId: testProduct.id, locationId: locSource.id },
    });
    const destBalFinal = await prisma.stockBalance.findFirst({
      where: { orgId: org.id, productId: testProduct.id, locationId: locDest.id },
    });

    assert.strictEqual(Number(sourceBalFinal.inTransit), 0, 'In-transit cleared upon receipt confirmation');
    assert.strictEqual(Number(destBalFinal.onHand), 40, 'Destination warehouse received exactly 40 units');
  });

  await t.test('CSV Engine validation & duplicate detection', async () => {
    const { CsvEngineService } = require('./stock-ledger-helper');

    const validCsv = `SKU,Item Name,Category,Brand,Barcode,Unit,Cost Price,Selling Price,Opening Stock,Reorder Level,Description
VALID-SKU-001,Test Item One,Electronics,Apple,1122334455,PCS,10.00,20.00,50,5,Sample description
VALID-SKU-002,Test Item Two,Office,Dell,2233445566,PCS,5.00,15.00,100,20,Another item`;

    const preview = await CsvEngineService.validateCsv(org.id, validCsv);
    assert.strictEqual(preview.validCount, 2, 'Valid CSV rows must equal 2');
    assert.strictEqual(preview.invalidCount, 0, 'Invalid rows must equal 0');

    // Test with duplicate SKU inside the CSV
    const duplicateCsv = `SKU,Item Name,Category,Brand,Barcode,Unit,Cost Price,Selling Price,Opening Stock,Reorder Level,Description
DUP-SKU-001,Item A,Electronics,Apple,990011,PCS,10.00,20.00,50,5,Desc
DUP-SKU-001,Item B,Electronics,Apple,990022,PCS,10.00,20.00,50,5,Desc`;

    const dupPreview = await CsvEngineService.validateCsv(org.id, duplicateCsv);
    assert.strictEqual(dupPreview.invalidCount, 1, 'Must detect duplicate SKU');
  });
});
