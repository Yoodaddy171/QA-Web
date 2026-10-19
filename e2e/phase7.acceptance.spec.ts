import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';

const root = process.env.QA_PHASE7_ROOT || '';
if (!path.basename(root).startsWith('qadesk-phase7-')) throw new Error('Synthetic fixture only');
const f = JSON.parse(fs.readFileSync(path.join(root, 'fixture.json'), 'utf8'));
if (!f.databaseUrl.startsWith(`file:${root.replaceAll('\\','/')}/`)) throw new Error('Database outside owned fixture');
const db = new PrismaClient({ datasourceUrl: f.databaseUrl });
const route = (tab: string, project = f.project.id) => `/projects/${project}/${tab}`;
async function cases(page: Page) { await page.goto(route('test-cases')); await expect(page.getByRole('button',{name:/Add Test Case/})).toBeVisible(); await expect(page.locator('tbody tr').first()).toContainText('P7-'); }
async function status(page: Page, id: string, next: string) {
  const trigger = page.getByRole('combobox',{name:`Status for ${id}`,exact:true});
  await trigger.click();
  const response = page.waitForResponse(r=>r.url().endsWith('/api/testcases') && r.request().method()==='PUT');
  await page.getByRole('option',{name:next,exact:true}).click();
  expect((await response).ok()).toBeTruthy(); await expect(trigger).toContainText(next);
}
async function bugStatus(page: Page, id: string, next: string) {
  await page.getByLabel(`Status for bug ${id}`,{exact:true}).click();
  const response = page.waitForResponse(r=>r.url().endsWith('/api/bugfix') && r.request().method()==='PUT');
  await page.getByRole('option',{name:next,exact:true}).click();
  return await response;
}
async function cookie(context: BrowserContext, alias: string) {
  await context.addCookies([{name:'qa_session',value:f.actors[alias].token,url:f.origin}]);
}
test.beforeEach(async ({context,page},info)=>{
  await cookie(context,'lead');
  // Never contact the user's relay, even for read-only component polling.
  await context.route(/https?:\/\/(127\.0\.0\.1|localhost):3001\//, r=>r.abort());
  await context.routeWebSocket(/ws:\/\/(127\.0\.0\.1|localhost):3001\//, ws=>ws.close());
  const network: object[] = [], errors: string[] = [];
  page.on('pageerror', e=>errors.push(e.message));
  page.on('response',r=>{if(new URL(r.url()).pathname.startsWith('/api/')) network.push({path:new URL(r.url()).pathname,status:r.status(),method:r.request().method()});});
  info.annotations.push({type:'actor',description:'synthetic lead / workspace A unless scenario explicitly changes role'});
  (page as any).__phase7 = {network,errors};
});
test.afterEach(async ({page},info)=>{
  await info.attach('network-and-runtime',{body:JSON.stringify((page as any).__phase7,null,2),contentType:'application/json'});
  if (info.status!==info.expectedStatus) {
    const snapshot = { cases:await db.testCase.findMany({where:{projectId:f.project.id}}), bugs:await db.bugFix.findMany({where:{projectId:f.project.id}}), executions:await db.testExecution.findMany({where:{testRun:{projectId:f.project.id}}}), history:await db.activityHistory.findMany({where:{projectId:f.project.id}}) };
    await info.attach('persisted-synthetic-state',{body:JSON.stringify(snapshot,null,2),contentType:'application/json'});
  }
});
test.afterAll(async()=>{await db.$disconnect();});

test('P7-01 login, project navigation, refresh and Back/Forward',async({page,context})=>{
  await context.clearCookies(); await page.goto('/login');
  await page.getByLabel('Email',{exact:true}).fill(f.actors.lead.email);
  await page.getByLabel('Password',{exact:true}).fill(f.password);
  await page.getByRole('button',{name:'Masuk',exact:true}).click();
  await page.waitForURL(u=>!u.pathname.includes('login'));
  const identity=await (await page.request.get('/api/auth/status')).json();
  expect(identity.authenticated).toBe(true);
  await cases(page);
  await page.getByRole('button',{name:/^Bugs/}).first().click(); await expect(page).toHaveURL(/\/bugs$/);
  await page.goBack(); await expect(page).toHaveURL(/\/test-cases$/);
  await page.goForward(); await expect(page).toHaveURL(/\/bugs$/);
  await page.reload(); await expect(page.getByPlaceholder('Cari bug...')).toBeVisible();
  expect((page as any).__phase7.errors).toEqual([]);
});

test('P7-02 create, required validation, edit and database persistence',async({page})=>{
  await cases(page); const before=await db.testCase.count({where:{projectId:f.project.id}});
  await page.getByRole('button',{name:/Add Test Case/}).click(); const dialog=page.getByRole('dialog');
  await dialog.getByRole('button',{name:'Buat Test Case',exact:true}).click();
  await expect(page.getByText('Mohon isi field yang wajib (*)',{exact:true})).toBeVisible();
  expect(await db.testCase.count({where:{projectId:f.project.id}})).toBe(before);
  await dialog.getByPlaceholder('contoh: A-001').fill('P7-NEW-001');
  await dialog.getByPlaceholder('contoh: CMS Login').fill('New Checkout');
  await dialog.getByPlaceholder('Deskripsi aksi test yang dilakukan').fill('Browser-created acceptance');
  await dialog.getByPlaceholder(/^- Langkah 1/).fill('Open\nSubmit');
  await dialog.getByPlaceholder('Hasil yang diharapkan').fill('Saved');
  await dialog.getByRole('combobox').filter({hasText:'Medium'}).click(); await page.getByRole('option',{name:'High',exact:true}).click();
  await dialog.getByRole('combobox').filter({hasText:'Positive'}).click(); await page.getByRole('option',{name:'Negative',exact:true}).click();
  await dialog.getByRole('combobox').filter({hasText:'Tanpa Module'}).click(); await page.getByRole('option',{name:'Checkout',exact:true}).click();
  await dialog.getByRole('button',{name:'Buat Test Case',exact:true}).click(); await expect(dialog).toBeHidden();
  const tc=await db.testCase.findFirstOrThrow({where:{projectId:f.project.id,testCaseId:'P7-NEW-001'}});
  expect(tc).toMatchObject({testAction:'Browser-created acceptance',priority:'High',testType:'Negative',moduleId:f.modules[0].id});
  await page.locator('[data-search-input]').fill('P7-NEW-001'); await expect(page.locator('tbody tr')).toHaveCount(1);
  await page.getByRole('button',{name:'Actions for P7-NEW-001'}).click(); await page.getByRole('menuitem',{name:'Edit',exact:true}).click();
  await dialog.getByPlaceholder('Deskripsi aksi test yang dilakukan').fill('Browser-edited acceptance');
  await dialog.getByRole('button',{name:'Simpan Perubahan'}).click(); await expect(dialog).toBeHidden(); await page.reload();
  expect((await db.testCase.findUniqueOrThrow({where:{id:tc.id}})).testAction).toBe('Browser-edited acceptance');
});

test('P7-03 search, filters, deterministic sorting, pagination and keyboard status',async({page})=>{
  await cases(page); await page.getByRole('columnheader',{name:'ID',exact:true}).click(); await expect(page.locator('tbody tr').first()).toContainText('P7-');
  await page.getByRole('button',{name:'Halaman berikutnya',exact:true}).click(); await expect(page.getByText(/Halaman 2 dari/i)).toBeVisible();
  await page.locator('[data-search-input]').fill('P7-010'); await expect(page.locator('tbody tr')).toHaveCount(1);
  const trigger=page.getByRole('combobox',{name:'Status for P7-010',exact:true}); await trigger.focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('listbox')).toBeVisible(); await page.keyboard.press('Escape'); await expect(trigger).toBeFocused();
  await status(page,'P7-010','BLOCKED'); expect((await db.testCase.findUniqueOrThrow({where:{id:f.cases[9].id}})).status).toBe('BLOCKED');
  await page.locator('[data-search-input]').fill(''); await page.getByRole('button',{name:/^Filter/}).first().click();
  await page.getByRole('combobox').filter({hasText:'All Status'}).click(); await page.getByRole('option',{name:'Blocked',exact:true}).click();
  await expect(page.locator('tbody tr')).toHaveCount(1); await expect(page.locator('tbody')).toContainText('P7-010');
  await page.getByRole('combobox').filter({hasText:'All Modules'}).click(); await page.getByRole('option',{name:'Checkout',exact:true}).click();
  await expect(page.locator('tbody tr')).toHaveCount(1);
});

test('P7-04 inspector tabs and focus dismissal',async({page})=>{
  await cases(page); await page.getByRole('button',{name:'Actions for P7-001'}).click(); await page.getByRole('menuitem',{name:'Lihat Detail'}).click();
  const dialog=page.getByRole('dialog'); await expect(dialog).toBeVisible();
  for(const name of ['Steps','Execution','Evidence','Bugs','History','Comments','Traceability','Overview']) {
    await dialog.getByRole('tab',{name,exact:true}).click(); await expect(dialog.getByRole('tab',{name,exact:true})).toHaveAttribute('aria-selected','true');
  }
  await page.keyboard.press('Escape'); await expect(dialog).toBeHidden(); expect((page as any).__phase7.errors).toEqual([]);
});

test('P7-05 execution workspace pass/fail, evidence and Create Bug',async({page})=>{
  await page.goto(route('test-runs')); await page.getByRole('button',{name:/Phase7 Cycle/}).first().click();
  await page.getByLabel('Execution notes',{exact:true}).fill('Browser pass notes');
  const executed=page.waitForResponse(r=>/\/executions$/.test(new URL(r.url()).pathname)&&r.request().method()==='POST');
  await page.getByRole('button',{name:/^Pass P$/}).click(); expect((await executed).ok()).toBeTruthy();
  await expect.poll(()=>db.testExecution.count({where:{testCaseId:f.cases[0].id,status:'PASSED'}})).toBe(1);
  await page.getByRole('button',{name:/Next Case/}).click();
  await page.getByRole('button',{name:/^Fail F$/}).click();
  await expect.poll(()=>db.testExecution.count({where:{testCaseId:f.cases[1].id,status:'FAILED'}})).toBe(1);
  await page.locator('input[type=file]').setInputFiles({name:'p7-evidence.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64')});
  await expect(page.getByRole('link',{name:'p7-evidence.png'})).toBeVisible();
  await page.getByRole('button',{name:'Create Bug',exact:true}).click();
  await expect.poll(()=>db.bugFix.count({where:{sourceTestCaseId:f.cases[1].id}})).toBe(1);
  const execution=await db.testExecution.findFirstOrThrow({where:{testCaseId:f.cases[1].id},orderBy:{createdAt:'desc'},include:{evidence:true}});
  expect(execution.evidence).toHaveLength(1); expect(execution.tester).toBe('Phase7 lead');
  const evidence=execution.evidence[0];
  const linkedBug=await db.bugFix.findFirstOrThrow({where:{sourceTestCaseId:f.cases[1].id}});
  expect(linkedBug.sourceExecutionId).toBe(execution.id);
  expect((await db.testCase.findUniqueOrThrow({where:{id:f.cases[1].id}})).status).toBe('FAILED');
  const downloaded=await page.request.get(`/api/test-runs/${f.run.id}/executions/${execution.id}/evidence/${evidence.id}?projectId=${f.project.id}`);
  expect(downloaded.ok()).toBeTruthy(); expect((await downloaded.body()).length).toBe(evidence.sizeBytes);
  const missing=await page.request.get(`/api/test-runs/${f.run.id}/executions/${execution.id}/evidence/phase7-missing?projectId=${f.project.id}`); expect(missing.status()).toBe(404);
  await page.reload(); await page.getByRole('button',{name:/Phase7 Cycle/}).first().click(); await expect(page.getByText('1 passed',{exact:true})).toBeVisible(); await expect(page.getByText('1 failed',{exact:true})).toBeVisible();
});

