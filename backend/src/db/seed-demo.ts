import type { Pool } from 'pg';

export interface SeedOptions {
  now: Date;
}

/** Loads a realistic demo lot and 30 days of sales. Refuses to touch a database that already has stock. */
export async function seedDemoData(_pool: Pool, _options: SeedOptions): Promise<void> {
  throw new Error('Not implemented');
}
