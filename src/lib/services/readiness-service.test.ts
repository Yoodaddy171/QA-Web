import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { browserCandidates, checkWritableStorage } from './readiness-service';

const cleanup: string[] = [];

afterEach(async () => {
  await Promise.all(cleanup.splice(0).map(directory => fs.rm(directory, { recursive: true, force: true })));
});

describe('system readiness helpers', () => {
  it('prioritizes explicitly configured browser paths', () => {
    const candidates = browserCandidates({ CHROME_PATH: 'C:\\tools\\chrome.exe', EDGE_PATH: 'C:\\tools\\edge.exe' }, 'win32');
    expect(candidates.slice(0, 2)).toEqual(['C:\\tools\\chrome.exe', 'C:\\tools\\edge.exe']);
  });

  it('verifies storage by writing and removing a probe', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'qa-readiness-'));
    cleanup.push(directory);
    const result = await checkWritableStorage('storage', 'Storage', directory);
    expect(result.status).toBe('ready');
    expect(await fs.readdir(directory)).toEqual([]);
  });
});
