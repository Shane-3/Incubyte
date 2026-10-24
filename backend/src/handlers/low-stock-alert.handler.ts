import type { Queryable } from '../db/transaction';
import type { IAlertWriter } from '../repositories/notification.repository';
import type { IStockChangeHandler, StockChangeEvent } from '../types/stock';

export class LowStockAlertHandler implements IStockChangeHandler {
  constructor(
    private readonly alerts: IAlertWriter,
    private readonly threshold: number,
  ) {}

  async handle(_event: StockChangeEvent, _tx: Queryable): Promise<void> {
    throw new Error('Not implemented');
  }
}
