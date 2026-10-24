import type { Pool } from 'pg';
import type { Category } from '../types/vehicle';

export interface SeedOptions {
  now: Date;
}

interface DemoVehicle {
  make: string;
  model: string;
  category: Category;
  price: number;
  quantity: number;
  /** Units sold over the last 30 days. Drives the forecast. */
  sold: number;
}

// A plausible mid-size dealership lot: real models, realistic prices, a few sold out and several running low.
const LOT: DemoVehicle[] = [
  { make: 'Toyota', model: 'Camry', category: 'Sedan', price: 28400, quantity: 6, sold: 14 },
  { make: 'Toyota', model: 'RAV4', category: 'SUV', price: 31900, quantity: 2, sold: 18 },
  { make: 'Toyota', model: 'Corolla', category: 'Sedan', price: 22050, quantity: 9, sold: 12 },
  { make: 'Honda', model: 'Civic', category: 'Sedan', price: 24650, quantity: 7, sold: 10 },
  { make: 'Honda', model: 'CR-V', category: 'SUV', price: 32450, quantity: 0, sold: 9 },
  { make: 'Honda', model: 'Accord', category: 'Sedan', price: 28990, quantity: 5, sold: 4 },
  { make: 'Ford', model: 'F-150', category: 'Truck', price: 38999.99, quantity: 4, sold: 11 },
  { make: 'Ford', model: 'Mustang', category: 'Coupe', price: 32515, quantity: 3, sold: 2 },
  { make: 'Ford', model: 'Escape', category: 'SUV', price: 29495, quantity: 8, sold: 5 },
  { make: 'Ford', model: 'Transit', category: 'Van', price: 49155, quantity: 3, sold: 2 },
  { make: 'Chevrolet', model: 'Silverado 1500', category: 'Truck', price: 37645, quantity: 5, sold: 6 },
  { make: 'Chevrolet', model: 'Equinox', category: 'SUV', price: 27500, quantity: 11, sold: 7 },
  { make: 'Chevrolet', model: 'Corvette Stingray', category: 'Coupe', price: 68300, quantity: 1, sold: 1 },
  { make: 'Tesla', model: 'Model 3', category: 'Electric', price: 42490, quantity: 6, sold: 9 },
  { make: 'Tesla', model: 'Model Y', category: 'Electric', price: 44990, quantity: 2, sold: 13 },
  { make: 'Hyundai', model: 'Elantra', category: 'Sedan', price: 21475, quantity: 12, sold: 8 },
  { make: 'Hyundai', model: 'Tucson', category: 'SUV', price: 28700, quantity: 0, sold: 0 },
  { make: 'Hyundai', model: 'Ioniq 5', category: 'Electric', price: 42600, quantity: 4, sold: 3 },
  { make: 'Kia', model: 'Sportage', category: 'SUV', price: 27990, quantity: 7, sold: 6 },
  { make: 'Kia', model: 'Telluride', category: 'SUV', price: 36190, quantity: 3, sold: 8 },
  { make: 'Volkswagen', model: 'Golf GTI', category: 'Hatchback', price: 31965, quantity: 5, sold: 3 },
  { make: 'Volkswagen', model: 'ID.4', category: 'Electric', price: 39735, quantity: 6, sold: 2 },
  { make: 'Mazda', model: 'CX-5', category: 'SUV', price: 29300, quantity: 9, sold: 7 },
  { make: 'Mazda', model: 'MX-5 Miata', category: 'Convertible', price: 28985, quantity: 2, sold: 1 },
  { make: 'Subaru', model: 'Outback', category: 'SUV', price: 29995, quantity: 6, sold: 5 },
  { make: 'BMW', model: '330i', category: 'Sedan', price: 46675, quantity: 4, sold: 2 },
  { make: 'BMW', model: 'X5', category: 'SUV', price: 65200, quantity: 3, sold: 2 },
  { make: 'BMW', model: 'Z4', category: 'Convertible', price: 53900, quantity: 1, sold: 0 },
  { make: 'Mercedes-Benz', model: 'C 300', category: 'Sedan', price: 47500, quantity: 2, sold: 1 },
  { make: 'Audi', model: 'A4', category: 'Sedan', price: 42200, quantity: 5, sold: 3 },
  { make: 'Chrysler', model: 'Pacifica', category: 'Van', price: 40995, quantity: 0, sold: 4 },
  { make: 'Mini', model: 'Cooper', category: 'Hatchback', price: 29500, quantity: 6, sold: 2 },
];

const DAY_MS = 86_400_000;
const LOW_STOCK_THRESHOLD = 3;

/** Small deterministic PRNG (mulberry32), so every seed produces the same sales history. */
function random(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Loads a realistic demo lot and 30 days of sales. Refuses to touch a database that already has stock. */
export async function seedDemoData(pool: Pool, { now }: SeedOptions): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: existing } = await client.query<{ n: number }>('SELECT count(*)::int AS n FROM vehicles');
    if (existing[0]!.n > 0) {
      throw new Error('Database already has vehicles; the demo seed only runs on an empty inventory');
    }

    // Historic sales need a buyer. "!disabled" is not a bcrypt hash, so this account can never sign in.
    const { rows: buyer } = await client.query<{ id: string }>(
      `INSERT INTO users (name, email, password_hash) VALUES ('Walk-in Customer', 'walk-in@dealership.example', '!disabled')
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
    );
    const buyerId = buyer[0]!.id;

    const next = random(42);
    for (const v of LOT) {
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO vehicles (make, model, category, price, quantity, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $6) RETURNING id`,
        [v.make, v.model, v.category, v.price, v.quantity, new Date(now.getTime() - 45 * DAY_MS)],
      );
      const vehicleId = rows[0]!.id;

      let remaining = v.sold;
      while (remaining > 0) {
        const units = remaining > 1 && next() < 0.2 ? 2 : 1;
        const at = new Date(now.getTime() - (0.01 + next() * 29.9) * DAY_MS);
        await client.query(
          'INSERT INTO purchases (vehicle_id, user_id, quantity, unit_price, created_at) VALUES ($1, $2, $3, $4, $5)',
          [vehicleId, buyerId, units, v.price, at],
        );
        remaining -= units;
      }

      // Admins who already exist see the lot's current low and sold-out stock straight away.
      if (v.quantity <= LOW_STOCK_THRESHOLD) {
        await client.query(
          `INSERT INTO notifications (recipient_id, type, vehicle_id, quantity)
           SELECT id, $1, $2, $3 FROM users WHERE role = 'admin'
           ON CONFLICT (recipient_id, vehicle_id, type)
             WHERE resolved_at IS NULL AND type IN ('LOW_STOCK', 'OUT_OF_STOCK')
           DO NOTHING`,
          [v.quantity === 0 ? 'OUT_OF_STOCK' : 'LOW_STOCK', vehicleId, v.quantity],
        );
      }
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
