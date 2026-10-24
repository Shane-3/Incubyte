import { BcryptPasswordHasher } from '../../src/services/bcrypt-hasher';

// Low cost keeps the suite fast; production uses BCRYPT_ROUNDS (12).
const hasher = new BcryptPasswordHasher(4);

describe('BcryptPasswordHasher', () => {
  it('produces a salted bcrypt hash at the configured cost, not the plain text', async () => {
    const hash = await hasher.hash('S3curePass!');

    expect(hash).toMatch(/^\$2b\$04\$/);
    expect(hash).not.toContain('S3curePass!');
    expect(await hasher.hash('S3curePass!')).not.toBe(hash);
  });

  it('confirms the right password', async () => {
    const hash = await hasher.hash('S3curePass!');

    expect(await hasher.compare('S3curePass!', hash)).toBe(true);
  });

  it('refuses the wrong password', async () => {
    const hash = await hasher.hash('S3curePass!');

    expect(await hasher.compare('s3curepass!', hash)).toBe(false);
  });
});
