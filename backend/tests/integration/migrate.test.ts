import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Pool } from 'pg';
import { migrate } from '../../src/db/migrate';
import { testDatabaseUrl } from '../helpers/db';

const TABLE = 'probe_schema_migrations';

describe('migrate', () => {
  let pool: Pool;
  let dir: string;

  beforeAll(async () => {
    pool = new Pool({ connectionString: testDatabaseUrl() });
  });

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'migrations-'));
    await pool.query(`DROP TABLE IF EXISTS ${TABLE}, migrate_probe_a, migrate_probe_b`);
  });

  afterEach(async () => {
    await pool.query(`DROP TABLE IF EXISTS ${TABLE}, migrate_probe_a, migrate_probe_b`);
    await rm(dir, { recursive: true, force: true });
  });

  afterAll(async () => {
    await pool.end();
  });

  async function tableExists(name: string): Promise<boolean> {
    const { rows } = await pool.query('SELECT to_regclass($1) AS t', [name]);
    return rows[0].t !== null;
  }

  it('applies pending .sql files in filename order and records them', async () => {
    await writeFile(
      path.join(dir, '002_b.sql'),
      'CREATE TABLE migrate_probe_b (a_id int REFERENCES migrate_probe_a(id));',
    );
    await writeFile(path.join(dir, '001_a.sql'), 'CREATE TABLE migrate_probe_a (id int PRIMARY KEY);');
    await writeFile(path.join(dir, 'README.md'), 'not a migration');

    const applied = await migrate(pool, { dir, table: TABLE });

    expect(applied).toEqual(['001_a.sql', '002_b.sql']);
    expect(await tableExists('migrate_probe_b')).toBe(true);
  });

  it('skips migrations that were already applied', async () => {
    await writeFile(path.join(dir, '001_a.sql'), 'CREATE TABLE migrate_probe_a (id int PRIMARY KEY);');
    await migrate(pool, { dir, table: TABLE });

    expect(await migrate(pool, { dir, table: TABLE })).toEqual([]);
  });

  it('rolls back a failing migration completely and stops', async () => {
    await writeFile(
      path.join(dir, '001_a.sql'),
      'CREATE TABLE migrate_probe_a (id int PRIMARY KEY); SELECT * FROM no_such_table;',
    );
    await writeFile(path.join(dir, '002_b.sql'), 'CREATE TABLE migrate_probe_b (id int);');

    await expect(migrate(pool, { dir, table: TABLE })).rejects.toThrow(/001_a\.sql/);

    expect(await tableExists('migrate_probe_a')).toBe(false);
    expect(await tableExists('migrate_probe_b')).toBe(false);
  });

  it('is safe when two processes migrate at once', async () => {
    await writeFile(path.join(dir, '001_a.sql'), 'CREATE TABLE migrate_probe_a (id int PRIMARY KEY);');

    const [first, second] = await Promise.all([
      migrate(pool, { dir, table: TABLE }),
      migrate(pool, { dir, table: TABLE }),
    ]);

    expect([...first, ...second]).toEqual(['001_a.sql']);
  });
});
