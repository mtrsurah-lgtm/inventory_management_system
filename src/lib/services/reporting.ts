import prisma from '../prisma';

export interface DateRangeFilter {
  startDate: Date;
  endDate: Date;
  previousStartDate: Date;
  previousEndDate: Date;
}

export interface DashboardKPIs {
  totalOrders: { value: number; changePercent: number };
  grossSales: { value: number; changePercent: number };
  netSales: { value: number; changePercent: number };
  grossProfit: { value: number; changePercent: number };
  inventoryValuation: { value: number; changePercent: number };
  lowStockAlerts: { value: number; changePercent: number };
  outOfStockProducts: { value: number; changePercent: number };
  totalUnitsSold: { value: number; changePercent: number };
}

export class ReportingService {
  /**
   * Helper to compute standard date comparison windows.
   */
  static parseDateRange(period: string = 'this_month', customStart?: string, customEnd?: string): DateRangeFilter {
    const now = new Date();
    let startDate: Date;
    let endDate: Date = new Date();
    let previousStartDate: Date;
    let previousEndDate: Date;

    if (customStart && customEnd) {
      startDate = new Date(customStart);
      endDate = new Date(customEnd);
      const diffMs = endDate.getTime() - startDate.getTime();
      previousEndDate = new Date(startDate.getTime() - 1);
      previousStartDate = new Date(previousEndDate.getTime() - diffMs);
      return { startDate, endDate, previousStartDate, previousEndDate };
    }

    switch (period) {
      case 'today': {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        previousStartDate = new Date(startDate.getTime() - 24 * 60 * 60 * 1000);
        previousEndDate = new Date(startDate.getTime() - 1);
        break;
      }
      case 'yesterday': {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0);
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59);
        previousStartDate = new Date(startDate.getTime() - 24 * 60 * 60 * 1000);
        previousEndDate = new Date(startDate.getTime() - 1);
        break;
      }
      case 'this_week': {
        const day = now.getDay() || 7;
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 1, 0, 0, 0);
        previousStartDate = new Date(startDate.getTime() - 7 * 24 * 60 * 60 * 1000);
        previousEndDate = new Date(startDate.getTime() - 1);
        break;
      }
      case 'previous_week': {
        const day = now.getDay() || 7;
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day, 23, 59, 59);
        startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000 + 1000);
        previousEndDate = new Date(startDate.getTime() - 1);
        previousStartDate = new Date(previousEndDate.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      }
      case 'this_month':
      default: {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
        previousStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0);
        previousEndDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
        break;
      }
      case 'previous_month': {
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
        previousStartDate = new Date(now.getFullYear(), now.getMonth() - 2, 1, 0, 0, 0);
        previousEndDate = new Date(now.getFullYear(), now.getMonth() - 1, 0, 23, 59, 59);
        break;
      }
      case 'this_year': {
        startDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
        previousStartDate = new Date(now.getFullYear() - 1, 0, 1, 0, 0, 0);
        previousEndDate = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59);
        break;
      }
    }

    return { startDate, endDate, previousStartDate, previousEndDate };
  }

  /**
   * Calculates high-precision Dashboard KPIs with previous-period comparison percentages.
   */
  static async getDashboardKPIs(orgId: string, locationId?: string, period: string = 'this_month'): Promise<DashboardKPIs> {
    const range = this.parseDateRange(period);

    // Current period completed sales
    const currentOrders = await prisma.salesOrder.findMany({
      where: {
        orgId,
        locationId: locationId || undefined,
        status: 'COMPLETED',
        createdAt: { gte: range.startDate, lte: range.endDate },
      },
      include: {
        items: true,
      },
    });

    // Previous period completed sales
    const prevOrders = await prisma.salesOrder.findMany({
      where: {
        orgId,
        locationId: locationId || undefined,
        status: 'COMPLETED',
        createdAt: { gte: range.previousStartDate, lte: range.previousEndDate },
      },
      include: {
        items: true,
      },
    });

    // Compute metrics
    const calcMetrics = (orders: typeof currentOrders) => {
      let grossSales = 0;
      let discounts = 0;
      let cogs = 0;
      let units = 0;

      for (const order of orders) {
        grossSales += Number(order.subtotal);
        discounts += Number(order.discountAmount);
        for (const item of order.items) {
          units += Number(item.quantity);
          const costSnapshot = Number(item.unitCostSnapshot);
          cogs += costSnapshot * Number(item.quantity);
        }
      }

      const netSales = grossSales - discounts;
      const grossProfit = netSales - cogs;

      return {
        orderCount: orders.length,
        grossSales: Number(grossSales.toFixed(2)),
        netSales: Number(netSales.toFixed(2)),
        cogs: Number(cogs.toFixed(2)),
        grossProfit: Number(grossProfit.toFixed(2)),
        units,
      };
    };

    const current = calcMetrics(currentOrders);
    const prev = calcMetrics(prevOrders);

    const calcPct = (curr: number, prior: number): number => {
      if (prior === 0) return curr > 0 ? 100 : 0;
      return Number((((curr - prior) / prior) * 100).toFixed(1));
    };

    // Calculate current Inventory Valuation
    const stockBalances = await prisma.stockBalance.findMany({
      where: {
        orgId,
        locationId: locationId || undefined,
      },
      include: {
        product: { select: { purchaseCost: true, minStock: true } },
      },
    });

    let totalValuation = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    for (const sb of stockBalances) {
      const onHand = Number(sb.onHand);
      const reserved = Number(sb.reserved);
      const available = onHand - reserved;
      const cost = Number(sb.product.purchaseCost);
      const minStock = Number(sb.product.minStock);

      totalValuation += onHand * cost;
      if (available <= 0) {
        outOfStockCount++;
      } else if (available <= minStock) {
        lowStockCount++;
      }
    }

    return {
      totalOrders: { value: current.orderCount, changePercent: calcPct(current.orderCount, prev.orderCount) },
      grossSales: { value: current.grossSales, changePercent: calcPct(current.grossSales, prev.grossSales) },
      netSales: { value: current.netSales, changePercent: calcPct(current.netSales, prev.netSales) },
      grossProfit: { value: current.grossProfit, changePercent: calcPct(current.grossProfit, prev.grossProfit) },
      inventoryValuation: { value: Number(totalValuation.toFixed(2)), changePercent: 0 },
      lowStockAlerts: { value: lowStockCount, changePercent: 0 },
      outOfStockProducts: { value: outOfStockCount, changePercent: 0 },
      totalUnitsSold: { value: current.units, changePercent: calcPct(current.units, prev.units) },
    };
  }

  /**
   * Generates Revenue and Sales trends for chart visualization.
   */
  static async getRevenueTrends(orgId: string, locationId?: string, period: string = 'this_month') {
    const range = this.parseDateRange(period);

    const orders = await prisma.salesOrder.findMany({
      where: {
        orgId,
        locationId: locationId || undefined,
        status: 'COMPLETED',
        createdAt: { gte: range.startDate, lte: range.endDate },
      },
      include: {
        items: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Group by Date string
    const trendMap = new Map<string, { date: string; sales: number; netSales: number; grossProfit: number; orders: number }>();

    for (const ord of orders) {
      const dateKey = ord.createdAt.toISOString().slice(0, 10);
      const existing = trendMap.get(dateKey) || {
        date: dateKey,
        sales: 0,
        netSales: 0,
        grossProfit: 0,
        orders: 0,
      };

      const gross = Number(ord.subtotal);
      const disc = Number(ord.discountAmount);
      const net = gross - disc;

      let cogs = 0;
      for (const it of ord.items) {
        cogs += Number(it.unitCostSnapshot) * Number(it.quantity);
      }

      existing.sales += gross;
      existing.netSales += net;
      existing.grossProfit += net - cogs;
      existing.orders += 1;

      trendMap.set(dateKey, existing);
    }

    const trends = Array.from(trendMap.values()).map((t) => ({
      ...t,
      sales: Number(t.sales.toFixed(2)),
      netSales: Number(t.netSales.toFixed(2)),
      grossProfit: Number(t.grossProfit.toFixed(2)),
    }));

    // If empty, supply placeholder with range start
    if (trends.length === 0) {
      trends.push({
        date: range.startDate.toISOString().slice(0, 10),
        sales: 0,
        netSales: 0,
        grossProfit: 0,
        orders: 0,
      });
    }

    return trends;
  }

  /**
   * Inventory composition breakdown by Category and Brand.
   */
  static async getInventoryComposition(orgId: string, locationId?: string) {
    const balances = await prisma.stockBalance.findMany({
      where: {
        orgId,
        locationId: locationId || undefined,
      },
      include: {
        product: {
          include: {
            category: true,
            brand: true,
          },
        },
      },
    });

    const categoryMap = new Map<string, { name: string; quantity: number; valuation: number }>();
    const brandMap = new Map<string, { name: string; quantity: number; valuation: number }>();

    for (const sb of balances) {
      const qty = Number(sb.onHand);
      const cost = Number(sb.product.purchaseCost);
      const val = qty * cost;

      const catName = sb.product.category?.name || 'Uncategorized';
      const cat = categoryMap.get(catName) || { name: catName, quantity: 0, valuation: 0 };
      cat.quantity += qty;
      cat.valuation += val;
      categoryMap.set(catName, cat);

      const brandName = sb.product.brand?.name || 'Generic';
      const br = brandMap.get(brandName) || { name: brandName, quantity: 0, valuation: 0 };
      br.quantity += qty;
      br.valuation += val;
      brandMap.set(brandName, br);
    }

    return {
      byCategory: Array.from(categoryMap.values()).map((c) => ({
        ...c,
        valuation: Number(c.valuation.toFixed(2)),
      })),
      byBrand: Array.from(brandMap.values()).map((b) => ({
        ...b,
        valuation: Number(b.valuation.toFixed(2)),
      })),
    };
  }

  /**
   * Stock Health categorized by Location (Healthy, Low Stock, Out of Stock).
   */
  static async getStockHealth(orgId: string) {
    const locations = await prisma.location.findMany({
      where: { orgId, isActive: true },
      include: {
        stockBalances: {
          include: {
            product: { select: { minStock: true } },
          },
        },
      },
    });

    return locations.map((loc) => {
      let healthy = 0;
      let lowStock = 0;
      let outOfStock = 0;

      for (const sb of loc.stockBalances) {
        const onHand = Number(sb.onHand);
        const reserved = Number(sb.reserved);
        const available = onHand - reserved;
        const minStock = Number(sb.product.minStock);

        if (available <= 0) {
          outOfStock++;
        } else if (available <= minStock) {
          lowStock++;
        } else {
          healthy++;
        }
      }

      return {
        locationId: loc.id,
        locationName: loc.name,
        healthy,
        lowStock,
        outOfStock,
        totalProducts: loc.stockBalances.length,
      };
    });
  }

  /**
   * Detailed Profitability Report with Weighted Average Costing and COGS.
   */
  static async getProfitabilityReport(
    orgId: string,
    params: {
      startDate?: string;
      endDate?: string;
      categoryId?: string;
      locationId?: string;
    }
  ) {
    const start = params.startDate ? new Date(params.startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = params.endDate ? new Date(params.endDate) : new Date();

    const orderItems = await prisma.salesOrderItem.findMany({
      where: {
        salesOrder: {
          orgId,
          status: 'COMPLETED',
          createdAt: { gte: start, lte: end },
          locationId: params.locationId || undefined,
        },
        product: {
          categoryId: params.categoryId || undefined,
        },
      },
      include: {
        salesOrder: { select: { orderNumber: true, createdAt: true, customer: true } },
        product: { include: { category: true, brand: true } },
      },
    });

    let totalGrossSales = 0;
    let totalDiscount = 0;
    let totalCogs = 0;

    const itemsSummary = new Map<string, {
      productId: string;
      productName: string;
      sku: string;
      category: string;
      unitsSold: number;
      grossRevenue: number;
      discounts: number;
      netRevenue: number;
      cogs: number;
      grossProfit: number;
      marginPercent: number;
    }>();

    for (const item of orderItems) {
      const qty = Number(item.quantity);
      const gross = Number(item.unitPrice) * qty;
      const disc = Number(item.discountSnapshot);
      const cost = Number(item.unitCostSnapshot) * qty;
      const net = gross - disc;
      const profit = net - cost;

      totalGrossSales += gross;
      totalDiscount += disc;
      totalCogs += cost;

      const existing = itemsSummary.get(item.productId) || {
        productId: item.productId,
        productName: item.product.name,
        sku: item.product.sku,
        category: item.product.category?.name || 'Uncategorized',
        unitsSold: 0,
        grossRevenue: 0,
        discounts: 0,
        netRevenue: 0,
        cogs: 0,
        grossProfit: 0,
        marginPercent: 0,
      };

      existing.unitsSold += qty;
      existing.grossRevenue += gross;
      existing.discounts += disc;
      existing.netRevenue += net;
      existing.cogs += cost;
      existing.grossProfit += profit;

      itemsSummary.set(item.productId, existing);
    }

    const itemsList = Array.from(itemsSummary.values()).map((i) => {
      const margin = i.netRevenue > 0 ? (i.grossProfit / i.netRevenue) * 100 : 0;
      return {
        ...i,
        grossRevenue: Number(i.grossRevenue.toFixed(2)),
        discounts: Number(i.discounts.toFixed(2)),
        netRevenue: Number(i.netRevenue.toFixed(2)),
        cogs: Number(i.cogs.toFixed(2)),
        grossProfit: Number(i.grossProfit.toFixed(2)),
        marginPercent: Number(margin.toFixed(1)),
      };
    });

    const totalNetSales = totalGrossSales - totalDiscount;
    const totalProfit = totalNetSales - totalCogs;
    const overallMargin = totalNetSales > 0 ? (totalProfit / totalNetSales) * 100 : 0;

    return {
      summary: {
        grossSales: Number(totalGrossSales.toFixed(2)),
        discounts: Number(totalDiscount.toFixed(2)),
        netSales: Number(totalNetSales.toFixed(2)),
        costOfGoodsSold: Number(totalCogs.toFixed(2)),
        grossProfit: Number(totalProfit.toFixed(2)),
        profitMargin: Number(overallMargin.toFixed(1)),
      },
      items: itemsList.sort((a, b) => b.grossProfit - a.grossProfit),
    };
  }
}

