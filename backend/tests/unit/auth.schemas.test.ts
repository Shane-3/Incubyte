import { loginSchema, registerSchema } from '../../src/validators/auth.schemas';

const valid = { name: 'Priya Nair', email: 'priya.nair@example.com', password: 'S3curePass!' };

function failedFields(result: { success: boolean; error?: { issues: Array<{ path: PropertyKey[] }> } }) {
  return result.error?.issues.map((issue) => issue.path.join('.')) ?? [];
}

describe('registerSchema', () => {
  it('accepts a valid payload and trims the name and email', () => {
    const result = registerSchema.safeParse({ ...valid, name: '  Priya Nair ', email: ' priya.nair@example.com ' });

    expect(result.success).toBe(true);
    expect(result.data).toEqual(valid);
  });

  it('accepts names with accents, apostrophes and hyphens', () => {
    expect(registerSchema.safeParse({ ...valid, name: "Zoë O'Brien-Núñez" }).success).toBe(true);
  });

  it('reports every missing field', () => {
    expect(failedFields(registerSchema.safeParse({}))).toEqual(['name', 'email', 'password']);
  });

  it.each(['not-an-email', 'a@b', '@example.com'])('rejects the invalid email %s', (email) => {
    expect(failedFields(registerSchema.safeParse({ ...valid, email }))).toEqual(['email']);
  });

  it('rejects a password shorter than 8 characters', () => {
    expect(failedFields(registerSchema.safeParse({ ...valid, password: 'Sh0rt!' }))).toEqual(['password']);
  });

  it('rejects a password longer than 72 bytes, since bcrypt would silently truncate it', () => {
    const seventyFourBytes = 'é'.repeat(37);

    expect(failedFields(registerSchema.safeParse({ ...valid, password: seventyFourBytes }))).toEqual(['password']);
  });

  it.each(['password', 'password123', '12345678', 'qwerty123'])('rejects the common password %s', (password) => {
    expect(failedFields(registerSchema.safeParse({ ...valid, password }))).toEqual(['password']);
  });

  it.each(['<script>alert(1)</script>', 'Priya\u0000Nair', ''])('rejects the unsafe or empty name %j', (name) => {
    expect(failedFields(registerSchema.safeParse({ ...valid, name }))).toEqual(['name']);
  });

  it('rejects unknown fields, so a client can never set its own role', () => {
    const result = registerSchema.safeParse({ ...valid, role: 'admin' });

    expect(result.success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('accepts an email and password', () => {
    expect(loginSchema.safeParse({ email: valid.email, password: valid.password }).success).toBe(true);
  });

  it('reports missing fields', () => {
    expect(failedFields(loginSchema.safeParse({}))).toEqual(['email', 'password']);
  });

  it('rejects unknown fields', () => {
    expect(loginSchema.safeParse({ email: valid.email, password: valid.password, role: 'admin' }).success).toBe(false);
  });

  it('caps the password length so oversized inputs never reach bcrypt', () => {
    expect(failedFields(loginSchema.safeParse({ email: valid.email, password: 'x'.repeat(73) }))).toEqual(['password']);
  });
});
