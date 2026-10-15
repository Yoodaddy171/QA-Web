import { afterEach, expect, it, vi } from 'vitest';

vi.mock('node:module', () => ({
  createRequire: () => () => { throw new Error('Missing standalone FFmpeg package'); },
}));
vi.mock('@/lib/db', () => ({ db: { project: { count: vi.fn().mockResolvedValue(0) } } }));
vi.mock('node:fs/promises', () => ({
  default: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    rm: vi.fn().mockResolvedValue(undefined),
    access: vi.fn().mockResolvedValue(undefined),
    statfs: vi.fn().mockResolvedValue({ bavail: 2 ** 20, bsize: 4096 }),
  },
}));

import { GET } from '@/app/api/readiness/route';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it('READINESS-001: returns the complete HTTP 200 report when the FFmpeg installer cannot load', async () => {
  vi.stubEnv('DATABASE_URL', 'file:./readiness-test.db');
  vi.stubEnv('FFMPEG_PATH', '');
  vi.stubEnv('QA_RELAY_TOKEN', '');
  vi.stubEnv('NEXT_PUBLIC_QA_RELAY_TOKEN', '');
  vi.stubEnv('AI_PROVIDER', 'groq');
  vi.stubEnv('GROQ_API_KEY', '');
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Unexpected network access'); }));

  const response = await GET();
  const report = await response.json();
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(report.checks).toHaveLength(9);
  expect(report.status).toBe('blocked');
  expect(report.checks).toContainEqual(expect.objectContaining({ id: 'ffmpeg', status: 'blocked' }));
  expect(report.checks).toContainEqual(expect.objectContaining({ id: 'database', status: 'ready' }));
  expect(fetch).not.toHaveBeenCalled();
});
