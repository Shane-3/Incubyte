import { randomUUID } from 'node:crypto';
import { EmailTakenError, InvalidCredentialsError } from '../errors';
import type { IUserRepository } from '../repositories/user.repository';
import type { PublicUser, User } from '../types/user';
import type { IPasswordHasher } from './password-hasher';
import type { ITokenService } from './token.service';

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface LoginResult {
  user: PublicUser;
  token: string;
}

export class AuthService {
  constructor(
    private readonly users: IUserRepository,
    private readonly hasher: IPasswordHasher,
    private readonly tokens: ITokenService,
  ) {}

  async register(input: RegisterInput): Promise<PublicUser> {
    const email = input.email.trim().toLowerCase();
    if (await this.users.findByEmail(email)) {
      throw new EmailTakenError();
    }

    const user = await this.users.create({
      name: input.name,
      email,
      passwordHash: await this.hasher.hash(input.password),
      role: 'user',
    });
    return toPublicUser(user);
  }

  async login(input: LoginInput): Promise<LoginResult> {
    const user = await this.users.findByEmail(input.email.trim().toLowerCase());

    // Compare against a dummy hash for unknown emails so response time does not reveal which accounts exist.
    const hash = user?.passwordHash ?? (await this.dummyHash());
    const passwordMatches = await this.hasher.compare(input.password, hash);
    if (!user || !passwordMatches) {
      throw new InvalidCredentialsError();
    }

    const token = this.tokens.sign({ sub: user.id, role: user.role });
    return { user: toPublicUser(user), token };
  }

  private dummyHashPromise?: Promise<string>;

  private dummyHash(): Promise<string> {
    this.dummyHashPromise ??= this.hasher.hash(randomUUID());
    return this.dummyHashPromise;
  }
}

export function toPublicUser({ id, name, email, role }: User): PublicUser {
  return { id, name, email, role };
}
