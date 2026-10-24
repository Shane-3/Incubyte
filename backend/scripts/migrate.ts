/** Applies pending migrations to DATABASE_URL (or TEST_DATABASE_URL with --test). */
import 'dotenv/config';
import { Pool } from 'pg';
import { migrate } from '../src/db/migrate';

async function main(): Promise<void> {
  const url = process.argv.includes('--test') ? process.env.TEST_DATABASE_URL : process.env.DATABASE_URL;
  if (!url) {
    throw new Error('Database URL is not set; see backend/.env.example');
  }
  const pool = new Pool({ connectionString: url });
  try {
    const applied = await migrate(pool);
    console.log(applied.length ? applied.map((f) => `applied  ${f}`).join('\n') : 'up to date');
  } finally {
    await pool.end();
  }
}

main().catch((err: Error) => {
  console.error(err.message);
  process.exit(1);
});
