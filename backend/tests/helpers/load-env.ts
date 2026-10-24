import { config } from 'dotenv';

config({ quiet: true });

// Integration tests truncate tables, so never let them run against the dev database.
const testUrl = process.env.TEST_DATABASE_URL;
if (testUrl && testUrl === process.env.DATABASE_URL) {
  throw new Error('TEST_DATABASE_URL must differ from DATABASE_URL');
}
