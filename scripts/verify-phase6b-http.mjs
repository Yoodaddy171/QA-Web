import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { seedAuthorizationFixture } from './phase6b-fixture.mjs';
import net from 'node:net';
import * as XLSX from 'xlsx';

const args = process.argv.slice(2);
const buildRoot = path.resolve(args[0] || '.next/standalone');
const port = Number(args[1] || 3116);
if (!Number.isInteger(port) || port < 3100 || port > 3199) throw new Error('Use an owned 31xx port only');
await new Promise((resolve, reject) => {
  const probe = net.createServer();
  probe.once('error', reject);
  probe.listen(port, '127.0.0.1', () => probe.close(resolve));
});
await fs.access(path.join(buildRoot, 'server.js'));
const require = createRequire(path.resolve('package.json'));
const { PrismaClient } = require('@prisma/client');
const root = await fs.mkdtemp(path.join(os.tmpdir(), 'qadesk-phase6b-http-'));
const database = path.join(root, 'synthetic.db');
await fs.writeFile(database, '');
const url = `file:${database.replaceAll('\\', '/')}`;
execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'db', 'push', '--schema', path.resolve('prisma/sqlite.prisma'), '--skip-generate'], { env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });
const client = new PrismaClient({ datasourceUrl: url, log: [] });
const data = await seedAuthorizationFixture(client);
// Custom legacy IDs remain valid schema values. This checks the API matcher,
// not a claim that ordinary generated CUIDs contain filename extensions.
const extensionReport = await client.report.create({ data: {
  id: `${data.resources.b.report.id}.js`, projectId: data.resources.b.project.id,
  reportType: 'TEST_PLANNING_DOCUMENT', version: 'extension', metricsSnapshot: {},
  reportingPeriodStart: new Date('2020-01-01'), reportingPeriodEnd: new Date('2020-01-02'),
} });
const origin = `http://127.0.0.1:${port}`;
const env = { ...process.env, NODE_ENV: 'production', HOSTNAME: '127.0.0.1', PORT: String(port), DATABASE_URL: url,
  POSTGRES_DATABASE_URL: '', QA_RUNTIME_DIR: path.join(root, 'runtime'), QA_EVIDENCE_STORAGE_DIR: path.join(root, 'evidence'),
  QA_LEGACY_LOGS_DIR: path.join(root, 'logs'), QA_LEGACY_RECORDINGS_DIR: path.join(root, 'recordings'), APP_URL: origin,
  QA_ALLOWED_ORIGINS: origin, QA_COOKIE_SECURE: '0', QA_BOOTSTRAP_TOKEN: '', QA_RELAY_TOKEN: '', NEXT_PUBLIC_QA_RELAY_TOKEN: '',
  AI_PROVIDER: 'groq', GROQ_API_KEY: '', GEMINI_API_KEY: '', OLLAMA_BASE_URL: '', FFMPEG_PATH: '' };
