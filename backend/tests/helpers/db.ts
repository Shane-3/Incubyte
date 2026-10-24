import { Pool } from 'pg';
import { migrate } from '../../src/db/migrate';

export function testDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error('TEST_DATABASE_URL is not set; copy backend/.env.example to backend/.env');
  }
  return url;
}

/** A pool on the test database with all migrations applied. Close it in afterAll. */
export async function openTestDb(): Promise<Pool> {
  const pool = new Pool({ connectionString: testDatabaseUrl(), max: 10 });
  await migrate(pool);
  return pool;
}

/** Empties every application table between tests. */
export async function resetDb(pool: Pool): Promise<void> {
  const { rows } = await pool.query<{ tablename: string }>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'schema_migrations'`,
  );
  if (rows.length > 0) {
    const tables = rows.map((r) => `"${r.tablename}"`).join(', ');
    await pool.query(`TRUNCATE ${tables} RESTART IDENTITY CASCADE`);
  }
}
