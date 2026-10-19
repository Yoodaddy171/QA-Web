import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import {fork} from 'node:child_process';
import {createRequire} from 'node:module';
const root=await fs.realpath(process.env.QA_PHASE7_ROOT||'__missing__');
if(path.dirname(root)!==await fs.realpath(os.tmpdir())||!path.basename(root).startsWith('qadesk-phase7-'))throw new Error('Owned direct temp fixture required');
const f=JSON.parse(await fs.readFile(path.join(root,'fixture.json'),'utf8'));
const build=path.resolve(process.argv[2]||'');
if(!build.includes('qadesk-phase2-baseline')||!f.databaseUrl.startsWith(`file:${root.replaceAll('\\','/')}/`))throw new Error('Isolated artifact/database required');
// Resume only the disposable fixture's actors after a paused verification session.
const {PrismaClient}=createRequire(import.meta.url)('@prisma/client');
const db=new PrismaClient({datasourceUrl:f.databaseUrl});
try{await db.session.updateMany({where:{userId:{in:Object.values(f.actors).map(a=>a.id)}},data:{expiresAt:new Date(Date.now()+86400000)}});}finally{await db.$disconnect();}
await new Promise((resolve,reject)=>{const s=net.createServer();s.once('error',reject);s.listen(3119,'127.0.0.1',()=>s.close(resolve));});
const server=fork(path.resolve('scripts/phase6c-server.mjs'),[build],{windowsHide:true,silent:true,env:{...process.env,NODE_ENV:'production',HOSTNAME:'127.0.0.1',PORT:'3119',DATABASE_URL:f.databaseUrl,POSTGRES_DATABASE_URL:'',QA_PHASE6C_ROOT:root,QA_RUNTIME_DIR:path.join(root,'runtime'),QA_EVIDENCE_STORAGE_DIR:path.join(root,'evidence'),APP_URL:f.origin,QA_ALLOWED_ORIGINS:f.origin,QA_COOKIE_SECURE:'0',QA_RELAY_TOKEN:'',GROQ_API_KEY:'',GEMINI_API_KEY:'',QA_PHASE6C_PROFILE:''}});
const log=await fs.open(path.join(root,'phase8c1-server.log'),'a');
server.stdout.on('data',b=>void log.write(b));server.stderr.on('data',b=>void log.write(b));
await fs.writeFile(path.join(root,'owned-server.json'),JSON.stringify({pid:server.pid,parent:process.pid,build,port:3119}));
console.log('Owned synthetic application started on3119.');
process.on('SIGINT',()=>server.send({op:'shutdown'}));
server.on('exit',async()=>{await log.close();});
