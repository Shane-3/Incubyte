import type { NewUser, User } from '../types/user';

export interface IUserRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  create(input: NewUser): Promise<User>;
}
