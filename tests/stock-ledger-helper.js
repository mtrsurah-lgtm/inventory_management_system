// JavaScript wrapper for running tests directly with Node.js test runner
const { PrismaClient } = require('@prisma/client');
const Papa = require('papaparse');

class StockLedgerService {
  static async recordMovement(prismaClient, params) {
    const {
      orgId,
      productId,
      variantId = null,
      locationId,
      type,
      quantity,
      unitCost = 0,
      referenceType,
      referenceId,
      reason,
      userId,
      batchNumber,
      serialNumber,
    } = params;

    if (quantity === 0) {
      throw new Error('Stock movement quantity cannot be zero.');
    }

    let allowNegative = params.allowNegative;
    if (allowNegative === undefined) {
      const org = await prismaClient.organization.findUnique({
        where: { id: orgId },
        select: { negativeStockEnabled: true },
      });
      allowNegative = org?.negativeStockEnabled ?? false;
    }

    let balance = await prismaClient.stockBalance.findFirst({
      where: { orgId, productId, locationId },
    });

    if (!balance) {
      balance = await prismaClient.stockBalance.create({
        data: {
          orgId,
          productId,
          variantId,
          locationId,
          onHand: 0,
          reserved: 0,
          inTransit: 0,
        },
      });
    }

    const currentOnHand = Number(balance.onHand);
    const currentReserved = Number(balance.reserved);
    const newOnHand = currentOnHand + quantity;

    if (!allowNegative && newOnHand < 0) {
      throw new Error(
        `Insufficient inventory. Product ${productId} at location ${locationId} currently has ${currentOnHand} on hand, cannot deduct ${Math.abs(
          quantity
        )} units.`
      );
    }

    await prismaClient.stockBalance.update({
      where: { id: balance.id },
      data: {
        onHand: newOnHand,
        updatedAt: new Date(),
      },
    });

    const movement = await prismaClient.stockMovement.create({
      data: {
        orgId,
        productId,
        variantId,
        locationId,
        type,
        quantity,
        unitCost,
        referenceType,
        referenceId,
        batchNumber,
        serialNumber,
        balanceBefore: currentOnHand,
        balanceAfter: newOnHand,
        reason,
        userId,
      },
    });

    return movement;
  }

  static async reserveStock(prismaClient, params) {
    const { orgId, productId, variantId = null, locationId, quantity, referenceType, referenceId, expiresAt } = params;

    let balance = await prismaClient.stockBalance.findFirst({
      where: { orgId, productId, locationId },
    });

    if (!balance) {
      balance = await prismaClient.stockBalance.create({
        data: {
          orgId,
          productId,
          variantId,
          locationId,
          onHand: 0,
          reserved: 0,
          inTransit: 0,
        },
      });
    }

    const onHand = Number(balance.onHand);
    const reserved = Number(balance.reserved);
    const available = onHand - reserved;

    const org = await prismaClient.organization.findUnique({
      where: { id: orgId },
      select: { negativeStockEnabled: true },
    });

    if (!org?.negativeStockEnabled && available < quantity) {
      throw new Error(
        `Insufficient available stock for reservation. Available: ${available}, Requested: ${quantity}`
      );
    }

    await prismaClient.stockBalance.update({
      where: { id: balance.id },
      data: {
        reserved: reserved + quantity,
        updatedAt: new Date(),
      },
    });

    return prismaClient.stockReservation.create({
      data: {
        orgId,
        productId,
        variantId,
        locationId,
        quantity,
        referenceType,
        referenceId,
        status: 'ACTIVE',
        expiresAt,
      },
    });
  }

  static async releaseReservation(prismaClient, orgId, reservationId) {
    const reservation = await prismaClient.stockReservation.findUnique({
      where: { id: reservationId },
    });

    if (!reservation || reservation.orgId !== orgId || reservation.status !== 'ACTIVE') {
      return null;
    }

    const balance = await prismaClient.stockBalance.findFirst({
      where: {
        orgId,
        productId: reservation.productId,
        locationId: reservation.locationId,
      },
    });

    if (balance) {
      const newReserved = Math.max(0, Number(balance.reserved) - Number(reservation.quantity));
      await prismaClient.stockBalance.update({
        where: { id: balance.id },
        data: { reserved: newReserved, updatedAt: new Date() },
      });
    }

    return prismaClient.stockReservation.update({
      where: { id: reservationId },
      data: { status: 'RELEASED', updatedAt: new Date() },
    });
  }

