import jwt from 'jsonwebtoken';
import { UnauthenticatedError } from '../errors';
import type { Role } from '../types/user';
import type { ITokenService, TokenPayload } from './token.service';

export interface JwtTokenServiceOptions {
  secret: string;
  expiresInSeconds: number;
  /** Injected clock in milliseconds, so tests control expiry. */
  now?: () => number;
}

const ALGORITHM = 'HS256';
const ROLES: readonly Role[] = ['user', 'admin'];

export class JwtTokenService implements ITokenService {
  private readonly now: () => number;

  constructor(private readonly options: JwtTokenServiceOptions) {
    this.now = options.now ?? Date.now;
  }

  sign({ sub, role }: TokenPayload): string {
    const iat = this.nowInSeconds();
    return jwt.sign({ sub, role, iat, exp: iat + this.options.expiresInSeconds }, this.options.secret, {
      algorithm: ALGORITHM,
    });
  }

  verify(token: string): TokenPayload {
    let claims: string | jwt.JwtPayload;
    try {
      // The algorithm list is pinned so "none" and algorithm-confusion tokens are refused.
      claims = jwt.verify(token, this.options.secret, {
        algorithms: [ALGORITHM],
        clockTimestamp: this.nowInSeconds(),
      });
    } catch {
      throw new UnauthenticatedError();
    }

    if (typeof claims === 'string' || typeof claims.sub !== 'string' || !ROLES.includes(claims.role)) {
      throw new UnauthenticatedError();
    }
    return { sub: claims.sub, role: claims.role as Role };
  }

  private nowInSeconds(): number {
    return Math.floor(this.now() / 1000);
  }
}
