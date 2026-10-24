import jwt from 'jsonwebtoken';
import { UnauthenticatedError } from '../../src/errors';
import { JwtTokenService } from '../../src/services/jwt-token.service';

const SECRET = 'test-secret-that-is-at-least-32-bytes-long!!';
const T0 = Date.UTC(2026, 9, 24, 12, 0, 0);

function makeService(now = () => T0, secret = SECRET) {
  return new JwtTokenService({ secret, expiresInSeconds: 3600, now });
}

function base64url(json: object): string {
  return Buffer.from(JSON.stringify(json)).toString('base64url');
}

describe('JwtTokenService', () => {
  it('round-trips the subject and role', () => {
    const service = makeService();

    const token = service.sign({ sub: 'user-1', role: 'admin' });

    expect(service.verify(token)).toEqual({ sub: 'user-1', role: 'admin' });
  });

  it('signs with HS256 and sets a one-hour expiry', () => {
    const token = makeService().sign({ sub: 'user-1', role: 'user' });

    const decoded = jwt.decode(token, { complete: true });
    expect(decoded?.header.alg).toBe('HS256');
    expect(decoded?.payload).toMatchObject({ iat: T0 / 1000, exp: T0 / 1000 + 3600 });
  });

  it('rejects a token signed with another secret', () => {
    const forged = jwt.sign({ sub: 'user-1', role: 'admin' }, 'some-other-secret-also-32-bytes-long!!', {
      algorithm: 'HS256',
    });

    expect(() => makeService().verify(forged)).toThrow(UnauthenticatedError);
  });

  it('rejects an unsigned "alg: none" token', () => {
    const unsigned = `${base64url({ alg: 'none', typ: 'JWT' })}.${base64url({
      sub: 'user-1',
      role: 'admin',
      iat: T0 / 1000,
    })}.`;

    expect(() => makeService().verify(unsigned)).toThrow(UnauthenticatedError);
  });

  it('rejects a token whose role claim was tampered with', () => {
    const service = makeService();
    const [header, , signature] = service.sign({ sub: 'user-1', role: 'user' }).split('.');
    const tampered = `${header}.${base64url({ sub: 'user-1', role: 'admin', iat: T0 / 1000, exp: T0 / 1000 + 3600 })}.${signature}`;

    expect(() => service.verify(tampered)).toThrow(UnauthenticatedError);
  });

  it('rejects an expired token', () => {
    const token = makeService().sign({ sub: 'user-1', role: 'user' });
    const anHourAndASecondLater = makeService(() => T0 + 3601 * 1000);

    expect(() => anHourAndASecondLater.verify(token)).toThrow(UnauthenticatedError);
  });

  it('rejects a validly signed token with an unknown role', () => {
    const odd = jwt.sign({ sub: 'user-1', role: 'superuser', iat: T0 / 1000 }, SECRET, { algorithm: 'HS256' });

    expect(() => makeService().verify(odd)).toThrow(UnauthenticatedError);
  });

  it('rejects garbage', () => {
    expect(() => makeService().verify('not-a-jwt')).toThrow(UnauthenticatedError);
  });
});
