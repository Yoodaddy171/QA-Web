import { describe, expect, it } from 'vitest';
import { normalizeManualCaptureUrl } from './devlog-client';

describe('normalizeManualCaptureUrl', () => {
  it('adds HTTPS to a domain without a protocol', () => {
    expect(normalizeManualCaptureUrl('sarinah-ecom2025.unictive.net'))
      .toBe('https://sarinah-ecom2025.unictive.net/');
  });

  it('keeps an HTTP URL and rejects unsupported protocols', () => {
    expect(normalizeManualCaptureUrl('http://localhost:3000/path'))
      .toBe('http://localhost:3000/path');
    expect(() => normalizeManualCaptureUrl('ftp://example.com'))
      .toThrow('URL target harus menggunakan http:// atau https://.');
  });
});