test('P7-06 complete browser Bug lifecycle to verified with persistent history',async({page})=>{
  await cases(page); await status(page,'P7-005','FAILED');
  const tc=f.cases[4]; const bug=await db.bugFix.findFirstOrThrow({where:{sourceTestCaseId:tc.id}}); expect(bug.projectId).toBe(f.project.id);
  await page.goto(route('bugs')); await page.getByPlaceholder('Cari bug...').fill('P7-005');
  expect((await bugStatus(page,'P7-005','SEDANG DI FIX')).ok()).toBeTruthy();
  expect((await bugStatus(page,'P7-005','READY TO RETEST')).ok()).toBeTruthy();
  expect((await db.testCase.findUniqueOrThrow({where:{id:tc.id}})).status).toBe('READY TO RETEST');
  await cases(page); await status(page,'P7-005','DONE'); await page.reload(); await expect(page.getByRole('combobox',{name:'Status for P7-005',exact:true})).toContainText('DONE');
  const saved=await db.bugFix.findUniqueOrThrow({where:{id:bug.id}}); expect(saved.status).toBe('VERIFIED & FIXED');
  expect(saved.reportedAt&&saved.fixingAt&&saved.readyAt&&saved.fixedAt).toBeTruthy();
  expect(await db.bugFix.count({where:{sourceTestCaseId:tc.id}})).toBe(1);
  expect(await db.activityHistory.count({where:{entityId:tc.id}})).toBeGreaterThan(0);
  await page.goto(route('bugs')); await page.getByRole('tab',{name:'Riwayat Fixed',exact:true}).click(); await expect(page.getByRole('button',{name:'View bug P7-005'})).toBeVisible();
});

