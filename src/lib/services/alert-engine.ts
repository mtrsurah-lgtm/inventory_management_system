import prisma from '../prisma';

export interface HotSellingProduct {
  productId: string;
  name: string;
  sku: string;
  categoryName: string;
  netUnitsSold: number;
  velocityPerDay: number;
  prevVelocityPerDay: number;
  velocityChangePercent: number;
  revenue: number;
}

export interface ReorderSuggestion {
  productId: string;
  name: string;
  sku: string;
  locationId: string;
  locationName: string;
  currentAvailable: number;
  minStock: number;
  leadTimeDays: number;
  avgDailyDemand: number;
  safetyStock: number;
  suggestedReorderPoint: number;
  suggestedOrderQuantity: number;
  estimatedCost: number;
  supplierName?: string;
  supplierId?: string;
}

export class AlertEngineService {
  /**
   * Scans and updates Low Stock and Out of Stock alerts across an organization.
   * Duplicate-safe: updates existing NEW alerts or creates new ones.
   */
  static async scanInventoryAlerts(orgId: string, locationId?: string) {
    const products = await prisma.product.findMany({
      where: { orgId, status: 'ACTIVE' },
      include: {
        stockBalances: locationId ? { where: { locationId } } : true,
      },
    });

    const results = {
      outOfStock: 0,
      lowStock: 0,
      overStock: 0,
    };

    for (const prod of products) {
      let totalOnHand = 0;
      let totalReserved = 0;

      for (const sb of prod.stockBalances) {
        totalOnHand += Number(sb.onHand);
        totalReserved += Number(sb.reserved);
      }

      const available = totalOnHand - totalReserved;
      const minStock = Number(prod.minStock);
      const maxStock = prod.maxStock ? Number(prod.maxStock) : null;

      if (available <= 0) {
        results.outOfStock++;
        await prisma.inventoryAlert.upsert({
          where: {
            orgId_productId_alertType_status: {
              orgId,
              productId: prod.id,
              alertType: 'OUT_OF_STOCK',
              status: 'NEW',
            },
          },
          update: {
            message: `${prod.name} (${prod.sku}) is completely OUT OF STOCK (0 units available).`,
            details: JSON.stringify({ onHand: totalOnHand, reserved: totalReserved, available }),
          },
          create: {
            orgId,
            productId: prod.id,
            alertType: 'OUT_OF_STOCK',
            severity: 'CRITICAL',
            status: 'NEW',
            message: `${prod.name} (${prod.sku}) is completely OUT OF STOCK (0 units available).`,
            details: JSON.stringify({ onHand: totalOnHand, reserved: totalReserved, available }),
          },
        });
      } else if (available <= minStock) {
        results.lowStock++;
        await prisma.inventoryAlert.upsert({
          where: {
            orgId_productId_alertType_status: {
              orgId,
              productId: prod.id,
              alertType: 'LOW_STOCK',
              status: 'NEW',
            },
          },
          update: {
            message: `${prod.name} (${prod.sku}) is LOW on stock (${available} available, reorder threshold is ${minStock}).`,
            details: JSON.stringify({ onHand: totalOnHand, reserved: totalReserved, available, minStock }),
          },
          create: {
            orgId,
            productId: prod.id,
            alertType: 'LOW_STOCK',
            severity: 'WARNING',
            status: 'NEW',
            message: `${prod.name} (${prod.sku}) is LOW on stock (${available} available, reorder threshold is ${minStock}).`,
            details: JSON.stringify({ onHand: totalOnHand, reserved: totalReserved, available, minStock }),
          },
        });
      } else if (maxStock && available > maxStock) {
        results.overStock++;
        await prisma.inventoryAlert.upsert({
          where: {
            orgId_productId_alertType_status: {
              orgId,
              productId: prod.id,
              alertType: 'OVERSTOCK',
              status: 'NEW',
            },
          },
          update: {
            message: `${prod.name} (${prod.sku}) is OVERSTOCKED (${available} available, maximum capacity is ${maxStock}).`,
            details: JSON.stringify({ onHand: totalOnHand, available, maxStock }),
          },
          create: {
            orgId,
            productId: prod.id,
            alertType: 'OVERSTOCK',
            severity: 'INFO',
            status: 'NEW',
            message: `${prod.name} (${prod.sku}) is OVERSTOCKED (${available} available, maximum capacity is ${maxStock}).`,
            details: JSON.stringify({ onHand: totalOnHand, available, maxStock }),
          },
        });
      }
    }

    return results;
  }

