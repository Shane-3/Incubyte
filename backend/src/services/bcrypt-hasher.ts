import type { IPasswordHasher } from './password-hasher';

export class BcryptPasswordHasher implements IPasswordHasher {
  constructor(private readonly rounds: number) {}

  async hash(_plain: string): Promise<string> {
    throw new Error('Not implemented');
  }

  async compare(_plain: string, _hash: string): Promise<boolean> {
    throw new Error('Not implemented');
  }
}