test('P7-07 failed retest bounces to fixing, repeat is history-safe',async({page})=>{
  await cases(page); await status(page,'P7-006','FAILED'); const tc=f.cases[5];
  const bug=await db.bugFix.findFirstOrThrow({where:{sourceTestCaseId:tc.id}});
  await page.goto(route('bugs')); await page.getByPlaceholder('Cari bug...').fill('P7-006');
  expect((await bugStatus(page,'P7-006','SEDANG DI FIX')).ok()).toBeTruthy(); expect((await bugStatus(page,'P7-006','READY TO RETEST')).ok()).toBeTruthy();
  await cases(page); await status(page,'P7-006','FAILED');
  expect((await db.bugFix.findUniqueOrThrow({where:{id:bug.id}})).status).toBe('SEDANG DI FIX');
  const before=await db.activityHistory.count({where:{projectId:f.project.id}});
  const repeat=await page.request.put('/api/testcases',{data:{id:tc.id,status:'FAILED'}}); expect(repeat.ok()).toBeTruthy();
  expect(await db.activityHistory.count({where:{projectId:f.project.id}})).toBe(before);
  expect(await db.bugFix.count({where:{sourceTestCaseId:tc.id}})).toBe(1);
});

test('P7-08 dashboard DB totals and report source cycle selection',async({page})=>{
  await page.goto(route('dashboard')); const response=await page.request.get(`/api/stats?projectId=${f.project.id}`); expect(response.ok()).toBeTruthy(); const stats=await response.json();
  expect(stats.totalTestCases).toBe(await db.testCase.count({where:{projectId:f.project.id}}));
  const inventory=await db.testCase.findMany({where:{projectId:f.project.id}});
  expect(stats.doneCount).toBe(inventory.filter(x=>x.status==='DONE').length);
  expect(stats.failedCount).toBe(inventory.filter(x=>x.status==='FAILED').length);
  expect(stats.bugFixTotal).toBe(await db.bugFix.count({where:{projectId:f.project.id}}));
  expect(stats.overallProgress).toBe(Math.round(100*inventory.filter(x=>x.status==='DONE').length/inventory.filter(x=>x.status!=='TBA').length));
  expect(stats.releaseReadiness.testRunId).toBe(f.run.id);
  const latest=await db.testRunCase.findMany({where:{testRunId:f.run.id},include:{executions:{orderBy:{createdAt:'desc'},take:1}}});
  expect(stats.releaseReadiness.failedCases).toBe(latest.filter(x=>x.executions[0]?.status==='FAILED').length);
  await expect(page.getByText(stats.releaseReadiness.recommendation,{exact:true}).first()).toBeVisible();
  await cases(page); await status(page,'P7-004','DONE'); await page.goto(route('dashboard'));
  const refreshed=await (await page.request.get(`/api/stats?projectId=${f.project.id}`)).json(); expect(refreshed.doneCount).toBe(stats.doneCount+1);
  await page.goto(route('reports')); await page.getByRole('button',{name:/Buat Report|Create Report|New Report/}).click();
  const source=page.getByRole('combobox').filter({hasText:/Pilih Test Cycle|Phase7 Cycle/}); await source.click();
  await expect(page.getByRole('option',{name:/Phase7 Cycle/})).toBeVisible();
  await page.getByRole('option',{name:/Phase7 Cycle/}).click();
  await page.getByPlaceholder('01 / 02 / TSR-001').fill('P7-REPORT-001');
  await page.getByPlaceholder('Tim Pengujian').fill('Phase7 Lead');
  await page.getByPlaceholder('Project Manager').fill('Synthetic approver');
  await page.getByRole('button',{name:/Pilih periode report:/}).click();
  const days=page.getByRole('gridcell').getByRole('button');
  await days.filter({hasText:/^10$/}).first().click();
  await days.filter({hasText:/^12$/}).first().click();
  await page.keyboard.press('Escape');
  const saved=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/reports'&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Save Draft',exact:true}).click(); const savedResponse=await saved; expect(savedResponse.ok()).toBeTruthy();
  const report=await db.report.findFirstOrThrow({where:{projectId:f.project.id,documentId:'P7-REPORT-001'}});
  expect(report.testRunId).toBe(f.run.id); expect(report.metricsSnapshot).toBeTruthy();
  const metrics=report.metricsSnapshot as any;
  expect(metrics.totalPlanned).toBe(latest.length);
  expect(metrics.totalPassed).toBe(latest.filter(x=>['PASSED','VERIFIED'].includes(x.executions[0]?.status)).length);
  expect(metrics.totalFailed).toBe(latest.filter(x=>x.executions[0]?.status==='FAILED').length);
  await expect(page.getByRole('button',{name:'Kembali ke Reports'})).toBeVisible();
  const denied=await page.request.post(`/api/reports/${report.id}/finalize`,{headers:{Cookie:`qa_session=${f.actors.qa.token}`},data:{}});
  expect(denied.status()).toBe(403); expect((await db.report.findUniqueOrThrow({where:{id:report.id}})).status).toBe('DRAFT');
  await page.getByRole('button',{name:'Finalize',exact:true}).click();
  await expect.poll(async()=>(await db.report.findUniqueOrThrow({where:{id:report.id}})).status).toBe('FINAL');
  await page.screenshot({path:path.join(root,'report-after.png'),timeout:5000});
});

