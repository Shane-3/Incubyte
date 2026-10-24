import 'dotenv/config';
import { Pool } from 'pg';
import { createApp } from './app';
import { loadConfig } from './config';
import { PgUserRepository } from './repositories/pg-user.repository';
import { PgVehicleRepository } from './repositories/pg-vehicle.repository';
import { PgNotificationRepository } from './repositories/pg-notification.repository';
import { PgStockRepository } from './repositories/pg-stock.repository';
import { PgTransactionRunner } from './db/transaction';
import { BcryptPasswordHasher } from './services/bcrypt-hasher';
import { JwtTokenService } from './services/jwt-token.service';

const config = loadConfig(process.env);

const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 10,
  // Bounds runaway queries (a DoS control); see security.md section 9.
  statement_timeout: 5000,
});

const app = createApp({
  users: new PgUserRepository(pool),
  vehicles: new PgVehicleRepository(pool),
  stock: new PgStockRepository(),
  transactions: new PgTransactionRunner(pool),
  notifications: new PgNotificationRepository(pool),
  hasher: new BcryptPasswordHasher(config.bcryptRounds),
  tokens: new JwtTokenService({ secret: config.jwtSecret, expiresInSeconds: config.jwtExpiresInSeconds }),
  config,
});

const server = app.listen(config.port, () => {
  console.log(`API listening on http://localhost:${config.port} (${config.env})`);
});

function shutdown(): void {
  server.close(() => void pool.end());
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
