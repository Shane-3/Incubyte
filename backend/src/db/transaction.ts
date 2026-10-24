import type { Pool, QueryResult, QueryResultRow } from 'pg';

/** Anything that can run a parameterised query: the pool, or a client inside a transaction. */
export interface Queryable {
  query<R extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]): Promise<QueryResult<R>>;
}

export interface ITransactionRunner {
  /** Runs fn in one transaction: commits if it resolves, rolls back if it throws. */
  run<T>(fn: (tx: Queryable) => Promise<T>): Promise<T>;
}

export class PgTransactionRunner implements ITransactionRunner {
  constructor(private readonly pool: Pool) {}

  async run<T>(fn: (tx: Queryable) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
