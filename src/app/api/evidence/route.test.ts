import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { runDirectory, writeJson } from '@/lib/automation/script-store.mjs';

const mocks = vi.hoisted(() => ({ record: vi.fn(), scope: vi.fn() }));
vi.mock('@/lib/db', () => ({ db: { testCase: { findFirst: mocks.record } } }));
vi.mock('@/lib/devlog-db', () => ({ devlogDb: null }));
vi.mock('@/lib/automation/script-auth', () => ({ authorizeScriptRequest: mocks.scope }));
import { GET } from './route';

let root: string;
const runId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'traceva-evidence-response-'));
  mocks.record.mockResolvedValue({ id: 'c', projectId: 'p', testCaseId: 'QA-001', status: 'FAILED', page: 'Page',
    testType: 'Negative', testAction: 'Synthetic export', steps: 'Synthetic steps', expectedResult: 'Expected',
    createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01'), project: { name: 'Synthetic' } });
  mocks.scope.mockResolvedValue({ root, projectId: 'p', testCaseId: 'c' });
});
afterEach(async () => { vi.restoreAllMocks(); await fs.rm(root, { recursive: true, force: true }); });

it('EVIDENCE-MEMORY: actual endpoint preserves selected-run standalone HTML and download headers', async () => {
  const directory = runDirectory(root, 'p', 'c', runId);
  await fs.mkdir(path.join(directory, 'artifacts'), { recursive: true });
  const video = Buffer.alloc(150001, 29);
  const file = path.join(directory, 'artifacts', 'video.webm');
  await fs.writeFile(file, video);
  await fs.writeFile(path.join(directory, 'events.jsonl'), '');
  await writeJson(path.join(directory, 'run.json'), { runId, projectId: 'p', testCaseId: 'c', createdAt: '2026-01-01',
    artifacts: [{ id: 'v', file: 'video.webm', kind: 'video' }] });
  const read = vi.spyOn(fs, 'readFile');
  const response = await GET(new NextRequest(`http://localhost/api/evidence?projectId=p&testCaseId=c&source=studio&runId=${runId}&download=1`));
  expect(response.status).toBe(200);
  expect(response.headers.get('Content-Disposition')).toBe('attachment; filename="qa-evidence-QA-001.html"');
  const html = await response.text();
  expect(html).toContain(`data:video/webm;base64,${video.toString('base64')}`);
  expect(html).toContain('QA-001');
  expect(html).not.toContain('TRACEVA_VIDEO_');
  expect(read.mock.calls.some(([target]) => String(target) === file)).toBe(false);
});
