// Evidence-only collector. Uses an already-owned disposable Phase7 environment.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const { chromium, expect } = require('@playwright/test');
export const root = process.env.QA_PHASE7_ROOT || 'C:/Users/Admin/AppData/Local/Temp/qadesk-phase7-UPzEgU';
if (!/^qadesk-phase7-/.test(path.basename(root))) throw new Error('Disposable environment required');
export const f = JSON.parse(await fs.readFile(path.join(root,'fixture.json'),'utf8'));
export const data = JSON.parse(await fs.readFile(path.join(root,'phase8a-data.json'),'utf8'));
export const out = path.resolve('artifacts/ui-review/phase8a');
const groups = {
 Dashboard:['overview','attention','module-progress'],
 Cases:['table','compact-density','filters','date-picker','columns','saved-views','export-menu','row-menu','status-menu','create','validation','edit','bulk-actions','bulk-status','bulk-assign','bulk-execute','delete-confirm','empty-search','import-preview','ai-generator'],
 Inspector:['overview','overview-bottom','steps','traceability','execution','evidence','bugs','history','comments','automation','automation-network','automation-network-detail','automation-console','automation-execution','automation-fullscreen','automation-event-detail','automation-timeline','ai-refiner','evidence-report'],
 Bugs:['active','resolved','status-menu','detail-lifecycle','empty'],
 'Test Cycles':['list','workspace','notes-evidence','create-bug','new-cycle','cycle-dates','edit-cycle','assign-cases','empty'],
 Traceability:['lanes','uncovered','new-relation','new-relation-bottom','manage-relation','empty'],
 Reports:['list','create-status','source-select','date-picker','create-planning','form-bottom','draft-preview','draft-bottom','final-preview','planning-preview','new-version','empty','error'],
 Settings:['system','team','ai','ai-bottom','projects','create-project','knowledge','knowledge-edit','integrations','modules','create-module','viewer-team'],
 Automation:['history','record-detail','empty'],
 Global:['notifications','command-search','project-menu','account-menu','theme-menu','ai-chat','viewer-cases','login','login-validation','loading'],
};
const plans=[];
function plan(module,key,category='desktop',theme='dark') { plans.push({id:`UI-${String(plans.length+1).padStart(3,'0')}`,module,key,category,theme,viewport:category==='compact'?{width:1366,height:768}:category==='narrow'?{width:390,height:844}:{width:1440,height:900},status:'NOT TESTED'}); }
for (const [m,keys] of Object.entries(groups)) for(const k of keys) plan(m,k);
for(const m of ['Dashboard','Cases','Bugs','Test Cycles','Reports','Settings']) plan(m,'compact','compact');
for(const m of ['Dashboard','Cases','Inspector','Bugs','Test Cycles','Traceability','Reports','Settings','Global']) plan(m,'narrow','narrow');
for(const m of ['Dashboard','Cases','Inspector','Bugs','Test Cycles','Traceability','Reports','Settings','Global']) plan(m,'light','alternate-theme','light');
let manifest;
try { manifest=JSON.parse(await fs.readFile(path.join(out,'manifest.json'),'utf8')); } catch { manifest={identity:{},screens:plans,unavailable:[{screen:'Standalone Requirements / Test Plans / Evidence / Project Knowledge routes',status:'NOT IMPLEMENTED',notes:'Existing features are nested in Traceability, inspector, execution workspace and Settings.'},{screen:'First-owner bootstrap',status:'NOT TESTED',notes:'Requires a database without any account. Populated synthetic login captured instead.'}]}; }
export let browser,context,page;
export async function init(role='owner',category='desktop',theme='dark') {
 await fs.mkdir(out,{recursive:true});
 for(const dir of ['desktop','compact','narrow','alternate-theme']) await fs.mkdir(path.join(out,'screenshots',dir),{recursive:true});
 if(!manifest.identity.gitSha) {
  const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
  const files=git('ls-files','src','prisma','package.json','package-lock.json','next.config.ts','components.json').split('\n').filter(x=>x&&!/\.(test|spec)\./.test(x));
  for(const extra of ['src/components/WorkspaceAccess.tsx','src/lib/client/workspace-permissions.ts']) if(!files.includes(extra)) files.push(extra);
  const hashes={}; for(const file of files.sort()) hashes[file]=crypto.createHash('sha256').update((await fs.readFile(file,'utf8')).replaceAll('\r\n','\n')).digest('hex');
  await fs.writeFile(path.join(root,'phase8a-source-hashes.json'),JSON.stringify(hashes));
  const build=JSON.parse(await fs.readFile(path.join(root,'owned-server.json'),'utf8'));
  manifest.identity={gitSha:git('rev-parse','HEAD'),branch:git('branch','--show-current'),workingTree:'Includes uncommitted Phase6C,7,7.1 source changes; no staging or production edits in Phase8A.',sourceHash:crypto.createHash('sha256').update(JSON.stringify(hashes)).digest('hex'),buildId:(await fs.readFile(path.join(build.build,'.next/BUILD_ID'),'utf8')).trim(),origin:f.origin,fixture:'Disposable synthetic SQLite; no real user data',deviceScaleFactor:1,reducedMotion:'reduce',startedAt:new Date().toISOString(),relay:'All browser requests to port3001 blocked until isolated relay forwarding is explicitly configured.'};
 }
 browser=await chromium.launch({headless:true});
 const vp=category==='compact'?{width:1366,height:768}:category==='narrow'?{width:390,height:844}:{width:1440,height:900};
 context=await browser.newContext({viewport:vp,deviceScaleFactor:1,reducedMotion:'reduce',colorScheme:theme==='light'?'light':'dark'});
 let relay;try{relay=JSON.parse(await fs.readFile(path.join(root,'phase8a-relay-private.json'),'utf8'));}catch{}
 await context.route(/https?:\/\/(127\.0\.0\.1|localhost):3001\//,async route=>{
  if(!relay)return route.abort();
  const url=new URL(route.request().url());url.port='3117';url.searchParams.delete('access_token');
  const response=await route.fetch({url:url.toString(),headers:{...route.request().headers(),authorization:`Bearer ${relay.token}`}});
  await route.fulfill({response});
 });
 await context.routeWebSocket(/ws:\/\/(127\.0\.0\.1|localhost):3001/,ws=>ws.close());
 if(role!=='anonymous') await context.addCookies([{name:'qa_session',value:f.actors[role].token,url:f.origin}]);
 page=await context.newPage();
 page.setDefaultTimeout(6000);
 page.on('dialog',d=>d.accept());
 manifest.identity.browser=await browser.version();
 if(relay)manifest.identity.relay='Browser HTTP to compiled port3001 forwarded to unmodified owned relay3117 with private synthetic logs/video. WebSocket3001 blocked. RELAY OFFLINE reflects disabled live socket, not a test of user relay.';
 // Theme preference is public UI state, not a style override.
 await context.addInitScript(value=>localStorage.setItem('web-qa:theme',value),theme);
 await save();
 return page;
}
export async function save() {
 try { const disk=JSON.parse(await fs.readFile(path.join(out,'manifest.json'),'utf8'));for(const s of manifest.screens){const d=disk.screens.find(x=>x.id===s.id);if(d&&d.capturedAt&&(!s.capturedAt||d.capturedAt>s.capturedAt))Object.assign(s,d);} }catch{}
 await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2));
 const rows=manifest.screens.map(s=>`| ${s.id} | ${s.module} | ${s.key} | ${s.category} / ${s.theme} | ${s.status} |`).join('\n');
 await fs.writeFile(path.join(out,'screen-inventory.md'),`# QADesk Phase8A screen inventory\n\nPlanned before first screenshot. Eight actual navigation routes verified in browser: dashboard, test-cases, bugs, automation, test-runs, traceability, reports, settings. Requirements and Test Plans are Traceability lanes and relationship sheets; Evidence is nested in inspector/execution; Project Knowledge is in Settings.\n\nPrimary capture:1440x900; compact:1366x768; narrow:390x844; scale1; reduced motion; default dark and alternate light.\n\n| ID | Module | Screen/state | Class/theme | Status |\n|---|---|---|---|---|\n${rows}\n\n## Conditions not captured\n${manifest.unavailable.map(x=>`- ${x.screen}: ${x.status}. ${x.notes}`).join('\n')}\n\nThis is a visual evidence collection, not functional/security/performance acceptance. No production UI changes.\n`);
}
const ready={dashboard:'Release belum siap','test-cases':'AUTH-001',bugs:'AUTH-001',automation:'Automation','test-runs':'Sprint 12 - Checkout Regression',traceability:'REQ-AUTH-01',reports:'Test Status Report',settings:'System readiness'};
export async function go(section,projectId=f.project.id) {
 await page.goto(`${f.origin}/projects/${projectId}/${section}`);
 await page.locator('main h1').waitFor();
 if(projectId===f.project.id) await expect(page.locator('main')).toContainText(ready[section],{timeout:20000});
 await settled();
}
export async function settled() {
 await page.evaluate(async()=>{await document.fonts.ready; await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
 await page.evaluate(async()=>{await Promise.allSettled(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished));});
 await expect(page.locator('[aria-label="Memuat detail testcase"]')).toHaveCount(0);
}
export async function cap(module,key,options={}) {
 const item=manifest.screens.find(s=>s.module===module&&s.key===key);
 if(!item) throw new Error(`Unplanned capture ${module}/${key}`);
 await settled();
 if(options.expect) await expect(page.locator('body')).toContainText(new RegExp(options.expect,'i'));
 await page.mouse.move(1,1);
 const filename=`screenshots/${item.category}/${item.id}-${module.toLowerCase().replaceAll(' ','-')}-${key}.png`;
 const identity=await page.evaluate(()=>({title:document.title,url:location.pathname,theme:document.documentElement.classList.contains('dark')?'dark':'light',scroll:{x:scrollX,y:scrollY,containers:[...document.querySelectorAll('*')].filter(e=>e.scrollTop>0||e.scrollLeft>0).map(e=>({tag:e.tagName,role:e.getAttribute('role'),x:e.scrollLeft,y:e.scrollTop})).slice(0,12)},bodyText:document.body.innerText,overflow:document.documentElement.scrollWidth>innerWidth}));
 if(options.documentTheme)item.theme=identity.theme;
 if(identity.theme!==item.theme) throw new Error('Theme mismatch');
 if(identity.bodyText.length<100) throw new Error('Incomplete identity');
 const buffer=await page.screenshot({path:path.join(out,filename),animations:'allow',fullPage:false,caret:'hide'});
 Object.assign(item,{filename,screenName:`${module} — ${key}`,state:key,route:identity.url,navigationPath:options.navigationPath||module,role:options.role||'OWNER',workspace:'Mercury Quality Workspace',project:identity.url.includes(captureEmptyId())?'Mercury Mobile - Empty':'Mercury Commerce QA',imageWidth:buffer.readUInt32BE(16),imageHeight:buffer.readUInt32BE(20),scroll:identity.scroll,documentHorizontalOverflow:identity.overflow,status:'CAPTURED',capturedAt:new Date().toISOString(),notes:options.notes||'',pageIdentity:{title:identity.title,textSha256:crypto.createHash('sha256').update(identity.bodyText).digest('hex'),expected:options.expect||module},sha256:crypto.createHash('sha256').update(buffer).digest('hex')});
 await save(); console.log(`${item.id} ${module}/${key}`); return path.join(out,filename);
}
function captureEmptyId(){return f.second.id;}
export async function skip(module,key,note,status='INACCESSIBLE') {const s=manifest.screens.find(x=>x.module===module&&x.key===key);Object.assign(s,{status,notes:note});await save();}
export async function addState(module,key,notes='') {if(!manifest.screens.some(s=>s.module===module&&s.key===key)){manifest.screens.push({id:`UI-${String(manifest.screens.length+1).padStart(3,'0')}`,module,key,category:'desktop',theme:'dark',viewport:{width:1440,height:900},status:'NOT TESTED',notes});await save();}}
export async function close() {await browser.close();}
export async function inspector() {await go('test-cases'); await page.getByRole('button',{name:'Actions for AUTH-001',exact:true}).click();await page.getByRole('menuitem',{name:'Lihat Detail',exact:false}).click();await page.getByRole('dialog').waitFor(); await settled();}
export async function tab(name) {await page.getByRole('tab',{name,exact:true}).click();await settled();}
export async function recoveredTab(name,expected) {expected=typeof expected==='string'?new RegExp(expected,'i'):expected;await tab(name);try{await expect(page.getByRole('dialog').first()).toContainText(expected,{timeout:1500});}catch{await page.getByRole('button',{name:'Tutup',exact:true}).click();await page.getByRole('button',{name:'Actions for AUTH-001',exact:true}).click();await page.getByRole('menuitem',{name:/Lihat Detail/}).click();await expect(page.getByRole('dialog').first()).toContainText(expected);}await settled();}
export async function scrollBottom() {await page.evaluate(()=>{const a=[...document.querySelectorAll('*')].filter(e=>e.scrollHeight>e.clientHeight+60&&/auto|scroll/.test(getComputedStyle(e).overflowY)); for(const e of a)e.scrollTop=e.scrollHeight;}); await settled();}
export async function scrollTop() {await page.evaluate(()=>{for(const e of document.querySelectorAll('*')) if(e.scrollTop)e.scrollTop=0;scrollTo(0,0)});}
export { expect };
