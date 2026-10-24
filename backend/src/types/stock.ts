import type { Queryable } from '../db/transaction';
import type { Vehicle, VehicleChanges } from './vehicle';

export type StockChange =
  | { kind: 'purchase'; quantity: number; userId: string }
  | { kind: 'restock'; quantity: number }
  /** An edit (PUT) that sets the quantity, applied together with any other edited fields. */
  | { kind: 'set'; quantity: number; fields: VehicleChanges };

/** What every handler sees after a stock write, inside the same transaction. */
export interface StockChangeEvent {
  change: StockChange;
  vehicle: Vehicle;
  before: number;
  after: number;
}

/** Open/Closed extension point: new alert rules are new handlers, not edits to the purchase flow. */
export interface IStockChangeHandler {
  handle(event: StockChangeEvent, tx: Queryable): Promise<void>;
}
