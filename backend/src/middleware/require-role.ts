import type { RequestHandler } from 'express';
import { ForbiddenError, UnauthenticatedError } from '../errors';
import type { IUserRepository } from '../repositories/user.repository';
import type { Role } from '../types/user';

/**
 * Role guard for use after authenticate. The token's role is not trusted on its own:
 * the role is re-read from the database so demoted or deleted accounts lose access immediately.
 */
export function requireRole(users: IUserRepository) {
  return (role: Role): RequestHandler =>
    async (req, _res, next) => {
      if (!req.user) {
        throw new UnauthenticatedError();
      }
      const current = await users.findById(req.user.id);
      if (req.user.role !== role || current?.role !== role) {
        throw new ForbiddenError();
      }
      next();
    };
}
