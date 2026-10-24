import type { ITokenService, TokenPayload } from './token.service';

export interface JwtTokenServiceOptions {
  secret: string;
  expiresInSeconds: number;
  /** Injected clock in milliseconds, so tests control expiry. */
  now?: () => number;
}

export class JwtTokenService implements ITokenService {
  constructor(private readonly options: JwtTokenServiceOptions) {}

  sign(_payload: TokenPayload): string {
    throw new Error('Not implemented');
  }

  verify(_token: string): TokenPayload {
    throw new Error('Not implemented');
  }
}
