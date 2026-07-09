import { describe, expect, it } from 'vitest';
import { isLocalHostname, maskSecret, updateEnvText } from './ai-settings';

describe('AI settings', () => {
  it('masks secrets and preserves unrelated environment values', () => {
    expect(maskSecret('secret-1234')).toBe('Configured (...1234)');
    expect(maskSecret()).toBe('Not configured');
    expect(updateEnvText('DATABASE_URL="file:test.db"\nGROQ_API_KEY="old"\n', {
      GROQ_API_KEY: 'new-key',
      AI_PROVIDER: 'groq',
    })).toBe('DATABASE_URL="file:test.db"\nGROQ_API_KEY="new-key"\nAI_PROVIDER="groq"\n');
  });

  it('only allows API key reveal on loopback hosts', () => {
    expect(isLocalHostname('localhost')).toBe(true);
    expect(isLocalHostname('127.0.0.1')).toBe(true);
    expect(isLocalHostname('example.com')).toBe(false);
  });
});