test('P7-09 delayed reads, two tabs and actual 409 recovery',async({page,context})=>{
  await cases(page); let release!:()=>void; const held=new Promise<void>(r=>{release=r;}); let captured!:()=>void; const ready=new Promise<void>(r=>{captured=r;});
  await page.route('**/api/testcases?**',async r=>{ if(new URL(r.request().url()).searchParams.get('search')==='P7-011'){const response=await r.fetch();captured();await held;await r.fulfill({response});}else await r.continue(); });
  await page.locator('[data-search-input]').fill('P7-011'); await ready;
  await page.locator('[data-search-input]').fill('P7-012'); await expect(page.locator('tbody tr')).toHaveCount(1); await expect(page.locator('tbody')).toContainText('P7-012');
  release(); await page.unrouteAll({behavior:'wait'}); await expect(page.locator('tbody')).toContainText('P7-012');
  const other=await context.newPage(); await cases(page); await cases(other);
  await page.locator('[data-search-input]').fill('P7-011'); await other.locator('[data-search-input]').fill('P7-011');
  await status(page,'P7-011','IN PROGRESS'); await status(other,'P7-011','BLOCKED');
  expect((await db.testCase.findUniqueOrThrow({where:{id:f.cases[10].id}})).status).toBe('BLOCKED');
  await page.reload(); await page.locator('[data-search-input]').fill('P7-011'); await expect(page.getByRole('combobox',{name:'Status for P7-011',exact:true})).toContainText('BLOCKED');
  await other.close(); // two-tab scenario assertions are complete
  let allowOld!:()=>void, sawOld!:()=>void, completedOld!:()=>void;
  const holdOld=new Promise<void>(r=>{allowOld=r;}); const observedOld=new Promise<void>(r=>{sawOld=r;}); const finishedOld=new Promise<void>(r=>{completedOld=r;});
  const delayed=async(r:any)=>{if(new URL(r.request().url()).searchParams.get('search')==='P7-014'){const response=await r.fetch();sawOld();await holdOld;await r.fulfill({response}).catch(()=>{});completedOld();}else await r.continue();};
  await page.route('**/api/testcases?**',delayed);
  await page.locator('[data-search-input]').fill('P7-014'); await observedOld;
  await page.getByRole('combobox').filter({hasText:'Phase7 Acceptance'}).click(); await page.getByRole('option',{name:'Phase7 Alternate',exact:true}).click();
  await expect(page).toHaveURL(new RegExp(f.second.id)); await expect(page.locator('tbody')).toContainText('ALT-001');
  allowOld(); await finishedOld; await page.unroute('**/api/testcases?**',delayed); await expect(page.locator('tbody')).not.toContainText('P7-014');
  // Known supported relationship-conflict condition, synthetic fixture only.
  const tc=f.cases[7]; expect((await page.request.put('/api/testcases',{data:{id:tc.id,status:'FAILED'}})).ok()).toBeTruthy();
  const bug=await db.bugFix.findFirstOrThrow({where:{sourceTestCaseId:tc.id}});
  await db.bugFix.update({where:{id:bug.id},data:{sourceTestCaseId:f.foreignCase.id}});
  try { await page.goto(route('bugs')); await page.getByPlaceholder('Cari bug...').fill('P7-008'); const before=await db.activityHistory.count({where:{projectId:f.project.id}});
    expect((await bugStatus(page,'P7-008','SEDANG DI FIX')).status()).toBe(409);
    await expect(page.getByText(/project|konflik|berubah|Conflict|tidak cocok/i).last()).toBeVisible();
    expect((await db.bugFix.findUniqueOrThrow({where:{id:bug.id}})).status).toBe('SUDAH DILAPORKAN'); expect(await db.activityHistory.count({where:{projectId:f.project.id}})).toBe(before);
  } finally {await db.bugFix.update({where:{id:bug.id},data:{sourceTestCaseId:tc.id}});}
  await page.reload(); await expect(page.getByPlaceholder('Cari bug...')).toBeVisible();
});

