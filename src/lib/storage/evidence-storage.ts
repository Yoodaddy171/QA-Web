import crypto from 'node:crypto';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { assertDurableEvidenceRoot, resolveEvidenceStorageRoot } from './evidence-storage-path.mjs';

export interface EvidenceStorage {
  put(stream: ReadableStream<Uint8Array>, key: string, maxBytes: number): Promise<{ key: string; size: number; hash: string }>;
  read(key: string): Promise<ReadableStream<Uint8Array>>;
  delete(key: string): Promise<void>;
}

export const evidenceStorageRoot = resolveEvidenceStorageRoot();
if (fs.existsSync(/*turbopackIgnore: true*/ evidenceStorageRoot)) assertDurableEvidenceRoot(fs.realpathSync(/*turbopackIgnore: true*/ evidenceStorageRoot));

function safeRelativeKey(key: string) {
  const normalized = key.replaceAll('\\', '/').replace(/^\/+/, '');
  if (!normalized || normalized.split('/').some(part => part === '..')) throw new Error('Evidence storage key tidak valid.');
  return normalized;
}

export class LocalEvidenceStorage implements EvidenceStorage {
  constructor(private readonly root = evidenceStorageRoot) { assertDurableEvidenceRoot(root); }

  private resolveKey(key: string) {
    const absolute = path.isAbsolute(key) ? path.resolve(/*turbopackIgnore: true*/ key) : path.resolve(/*turbopackIgnore: true*/ this.root, safeRelativeKey(key));
    const relative = path.relative(this.root, absolute);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Evidence storage key berada di luar storage root.');
    return { absolute, key: relative.replaceAll('\\', '/') };
  }

  async put(stream: ReadableStream<Uint8Array>, key: string, maxBytes: number) {
    const resolved = this.resolveKey(key);
    await fsPromises.mkdir(path.dirname(resolved.absolute), { recursive: true });
    const hash = crypto.createHash('sha256');
    let size = 0;
    const meter = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        size += chunk.length;
        if (size > maxBytes) return callback(new Error(`Evidence melebihi batas ${maxBytes} byte.`));
        hash.update(chunk);
        callback(null, chunk);
      },
    });
    // Open before the cleanup block. EEXIST must never remove the previous file.
    const file = await fsPromises.open(resolved.absolute, 'wx');
    try {
      await pipeline(Readable.fromWeb(stream as never), meter, file.createWriteStream());
      if (!size) throw new Error('Evidence kosong.');
      return { key: resolved.key, size, hash: hash.digest('hex') };
    } catch (error) {
      await fsPromises.rm(resolved.absolute, { force: true }).catch(() => undefined);
      throw error;
    } finally {
      await file.close().catch(() => undefined);
    }
  }

  async read(key: string) {
    const { absolute } = this.resolveKey(key);
    await fsPromises.access(absolute, fs.constants.R_OK);
    return Readable.toWeb(fs.createReadStream(absolute)) as ReadableStream<Uint8Array>;
  }

  async delete(key: string) {
    const { absolute } = this.resolveKey(key);
    await fsPromises.rm(absolute, { force: true });
  }
}

export const evidenceStorage = new LocalEvidenceStorage();
