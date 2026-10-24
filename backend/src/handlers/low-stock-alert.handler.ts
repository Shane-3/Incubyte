import type { Queryable } from '../db/transaction';
import type { IAlertWriter } from '../repositories/notification.repository';
import type { IStockChangeHandler, StockChangeEvent } from '../types/stock';

type StockLevel = 'out' | 'low' | 'ok';

/** Raises and resolves admin alerts as stock moves through the low band (design.md section 5A). */
export class LowStockAlertHandler implements IStockChangeHandler {
  constructor(
    private readonly alerts: IAlertWriter,
    private readonly threshold: number,
  ) {}

  async handle({ vehicle, before, after }: StockChangeEvent, tx: Queryable): Promise<void> {
    const level = this.levelOf(after);

    if (level === 'out') {
      await this.alerts.notifyAdmins(tx, { type: 'OUT_OF_STOCK', vehicleId: vehicle.id, quantity: after });
      await this.alerts.resolveAlerts(tx, vehicle.id, ['LOW_STOCK']);
    } else if (level === 'low' && after < before) {
      await this.alerts.notifyAdmins(tx, { type: 'LOW_STOCK', vehicleId: vehicle.id, quantity: after });
      await this.alerts.resolveAlerts(tx, vehicle.id, ['OUT_OF_STOCK']);
    } else if (level === 'low') {
      await this.alerts.resolveAlerts(tx, vehicle.id, ['OUT_OF_STOCK']);
    } else if (this.levelOf(before) !== 'ok') {
      // Only a change that leaves the low band can have open alerts to resolve.
      await this.alerts.resolveAlerts(tx, vehicle.id, ['LOW_STOCK', 'OUT_OF_STOCK']);
    }
  }

  private levelOf(quantity: number): StockLevel {
    if (quantity === 0) return 'out';
    return quantity <= this.threshold ? 'low' : 'ok';
  }
}
