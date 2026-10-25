import type { Pool } from 'pg';
import type { SalesSummary } from '../services/forecast.service';
import type { PurchaseTotals, PurchaseView } from '../types/purchase';
import type { Category, Page } from '../types/vehicle';
import type { ISalesRepository } from './sales.repository';

interface PurchaseRow {
  id: string;
  quantity: number;
  unit_price: string;
  created_at: Date;
  vehicle_id: string;
  make: string;
  model: string;
  sku: string;
  category: Category;
  colour_name: string | null;
  colour_hex: string | null;
  buyer_id: string;
  buyer_name: string;
  buyer_email: string;
}

function toView(row: PurchaseRow): PurchaseView {
  const unitPrice = Number(row.unit_price);
  return {
    id: row.id,
    quantity: row.quantity,
    unitPrice,
    // Money in minor units to avoid float drift (27999.5 × 2 = 55999, not 55998.99…).
    total: Math.round(unitPrice * 100 * row.quantity) / 100,
    createdAt: row.created_at,
    vehicle: { id: row.vehicle_id, make: row.make, model: row.model, sku: row.sku, category: row.category },
    colour: row.colour_name && row.colour_hex ? { name: row.colour_name, hex: row.colour_hex } : null,
    buyer: { id: row.buyer_id, name: row.buyer_name, email: row.buyer_email },
  };
}

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

  async recent(
    from: Date,
    to: Date,
    { limit, offset }: { limit: number; offset: number },
  ): Promise<Page<PurchaseView>> {
    const [page, total] = await Promise.all([
      this.pool.query<PurchaseRow>(
        `SELECT p.id, p.quantity, p.unit_price, p.created_at,
                v.id AS vehicle_id, v.make, v.model, v.sku, v.category,
                c.name AS colour_name, c.hex AS colour_hex,
                u.id AS buyer_id, u.name AS buyer_name, u.email AS buyer_email
         FROM purchases p
         JOIN vehicles v ON v.id = p.vehicle_id
         JOIN users u ON u.id = p.user_id
         LEFT JOIN vehicle_colours c ON c.id = p.colour_id
         WHERE p.created_at > $1 AND p.created_at <= $2
         ORDER BY p.created_at DESC, p.id
         LIMIT $3 OFFSET $4`,
        [from, to, limit, offset],
      ),
      this.pool.query<{ count: number }>(
        'SELECT count(*)::int AS count FROM purchases WHERE created_at > $1 AND created_at <= $2',
        [from, to],
      ),
    ]);
    return { data: page.rows.map(toView), count: total.rows[0]!.count };
  }

  async totals(from: Date, to: Date): Promise<PurchaseTotals> {
    const { rows } = await this.pool.query<{ orders: number; units: number; revenue: string }>(
      `SELECT count(*)::int AS orders,
              COALESCE(sum(quantity), 0)::int AS units,
              COALESCE(sum(quantity * unit_price), 0) AS revenue
       FROM purchases WHERE created_at > $1 AND created_at <= $2`,
      [from, to],
    );
    const row = rows[0]!;
    return { orders: row.orders, units: row.units, revenue: Number(row.revenue) };
  }
}
