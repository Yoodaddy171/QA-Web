import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import net from 'node:net';
import { fork, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { runHttpConcurrency } from './phase6c-http-concurrency.mjs';

const require = createRequire(import.meta.url);
const { PrismaClient } = require('@prisma/client');
const buildRoot = path.resolve(process.argv[2] || '.next/standalone');
const label = process.argv[3] || 'baseline';
const port = Number(process.argv[4] || 3118);
if (!Number.isInteger(port) || port < 3100 || port > 3199) throw new Error('Owned 31xx port required');
await new Promise((resolve, reject) => { const s = net.createServer(); s.once('error', reject); s.listen(port, '127.0.0.1', () => s.close(resolve)); });
await fs.access(path.join(buildRoot, 'server.js'));
const root = await fs.mkdtemp(path.join(os.tmpdir(), 'qadesk-phase6c-bench-'));
const encode = value => JSON.stringify(value, (_, v) => typeof v === 'bigint' ? Number(v) : v, 2);
const requested = process.argv.find(arg => arg.startsWith('--sizes='))?.slice(8).split(',').map(Number);
const summary = { label, seed: 20261015, node: process.version, cpu: os.cpus()[0].model, logicalCpus: os.cpus().length,
  memoryBytes: os.totalmem(), git: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  buildId: (await fs.readFile(path.join(buildRoot, '.next/BUILD_ID'), 'utf8')).trim(), datasets: [] };
const chunked = async (rows, model) => { for (let i = 0; i < rows.length; i += 200) await model.createMany({ data: rows.slice(i, i + 200) }); };
for (const [n, bugs] of [[100, 25], [1000, 250], [5000, 1000]].filter(([n]) => !requested || requested.includes(n))) {
  const dir = path.join(root, String(n)); await fs.mkdir(dir);
  const file = path.join(dir, 'synthetic.db'); await fs.writeFile(file, '');
  const url = `file:${file.replaceAll('\\', '/')}`;
  execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'db', 'push', '--schema', path.resolve('prisma/sqlite.prisma'), '--skip-generate'], { env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });
  const client = new PrismaClient({ datasourceUrl: url, log: [] });
  let server;
  try {
    const generated = performance.now();
    await client.workspace.create({ data: { id: 'bench-w', name: 'Synthetic', slug: 'bench' } });
    await client.user.create({ data: { id: 'bench-u', name: 'Synthetic QA', email: 'synthetic@example.test', passwordHash: 'unused-login-disabled-fixture' } });
    await client.workspaceMembership.create({ data: { workspaceId: 'bench-w', userId: 'bench-u', role: 'QA_LEAD' } });
    const token = crypto.randomBytes(32).toString('base64url');
    await client.session.create({ data: { userId: 'bench-u', tokenHash: crypto.createHash('sha256').update(token).digest('hex'), expiresAt: new Date(Date.now() + 3_600_000) } });
    await client.project.create({ data: { id: 'bench-p', workspaceId: 'bench-w', name: 'Synthetic local project' } });
    await chunked(Array.from({ length: 10 }, (_, i) => ({ id: `module-${i}`, projectId: 'bench-p', name: `Module ${i}` })), client.module);
    const stages = ['SEDANG DI FIX', 'SUDAH DILAPORKAN', 'READY TO RETEST', 'VERIFIED & FIXED'];
    const statuses = ['NOT DONE', 'IN PROGRESS', 'DONE', 'FAILED', 'BLOCKED', 'TBA'];
    const cases = Array.from({ length: n }, (_, i) => {
      const stage = stages[i % 4];
      const status = i < bugs ? stage === 'READY TO RETEST' ? 'READY TO RETEST' : stage === 'VERIFIED & FIXED' ? 'DONE' : 'FAILED' : statuses[i % statuses.length];
      return { id: `case-${String(i).padStart(6, '0')}`, testCaseId: `LOCAL-${String(i + 1).padStart(5, '0')}`, projectId: 'bench-p', moduleId: `module-${i % 10}`,
        page: `Page ${i % 10}`, subMenu: i % 7 ? `Section ${Math.floor(i / 10) % 5}` : null, testType: i % 3 ? 'Positive' : 'Negative',
        testAction: `Verify ${['checkout', 'login', 'search', 'profile'][i % 4]} scenario ${i}`, steps: `Open page\nEnter synthetic input ${i}\nClick Save\nValidate result`, expectedResult: 'Valid synthetic result',
        status, actualResult: status === 'DONE' ? 'As Expected' : status === 'FAILED' ? 'Not As Expected' : null, priority: ['Low', 'Medium', 'High', 'Critical'][i % 4],
        progress: status === 'DONE' ? 100 : status === 'IN PROGRESS' ? 50 : 0, tags: i % 3 ? 'regression' : 'smoke',
        createdAt: new Date(Date.UTC(2026, 0, 1) + i * 60000), updatedAt: new Date(Date.UTC(2026, 0, 2) + i * 30000) };
    });
    await chunked(cases, client.testCase);
    await chunked(cases.slice(0, bugs).map((tc, i) => ({ id: `bug-${i}`, sourceTestCaseId: tc.id, projectId: tc.projectId, moduleId: tc.moduleId, testCaseId: tc.testCaseId,
      page: tc.page, subMenu: tc.subMenu, testType: tc.testType, testAction: tc.testAction, steps: tc.steps, expectedResult: tc.expectedResult,
      actualResult: 'Not As Expected', priority: tc.priority, status: stages[i % 4], reportedAt: tc.createdAt, fixingAt: i % 4 !== 1 ? tc.updatedAt : null,
      readyAt: i % 4 >= 2 ? tc.updatedAt : null, fixedAt: i % 4 === 3 ? tc.updatedAt : null, createdAt: tc.createdAt, updatedAt: tc.updatedAt })), client.bugFix);
    await chunked(Array.from({ length: 10 }, (_, i) => ({ id: `run-${i}`, projectId: 'bench-p', name: `Cycle ${i}`, status: i === 0 ? 'IN PROGRESS' : 'READY', updatedAt: new Date(Date.UTC(2026, 0, 20) - i * 60000) })), client.testRun);
    await chunked(cases.map((tc, i) => ({ id: `run-case-${i}`, testRunId: `run-${i % 10}`, testCaseId: tc.id, latestStatus: ['PASSED', 'FAILED', 'BLOCKED', 'NOT RUN'][i % 4] })), client.testRunCase);
    await chunked(cases.flatMap((tc, i) => [0, 1].map(j => ({ id: `exec-${i}-${j}`, testRunId: `run-${i % 10}`, testCaseId: tc.id, testRunCaseId: `run-case-${i}`,
      status: ['PASSED', 'FAILED', 'BLOCKED', 'NOT RUN'][(i + j) % 4], tester: 'Synthetic QA', notes: `Synthetic execution ${j}: ${'Observed behavior. '.repeat(8)}`, createdAt: new Date(Date.UTC(2026, 1, 1) + i * 1000 + j * 100) }))), client.testExecution);
    await chunked(cases.map((tc, i) => ({ projectId: tc.projectId, entityType: 'TestCase', entityId: tc.id, action: 'CREATED', actor: 'Synthetic QA', afterValue: { status: tc.status }, createdAt: tc.createdAt })), client.activityHistory);
    const generationMs = performance.now() - generated;
    const origin = `http://127.0.0.1:${port}`;
    const serverEnv = { ...process.env,
      NODE_ENV: 'production', HOSTNAME: '127.0.0.1', PORT: String(port), DATABASE_URL: url, POSTGRES_DATABASE_URL: '', QA_PHASE6C_ROOT: root,
      QA_RUNTIME_DIR: path.join(dir, 'runtime'), QA_EVIDENCE_STORAGE_DIR: path.join(dir, 'evidence'), APP_URL: origin, QA_ALLOWED_ORIGINS: origin,
      QA_COOKIE_SECURE: '0', QA_RELAY_TOKEN: '', NEXT_PUBLIC_QA_RELAY_TOKEN: '', GROQ_API_KEY: '', GEMINI_API_KEY: '', QA_PHASE6C_PROFILE: label.includes('detail') ? '1' : '' };
    const spawnServer = () => fork(path.resolve('scripts/phase6c-server.mjs'), [buildRoot], { windowsHide: true, silent: true, env: serverEnv });
    server = spawnServer();
    let stderr = ''; server.stderr.on('data', b => { stderr = (stderr + b).slice(-1500); }); server.stdout.on('data', () => {});
    const readyDeadline = Date.now() + 60_000;
    while (true) {
      if (server.exitCode !== null) throw new Error(`Owned server exited: ${stderr}`);
      try { if ((await fetch(`${origin}/api/auth/status`, { signal: AbortSignal.timeout(1000) })).ok) break; } catch {}
      if (Date.now() > readyDeadline) throw new Error('Owned server readiness timeout');
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    let metricId = 0;
    const metrics = (op = 'metrics') => new Promise((resolve, reject) => { const id = ++metricId;
      const timer = setTimeout(() => { server.off('message', listener); reject(new Error('Metrics timeout')); }, 3000);
      const listener = msg => { if (msg.id === id) { clearTimeout(timer); server.off('message', listener); resolve(msg); } };
      server.on('message', listener); server.send({ op, id });
    });
    const send = async (endpoint, method = 'GET', body) => {
      const before = await metrics(), start = performance.now();
      const response = await fetch(`${origin}${endpoint}`, { method, headers: { Cookie: `qa_session=${token}`, Origin: origin, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15_000) });
      const text = await response.text(), httpMs = performance.now() - start, after = await metrics();
      if (!response.ok) throw new Error(`Synthetic ${method} ${endpoint} returned ${response.status}: ${text.slice(0, 180)}`);
      const json = JSON.parse(text);
      return { httpMs, status: response.status, handlerMs: Number(response.headers.get('x-phase6c-handler-ms')) || null,
        queryCount: response.headers.has('x-phase6c-query-count') ? Number(response.headers.get('x-phase6c-query-count')) : after.query ? after.query.count - before.query.count : null,
        queryMs: response.headers.has('x-phase6c-query-ms') ? Number(response.headers.get('x-phase6c-query-ms')) : after.query ? after.query.ms - before.query.ms : null,
        cpuMs: (after.cpu.user + after.cpu.system - before.cpu.user - before.cpu.system) / 1000,
        memory: after.memory, gcCount: after.gcCount - before.gcCount, gcMs: after.gcMs - before.gcMs,
        freeSystemMemory: os.freemem(), bytes: Buffer.byteLength(text), rows: json.testCases?.length ?? json.bugFixItems?.length ?? (Array.isArray(json) ? json.length : 1) };
    };
    const queries = [
      ['cases.default', '/api/testcases'], ['cases.search', '/api/testcases?search=checkout'], ['cases.status', '/api/testcases?status=FAILED'],
      ['cases.module', '/api/testcases?moduleId=module-0'], ['cases.sort', '/api/testcases?sortBy=updatedAt&sortOrder=desc'],
      ['cases.combined', '/api/testcases?status=FAILED&moduleId=module-0&sortBy=createdAt&sortOrder=desc'],
      ['bugs.default', '/api/bugfix'], ['bugs.active', '/api/bugfix?status=SEDANG%20DI%20FIX'], ['bugs.search', '/api/bugfix?search=checkout'],
      ['bugs.sort', '/api/bugfix?sortBy=updatedAt&sortOrder=asc'], ['bugs.page', '/api/bugfix?page=2&limit=10'], ['stats', '/api/stats'],
    ];
    const results = [];
    for (const [name, endpoint] of queries) {
      const scoped = endpoint + (endpoint.includes('?') ? '&' : '?') + 'projectId=bench-p&limit=50';
      await send(scoped); const samples = [];
      for (let i = 0; i < 3; i++) samples.push(await send(scoped));
      if (name === 'stats' && Math.max(...samples.map(s => s.httpMs)) > 1.8 * Math.min(...samples.map(s => s.httpMs))) {
        for (let i = 0; i < 2; i++) samples.push(await send(scoped));
      }
      results.push({ name, samples });
      summary.pending = { cases: n, bugs, results };
      await fs.writeFile(path.join(root, 'progress.json'), encode(summary));
    }
    const mutations = [];
    for (let i = 0; i < 4; i++) {
      const target = i % 2 === 0 ? 'READY TO RETEST' : 'SEDANG DI FIX';
      const sample = await send('/api/bugfix', 'PUT', { id: 'bug-0', status: target });
      const persisted = await client.bugFix.findUniqueOrThrow({ where: { id: 'bug-0' } });
      const source = await client.testCase.findUniqueOrThrow({ where: { id: cases[0].id } });
      if (persisted.status !== target || source.status !== (target === 'READY TO RETEST' ? 'READY TO RETEST' : 'FAILED')) throw new Error('Lifecycle read-back mismatch');
      if (i) mutations.push(sample);
    }
    results.push({ name: 'bug.mutation', samples: mutations });
    const executions = [];
    for (let i = 0; i < 4; i++) { const sample = await send('/api/test-runs/run-0/executions', 'PUT', { projectId: 'bench-p', executionId: 'exec-0-1', status: i % 2 ? 'PASSED' : 'FAILED' }); if (i) executions.push(sample); }
    results.push({ name: 'run.execution', samples: executions });
    const cycles = [];
    for (let cycle = 0; cycle < 3; cycle++) {
      const start = performance.now(), before = await metrics();
      for (let i = 0; i < 4; i++) await send(queries[(cycle * 4 + i) % queries.length][1] + (queries[(cycle * 4 + i) % queries.length][1].includes('?') ? '&' : '?') + `projectId=bench-p&page=${i + 1}`);
      cycles.push({ elapsedMs: performance.now() - start, before, after: await metrics() });
    }
    const idleBefore = await metrics(); await new Promise(resolve => setTimeout(resolve, 5000)); const idleAfter = await metrics();
    const pragma = { version: await client.$queryRawUnsafe('SELECT sqlite_version() AS version'), journal: await client.$queryRawUnsafe('PRAGMA journal_mode'),
      timeoutFixtureConnection: await client.$queryRawUnsafe('PRAGMA busy_timeout'), integrity: await client.$queryRawUnsafe('PRAGMA integrity_check'), foreignKeys: await client.$queryRawUnsafe('PRAGMA foreign_key_check') };
    const plans = {};
    for (const [name, sql, params] of [
      ['case.order', 'SELECT id FROM TestCase WHERE projectId=? ORDER BY testCaseId ASC,id ASC LIMIT 50', ['bench-p']],
      ['bug.order', 'SELECT id FROM BugFix WHERE projectId=? ORDER BY createdAt DESC,id DESC LIMIT 50', ['bench-p']],
      ['case.weight', 'SELECT projectId,page,subMenu,COUNT(*) FROM TestCase WHERE projectId=? AND status<>? GROUP BY projectId,page,subMenu', ['bench-p', 'TBA']],
      ['run.graph.before', `SELECT id FROM TestRunCase WHERE testRunId IN (${Array(10).fill('?').join(',')})`, Array.from({ length: 10 }, (_, i) => `run-${i}`)],
      ['run.graph.after', 'SELECT id FROM TestRunCase WHERE testRunId=?', ['run-0']],
      ['execution.latest', 'SELECT status FROM TestExecution WHERE testRunCaseId=? ORDER BY createdAt DESC LIMIT 1', ['run-case-0']],
    ]) plans[name] = await client.$queryRawUnsafe(`EXPLAIN QUERY PLAN ${sql}`, ...params);
    const files = {};
    for (const suffix of ['', '-wal', '-shm']) try { files[suffix || 'db'] = (await fs.stat(file + suffix)).size; } catch {}
    let appPragmas = null;
    if (label.includes('detail')) {
      const response = await fetch(`${origin}/api/stats?projectId=bench-p`, { headers: { Cookie: `qa_session=${token}`, 'x-phase6c-pragmas': '1' }, signal: AbortSignal.timeout(15000) });
      await response.text(); appPragmas = JSON.parse(response.headers.get('x-phase6c-pragmas') || 'null');
    }
    const concurrency = n === 1000 && process.argv.includes('--concurrency')
      ? await runHttpConcurrency({ origin, token, client, server, root }) : null;
    let restart = null;
    if (concurrency?.status === 'PASS') {
      const snapshot = async () => JSON.stringify({ bug: await client.bugFix.findUnique({ where: { id: 'bug-0' } }),
        source: await client.testCase.findUnique({ where: { id: cases[0].id } }), history: await client.activityHistory.findMany({ orderBy: { id: 'asc' } }) });
      const committed = await snapshot();
      const old = server;
      const exited = new Promise(resolve => old.once('exit', (code, signal) => resolve({ code, signal })));
      old.send({ op: 'shutdown' });
      const exit = await Promise.race([exited, new Promise(resolve => setTimeout(() => resolve(null), 5000))]);
      if (!exit) { old.kill(); await exited; }
      server = spawnServer(); server.stderr.on('data', () => {}); server.stdout.on('data', () => {});
      const deadline = Date.now() + 60000;
      while (true) {
        try { if ((await fetch(`${origin}/api/auth/status`, { signal: AbortSignal.timeout(1000) })).ok) break; } catch {}
        if (Date.now() > deadline || server.exitCode !== null) throw new Error('Restart readiness failed');
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      const read = await send('/api/testcases?projectId=bench-p&limit=10');
      const preserved = committed === await snapshot();
      const mutation = await send('/api/bugfix', 'PUT', { id: 'bug-0', status: 'SEDANG DI FIX' });
      restart = { gracefulExit: exit, forcedFallback: !exit, preserved, readStatus: read.status, resumedMutationStatus: mutation.status };
      if (!preserved) throw new Error('Restart lost committed records');
    }
    summary.datasets.push({ cases: n, bugs, executions: n * 2, historySeed: n, generationMs, files, pragma, appPragmas, plans, results, cycles, concurrency, restart, idle: { before: idleBefore, after: idleAfter } });
    delete summary.pending;
    await fs.writeFile(path.join(root, 'results.json'), encode(summary));
    if (concurrency && concurrency.status !== 'PASS') throw new Error('HTTP concurrency failed; see persisted evidence');
    console.log(JSON.stringify({ label, cases: n, bugs, results: results.map(r => ({ name: r.name, httpMs: r.samples.map(s => +s.httpMs.toFixed(2)) })), evidence: path.join(root, 'results.json') }));
  } catch (error) {
    summary.failure = { cases: n, message: error instanceof Error ? error.message : 'unknown' };
    await fs.writeFile(path.join(root, 'failed.json'), encode(summary));
    console.error(`Failed evidence: ${path.join(root, 'failed.json')}`);
    throw error;
  } finally {
    if (server && server.exitCode === null) { server.kill(); await new Promise(resolve => { if (server.exitCode !== null) resolve(); else server.once('exit', resolve); }); }
    await client.$disconnect();
    if (!path.resolve(dir).startsWith(path.resolve(root) + path.sep)) throw new Error('Unsafe cleanup');
    await fs.rm(dir, { recursive: true, force: true });
  }
}
console.log(`Complete: ${path.join(root, 'results.json')}`);
