import { afterEach, expect, it, vi } from 'vitest';
import { fetchBugFixes } from './bugfix-client';
afterEach(() => vi.unstubAllGlobals());
it('sends server-side page, module and active-tab filters and preserves total metadata', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ bugFixItems: [], total: 140, totalPages: 6 }) });
  vi.stubGlobal('fetch', fetchMock);
  const data = await fetchBugFixes({ projectId: 'p', page: 5, limit: 25, moduleId: 'unassigned', tab: 'active', search: 'Login' });
  const query = new URL(fetchMock.mock.calls[0][0], 'http://local').searchParams;
  expect(Object.fromEntries(query)).toMatchObject({ projectId: 'p', page: '5', moduleId: 'unassigned', tab: 'active', limit: '25' });
  expect(data.totalPages).toBe(6);
});
