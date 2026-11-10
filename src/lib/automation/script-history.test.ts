import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { caseDirectory, deleteScriptRuns, listRuns, runDirectory, writeJson } from './script-store.mjs';

let root: string;
const first = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const second = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
async function seed(id: string, status = 'FAILED', project = 'p', testcase = 'c') {
  const dir = runDirectory(root, project, testcase, id);
  await writeJson(path.join(dir, 'run.json'), { runId: id, projectId: project, testCaseId: testcase, status, artifacts: [] });
  await fs.writeFile(path.join(dir, 'events.jsonl'), 'synthetic events');
  await fs.mkdir(path.join(dir, 'artifacts'));
  await fs.writeFile(path.join(dir, 'artifacts', 'video.webm'), 'synthetic video');
  await writeJson(path.join(caseDirectory(root, project, testcase), 'history', `1-${id}.json`), { runId: id });
  return dir;
}
beforeEach(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), 'traceva-history-')); });
afterEach(async () => { vi.restoreAllMocks(); await fs.rm(root, { recursive: true, force: true }); });
describe('scoped Playwright history deletion', () => {
  it('deletes only selected run folders/pointers and preserves editor script, evidence and other runs', async () => {
    const dir = await seed(first); await seed(second, 'PASSED');
    const saved = path.join(caseDirectory(root, 'p', 'c'), 'script.json');
    await writeJson(saved, { script: 'saved script' });
    const evidence = path.join(root, 'evidence.png'); await fs.writeFile(evidence, 'separate evidence');
    expect(await deleteScriptRuns(root, 'p', 'c', [first])).toEqual({ deletedRunIds: [first], failedRunIds: [] });
    await expect(fs.stat(dir)).rejects.toMatchObject({ code: 'ENOENT' });
    expect((await listRuns(root, 'p', 'c')).map(run => run.runId)).toEqual([second]);
    expect(await fs.readFile(saved, 'utf8')).toContain('saved script');
    expect(await fs.readFile(evidence, 'utf8')).toBe('separate evidence');
  });
  it('deletes multiple explicitly selected terminal runs, including passed results', async () => {
    await seed(first); await seed(second, 'PASSED');
    expect((await deleteScriptRuns(root, 'p', 'c', [first, second])).deletedRunIds).toEqual([first, second]);
    expect(await listRuns(root, 'p', 'c')).toEqual([]);
  });
  it('reports partial filesystem failures without claiming the failed run was removed', async () => {
    await seed(first); await seed(second);
    const original = fs.rm.bind(fs);
    vi.spyOn(fs, 'rm').mockImplementation(async (file, options) => {
      if (String(file).endsWith(first)) throw new Error('synthetic disk failure');
      return original(file, options);
    });
    expect(await deleteScriptRuns(root, 'p', 'c', [first, second])).toEqual({ deletedRunIds: [second], failedRunIds: [first] });
    expect((await listRuns(root, 'p', 'c')).map(run => run.runId)).toEqual([first]);
  });
  it('does not let stale pointers hide retained older runs', async () => {
    await seed(first);
    for (let i = 0; i < 21; i++) await writeJson(path.join(caseDirectory(root, 'p', 'c'), 'history', `${100 + i}-${second}.json`), { runId: second });
    expect((await listRuns(root, 'p', 'c')).map(run => run.runId)).toEqual([first]);
  });
  it.each(['QUEUED', 'RUNNING', 'UNKNOWN'])('rejects entire batch containing %s without deleting a preceding terminal run', async status => {
    const dir = await seed(first); await seed(second, status);
    await expect(deleteScriptRuns(root, 'p', 'c', [first, second])).rejects.toMatchObject({ status: 409 });
    expect((await fs.stat(dir)).isDirectory()).toBe(true);
  });
  it('waits for the worker to remove the terminal queue pointer', async () => {
    await seed(first);
    await writeJson(path.join(root, 'queue', `1-${first}.json`), { runId: first, projectId: 'p', testCaseId: 'c' });
    await expect(deleteScriptRuns(root, 'p', 'c', [first])).rejects.toMatchObject({ status: 409 });
  });
  it('refuses absent or foreign runs before changing anything', async () => {
    const dir = await seed(first); await seed(second, 'FAILED', 'other');
    await expect(deleteScriptRuns(root, 'p', 'c', [first, second])).rejects.toMatchObject({ status: 404 });
    expect((await fs.stat(dir)).isDirectory()).toBe(true);
  });
  it.each([[], [first, first], ['../escape'], Array.from({ length: 21 }, () => first), null])('rejects malformed selection %j', async ids => {
    await expect(deleteScriptRuns(root, 'p', 'c', ids)).rejects.toMatchObject({ status: 400 });
  });
  it('rejects a linked case directory without touching its target', async () => {
    const target = path.join(root, 'outside'); await fs.mkdir(target);
    await fs.writeFile(path.join(target, 'keep.txt'), 'keep');
    const directory = caseDirectory(root, 'p', 'c'); await fs.mkdir(path.dirname(directory));
    await fs.symlink(target, directory, process.platform === 'win32' ? 'junction' : 'dir');
    await expect(deleteScriptRuns(root, 'p', 'c', [first])).rejects.toMatchObject({ status: 409 });
    expect(await fs.readFile(path.join(target, 'keep.txt'), 'utf8')).toBe('keep');
  });
});
