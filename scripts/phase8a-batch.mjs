import * as c from './phase8a-collect.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
const mode=process.argv[2];
const p=await c.init(mode==='viewer'?'viewer':mode==='login'?'anonymous':'owner',mode==='compact'?'compact':mode==='narrow'?'narrow':'desktop',mode==='light'?'light':'dark');
try {
 if(mode==='dashboard') {
  await c.go('dashboard');await c.cap('Dashboard','overview',{expect:'RELEASE DECISION'});
  await p.getByText('Antrian Retest',{exact:true}).scrollIntoViewIfNeeded();await c.cap('Dashboard','attention');
  await c.scrollBottom();await c.cap('Dashboard','module-progress');
 }
 if(mode==='cases'||mode==='cases-rest') {
  await c.go('test-cases');await c.cap('Cases','table',{expect:'AUTH-001'});
  if(mode==='cases') {
  if(await p.getByRole('radio',{name:'Tabel ringkas'}).count()) {await p.getByRole('radio',{name:'Tabel ringkas'}).click();await c.cap('Cases','compact-density');} else await c.skip('Cases','compact-density','No density control rendered in current Cases toolbar.','NOT IMPLEMENTED');
  for(const [button,key] of [['Filter','filters'],['Tanggal dibuat','date-picker'],['Columns','columns'],['Views','saved-views'],['Export','export-menu']]) {
   await p.getByRole('button',{name:new RegExp('^'+button)}).first().click(); await c.cap('Cases',key);await p.keyboard.press('Escape');
  }
  await p.getByRole('button',{name:'Actions for AUTH-001',exact:true}).click();await c.cap('Cases','row-menu');await p.keyboard.press('Escape');
  await p.getByRole('combobox',{name:'Status for AUTH-001',exact:true}).click();await c.cap('Cases','status-menu');await p.keyboard.press('Escape');
  await p.getByRole('button',{name:/Add Test Case/}).click();await p.getByRole('dialog').waitFor();await c.cap('Cases','create');
  await p.getByRole('button',{name:'Buat Test Case',exact:true}).click();await p.getByText('Mohon isi field yang wajib (*)',{exact:true}).waitFor();await c.cap('Cases','validation');await p.keyboard.press('Escape');
  }
  await p.getByRole('button',{name:'Actions for AUTH-001',exact:true}).click();await p.getByRole('menuitem',{name:'Edit',exact:true}).click();await c.cap('Cases','edit');await p.keyboard.press('Escape');
  await p.locator('tbody').getByRole('checkbox').first().click();await c.cap('Cases','bulk-actions');
  for(const [button,key] of [['Status','bulk-status'],['Assign','bulk-assign'],['Execute','bulk-execute']]) {await p.getByRole('button',{name:button,exact:true}).click();await p.getByRole('dialog').waitFor();await c.cap('Cases',key);await p.keyboard.press('Escape');}
  await p.getByRole('button',{name:'Delete',exact:true}).click();await p.getByRole('alertdialog').waitFor();await c.cap('Cases','delete-confirm');await p.getByRole('button',{name:'Batal',exact:true}).click();
  await p.getByRole('button',{name:'Clear selection'}).click();
  await p.locator('[data-search-input]').fill('no-such-synthetic-case');await c.expect(p.locator('tbody')).not.toContainText('AUTH-001');await c.cap('Cases','empty-search');await p.locator('[data-search-input]').fill('');await c.expect(p.locator('tbody')).toContainText('AUTH-001');
  await p.getByRole('button',{name:'Generate AI',exact:true}).click();await p.getByRole('dialog').waitFor();await c.cap('Cases','ai-generator');
 }
 if(mode==='inspector') {
  await c.inspector();await c.cap('Inspector','overview',{expect:'Detail Test Case'});await c.scrollBottom();await c.cap('Inspector','overview-bottom');await c.scrollTop();
  const tabs={Steps:'Test steps',Traceability:'Requirement',Execution:'Execution workspace history',Evidence:'Evidence',Bugs:'Bug',History:'History',Comments:'Komentar',Automation:'SYSTEM DEVLOG'};
  for(const [name,ready] of Object.entries(tabs)) {
   await c.inspector();await c.tab(name);let recovered=false;
   await c.expect(p.getByRole('tab',{name,exact:true})).toHaveAttribute('data-state','active');
   try {await c.expect(p.getByRole('dialog').first()).toContainText(new RegExp(ready,'i'),{timeout:2000});}catch{recovered=true;await p.getByRole('button',{name:'Tutup',exact:true}).click();await p.getByRole('button',{name:'Actions for AUTH-001',exact:true}).click();await p.getByRole('menuitem',{name:/Lihat Detail/}).click();await c.expect(p.getByRole('dialog').first()).toContainText(new RegExp(ready,'i'));}
   await c.expect(p.getByRole('dialog').first()).not.toContainText(/Memuat (execution|history|comment)/i);
   await c.cap('Inspector',name.toLowerCase(),{expect:ready,notes:recovered?'Tab body stayed empty after switching. Closing and reopening the same testcase WITHOUT route reload preserved the selected tab and mounted its content. Screenshot shows that recovered actual UI. No source or DOM style changes.':''});
  }
  await c.tab('Overview');await p.getByRole('button',{name:/Refine AI/}).click();await p.getByRole('dialog').last().waitFor();await c.cap('Inspector','ai-refiner');
 }
 if(mode==='runs-rest') {
  await c.go('test-runs');await p.getByRole('button',{name:/Sprint 12 - Checkout Regression/}).click();await p.getByLabel('Execution notes',{exact:true}).waitFor();
  await p.getByLabel('Execution notes',{exact:true}).scrollIntoViewIfNeeded();await c.cap('Test Cycles','notes-evidence');
  await p.getByRole('button',{name:'Create Bug',exact:true}).scrollIntoViewIfNeeded();await c.cap('Test Cycles','create-bug',{notes:'Contextual Create Bug control for failed execution. No second dialog is implemented; click directly links the failed execution to inventory.'});
  await p.getByRole('button',{name:'Pilih testcase',exact:true}).click();await c.cap('Test Cycles','assign-cases');
  await p.getByRole('button',{name:'Edit detail',exact:true}).click();await c.cap('Test Cycles','edit-cycle');
  await p.getByRole('button',{name:'Cycle baru',exact:true}).click();await c.cap('Test Cycles','new-cycle');
  await p.getByRole('button',{name:/Pilih periode cycle/}).first().click();await c.cap('Test Cycles','cycle-dates');
 }
 if(mode==='report-previews') {
  for(const [i,key] of [[2,'draft-preview'],[1,'final-preview'],[0,'planning-preview']]) {
   await c.go('reports');await p.getByRole('button',{name:'Lihat',exact:true}).nth(i).click();await c.expect(p.locator('main')).toContainText(/VIS-(DRAFT|FINAL|PLAN)/);await c.cap('Reports',key);
   if(i===2){await c.scrollBottom();await c.cap('Reports','draft-bottom');}
   if(i===1){console.log((await p.locator('main').innerText()).slice(0,5500));}
  }
 }
 if(mode==='settings-rest') {
  await c.go('settings');await c.tab('Projects');console.log((await p.locator('main').innerText()));
  await p.getByRole('button',{name:/Project Baru/i}).click();await p.getByRole('dialog').waitFor();await c.cap('Settings','create-project');await p.keyboard.press('Escape');
  await c.tab('Modules');await p.getByRole('button',{name:/Module Baru/i}).click();await p.getByRole('dialog').waitFor();await c.cap('Settings','create-module');await p.keyboard.press('Escape');
  await c.tab('Knowledge');const card=p.locator('div.group').filter({hasText:'Application under test'}).last();await card.hover();await card.getByRole('button').first().click();await c.scrollTop();await c.cap('Settings','knowledge-edit');
 }
 if(mode==='upload') {
  const buffer=await fs.readFile(path.join(c.out,'screenshots/desktop/UI-001-dashboard-overview.png'));
  const response=await c.context.request.post(`${c.f.origin}/api/test-runs/${c.data.runId}/executions/${c.data.executionId}/evidence?projectId=${c.data.projectId}`,{headers:{origin:c.f.origin},multipart:{file:{name:'synthetic-release-readiness.png',mimeType:'image/png',buffer}}});
  if(!response.ok())throw new Error('Synthetic evidence upload failed '+response.status());
  console.log('Synthetic evidence uploaded through actual application API.');
 }
 if(mode==='import') {
  const XLSX=(await import('xlsx')).default;const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['ID','Page','Feature','Test','Action','Steps','Expected Result','Status'],['VIS-IMPORT-001','Checkout','Payment','Positive','Validate card payment','Open checkout; complete payment','One confirmed order','NOT DONE'],['AUTH-001','Login','Authentication','Negative','Reject expired session','Open login','Session expired message','FAILED']]),'Checkout');
  const file=path.join(c.root,'synthetic-preview.xlsx');XLSX.writeFile(wb,file);await c.go('test-cases');await p.getByRole('button',{name:'Import Excel',exact:true}).click();await p.locator('input[type=file]').setInputFiles(file);await p.getByRole('dialog').waitFor();await c.expect(p.getByRole('dialog')).toContainText(/preview|pratinjau/i);await c.expect(p.getByRole('dialog')).toContainText('VIS-IMPORT-001');await c.cap('Cases','import-preview',{notes:'Preview only; import not committed. Duplicate display ID included deliberately to show validation.'});
 }
 if(mode==='automation') {
  await c.go('automation');await c.expect(p.locator('main')).toContainText('AUTH-001');await c.cap('Automation','history',{notes:'Real UI populated with synthetic JSONL fixture; private relay3117, never user3001.'});console.log((await p.locator('main').innerText()));console.log(await p.getByRole('button').evaluateAll(es=>es.map(e=>({text:e.innerText,label:e.getAttribute('aria-label')}))));
 }
 if(mode==='devlog') {
  await c.inspector();await c.recoveredTab('Automation','System DevLog');await c.expect(p.getByRole('dialog').first()).toContainText(/Screen Analytics/i);await c.cap('Inspector','automation',{notes:'Synthetic recording and logs from owned relay3117; initial tab navigation required close/reopen. RELAY OFFLINE refers to deliberately blocked live WebSocket.'});
  await p.getByRole('button',{name:/^Network \(/}).click();await p.getByRole('heading',{name:'System DevLog'}).scrollIntoViewIfNeeded();await c.cap('Inspector','automation-network');
  const row=p.getByText('session',{exact:true}).last();await row.click();await c.cap('Inspector','automation-network-detail');
  await p.getByRole('button',{name:/^Console \(/}).click();await c.cap('Inspector','automation-console');
  await p.getByRole('button',{name:'Execution',exact:true}).click();await c.cap('Inspector','automation-execution');
  await p.getByRole('button',{name:'Fullscreen',exact:true}).last().click();await p.getByRole('button',{name:'Close fullscreen DevLog'}).waitFor();await c.cap('Inspector','automation-fullscreen');
  await p.getByRole('button',{name:'Network',exact:true}).click();await p.getByText('session',{exact:true}).last().click();await c.cap('Inspector','automation-event-detail');await p.getByRole('button',{name:'Close fullscreen DevLog'}).click();
  await p.getByRole('button',{name:'Review',exact:true}).click();await c.expect(p.locator('body')).toContainText(/Screen Record Review/i);await c.cap('Inspector','automation-timeline',{notes:'Actual fullscreen review UI playing a three-second synthetic recording of the captured QADesk dashboard. This is fixture media, not a real tested website recording.'});
 }
 if(mode==='new-version') {await c.go('reports');await p.getByRole('button',{name:'Lihat',exact:true}).first().click();await c.expect(p.locator('main')).toContainText('1.0.1');await c.cap('Reports','new-version',{notes:'Actual version action previously created this new synthetic draft (1.0.1). Existing result read back; action not repeated.'});}
 if(mode==='evidence') {
  await c.inspector();await c.recoveredTab('Evidence','synthetic-release-readiness.png');await c.cap('Inspector','evidence',{expect:'synthetic-release-readiness.png'});
  await p.goto(`${c.f.origin}/api/evidence?testCaseId=${c.data.caseId}&projectId=${c.data.projectId}`);await c.expect(p.locator('body')).toContainText('AUTH-001');await c.cap('Inspector','evidence-report',{documentTheme:true,notes:'Actual inline HTML evidence report endpoint. Export template has its own fixed light appearance; no style override, no download flag.'});
  await c.go('automation');await p.getByRole('button',{name:'View run AUTH-001',exact:true}).click();await p.getByRole('dialog').waitFor();await c.cap('Automation','record-detail');
 }
 if(mode==='supplement') {
  for(const [module,key] of [['Cases','table-bottom'],['Cases','create-bottom'],['Inspector','transition-empty-body'],['Reports','draft-middle'],['Inspector','timeline-event-menu']])await c.addState(module,key);
  await c.inspector();await c.recoveredTab('Bugs','Bugs terkait');await c.expect(p.getByRole('dialog').first()).not.toContainText('Memuat bugs');await c.cap('Inspector','bugs',{expect:'Buka data bug',notes:'Tab content recovered by closing/reopening inspector without route reload.'});
  await c.inspector();await c.recoveredTab('History','Immutable audit history');await c.expect(p.getByRole('dialog').first()).toContainText('Review Tester');await c.cap('Inspector','history',{expect:'Before:',notes:'Tab content recovered by closing/reopening inspector without route reload.'});
  await c.inspector();await c.tab('Steps');await c.expect(p.getByText('Test steps',{exact:true})).toHaveCount(0);await c.cap('Inspector','transition-empty-body',{notes:'Observed defect: Steps selected but no Test steps section mounted after normal tab switch. Other tab captures use documented close/reopen recovery. Source unchanged.'});
  await c.go('test-cases');await c.scrollBottom();await c.cap('Cases','table-bottom');await c.scrollTop();await p.getByRole('button',{name:/Add Test Case/}).click();await p.getByRole('dialog').waitFor();await c.scrollBottom();await c.cap('Cases','create-bottom');
  await c.go('reports');await p.getByRole('button',{name:'Lihat',exact:true}).last().click();await p.getByRole('heading',{name:'Progress Against Test Plan',exact:true}).scrollIntoViewIfNeeded();await c.cap('Reports','draft-middle');
  await c.inspector();await c.recoveredTab('Automation','System DevLog');await p.getByRole('button',{name:'Review',exact:true}).click();await p.getByTitle(/2 events pada/).click();await c.expect(p.locator('body')).toContainText('Event pada timestamp ini');await c.cap('Inspector','timeline-event-menu',{notes:'Two actual synthetic events share the same timestamp; native timeline popover shows each event.'});
 }
 if(mode==='timeline') {await c.inspector();await c.recoveredTab('Automation','System DevLog');await p.getByRole('button',{name:'Review',exact:true}).click();await p.getByTitle(/2 events pada/).click();await c.expect(p.locator('body')).toContainText('Event pada timestamp ini');await c.cap('Inspector','timeline-event-menu',{notes:'Two actual synthetic events share a timestamp; native popover lists individual events.'});}
 if(['compact','narrow','light'].includes(mode)) {
  const modules={Dashboard:'dashboard',Cases:'test-cases',Bugs:'bugs','Test Cycles':'test-runs',Reports:'reports',Settings:'settings',Traceability:'traceability'};
  for(const [module,section] of Object.entries(modules)) {
   if(mode==='compact'&&module==='Traceability')continue;
   await c.go(section);if(module==='Test Cycles'){await p.getByRole('button',{name:/Sprint 12 - Checkout Regression/}).click();await p.getByLabel('Execution notes',{exact:true}).waitFor();}
   await c.cap(module,mode,{notes:mode==='narrow'?'Actual responsive rendering; no mobile layout modifications.':''});
  }
  if(mode!=='compact') {await c.inspector();await c.cap('Inspector',mode);await p.getByRole('button',{name:'Tutup',exact:true}).click();if(mode==='narrow')await p.getByRole('button',{name:'Toggle Sidebar',exact:true}).filter({visible:true}).first().click();else await p.getByRole('button',{name:/^Notifikasi/}).click();await c.cap('Global',mode);}
 }
 if(mode==='empty') {
  const req=(await import('node:module')).createRequire(import.meta.url);const db=new(req('@prisma/client').PrismaClient)({datasourceUrl:c.f.databaseUrl});await db.testCase.deleteMany({where:{projectId:c.f.second.id,testCaseId:'ALT-001'}});await db.$disconnect();
  for(const [module,section,ready]of [['Bugs','bugs','Tidak ada bug'],['Test Cycles','test-runs','Belum ada Test'],['Traceability','traceability','requirement'],['Reports','reports','Belum ada report'],['Automation','automation','Belum ada test record']]) {
   await c.go(section,c.f.second.id);await c.expect(p.locator('main')).toContainText(new RegExp(ready,'i'));await c.cap(module,'empty',{notes:'Empty synthetic project Mercury Mobile - Empty.',navigationPath:'Project selector → Mercury Mobile - Empty → '+module});
  }
 }
 if(mode==='login') {await p.goto(c.f.origin+'/login');await p.getByLabel('Email',{exact:true}).waitFor();await c.cap('Global','login',{role:'ANONYMOUS'});await p.getByRole('button',{name:/Masuk/}).click();await c.cap('Global','login-validation',{role:'ANONYMOUS',notes:'Native required-field validation on an empty form; no credentials entered.'});}
 if(mode==='error') {await c.context.route('**/api/reports?**',r=>r.fulfill({status:500,contentType:'application/json',body:JSON.stringify({error:'Synthetic visual audit: report service unavailable.'})}));await p.goto(c.f.origin+'/projects/'+c.f.project.id+'/reports');await c.expect(p.locator('main')).toContainText(/unavailable|Gagal/i);await c.cap('Reports','error',{notes:'CONTROLLED ERROR: browser intercepted reports GET and returned500. Existing error UI rendered; not an observed server regression.'});}
 if(mode==='loading') {
  let release,arrived;const held=new Promise(r=>release=r),seen=new Promise(r=>arrived=r);
  await c.context.route('**/api/testcases?**',async r=>{arrived();await held;await r.continue();});
  await p.goto(c.f.origin+'/projects/'+c.f.project.id+'/test-cases');await seen;await p.getByRole('button',{name:/Add Test Case/}).waitFor();await c.cap('Global','loading',{notes:'CONTROLLED LOADING: held real testcase GET before releasing it. Deliberate skeleton capture, not a settled populated screen.'});release();
 }
 if(mode==='bugs') {
  await c.go('bugs');await c.cap('Bugs','active');await p.getByRole('button',{name:'Status for bug AUTH-001',exact:true}).click();await c.cap('Bugs','status-menu');await p.keyboard.press('Escape');
  await p.getByRole('button',{name:'View bug AUTH-001',exact:true}).click();await p.getByRole('dialog').waitFor();await c.tab('Lifecycle');await c.cap('Bugs','detail-lifecycle');await p.getByRole('button',{name:'Tutup',exact:true}).click();
  await p.getByRole('tab',{name:/Riwayat Fixed/}).click();await c.cap('Bugs','resolved');
 }
 if(mode==='traceability') {
  await c.go('traceability');await p.getByRole('button').filter({hasText:'REQ-AUTH-01'}).first().click();await c.cap('Traceability','lanes');
  await p.getByRole('button',{name:/View Uncovered Gaps/}).click();await c.cap('Traceability','uncovered');await p.getByRole('button',{name:/View Uncovered Gaps/}).click();
  await p.getByRole('button',{name:'Buat Relation',exact:true}).click();await p.getByRole('dialog').waitFor();await c.cap('Traceability','new-relation');await c.scrollBottom();await c.cap('Traceability','new-relation-bottom');await p.keyboard.press('Escape');
  await p.getByRole('button',{name:'Manage Relations',exact:true}).click();await p.getByRole('dialog').waitFor();await c.cap('Traceability','manage-relation');
 }
 if(mode==='settings') {
  await c.go('settings');await c.expect(p.locator('main')).not.toContainText('Memeriksa');await c.cap('Settings','system',{expect:'Database migrations'});
  for(const [name,key] of [['Team','team'],['AI','ai'],['Projects','projects'],['Knowledge','knowledge'],['Integrations','integrations'],['Modules','modules']]) {await c.tab(name);await c.cap('Settings',key);if(name==='AI'){await c.scrollBottom();await c.cap('Settings','ai-bottom');await c.scrollTop();}}
  console.log((await p.locator('body').innerText()).slice(-9000));
 }
 if(mode==='global') {
  await c.go('dashboard');
  for(const [loc,key] of [[p.getByRole('button',{name:/^Notifikasi/}),'notifications'],[p.getByRole('button',{name:/Cari atau pindah menu/}),'command-search'],[p.getByRole('combobox').first(),'project-menu'],[p.getByRole('button',{name:'Menu akun'}),'account-menu'],[p.getByRole('button',{name:'Toggle theme',exact:true}),'theme-menu'],[p.getByRole('button',{name:'Open QA AI chat'}),'ai-chat']]) {await loc.click();await c.cap('Global',key);await p.keyboard.press('Escape');}
 }
 if(mode==='runs') {
  await c.go('test-runs');await c.cap('Test Cycles','list');await p.getByRole('button',{name:/Sprint 12 - Checkout Regression/}).click();await p.getByLabel('Execution notes',{exact:true}).waitFor();await c.cap('Test Cycles','workspace');console.log((await p.locator('body').innerText()).slice(-13000));console.log(await p.getByRole('button').allTextContents());
 }
 if(mode==='reports') {
  await c.go('reports');await c.cap('Reports','list');await p.getByRole('button',{name:'Buat Report',exact:true}).click();await p.getByLabel('Document ID',{exact:true}).waitFor();await c.cap('Reports','create-status');
  await p.getByLabel('Source Test Cycle',{exact:true}).click();await c.cap('Reports','source-select');await p.keyboard.press('Escape');
  await p.getByRole('button',{name:/^Periode report/}).click();await c.cap('Reports','date-picker');await p.keyboard.press('Escape');
  await p.getByLabel('Template',{exact:true}).click();await p.getByRole('option',{name:'Test Planning FDS',exact:true}).click();await c.cap('Reports','create-planning');await c.scrollBottom();await c.cap('Reports','form-bottom');
 }
 if(mode==='viewer') {await c.go('test-cases');await c.cap('Global','viewer-cases',{role:'VIEWER'});await c.go('settings');await c.tab('Team');await c.cap('Settings','viewer-team',{role:'VIEWER'});}
 if(mode==='inspect') {await c.go(process.argv[3]||'test-cases');console.log((await p.locator('body').innerText()).slice(-18000));console.log(await p.getByRole('button').evaluateAll(es=>es.map(e=>({name:e.getAttribute('aria-label'),text:e.innerText})).filter(x=>x.text||x.name)));}
} finally {await c.close();}
