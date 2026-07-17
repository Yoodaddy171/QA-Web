import { describe, expect, it } from 'vitest';
import { isLocalHostname, maskSecret, normalizeLocalOllamaUrl } from './ai-settings';

describe('AI settings', () => {
  it('masks secrets without exposing plaintext values', () => {
    expect(maskSecret('secret-1234')).toBe('Configured (...1234)');
    expect(maskSecret()).toBe('Not configured');
  });

  it('only allows API key reveal on loopback hosts', () => {
    expect(isLocalHostname('localhost')).toBe(true);
    expect(isLocalHostname('127.0.0.1')).toBe(true);
    expect(isLocalHostname('example.com')).toBe(false);
  });

  it('only accepts loopback Ollama endpoints', () => {
    expect(normalizeLocalOllamaUrl('http://127.0.0.1:11434/')).toBe('http://127.0.0.1:11434');
    expect(normalizeLocalOllamaUrl('http://localhost:11434')).toBe('http://localhost:11434');
    expect(() => normalizeLocalOllamaUrl('http://169.254.169.254/latest')).toThrow(/hanya boleh/);
    expect(() => normalizeLocalOllamaUrl('https://ollama.example.com')).toThrow(/hanya boleh/);
  });
});
