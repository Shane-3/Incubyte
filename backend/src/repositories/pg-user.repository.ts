import type { Pool } from 'pg';
import type { NewUser, User } from '../types/user';
import type { IUserRepository } from './user.repository';

export class PgUserRepository implements IUserRepository {
  constructor(private readonly pool: Pool) {}

  async findByEmail(_email: string): Promise<User | null> {
    throw new Error('Not implemented');
  }

  async findById(_id: string): Promise<User | null> {
    throw new Error('Not implemented');
  }

  async create(_input: NewUser): Promise<User> {
    throw new Error('Not implemented');
  }
}
