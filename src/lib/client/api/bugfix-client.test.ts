import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchBugFixes } from './bugfix-client';

afterEach(() => vi.unstubAllGlobals());
describe('Bugs GET client', () => {
  it('forwards cancellation without changing the query contract', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ bugFixItems: [] }) });
    vi.stubGlobal('fetch', fetch);
    const controller = new AbortController();
    await fetchBugFixes({ projectId: 'project-a', status: 'SEDANG DI FIX', search: 'checkout' }, controller.signal);
    const [url, options] = fetch.mock.calls[0];
    const query = new URL(url, 'http://fixture.test').searchParams;
    expect(query.get('projectId')).toBe('project-a');
    expect(query.get('limit')).toBe('100');
    expect(query.get('status')).toBe('SEDANG DI FIX');
    expect(query.get('search')).toBe('checkout');
    expect(options.signal).toBe(controller.signal);
  });
  it('does not treat an error response as an empty successful refresh', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    await expect(fetchBugFixes({ projectId: 'a' })).rejects.toThrow('gagal dimuat');
  });
});
