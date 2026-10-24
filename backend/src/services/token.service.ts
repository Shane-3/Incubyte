import type { Role } from '../types/user';

export interface TokenPayload {
  sub: string;
  role: Role;
}

export interface ITokenService {
  sign(payload: TokenPayload): string;
  /** Throws when the token is malformed, tampered with or expired. */
  verify(token: string): TokenPayload;
}
