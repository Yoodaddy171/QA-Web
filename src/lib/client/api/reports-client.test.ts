import { afterEach, expect, it, vi } from 'vitest';
import { runReportAction } from './reports-client';
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
