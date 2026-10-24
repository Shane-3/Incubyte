import type { SalesSummary } from '../services/forecast.service';

export interface ISalesRepository {
  /** Every vehicle with its current stock and units sold in (from, to]. Vehicles without sales report 0. */
  summarise(from: Date, to: Date): Promise<SalesSummary[]>;
}
