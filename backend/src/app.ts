import cookieParser from 'cookie-parser';
import express, { type Express } from 'express';
import type { Config } from './config';
import { createAuthController } from './controllers/auth.controller';
import { authenticate } from './middleware/authenticate';
import { requireJsonBody, requireTrustedOrigin } from './middleware/csrf';
import { errorHandler, notFound } from './middleware/error-handler';
import { securityHeaders } from './middleware/security-headers';
import type { IUserRepository } from './repositories/user.repository';
import { authRoutes } from './routes/auth.routes';
import { AuthService } from './services/auth.service';
import type { IPasswordHasher } from './services/password-hasher';
import type { ITokenService } from './services/token.service';

export interface AppDeps {
  users: IUserRepository;
  hasher: IPasswordHasher;
  tokens: ITokenService;
  config: Pick<Config, 'env' | 'corsOrigin' | 'jwtExpiresInSeconds'>;
  /** Receives unexpected errors. Defaults to console.error outside tests. */
  logError?: (err: unknown) => void;
}

/** Composition root. Builds the Express app without listening, so tests can drive it with Supertest. */
export function createApp(deps: AppDeps): Express {
  const { config } = deps;
  const app = express();
  app.disable('x-powered-by');
  app.use(securityHeaders(config.env === 'production'));
  app.use(requireTrustedOrigin(config.corsOrigin));
  app.use(requireJsonBody);
  app.use(express.json({ limit: '10kb' }));
  app.use(cookieParser());

  const requireSession = authenticate(deps.tokens);
  const authService = new AuthService(deps.users, deps.hasher, deps.tokens);
  app.use('/api/auth', authRoutes(createAuthController(authService, config), requireSession));

  app.use(notFound);
  const logError = deps.logError ?? (config.env === 'test' ? () => undefined : console.error);
  app.use(errorHandler(logError));
  return app;
}
