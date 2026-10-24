import type { Pool } from 'pg';
import type { SalesSummary } from '../services/forecast.service';
import type { ISalesRepository } from './sales.repository';

export class PgSalesRepository implements ISalesRepository {
  constructor(private readonly pool: Pool) {}

  async summarise(from: Date, to: Date): Promise<SalesSummary[]> {
    const { rows } = await this.pool.query<{ id: string; quantity: number; units_sold: number }>(
      `SELECT v.id, v.quantity, COALESCE(SUM(p.quantity), 0)::int AS units_sold
       FROM vehicles v
       LEFT JOIN purchases p ON p.vehicle_id = v.id AND p.created_at > $1 AND p.created_at <= $2
       GROUP BY v.id
       ORDER BY v.id`,
      [from, to],
    );
    return rows.map((r) => ({ vehicleId: r.id, quantity: r.quantity, unitsSold: r.units_sold }));
  }
}
