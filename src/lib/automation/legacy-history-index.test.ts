import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { legacyHistoryMetadata } from './legacy-history-index';

let root: string;
beforeEach(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), 'traceva-legacy-index-')); });
afterEach(async () => { vi.restoreAllMocks(); await fs.rm(root, { recursive: true, force: true }); });
const log = (source: string, timestamp = '2026-01-01') => JSON.stringify({ source, timestamp, message: 'Private content must not enter the index' });

it('HISTORY-INDEX: streams scoped JSONL, skips malformed lines and never reads foreign files', async () => {
  await fs.writeFile(path.join(root, 'own.current.jsonl'), `${log('manual-click')}\ninvalid\n\n${log('playwright', '2026-01-02')}\n`);
  await fs.writeFile(path.join(root, 'foreign.current.jsonl'), log('manual-click'));
  const stat = vi.spyOn(fs, 'stat');
  const read = vi.spyOn(fs, 'readFile');
  const result = await legacyHistoryMetadata(root, new Set(['own']));
  expect(result.items).toEqual([{ id: 'own', kind: 'current', count: 2, lastRunAt: '2026-01-02', hasManualCapture: true, hasAutomationRun: true }]);
  expect(stat.mock.calls.some(([file]) => String(file).includes('foreign'))).toBe(false);
  expect(read.mock.calls.some(([file]) => String(file).endsWith('.jsonl'))).toBe(false);
  const files = await fs.readdir(path.join(root, '.history-index-v1'));
  expect(files).toHaveLength(1);
  expect(await fs.readFile(path.join(root, '.history-index-v1', files[0]), 'utf8')).not.toContain('Private content');
});

it('HISTORY-INDEX: reuses unchanged metadata across process cache resets and refreshes changed/deleted files', async () => {
  const source = path.join(root, 'own.jsonl');
  await fs.writeFile(source, log('manual-click'));
  await legacyHistoryMetadata(root, new Set(['own']));
  vi.resetModules();
  const fresh = (await import('./legacy-history-index')).legacyHistoryMetadata;
  expect((await fresh(root, new Set(['own']))).items[0].count).toBe(1);
  await fs.appendFile(source, `\n${log('playwright', '2026-01-03')}`);
  expect((await fresh(root, new Set(['own']))).items[0]).toMatchObject({ count: 2, lastRunAt: '2026-01-03' });
  await fs.writeFile(source, log('playwright', '2026-01-04'));
  expect((await fresh(root, new Set(['own']))).items[0]).toMatchObject({ count: 1, hasManualCapture: false });
  await fs.unlink(source);
  expect((await fresh(root, new Set(['own']))).items).toEqual([]);
});

it('HISTORY-INDEX: empty authorization does no filesystem work', async () => {
  const read = vi.spyOn(fs, 'readdir');
  expect((await legacyHistoryMetadata(root, new Set())).items).toEqual([]);
  expect(read).not.toHaveBeenCalled();
});
