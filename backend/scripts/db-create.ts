/**
 * Creates the dev and test databases named in DATABASE_URL / TEST_DATABASE_URL if they don't exist.
 * Connects to the server's maintenance database ("postgres") with the same credentials.
 */
import 'dotenv/config';
import { Client } from 'pg';

const IDENTIFIER = /^[a-z_][a-z0-9_]{0,62}$/;

async function ensureDatabase(url: string): Promise<void> {
  const target = new URL(url);
  const name = decodeURIComponent(target.pathname.slice(1));
  // CREATE DATABASE cannot take a bind parameter, so the name is allow-listed instead.
  if (!IDENTIFIER.test(name)) {
    throw new Error(`Refusing to create database with unsafe name "${name}"`);
  }

  const maintenance = new URL(url);
  maintenance.pathname = '/postgres';
  const client = new Client({ connectionString: maintenance.toString() });
  await client.connect();
  try {
    const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
    if (rowCount) {
      console.log(`exists   ${name}`);
      return;
    }
    await client.query(`CREATE DATABASE "${name}"`);
    console.log(`created  ${name}`);
  } finally {
    await client.end();
  }
}

async function main(): Promise<void> {
  const urls = [process.env.DATABASE_URL, process.env.TEST_DATABASE_URL].filter((u): u is string => !!u);
  if (urls.length === 0) {
    throw new Error('Set DATABASE_URL and TEST_DATABASE_URL in backend/.env');
  }
  for (const url of urls) {
    await ensureDatabase(url);
  }
}

main().catch((err: Error) => {
  console.error(err.message);
  process.exit(1);
});
