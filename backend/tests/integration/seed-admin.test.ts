import type { Pool } from 'pg';
import { seedAdmin } from '../../src/db/seed-admin';
import { PgUserRepository } from '../../src/repositories/pg-user.repository';
import { FakePasswordHasher } from '../helpers/fakes';
import { openTestDb, resetDb } from '../helpers/db';

describe('seedAdmin', () => {
  let pool: Pool;
  const hasher = new FakePasswordHasher();
  const input = { email: 'Ops@Example.com', password: 'Adm1n-Passw0rd' };

  beforeAll(async () => {
    pool = await openTestDb();
  });

  beforeEach(() => resetDb(pool));

  afterAll(() => pool.end());

  it('creates an admin with a hashed password and normalised email', async () => {
    await seedAdmin(pool, hasher, input);

    const admin = await new PgUserRepository(pool).findByEmail('ops@example.com');
    expect(admin).toMatchObject({ role: 'admin', name: 'Administrator', passwordHash: 'hashed:Adm1n-Passw0rd' });
  });

  it('is idempotent and resets the password on re-run', async () => {
    await seedAdmin(pool, hasher, input);
    await seedAdmin(pool, hasher, { ...input, password: 'N3w-Adm1n-Pass' });

    const { rows } = await pool.query('SELECT password_hash FROM users');
    expect(rows).toEqual([{ password_hash: 'hashed:N3w-Adm1n-Pass' }]);
  });

  it('promotes an existing account with that email', async () => {
    await new PgUserRepository(pool).create({
      name: 'Priya Nair',
      email: 'ops@example.com',
      passwordHash: 'hashed:old',
      role: 'user',
    });

    await seedAdmin(pool, hasher, input);

    const admin = await new PgUserRepository(pool).findByEmail('ops@example.com');
    expect(admin).toMatchObject({ role: 'admin', name: 'Priya Nair' });
  });

  it.each([
    [{ email: 'not-an-email', password: 'Adm1n-Passw0rd' }, /ADMIN_EMAIL/],
    [{ email: 'ops@example.com', password: 'short' }, /ADMIN_PASSWORD/],
  ])('refuses invalid credentials %j', async (bad, message) => {
    await expect(seedAdmin(pool, hasher, bad)).rejects.toThrow(message);
  });
});
