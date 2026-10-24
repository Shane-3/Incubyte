/** npm run seed:admin: upserts the admin from ADMIN_EMAIL / ADMIN_PASSWORD. */
import 'dotenv/config';
import { Pool } from 'pg';
import { loadConfig } from '../src/config';
import { seedAdmin } from '../src/db/seed-admin';
import { BcryptPasswordHasher } from '../src/services/bcrypt-hasher';

async function main(): Promise<void> {
  const config = loadConfig(process.env);
  const pool = new Pool({ connectionString: config.databaseUrl });
  try {
    await seedAdmin(pool, new BcryptPasswordHasher(config.bcryptRounds), {
      email: process.env.ADMIN_EMAIL ?? '',
      password: process.env.ADMIN_PASSWORD ?? '',
    });
    console.log(`admin ready: ${process.env.ADMIN_EMAIL?.toLowerCase()}`);
  } finally {
    await pool.end();
  }
}

main().catch((err: Error) => {
  console.error(err.message);
  process.exit(1);
});
