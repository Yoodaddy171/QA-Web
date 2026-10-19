import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium,expect}=require('@playwright/test');
const root=await fs.realpath(process.env.QA_PHASE7_ROOT||'__missing__');
if(!path.basename(root).startsWith('qadesk-phase7-'))throw new Error('Disposable fixture required');
const f=JSON.parse(await fs.readFile(path.join(root,'fixture.json'),'utf8'));
const out=path.resolve('artifacts/ui-review/phase8c1');
const captureDir=process.env.QA_PHASE8C1_CAPTURE_DIR||'candidate';
if(!/^[a-z0-9-]+$/.test(captureDir))throw new Error('Safe capture directory required');
await fs.mkdir(path.join(out,captureDir),{recursive:true});
const browser=await chromium.launch({headless:true}),results=[],errors=[];
try{
 for(const [width,height] of [[1440,900],[1366,768],[390,844]])for(const theme of ['dark','light']){
  if(process.env.QA_PHASE8C1_ONLY&&width!==Number(process.env.QA_PHASE8C1_ONLY))continue;
  const ctx=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,reducedMotion:'reduce'});
  await ctx.addCookies([{name:'qa_session',value:f.actors.owner.token,url:f.origin}]);
  await ctx.addInitScript(t=>localStorage.setItem('web-qa:theme',t),theme);
  await ctx.route(/https?:\/\/(127\.0\.0\.1|localhost):3001\//,r=>r.abort());
  await ctx.routeWebSocket(/ws:\/\/(127\.0\.0\.1|localhost):3001/,ws=>ws.close());
  const p=await ctx.newPage();p.on('pageerror',e=>errors.push({width,theme,message:e.message}));
  async function shot(id,label,reference){
   await p.evaluate(async()=>{await document.fonts.ready;await Promise.allSettled(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
   await p.mouse.move(1,1);
   const conditions=await p.evaluate(()=>({documentOverflow:document.documentElement.scrollWidth>innerWidth,dialogs:[...document.querySelectorAll('[role="dialog"]')].map(e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};}),theme:document.documentElement.classList.contains('dark')?'dark':'light'}));
   expect(conditions.documentOverflow).toBe(false);expect(conditions.theme).toBe(theme);
   for(const d of conditions.dialogs){expect(d.x).toBeGreaterThanOrEqual(-1);expect(d.y).toBeGreaterThanOrEqual(-1);expect(d.x+d.width).toBeLessThanOrEqual(width+1);expect(d.y+d.height).toBeLessThanOrEqual(height+1);}
   const filename=`${captureDir}/${id}-${label}-${width}-${theme}.png`;
   await p.screenshot({path:path.join(out,filename),animations:'allow',caret:'hide'});
   results.push({id,label,reference,filename,viewport:{width,height},theme,role:'OWNER',fixture:'Phase8A logical seed: Mercury Commerce QA,24 cases,3 modules,4 Bugs; new synthetic UUIDs/timestamps.',route:new URL(p.url()).pathname,conditions});
   console.log(filename);
  }
  const main=width===1440&&theme==='dark';
  await p.goto(`${f.origin}/projects/${f.project.id}/test-cases`);await expect(p.locator('tbody')).toContainText('AUTH-001');
  await shot('UI-004','cases',width===1366?'UI-102':theme==='light'?'UI-117':width===390?'UI-108':'UI-004');
  const region=p.getByRole('region',{name:/Tabel testcase/});await region.evaluate(e=>{e.scrollLeft=e.scrollWidth;});
  await expect(p.getByRole('button',{name:'Actions for AUTH-001',exact:true})).toBeInViewport();
  if(width>=768){const result=p.locator('tbody tr').filter({hasText:'AUTH-001'}).getByText('Not As Expected',{exact:true});await expect(result).toBeVisible();expect(await result.evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);}
  if(main)await shot('C1-RESULT','cases-right','UI-004');
  if(main){await p.getByRole('button',{name:'Filter',exact:true}).click();await shot('UI-006','filters','UI-006');await p.keyboard.press('Escape');}
  await p.getByRole('button',{name:/Add Test Case/}).click();await p.getByRole('dialog').waitFor();await shot('UI-013','create','UI-013');
  const footer=p.getByRole('button',{name:'Buat Test Case',exact:true});await expect(footer).toBeInViewport();
  if(main){await p.getByLabel('Tags',{exact:true}).scrollIntoViewIfNeeded();await shot('UI-126','create-bottom','UI-126');}
  await p.getByRole('button',{name:'Batal',exact:true}).click();
  if(main){await p.getByRole('button',{name:'Actions for AUTH-001',exact:true}).click();await p.getByRole('menuitem',{name:'Edit',exact:true}).click();await shot('UI-015','edit','UI-015');await p.getByRole('button',{name:'Batal',exact:true}).click();}
  await p.getByRole('button',{name:'Actions for AUTH-001',exact:true}).click();await p.getByRole('menuitem',{name:/Lihat Detail/}).click();await expect(p.getByRole('dialog')).toContainText('Test Case ID (Display)');await shot('UI-024','inspector',width===390?'UI-109':theme==='light'?'UI-118':'UI-024');
  await p.getByRole('tab',{name:'Steps',exact:true}).click();await expect(p.getByRole('tabpanel',{name:'Steps',exact:true})).toContainText('Test steps');if(main)await shot('UI-127','steps-fixed','UI-127');await p.getByRole('button',{name:'Tutup',exact:true}).click();
  await p.goto(`${f.origin}/projects/${f.project.id}/bugs`);await expect(p.locator('tbody')).toContainText('AUTH-001');await shot('UI-043','bugs',width===1366?'UI-103':width===390?'UI-110':theme==='light'?'UI-119':'UI-043');
  if(main){await p.getByRole('button',{name:'View bug AUTH-001',exact:true}).click();await p.getByRole('tab',{name:'Lifecycle',exact:true}).click();await expect(p.getByRole('dialog')).toContainText(/Riwayat|Dilaporkan|Lifecycle/);await shot('UI-046','bug-detail','UI-046');}
  const contrast=await p.evaluate(()=>{
   const css=getComputedStyle(document.documentElement),canvas=document.createElement('canvas'),c=canvas.getContext('2d');
   function rgb(value){c.clearRect(0,0,1,1);c.fillStyle=value;c.fillRect(0,0,1,1);return [...c.getImageData(0,0,1,1).data].slice(0,3).map(x=>x/255);}
   function lum(a){return a.map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);}
   function ratio(a,b){const x=lum(rgb(css.getPropertyValue(a).trim())),y=lum(rgb(css.getPropertyValue(b).trim()));return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
   return{bodyOnCard:ratio('--foreground','--card'),metadataOnCard:ratio('--muted-foreground','--card'),primaryButton:ratio('--primary-foreground','--primary')};
  });
  results.push({label:'measured-token-contrast',viewport:{width,height},theme,contrast,scope:'Three opaque existing token pairs only; not full WCAG certification.'});
  await ctx.close();
 }
 expect(errors).toEqual([]);
}finally{await browser.close();await fs.writeFile(path.join(out,`${captureDir}-manifest.json`),JSON.stringify({browser:await browser.version(),errors,results},null,2));}
