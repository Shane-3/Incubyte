import type { Pool } from 'pg';
import { isPgError, isUuid, PG_UNIQUE_VIOLATION } from '../db/errors';
import { EmailTakenError } from '../errors';
import type { NewUser, Role, User } from '../types/user';
import type { IUserRepository } from './user.repository';

interface UserRow {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: Role;
  created_at: Date;
}

const COLUMNS = 'id, name, email, password_hash, role, created_at';

function toUser(row: UserRow): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash,
    role: row.role,
    createdAt: row.created_at,
  };
}

export class PgUserRepository implements IUserRepository {
  constructor(private readonly pool: Pool) {}

  async findByEmail(email: string): Promise<User | null> {
    const { rows } = await this.pool.query<UserRow>(`SELECT ${COLUMNS} FROM users WHERE email = $1`, [email]);
    return rows[0] ? toUser(rows[0]) : null;
  }

  async findById(id: string): Promise<User | null> {
    if (!isUuid(id)) return null;
    const { rows } = await this.pool.query<UserRow>(`SELECT ${COLUMNS} FROM users WHERE id = $1`, [id]);
    return rows[0] ? toUser(rows[0]) : null;
  }

  async create({ name, email, passwordHash, role }: NewUser): Promise<User> {
    try {
      const { rows } = await this.pool.query<UserRow>(
        `INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING ${COLUMNS}`,
        [name, email, passwordHash, role],
      );
      return toUser(rows[0]!);
    } catch (err) {
      if (isPgError(err, PG_UNIQUE_VIOLATION, 'users_email_key')) {
        throw new EmailTakenError();
      }
      throw err;
    }
  }
}
