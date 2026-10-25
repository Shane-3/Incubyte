import type { SalesSummary } from '../services/forecast.service';
import type { PurchaseTotals, PurchaseView } from '../types/purchase';
import type { Page } from '../types/vehicle';

export interface ISalesRepository {
  /** Every vehicle with its current stock and units sold in (from, to]. Vehicles without sales report 0. */
  summarise(from: Date, to: Date): Promise<SalesSummary[]>;
  /** Sales in (from, to], newest first, with the vehicle, colour and buyer. */
  recent(from: Date, to: Date, page: { limit: number; offset: number }): Promise<Page<PurchaseView>>;
  /** Orders, units and revenue in (from, to]. */
  totals(from: Date, to: Date): Promise<PurchaseTotals>;
}
