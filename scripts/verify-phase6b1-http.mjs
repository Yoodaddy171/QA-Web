import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import * as XLSX from 'xlsx';
import { seedAuthorizationFixture } from './phase6b-fixture.mjs';

// Incremental release checks, not a repeat of the complete Phase 6B matrix.
const buildRoot = path.resolve(process.argv[2] || '.next/standalone');
const port = Number(process.argv[3] || 3117);
if (!Number.isInteger(port) || port < 3100 || port > 3199) throw new Error('Owned 31xx port required');
await new Promise((resolve, reject) => {
  const probe = net.createServer(); probe.once('error', reject);
  probe.listen(port, '127.0.0.1', () => probe.close(resolve));
});
await fs.access(path.join(buildRoot, 'server.js'));
const require = createRequire(path.resolve('package.json'));
const { PrismaClient } = require('@prisma/client');
const root = await fs.mkdtemp(path.join(os.tmpdir(), 'qadesk-phase6b1-http-'));
const database = path.join(root, 'synthetic.db');
const url = `file:${database.replaceAll('\\', '/')}`;
const client = new PrismaClient({ datasourceUrl: url, log: [] });
let server;
const results = [];
try {
  await fs.writeFile(database, '');
  execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'db', 'push', '--schema', path.resolve('prisma/sqlite.prisma'), '--skip-generate'], { env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });
  const data = await seedAuthorizationFixture(client);
  const a = data.resources.a, b = data.resources.b;
  const reportFields = { projectId: b.project.id, reportType: b.report.reportType, author: 'Synthetic',
    approvedBy: 'Synthetic', metricsSnapshot: {}, progressNarrative: 'SYNTHETIC-b-REPORT',
    reportingPeriodStart: new Date('2020-01-01'), reportingPeriodEnd: new Date('2020-01-02') };
  const slash = await client.report.create({ data: { ...reportFields, version: 'slash', id: `${a.report.id}/foreign` } });
  const suffix = await client.report.create({ data: { ...reportFields, version: 'suffix', id: `${b.report.id}.js` } });
  const reservedReports = [];
  for (const id of ['next-id', 'read-all']) reservedReports.push(await client.report.create({ data: { ...reportFields, version: id, id } }));
  const origin = `http://127.0.0.1:${port}`;
  const env = { ...process.env, NODE_ENV: 'production', HOSTNAME: '127.0.0.1', PORT: String(port), DATABASE_URL: url,
    POSTGRES_DATABASE_URL: '', QA_RUNTIME_DIR: path.join(root, 'runtime'), QA_EVIDENCE_STORAGE_DIR: path.join(root, 'evidence'),
    APP_URL: origin, QA_ALLOWED_ORIGINS: origin, QA_COOKIE_SECURE: '0', QA_BOOTSTRAP_TOKEN: '', QA_RELAY_TOKEN: '',
    NEXT_PUBLIC_QA_RELAY_TOKEN: '', GROQ_API_KEY: '', GEMINI_API_KEY: '', OLLAMA_BASE_URL: '', FFMPEG_PATH: '' };
  server = spawn(process.execPath, [path.join(buildRoot, 'server.js')], { cwd: buildRoot, env, windowsHide: true, stdio: 'ignore' });
  const deadline = Date.now() + 60_000;
  while (true) {
    if (server.exitCode !== null) throw new Error('Owned server exited');
    try { if ((await fetch(`${origin}/api/auth/status`, { signal: AbortSignal.timeout(1000) })).ok) break; } catch {}
    if (Date.now() > deadline) throw new Error('Readiness timeout');
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  const send = async (endpoint, actor = 'qa', method = 'GET', body) => {
    const response = await fetch(`${origin}${endpoint}`, { method, redirect: 'manual', headers: {
      Origin: origin, ...(actor ? { Cookie: `qa_session=${data.actors[actor].token}` } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(10_000) });
    const text = await response.text();
    return { response, text, json: () => JSON.parse(text) };
  };
  const record = (name, result, pass, extra = {}) => results.push({ name, status: result.response.status, pass, ...extra });
  let result = await send(`/api/reports/${encodeURIComponent(slash.id)}`);
  record('6B1-PATH foreign ID containing encoded separator', result, [403, 404].includes(result.response.status) && !result.text.includes('SYNTHETIC-b-REPORT'), { foreignRecordExposed: result.text.includes('SYNTHETIC-b-REPORT') });
  result = await send(`/api/reports/${encodeURIComponent(slash.id)}`, 'qa', 'PATCH', { author: 'Synthetic unauthorized edit' });
  const foreignReportChanged = (await client.report.findUniqueOrThrow({ where: { id: slash.id } })).author !== 'Synthetic';
  record('6B1-PATH foreign mutation with encoded separator', result, result.response.status === 403 && !foreignReportChanged, { foreignReportChanged });
  result = await send(`/api/reports/${encodeURIComponent(slash.id)}`, 'foreign');
  record('encoded separator legitimate owner', result, result.response.status === 200 && result.json().report.id === slash.id);
  for (const report of reservedReports) {
    result = await send(`/api/reports/${report.id}?projectId=${a.project.id}`);
    record(`6B1-PATH reserved ${report.id} foreign read`, result, result.response.status === 403 && !result.text.includes('SYNTHETIC-b-REPORT'));
    result = await send(`/api/reports/${report.id}?projectId=${a.project.id}`, 'qa', 'PATCH', { author: 'Unauthorized' });
    record(`6B1-PATH reserved ${report.id} foreign mutation`, result, result.response.status === 403 && (await client.report.findUniqueOrThrow({ where: { id: report.id } })).author === 'Synthetic');
    result = await send(`/api/reports/${report.id}`, 'foreign');
    record(`reserved ${report.id} legitimate owner`, result, result.response.status === 200 && result.json().report.id === report.id);
  }
  if (!process.argv.includes('--paths-only')) {
  result = await send(`/api/reports/${suffix.id}`, null);
  record('filename-like API authentication', result, result.response.status === 401);
  result = await send(`/api/testcases?projectId=${b.project.id}`);
  record('cross-workspace read', result, result.response.status === 403);
  const foreignBefore = await client.bugFix.findUniqueOrThrow({ where: { id: b.bug.id } });
  result = await send(`/api/bugfix?projectId=${a.project.id}`, 'qa', 'PUT', { id: b.bug.id, status: 'READY TO RETEST' });
  record('cross-workspace mutation', result, result.response.status === 403 && JSON.stringify(await client.bugFix.findUniqueOrThrow({ where: { id: b.bug.id } })) === JSON.stringify(foreignBefore));
  result = await send('/api/projects');
  record('projects list', result, result.response.status === 200 && result.json().every(row => row.workspaceId === data.workspaces.a.id));
  result = await send(`/api/testcases?projectId=${a.project.id}`);
  record('authorized testcase read', result, result.response.status === 200 && result.json().testCases.some(row => row.id === a.tc.id));
  result = await send('/api/testcases', 'qa', 'POST', { projectId: a.project.id, testCaseId: 'RELEASE-001', page: 'Release', testAction: 'Save', steps: 'Click', expectedResult: 'Saved' });
  const createdId = result.response.status === 201 ? result.json().id : '';
  record('authorized testcase create', result, Boolean(createdId) && Boolean(await client.testCase.findFirst({ where: { id: createdId, projectId: a.project.id } })));
  result = await send(`/api/bugfix?projectId=${a.project.id}`);
  record('authorized bugs read', result, result.response.status === 200 && result.json().bugFixItems.some(row => row.id === a.bug.id));
  result = await send('/api/bugfix', 'qa', 'PUT', { id: a.bug.id, status: 'READY TO RETEST' });
  record('READY synchronization', result, result.response.status === 200 && (await client.testCase.findUniqueOrThrow({ where: { id: a.tc.id } })).status === 'READY TO RETEST');
  result = await send('/api/testcases', 'qa', 'PUT', { id: a.tc.id, status: 'DONE' });
  record('successful retest verifies bug', result, result.response.status === 200 && (await client.bugFix.findUniqueOrThrow({ where: { id: a.bug.id } })).status === 'VERIFIED & FIXED');
  result = await send(`/api/test-runs/${a.run.id}/executions`, 'qa', 'PUT', { projectId: a.project.id, executionId: a.execution.id, status: 'PASSED' });
  record('authorized execution update', result, result.response.status === 200 && (await client.testExecution.findUniqueOrThrow({ where: { id: a.execution.id } })).status === 'PASSED');
  await client.bugFix.update({ where: { id: a.bug.id }, data: { sourceTestCaseId: data.resources.a2.tc.id } });
  const conflictBefore = await client.bugFix.findUniqueOrThrow({ where: { id: a.bug.id } });
  result = await send('/api/bugfix', 'qa', 'PUT', { id: a.bug.id, status: 'READY TO RETEST' });
  record('Phase 6A relationship conflict HTTP 409', result, result.response.status === 409 && JSON.stringify(await client.bugFix.findUniqueOrThrow({ where: { id: a.bug.id } })) === JSON.stringify(conflictBefore));
  await client.bugFix.update({ where: { id: a.bug.id }, data: { sourceTestCaseId: a.tc.id } });
  result = await send(`/api/reports/${a.report.id}/finalize`, 'lead', 'POST', {});
  record('authorized report finalize', result, result.response.status === 200 && (await client.report.findUniqueOrThrow({ where: { id: a.report.id } })).status === 'FINAL');
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([{ ID: 'IMPORT-RELEASE-001', Page: 'Synthetic', Feature: 'Save', Test: 'Release', Step: 'Click', 'Expected Result': 'Saved', Status: 'NOT DONE' }]), 'Synthetic');
  for (const [mode, formProject] of [['preview', a.project.id], ['import', b.project.id], ['import', a.project.id]]) {
    const form = new FormData(); form.set('projectId', formProject); form.set('mode', mode);
    form.set('file', new File([XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })], 'synthetic.xlsx'));
    const before = await client.testCase.count({ where: { projectId: formProject } });
    const response = await fetch(`${origin}/api/excel?projectId=${a.project.id}`, { method: 'POST', headers: { Origin: origin, Cookie: `qa_session=${data.actors.qa.token}` }, body: form });
    const json = await response.json();
    const delta = await client.testCase.count({ where: { projectId: formProject } }) - before;
    results.push({ name: `Excel ${mode} ${formProject === a.project.id ? 'authorized' : 'mismatch'}`, status: response.status,
      pass: mode === 'preview' ? response.status === 200 && json.canImport === true && delta === 0 : formProject === b.project.id ? response.status === 400 && delta === 0 : response.status === 201 && json.imported === 1 && delta === 1 });
  }
  result = await send(`/api/evidence?projectId=${a.project.id}&testCaseId=${a.tc.id}`);
  record('evidence isolation', result, result.response.status === 200 && result.text.includes('SYNTHETIC-a-PRIVATE-LOG') && !result.text.includes('SYNTHETIC-b-PRIVATE-LOG'));
  result = await send('/api/auth/login', null, 'POST', { email: data.actors.viewer.user.email, password: data.password });
  const cookie = result.response.headers.get('set-cookie')?.split(';')[0];
  record('real login', result, result.response.status === 200 && Boolean(cookie));
  if (cookie) {
    const logout = await fetch(`${origin}/api/auth/logout`, { method: 'POST', headers: { Origin: origin, Cookie: cookie } });
    const stale = await fetch(`${origin}/api/projects`, { headers: { Cookie: cookie } });
    results.push({ name: 'logout invalidates session', status: stale.status, pass: logout.status === 200 && stale.status === 401 });
  }
  }
  const summary = { buildId: (await fs.readFile(path.join(buildRoot, '.next/BUILD_ID'), 'utf8')).trim(), port, results, passed: results.filter(row => row.pass).length, total: results.length };
  await fs.writeFile(path.join(root, 'results.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ ...summary, evidence: path.join(root, 'results.json') }, null, 2));
  if (results.some(row => !row.pass)) process.exitCode = 1;
} finally {
  if (server && server.exitCode === null) {
    server.kill(); await new Promise(resolve => { if (server.exitCode !== null) resolve(); else server.once('exit', resolve); });
  }
  await client.$disconnect();
  for (const file of await fs.readdir(root)) {
    if (file === 'results.json') continue;
    const target = path.resolve(root, file);
    if (!target.startsWith(`${path.resolve(root)}${path.sep}`)) throw new Error('Unsafe fixture cleanup target');
    await fs.rm(target, { recursive: true, force: true });
  }
}
