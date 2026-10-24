import type { RequestHandler } from 'express';
import type { IUserRepository } from '../repositories/user.repository';
import type { Role } from '../types/user';

export function requireRole(_users: IUserRepository) {
  return (_role: Role): RequestHandler =>
    async () => {
      throw new Error('Not implemented');
    };
}
