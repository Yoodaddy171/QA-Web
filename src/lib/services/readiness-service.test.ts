import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { browserCandidates, checkFfmpeg, checkWritableStorage } from './readiness-service';

const cleanup: string[] = [];

afterEach(async () => {
  await Promise.all(cleanup.splice(0).map(directory => fs.rm(directory, { recursive: true, force: true })));
});

describe('system readiness helpers', () => {
  // READINESS-001: unavailable/relocated FFmpeg must not crash the readiness API.
  it('reports a broken installer as blocked without rejecting the check', async () => {
    const result = await checkFfmpeg({}, () => { throw new Error('Missing traced binary'); });
    expect(result).toMatchObject({ id: 'ffmpeg', status: 'blocked' });
    expect(result.detail).toContain('FFMPEG_PATH');
  });

  it('uses FFMPEG_PATH without loading the installer', async () => {
    const loadInstaller = vi.fn(() => { throw new Error('Installer not installed'); });
    const result = await checkFfmpeg({ FFMPEG_PATH: process.execPath }, loadInstaller);
    expect(result.status).toBe('ready');
    expect(loadInstaller).not.toHaveBeenCalled();
  });

  it('reports an invalid explicit binary as blocked', async () => {
    const result = await checkFfmpeg({ FFMPEG_PATH: path.join(os.tmpdir(), 'qa-nonexistent-ffmpeg', 'ffmpeg.exe') });
    expect(result.status).toBe('blocked');
  });

  it('accepts an available installer binary', async () => {
    const result = await checkFfmpeg({}, () => ({ path: process.execPath }));
    expect(result.status).toBe('ready');
  });

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
