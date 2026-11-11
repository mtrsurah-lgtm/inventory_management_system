const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const PERMISSIONS = [
  { code: 'inventory.view', module: 'inventory', description: 'View products and stock levels' },
  { code: 'inventory.create', module: 'inventory', description: 'Create new products and categories' },
  { code: 'inventory.update', module: 'inventory', description: 'Update products, prices, and settings' },
  { code: 'inventory.delete', module: 'inventory', description: 'Archive or delete products' },
  { code: 'inventory.adjust', module: 'inventory', description: 'Perform stock adjustments and write-offs' },
  { code: 'purchases.view', module: 'purchases', description: 'View purchase orders and supplier bills' },
  { code: 'purchases.create', module: 'purchases', description: 'Create and edit purchase orders' },
  { code: 'purchases.approve', module: 'purchases', description: 'Approve and post purchase receipts' },
  { code: 'sales.view', module: 'sales', description: 'View sales orders, POS transactions, and customer history' },
  { code: 'sales.create', module: 'sales', description: 'Create sales orders and process POS checkout' },
  { code: 'sales.refund', module: 'sales', description: 'Process customer returns and issue refunds' },
  { code: 'stock.transfer', module: 'stock', description: 'Create, dispatch, and receive stock transfers' },
  { code: 'reports.view', module: 'reports', description: 'View inventory, sales, and valuation reports' },
  { code: 'reports.export', module: 'reports', description: 'Export business reports to CSV/Excel' },
  { code: 'users.manage', module: 'settings', description: 'Manage users and invitations' },
  { code: 'roles.manage', module: 'settings', description: 'Manage roles and security permissions' },
  { code: 'settings.manage', module: 'settings', description: 'Manage company settings, tax, and locations' },
];