test('P7-10 viewer and QA server permissions plus foreign workspace denial',async({page,context})=>{
  await cookie(context,'viewer'); await cases(page);
  const before=await db.testCase.findUniqueOrThrow({where:{id:f.cases[0].id}});
  expect((await page.request.put('/api/testcases',{data:{id:before.id,status:'FAILED'}})).status()).toBe(403);
  expect((await db.testCase.findUniqueOrThrow({where:{id:before.id}})).status).toBe(before.status);
  const foreign=await page.request.get(`/api/testcases?projectId=${f.foreign.id}`); expect([403,404]).toContain(foreign.status()); expect(await foreign.text()).not.toContain('PRIVATE-P7-MARKER');
  const evidence=await page.request.get(`/api/test-runs/${f.foreignRun.id}/executions/${f.foreignExecution.id}/evidence/${f.foreignEvidence.id}?projectId=${f.foreign.id}`);
  expect([403,404]).toContain(evidence.status()); expect(await evidence.text()).not.toContain('P7B');
  await cookie(context,'qa'); await page.reload(); await status(page,'P7-009','IN PROGRESS');
  expect((await db.testCase.findUniqueOrThrow({where:{id:f.cases[8].id}})).status).toBe('IN PROGRESS');
  const invalid=await page.request.put('/api/testcases',{data:{id:f.cases[8].id,status:'UNSUPPORTED'}}); expect(invalid.status()).toBe(400);
  const missing=await page.request.put('/api/testcases',{data:{id:'phase7-missing',projectId:f.project.id,status:'DONE'}}); expect(missing.status()).toBe(404);
  await page.goto(route('test-cases',f.foreign.id)); await expect(page.locator('body')).not.toContainText('PRIVATE-P7-MARKER');
});

