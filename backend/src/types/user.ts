export type Role = 'user' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  createdAt: Date;
}

export type NewUser = Pick<User, 'name' | 'email' | 'passwordHash' | 'role'>;

/** The shape of a user that may leave the server. Never includes the password hash. */
export type PublicUser = Pick<User, 'id' | 'name' | 'email' | 'role'>;
