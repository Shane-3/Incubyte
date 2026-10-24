import type { Pool } from 'pg';
import type { SalesSummary } from '../services/forecast.service';
import type { ISalesRepository } from './sales.repository';

export class PgSalesRepository implements ISalesRepository {
  constructor(private readonly pool: Pool) {}

  async summarise(_from: Date, _to: Date): Promise<SalesSummary[]> {
    throw new Error('Not implemented');
  }
}
