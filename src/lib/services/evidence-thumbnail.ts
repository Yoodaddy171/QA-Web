const cache = new Map<string, Buffer>();
const pending = new Map<string, Promise<Buffer>>();
const waiters: Array<() => void> = [];
let running = 0;
let bytes = 0;
const MAX_CACHE_BYTES = 16 * 1024 * 1024;
async function acquire() {
  if (running >= 2) await new Promise<void>(resolve => waiters.push(resolve));
  else running++;
}
function release() { const next = waiters.shift(); if (next) next(); else running--; }

/** Auth must run before this cache lookup. Keys include immutable content hashes. */
export async function evidenceThumbnail(key: string, read: () => Promise<ReadableStream<Uint8Array>>) {
  const cached = cache.get(key);
  if (cached) { cache.delete(key); cache.set(key, cached); return cached; }
  const existing = pending.get(key); if (existing) return existing;
  if (pending.size >= 64) throw new Error('Thumbnail sedang sibuk. Buka gambar asli untuk melihat evidence.');
  const task = (async () => {
    await acquire();
    try {
      const { default: sharp } = await import('sharp');
      const reader = (await read()).getReader();
      const chunks: Uint8Array[] = []; let size = 0;
      try {
        while (true) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > 25 * 1024 * 1024) throw new Error('Evidence melebihi batas thumbnail.'); chunks.push(part.value); }
      } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
      const output = await sharp(Buffer.concat(chunks), { limitInputPixels: 40_000_000 }).rotate().resize({ width: 640, height: 360, fit: 'inside', withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
      if (output.length <= MAX_CACHE_BYTES) {
        cache.set(key, output); bytes += output.length;
        while (cache.size > 64 || bytes > MAX_CACHE_BYTES) { const first = cache.keys().next().value!; bytes -= cache.get(first)!.length; cache.delete(first); }
      }
      return output;
    } finally { release(); }
  })();
  pending.set(key, task);
  try { return await task; } finally { pending.delete(key); }
}
