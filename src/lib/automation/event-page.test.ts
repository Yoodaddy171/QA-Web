import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readEventPage } from './event-page.mjs';
let root: string;
let file: string;
beforeEach(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), 'traceva-events-')); file = path.join(root, 'events.jsonl'); });
afterEach(async () => { await fs.rm(root, { recursive: true, force: true }); });
describe('incremental JSONL pages', () => {
  it('pages, reaches EOF and observes new appended UTF-8 events without duplication', async () => {
    await fs.writeFile(file, Array.from({ length: 1101 }, (_, i) => JSON.stringify({ id: i, text: 'Pengujian 日本語' })).join('\n') + '\n');
    const first = await readEventPage(file);
    expect(first.events).toHaveLength(500); expect(first.nextCursor).toBe(500); expect(first.hasMore).toBe(true);
    const second = await readEventPage(file, first.nextCursor);
    expect(second.events[0].id).toBe(500); expect(second.nextCursor).toBe(1000);
    const last = await readEventPage(file, second.nextCursor);
    expect(last.events).toHaveLength(101); expect(last.hasMore).toBe(false);
    expect((await readEventPage(file, last.nextCursor)).events).toEqual([]);
    await fs.appendFile(file, JSON.stringify({ id: 1101 }) + '\n');
    expect((await readEventPage(file, last.nextCursor)).events).toEqual([{ id: 1101 }]);
    expect((await readEventPage(file, 500)).events).toEqual(second.events);
  });
  it('does not consume a half-written final line, skips blanks/malformed JSON, and handles truncation', async () => {
    await fs.writeFile(file, '\n{"id":1}\ninvalid\n{"id":');
    expect(await readEventPage(file)).toMatchObject({ events: [{ id: 1 }], nextCursor: 2, hasMore: false });
    await fs.appendFile(file, '2}\n');
    expect((await readEventPage(file, 2)).events).toEqual([{ id: 2 }]);
    await fs.writeFile(file, '{"id":3}\n');
    expect((await readEventPage(file, 0)).events).toEqual([{ id: 3 }]);
  });
  it('returns an empty page for absent logs and cursors beyond EOF', async () => {
    expect(await readEventPage(file, 30)).toEqual({ events: [], nextCursor: 0, hasMore: false });
    await fs.writeFile(file, '{"id":1}\n');
    expect(await readEventPage(file, 100)).toEqual({ events: [], nextCursor: 1, hasMore: false });
  });
});
