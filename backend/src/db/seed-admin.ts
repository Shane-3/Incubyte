import type { Pool } from 'pg';
import type { IPasswordHasher } from '../services/password-hasher';
import { registerSchema } from '../validators/auth.schemas';

export interface AdminCredentials {
  email: string;
  password: string;
}

/** Creates or updates the bootstrap admin. The only way an admin account can come into existence. */
export async function seedAdmin(pool: Pool, hasher: IPasswordHasher, input: AdminCredentials): Promise<void> {
  // Same rules as public registration, so the admin password is never weaker than a user's.
  const email = registerSchema.shape.email.safeParse(input.email);
  if (!email.success) {
    throw new Error('ADMIN_EMAIL must be a valid email address');
  }
  const password = registerSchema.shape.password.safeParse(input.password);
  if (!password.success) {
    throw new Error(`ADMIN_PASSWORD ${password.error.issues[0]?.message ?? 'is invalid'}`);
  }

  await pool.query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ('Administrator', $1, $2, 'admin')
     ON CONFLICT (email) DO UPDATE SET role = 'admin', password_hash = EXCLUDED.password_hash`,
    [email.data.toLowerCase(), await hasher.hash(password.data)],
  );
}
