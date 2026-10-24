import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Pool } from 'pg';

export interface MigrateOptions {
  dir?: string;
  table?: string;
}

export const MIGRATIONS_DIR = path.resolve(__dirname, '../../migrations');

const TABLE_NAME = /^[a-z_][a-z0-9_]*$/;
// Arbitrary constant: serialises concurrent migrators on the same database.
const ADVISORY_LOCK_KEY = 727_001;

/** Applies pending migrations, each in its own transaction, and returns the filenames applied. */
export async function migrate(pool: Pool, options: MigrateOptions = {}): Promise<string[]> {
  const dir = options.dir ?? MIGRATIONS_DIR;
  const table = options.table ?? 'schema_migrations';
  if (!TABLE_NAME.test(table)) {
    throw new Error(`Invalid migrations table name "${table}"`);
  }

  // dir comes from code (the migrations folder or a test's temp dir), never from a request.
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [ADVISORY_LOCK_KEY]);
    await client.query(
      `CREATE TABLE IF NOT EXISTS ${table} (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`,
    );
    const { rows } = await client.query<{ name: string }>(`SELECT name FROM ${table}`);
    const done = new Set(rows.map((r) => r.name));

    const applied: string[] = [];
    for (const file of files.filter((f) => !done.has(f))) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- file names come from readdir(dir) above
      const sql = await readFile(path.join(dir, file), 'utf8');
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query(`INSERT INTO ${table} (name) VALUES ($1)`, [file]);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${file} failed: ${(err as Error).message}`);
      }
      applied.push(file);
    }
    return applied;
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK_KEY]).catch(() => undefined);
    client.release();
  }
}
