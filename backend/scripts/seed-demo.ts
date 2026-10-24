/** npm run seed:demo: loads the demo lot and 30 days of sales into an empty DATABASE_URL. Run after seed:admin. */
import 'dotenv/config';
import { Pool } from 'pg';
import { loadConfig } from '../src/config';
import { seedDemoData } from '../src/db/seed-demo';

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: loadConfig(process.env).databaseUrl });
  try {
    await seedDemoData(pool, { now: new Date() });
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM vehicles');
    console.log(`demo lot ready: ${rows[0].n} vehicles`);
  } finally {
    await pool.end();
  }
}

main().catch((err: Error) => {
  console.error(err.message);
  process.exit(1);
});
