import cookieParser from 'cookie-parser';
import express, { type Express } from 'express';
import type { Config } from './config';
import { createAuthController } from './controllers/auth.controller';
import { createNotificationController } from './controllers/notification.controller';
import { createVehicleController } from './controllers/vehicle.controller';
import type { ITransactionRunner } from './db/transaction';
import { jsonLogger, type Logger, silentLogger } from './logging/logger';
import { BackInStockHandler } from './handlers/back-in-stock.handler';
import { LowStockAlertHandler } from './handlers/low-stock-alert.handler';
import { authenticate } from './middleware/authenticate';
import { requireJsonBody, requireTrustedOrigin } from './middleware/csrf';
import { errorHandler, notFound } from './middleware/error-handler';
import { createRateLimiters, DEFAULT_RATE_LIMITS, type RateLimits } from './middleware/rate-limit';
import { requestLog } from './middleware/request-log';
import { requireRole } from './middleware/require-role';
import { securityHeaders } from './middleware/security-headers';
import type { INotificationRepository } from './repositories/notification.repository';
import type { ISalesRepository } from './repositories/sales.repository';
import type { IStockRepository } from './repositories/stock.repository';
import type { IUserRepository } from './repositories/user.repository';
import type { IVehicleRepository } from './repositories/vehicle.repository';
import type { IWatchRepository } from './repositories/watch.repository';
import { authRoutes } from './routes/auth.routes';
import { notificationRoutes } from './routes/notification.routes';
import { purchaseRoutes } from './routes/purchase.routes';
import { vehicleRoutes } from './routes/vehicle.routes';
import { AuthService } from './services/auth.service';
import { ForecastService } from './services/forecast.service';
import { NotificationService } from './services/notification.service';
import type { IPasswordHasher } from './services/password-hasher';
import { PurchaseService } from './services/purchase.service';
import { StockChangeService } from './services/stock-change.service';
import type { ITokenService } from './services/token.service';
import { VehicleService } from './services/vehicle.service';
import { WatchService } from './services/watch.service';
import type { IStockChangeHandler } from './types/stock';

export type AppConfig = Pick<
  Config,
  | 'env'
  | 'corsOrigin'
  | 'jwtExpiresInSeconds'
  | 'lowStockThreshold'
  | 'forecastWindowDays'
  | 'forecastAtRiskDays'
  | 'maxWatchesPerUser'
  | 'trustProxy'
>;

export interface AppDeps {
  users: IUserRepository;
  vehicles: IVehicleRepository;
  stock: IStockRepository;
  transactions: ITransactionRunner;
  notifications: INotificationRepository;
  sales: ISalesRepository;
  watches: IWatchRepository;
  hasher: IPasswordHasher;
  tokens: ITokenService;
  config: AppConfig;
  /** Rules run inside every stock change. Defaults to low-stock alerts and back-in-stock notices. */
  stockHandlers?: IStockChangeHandler[];
  /** Defaults to the limits in security.md; tests that are not about rate limiting raise them. */
  rateLimits?: RateLimits;
  /** Injected so forecast tests control "now". */
  clock?: () => Date;
  /** Structured request and error log. Defaults to JSON lines on stdout, silent in tests. */
  logger?: Logger;
}

/** Composition root. Builds the Express app without listening, so tests can drive it with Supertest. */
export function createApp(deps: AppDeps): Express {
  const { config } = deps;
  const app = express();
  app.disable('x-powered-by');
  const logger = deps.logger ?? (config.env === 'test' ? silentLogger : jsonLogger());
  app.use(requestLog(logger));
  // Only trust X-Forwarded-For when a known proxy sits in front, or clients could spoof their IP past the limits.
  app.set('trust proxy', config.trustProxy);
  const limiters = createRateLimiters(deps.rateLimits ?? DEFAULT_RATE_LIMITS);

  app.use(securityHeaders(config.env === 'production'));
  app.use('/api', limiters.api);
  app.use(requireTrustedOrigin(config.corsOrigin));
  app.use(requireJsonBody);
  app.use(express.json({ limit: '10kb' }));
  app.use(cookieParser());

  const requireSession = authenticate(deps.tokens);

  const authService = new AuthService(deps.users, deps.hasher, deps.tokens);
  app.use('/api/auth', authRoutes(createAuthController(authService, config), requireSession, limiters));

  const stockChanges = new StockChangeService(
    deps.transactions,
    deps.stock,
    deps.stockHandlers ?? [
      new LowStockAlertHandler(deps.notifications, config.lowStockThreshold),
      new BackInStockHandler(deps.notifications),
    ],
  );
  const clock = deps.clock ?? (() => new Date());
  const adminOnly = requireRole(deps.users)('admin');
  const vehicleService = new VehicleService(deps.vehicles, stockChanges);
  const watchService = new WatchService(deps.transactions, deps.watches, config.maxWatchesPerUser);
  const forecastService = new ForecastService(deps.sales, clock, {
    windowDays: config.forecastWindowDays,
    atRiskDays: config.forecastAtRiskDays,
  });
  app.use(
    '/api/vehicles',
    vehicleRoutes(createVehicleController(vehicleService, forecastService, watchService), {
      authenticate: requireSession,
      adminOnly,
      throttle: limiters.sensitive(),
    }),
  );

  app.use(
    '/api/purchases',
    purchaseRoutes(new PurchaseService(deps.sales, clock), { authenticate: requireSession, adminOnly }),
  );

  const notificationService = new NotificationService(deps.notifications);
  app.use(
    '/api/notifications',
    notificationRoutes(createNotificationController(notificationService), {
      authenticate: requireSession,
      throttle: limiters.sensitive(),
    }),
  );

  app.use(notFound);
  app.use(errorHandler(logger));
  return app;
}
