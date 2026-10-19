import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { PrismaClient } = require('@prisma/client');
const root = await fs.realpath(process.env.QA_PHASE7_ROOT || '__missing__');
if (path.dirname(root) !== await fs.realpath(os.tmpdir()) || !path.basename(root).startsWith('qadesk-phase7-')) throw new Error('Owned disposable fixture only');
const f = JSON.parse(await fs.readFile(path.join(root, 'fixture.json'), 'utf8'));
if (!f.databaseUrl.startsWith(`file:${root.replaceAll('\\', '/')}/`)) throw new Error('Foreign database');
const db = new PrismaClient({ datasourceUrl: f.databaseUrl });
const out = path.resolve('artifacts/ui-review/phase8a');
await fs.mkdir(out, { recursive: true });
const now = new Date();
const ago = hours => new Date(now.getTime() - hours * 3600000);
const scenarios = [
 ['AUTH-001','Login','Authentication','Reject expired session and preserve return URL','FAILED','Critical'],
 ['PAY-002','Checkout','Payment','Complete a card payment with valid billing details','DONE','High'],
 ['REG-003','Registration','Validation','Show required email validation before account creation','READY TO RETEST','High'],
 ['API-004','Orders API','Responses','Return a clear error when an order is duplicated','BLOCKED','Critical'],
 ['DASH-005','Dashboard','Filters','Filter readiness cards by module and date range','IN PROGRESS','Medium'],
 ['AUTH-006','Login','Password','Accept valid credentials and open the dashboard','DONE','High'],
 ['PAY-007','Checkout','Discount','Reject an expired discount without changing totals','FAILED','High'],
 ['UI-008','Profile','Accessibility','Keep keyboard focus visible when editing the address','NOT DONE','Medium'],
];
const statuses = ['NOT DONE','DONE','FAILED','BLOCKED','IN PROGRESS','READY TO RETEST','TBA'];
for (let i = 0; i < f.cases.length; i++) {
 const item = scenarios[i] || [`QA-${String(i+1).padStart(3,'0')}`,['Settings','Order History','Dashboard'][i%3],['Filtering','Navigation','Validation'][i%3],['Preserve active filters after refreshing the page','Display a useful empty state when no records match','Validate input and show a specific recovery message'][i%3],statuses[i%7],['High','Medium','Low'][i%3]];
 await db.testCase.update({ where:{id:f.cases[i].id}, data:{testCaseId:item[0],page:item[1],subMenu:item[2],testAction:item[3],status:item[4],priority:item[5],steps:`1. Open ${item[1]}.\n2. Enter representative synthetic data.\n3. Perform the primary action.\n4. Compare the result and evidence.`,expectedResult:'The correct result is shown with clear feedback, preserved input and no duplicate request.',actualResult:item[4]==='DONE'?'As Expected':item[4]==='FAILED'?'Not As Expected':null,progress:item[4]==='DONE'?100:['IN PROGRESS','READY TO RETEST'].includes(item[4])?50:0,tags:i%2?'regression, release-1.4':'smoke, critical-path',remarks:i<4?'Synthetic review fixture. No customer data.':null} });
}
await db.project.update({where:{id:f.project.id},data:{name:'Mercury Commerce QA',description:'Release 1.4 - checkout, authentication and customer workflows'}});
await db.project.update({where:{id:f.second.id},data:{name:'Mercury Mobile - Empty',description:'Empty project for visual states'}});
await db.module.update({where:{id:f.modules[0].id},data:{name:'Checkout & Orders'}});
await db.module.update({where:{id:f.modules[1].id},data:{name:'Identity & Access'}});
await db.module.update({where:{id:f.modules[2].id},data:{name:'Customer Experience'}});
await db.workspace.update({where:{id:f.project.workspaceId},data:{name:'Mercury Quality Workspace'}});
for (const [alias,actor] of Object.entries(f.actors)) await db.user.update({where:{id:actor.id},data:{name:`Review ${alias==='owner'?'Owner':alias==='qa'?'Tester':alias==='viewer'?'Observer':alias}`,email:`${alias}@mercury.example.test`}});
await db.testRun.update({where:{id:f.run.id},data:{name:'Sprint 12 - Checkout Regression',description:'Verify payment, authentication and validation before release 1.4.',assignedTo:'Review Tester',startDate:ago(120),endDate:ago(-48)}});
for (const [name,status] of [['Release 1.4 - Smoke','READY'],['Sprint 11 - Regression','COMPLETED'],['UAT - Customer Accounts','DRAFT']]) await db.testRun.create({data:{projectId:f.project.id,name,status,assignedTo:'Review Lead'}});
const executions=[];
for (let i=0;i<4;i++) {
 const rc=await db.testRunCase.findUniqueOrThrow({where:{testRunId_testCaseId:{testRunId:f.run.id,testCaseId:f.cases[i].id}}});
 const status=['FAILED','PASSED','RETEST','BLOCKED'][i];
 const execution=await db.testExecution.create({data:{testRunId:f.run.id,testCaseId:f.cases[i].id,testRunCaseId:rc.id,status,tester:'Review Tester',actualResult:status==='PASSED'?'As Expected':'Needs investigation',notes:['Session expires without redirecting to the requested page.','Payment receipt and order number are correct.','Validation message was fixed; awaiting final QA verification.','Order API dependency is unavailable in the test environment.'][i],startedAt:ago(3),completedAt:ago(2),createdAt:ago(2)}});
 executions.push(execution);
 await db.testRunCase.update({where:{id:rc.id},data:{latestStatus:status,latestExecutionAt:ago(2)}});
}
for (const [idx,status] of [[0,'SUDAH DILAPORKAN'],[2,'READY TO RETEST'],[5,'VERIFIED & FIXED'],[6,'SEDANG DI FIX']]) {
 const tc=await db.testCase.findUniqueOrThrow({where:{id:f.cases[idx].id}});
 await db.bugFix.create({data:{sourceTestCaseId:tc.id,sourceExecutionId:idx===0?executions[0].id:null,projectId:tc.projectId,testCaseId:tc.testCaseId,page:tc.page,subMenu:tc.subMenu,testType:tc.testType,testAction:tc.testAction,steps:tc.steps,expectedResult:tc.expectedResult,actualResult:status==='VERIFIED & FIXED'?'As Expected':'Not As Expected',priority:tc.priority,moduleId:tc.moduleId,status,reportedAt:ago(72),fixingAt:status==='SUDAH DILAPORKAN'?null:ago(48),readyAt:['READY TO RETEST','VERIFIED & FIXED'].includes(status)?ago(24):null,fixedAt:status==='VERIFIED & FIXED'?ago(6):null}});
}
await db.requirement.update({where:{id:f.requirement.id},data:{key:'REQ-AUTH-01',title:'Preserve the user journey after authentication',description:'Users return to the originally requested page after a successful login.'}});
await db.testPlan.update({where:{id:f.plan.id},data:{name:'Release 1.4 - Quality Plan',description:'Critical-path coverage for authentication and checkout.',status:'ACTIVE'}});
await db.requirement.create({data:{projectId:f.project.id,key:'REQ-PAY-02',title:'Prevent duplicate payment submissions',priority:'Critical'}});
const partial=await db.requirement.create({data:{projectId:f.project.id,key:'REQ-UI-03',title:'Provide accessible filtering and feedback'}});
await db.requirementTestCase.create({data:{requirementId:partial.id,testCaseId:f.cases[7].id}});
for (const [type,title,content] of [['QA_RULES','Release acceptance criteria','Critical paths must have evidence. Failed and blocked cases require investigation before release.'],['BUSINESS_RULES','Payment and order rules','One successful payment creates exactly one confirmed order. Duplicate submissions must not create additional charges.'],['PROJECT_CONTEXT','Application under test','Mercury Commerce is a synthetic storefront used exclusively for local visual review.']]) await db.projectKnowledge.create({data:{projectId:f.project.id,type,title,content}});
for (const [action,field,beforeValue,afterValue] of [['CREATED',null,null,{testCaseId:'AUTH-001'}],['UPDATED','status',{status:'NOT DONE'},{status:'FAILED'}],['COMMENTED',null,null,{comment:'Please verify the expired-session flow with a fresh browser context. Evidence is attached to the failed execution.'}]]) await db.activityHistory.create({data:{projectId:f.project.id,entityType:'TestCase',entityId:f.cases[0].id,action,field,beforeValue:beforeValue||undefined,afterValue,actor:'Review Tester'}});
for (const [type,severity,title,message] of [['TESTCASE_FAILED','critical','Authentication requires attention','AUTH-001 failed in Sprint 12. Inspect the execution evidence.'],['TESTCASE_RETEST','info','Registration is ready for retest','REG-003 has been fixed and is ready for QA verification.'],['IMPORT_COMPLETED','success','Testcase import completed','12 synthetic regression cases are ready for review.']]) await db.notification.create({data:{projectId:f.project.id,recipientKey:f.actors.owner.id,type,severity,title,message,entityType:'TestCase',entityId:f.cases[0].id}});
await db.$disconnect();
const api=async(url,body)=>{const response=await fetch(f.origin+url,{method:'POST',headers:{Cookie:`qa_session=${f.actors.owner.token}`,Origin:f.origin,'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await response.json();if(!response.ok)throw new Error(`${url}: ${response.status} ${JSON.stringify(data)}`);return data;};
const reports=[];
for (const [id,reportType] of [['VIS-DRAFT','TEST_STATUS_REPORT'],['VIS-FINAL','TEST_STATUS_REPORT'],['VIS-PLAN','TEST_PLANNING_DOCUMENT']]) {
 const result=await api('/api/reports',{projectId:f.project.id,testRunId:reportType==='TEST_STATUS_REPORT'?f.run.id:undefined,reportType,documentId:id,version:'1.0',author:'Review Lead',approvedBy:'Review Owner',documentStatus:'Assigned for review',dateOfIssue:now.toISOString(),reportingPeriodStart:ago(168).toISOString(),reportingPeriodEnd:now.toISOString(),metadata:{documentInformation:'Synthetic visual audit document.',references:[{type:'Internal',title:'Release 1.4 acceptance criteria'}],revisionLog:[{date:'16/10/2026',version:'1.0',changes:'Initial review',author:'Review Lead'}]},sections:{scope:'Authentication, checkout and customer-facing critical paths.',progressNarrative:'Payment validation passed. Authentication and registration still require attention.',blockingFactors:'Order API dependency is unavailable.',newRisks:'Duplicate submission and expired-session handling need additional review.',plannedTesting:'Retest current fixes, then run release smoke coverage.',testItems:'Login, payment validation, profile and dashboard filtering.',approachStrategy:'Risk-based functional and accessibility coverage.'}});
 const report=result.report||result; reports.push(report);
 if(id==='VIS-FINAL')await api(`/api/reports/${report.id}/finalize`,{});
}
await fs.writeFile(path.join(root,'phase8a-data.json'),JSON.stringify({projectId:f.project.id,caseId:f.cases[0].id,runId:f.run.id,executionId:executions[0].id,reports:reports.map(r=>({id:r.id,documentId:r.documentId})),seededAt:now.toISOString()},null,2));
console.log('Synthetic visual data seeded. No real data used.');
