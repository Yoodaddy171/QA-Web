import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { evidenceThumbnail } from './evidence-thumbnail';
describe('bounded evidence thumbnails', () => {
  it('produces a small WebP without modifying the original upload', async () => {
    const original = await sharp({ create: { width: 2000, height: 1000, channels: 3, background: '#334455' } }).png().toBuffer();
    const copy = Buffer.from(original);
    const output = await evidenceThumbnail(crypto.randomUUID(), async () => new Blob([new Uint8Array(original)]).stream());
    const meta = await sharp(output).metadata(); expect(meta.format).toBe('webp'); expect(meta.width).toBe(640); expect(meta.height).toBe(320); expect(original.equals(copy)).toBe(true);
  });
  it('deduplicates concurrent decodes and caches by immutable content identity', async () => {
    const original = await sharp({ create: { width: 20, height: 10, channels: 3, background: '#334455' } }).png().toBuffer();
    let reads = 0; const key = crypto.randomUUID(); const read = async () => { reads++; return new Blob([new Uint8Array(original)]).stream(); };
    const [first, second] = await Promise.all([evidenceThumbnail(key, read), evidenceThumbnail(key, read)]);
    expect(first.equals(second)).toBe(true); await evidenceThumbnail(key, read); expect(reads).toBe(1);
    await evidenceThumbnail(key + ':replaced', read); expect(reads).toBe(2);
  });
});
