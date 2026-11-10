import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { caseDirectory, indexedStudioCaseIds, registerStudioCase, runDirectory, writeJson } from './script-store.mjs';
import { studioHistorySummaries } from './studio-history';
let root: string;
const runId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
beforeEach(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), 'traceva-studio-index-')); });
afterEach(async () => { vi.restoreAllMocks(); await fs.rm(root, { recursive: true, force: true }); });
describe('per-project Studio index', () => {
  it('scans legacy case folders once, not on every request', async () => {
    const ids = Array.from({ length: 1000 }, (_, i) => `c${i}`);
    const read = vi.spyOn(fs, 'readdir'); await indexedStudioCaseIds(root, 'p', ids);
    expect(read.mock.calls.filter(([file]) => String(file).endsWith(`${path.sep}history`))).toHaveLength(1000);
    read.mockClear(); expect(await indexedStudioCaseIds(root, 'p', ids)).toEqual([]);
    expect(read.mock.calls.filter(([file]) => String(file).endsWith(`${path.sep}history`))).toHaveLength(0);
  });
  it('discovers old history and keeps newly registered cases visible after bootstrap', async () => {
    await writeJson(path.join(runDirectory(root, 'p', 'old', runId), 'run.json'), { runId, projectId: 'p', testCaseId: 'old', status: 'FAILED', createdAt: '2026-01-01', artifacts: [] });
    await writeJson(path.join(caseDirectory(root, 'p', 'old'), 'history', `1-${runId}.json`), { runId });
    expect(await indexedStudioCaseIds(root, 'p', ['old', 'new'])).toEqual(['old']);
    await Promise.all([registerStudioCase(root, 'p', 'new'), registerStudioCase(root, 'p', 'other')]);
    expect((await indexedStudioCaseIds(root, 'p', ['old', 'new'])).sort()).toEqual(['new', 'old']);
    expect(await indexedStudioCaseIds(root, 'foreign', ['old', 'new'])).toEqual([]);
  });
  it('does not resurrect a deleted run from retained case markers', async () => {
    await indexedStudioCaseIds(root, 'p', ['c']); await registerStudioCase(root, 'p', 'c');
    expect((await studioHistorySummaries(root, 'p', ['c'])).size).toBe(0);
  });
});
