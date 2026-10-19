import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
const {chromium,expect}=createRequire(import.meta.url)('@playwright/test');
const root=await fs.realpath(process.env.QA_PHASE7_ROOT||'__missing__');
if(!path.basename(root).startsWith('qadesk-phase7-'))throw new Error('Synthetic fixture required');
const f=JSON.parse(await fs.readFile(path.join(root,'fixture.json'),'utf8'));
if(f.origin!=='http://127.0.0.1:3119')throw new Error('Owned origin only');
const browser=await chromium.launch(),results=[],errors=[];
try{
 const context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'});
 await context.addCookies([{name:'qa_session',value:f.actors.owner.token,url:f.origin}]);
 await context.route(/https?:\/\/(127\.0\.0\.1|localhost):3001\//,r=>r.abort());
 await context.routeWebSocket(/ws:\/\/(127\.0\.0\.1|localhost):3001/,ws=>ws.close());
 const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));
 for(const [section,title] of [['dashboard','Dashboard'],['reports','Reports'],['traceability','Traceability'],['settings','Settings'],['test-runs','Test Cycles']]){
  await p.goto(`${f.origin}/projects/${f.project.id}/${section}`);
  await expect(p.locator('header')).toContainText(title);
  await expect(p.locator('main')).toBeVisible();
  expect(await p.locator('main').innerText()).not.toBe('');
  await expect(p.locator('nextjs-portal')).toHaveCount(0);
  expect(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  results.push({section,title,url:new URL(p.url()).pathname,meaningfulContent:true,documentOverflow:false});
 }
 expect(errors).toEqual([]);
}finally{
 await browser.close();
 await fs.writeFile('artifacts/ui-review/phase8c1/shared-smoke.json',JSON.stringify({scope:'Read-only arrival smoke only; no redesign or complete workflow coverage.',results,errors},null,2));
}
console.log(`${results.length} shared-surface arrival checks passed.`);
