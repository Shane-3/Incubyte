import type { Pool } from 'pg';
import type { IPasswordHasher } from '../services/password-hasher';

export interface AdminCredentials {
  email: string;
  password: string;
}

/** Creates or updates the bootstrap admin. The only way an admin account can come into existence. */
export async function seedAdmin(_pool: Pool, _hasher: IPasswordHasher, _input: AdminCredentials): Promise<void> {
  throw new Error('Not implemented');
}
