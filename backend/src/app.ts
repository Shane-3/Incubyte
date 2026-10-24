import express, { type Express } from 'express';
import type { Config } from './config';
import type { IUserRepository } from './repositories/user.repository';
import type { IPasswordHasher } from './services/password-hasher';
import type { ITokenService } from './services/token.service';

export interface AppDeps {
  users: IUserRepository;
  hasher: IPasswordHasher;
  tokens: ITokenService;
  config: Pick<Config, 'env' | 'corsOrigin' | 'jwtExpiresInSeconds'>;
}

/** Composition root. Builds the Express app without listening, so tests can drive it with Supertest. */
export function createApp(_deps: AppDeps): Express {
  return express();
}