  /**
   * Calculates Hot-Selling Products based on net units sold and sales velocity.
   * Compares the current window (e.g. last 14 days) against the previous equivalent period.
   */
  static async getHotSellingProducts(
    orgId: string,
    days: number = 14,
    locationId?: string
  ): Promise<HotSellingProduct[]> {
    const now = new Date();
    const currentStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const previousStart = new Date(now.getTime() - 2 * days * 24 * 60 * 60 * 1000);

    // 1. Fetch sales order items from completed orders in the current period
    const currentItems = await prisma.salesOrderItem.findMany({
      where: {
        salesOrder: {
          orgId,
          status: 'COMPLETED',
          createdAt: { gte: currentStart },
          locationId: locationId || undefined,
        },
      },
      include: {
        product: {
          include: { category: true },
        },
      },
    });

    // 2. Fetch sales order items from the previous period for velocity comparison
    const previousItems = await prisma.salesOrderItem.findMany({
      where: {
        salesOrder: {
          orgId,
          status: 'COMPLETED',
          createdAt: { gte: previousStart, lt: currentStart },
          locationId: locationId || undefined,
        },
      },
    });

    // Map aggregate sales per product
    const currentMap = new Map<
      string,
      { product: any; units: number; revenue: number }
    >();

    for (const item of currentItems) {
      const prev = currentMap.get(item.productId) || {
        product: item.product,
        units: 0,
        revenue: 0,
      };
      prev.units += Number(item.quantity);
      prev.revenue += Number(item.totalAmount);
      currentMap.set(item.productId, prev);
    }

    const previousMap = new Map<string, number>();
    for (const item of previousItems) {
      const prevUnits = previousMap.get(item.productId) || 0;
      previousMap.set(item.productId, prevUnits + Number(item.quantity));
    }

    const list: HotSellingProduct[] = [];
    currentMap.forEach((val, productId) => {
      const velocityPerDay = Number((val.units / days).toFixed(2));
      const prevUnits = previousMap.get(productId) || 0;
      const prevVelocityPerDay = Number((prevUnits / days).toFixed(2));

      let velocityChangePercent = 0;
      if (prevVelocityPerDay > 0) {
        velocityChangePercent = Number(
          (((velocityPerDay - prevVelocityPerDay) / prevVelocityPerDay) * 100).toFixed(1)
        );
      } else if (velocityPerDay > 0) {
        velocityChangePercent = 100.0;
      }

      list.push({
        productId,
        name: val.product.name,
        sku: val.product.sku,
        categoryName: val.product.category?.name || 'Uncategorized',
        netUnitsSold: val.units,
        velocityPerDay,
        prevVelocityPerDay,
        velocityChangePercent,
        revenue: Number(val.revenue.toFixed(2)),
      });
    });

    // Sort descending by sales velocity
    list.sort((a, b) => b.velocityPerDay - a.velocityPerDay);

    return list;
  }

