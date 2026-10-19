import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import net from 'node:net';
import { fork, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { PrismaClient } = require('@prisma/client');
if (process.argv[2] === '--cleanup') {
  const root = await fs.realpath(process.argv[3]);
  if (path.dirname(root) !== await fs.realpath(os.tmpdir()) || !path.basename(root).startsWith('qadesk-phase7-') || (await fs.lstat(process.argv[3])).isSymbolicLink()) throw new Error('Owned direct temp child required');
  const owned = JSON.parse(await fs.readFile(path.join(root,'owned-server.json'),'utf8'));
  if (owned.port !== 3119 || !owned.build.includes('qadesk-phase2-baseline')) throw new Error('Unexpected fixture ownership');
  await new Promise((resolve,reject)=>{const s=net.createServer();s.once('error',()=>reject(new Error('Stop the verified owned server before cleanup')));s.listen(owned.port,'127.0.0.1',()=>s.close(resolve));});
  const fixture = JSON.parse(await fs.readFile(path.join(root,'fixture.json'),'utf8'));
  const dbPath = await fs.realpath(fixture.databaseUrl.replace(/^file:/,''));
  if (path.dirname(dbPath)!==root) throw new Error('Database outside fixture');
  const client = new PrismaClient({datasourceUrl:`file:${dbPath.replaceAll('\\','/')}`});
  try {
    const state = { integrity:await client.$queryRawUnsafe('PRAGMA integrity_check'), foreignKeys:await client.$queryRawUnsafe('PRAGMA foreign_key_check'),
      cases:await client.testCase.findMany({select:{id:true,projectId:true,testCaseId:true,status:true}}),
      bugs:await client.bugFix.findMany({select:{id:true,projectId:true,sourceTestCaseId:true,sourceExecutionId:true,status:true,reportedAt:true,fixingAt:true,readyAt:true,fixedAt:true}}),
      executions:await client.testExecution.findMany({select:{id:true,testRunId:true,testCaseId:true,status:true,tester:true}}),
      reports:await client.report.findMany({select:{id:true,testRunId:true,status:true,metricsSnapshot:true}}), historyCount:await client.activityHistory.count() };
    await client.session.deleteMany({});
    await fs.writeFile(path.join(root,'resulting-state.json'),JSON.stringify({...state,sessionsRevoked:true},null,2));
  } finally {await client.$disconnect();}
  await fs.rm(path.join(root,'fixture.json'));
  console.log(`Cleaned synthetic sessions/credentials; offline DB and redacted results retained: ${root}`);
  process.exit(0);
}
const build = path.resolve(process.argv[2] || '');
if (!build.includes('qadesk-phase2-baseline') || build === path.resolve('.next/standalone')) throw new Error('Explicit isolated artifact required');
const port = 3119, origin = `http://127.0.0.1:${port}`;
await new Promise((resolve, reject) => { const s = net.createServer(); s.once('error', reject); s.listen(port, '127.0.0.1', () => s.close(resolve)); });
const root = await fs.mkdtemp(path.join(os.tmpdir(), 'qadesk-phase7-'));
const databaseUrl = `file:${path.join(root, 'synthetic.db').replaceAll('\\', '/')}`;
await fs.writeFile(path.join(root, 'synthetic.db'), '');
execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'db', 'push', '--schema', path.resolve('prisma/sqlite.prisma'), '--skip-generate'], { env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: 'pipe' });
const db = new PrismaClient({ datasourceUrl: databaseUrl });
const password = crypto.randomBytes(24).toString('base64url');
const salt = crypto.randomBytes(16).toString('hex');
const hash = `scrypt$${salt}$${crypto.scryptSync(password, salt, 64).toString('hex')}`;
const ws = await db.workspace.create({ data: { name: 'Phase7 A', slug: crypto.randomUUID() } });
const foreignWs = await db.workspace.create({ data: { name: 'Phase7 B', slug: crypto.randomUUID() } });
const actors = {};
const emptyWorkspace = process.argv.includes('--ux') ? await db.workspace.create({ data: { name: 'Phase7 Empty', slug: crypto.randomUUID() } }) : null;
const actorRoles = [['lead','QA_LEAD'],['qa','QA'],['viewer','VIEWER'],['foreign','OWNER']];
if (process.argv.includes('--ux')) actorRoles.push(['admin','ADMIN'], ['owner','OWNER'], ['multi','ADMIN'], ['emptyOwner','OWNER']);
for (const [alias, role] of actorRoles) {
  const user = await db.user.create({ data: { name: `Phase7 ${alias}`, email: `${alias}-${crypto.randomUUID()}@example.test`, passwordHash: hash } });
  await db.workspaceMembership.create({ data: { workspaceId: alias === 'emptyOwner' ? emptyWorkspace.id : alias === 'foreign' ? foreignWs.id : ws.id, userId: user.id, role } });
  if (alias === 'multi') await db.workspaceMembership.create({ data: { workspaceId: foreignWs.id, userId: user.id, role: 'VIEWER' } });
  const token = crypto.randomBytes(32).toString('base64url');
  await db.session.create({ data: { userId: user.id, tokenHash: crypto.createHash('sha256').update(token).digest('hex'), expiresAt: new Date(Date.now()+86400000) } });
  actors[alias] = { email: user.email, id: user.id, token, role };
}
const project = await db.project.create({ data: { workspaceId: ws.id, name: 'Phase7 Acceptance' } });
const second = await db.project.create({ data: { workspaceId: ws.id, name: 'Phase7 Alternate' } });
const foreign = await db.project.create({ data: { workspaceId: foreignWs.id, name: 'Phase7 Private' } });
const modules = [];
for (const name of ['Checkout','Authentication','Profile']) modules.push(await db.module.create({ data: { projectId: project.id, name } }));
const cases = [];
for (let i=1;i<=24;i++) cases.push(await db.testCase.create({ data: { projectId: project.id, moduleId: modules[(i-1)%3].id, testCaseId: `P7-${String(i).padStart(3,'0')}`, page: ['Checkout','Login','Profile'][(i-1)%3], testAction: `Synthetic scenario ${i}`, steps: 'Open page\nSubmit synthetic input\nCheck result', expectedResult: 'Expected synthetic result', priority: ['High','Medium','Low'][i%3], testType: i%2 ? 'Positive':'Negative', status: 'NOT DONE' } }));
const foreignCase = await db.testCase.create({ data: { projectId: foreign.id, testCaseId: 'P7-001', page: 'PRIVATE-P7-MARKER', testType: 'Positive', testAction: 'Private', steps: 'Private', expectedResult: 'Private' } });
await db.testCase.create({ data: { projectId: second.id, testCaseId: 'ALT-001', page: 'Alternate', testType: 'Positive', testAction: 'Alternate scenario', steps: 'Open', expectedResult: 'Alternate' } });
const requirement = await db.requirement.create({ data: { projectId: project.id, key: 'P7-REQ', title: 'Checkout acceptance' } });
const plan = await db.testPlan.create({ data: { projectId: project.id, name: 'Phase7 Plan' } });
await db.testPlanRequirement.create({ data: { testPlanId: plan.id, requirementId: requirement.id } });
for (const tc of cases.slice(0,3)) await db.requirementTestCase.create({ data: { requirementId: requirement.id, testCaseId: tc.id } });
const run = await db.testRun.create({ data: { projectId: project.id, testPlanId: plan.id, name: 'Phase7 Cycle', assignedTo: 'Phase7 QA', status: 'IN PROGRESS' } });
for (const tc of cases.slice(0,4)) await db.testRunCase.create({ data: { testRunId: run.id, testCaseId: tc.id } });
const foreignRun = await db.testRun.create({data:{projectId:foreign.id,name:'Private evidence cycle',status:'ARCHIVED'}});
const foreignExecution = await db.testExecution.create({data:{testRunId:foreignRun.id,testCaseId:foreignCase.id,status:'FAILED'}});
const foreignEvidence = await db.testExecutionEvidence.create({data:{executionId:foreignExecution.id,fileName:'private.png',mimeType:'image/png',sizeBytes:3,storagePath:'synthetic/private.png'}});
await fs.mkdir(path.join(root,'evidence/synthetic'),{recursive:true});
await fs.writeFile(path.join(root,'evidence/synthetic/private.png'),'P7B');
await fs.writeFile(path.join(root,'fixture.json'), JSON.stringify({ root, databaseUrl, origin, password, actors, project, second, foreign, foreignCase, foreignRun, foreignExecution, foreignEvidence, modules, cases, requirement, plan, run },null,2));
await db.$disconnect();
const server = fork(path.resolve('scripts/phase6c-server.mjs'), [build], { windowsHide: true, silent: true, env: { ...process.env, NODE_ENV:'production', HOSTNAME:'127.0.0.1', PORT:String(port), DATABASE_URL:databaseUrl, POSTGRES_DATABASE_URL:'', QA_PHASE6C_ROOT:root, QA_RUNTIME_DIR:path.join(root,'runtime'), QA_EVIDENCE_STORAGE_DIR:path.join(root,'evidence'), APP_URL:origin, QA_ALLOWED_ORIGINS:origin, QA_COOKIE_SECURE:'0', QA_RELAY_TOKEN:'', GROQ_API_KEY:'', GEMINI_API_KEY:'', QA_PHASE6C_PROFILE:'' } });
const log = await fs.open(path.join(root,'server.log'),'a');
server.stdout.on('data', b => { void log.write(b); }); server.stderr.on('data', b => { void log.write(b); });
await fs.writeFile(path.join(root,'owned-server.json'),JSON.stringify({ pid:server.pid, parent:process.pid, build, port }));
console.log(`PHASE7_ROOT=${root}`);
process.on('SIGINT',()=>server.send({op:'shutdown'}));
process.on('SIGTERM',()=>server.send({op:'shutdown'}));
server.on('exit',async code=>{ await log.close(); process.exitCode = code === 143 ? 0 : code || 0; });
