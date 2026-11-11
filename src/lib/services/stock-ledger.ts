import { Prisma, PrismaClient } from '@prisma/client';
import prisma from '../prisma';

export type MovementType =
  | 'OPENING_BALANCE'
  | 'PURCHASE_RECEIPT'
  | 'SALE'
  | 'CUSTOMER_RETURN'
  | 'SUPPLIER_RETURN'
  | 'TRANSFER_OUT'
  | 'TRANSFER_IN'
  | 'ADJUSTMENT_INCREASE'
  | 'ADJUSTMENT_DECREASE'
  | 'DAMAGE_WRITE_OFF';

export interface RecordMovementParams {
  orgId: string;
  productId: string;
  variantId?: string | null;
  locationId: string;
  type: MovementType;
  quantity: number; // positive for addition, negative for deduction
  unitCost?: number;
  referenceType?: string;
  referenceId?: string;
  reason?: string;
  userId?: string;
  batchNumber?: string;
  serialNumber?: string;
  allowNegative?: boolean;
}

export interface StockReservationParams {
  orgId: string;
  productId: string;
  variantId?: string | null;
  locationId: string;
  quantity: number;
  referenceType: string;
  referenceId: string;
  expiresAt?: Date;
}

export class StockLedgerService {
  /**
   * Records a stock movement within an interactive transaction or standard client.
   * Atomically updates the StockBalance and creates a permanent StockMovement ledger entry.
   */
  static async recordMovement(
    tx: Prisma.TransactionClient | PrismaClient,
    params: RecordMovementParams
  ) {
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

    // 1. Fetch Organization settings for negative stock policy if not specified
    let allowNegative = params.allowNegative;
    if (allowNegative === undefined) {
      const org = await tx.organization.findUnique({
        where: { id: orgId },
        select: { negativeStockEnabled: true },
      });
      allowNegative = org?.negativeStockEnabled ?? false;
    }

    // 2. Fetch or initialize StockBalance for (orgId, productId, locationId)
    let balance = await tx.stockBalance.findFirst({
      where: {
        orgId,
        productId,
        locationId,
      },
    });

    if (!balance) {
      balance = await tx.stockBalance.create({
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

    // Check overselling / negative inventory protection
    if (!allowNegative && newOnHand < 0) {
      throw new Error(
        `Insufficient inventory. Product ${productId} at location ${locationId} currently has ${currentOnHand} on hand, cannot deduct ${Math.abs(
          quantity
        )} units.`
      );
    }

    // 3. Update the StockBalance
    await tx.stockBalance.update({
      where: { id: balance.id },
      data: {
        onHand: newOnHand,
        updatedAt: new Date(),
      },
    });

    // 4. Create the permanent immutable StockMovement ledger entry
    const movement = await tx.stockMovement.create({
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

    // 5. Evaluate Stock Health & Trigger Alerts if threshold reached
    const product = await tx.product.findUnique({
      where: { id: productId },
      select: { minStock: true, name: true, sku: true },
    });

    if (product) {
      const available = newOnHand - currentReserved;
      const minStockThreshold = Number(product.minStock);

      if (available <= 0) {
        await tx.inventoryAlert.upsert({
          where: {
            orgId_productId_alertType_status: {
              orgId,
              productId,
              alertType: 'OUT_OF_STOCK',
              status: 'NEW',
            },
          },
          update: {
            message: `${product.name} (${product.sku}) is completely OUT OF STOCK at location.`,
            details: JSON.stringify({ onHand: newOnHand, reserved: currentReserved, available: 0 }),
          },
          create: {
            orgId,
            productId,
            locationId,
            alertType: 'OUT_OF_STOCK',
            severity: 'CRITICAL',
            status: 'NEW',
            message: `${product.name} (${product.sku}) is completely OUT OF STOCK at location.`,
            details: JSON.stringify({ onHand: newOnHand, reserved: currentReserved, available: 0 }),
          },
        });
      } else if (available <= minStockThreshold) {
        await tx.inventoryAlert.upsert({
          where: {
            orgId_productId_alertType_status: {
              orgId,
              productId,
              alertType: 'LOW_STOCK',
              status: 'NEW',
            },
          },
          update: {
            message: `${product.name} (${product.sku}) is LOW on stock (${available} available, reorder point is ${minStockThreshold}).`,
            details: JSON.stringify({ onHand: newOnHand, reserved: currentReserved, available, minStock: minStockThreshold }),
          },
          create: {
            orgId,
            productId,
            locationId,
            alertType: 'LOW_STOCK',
            severity: 'WARNING',
            status: 'NEW',
            message: `${product.name} (${product.sku}) is LOW on stock (${available} available, reorder point is ${minStockThreshold}).`,
            details: JSON.stringify({ onHand: newOnHand, reserved: currentReserved, available, minStock: minStockThreshold }),
          },
        });
      }
    }

    return movement;
  }

  /**
   * Reserves stock for an order without deducting on-hand immediately.
   * Available = On-Hand - Reserved.
   */
  static async reserveStock(
    tx: Prisma.TransactionClient | PrismaClient,
    params: StockReservationParams
  ) {
    const { orgId, productId, variantId = null, locationId, quantity, referenceType, referenceId, expiresAt } = params;

    let balance = await tx.stockBalance.findFirst({
      where: { orgId, productId, locationId },
    });

    if (!balance) {
      balance = await tx.stockBalance.create({
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

    const org = await tx.organization.findUnique({
      where: { id: orgId },
      select: { negativeStockEnabled: true },
    });

    if (!org?.negativeStockEnabled && available < quantity) {
      throw new Error(
        `Insufficient available stock for reservation. Available: ${available}, Requested: ${quantity}`
      );
    }

    // Update reserved amount
    await tx.stockBalance.update({
      where: { id: balance.id },
      data: {
        reserved: reserved + quantity,
        updatedAt: new Date(),
      },
    });

    // Create reservation record
    const reservation = await tx.stockReservation.create({
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

    return reservation;
  }

  /**
   * Releases an active reservation without deducting on-hand (e.g. order cancelled).
   */
  static async releaseReservation(
    tx: Prisma.TransactionClient | PrismaClient,
    orgId: string,
    reservationId: string
  ) {
    const reservation = await tx.stockReservation.findUnique({
      where: { id: reservationId },
    });

    if (!reservation || reservation.orgId !== orgId || reservation.status !== 'ACTIVE') {
      return null;
    }

    const balance = await tx.stockBalance.findFirst({
      where: {
        orgId,
        productId: reservation.productId,
        locationId: reservation.locationId,
      },
    });

    if (balance) {
      const newReserved = Math.max(0, Number(balance.reserved) - Number(reservation.quantity));
      await tx.stockBalance.update({
        where: { id: balance.id },
        data: { reserved: newReserved, updatedAt: new Date() },
      });
    }

    return tx.stockReservation.update({
      where: { id: reservationId },
      data: { status: 'RELEASED', updatedAt: new Date() },
    });
  }

  /**
   * Fulfils a reservation: reduces both reserved stock and on-hand stock and writes movement.
   */
  static async fulfilReservation(
    tx: Prisma.TransactionClient | PrismaClient,
    params: {
      orgId: string;
      reservationId: string;
      unitCost: number;
      userId?: string;
    }
  ) {
    const { orgId, reservationId, unitCost, userId } = params;

    const reservation = await tx.stockReservation.findUnique({
      where: { id: reservationId },
    });

    if (!reservation || reservation.orgId !== orgId || reservation.status !== 'ACTIVE') {
      throw new Error('Valid active reservation required for fulfilment.');
    }

    const qty = Number(reservation.quantity);

    // 1. Release the reservation hold
    const balance = await tx.stockBalance.findFirst({
      where: {
        orgId,
        productId: reservation.productId,
        locationId: reservation.locationId,
      },
    });

    if (balance) {
      const newReserved = Math.max(0, Number(balance.reserved) - qty);
      await tx.stockBalance.update({
        where: { id: balance.id },
        data: { reserved: newReserved },
      });
    }

    // 2. Mark reservation fulfilled
    await tx.stockReservation.update({
      where: { id: reservationId },
      data: { status: 'FULFILLED' },
    });

    // 3. Deduct on-hand stock via movement ledger
    return this.recordMovement(tx, {
      orgId,
      productId: reservation.productId,
      variantId: reservation.variantId,
      locationId: reservation.locationId,
      type: 'SALE',
      quantity: -qty,
      unitCost,
      referenceType: reservation.referenceType,
      referenceId: reservation.referenceId,
      reason: `Fulfilment of reservation ${reservation.id}`,
      userId,
    });
  }

  /**
   * Stock Transfer Dispatch: Decreases source on-hand and increases inTransit.
   */
  static async dispatchTransfer(
    tx: Prisma.TransactionClient | PrismaClient,
    orgId: string,
    transferId: string,
    userId?: string
  ) {
    const transfer = await tx.stockTransfer.findUnique({
      where: { id: transferId },
      include: { items: true },
    });

    if (!transfer || transfer.orgId !== orgId || transfer.status !== 'DRAFT') {
      throw new Error('Transfer cannot be dispatched. Must be in DRAFT state.');
    }

    for (const item of transfer.items) {
      const qty = Number(item.quantityDispatched);

      // Deduct from source on-hand
      await this.recordMovement(tx, {
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

      // Increase source inTransit balance
      const sourceBalance = await tx.stockBalance.findFirst({
        where: { orgId, productId: item.productId, locationId: transfer.sourceLocationId },
      });

      if (sourceBalance) {
        await tx.stockBalance.update({
          where: { id: sourceBalance.id },
          data: {
            inTransit: Number(sourceBalance.inTransit) + qty,
            updatedAt: new Date(),
          },
        });
      }
    }

    return tx.stockTransfer.update({
      where: { id: transferId },
      data: {
        status: 'DISPATCHED',
        dispatchDate: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Stock Transfer Receipt: Decreases inTransit, increases destination on-hand,
   * handles discrepancies / damaged quantities.
   */
  static async receiveTransfer(
    tx: Prisma.TransactionClient | PrismaClient,
    params: {
      orgId: string;
      transferId: string;
      receivedItems: Array<{
        itemId: string;
        quantityReceived: number;
        quantityDamaged: number;
        notes?: string;
      }>;
      userId?: string;
    }
  ) {
    const { orgId, transferId, receivedItems, userId } = params;

    const transfer = await tx.stockTransfer.findUnique({
      where: { id: transferId },
      include: { items: true },
    });

    if (!transfer || transfer.orgId !== orgId || transfer.status !== 'DISPATCHED') {
      throw new Error('Transfer cannot be received. Must be in DISPATCHED state.');
    }

    for (const recItem of receivedItems) {
      const originalItem = transfer.items.find((i) => i.id === recItem.itemId);
      if (!originalItem) continue;

      const qtyDispatched = Number(originalItem.quantityDispatched);
      const qtyReceived = Number(recItem.quantityReceived);
      const qtyDamaged = Number(recItem.quantityDamaged || 0);

      // 1. Update transfer item record
      await tx.stockTransferItem.update({
        where: { id: originalItem.id },
        data: {
          quantityReceived: qtyReceived,
          quantityDamaged: qtyDamaged,
          notes: recItem.notes,
        },
      });

      // 2. Reduce inTransit from source location
      const sourceBalance = await tx.stockBalance.findFirst({
        where: { orgId, productId: originalItem.productId, locationId: transfer.sourceLocationId },
      });
      if (sourceBalance) {
        await tx.stockBalance.update({
          where: { id: sourceBalance.id },
          data: {
            inTransit: Math.max(0, Number(sourceBalance.inTransit) - qtyDispatched),
            updatedAt: new Date(),
          },
        });
      }

      // 3. Add received stock into destination location
      if (qtyReceived > 0) {
        await this.recordMovement(tx, {
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

      // 4. Record damaged units as write-off if applicable
      if (qtyDamaged > 0) {
        await this.recordMovement(tx, {
          orgId,
          productId: originalItem.productId,
          variantId: originalItem.variantId,
          locationId: transfer.destinationLocationId,
          type: 'DAMAGE_WRITE_OFF',
          quantity: 0, // Write-off is an audited log or tracked loss
          referenceType: 'TRANSFER',
          referenceId: transfer.id,
          reason: `Damaged during transfer ${transfer.transferNumber}: ${qtyDamaged} units damaged`,
          userId,
        });
      }
    }

    return tx.stockTransfer.update({
      where: { id: transferId },
      data: {
        status: 'COMPLETED',
        receiveDate: new Date(),
        updatedAt: new Date(),
      },
    });
  }
}

