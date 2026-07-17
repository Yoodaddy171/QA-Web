import { describe, expect, it } from 'vitest';
import { hasMinimumRole, hashPassword, hashSessionToken, normalizeEmail, verifyPassword } from './auth';

describe('authentication primitives', () => {
  it('hashes passwords with a unique salt and verifies without storing plaintext', async () => {
    const first = await hashPassword('correct horse battery staple');
    const second = await hashPassword('correct horse battery staple');
    expect(first).not.toBe(second);
    expect(first).not.toContain('correct horse');
    await expect(verifyPassword('correct horse battery staple', first)).resolves.toBe(true);
    await expect(verifyPassword('wrong password', first)).resolves.toBe(false);
  });

  it('enforces the role hierarchy', () => {
    expect(hasMinimumRole('OWNER', 'ADMIN')).toBe(true);
    expect(hasMinimumRole('QA_LEAD', 'QA')).toBe(true);
    expect(hasMinimumRole('VIEWER', 'QA')).toBe(false);
    expect(hasMinimumRole('unknown', 'VIEWER')).toBe(false);
  });

  it('normalizes identities and hashes session tokens deterministically', () => {
    expect(normalizeEmail('  QA@Example.COM ')).toBe('qa@example.com');
    expect(hashSessionToken('secret')).toBe(hashSessionToken('secret'));
    expect(hashSessionToken('secret')).not.toBe(hashSessionToken('other'));
  });
});
