import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
const root = process.env.QA_PHASE7_ROOT || '';
if (!path.basename(root).startsWith('qadesk-phase7-')) throw new Error('Disposable synthetic fixture required');
const f = JSON.parse(fs.readFileSync(path.join(root, 'fixture.json'), 'utf8'));
if (!f.databaseUrl.startsWith(`file:${root.replaceAll('\\', '/')}/`)) throw new Error('Foreign database');
const db = new PrismaClient({datasourceUrl:f.databaseUrl});
test.afterAll(async()=>db.$disconnect());
test.beforeEach(async({context,page})=>{
  await context.addCookies([{name:'qa_session',value:f.actors.owner.token,url:f.origin}]);
  await context.route(/https?:\/\/(127\.0\.0\.1|localhost):3001\//,r=>r.abort());
  await context.routeWebSocket(/ws:\/\/(127\.0\.0\.1|localhost):3001/,ws=>ws.close());
  page.on('dialog',d=>d.accept());
});

test('8C1-INSPECTOR direct switching mounts every tab without close/reopen', async ({ context, page }, info) => {
  await context.addCookies([{ name: 'qa_session', value: f.actors.owner.token, url: f.origin }]);
  await context.route(/https?:\/\/(127\.0\.0\.1|localhost):3001\//, r => r.abort());
  await context.routeWebSocket(/ws:\/\/(127\.0\.0\.1|localhost):3001/, ws => ws.close());
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`/projects/${f.project.id}/test-cases`);
  const opener = page.getByRole('button', { name: 'Actions for AUTH-001', exact: true });
  await opener.click();
  await page.getByRole('menuitem', { name: /Lihat Detail/ }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Test Case ID (Display)', { exact: true })).toBeVisible();
  const states: [string, string][] = [
    ['Steps', 'Test steps'], ['Traceability', 'REQ-AUTH-01'],
    ['Execution', 'Execution workspace history'], ['Evidence', 'Belum ada evidence'],
    ['Bugs', 'Bugs terkait'], ['History', 'Immutable audit history'],
    ['Comments', 'Please verify the expired-session flow'], ['Automation', 'System DevLog'],
    ['Overview', 'Test Case ID (Display)'], ['Steps', 'Test steps'],
  ];
  for (const [name, content] of states) {
    await dialog.getByRole('tab', { name, exact: true }).click();
    await expect(dialog.getByRole('tab', { name, exact: true })).toHaveAttribute('data-state', 'active');
    try { await expect(dialog).toContainText(content, { timeout: 4000 }); }
    catch (error) {
      await page.screenshot({ path: path.join(root, `inspector-${process.env.QA_PHASE7_RUN}-${name.toLowerCase()}.png`), animations: 'allow' });
      await info.attach('selected-tab-with-missing-body', { body: JSON.stringify({ name, expected: content, actual: await dialog.innerText() }), contentType: 'application/json' });
      throw error;
    }
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
  expect(errors).toEqual([]);
});

test('8C1-TABLE scroll, density, search, filter, sorting and status',async({page},info)=>{
  await page.goto(`/projects/${f.project.id}/test-cases`);
  await expect(page.locator('tbody')).toContainText('AUTH-001');
  const region=page.getByRole('region',{name:/Tabel testcase/});
  expect(await region.evaluate(e=>e.scrollWidth>e.clientWidth)).toBeTruthy();
  await region.evaluate(e=>{e.scrollLeft=e.scrollWidth;});
  const result=page.locator('tbody tr').filter({hasText:'AUTH-001'}).getByText('Not As Expected',{exact:true});
  await expect(result).toBeVisible();
  expect(await result.evaluate(e=>e.scrollWidth<=e.clientWidth)).toBeTruthy();
  await expect(page.getByRole('button',{name:'Actions for AUTH-001',exact:true})).toBeInViewport();
  const normal=await page.locator('tbody tr').first().evaluate(e=>e.getBoundingClientRect().height);
  await page.getByRole('radio',{name:'Tabel ringkas'}).click();
  await expect(page.getByRole('radio',{name:'Tabel ringkas'})).toHaveAttribute('data-state','on');
  await expect.poll(()=>page.locator('tbody tr').first().evaluate(e=>e.getBoundingClientRect().height)).toBeLessThan(normal);
  expect(await page.evaluate(()=>localStorage.getItem('qaDesk.tableDensity.v1'))).toBe('compact');
  const compact=await page.locator('tbody tr').first().evaluate(e=>e.getBoundingClientRect().height);
  await info.attach('density-measurement',{body:JSON.stringify({normal,compact}),contentType:'application/json'});
  await page.screenshot({path:'artifacts/ui-review/phase8c1/compact-confirmation.png'});
  await page.reload();await expect(page.getByRole('radio',{name:'Tabel ringkas'})).toHaveAttribute('data-state','on');
  await page.locator('[data-search-input]').fill('AUTH-001');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await page.locator('[data-search-input]').fill('');await expect(page.locator('tbody tr')).toHaveCount(10);
  await page.getByRole('columnheader',{name:/^ID/}).click();
  const last=await db.testCase.findFirstOrThrow({where:{projectId:f.project.id},orderBy:{testCaseId:'desc'}});
  await expect(page.locator('tbody tr').first()).toContainText(last.testCaseId);
  await page.getByRole('button',{name:'Filter',exact:true}).click();
  await page.getByRole('combobox').filter({hasText:'All Status'}).click();
  await page.getByRole('option',{name:'Blocked',exact:true}).click();await page.keyboard.press('Escape');
  await expect(page.locator('tbody')).toContainText('API-004');await expect(page.locator('tbody')).not.toContainText('AUTH-001');
  await page.getByRole('combobox',{name:'Status for API-004',exact:true}).click();
  const saved=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/testcases'&&r.request().method()==='PUT');
  await page.getByRole('option',{name:'IN PROGRESS',exact:true}).click();expect((await saved).ok()).toBeTruthy();
  expect((await db.testCase.findUniqueOrThrow({where:{id:f.cases[3].id}})).status).toBe('IN PROGRESS');
});

test('8C1-FORM create, retained validation, edit, empty tags, focus and persistence',async({page})=>{
  await page.goto(`/projects/${f.project.id}/test-cases`);
  const opener=page.getByRole('button',{name:/Add Test Case/});await opener.click();const dialog=page.getByRole('dialog');
  await dialog.getByLabel(/^Test Case ID/).fill('VIS-C1-001');
  await dialog.getByLabel(/^Test Action/).fill('Preserve filters after refreshing checkout');
  await dialog.getByRole('button',{name:'Buat Test Case',exact:true}).click();
  await expect(dialog.getByLabel(/^Test Action/)).toHaveValue('Preserve filters after refreshing checkout');
  await dialog.getByLabel(/^Page \/ Menu/).fill('Checkout');
  await dialog.getByLabel(/^Test Steps/).fill('Open checkout\nRefresh the page\nVerify filters');
  await dialog.getByLabel(/^Expected Result/).fill('Filters remain selected.');
  await dialog.getByLabel(/^Tipe Test/).click();await page.getByRole('option',{name:'Positive',exact:true}).click();
  const created=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/testcases'&&r.request().method()==='POST');
  await dialog.getByRole('button',{name:'Buat Test Case',exact:true}).click();expect((await created).ok()).toBeTruthy();await expect(dialog).toHaveCount(0);
  await page.locator('[data-search-input]').fill('VIS-C1-001');await page.getByRole('button',{name:'Actions for VIS-C1-001'}).click();await page.getByRole('menuitem',{name:'Edit',exact:true}).click();
  await dialog.getByLabel(/^Test Action/).fill('Verify saved checkout filters after edit');
  const edited=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/testcases'&&r.request().method()==='PUT');
  await dialog.getByRole('button',{name:'Simpan Perubahan',exact:true}).click();expect((await edited).ok()).toBeTruthy();
  const tc=await db.testCase.findUniqueOrThrow({where:{projectId_testCaseId:{projectId:f.project.id,testCaseId:'VIS-C1-001'}}});expect(tc.testAction).toBe('Verify saved checkout filters after edit');expect(tc.tags??'').toBe('');
  await page.reload();await page.locator('[data-search-input]').fill('VIS-C1-001');await expect(page.locator('tbody')).toContainText(tc.testAction);
  await opener.click();await page.keyboard.press('Escape');await expect(opener).toBeFocused();
});

test('8C1-BUG lazy selector and source-case lifecycle remain synchronized',async({page})=>{
  await page.goto(`/projects/${f.project.id}/bugs`);
  const trigger=page.getByRole('button',{name:'Status for bug AUTH-001',exact:true});
  await expect(trigger).toHaveAttribute('data-bug-status-kind','dormant');
  for(const status of ['SEDANG DI FIX','READY TO RETEST']){
    await page.getByLabel('Status for bug AUTH-001',{exact:true}).click();
    const saved=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/bugfix'&&r.request().method()==='PUT');
    await page.getByRole('option',{name:status,exact:true}).click();expect((await saved).ok()).toBeTruthy();
  }
  const bug=await db.bugFix.findFirstOrThrow({where:{projectId:f.project.id,testCaseId:'AUTH-001'}});
  expect(bug.status).toBe('READY TO RETEST');expect((await db.testCase.findUniqueOrThrow({where:{id:f.cases[0].id}})).status).toBe('READY TO RETEST');
  await page.getByRole('button',{name:'View bug AUTH-001'}).click();await page.getByRole('tab',{name:'Lifecycle',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('READY TO RETEST');
});

test('8C1-ROLE Viewer and cross-workspace downgrade stay read-only',async({browser})=>{
  const viewer=await browser.newContext({baseURL:f.origin});
  const multi=await browser.newContext({baseURL:f.origin,extraHTTPHeaders:{Origin:f.origin}});
  try {
  for(const [context,actor] of [[viewer,f.actors.viewer],[multi,f.actors.multi]] as const){
    await context.addCookies([{name:'qa_session',value:actor.token,url:f.origin}]);
    await context.route(/https?:\/\/(127\.0\.0\.1|localhost):3001\//,r=>r.abort());
    await context.routeWebSocket(/ws:\/\/(127\.0\.0\.1|localhost):3001/,ws=>ws.close());
    const identity=await (await context.request.get('/api/auth/status')).json();
    expect(identity.authenticated).toBe(true);expect(identity.user.id).toBe(actor.id);
  }
  const page=await viewer.newPage();
  await page.goto(`/projects/${f.project.id}/test-cases`);await expect(page.getByText(/Mode baca saja/)).toBeVisible();
  await expect(page.getByRole('button',{name:/Add Test Case/})).toHaveCount(0);await expect(page.getByRole('combobox',{name:'Status for AUTH-001'})).toHaveCount(0);
  const scopedPage=await multi.newPage();
  await scopedPage.goto(`/projects/${f.project.id}/test-cases`);await expect(scopedPage.getByRole('button',{name:/Add Test Case/})).toBeVisible();
  await scopedPage.goto(`/projects/${f.foreign.id}/test-cases`);await expect(scopedPage.getByText(/Mode baca saja/)).toBeVisible();
  await expect(scopedPage.getByRole('button',{name:/Add Test Case/})).toHaveCount(0);
  const before=await db.testCase.findUniqueOrThrow({where:{id:f.foreignCase.id}});
  const denied=await multi.request.put(`/api/testcases?projectId=${f.foreign.id}`,{data:{id:f.foreignCase.id,projectId:f.foreign.id,testAction:'must not persist'}});
  expect(denied.status()).toBe(403);expect((await db.testCase.findUniqueOrThrow({where:{id:f.foreignCase.id}})).testAction).toBe(before.testAction);
  } finally {await viewer.close();await multi.close();}
});