let serverError = '';
const server = spawn(process.execPath, [path.join(buildRoot, 'server.js')], { cwd: buildRoot, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
server.stderr.on('data', chunk => { serverError = (serverError + chunk.toString()).slice(-3000); });
server.stdout.on('data', () => {});
const results = [];
const send = async (endpoint, actor = 'qa', method = 'GET', body, headers = {}) => {
  const response = await fetch(`${origin}${endpoint}`, { method, redirect: 'manual', headers: {
    Origin: origin, ...(actor ? { Cookie: `qa_session=${data.actors[actor].token}` } : {}),
    ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers,
  }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(10_000) });
  const text = await response.text();
  return { response, text, json: () => JSON.parse(text) };
};
const record = (name, status, pass, extra = {}) => { results.push({ name, status, pass, ...extra }); };
try {
  const deadline = Date.now() + 60_000;
  while (true) {
    if (server.exitCode !== null) throw new Error('Owned server exited before readiness');
    try { if ((await fetch(`${origin}/api/auth/status`, { signal: AbortSignal.timeout(1000) })).ok) break; } catch {}
    if (Date.now() >= deadline) throw new Error('Owned server readiness timeout');
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  const a = data.resources.a, b = data.resources.b;
  let result = await send('/api/auth/status');
  record('synthetic session identity', result.response.status, result.json().user?.id === data.actors.qa.user.id);
  result = await send('/api/readiness');
  record('readiness and FFmpeg preserved', result.response.status, result.response.status === 200 && result.json().checks?.find(check => check.id === 'ffmpeg')?.status === 'ready');
  result = await send(`/api/testcases?projectId=${a.project.id}`);
  record('authorized list positive', result.response.status, result.response.status === 200 && result.json().testCases.every(row => row.projectId === a.project.id));
  result = await send(`/api/testcases?id=${a.tc.id}`);
  record('6B-SCOPE ID-only list', result.response.status, result.response.status === 400, { foreignRecordExposed: result.text.includes(b.tc.id) });
  const beforeCount = await client.testCase.count({ where: { projectId: b.project.id } });
  result = await send(`/api/testcases?projectId=${a.project.id}`, 'qa', 'POST', { projectId: b.project.id, testCaseId: 'HTTP-FOREIGN', page: 'Synthetic', testAction: 'Submit', steps: 'Click', expectedResult: 'Saved' });
  const afterCount = await client.testCase.count({ where: { projectId: b.project.id } });
  record('6B-QUERY-BODY creation', result.response.status, result.response.status === 403 && afterCount === beforeCount, { foreignRecordDelta: afterCount - beforeCount });
  result = await send(`/api/bugfix?projectId=${a.project.id}`, 'qa', 'PUT', { id: b.bug.id, status: 'READY TO RETEST' }, { 'Content-Type': 'text/plain' });
  const foreignBug = await client.bugFix.findUniqueOrThrow({ where: { id: b.bug.id } });
  record('6B-BODY content type', result.response.status, [400, 403, 415].includes(result.response.status) && foreignBug.status === 'SEDANG DI FIX', { foreignStatusChanged: foreignBug.status !== 'SEDANG DI FIX' });
  const encoded = `%${b.report.id.charCodeAt(0).toString(16)}${b.report.id.slice(1)}`;
  result = await send(`/api/reports/${encoded}?projectId=${a.project.id}`);
  record('6B-PATH encoded ownership', result.response.status, [403, 404].includes(result.response.status), { foreignRecordExposed: result.text.includes(b.report.id) });
  result = await send(`/api/reports/${extensionReport.id}`, null);
  record('6B-MATCHER API filename-like ID', result.response.status, result.response.status === 401, { foreignRecordExposed: result.text.includes(extensionReport.id) });
  result = await send(`/api/reports/${extensionReport.id}`, 'foreign');
  record('filename-like ID authorized positive', result.response.status, result.response.status === 200);
  result = await send(`/api/evidence?projectId=${a.project.id}&testCaseId=${a.tc.id}`);
  record('6B-EVIDENCE scoped telemetry', result.response.status, result.response.status === 200 && result.text.includes('SYNTHETIC-a-PRIVATE-LOG') && !result.text.includes('SYNTHETIC-b-PRIVATE-LOG'), { foreignLogExposed: result.text.includes('SYNTHETIC-b-PRIVATE-LOG') });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([{ ID: 'HTTP-IMPORT-FOREIGN', Page: 'Synthetic', Feature: 'Submit', Test: 'Synthetic import', Step: 'Click', 'Expected Result': 'Saved', Status: 'NOT DONE' }]), 'Synthetic');
  const form = new FormData();
  form.set('projectId', b.project.id); form.set('mode', 'import');
  form.set('file', new File([XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })], 'synthetic.xlsx'));
  const beforeImport = await client.testCase.count({ where: { projectId: b.project.id } });
  const imported = await fetch(`${origin}/api/excel?projectId=${a.project.id}`, { method: 'POST', headers: { Origin: origin, Cookie: `qa_session=${data.actors.qa.token}` }, body: form });
  await imported.text();
  const importDelta = await client.testCase.count({ where: { projectId: b.project.id } }) - beforeImport;
  record('6B-MULTIPART foreign import', imported.status, imported.status === 400 && importDelta === 0, { foreignRecordDelta: importDelta });
  result = await send(`/api/testcases?projectId=${b.project.id}`, 'qa');
  record('cross-workspace normal ID denied', result.response.status, result.response.status === 403);
  result = await send(`/api/bugfix`, 'viewer', 'PUT', { id: a.bug.id, status: 'READY TO RETEST' }, { 'x-qa-role': 'OWNER', 'x-qa-user-id': data.actors.foreign.user.id });
  record('viewer cannot spoof identity/role', result.response.status, result.response.status === 403);
  result = await send('/api/projects', 'qa', 'GET', undefined, { 'x-qa-user-id': data.actors.foreign.user.id, 'x-qa-workspace-id': data.workspaces.b.id, 'x-qa-role': 'OWNER' });
  record('trusted identity header overwrite', result.response.status, result.response.status === 200 && result.json().every(project => project.workspaceId === data.workspaces.a.id));
  result = await send(`/api/bugfix?projectId=${a.project.id}`, 'qa', 'POST', {});
  record('unsupported HTTP method', result.response.status, result.response.status === 405);
  result = await send('/api/auth/login', null, 'POST', { email: data.actors.viewer.user.email, password: data.password });
  const cookie = result.response.headers.get('set-cookie')?.split(';')[0];
  record('real synthetic login', result.response.status, result.response.status === 200 && Boolean(cookie));
  if (cookie) {
    const logout = await fetch(`${origin}/api/auth/logout`, { method: 'POST', headers: { Cookie: cookie, Origin: origin } });
    const stale = await fetch(`${origin}/api/projects`, { headers: { Cookie: cookie } });
    record('logout revokes old session', stale.status, logout.status === 200 && stale.status === 401);
  }
  const summary = { buildId: (await fs.readFile(path.join(buildRoot, '.next/BUILD_ID'), 'utf8')).trim(), port, passed: results.filter(r => r.pass).length, total: results.length, results };
  const out = path.join(root, 'results.json');
  await fs.writeFile(out, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ ...summary, evidence: out }, null, 2));
  if (results.some(r => !r.pass)) process.exitCode = 1;
} catch (error) {
  // Runtime errors only; never print response cookies, credentials or raw DB logs.
  console.error('HTTP verification failed:', error instanceof Error ? error.message : 'unknown');
  process.exitCode = 1;
} finally {
  if (server.exitCode === null) {
    server.kill();
    await new Promise(resolve => { if (server.exitCode !== null) resolve(); else server.once('exit', resolve); });
  }
  await client.$disconnect();
  // Keep only redacted results; discard synthetic accounts, sessions and files.
  for (const file of await fs.readdir(root)) if (file !== 'results.json') await fs.rm(path.join(root, file), { recursive: true, force: true });
}
