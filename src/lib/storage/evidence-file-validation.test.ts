import { describe, expect, it } from 'vitest';
import { detectEvidenceMime } from './evidence-file-validation';

describe('evidence magic-byte validation', () => {
  it.each([
    ['png', [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 'image/png'],
    ['jpeg', [0xff, 0xd8, 0xff, 0xe0], 'image/jpeg'],
    ['pdf', [...Buffer.from('%PDF-1.7')], 'application/pdf'],
    ['webm', [0x1a, 0x45, 0xdf, 0xa3], 'video/webm'],
  ])('detects %s by content', (_name, bytes, expected) => {
    expect(detectEvidenceMime(Uint8Array.from(bytes as number[]))).toBe(expected);
  });

  it('rejects an executable renamed as an image', () => {
    expect(detectEvidenceMime(Uint8Array.from(Buffer.from('MZ fake png')))).toBeNull();
  });
});