  /**
   * Identifies Slow-Moving Products with low or zero sales over a given time window.
   */
  static async getSlowMovingProducts(
    orgId: string,
    days: number = 30,
    locationId?: string
  ) {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const products = await prisma.product.findMany({
      where: { orgId, status: 'ACTIVE' },
      include: {
        category: true,
        stockBalances: locationId ? { where: { locationId } } : true,
        salesOrderItems: {
          where: {
            salesOrder: {
              status: 'COMPLETED',
              createdAt: { gte: startDate },
              locationId: locationId || undefined,
            },
          },
        },
      },
    });

    const slowMoving = [];
    for (const prod of products) {
      let onHand = 0;
      for (const sb of prod.stockBalances) {
        onHand += Number(sb.onHand);
      }

      let unitsSold = 0;
      for (const item of prod.salesOrderItems) {
        unitsSold += Number(item.quantity);
      }

      if (onHand > 0 && unitsSold <= 2) {
        slowMoving.push({
          productId: prod.id,
          name: prod.name,
          sku: prod.sku,
          categoryName: prod.category?.name || 'Uncategorized',
          onHand,
          unitsSoldInPeriod: unitsSold,
          purchaseCost: Number(prod.purchaseCost),
          inventoryValue: Number((onHand * Number(prod.purchaseCost)).toFixed(2)),
          daysWithoutSale: days,
        });
      }
    }

    slowMoving.sort((a, b) => b.inventoryValue - a.inventoryValue);
    return slowMoving;
  }

  /**
   * Generates mathematical, explainable Reorder Suggestions.
   * Formula:
   * Average Daily Demand (ADD) = Net Units Sold (past 30 days) / 30
   * Lead Time (LT) = Supplier Lead Time in days (default 7)
   * Safety Stock (SS) = Math.ceil(ADD * 3) (or configured buffer)
   * Reorder Point (ROP) = (ADD * LT) + SS
   * Suggested Order Quantity = Math.max(ROP - Available, MinReorderPack)
   */
  static async calculateReorderSuggestions(
    orgId: string,
    locationId?: string
  ): Promise<ReorderSuggestion[]> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const products = await prisma.product.findMany({
      where: { orgId, status: 'ACTIVE' },
      include: {
        stockBalances: {
          where: locationId ? { locationId } : undefined,
          include: { location: true },
        },
        suppliers: {
          include: { supplier: true },
          take: 1,
        },
        salesOrderItems: {
          where: {
            salesOrder: {
              status: 'COMPLETED',
              createdAt: { gte: thirtyDaysAgo },
              locationId: locationId || undefined,
            },
          },
        },
      },
    });

    const suggestions: ReorderSuggestion[] = [];

    for (const prod of products) {
      // Calculate 30-day demand
      let totalUnitsSold = 0;
      for (const item of prod.salesOrderItems) {
        totalUnitsSold += Number(item.quantity);
      }
      const avgDailyDemand = Math.max(0.1, Number((totalUnitsSold / 30).toFixed(2)));

      const supplierLink = prod.suppliers[0];
      const leadTimeDays = supplierLink?.leadTimeDays || 7;
      const minStock = Number(prod.minStock);

      // Safety stock formula
      const safetyStock = Math.max(minStock, Math.ceil(avgDailyDemand * 3));
      const suggestedReorderPoint = Math.ceil(avgDailyDemand * leadTimeDays + safetyStock);

      for (const balance of prod.stockBalances) {
        const onHand = Number(balance.onHand);
        const reserved = Number(balance.reserved);
        const available = onHand - reserved;

        // If available stock is at or below the reorder point
        if (available <= suggestedReorderPoint) {
          const suggestedOrderQuantity = Math.max(
            Math.ceil(suggestedReorderPoint - available + avgDailyDemand * 14),
            5
          );

          suggestions.push({
            productId: prod.id,
            name: prod.name,
            sku: prod.sku,
            locationId: balance.locationId,
            locationName: balance.location.name,
            currentAvailable: available,
            minStock,
            leadTimeDays,
            avgDailyDemand,
            safetyStock,
            suggestedReorderPoint,
            suggestedOrderQuantity,
            estimatedCost: Number((suggestedOrderQuantity * Number(prod.purchaseCost)).toFixed(2)),
            supplierName: supplierLink?.supplier?.name,
            supplierId: supplierLink?.supplierId,
          });
        }
      }
    }

    // Sort by urgent shortfall first
    suggestions.sort((a, b) => a.currentAvailable - b.currentAvailable);
    return suggestions;
  }
}

