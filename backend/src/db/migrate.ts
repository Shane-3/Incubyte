import path from 'node:path';
import type { Pool } from 'pg';

export interface MigrateOptions {
  dir?: string;
  table?: string;
}

export const MIGRATIONS_DIR = path.resolve(__dirname, '../../migrations');

/** Applies pending migrations and returns the filenames applied. */
export async function migrate(_pool: Pool, _options: MigrateOptions = {}): Promise<string[]> {
  throw new Error('Not implemented');
}
