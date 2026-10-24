/**
 * npm run seed:demo: loads the demo lot and 30 days of sales into an empty DATABASE_URL. Run after seed:admin.
 * npm run seed:demo -- --replace: deletes the current lot (vehicles with their colours, sales, alerts and watches)
 * first; user accounts are kept. Refused in production.
 */
import 'dotenv/config';
import { Pool } from 'pg';
import { loadConfig } from '../src/config';
import { seedDemoData } from '../src/db/seed-demo';

async function main(): Promise<void> {
  const config = loadConfig(process.env);
  const replace = process.argv.includes('--replace');
  if (replace && config.env === 'production') {
    throw new Error('Refusing to replace inventory in production');
  }
  const pool = new Pool({ connectionString: config.databaseUrl });
  try {
    await seedDemoData(pool, { now: new Date(), replace });
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM vehicles');
    console.log(`demo lot ready: ${rows[0].n} vehicles${replace ? ' (previous lot replaced)' : ''}`);
  } finally {
    await pool.end();
  }
}

main().catch((err: Error) => {
  console.error(err.message);
  process.exit(1);
});
