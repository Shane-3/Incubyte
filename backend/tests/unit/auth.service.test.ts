import { AuthService } from '../../src/services/auth.service';
import { EmailTakenError } from '../../src/errors';
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

    await expect(
      service.register({ ...priya, email: 'PRIYA.NAIR@example.com' }),
    ).rejects.toBeInstanceOf(EmailTakenError);
  });
});