  static async dispatchTransfer(prismaClient, orgId, transferId, userId) {
    const transfer = await prismaClient.stockTransfer.findUnique({
      where: { id: transferId },
      include: { items: true },
    });

    for (const item of transfer.items) {
      const qty = Number(item.quantityDispatched);

      await this.recordMovement(prismaClient, {
        orgId,
        productId: item.productId,
        variantId: item.variantId,
        locationId: transfer.sourceLocationId,
        type: 'TRANSFER_OUT',
        quantity: -qty,
        referenceType: 'TRANSFER',
        referenceId: transfer.id,
        reason: `Dispatched in transfer ${transfer.transferNumber}`,
        userId,
      });

      const sourceBalance = await prismaClient.stockBalance.findFirst({
        where: { orgId, productId: item.productId, locationId: transfer.sourceLocationId },
      });

      if (sourceBalance) {
        await prismaClient.stockBalance.update({
          where: { id: sourceBalance.id },
          data: {
            inTransit: Number(sourceBalance.inTransit) + qty,
            updatedAt: new Date(),
          },
        });
      }
    }

    return prismaClient.stockTransfer.update({
      where: { id: transferId },
      data: {
        status: 'DISPATCHED',
        dispatchDate: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  static async receiveTransfer(prismaClient, params) {
    const { orgId, transferId, receivedItems, userId } = params;

    const transfer = await prismaClient.stockTransfer.findUnique({
      where: { id: transferId },
      include: { items: true },
    });

    for (const recItem of receivedItems) {
      const originalItem = transfer.items.find((i) => i.id === recItem.itemId);
      if (!originalItem) continue;

      const qtyDispatched = Number(originalItem.quantityDispatched);
      const qtyReceived = Number(recItem.quantityReceived);

      await prismaClient.stockTransferItem.update({
        where: { id: originalItem.id },
        data: {
          quantityReceived: qtyReceived,
          quantityDamaged: Number(recItem.quantityDamaged || 0),
        },
      });

      const sourceBalance = await prismaClient.stockBalance.findFirst({
        where: { orgId, productId: originalItem.productId, locationId: transfer.sourceLocationId },
      });
      if (sourceBalance) {
        await prismaClient.stockBalance.update({
          where: { id: sourceBalance.id },
          data: {
            inTransit: Math.max(0, Number(sourceBalance.inTransit) - qtyDispatched),
            updatedAt: new Date(),
          },
        });
      }

      if (qtyReceived > 0) {
        await this.recordMovement(prismaClient, {
          orgId,
          productId: originalItem.productId,
          variantId: originalItem.variantId,
          locationId: transfer.destinationLocationId,
          type: 'TRANSFER_IN',
          quantity: qtyReceived,
          referenceType: 'TRANSFER',
          referenceId: transfer.id,
          reason: `Received from transfer ${transfer.transferNumber}`,
          userId,
        });
      }
    }

    return prismaClient.stockTransfer.update({
      where: { id: transferId },
      data: {
        status: 'COMPLETED',
        receiveDate: new Date(),
        updatedAt: new Date(),
      },
    });
  }
}

class CsvEngineService {
  static async validateCsv(orgId, csvContent) {
    const parsed = Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: 'greedy',
    });

    const rows = parsed.data;
    const errors = [];
    const validRows = [];
    const fileSkus = new Set();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const sku = (row.SKU || '').trim();

      if (!sku) {
        errors.push({ row: i + 2, field: 'SKU', message: 'SKU is required' });
        continue;
      }
      if (fileSkus.has(sku.toUpperCase())) {
        errors.push({ row: i + 2, field: 'SKU', message: `Duplicate SKU ${sku}` });
        continue;
      }
      fileSkus.add(sku.toUpperCase());

      validRows.push(row);
    }

    return {
      validCount: validRows.length,
      invalidCount: errors.length,
      errors,
    };
  }
}

module.exports = {
  StockLedgerService,
  CsvEngineService,
};