test('P7-11 small Excel UI preview/import, malformed preview and export',async({page})=>{
  await cases(page); const before=await db.testCase.count({where:{projectId:f.project.id}});
  const workbook=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook,XLSX.utils.aoa_to_sheet([['ID','Page','Feature','Test','Action','Steps','Expected Result','Status'],['P7-XLS-001','Import','Checkout','Positive','Excel action','Open','Saved','NOT DONE'],['P7-XLS-002','Import','Checkout','Negative','Excel action 2','Submit','Rejected','NOT DONE']]),'Import');
  await page.getByRole('button',{name:'Import Excel',exact:true}).click();
  await page.locator('input[type=file]').setInputFiles({name:'phase7.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:XLSX.write(workbook,{type:'buffer',bookType:'xlsx'})});
  await expect(page.getByText('Ready to Import',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Konfirmasi Import',exact:true}).click();
  await expect.poll(()=>db.testCase.count({where:{projectId:f.project.id}})).toBe(before+2);
  await page.getByRole('dialog').getByRole('button',{name:'Batal',exact:true}).click();
  await page.locator('[data-search-input]').fill('P7-XLS'); await expect(page.locator('tbody tr')).toHaveCount(2);
  await page.getByRole('button',{name:'Export',exact:true}).click(); const download=page.waitForEvent('download');
  await page.getByRole('menuitem',{name:/Excel|XLSX/i}).first().click(); const file=await download; const downloaded=await file.path(); expect(downloaded).toBeTruthy();
  const output=XLSX.readFile(downloaded!); expect(JSON.stringify(output.Sheets)).toContain('P7-XLS-001');
  await page.getByRole('button',{name:'Import Excel',exact:true}).click();
  await page.locator('input[type=file]').setInputFiles({name:'invalid.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from('not-a-workbook')});
  await expect(page.getByText(/gagal|tidak|invalid|anomali/i).last()).toBeVisible(); expect(await db.testCase.count({where:{projectId:f.project.id}})).toBe(before+2);
});

test('P7-12 traceability plan relationships and create a cycle via UI',async({page})=>{
  await page.goto(route('traceability')); await page.getByRole('button',{name:/P7-REQ/}).click();
  await expect(page.getByText('Phase7 Plan',{exact:true}).first()).toBeVisible(); await expect(page.getByText('Phase7 Cycle',{exact:true}).first()).toBeVisible();
  await page.goto(route('test-runs')); await page.getByRole('button',{name:'Cycle baru',exact:true}).click();
  await page.getByLabel(/Nama cycle/).fill('Phase7 Browser Cycle'); await page.getByLabel('Tester / assignee',{exact:true}).fill('Browser QA');
  await page.getByRole('combobox').filter({hasText:'Tanpa Test Plan'}).click(); await page.getByRole('option',{name:'Phase7 Plan',exact:true}).click();
  await page.getByRole('button',{name:'Buat Test Cycle',exact:true}).click();
  await expect.poll(()=>db.testRun.count({where:{projectId:f.project.id,name:'Phase7 Browser Cycle'}})).toBe(1);
  await page.getByRole('button',{name:'Pilih testcase',exact:true}).click(); await page.getByRole('checkbox',{name:/P7-003/}).check();
  await page.getByRole('button',{name:'Tambahkan pilihan (1)',exact:true}).click();
  const run=await db.testRun.findFirstOrThrow({where:{projectId:f.project.id,name:'Phase7 Browser Cycle'}});
  expect(run.testPlanId).toBe(f.plan.id);
  await expect.poll(()=>db.testRunCase.count({where:{testRunId:run.id,testCaseId:f.cases[2].id}})).toBe(1);
});
