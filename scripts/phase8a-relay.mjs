// Private synthetic relay fixture; never reads/writes the user's relay storage.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import net from 'node:net';
import { fork,execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const root=process.env.QA_PHASE7_ROOT||'C:/Users/Admin/AppData/Local/Temp/qadesk-phase7-UPzEgU';
if(path.dirname(path.resolve(root))!==path.resolve(process.env.TEMP)||!path.basename(root).startsWith('qadesk-phase7-'))throw new Error('Owned direct temporary fixture required');
const f=JSON.parse(await fs.readFile(path.join(root,'fixture.json'),'utf8'));
const own=JSON.parse(await fs.readFile(path.join(root,'owned-server.json'),'utf8'));
await new Promise((resolve,reject)=>{const s=net.createServer();s.once('error',reject);s.listen(3117,'127.0.0.1',()=>s.close(resolve));});
const logs=path.join(root,'visual-relay-logs'),runtime=path.join(root,'visual-relay-runtime');
await fs.mkdir(logs,{recursive:true});
const id=f.cases[0].id,session='synthetic-visual-review';
const recording=path.join(runtime,'recordings',id,session);await fs.mkdir(path.join(recording,'frames'),{recursive:true});await fs.mkdir(path.join(recording,'video'),{recursive:true});
const image=path.resolve('artifacts/ui-review/phase8a/screenshots/desktop/UI-001-dashboard-overview.png');
await require('sharp')(image).jpeg().toFile(path.join(recording,'frames','frame.jpg'));
const ffmpeg=require('@ffmpeg-installer/ffmpeg').path;
execFileSync(ffmpeg,['-y','-loop','1','-i',image,'-t','3','-r','10','-vf','scale=1440:900','-c:v','libx264','-pix_fmt','yuv420p',path.join(recording,'video','synthetic.mp4')],{stdio:'ignore',windowsHide:true});
const start=new Date(Date.now()-600000).toISOString();
const events=[
 {category:'execution',event:'run.started',log:'Starting Manual Capture - SYNTHETIC visual review fixture',relativeMs:0},
 {category:'execution',event:'navigation',log:'Menuju ke halaman /login',relativeMs:100},
 {category:'execution',event:'input',log:'Memasukkan input "reviewer@mercury.example.test" ke field "Email"',relativeMs:500},
 {category:'execution',event:'click',log:'Menekan button "Sign in"',relativeMs:1000},
 {category:'console',event:'console.message',log:'Synthetic QA fixture: request submitted',relativeMs:1000},
 ...Array.from({length:8},(_,i)=>({category:'network',event:'network.response',relativeMs:1100+i*180,network:{event:'response',method:i===0?'POST':'GET',url:`https://mercury.example.test/api/${['session','orders','profile','cart','shipping','payment','configuration','health'][i]}`,status:i===0?401:200,duration:45+i*12,headers:{'Content-Type':'application/json'},data:{requestHeaders:{'Content-Type':'application/json'},requestBody:i===0?{email:'reviewer@mercury.example.test',session:'synthetic-session-placeholder'}:null,responseHeaders:{'Content-Type':'application/json'},responseBody:i===0?{error:'Session expired',code:'SESSION_EXPIRED'}:{success:true,source:'synthetic visual fixture'}}}})),
 {category:'console',event:'console.message',level:'SEVERE',log:'Synthetic QA fixture: expired session returned 401',relativeMs:2500},
 {category:'execution',event:'run.finished',log:'Manual Capture Stopped - synthetic visual review',relativeMs:2900},
].map((x,i)=>({...x,id:`visual-event-${i}`,schemaVersion:1,type:x.category,source:x.category==='network'?'manual-network':x.category==='console'?'manual-console':'manual-execution',runner:'manual',testCaseId:id,sessionId:session,timestamp:new Date(new Date(start).getTime()+x.relativeMs).toISOString(),level:x.level||'INFO'}));
const body=events.map(x=>JSON.stringify(x)).join('\n')+'\n';
await fs.writeFile(path.join(logs,`${id}.current.jsonl`),body);await fs.writeFile(path.join(logs,`${id}.previous.jsonl`),body);
const appLog=path.join(own.build,'mini-services','logs',`${id}.current.jsonl`);
await fs.mkdir(path.dirname(appLog),{recursive:true});await fs.writeFile(appLog,body,{flag:'wx'});
const base=`/recordings/${id}/${session}`;
await fs.writeFile(path.join(recording,'metadata.json'),JSON.stringify({mode:'hybrid',sessionId:session,testCaseId:id,targetUrl:'https://mercury.example.test/login (synthetic fixture)',startedAt:start,stoppedAt:new Date(new Date(start).getTime()+3000).toISOString(),frameIntervalMs:1000,status:'stopped',frames:[{file:'frame.jpg',relativeMs:0,timestamp:start,url:`${base}/frames/frame.jpg`}],video:{file:'synthetic.mp4',url:`${base}/video/synthetic.mp4`,mimeType:'video/mp4',status:'ready',durationMs:3000,width:1440,height:900,startedAtRelativeMs:0}}));
const token=crypto.randomBytes(32).toString('hex');
const child=fork(path.resolve('mini-services/ws-server.js'),[],{silent:true,windowsHide:true,env:{...process.env,QA_RELAY_PORT:'3117',QA_RELAY_HOST:'127.0.0.1',QA_RELAY_TOKEN:token,NEXT_PUBLIC_QA_RELAY_TOKEN:'',QA_RELAY_ALLOWED_ORIGINS:f.origin,QA_RELAY_ALLOW_BROWSER_LAUNCH:'0',QA_RELAY_LOGS_DIR:logs,QA_RUNTIME_DIR:runtime,POSTGRES_DATABASE_URL:'',DATABASE_URL:f.databaseUrl}});
const log=await fs.open(path.join(root,'visual-relay.log'),'a');child.stdout.on('data',b=>void log.write(b));child.stderr.on('data',b=>void log.write(b));
await fs.writeFile(path.join(root,'phase8a-relay-private.json'),JSON.stringify({pid:child.pid,parent:process.pid,token,port:3117,appLog}));
console.log('Private synthetic relay started on 3117. Browser launch disabled.');
process.on('SIGINT',()=>child.kill('SIGTERM'));process.on('SIGTERM',()=>child.kill('SIGTERM'));child.on('exit',async()=>{await log.close();});
