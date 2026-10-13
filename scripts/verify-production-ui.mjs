import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
const require = createRequire(path.join(process.env.QA_BENCH_ROOT || process.cwd(), 'package.json'));
const { chromium, expect } = require('@playwright/test');
const baseURL = process.env.QA_BENCH_URL || 'http://127.0.0.1:3100';
if (!/^http:\/\/127\.0\.0\.1:31\d\d$/.test(baseURL)) throw new Error('Use isolated 31xx server');
const output = path.join(os.tmpdir(), `qadesk-phase2-ui-${process.env.QA_BENCH_LABEL || 'optimized'}`);
await fs.mkdir(output,{recursive:true});
const browser = await chromium.launch({headless:false});
const context = await browser.newContext();
// Never contact a user's existing capture relay during responsive smoke.
await context.route('http://127.0.0.1:3001/**',route=>route.fulfill({contentType:'application/json',body:route.request().url().includes('/logs/')?'':'{"recording":null}'}));
await context.routeWebSocket('ws://127.0.0.1:3001/**',ws=>ws.onMessage(()=>{}));
const login = await context.request.post(`${baseURL}/api/auth/login`,{headers:{Origin:baseURL},data:{email:'owner@qa-desk.test',password:'E2E-only-password-2026!'}});
if(!login.ok()) throw new Error(`Fixture login ${login.status()}`);
const page=await context.newPage(), results=[],errors=[];
page.on('pageerror',e=>errors.push(e.message));
const routes=['dashboard','test-cases','bugs','automation','test-runs','traceability','reports','settings'];
const rect = element => {const r=element.getBoundingClientRect(),s=getComputedStyle(element);return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height,translate:s.translate,transform:s.transform,margin:s.margin,position:s.position,rightCss:s.right,bodyMargin:getComputedStyle(document.body).margin,viewport:innerWidth,client:document.documentElement.clientWidth};};
try {
  for(const width of process.env.QA_UI_DIAGNOSTIC ? [390] : [320,360,390,768,1280,1440]) for(const theme of process.env.QA_UI_DIAGNOSTIC ? ['dark'] : ['light','dark']) {
    await page.setViewportSize({width,height:900});
    await page.goto(`${baseURL}/projects/perf-project/test-cases`);
    await page.evaluate(t=>{localStorage.setItem('web-qa:theme',t);document.documentElement.classList.toggle('dark',t==='dark');},theme);
    for(const route of process.env.QA_UI_DIAGNOSTIC ? ['test-cases'] : routes) {
      await page.goto(`${baseURL}/projects/perf-project/${route}`);
      await page.waitForTimeout(400);
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
      results.push({width,theme,route,overflow});
      await page.screenshot({path:path.join(output,`${theme}-${width}-${route}.png`)});
    }
    await page.goto(`${baseURL}/projects/perf-project/test-cases`);
    await page.getByText('PERF-001',{exact:true}).first().click();
    await page.getByRole('dialog').waitFor();await page.waitForTimeout(400);
    const bounds=await page.getByRole('dialog').evaluate(rect);
    results.push({width,theme,component:'inspector',bounds});
    if(!process.env.QA_UI_DIAGNOSTIC) {expect(bounds.left).toBeGreaterThanOrEqual(-1);expect(bounds.right).toBeLessThanOrEqual(width+1);}
    await page.screenshot({path:path.join(output,`${theme}-${width}-inspector.png`)});
    if(width===1440&&!process.env.QA_UI_DIAGNOSTIC) for(const name of ['Overview','Steps','Traceability','Execution','Evidence','Bugs','History','Comments','Automation']) {await page.getByRole('tab',{name,exact:true}).click();await expect(page.getByRole('tab',{name,exact:true})).toHaveAttribute('data-state','active');}
    await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});
    await page.getByRole('button',{name:'Open QA AI chat'}).click();await page.waitForTimeout(350);
    const chat=page.getByRole('button',{name:'Close chat'}).locator('xpath=ancestor::div[contains(@class,"fixed")][1]');
    const chatBounds=await chat.evaluate(rect);results.push({width,theme,component:'chat',bounds:chatBounds});
    if(!process.env.QA_UI_DIAGNOSTIC){expect(chatBounds.left).toBeGreaterThanOrEqual(-1);expect(chatBounds.right).toBeLessThanOrEqual(width+1);await page.getByRole('button',{name:'Minimize chat'}).click();await page.getByRole('button',{name:'Expand chat'}).click();}
    await page.screenshot({path:path.join(output,`${theme}-${width}-chat.png`)});await page.getByRole('button',{name:'Close chat'}).click();
  }
  if(!process.env.QA_UI_DIAGNOSTIC){expect(results.filter(x=>x.overflow>1)).toEqual([]);expect(errors).toEqual([]);}
} catch(e){results.push({failure:e.message});process.exitCode=1;await page.screenshot({path:path.join(output,'failure.png')});}
finally{await fs.writeFile(path.join(output,'results.json'),JSON.stringify({results,errors},null,2));console.log(JSON.stringify({output,results:results.filter(x=>x.bounds||x.failure),errors}));await browser.close();}
