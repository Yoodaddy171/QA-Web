import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchSourceTestCaseNotes } from './testcase-source-notes';

afterEach(() => vi.unstubAllGlobals());
describe('FUNC-INSPECTOR: source notes', () => {
  it('reads source notes by internal ID and project without changing the bug', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ testCases: [{ id: 'case-1', projectId: 'project-1', remarks: 'Current notes' }] })));
    vi.stubGlobal('fetch', fetch);
    expect(await fetchSourceTestCaseNotes('project-1', 'case-1')).toBe('Current notes');
    expect(fetch.mock.calls[0][0]).toContain('search=case-1');
    expect(fetch.mock.calls[0][1]).toEqual(expect.objectContaining({ cache: 'no-store' }));
  });
  it.each([
    { rows: [{ id: 'other-case', projectId: 'project-1' }] },
    { rows: [{ id: 'case-1', projectId: 'other-project' }] },
    { rows: [] },
  ])('rejects a missing or mismatched source: $rows', async ({ rows }) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ testCases: rows }))));
    await expect(fetchSourceTestCaseNotes('project-1', 'case-1')).rejects.toThrow('Testcase asal tidak ditemukan');
  });
  it('surfaces a failed request instead of reporting empty notes', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Akses ditolak' }), { status: 403 })));
    await expect(fetchSourceTestCaseNotes('project-1', 'case-1')).rejects.toThrow('Akses ditolak');
  });
});