async function main() {
  console.log('--- Starting Seed: Inventory Pro Production-Ready Data ---');

  // 1. Seed Permissions
  console.log('Seeding granular permissions...');
  for (const perm of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code: perm.code },
      update: { module: perm.module, description: perm.description },
      create: perm,
    });
  }
  const allPerms = await prisma.permission.findMany();
  const permMap = new Map(allPerms.map((p) => [p.code, p.id]));

  // 2. Create Organization
  console.log('Creating Default Organization: Acme Global Logistics & Retail...');
  const org = await prisma.organization.upsert({
    where: { slug: 'acme-global' },
    update: {
      name: 'Acme Global Logistics & Retail',
      currency: 'USD',
      timezone: 'America/New_York',
      taxRate: 8.5,
      dateFormat: 'YYYY-MM-DD',
      negativeStockEnabled: false,
    },
    create: {
      name: 'Acme Global Logistics & Retail',
      slug: 'acme-global',
      currency: 'USD',
      timezone: 'America/New_York',
      taxRate: 8.5,
      dateFormat: 'YYYY-MM-DD',
      negativeStockEnabled: false,
    },
  });

  // 3. Create Locations
  console.log('Creating Locations...');
  const locMain = await prisma.location.upsert({
    where: { orgId_code: { orgId: org.id, code: 'WH-MAIN' } },
    update: { name: 'Main Distribution Warehouse', isPrimary: true, isActive: true },
    create: {
      orgId: org.id,
      name: 'Main Distribution Warehouse',
      code: 'WH-MAIN',
      address: '100 Industrial Parkway, Logan Terminal, NY 11201',
      isPrimary: true,
      isActive: true,
    },
  });

  const locStore = await prisma.location.upsert({
    where: { orgId_code: { orgId: org.id, code: 'STORE-01' } },
    update: { name: 'Downtown Flagship Store', isPrimary: false, isActive: true },
    create: {
      orgId: org.id,
      name: 'Downtown Flagship Store',
      code: 'STORE-01',
      address: '450 Broadway, New York, NY 10013',
      isPrimary: false,
      isActive: true,
    },
  });

  const locWest = await prisma.location.upsert({
    where: { orgId_code: { orgId: org.id, code: 'WH-WEST' } },
    update: { name: 'West Coast Logistics Hub', isPrimary: false, isActive: true },
    create: {
      orgId: org.id,
      name: 'West Coast Logistics Hub',
      code: 'WH-WEST',
      address: '780 Logistics Way, San Francisco, CA 94107',
      isPrimary: false,
      isActive: true,
    },
  });

  // 4. Create Standard System Roles
  console.log('Configuring System Roles and Permissions...');
  const roleDefs = [
    {
      name: 'Super Admin',
      description: 'Complete unrestricted system access across all tenants and features',
      isSystem: true,
      permissions: allPerms.map((p) => p.code),
    },
    {
      name: 'Company Admin',
      description: 'Full administrative control over company inventory, finances, users, and settings',
      isSystem: true,
      permissions: allPerms.map((p) => p.code),
    },
    {
      name: 'Manager',
      description: 'Operations manager with authorization to transfer, adjust, receive, and view reports',
      isSystem: true,
      permissions: [
        'inventory.view', 'inventory.create', 'inventory.update', 'inventory.adjust',
        'purchases.view', 'purchases.create', 'purchases.approve',
        'sales.view', 'sales.create', 'sales.refund',
        'stock.transfer', 'reports.view', 'reports.export',
      ],
    },
    {
      name: 'Inventory Manager',
      description: 'Specialized role for stock control, receiving, adjustments, and reordering',
      isSystem: true,
      permissions: [
        'inventory.view', 'inventory.create', 'inventory.update', 'inventory.adjust',
        'purchases.view', 'purchases.create', 'purchases.approve',
        'stock.transfer', 'reports.view', 'reports.export',
      ],
    },
    {
      name: 'Inventory Staff',
      description: 'Warehouse personnel for stock counting, transfers, and receiving goods',
      isSystem: true,
      permissions: [
        'inventory.view', 'purchases.view', 'stock.transfer',
      ],
    },
    {
      name: 'Cashier',
      description: 'Frontline retail staff for POS sales, customer lookup, and receipts',
      isSystem: true,
      permissions: [
        'inventory.view', 'sales.view', 'sales.create',
      ],
    },
    {
      name: 'Accountant',
      description: 'Financial auditor with access to sales, purchasing, valuation, and exports',
      isSystem: true,
      permissions: [
        'inventory.view', 'purchases.view', 'sales.view', 'reports.view', 'reports.export',
      ],
    },
    {
      name: 'Viewer',
      description: 'Read-only access to catalog and general stock overview',
      isSystem: true,
      permissions: [
        'inventory.view', 'reports.view',
      ],
    },
  ];

  const roleMap = {};
  for (const r of roleDefs) {
    let role = await prisma.role.findFirst({
      where: { orgId: org.id, name: r.name },
    });
    if (!role) {
      role = await prisma.role.create({
        data: {
          orgId: org.id,
          name: r.name,
          description: r.description,
          isSystem: r.isSystem,
        },
      });
    }
    roleMap[r.name] = role;

    // Link permissions
    for (const code of r.permissions) {
      const permId = permMap.get(code);
      if (permId) {
        await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: role.id, permissionId: permId } },
          update: {},
          create: { roleId: role.id, permissionId: permId },
        });
      }
    }
  }

  // 5. Seed Users
  console.log('Seeding Users...');
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('Password123!', salt);

  const users = [
    {
      email: 'admin@inventorypro.com',
      firstName: 'Alexander',
      lastName: 'Wright',
      phone: '+1 555-0100',
      role: 'Company Admin',
    },
    {
      email: 'manager@inventorypro.com',
      firstName: 'Elena',
      lastName: 'Rostova',
      phone: '+1 555-0102',
      role: 'Manager',
    },
    {
      email: 'inventory@inventorypro.com',
      firstName: 'Marcus',
      lastName: 'Chen',
      phone: '+1 555-0104',
      role: 'Inventory Staff',
    },
    {
      email: 'cashier@inventorypro.com',
      firstName: 'Sarah',
      lastName: 'Jenkins',
      phone: '+1 555-0106',
      role: 'Cashier',
    },
  ];

  for (const u of users) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {
        firstName: u.firstName,
        lastName: u.lastName,
        phone: u.phone,
        passwordHash,
        isActive: true,
      },
      create: {
        email: u.email,
        passwordHash,
        firstName: u.firstName,
        lastName: u.lastName,
        phone: u.phone,
        isActive: true,
      },
    });

    const role = roleMap[u.role];
    await prisma.organizationMember.upsert({
      where: { orgId_userId: { orgId: org.id, userId: user.id } },
      update: { roleId: role.id },
      create: { orgId: org.id, userId: user.id, roleId: role.id },
    });

    // Assign default locations
    await prisma.userLocation.upsert({
      where: { userId_locationId: { userId: user.id, locationId: locMain.id } },
      update: { isDefault: true },
      create: { userId: user.id, locationId: locMain.id, isDefault: true },
    });
    await prisma.userLocation.upsert({
      where: { userId_locationId: { userId: user.id, locationId: locStore.id } },
      update: { isDefault: false },
      create: { userId: user.id, locationId: locStore.id, isDefault: false },
    });
  }

  // 6. Seed Categories, Brands, and Units
  console.log('Seeding Categories, Brands, and Units...');
  const categoriesData = [
    { name: 'Enterprise Computing', code: 'CAT-COMP', description: 'Laptops, Desktops, Servers and Workstations' },
    { name: 'Peripherals & Accessories', code: 'CAT-PERIPH', description: 'Keyboards, Mice, Monitors, Cables' },
    { name: 'Networking & Telecom', code: 'CAT-NET', description: 'Routers, Switches, Access Points' },
    { name: 'Office Supplies', code: 'CAT-OFFICE', description: 'Paper, Toner, Packaging, Stationary' },
    { name: 'Security & Surveillance', code: 'CAT-SEC', description: 'Cameras, NVRs, Access Control' },
  ];

  const catMap = {};
  for (const c of categoriesData) {
    const cat = await prisma.category.upsert({
      where: { orgId_code: { orgId: org.id, code: c.code } },
      update: { name: c.name, description: c.description },
      create: { orgId: org.id, ...c },
    });
    catMap[c.code] = cat;
  }

  const brandsData = ['Apple', 'Dell Technologies', 'Logitech', 'Cisco', 'HP Enterprise', 'Samsung'];
  const brandMap = {};
  for (const b of brandsData) {
    const brand = await prisma.brand.upsert({
      where: { orgId_name: { orgId: org.id, name: b } },
      update: {},
      create: { orgId: org.id, name: b, description: `${b} brand products` },
    });
    brandMap[b] = brand;
  }

  const unitsData = [
    { name: 'Piece', code: 'PCS', symbol: 'pcs', isBaseUnit: true },
    { name: 'Box', code: 'BOX', symbol: 'box', isBaseUnit: false },
    { name: 'Carton', code: 'CTN', symbol: 'ctn', isBaseUnit: false },
    { name: 'Meter', code: 'MTR', symbol: 'm', isBaseUnit: true },
    { name: 'Kilogram', code: 'KG', symbol: 'kg', isBaseUnit: true },
  ];
  const unitMap = {};
  for (const u of unitsData) {
    const unit = await prisma.unit.upsert({
      where: { orgId_code: { orgId: org.id, code: u.code } },
      update: { name: u.name, symbol: u.symbol },
      create: { orgId: org.id, ...u },
    });
    unitMap[u.code] = unit;
  }

  // 7. Seed Suppliers & Customers
  console.log('Seeding Suppliers and Customers...');
  const sup1 = await prisma.supplier.create({
    data: {
      orgId: org.id,
      name: 'Silicon Valley Distribution Corp',
      contactPerson: 'David Miller',
      phone: '+1 408-555-8900',
      email: 'orders@svdistrib.com',
      address: '220 Innovation Blvd, San Jose, CA 95134',
      taxNumber: 'US-EIN-88291039',
      openingBalance: 0,
      currentBalance: 0,
      status: 'ACTIVE',
    },
  });

  const sup2 = await prisma.supplier.create({
    data: {
      orgId: org.id,
      name: 'Apex Global Logistics Imports',
      contactPerson: 'Samantha Lee',
      phone: '+1 212-555-7312',
      email: 'sales@apexlogistics.com',
      address: '88 River Street, Jersey City, NJ 07302',
      taxNumber: 'US-EIN-99381204',
      openingBalance: 0,
      currentBalance: 0,
      status: 'ACTIVE',
    },
  });

  const cust1 = await prisma.customer.create({
    data: {
      orgId: org.id,
      name: 'Quantum Tech Solutions',
      phone: '+1 212-555-4422',
      email: 'procurement@quantumtech.io',
      address: '350 5th Avenue, Suite 4400, New York, NY 10118',
      customerType: 'CORPORATE',
      openingBalance: 0,
      currentBalance: 0,
      status: 'ACTIVE',
    },
  });

  const cust2 = await prisma.customer.create({
    data: {
      orgId: org.id,
      name: 'Apex Retail Storefronts',
      phone: '+1 718-555-9011',
      email: 'buyer@apexretail.com',
      address: '124 Flatbush Ave, Brooklyn, NY 11217',
      customerType: 'WHOLESALE',
      openingBalance: 0,
      currentBalance: 0,
      status: 'ACTIVE',
    },
  });

  // 8. Seed Products with Stock Balances and Ledger Entries
  console.log('Seeding Catalog Products & Stock Ledger...');
  const productsData = [
    {
      name: 'MacBook Pro 16" M3 Max',
      sku: 'MBP16-M3MAX-36GB',
      barcode: '194253912044',
      description: 'Apple M3 Max 16-Core CPU, 40-Core GPU, 36GB RAM, 1TB SSD Space Black',
      categoryId: catMap['CAT-COMP'].id,
      brandId: brandMap['Apple'].id,
      unitId: unitMap['PCS'].id,
      purchaseCost: 2850.0,
      sellingPrice: 3499.0,
      taxRate: 8.5,
      minStock: 5,
      maxStock: 25,
      trackSerial: true,
      trackBatch: false,
      initialStocks: [
        { locationId: locMain.id, onHand: 18, reserved: 2 },
        { locationId: locStore.id, onHand: 4, reserved: 0 },
      ],
    },
    {
      name: 'Dell UltraSharp 32" 4K USB-C Hub Monitor (U3223QE)',
      sku: 'DELL-U3223QE-32',
      barcode: '884116417248',
      description: 'IPS Black technology, 2000:1 contrast ratio, 90W power delivery RJ45 USB-C hub',
      categoryId: catMap['CAT-PERIPH'].id,
      brandId: brandMap['Dell Technologies'].id,
      unitId: unitMap['PCS'].id,
      purchaseCost: 620.0,
      sellingPrice: 899.0,
      taxRate: 8.5,
      minStock: 8,
      maxStock: 40,
      trackSerial: true,
      trackBatch: false,
      initialStocks: [
        { locationId: locMain.id, onHand: 24, reserved: 4 },
        { locationId: locStore.id, onHand: 8, reserved: 1 },
      ],
    },
    {
      name: 'Logitech MX Master 3S Wireless Mouse',
      sku: 'LOGI-MXM3S-GRAPHITE',
      barcode: '097855173737',
      description: 'Quiet clicks, 8K DPI any-surface tracking, MagSpeed electromagnetic scroll wheel',
      categoryId: catMap['CAT-PERIPH'].id,
      brandId: brandMap['Logitech'].id,
      unitId: unitMap['PCS'].id,
      purchaseCost: 65.0,
      sellingPrice: 99.99,
      taxRate: 8.5,
      minStock: 15,
      maxStock: 100,
      trackSerial: false,
      trackBatch: true,
      initialStocks: [
        { locationId: locMain.id, onHand: 65, reserved: 5 },
        { locationId: locStore.id, onHand: 22, reserved: 0 },
      ],
    },
    {
      name: 'Cisco Catalyst 1000 24-Port Gigabit PoE Switch',
      sku: 'CISCO-C1000-24P',
      barcode: '889728264901',
      description: '24 x 10/100/1000 Gigabit Ethernet PoE+ ports with 195W power budget, 4x 1G SFP uplinks',
      categoryId: catMap['CAT-NET'].id,
      brandId: brandMap['Cisco'].id,
      unitId: unitMap['PCS'].id,
      purchaseCost: 780.0,
      sellingPrice: 1190.0,
      taxRate: 8.5,
      minStock: 4,
      maxStock: 20,
      trackSerial: true,
      trackBatch: false,
      initialStocks: [
        { locationId: locMain.id, onHand: 12, reserved: 0 },
        { locationId: locStore.id, onHand: 2, reserved: 0 },
      ],
    },
    {
      name: 'Heavy Duty Recycled Copy Paper Box (10 Reams)',
      sku: 'OFF-PAPER-10RM',
      barcode: '071810319401',
      description: 'Standard 8.5 x 11 inch 20lb multi-purpose office copy paper carton 5000 sheets',
      categoryId: catMap['CAT-OFFICE'].id,
      brandId: brandMap['HP Enterprise'].id,
      unitId: unitMap['BOX'].id,
      purchaseCost: 32.5,
      sellingPrice: 48.0,
      taxRate: 8.5,
      minStock: 20,
      maxStock: 150,
      trackSerial: false,
      trackBatch: true,
      initialStocks: [
        { locationId: locMain.id, onHand: 110, reserved: 10 },
        { locationId: locStore.id, onHand: 35, reserved: 0 },
      ],
    },
    {
      name: 'Samsung 49" Odyssey OLED G9 Curved Gaming Monitor',
      sku: 'SAMS-G9-OLED49',
      barcode: '887276767932',
      description: 'Dual QHD 240Hz 0.03ms Neo Quantum Processor Pro OLED display',
      categoryId: catMap['CAT-PERIPH'].id,
      brandId: brandMap['Samsung'].id,
      unitId: unitMap['PCS'].id,
      purchaseCost: 1150.0,
      sellingPrice: 1599.99,
      taxRate: 8.5,
      minStock: 3,
      maxStock: 12,
      trackSerial: true,
      trackBatch: false,
      initialStocks: [
        // Setting low stock to trigger low stock alerts!
        { locationId: locMain.id, onHand: 2, reserved: 0 },
        { locationId: locStore.id, onHand: 1, reserved: 0 },
      ],
    },
    {
      name: 'Cisco Meraki MR46 Wi-Fi 6 Indoor AP',
      sku: 'CISCO-MR46-HW',
      barcode: '816967022839',
      description: 'Cloud managed multi-gigabit Wi-Fi 6 wireless access point for enterprise density',
      categoryId: catMap['CAT-NET'].id,
      brandId: brandMap['Cisco'].id,
      unitId: unitMap['PCS'].id,
      purchaseCost: 540.0,
      sellingPrice: 799.0,
      taxRate: 8.5,
      minStock: 6,
      maxStock: 30,
      trackSerial: true,
      trackBatch: false,
      initialStocks: [
        // Out of stock product test case!
        { locationId: locMain.id, onHand: 0, reserved: 0 },
        { locationId: locStore.id, onHand: 0, reserved: 0 },
      ],
    },
  ];

  for (const p of productsData) {
    const { initialStocks, ...prodFields } = p;
    const product = await prisma.product.upsert({
      where: { orgId_sku: { orgId: org.id, sku: prodFields.sku } },
      update: prodFields,
      create: { orgId: org.id, ...prodFields },
    });

    // Primary Barcode
    if (prodFields.barcode) {
      await prisma.productBarcode.upsert({
        where: { productId_barcode: { productId: product.id, barcode: prodFields.barcode } },
        update: { isPrimary: true },
        create: { productId: product.id, barcode: prodFields.barcode, isPrimary: true },
      });
    }

    // Link Supplier
    await prisma.productSupplier.upsert({
      where: { productId_supplierId: { productId: product.id, supplierId: sup1.id } },
      update: { purchasePrice: prodFields.purchaseCost },
      create: {
        productId: product.id,
        supplierId: sup1.id,
        purchasePrice: prodFields.purchaseCost,
        leadTimeDays: 5,
      },
    });

    // Initialize Stock Balance & Stock Ledger Entries
    for (const stk of initialStocks) {
      await prisma.stockBalance.upsert({
        where: { orgId_productId_locationId: { orgId: org.id, productId: product.id, locationId: stk.locationId } },
        update: { onHand: stk.onHand, reserved: stk.reserved },
        create: {
          orgId: org.id,
          productId: product.id,
          locationId: stk.locationId,
          onHand: stk.onHand,
          reserved: stk.reserved,
          inTransit: 0,
        },
      });

      if (stk.onHand > 0) {
        await prisma.stockMovement.create({
          data: {
            orgId: org.id,
            productId: product.id,
            locationId: stk.locationId,
            type: 'OPENING_BALANCE',
            quantity: stk.onHand,
            unitCost: prodFields.purchaseCost,
            balanceBefore: 0,
            balanceAfter: stk.onHand,
            reason: 'Initial system inventory setup & ledger reconciliation',
            createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
          },
        });
      }
    }
  }

  // 9. Seed Sample Transactions: Purchase Order & Posted Receipt
  console.log('Seeding Sample Purchase Order & Posted Goods Receipt...');
  const mbp = await prisma.product.findFirst({ where: { sku: 'MBP16-M3MAX-36GB' } });
  const mouse = await prisma.product.findFirst({ where: { sku: 'LOGI-MXM3S-GRAPHITE' } });

  const po = await prisma.purchaseOrder.create({
    data: {
      orgId: org.id,
      poNumber: 'PO-2026-001',
      supplierId: sup1.id,
      locationId: locMain.id,
      status: 'RECEIVED',
      subtotal: 15550.0,
      taxAmount: 1321.75,
      totalAmount: 16871.75,
      paymentStatus: 'PAID',
      notes: 'Quarterly hardware restock for enterprise fulfillment',
      items: {
        create: [
          {
            productId: mbp.id,
            quantity: 5,
            receivedQuantity: 5,
            unitCost: 2850.0,
            totalAmount: 14250.0,
          },
          {
            productId: mouse.id,
            quantity: 20,
            receivedQuantity: 20,
            unitCost: 65.0,
            totalAmount: 1300.0,
          },
        ],
      },
    },
  });

  const receipt = await prisma.purchaseReceipt.create({
    data: {
      orgId: org.id,
      receiptNumber: 'GRN-2026-001',
      poId: po.id,
      supplierId: sup1.id,
      locationId: locMain.id,
      status: 'POSTED',
      notes: 'Inspected and verified at Receiving Dock B',
      items: {
        create: [
          { productId: mbp.id, quantityReceived: 5, unitCost: 2850.0, totalAmount: 14250.0 },
          { productId: mouse.id, quantityReceived: 20, unitCost: 65.0, totalAmount: 1300.0 },
        ],
      },
    },
  });

  // Record Stock Movements for Posted Goods Receipt
  await prisma.stockMovement.create({
    data: {
      orgId: org.id,
      productId: mbp.id,
      locationId: locMain.id,
      type: 'PURCHASE_RECEIPT',
      quantity: 5,
      unitCost: 2850.0,
      referenceType: 'PURCHASE_RECEIPT',
      referenceId: receipt.id,
      balanceBefore: 13,
      balanceAfter: 18,
      reason: 'PO-2026-001 Delivery received',
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    },
  });

  // 10. Seed Sample Sales Order & Completed Payment
  console.log('Seeding Sample Sales Order & Payment...');
  const salesOrder = await prisma.salesOrder.create({
    data: {
      orgId: org.id,
      orderNumber: 'SO-2026-1049',
      customerId: cust1.id,
      locationId: locStore.id,
      orderType: 'POS',
      status: 'COMPLETED',
      fulfilmentStatus: 'FULFILLED',
      paymentStatus: 'PAID',
      subtotal: 3598.99,
      discountAmount: 50.0,
      taxAmount: 301.66,
      totalAmount: 3850.65,
      paidAmount: 3850.65,
      notes: 'Customer in-store checkout',
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      items: {
        create: [
          {
            productId: mbp.id,
            quantity: 1,
            fulfilledQuantity: 1,
            unitPrice: 3499.0,
            unitCostSnapshot: 2850.0,
            taxRateSnapshot: 8.5,
            totalAmount: 3499.0,
          },
          {
            productId: mouse.id,
            quantity: 1,
            fulfilledQuantity: 1,
            unitPrice: 99.99,
            unitCostSnapshot: 65.0,
            taxRateSnapshot: 8.5,
            totalAmount: 99.99,
          },
        ],
      },
    },
  });

  // Customer Payment
  await prisma.customerPayment.create({
    data: {
      orgId: org.id,
      paymentNumber: 'PAY-2026-881',
      customerId: cust1.id,
      salesOrderId: salesOrder.id,
      amount: 3850.65,
      paymentMethod: 'CARD',
      referenceNumber: 'CHG_981249120',
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    },
  });

  // Movement for Sale
  await prisma.stockMovement.create({
    data: {
      orgId: org.id,
      productId: mbp.id,
      locationId: locStore.id,
      type: 'SALE',
      quantity: -1,
      unitCost: 2850.0,
      referenceType: 'SALES_ORDER',
      referenceId: salesOrder.id,
      balanceBefore: 5,
      balanceAfter: 4,
      reason: 'Fulfilled SO-2026-1049',
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    },
  });

  // 11. Seed Active Inventory Alerts
  console.log('Seeding Smart Inventory Alerts...');
  const g9Monitor = await prisma.product.findFirst({ where: { sku: 'SAMS-G9-OLED49' } });
  const merakiAP = await prisma.product.findFirst({ where: { sku: 'CISCO-MR46-HW' } });

  await prisma.inventoryAlert.upsert({
    where: {
      orgId_productId_alertType_status: {
        orgId: org.id,
        productId: g9Monitor.id,
        alertType: 'LOW_STOCK',
        status: 'NEW',
      },
    },
    update: {},
    create: {
      orgId: org.id,
      productId: g9Monitor.id,
      locationId: locMain.id,
      alertType: 'LOW_STOCK',
      severity: 'WARNING',
      status: 'NEW',
      message: 'Samsung 49" Odyssey OLED G9 is below reorder threshold (2 on hand, min 3)',
      details: JSON.stringify({ currentStock: 2, minStock: 3, suggestedReorder: 10 }),
    },
  });

  await prisma.inventoryAlert.upsert({
    where: {
      orgId_productId_alertType_status: {
        orgId: org.id,
        productId: merakiAP.id,
        alertType: 'OUT_OF_STOCK',
        status: 'NEW',
      },
    },
    update: {},
    create: {
      orgId: org.id,
      productId: merakiAP.id,
      locationId: locMain.id,
      alertType: 'OUT_OF_STOCK',
      severity: 'CRITICAL',
      status: 'NEW',
      message: 'Cisco Meraki MR46 Wi-Fi 6 Indoor AP is completely OUT OF STOCK (0 units available)',
      details: JSON.stringify({ currentStock: 0, minStock: 6, suggestedReorder: 20 }),
    },
  });

  // Seed Notifications
  await prisma.notification.create({
    data: {
      orgId: org.id,
      title: 'Critical Out of Stock Alert',
      message: 'Cisco Meraki MR46 Wi-Fi 6 Indoor AP has reached 0 units.',
      type: 'ALERT',
      isRead: false,
      link: '/inventory/alerts',
    },
  });

  console.log('--- Seed Completed Successfully! ---');
  console.log('Admin login: admin@inventorypro.com / Password123!');
  console.log('Default Org: Acme Global Logistics & Retail (acme-global)');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

