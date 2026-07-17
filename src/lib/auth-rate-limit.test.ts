import { describe, expect, it } from 'vitest';
import { clearLoginAttempts, consumeLoginAttempt } from './auth-rate-limit';

describe('login rate limiter', () => {
  it('blocks attempts beyond the configured window limit and resets explicitly', () => {
    const key = `test-${Date.now()}`;
    for (let index = 0; index < 5; index += 1) expect(consumeLoginAttempt(key, 1000).allowed).toBe(true);
    expect(consumeLoginAttempt(key, 1000).allowed).toBe(false);
    clearLoginAttempts(key);
    expect(consumeLoginAttempt(key, 1000).allowed).toBe(true);
  });
});
