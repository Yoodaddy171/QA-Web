// Run against an already-started isolated standalone server, never next dev.
// QA_BENCH_ROOT resolves dependencies from either build worktree.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
const root = path.resolve(process.env.QA_BENCH_ROOT || process.cwd());
const require = createRequire(path.join(root, 'package.json'));
const { chromium, expect } = require('@playwright/test');
const baseURL = process.env.QA_BENCH_URL || 'http://127.0.0.1:3100';
const repetitions = Number(process.env.QA_BENCH_REPETITIONS || 10);
const tracing = process.env.QA_BENCH_TRACE === '1';
const diagnostic = process.env.QA_BENCH_DIAGNOSTIC || '';
if (!/^http:\/\/127\.0\.0\.1:31\d\d$/.test(baseURL)) throw new Error('Use an isolated loopback 31xx port');
const output = path.join(os.tmpdir(), `qadesk-phase2-${process.env.QA_BENCH_LABEL || 'baseline'}`);
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
const auth = await context.request.post(`${baseURL}/api/auth/login`, { headers: { Origin: baseURL }, data: { email: 'owner@qa-desk.test', password: 'E2E-only-password-2026!' } });
if (!auth.ok()) throw new Error(`Isolated fixture login failed: ${auth.status()}`);
const fixtureRows=[];
for(const pageNumber of [1,2]){const response=await context.request.get(`${baseURL}/api/testcases?projectId=perf-project&limit=100&page=${pageNumber}&sortBy=testCaseId&sortOrder=asc`);if(!response.ok())throw new Error('Synthetic fixture read failed');fixtureRows.push(...(await response.json()).testCases);}
const datasetHash=createHash('sha256').update(JSON.stringify(fixtureRows)).digest('hex');
const expectedBuildId = (await fs.readFile(path.join(root,'.next/BUILD_ID'),'utf8')).trim();
const manifestPath = `_next/static/${expectedBuildId}/_buildManifest.js`;
const servedManifest = await context.request.get(`${baseURL}/${manifestPath}`);
if (!servedManifest.ok() || (await servedManifest.text()) !== await fs.readFile(path.join(root,'.next/static',expectedBuildId,'_buildManifest.js'),'utf8')) throw new Error('Running server build ID does not match the evaluated standalone build');
const events = Array.from({ length: 500 }, (_, i) => ({ id: `fixture-${i}`, eventId: `fixture-${i}`, testCaseId: 'perf-case-1', runner: 'manual', source: 'manual-capture', sessionId: 'synthetic-recording', relativeMs: i * 20, timestamp: new Date(1700000000000 + i * 20).toISOString(), category: i % 3 === 0 ? 'network' : i % 3 === 1 ? 'console' : 'execution', event: i % 3 === 0 ? 'network.response' : i % 3 === 1 ? 'console.log' : 'interaction.click', level: i % 17 ? 'INFO' : 'SEVERE', log: `Synthetic interaction ${i}: clicking Confirm order`, network: i % 3 === 0 ? { method: 'POST', url: `https://fixture.example/api/orders/${i}`, status: i % 17 ? 200 : 400, duration: 90, headers: { request: { 'Content-Type': 'application/json' }, response: { 'Content-Type': 'application/json' } }, data: { request: { order: i }, response: { rows: Array.from({ length: 100 }, (_, n) => ({ id: n, label: 'Representative synthetic payload' })) } } } : undefined }));
if (process.env.QA_BENCH_FUNCTIONAL === '1') for (const event of events) {
  if (event.network) event.network.data.requestBody = event.network.data.request;
}
const video = await fs.readFile(path.join(os.tmpdir(), 'qadesk-performance-video.mp4'));
await context.route('http://127.0.0.1:3001/**', async route => {
  const url = new URL(route.request().url());
  if (url.pathname === '/fixture-video.mp4') {
    const range = route.request().headers().range?.match(/bytes=(\d+)-(\d*)/);
    const start = range ? Number(range[1]) : 0, end = range && range[2] ? Number(range[2]) : video.length - 1;
    return route.fulfill({ status: range ? 206 : 200, contentType: 'video/mp4', headers: { 'Accept-Ranges':'bytes', ...(range ? {'Content-Range':`bytes ${start}-${end}/${video.length}`} : {}) }, body:video.subarray(start,end+1) });
  }
  if (url.pathname.startsWith('/logs/')) return route.fulfill({ contentType: 'text/plain', body: events.map(e => JSON.stringify(e)).join('\n') });
  if (url.pathname.includes('/recordings/')) return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ recording: { mode:'video',sessionId:'synthetic-recording',testCaseId:'perf-case-1',targetUrl:'https://fixture.example',startedAt:new Date(1700000000000).toISOString(),stoppedAt:new Date(1700000010000).toISOString(),frameIntervalMs:1000,status:'stopped',frames:[],video:{file:'fixture-video.mp4',url:'http://127.0.0.1:3001/fixture-video.mp4',mimeType:'video/mp4',durationMs:10000,width:640,height:360,fps:30,status:'ready'} } }) });
  return route.fulfill({ contentType: 'application/json', body: '{}' });
});
await context.routeWebSocket('ws://127.0.0.1:3001/**', ws => { ws.onMessage(() => {}); });
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto(`${baseURL}/projects/perf-project/test-cases`);
await page.getByText('PERF-001', { exact: true }).first().waitFor();
const menu = label => page.locator('[data-sidebar="menu-button"]').filter({ hasText: label }).first();
const openInspector = async () => {
  await page.getByText('PERF-001', { exact: true }).first().click();
  await page.getByRole('dialog').waitFor();
};
const closeInspector = async () => { await page.keyboard.press('Escape'); await page.getByRole('dialog').waitFor({ state: 'hidden' }); };
const applyDiagnostic = async () => {
  if (diagnostic === 'scoped-theme-guard') {
    await page.evaluate(() => {
      const removeBroadGuard = sheet => {
        for (let i=sheet.cssRules.length-1;i>=0;i--) {
          const rule=sheet.cssRules[i];
          if (rule.selectorText?.includes('html[data-theme-changing] *')) sheet.deleteRule(i);
          else if (rule.cssRules) removeBroadGuard(rule);
        }
      };
      for(const sheet of document.styleSheets) { try { removeBroadGuard(sheet); } catch { /* Cross-origin styles are not diagnostic targets. */ } }
    });
    await page.addStyleTag({content:'html[data-theme-changing] :is([class*="transition"],.qa-interactive,body,header,main,nav,[data-slot="card"]) { transition-property:transform,opacity!important; }'});
  }
  if (diagnostic === 'no-color') await page.addStyleTag({content:'*,*::before,*::after { transition-property: transform, opacity !important; }'});
  if (diagnostic === 'no-sticky') await page.addStyleTag({content:'td.sticky,th.sticky { position:static!important; }'});
  if (diagnostic === 'light-paint') await page.addStyleTag({content:'table *,table { box-shadow:none!important;border-color:transparent!important; }'});
  if (diagnostic === 'light-cells') await page.evaluate(()=>document.querySelectorAll('tbody td').forEach(cell=>{cell.textContent=cell.textContent;}));
  if (/^(20|50)$/.test(diagnostic)) await page.evaluate(count=>document.querySelectorAll('tbody tr').forEach((row,i)=>{if(i>=count)row.remove();}),Number(diagnostic));
  if (diagnostic === 'isolated-table') await page.addStyleTag({content:'[data-sidebar],header {visibility:hidden!important;}'});
};
const set100 = async () => {
  await page.locator('tbody tr').first().waitFor();
  await page.getByText('PERF-001', { exact: true }).first().waitFor();
  const combobox = page.locator('[data-slot="select-trigger"]').last();
  await combobox.waitFor();
  await combobox.click(); await page.getByRole('option', { name: '100', exact: true }).click();
  await page.locator('tbody tr').nth(99).waitFor();
  await applyDiagnostic();
};
await set100();
await page.screenshot({ path: path.join(output, 'authenticated-production.png') });
const cdp = await context.newCDPSession(page);
let layerCount = null;
if(process.env.QA_BENCH_LAYERS==='1'){await cdp.send('LayerTree.enable');cdp.on('LayerTree.layerTreeDidChange',event=>{layerCount=event.layers?.length??null;});}
const results = { environment: { baseURL, node: process.version, browser: browser.version(), os: `${os.platform()} ${os.release()}`, viewport: { width: 1440, height: 900 }, headless: false, repetitions: 5, warmups: 1, windowMs: {default:1800,'rapid-menu-navigation':8000,'cases-filter-sort':6000,'cases-scroll':3000,'network-expansion':3000,'fullscreen-devlog':5000,'recording-playback':4000,'theme-switch':10000}, method: 'rAF callback intervals, Long Tasks API, React production Profiler and CDP trace; not exact compositor FPS' }, scenarios: [], errors };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const windowOverrides = JSON.parse(process.env.QA_BENCH_WINDOWS || '{}');
for (const [scenario, duration] of Object.entries(windowOverrides)) {
  if (!Number.isFinite(duration) || duration < 1800 || duration > 30000) throw new Error(`Invalid benchmark window for ${scenario}`);
  results.environment.windowMs[scenario] = duration;
}
Object.assign(results.environment,{repetitions,warmups:1,tracing,diagnostic,profiler:await page.evaluate(()=>Boolean(window.__qaCommits)),buildId:expectedBuildId,buildVerified:true,method:'rAF intervals and Long Tasks; CDP trace and production React Profiler only when explicitly enabled; not compositor FPS'});
Object.assign(results.environment,{datasetHash,fixtureRows:fixtureRows.length});
const percentile = (a, p) => a.length ? [...a].sort((x,y) => x-y)[Math.min(a.length-1, Math.ceil(a.length*p)-1)] : null;
async function measure(name, action, setup = async () => {}) {
  if (process.env.QA_BENCH_SCENARIOS && !process.env.QA_BENCH_SCENARIOS.split(',').includes(name)) return;
  await setup(); await action(); await sleep(1300);
  const windowMs = results.environment.windowMs[name] || results.environment.windowMs.default;
  const samples = [];
  for (let n=0;n<repetitions;n++) {
    await setup(); await sleep(400);
    await page.evaluate(() => {
      window.__qaCommits = []; window.__qaFrames = []; window.__qaLongTasks = []; window.__qaRowCommits=[];
      window.__qaInputFeedback=[];
      window.__qaInputListener=e=>{if(e.target?.matches?.('[data-search-input]')){const start=performance.now();requestAnimationFrame(()=>window.__qaInputFeedback.push(performance.now()-start));}};
      document.addEventListener('input',window.__qaInputListener,true);
      window.__qaObserver = new PerformanceObserver(l => window.__qaLongTasks.push(...l.getEntries().map(e => ({ duration:e.duration,startTime:e.startTime }))));
      window.__qaObserver.observe({ type:'longtask',buffered:false });
      let previous; window.__qaMeasuring=true;
      const frame = t => { if(previous !== undefined) window.__qaFrames.push(t-previous); previous=t; if(window.__qaMeasuring) requestAnimationFrame(frame); }; requestAnimationFrame(frame);
    });
    if(tracing) await cdp.send('Tracing.start', { categories:'devtools.timeline,v8,blink.user_timing,disabled-by-default-devtools.timeline', transferMode:'ReturnAsStream' });
    const started=Date.now(); await action(); const actionMs=Date.now()-started; await sleep(Math.max(0,windowMs-actionMs));
    const data = await page.evaluate(() => { window.__qaMeasuring=false; window.__qaObserver.disconnect(); document.removeEventListener('input',window.__qaInputListener,true); return { intervals:window.__qaFrames,longTasks:window.__qaLongTasks,commits:window.__qaCommits,rowCommits:window.__qaRowCommits,inputFeedback:window.__qaInputFeedback,domNodes:document.querySelectorAll('*').length,statusSelectors:document.querySelectorAll('tbody [role="combobox"]').length,mountedNativeSelects:document.querySelectorAll('tbody select').length }; });
    data.heap = await cdp.send('Runtime.getHeapUsage');
    data.layerCount = layerCount;
    data.windowMs=windowMs; data.actionMs=actionMs; data.measurementMs=Date.now()-started; data.windowOverrun=actionMs>windowMs;
    if(!tracing){samples.push(data);continue;}
    const complete = new Promise(resolve => cdp.once('Tracing.tracingComplete',resolve));
    await cdp.send('Tracing.end'); const {stream} = await complete;
    let trace=''; while(true) { const chunk=await cdp.send('IO.read',{handle:stream}); trace+=chunk.data; if(chunk.eof) break; } await cdp.send('IO.close',{handle:stream});
    const traceFile=path.join(output,`${name}-${n+1}.trace.json`); await fs.writeFile(traceFile,trace);
    const sums={}; for(const e of JSON.parse(trace).traceEvents) if(e.ph==='X' && ['Layout','UpdateLayoutTree','Paint','CompositeLayers','FunctionCall','RunTask'].includes(e.name)) { const s=sums[e.name]??={count:0,ms:0}; s.count++;s.ms+=(e.dur||0)/1000; }
    samples.push({...data,traceFile,traceSummary:sums});
  }
  const intervals=samples.flatMap(s=>s.intervals),tasks=samples.flatMap(s=>s.longTasks),commits=samples.flatMap(s=>s.commits);
  const result={name,samples,summary:{mean:intervals.reduce((a,b)=>a+b,0)/intervals.length,p95:percentile(intervals,.95),p99:percentile(intervals,.99),overBudgetPercent:100*intervals.filter(x=>x>16.67).length/intervals.length,droppedPercent:100*intervals.filter(x=>x>17.5).length/intervals.length,longTasks:tasks.length,maxLongTask:Math.max(0,...tasks.map(t=>t.duration)),reactCommitP95:percentile(commits.map(c=>c.actualDuration),.95),maxReactCommit:Math.max(0,...commits.map(c=>c.actualDuration))}};
  results.scenarios.push(result); await fs.writeFile(path.join(output,'results.json'),JSON.stringify(results,null,2)); console.log(name,JSON.stringify(result.summary));
  Object.assign(result.summary,{median:percentile(intervals,.5),sampleP95:samples.map(s=>percentile(s.intervals,.95)),actionMedian:percentile(samples.map(s=>s.actionMs),.5),actionP95:percentile(samples.map(s=>s.actionMs),.95)});
}
const sidebar=()=>page.getByRole('button',{name:'Toggle Sidebar',exact:true}).first().click();
const sidebarState=async state=>{ const current=await page.locator('[data-state][data-collapsible]').first().getAttribute('data-state'); if(current!==state) await sidebar(); };
try {
  await measure('sidebar-collapse',sidebar,()=>sidebarState('expanded'));
  await measure('sidebar-expand',sidebar,()=>sidebarState('collapsed'));
  await measure('inspector-open',openInspector,async()=>{if(await page.getByRole('dialog').isVisible()) await closeInspector();});
  await measure('inspector-close',closeInspector,async()=>{if(!await page.getByRole('dialog').isVisible())await openInspector();});
  await openInspector();
  await measure('inspector-tabs',async()=>{ for(const t of ['Steps','Overview','Execution']) await page.getByRole('tab',{name:t,exact:true}).click(); });
  await closeInspector();
  await measure('cases-scroll',async()=>{await page.mouse.move(1000,650);for(let i=0;i<12;i++){await page.mouse.wheel(0,250);await sleep(20);}for(let i=0;i<12;i++){await page.mouse.wheel(0,-250);await sleep(20);}});
  const search=()=>page.locator('[data-search-input]');
  const settled=()=>page.locator('[aria-busy="true"]').waitFor({state:'hidden'});
  const query=async value=>{await search().fill(value);await sleep(350);await settled();};
  await measure('cases-search',()=>query('Checkout'),()=>query(''));
  await measure('cases-clear-search',()=>query(''),()=>query('Checkout'));
  const sort=async()=>{await page.getByRole('columnheader',{name:'ID',exact:true}).click();await sleep(50);await settled();};
  await measure('cases-sort',sort);
  const selectModule=async name=>{await page.getByRole('button',{name:/^Filter/}).first().click();await page.getByRole('combobox').filter({hasText:/All Modules|Checkout/}).first().click();await page.getByRole('option',{name,exact:true}).click();await page.keyboard.press('Escape');await sleep(100);await settled();};
  await measure('cases-module',()=>selectModule('Checkout'),()=>selectModule('All Modules'));
  await measure('cases-clear-module',()=>selectModule('All Modules'),()=>selectModule('Checkout'));
  await measure('cases-pagination',async()=>{await page.getByRole('button',{name:'Halaman berikutnya',exact:true}).click();await sleep(100);await settled();},async()=>{if(await page.getByRole('button',{name:'Halaman sebelumnya',exact:true}).isEnabled()){await page.getByRole('button',{name:'Halaman sebelumnya',exact:true}).click();await sleep(150);await settled();}});
  await measure('cases-selection',async()=>{for(const i of [0,1,2])await page.locator('tbody [role="checkbox"]').nth(i).click();});
  const status=async value=>{const trigger=page.locator('tbody [role="combobox"]').first();await trigger.click();await page.getByRole('option',{name:value,exact:true}).click();await expect(trigger).toContainText(value);};
  await measure('cases-status',()=>status('FAILED'),()=>status('DONE'));
  await measure('cases-filter-sort',async()=>{await page.locator('[data-search-input]').fill('Checkout');await sleep(150);await page.locator('[data-search-input]').fill('');await page.getByRole('columnheader',{name:'ID',exact:true}).click();await page.getByRole('columnheader',{name:'ID',exact:true}).click();});
  for (const [name,from,to,route] of [['nav-dashboard-cases','Dashboard','Cases','test-cases'],['nav-cases-bugs','Cases','Bugs','bugs'],['nav-bugs-automation','Bugs','Automation Logs','automation'],['nav-automation-reports','Automation Logs','Reports','reports']]) {
    await measure(name,async()=>{await menu(to).click();await page.waitForURL(`**/${route}`);await expect(menu(to)).toHaveAttribute('aria-current','page');},async()=>{await menu(from).click();await expect(menu(from)).toHaveAttribute('aria-current','page');await sleep(400);});
  }
  await measure('rapid-menu-navigation',async()=>{for(const [label,route] of [['Dashboard','dashboard'],['Bugs','bugs'],['Automation Logs','automation'],['Test Cycles','test-runs'],['Traceability','traceability'],['Reports','reports'],['Settings','settings'],['Cases','test-cases']]){await menu(label).click();await page.waitForURL(`**/${route}`);await expect(menu(label)).toHaveAttribute('aria-current','page');}});
  await page.goto(`${baseURL}/projects/perf-project/test-cases`);
  await set100();
  await page.getByText('PERF-001',{exact:true}).first().waitFor(); await openInspector(); await page.getByRole('tab',{name:'Automation',exact:true}).click();
  await page.getByRole('button',{name:/Network \(/i}).first().click();
  const row=()=>page.locator('[class*="grid-cols-12"][class*="cursor-pointer"]:visible').first();
  await measure('network-expansion',()=>row().click());
  await measure('fullscreen-devlog',async()=>{await page.getByRole('button',{name:'Fullscreen',exact:true}).last().click();await page.locator('button').filter({has:page.locator('svg.lucide-x')}).filter({visible:true}).first().click();});
  await measure('recording-playback',async()=>{const v=page.locator('video:visible').first(); await v.evaluate(async video=>{video.currentTime=1;await video.play();});await sleep(800);await v.evaluate(video=>video.pause());});
  results.videoProof=await page.locator('video:visible').first().evaluate(video=>({duration:video.duration,currentTime:video.currentTime,readyState:video.readyState,error:video.error?.message||null}));
  if (process.env.QA_BENCH_FUNCTIONAL === '1') {
    const logRow=page.getByRole('button',{name:/Inspect POST/}).first();
    await logRow.focus();await page.keyboard.press('Enter');
    await expect(logRow).toHaveAttribute('aria-expanded','true');
    await expect(page.getByText('Request Payload',{exact:true})).toBeVisible();
    await page.keyboard.press('Space');await expect(logRow).toHaveAttribute('aria-expanded','false');
    await page.getByRole('button',{name:'Fullscreen',exact:true}).first().click();
    const close=page.getByRole('button',{name:'Close recording fullscreen'});
    await expect(close).toBeVisible();
    const fullVideo=page.locator('video:visible').first();
    await fullVideo.evaluate(async v=>{v.currentTime=3;await v.play();});await sleep(700);await fullVideo.evaluate(v=>v.pause());
    await page.getByRole('button',{name:'Use',exact:true}).first().click();
    await expect(page.getByText('Payload',{exact:true})).toBeVisible();
    await expect(page.getByText('Headers',{exact:true})).toBeVisible();
    const scroll=page.locator('div.overflow-y-auto').filter({has:page.getByRole('button',{name:'Use',exact:true})}).last();
    const box=await scroll.boundingBox();
    if(!box)throw new Error('Recording event scroll container unavailable');
    await page.mouse.move(box.x+box.width/2,box.y+Math.min(box.height/2,100));
    const initial=await scroll.evaluate(e=>e.scrollTop);await page.mouse.wheel(0,400);await sleep(200);
    const final=await scroll.evaluate(e=>e.scrollTop);if(final<=initial)throw new Error('Recording event wheel scroll did not advance');
    await page.screenshot({path:path.join(output,'recording-fullscreen.png')});
    await close.click();await expect(close).toBeHidden();await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button',{name:'Fullscreen',exact:true}).last().click();await page.keyboard.press('Escape');
    await expect(page.getByRole('button',{name:'Close fullscreen DevLog'})).toBeHidden();await expect(page.getByRole('dialog')).toBeVisible();
    results.functional={keyboardNetwork:true,headersPayload:true,recordingPlaySeek:true,recordingFullscreenClose:true,wheelScroll:{initial,final},devlogEscapeKeepsInspector:true};
  }
  await closeInspector();
  await measure('ai-chat',async()=>{await page.getByRole('button',{name:'Open QA AI chat'}).click();await page.getByRole('button',{name:'Close chat'}).click();});
  if (diagnostic === 'empty') {
    // Diagnostic-only empty Cases response: no project/user data is deleted.
    await context.route('**/api/testcases?**',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({testCases:[],total:0,totalPages:1})}));
    await page.reload(); await page.getByText('Belum ada test case',{exact:true}).waitFor();
  }
  if (['inspector','system-closed'].includes(diagnostic)) {
    await page.getByRole('button',{name:'Toggle theme'}).click();await page.getByRole('menuitem',{name:'System',exact:true}).click();
    await page.emulateMedia({colorScheme:'dark'});await sleep(100);
    if(diagnostic==='inspector')await openInspector();
  }
  await measure('theme-switch',async()=>{
    if(['inspector','system-closed'].includes(diagnostic)) {
      for(const theme of ['light','dark']){await page.emulateMedia({colorScheme:theme});await expect(page.locator('html')).toHaveClass(theme==='dark'?/dark/:/^(?!.*dark)/);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
    } else for(const theme of ['Light','Dark']){await page.getByRole('button',{name:'Toggle theme'}).click();await page.getByRole('menuitem',{name:theme,exact:true}).click();}
  });
} catch(e) { results.failure=e.message; console.error(e.message); await page.screenshot({path:path.join(output,'failure.png')}); }
finally { await fs.writeFile(path.join(output,'results.json'),JSON.stringify(results,null,2)); await browser.close(); }
console.log(`Evidence: ${output}`);
if(results.failure)process.exitCode=1;
