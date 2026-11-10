import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';

export type LegacyHistoryMeta = {
  id: string; kind: string; count: number; lastRunAt: string | null;
  hasManualCapture: boolean; hasAutomationRun: boolean;
};
type Entry = { version: 1; source: string; fingerprint: string; meta: LegacyHistoryMeta };
const cache = new Map<string, Entry>();
const pending = new Map<string, Promise<LegacyHistoryMeta | null>>();

function validEntry(value: Entry | null, source: string, fingerprint: string, id: string, kind: string): value is Entry {
  return value?.version === 1 && value.source === source && value.fingerprint === fingerprint &&
    value.meta?.id === id && value.meta.kind === kind && Number.isSafeInteger(value.meta.count) && value.meta.count >= 0 &&
    (value.meta.lastRunAt === null || typeof value.meta.lastRunAt === 'string') &&
    typeof value.meta.hasManualCapture === 'boolean' && typeof value.meta.hasAutomationRun === 'boolean';
}

async function fileMeta(directory: string, name: string, id: string, kind: string): Promise<LegacyHistoryMeta | null> {
  const source = path.join(directory, name);
  const stat = await fs.stat(source).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
  if (!stat?.isFile()) return null;
  const fingerprint = `${stat.size}:${stat.mtimeMs}:${stat.ctimeMs}`;
  const hit = cache.get(source);
  if (validEntry(hit || null, name, fingerprint, id, kind)) return hit!.meta;
  const key = `${source}:${fingerprint}`;
  const running = pending.get(key);
  if (running) return running;
  const task = (async () => {
    const index = path.join(directory, '.history-index-v1', `${createHash('sha256').update(name).digest('hex')}.json`);
    const saved: Entry | null = await fs.readFile(index, 'utf8').then(JSON.parse).catch(() => null);
    if (validEntry(saved, name, fingerprint, id, kind)) { remember(source, saved); return saved.meta; }
    const meta: LegacyHistoryMeta = { id, kind, count: 0, lastRunAt: null, hasManualCapture: false, hasAutomationRun: false };
    if (stat.size) {
      const stream = createReadStream(source, { start: 0, end: stat.size - 1, highWaterMark: 64 * 1024 });
      const lines = createInterface({ input: stream, crlfDelay: Infinity });
      try {
        for await (const line of lines) {
          if (!line.trim()) continue;
          let log;
          try { log = JSON.parse(line); } catch { continue; }
          if (!log || typeof log !== 'object') continue;
          meta.count++;
          meta.lastRunAt = typeof log.timestamp === 'string' ? log.timestamp : null;
          if (String(log.source || '').startsWith('manual-')) meta.hasManualCapture = true;
          else meta.hasAutomationRun = true;
        }
      } finally { lines.close(); stream.destroy(); }
    }
    const after = await fs.stat(source).catch(() => null);
    if (after && `${after.size}:${after.mtimeMs}:${after.ctimeMs}` === fingerprint) {
      const entry: Entry = { version: 1, source: name, fingerprint, meta };
      remember(source, entry);
      // An optional index must not turn a readable legacy capture into a failed request.
      const temp = `${index}.${randomUUID()}.tmp`;
      try { await fs.mkdir(path.dirname(index), { recursive: true }); await fs.writeFile(temp, JSON.stringify(entry), { mode: 0o600 }); await fs.rename(temp, index); }
      catch { /* Read-only storage can still serve the freshly streamed metadata. */ }
      finally { await fs.unlink(temp).catch(() => undefined); }
    }
    return meta;
  })();
  pending.set(key, task);
  try { return await task; } finally { pending.delete(key); }
}

function remember(key: string, entry: Entry) {
  cache.delete(key); cache.set(key, entry);
  if (cache.size > 2048) cache.delete(cache.keys().next().value!);
}

export async function legacyHistoryMetadata(directory: string, authorizedIds: Set<string>) {
  if (!authorizedIds.size) return { files: new Set<string>(), items: [] as LegacyHistoryMeta[] };
  const names: string[] = await fs.readdir(directory).catch(error => { if (error.code === 'ENOENT') return []; throw error; });
  const files = names.flatMap(name => {
    const match = name.match(/^(.+?)(?:\.(current|previous))?\.jsonl$/);
    return match && authorizedIds.has(match[1]) ? [{ name, id: match[1], kind: match[2] || 'legacy' }] : [];
  });
  const rows: Array<LegacyHistoryMeta | null> = Array(files.length).fill(null);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(8, files.length) }, async () => {
    while (next < files.length) {
      const position = next++;
      const file = files[position];
      rows[position] = await fileMeta(directory, file.name, file.id, file.kind);
    }
  }));
  return { files: new Set(files.map(file => file.name)), items: rows.filter((row): row is LegacyHistoryMeta => Boolean(row?.count)) };
}
