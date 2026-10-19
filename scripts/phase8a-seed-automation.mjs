import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),root=process.env.QA_PHASE7_ROOT||'C:/Users/Admin/AppData/Local/Temp/qadesk-phase7-UPzEgU';
const f=JSON.parse(await fs.readFile(path.join(root,'fixture.json'),'utf8'));
if(!f.databaseUrl.startsWith(`file:${root}/`))throw new Error('Disposable database only');
const db=new(require('@prisma/client').PrismaClient)({datasourceUrl:f.databaseUrl});
try{
 const id=f.cases[0].id,session='synthetic-visual-review',dir=path.join(root,'visual-relay-runtime','recordings',id,session);
 const meta=JSON.parse(await fs.readFile(path.join(dir,'metadata.json'),'utf8'));
 const logs=(await fs.readFile(path.join(root,'visual-relay-logs',`${id}.current.jsonl`),'utf8')).trim().split('\n').map(JSON.parse);
 const run=await db.automationRun.upsert({where:{runKey:`${id}:${session}`},create:{runKey:`${id}:${session}`,sessionId:session,projectId:f.project.id,testCaseId:id,mode:'manual',status:'completed',startedAt:new Date(meta.startedAt),endedAt:new Date(meta.stoppedAt)},update:{}});
 for(const event of logs)await db.automationEvent.upsert({where:{eventId:event.id},create:{eventId:event.id,runId:run.id,testCaseId:id,eventType:event.event,timestamp:new Date(event.timestamp),relativeMs:event.relativeMs,payload:event},update:{}});
 await db.recording.upsert({where:{recordingId:session},create:{recordingId:session,runId:run.id,testCaseId:id,sessionId:session,mode:'hybrid',status:'stopped',targetUrl:meta.targetUrl,mediaRoot:dir,metadata:meta,startedAt:new Date(meta.startedAt),stoppedAt:new Date(meta.stoppedAt)},update:{}});
 console.log('Synthetic automation recording/events seeded in disposable SQLite.');
}finally{await db.$disconnect();}
