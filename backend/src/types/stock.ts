import type { Queryable } from '../db/transaction';
import type { ColourInput, Vehicle, VehicleChanges } from './vehicle';

export type StockChange =
  /** Without a colour, the sale comes from the best-stocked colour. */
  | { kind: 'purchase'; quantity: number; userId: string; colourId?: string }
  /** The colour may be omitted only for a single-colour model. */
  | { kind: 'restock'; quantity: number; colourId?: string }
  /** An edit (PUT) that sets the quantity of a single-colour model, applied with the other edited fields. */
  | { kind: 'set'; quantity: number; fields: VehicleChanges }
  /** Adding stock of a colour to an existing model: creates the colour if it is new. */
  | { kind: 'receive'; quantity: number; colour: ColourInput };

/** What every handler sees after a stock write, inside the same transaction. Quantities are model totals. */
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
