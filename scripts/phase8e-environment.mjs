import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const primary = await fs.realpath(process.cwd());
const root = path.join(await fs.realpath(os.tmpdir()), 'qadesk-phase8e-20261019');
const checkout = path.join(root, 'candidate');
const mode = process.argv[2] || 'prepare';
const git = (...args) => execFileSync('git', args, { cwd: primary, encoding: 'utf8' }).trim();
if (path.resolve(git('rev-parse', '--show-toplevel')).toLowerCase() !== primary.toLowerCase() || git('branch', '--show-current') !== 'codex/frontend-design-system-motion-optimization') throw Error('Unexpected primary checkout/branch');
if (path.dirname(root) !== await fs.realpath(os.tmpdir()) || checkout === primary) throw Error('Unsafe isolation path');
if (mode === 'prepare') {
  await fs.mkdir(root); // Refuse to reuse an older phase fixture.
  await fs.writeFile(path.join(root, 'primary-safety.json'), JSON.stringify({ root: primary, head: git('rev-parse', 'HEAD'), buildId: await fs.readFile(path.join(primary, '.next/BUILD_ID'), 'utf8') }));
  git('worktree', 'add', '--detach', checkout, 'HEAD');
  await fs.symlink(path.join(primary, 'node_modules'), path.join(checkout, 'node_modules'), 'junction');
}
if (mode === 'prepare' || mode === 'sync') {
  const files = [...new Set([...git('ls-files').split('\n'), ...git('ls-files', '--others', '--exclude-standard').split('\n')])].filter(f => /^(src\/|prisma\/(?!db\/)|scripts\/|public\/|[^/]+\.(json|ts|mjs|js))/.test(f) && !f.startsWith('.env') && !/\.(db|sqlite|jsonl)$/.test(f));
  const manifest = [];
  for (const file of files) {
    const from = path.join(primary, file), to = path.join(checkout, file);
    try { const bytes = await fs.readFile(from); const existing = await fs.readFile(to).catch(() => null); if (!existing?.equals(bytes)) { await fs.mkdir(path.dirname(to), { recursive: true }); await fs.writeFile(to, bytes); } manifest.push({ file, sha256: crypto.createHash('sha256').update(bytes).digest('hex') }); }
    catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
  await fs.writeFile(path.join(root, `source-${mode}.json`), JSON.stringify(manifest, null, 2));
  console.log(`Candidate source synchronized: ${manifest.length} files; ${checkout}`);
}
if (!['prepare', 'fixture'].includes(mode)) process.exit(0);
const databaseUrl = `file:${path.join(root, 'synthetic.db').replaceAll('\\', '/')}`;
await fs.writeFile(path.join(root, 'synthetic.db'), '', { flag: 'wx' });
execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'db', 'push', '--schema', path.join(checkout, 'prisma/sqlite.prisma'), '--skip-generate'], { cwd: root, env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: 'pipe' });
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient({ datasourceUrl: databaseUrl });
try {
  const a = await db.workspace.create({ data: { name: 'Graph QA Workspace A', slug: 'graph-8e-a' } });
  const b = await db.workspace.create({ data: { name: 'Graph QA Workspace B', slug: 'graph-8e-b' } });
  const actors = {};
  for (const [alias, role, workspaceId] of [['owner', 'OWNER', a.id], ['viewer', 'VIEWER', a.id], ['foreign', 'OWNER', b.id]]) {
    const user = await db.user.create({ data: { name: `Graph ${alias}`, email: `${alias}@graph8e.example.test`, passwordHash: 'synthetic-no-password-login' } });
    await db.workspaceMembership.create({ data: { userId: user.id, workspaceId, role } });
    const token = crypto.randomBytes(32).toString('base64url');
    await db.session.create({ data: { userId: user.id, tokenHash: crypto.createHash('sha256').update(token).digest('hex'), expiresAt: new Date(Date.now() + 86400000) } });
    actors[alias] = { id: user.id, role, workspaceId, token };
  }
  const project = await db.project.create({ data: { name: 'Mercury — Graph QA', workspaceId: a.id } });
  const foreign = await db.project.create({ data: { name: 'PRIVATE-GRAPH-B', workspaceId: b.id } });
  const empty = await db.project.create({ data: { name: 'Empty Graph Project', workspaceId: a.id } });
  const modules = [];
  for (const name of ['Identity & Access', 'Checkout & Orders']) modules.push(await db.module.create({ data: { projectId: project.id, name } }));
  const cases = [];
  for (let i = 0; i < 15; i++) cases.push(await db.testCase.create({ data: { projectId: project.id, moduleId: modules[i % 2].id, testCaseId: `AUTH-${String(i + 1).padStart(3, '0')}`, page: 'Login', testType: 'Positive', testAction: i === 0 ? 'Preserve requested page after authentication' : `Validate customer journey ${i + 1}`, steps: 'Open login\nEnter synthetic credentials\nVerify requested page', expectedResult: 'Requested page is restored', status: i === 0 ? 'FAILED' : 'NOT DONE' } }));
  const foreignCase = await db.testCase.create({ data: { projectId: foreign.id, testCaseId: 'PRIVATE-CASE-B', page: 'Private', testType: 'Positive', testAction: 'Private foreign case', steps: 'Private', expectedResult: 'Private' } });
  const req = await db.requirement.create({ data: { projectId: project.id, key: 'REQ-AUTH', title: 'Restore customer journey after login' } });
  const unlinked = await db.requirement.create({ data: { projectId: project.id, key: 'REQ-UNLINKED', title: 'No links yet' } });
  const partial = await db.requirement.create({ data: { projectId: project.id, key: 'REQ-PARTIAL', title: 'Accessible customer journey' } });
  const plan = await db.testPlan.create({ data: { projectId: project.id, name: 'Release 1.4 Quality Plan' } });
  await db.testPlanRequirement.create({ data: { requirementId: req.id, testPlanId: plan.id } });
  for (const c of cases.slice(0, 14)) await db.requirementTestCase.create({ data: { requirementId: req.id, testCaseId: c.id } });
  await db.requirementTestCase.create({ data: { requirementId: partial.id, testCaseId: cases[0].id } });
  const run = await db.testRun.create({ data: { projectId: project.id, name: 'Sprint 12 Authentication', testPlanId: plan.id, status: 'IN PROGRESS' } });
  const otherRun = await db.testRun.create({ data: { projectId: project.id, name: 'Release Smoke', testPlanId: plan.id } });
  const executions = [];
  for (const r of [run, otherRun]) for (const c of cases.slice(0, 3)) {
    const membership = await db.testRunCase.create({ data: { testRunId: r.id, testCaseId: c.id, latestStatus: 'FAILED' } });
    executions.push(await db.testExecution.create({ data: { testRunId: r.id, testCaseId: c.id, testRunCaseId: membership.id, status: 'FAILED', tester: 'Graph Tester' } }));
  }
  const bugs = [];
  for (const [index, status] of [[0, 'SUDAH DILAPORKAN'], [1, 'VERIFIED & FIXED']]) {
    const c = cases[index];
    bugs.push(await db.bugFix.create({ data: { sourceTestCaseId: c.id, sourceExecutionId: executions[index].id, testCaseId: c.testCaseId, projectId: project.id, moduleId: c.moduleId, page: c.page, testType: c.testType, testAction: c.testAction, steps: c.steps, expectedResult: c.expectedResult, actualResult: 'Unexpected redirect', priority: 'High', status } }));
  }
  const retest = await db.testExecution.create({ data: { testCaseId: cases[0].id, testRunId: run.id, bugFixId: bugs[0].id, status: 'RETEST', tester: 'Graph Retester' } });
  const fixture = { root, checkout, databaseUrl, origin: 'http://127.0.0.1:3127', actors, project, foreign, empty, modules, cases, foreignCase, req, unlinked, partial, plan, run, otherRun, executions, bugs, retest };
  await fs.writeFile(path.join(root, 'fixture.json'), JSON.stringify(fixture, null, 2));
  console.log(`Synthetic fixture ready at ${root}; credentials stay private.`);
} finally { await db.$disconnect(); }
