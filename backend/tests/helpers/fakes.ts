import { randomUUID } from 'node:crypto';
import { UnauthenticatedError } from '../../src/errors';
import type { NewUser, User } from '../../src/types/user';
import type { IUserRepository } from '../../src/repositories/user.repository';
import type { IPasswordHasher } from '../../src/services/password-hasher';
import type { ITokenService, TokenPayload } from '../../src/services/token.service';

export class InMemoryUserRepository implements IUserRepository {
  private readonly users = new Map<string, User>();

  async findByEmail(email: string): Promise<User | null> {
    return [...this.users.values()].find((u) => u.email === email) ?? null;
  }

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) ?? null;
  }

  async create(input: NewUser): Promise<User> {
    const user: User = { id: randomUUID(), createdAt: new Date(), ...input };
    this.users.set(user.id, user);
    return user;
  }

  size(): number {
    return this.users.size;
  }

  /** Test-only: insert a user directly, e.g. an admin. */
  seed(user: Partial<User> & Pick<User, 'email'>): User {
    const full: User = {
      id: randomUUID(),
      name: 'Seeded User',
      passwordHash: 'hashed:Password123!',
      role: 'user',
      createdAt: new Date(),
      ...user,
    };
    this.users.set(full.id, full);
    return full;
  }
}

/** Deterministic hasher: "hashed:<plain>". Records compare calls so timing-equalisation can be asserted. */
export class FakePasswordHasher implements IPasswordHasher {
  readonly compareCalls: Array<{ plain: string; hash: string }> = [];

  async hash(plain: string): Promise<string> {
    return `hashed:${plain}`;
  }

  async compare(plain: string, hash: string): Promise<boolean> {
    this.compareCalls.push({ plain, hash });
    return hash === `hashed:${plain}`;
  }
}

export class FakeTokenService implements ITokenService {
  sign(payload: TokenPayload): string {
    return `token:${payload.sub}:${payload.role}`;
  }

  verify(token: string): TokenPayload {
    const [prefix, sub, role] = token.split(':');
    if (prefix !== 'token' || !sub || (role !== 'user' && role !== 'admin')) {
      throw new UnauthenticatedError();
    }
    return { sub, role };
  }
}
