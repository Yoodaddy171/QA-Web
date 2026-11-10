import { afterEach, expect, it, vi } from 'vitest';
import { runReportAction, fetchReportPage, fetchReportDetail } from './reports-client';
afterEach(()=>vi.unstubAllGlobals());
it.each(['refresh','finalize','versions'] as const)('P7-REPORT-ACTION: %s obeys JSON mutation contract',async(action)=>{
  const fetchMock=vi.fn().mockResolvedValue({ok:true,json:async()=>({report:{id:'synthetic-report'}})});
  vi.stubGlobal('fetch',fetchMock);
  expect(await runReportAction('synthetic-report',action)).toEqual({id:'synthetic-report'});
  const [url,options]=fetchMock.mock.calls[0];
  expect(url).toBe(`/api/reports/synthetic-report/${action}`);
  expect(options.headers).toEqual({'Content-Type':'application/json'});
  expect(JSON.parse(options.body)).toEqual({});
});
it('uses summary-only cursor pages and loads a document only on demand', async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ reports: [{ id: 'r1' }], hasMore: true, nextCursor: 'r1' }) }).mockResolvedValueOnce({ ok: true, json: async () => ({ report: { id: 'r1', sections: { scope: 'detail' } } }) });
  vi.stubGlobal('fetch', fetchMock);
  const controller = new AbortController();
  expect((await fetchReportPage('p', 'older', controller.signal)).nextCursor).toBe('r1');
  const url = new URL(fetchMock.mock.calls[0][0], 'http://local');
  expect(url.searchParams.get('view')).toBe('summary'); expect(url.searchParams.get('cursor')).toBe('older');
  expect(fetchMock.mock.calls[0][1].signal).toBe(controller.signal);
  expect(await fetchReportDetail('p', 'r1')).toMatchObject({ sections: { scope: 'detail' } });
});

it('REPORT-PAGINATION: sends the same normalized filters with each cursor page', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ reports: [], hasMore: false, nextCursor: null, total: 31, matchedTotal: 1 }) });
  vi.stubGlobal('fetch', fetchMock);
  const filters = { search: ' IAPAYS ', status: 'FINAL' as const, type: 'TEST_PLANNING_DOCUMENT' as const };
  await fetchReportPage('p', undefined, undefined, filters);
  const page = await fetchReportPage('p', 'older', undefined, filters);
  const first = new URL(fetchMock.mock.calls[0][0], 'http://local');
  const next = new URL(fetchMock.mock.calls[1][0], 'http://local');
  for (const query of [first.searchParams, next.searchParams]) {
    expect(query.get('search')).toBe('iapays');
    expect(query.get('status')).toBe('FINAL');
    expect(query.get('type')).toBe('TEST_PLANNING_DOCUMENT');
    expect(query.get('limit')).toBe('25');
  }
  expect(next.searchParams.get('cursor')).toBe('older');
  expect(page).toMatchObject({ total: 31, matchedTotal: 1 });
});
