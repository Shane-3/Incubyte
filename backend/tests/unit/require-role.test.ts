import type { NextFunction, Request, Response } from 'express';
import { ForbiddenError, UnauthenticatedError } from '../../src/errors';
import { requireRole } from '../../src/middleware/require-role';
import type { Role } from '../../src/types/user';
import { InMemoryUserRepository } from '../helpers/fakes';

function setup() {
  const users = new InMemoryUserRepository();
  const guard = requireRole(users);
  const next = vi.fn<NextFunction>();
  const run = (user?: { id: string; role: Role }) => {
    const req = { user } as Request;
    return Promise.resolve(guard('admin')(req, {} as Response, next)).then(() => req);
  };
  return { users, next, run };
}

describe('requireRole("admin")', () => {
  it('lets an admin through', async () => {
    const { users, next, run } = setup();
    const admin = users.seed({ email: 'ops@example.com', role: 'admin' });

    await run({ id: admin.id, role: 'admin' });

    expect(next).toHaveBeenCalledOnce();
  });

  it('forbids a regular user', async () => {
    const { users, next, run } = setup();
    const user = users.seed({ email: 'priya@example.com', role: 'user' });

    await expect(run({ id: user.id, role: 'user' })).rejects.toBeInstanceOf(ForbiddenError);
    expect(next).not.toHaveBeenCalled();
  });

  it('forbids an admin who was demoted after the token was issued', async () => {
    const { users, next, run } = setup();
    const demoted = users.seed({ email: 'former-admin@example.com', role: 'user' });

    await expect(run({ id: demoted.id, role: 'admin' })).rejects.toBeInstanceOf(ForbiddenError);
    expect(next).not.toHaveBeenCalled();
  });

  it('forbids a token whose account no longer exists', async () => {
    const { next, run } = setup();

    await expect(run({ id: '00000000-0000-4000-8000-000000000000', role: 'admin' })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('requires authentication to have run first', async () => {
    const { next, run } = setup();

    await expect(run(undefined)).rejects.toBeInstanceOf(UnauthenticatedError);
    expect(next).not.toHaveBeenCalled();
  });
});
