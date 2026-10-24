import type { Pool } from 'pg';
import { EmailTakenError } from '../../src/errors';
import { PgUserRepository } from '../../src/repositories/pg-user.repository';
import { openTestDb, resetDb } from '../helpers/db';

const priya = {
  name: 'Priya Nair',
  email: 'priya.nair@example.com',
  passwordHash: '$2b$04$hash',
  role: 'user' as const,
};

describe('PgUserRepository', () => {
  let pool: Pool;
  let repo: PgUserRepository;

  beforeAll(async () => {
    pool = await openTestDb();
    repo = new PgUserRepository(pool);
  });

  beforeEach(() => resetDb(pool));

  afterAll(() => pool.end());

  it('creates a user with a generated UUID and timestamp', async () => {
    const user = await repo.create(priya);

    expect(user).toEqual({
      ...priya,
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      createdAt: expect.any(Date),
    });
  });

  it('finds a user by email and by id', async () => {
    const created = await repo.create(priya);

    expect(await repo.findByEmail(priya.email)).toEqual(created);
    expect(await repo.findById(created.id)).toEqual(created);
  });

  it('returns null for unknown emails and ids', async () => {
    expect(await repo.findByEmail('nobody@example.com')).toBeNull();
    expect(await repo.findById('00000000-0000-4000-8000-000000000000')).toBeNull();
  });

  it('returns null rather than failing for an id that is not a UUID', async () => {
    expect(await repo.findById("1' OR '1'='1")).toBeNull();
  });

  it('maps a duplicate email that slips past the service check to EmailTakenError', async () => {
    const results = await Promise.allSettled([repo.create(priya), repo.create(priya)]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.find((r) => r.status === 'rejected')).toMatchObject({ reason: expect.any(EmailTakenError) });
  });

  describe('database invariants', () => {
    it('rejects a role outside user/admin', async () => {
      await expect(
        pool.query(`INSERT INTO users (name, email, password_hash, role) VALUES ('X', 'x@example.com', 'h', 'root')`),
      ).rejects.toThrow(/check constraint/);
    });

    it('rejects an email that is not stored in lowercase', async () => {
      await expect(
        pool.query(`INSERT INTO users (name, email, password_hash) VALUES ('X', 'Mixed@Example.com', 'h')`),
      ).rejects.toThrow(/check constraint/);
    });

    it('defaults the role to user', async () => {
      const { rows } = await pool.query(
        `INSERT INTO users (name, email, password_hash) VALUES ('X', 'x@example.com', 'h') RETURNING role`,
      );

      expect(rows[0].role).toBe('user');
    });
  });
});
