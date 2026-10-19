import { afterEach, expect, it, vi } from 'vitest';
import { importExcel, previewExcelImport } from './excel-client';
afterEach(()=>vi.unstubAllGlobals());
it.each([['preview',previewExcelImport],['import',importExcel]] as const)('P7-EXCEL: %s binds multipart project to authorized query',async(mode,send)=>{
  const fetchMock=vi.fn().mockResolvedValue({ok:true,json:async()=>({imported:2})});
  vi.stubGlobal('fetch',fetchMock);
  await send({projectId:'project / A',file:new File(['synthetic'],'phase7.xlsx'),createModules:false});
  const [url,options]=fetchMock.mock.calls[0];
  expect(url).toBe('/api/excel?projectId=project%20%2F%20A');
  expect(options.method).toBe('POST');
  expect(options.body.get('projectId')).toBe('project / A');
  expect(options.body.get('mode')).toBe(mode);
  expect(options.headers).toBeUndefined(); // browser must provide multipart boundary
});
it('P7-EXCEL: denied import rejects instead of returning false success',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false}));
  await expect(importExcel({projectId:'own',file:new File(['synthetic'],'phase7.xlsx'),createModules:false})).rejects.toThrow();
});
