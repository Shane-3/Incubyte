import { AuthService } from '../../src/services/auth.service';
import { EmailTakenError, InvalidCredentialsError } from '../../src/errors';
import { FakePasswordHasher, FakeTokenService, InMemoryUserRepository } from '../helpers/fakes';

function setup() {
  const users = new InMemoryUserRepository();
  const hasher = new FakePasswordHasher();
  const tokens = new FakeTokenService();
  const service = new AuthService(users, hasher, tokens);
  return { users, hasher, tokens, service };
}

const priya = { name: 'Priya Nair', email: 'priya.nair@example.com', password: 'S3curePass!' };

describe('AuthService.register', () => {
  it('stores a hashed password, never the plain text', async () => {
    const { users, service } = setup();

    await service.register(priya);

    const stored = await users.findByEmail(priya.email);
    expect(stored?.passwordHash).toBe('hashed:S3curePass!');
  });

  it('returns the public user without the password hash', async () => {
    const { service } = setup();

    const user = await service.register(priya);

    expect(user).toEqual({
      id: expect.any(String),
      name: 'Priya Nair',
      email: 'priya.nair@example.com',
      role: 'user',
    });
    expect(user).not.toHaveProperty('passwordHash');
  });

  it('normalises the email to trimmed lowercase', async () => {
    const { service } = setup();

    const user = await service.register({ ...priya, email: '  Priya.Nair@Example.COM ' });

    expect(user.email).toBe('priya.nair@example.com');
  });

  it('always creates the account with role "user"', async () => {
    const { users, service } = setup();

    await service.register(priya);

    expect((await users.findByEmail(priya.email))?.role).toBe('user');
  });

  it('rejects an email that is already registered, ignoring case', async () => {
    const { service } = setup();
    await service.register(priya);

    await expect(service.register({ ...priya, email: 'PRIYA.NAIR@example.com' })).rejects.toBeInstanceOf(
      EmailTakenError,
    );
  });
});

describe('AuthService.login', () => {
  it('returns the public user and a signed token for valid credentials', async () => {
    const { service } = setup();
    const registered = await service.register(priya);

    const result = await service.login({ email: priya.email, password: priya.password });

    expect(result.user).toEqual(registered);
    expect(result.token).toBe(`token:${registered.id}:user`);
  });

  it('matches the email case-insensitively', async () => {
    const { service } = setup();
    await service.register(priya);

    const result = await service.login({ email: ' PRIYA.NAIR@example.com', password: priya.password });

    expect(result.user.email).toBe(priya.email);
  });

  it('carries the admin role into the token for admins', async () => {
    const { users, service } = setup();
    const admin = users.seed({ email: 'ops@example.com', role: 'admin', passwordHash: 'hashed:Adm1nPass!' });

    const result = await service.login({ email: 'ops@example.com', password: 'Adm1nPass!' });

    expect(result.token).toBe(`token:${admin.id}:admin`);
  });

  it('rejects a wrong password with InvalidCredentialsError', async () => {
    const { service } = setup();
    await service.register(priya);

    await expect(service.login({ email: priya.email, password: 'wrong-password' })).rejects.toBeInstanceOf(
      InvalidCredentialsError,
    );
  });

  it('rejects an unknown email with the same error as a wrong password', async () => {
    const { service } = setup();
    await service.register(priya);

    const unknown = service.login({ email: 'nobody@example.com', password: priya.password }).catch((e) => e);
    const wrong = service.login({ email: priya.email, password: 'wrong-password' }).catch((e) => e);

    const [unknownErr, wrongErr] = await Promise.all([unknown, wrong]);
    expect(unknownErr).toBeInstanceOf(InvalidCredentialsError);
    expect(unknownErr.message).toBe(wrongErr.message);
  });

  it('still runs a password compare for an unknown email, so timing does not reveal accounts', async () => {
    const { hasher, service } = setup();

    await service.login({ email: 'nobody@example.com', password: 'whatever1' }).catch(() => undefined);

    expect(hasher.compareCalls).toHaveLength(1);
  });
});
