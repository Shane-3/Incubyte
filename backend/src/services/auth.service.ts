import { EmailTakenError } from '../errors';
import type { IUserRepository } from '../repositories/user.repository';
import type { PublicUser, User } from '../types/user';
import type { IPasswordHasher } from './password-hasher';
import type { ITokenService } from './token.service';

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
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
}

export function toPublicUser({ id, name, email, role }: User): PublicUser {
  return { id, name, email, role };
}
