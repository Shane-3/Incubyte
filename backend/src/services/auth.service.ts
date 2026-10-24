import type { IUserRepository } from '../repositories/user.repository';
import type { PublicUser } from '../types/user';
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

  async register(_input: RegisterInput): Promise<PublicUser> {
    throw new Error('Not implemented');
  }
}
