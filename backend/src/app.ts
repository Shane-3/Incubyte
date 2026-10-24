import cookieParser from 'cookie-parser';
import express, { type Express } from 'express';
import type { Config } from './config';
import { createAuthController } from './controllers/auth.controller';
import { createVehicleController } from './controllers/vehicle.controller';
import { authenticate } from './middleware/authenticate';
import { requireJsonBody, requireTrustedOrigin } from './middleware/csrf';
import { errorHandler, notFound } from './middleware/error-handler';
import { requireRole } from './middleware/require-role';
import { securityHeaders } from './middleware/security-headers';
import type { ITransactionRunner } from './db/transaction';
import type { INotificationRepository } from './repositories/notification.repository';
import type { IStockRepository } from './repositories/stock.repository';
import type { IUserRepository } from './repositories/user.repository';
import type { IVehicleRepository } from './repositories/vehicle.repository';
import { authRoutes } from './routes/auth.routes';
import { vehicleRoutes } from './routes/vehicle.routes';
import { AuthService } from './services/auth.service';
import type { IPasswordHasher } from './services/password-hasher';
import type { ITokenService } from './services/token.service';
import type { IStockChangeHandler } from './types/stock';
import { StockChangeService } from './services/stock-change.service';
import { VehicleService } from './services/vehicle.service';

export type AppConfig = Pick<Config, 'env' | 'corsOrigin' | 'jwtExpiresInSeconds' | 'lowStockThreshold'>;

export interface AppDeps {
  users: IUserRepository;
  vehicles: IVehicleRepository;
  stock: IStockRepository;
  transactions: ITransactionRunner;
  /** Rules run inside every stock change (low-stock alerts, back-in-stock). */
  stockHandlers?: IStockChangeHandler[];
  hasher: IPasswordHasher;
  tokens: ITokenService;
  notifications: INotificationRepository;
  config: AppConfig;
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

  const stockChanges = new StockChangeService(deps.transactions, deps.stock, deps.stockHandlers ?? []);
  const vehicleService = new VehicleService(deps.vehicles, stockChanges);
  app.use(
    '/api/vehicles',
    vehicleRoutes(createVehicleController(vehicleService), {
      authenticate: requireSession,
      adminOnly: requireRole(deps.users)('admin'),
    }),
  );

  app.use(notFound);
  const logError = deps.logError ?? (config.env === 'test' ? () => undefined : console.error);
  app.use(errorHandler(logError));
  return app;
}
