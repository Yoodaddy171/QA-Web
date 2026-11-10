import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { runDirectory, writeJson } from './script-store.mjs';
import { studioReportSource } from './studio-report';
let root: string;
const first = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const second = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
async function seed(id: string, message: string) {
  const dir = runDirectory(root, 'p', 'c', id);
  await fs.mkdir(path.join(dir, 'artifacts'), { recursive: true });
  await fs.writeFile(path.join(dir, 'artifacts', 'video.webm'), `synthetic-${message}`);
  await fs.writeFile(path.join(dir, 'events.jsonl'), JSON.stringify({ log: message, isConsole: true }) + '\n');
  await writeJson(path.join(dir, 'run.json'), { runId: id, projectId: 'p', testCaseId: 'c', createdAt: '2026-01-01', artifacts: [{ id: 'v', file: 'video.webm', kind: 'video' }] });
  return dir;
}
beforeEach(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), 'traceva-studio-report-')); });
afterEach(async () => { await fs.rm(root, { recursive: true, force: true }); });
describe('selected-run report source', () => {
  it('exports the explicitly selected older run, never the newer testcase result', async () => {
    await seed(first, 'older selected'); await seed(second, 'newer unselected');
    const result = await studioReportSource(root, 'p', 'c', first, 'v');
    expect(result.raw).toContain('older selected'); expect(result.raw).not.toContain('newer'); expect(result.recording.metadata.sessionId).toBe(first);
  });
  it('rejects foreign project, case, missing run and missing video instead of silently falling back', async () => {
    await seed(first, 'selected');
    await expect(studioReportSource(root, 'other', 'c', first)).rejects.toMatchObject({ status: 404 });
    await expect(studioReportSource(root, 'p', 'other', first)).rejects.toMatchObject({ status: 404 });
    await expect(studioReportSource(root, 'p', 'c', second)).rejects.toMatchObject({ status: 404 });
    await expect(studioReportSource(root, 'p', 'c', first, 'absent')).rejects.toMatchObject({ status: 404 });
  });
  it('refuses an artifact path outside its selected run', async () => {
    const dir = await seed(first, 'selected'); const outside = path.join(root, 'outside.webm'); await fs.writeFile(outside, 'not an artifact');
    await writeJson(path.join(dir, 'run.json'), { runId: first, projectId: 'p', testCaseId: 'c', artifacts: [{ id: 'v', kind: 'video', file: outside }] });
    await expect(studioReportSource(root, 'p', 'c', first, 'v')).rejects.toMatchObject({ status: 403 });
  });
});
