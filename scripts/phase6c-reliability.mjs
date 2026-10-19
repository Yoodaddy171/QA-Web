import assert from 'node:assert/strict';
import { fork, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaClient, Prisma } from '@prisma/client';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.dirname(here);
const exec = promisify(execFile);
const BUSY_MS = 150;
const STEP_MS = 8000;
const HELD_MS = 20000;

function bounded(promise, label, ms = STEP_MS) {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(label)), ms);
  })]).finally(() => clearTimeout(timer));
}

// Never accept a caller-supplied database URL or output directory.
export async function ownedPaths(root, token) {
  const realRoot = await fs.realpath(root);
  const temp = await fs.realpath(os.tmpdir());
  assert.equal(path.dirname(realRoot), temp, 'Fixture must be a direct temp child');
  assert.match(path.basename(realRoot), /^qadesk-phase6c-/);
  const marker = JSON.parse(await fs.readFile(path.join(realRoot, 'owner.json'), 'utf8'));
  assert.equal(marker.token, token);
  const database = path.join(realRoot, 'synthetic.db');
  for (const suffix of ['', '-wal', '-shm', '-journal']) {
    const entry = await fs.lstat(database + suffix).catch(error => {
      if (error.code !== 'ENOENT') throw error;
      return null;
    });
    assert.ok(!entry?.isSymbolicLink(), 'Refuse fixture symlinks');
  }
  return { root: realRoot, database, url: `file:${database.replaceAll('\\', '/')}?connection_limit=1` };
}

export async function pragmas(client) {
  const value = async name => Object.values((await client.$queryRawUnsafe(`PRAGMA ${name}`))[0])[0];
  return {
    journalMode: String(await value('journal_mode')),
    busyTimeoutMs: Number(await value('busy_timeout')),
    foreignKeys: Number(await value('foreign_keys')),
    synchronous: Number(await value('synchronous')),
  };
}

export async function configure(client) {
  await client.$queryRawUnsafe('PRAGMA journal_mode=WAL');
  await client.$queryRawUnsafe(`PRAGMA busy_timeout=${BUSY_MS}`);
  await client.$queryRawUnsafe('PRAGMA foreign_keys=ON');
  const applied = await pragmas(client);
  assert.equal(applied.journalMode, 'wal');
  assert.equal(applied.busyTimeoutMs, BUSY_MS);
  assert.equal(applied.foreignKeys, 1);
  return applied;
}

// Synthetic equivalent of the service's READY transition; not a service/API test.
export async function transition(tx, tag) {
  const before = await tx.testCase.findUniqueOrThrow({ where: { id: 'case' } });
  assert.equal(before.status, 'FAILED');
  await tx.bugFix.update({ where: { id: 'bug' }, data: { status: 'READY TO RETEST', readyAt: new Date() } });
  await tx.testCase.update({ where: { id: 'case' }, data: { status: 'READY TO RETEST', progress: 0 } });
  for (const [entityType, entityId, beforeValue] of [['BugFix', 'bug', 'SEDANG DI FIX'], ['TestCase', 'case', 'FAILED']]) {
    await tx.activityHistory.create({ data: {
      id: `${tag}-${entityId}`, projectId: 'project', entityType, entityId,
      action: 'UPDATED', field: 'status', beforeValue, afterValue: 'READY TO RETEST', actor: 'synthetic',
    } });
  }
}

async function snapshot(client) {
  return {
    testcase: await client.testCase.findUniqueOrThrow({ where: { id: 'case' } }),
    bug: await client.bugFix.findUniqueOrThrow({ where: { id: 'bug' } }),
    history: await client.activityHistory.findMany({ orderBy: { id: 'asc' } }),
    projects: await client.project.findMany({ orderBy: { id: 'asc' } }),
  };
}

function worker(root, token, mode) {
  const child = fork(path.join(here, 'phase6c-worker.mjs'), [root, token, mode], {
    cwd: repo, execArgv: [], stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    env: Object.fromEntries(Object.entries(process.env).filter(([key]) =>
      /^(PATH|SystemRoot|WINDIR|TEMP|TMP|HOME|USERPROFILE|LOCALAPPDATA)$/i.test(key))),
  });
  let exited = false;
  const messages = [];
  const waiters = new Set();
  const exit = new Promise(resolve => child.once('exit', (code, signal) => {
    exited = true;
    resolve({ code, signal });
    for (const waiter of waiters) waiter.reject(new Error('worker-exited-before-handshake'));
    waiters.clear();
  }));
  child.on('error', () => {
    for (const waiter of waiters) waiter.reject(new Error('worker-process-error'));
    waiters.clear();
  });
  child.on('message', message => {
    if (message?.token !== token || message.pid !== child.pid) return;
    const waiter = [...waiters].find(item => item.type === message.type || message.type === 'error');
    if (waiter) {
      waiters.delete(waiter);
      if (message.type === 'error') waiter.reject(new Error('worker-reported-error'));
      else waiter.resolve(message);
    } else messages.push(message);
  });
  return {
    child, exit,
    async wait(type) {
      const index = messages.findIndex(message => message.type === type || message.type === 'error');
      if (index !== -1) {
        const message = messages.splice(index, 1)[0];
        assert.notEqual(message.type, 'error', 'Worker reported error');
        return message;
      }
      assert.ok(!exited, 'Worker already exited');
      let waiter;
      try {
        return await bounded(new Promise((resolve, reject) => {
          waiter = { type, resolve, reject }; waiters.add(waiter);
        }), `worker-${type}-deadline`);
      } finally { waiters.delete(waiter); }
    },
    release() { child.send({ type: 'release', token }); },
    kill() {
      // The only target is this exact live ChildProcess returned by fork, never a PID lookup.
      assert.ok(child.pid > 0 && child.pid !== process.pid && child.spawnfile === process.execPath);
      if (exited) return false;
      return child.kill('SIGKILL');
    },
  };
}

export async function runReliability() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'qadesk-phase6c-'));
  const token = randomUUID();
  await fs.writeFile(path.join(root, 'owner.json'), JSON.stringify({ token }), { flag: 'wx' });
  const result = {
    phase: '6C', status: 'FAIL', node: process.version, prisma: Prisma.prismaVersion.client,
    schemaSha256: createHash('sha256').update(await fs.readFile(path.join(repo, 'prisma/sqlite.prisma'))).digest('hex'),
    evidencePath: path.join(root, 'result.json'), checks: [],
    limits: { busyTimeoutMs: BUSY_MS, stepMs: STEP_MS, workerTransactionMs: HELD_MS, schemaPushMs: 25000, cliMs: 60000 },
    caveats: [
      'Synthetic SQLite storage/Prisma checks, not HTTP, UI, production services or PostgreSQL verification.',
      'Two main explicit single-connection clients plus one owned worker client while held; no pool-wide PRAGMA claim.',
      'SIGKILL/Windows TerminateProcess verifies process-crash recovery, not power-loss or filesystem durability.',
      'Applied busy timeout is deliberately shorter than application 5000ms; default and applied values are measured.',
    ],
  };
  const clients = [];
  const workers = [];
  const check = (name, details = {}) => result.checks.push({ name, pass: true, ...details });
  try {
    const fixture = await ownedPaths(root, token);
    await fs.writeFile(fixture.database, '', { flag: 'wx' });
    await exec(process.execPath, [path.join(repo, 'node_modules/prisma/build/index.js'), 'db', 'push',
      '--schema', path.join(repo, 'prisma/sqlite.prisma'), '--skip-generate'], {
      cwd: repo, timeout: 25000, maxBuffer: 1024 * 1024,
      env: { ...process.env, DATABASE_URL: fixture.url, PRISMA_HIDE_UPDATE_MESSAGE: '1' },
    });
    const makeClient = () => {
      const client = new PrismaClient({ datasourceUrl: fixture.url, log: [] });
      clients.push(client); return client;
    };
    const a = makeClient();
    const b = makeClient();
    result.pragmas = { defaults: { a: await pragmas(a), b: await pragmas(b) } };
    result.pragmas.applied = { a: await configure(a), b: await configure(b) };
    check('WAL and connection-local busy_timeout read-back');
    await a.workspace.create({ data: { id: 'workspace', name: 'Synthetic', slug: 'phase6c' } });
    await a.project.create({ data: { id: 'project', workspaceId: 'workspace', name: 'Synthetic' } });
    const tc = await a.testCase.create({ data: {
      id: 'case', projectId: 'project', testCaseId: 'SYNTHETIC-001', page: 'Synthetic', testType: 'Positive',
      testAction: 'Synthetic', steps: 'Synthetic', expectedResult: 'Atomic', actualResult: 'Not As Expected', status: 'FAILED',
    } });
    await a.bugFix.create({ data: {
      id: 'bug', sourceTestCaseId: tc.id, projectId: 'project', testCaseId: tc.testCaseId,
      page: tc.page, testType: tc.testType, testAction: tc.testAction, steps: tc.steps,
      expectedResult: tc.expectedResult, actualResult: 'Not As Expected', priority: 'Medium',
      status: 'SEDANG DI FIX', reportedAt: new Date('2020-01-01'), fixingAt: new Date('2020-01-02'),
    } });
    const baseline = await snapshot(a);
    await bounded(Promise.all(Array.from({ length: 12 }, async (_, index) => {
      assert.deepEqual(await snapshot(index % 2 ? a : b), baseline);
    })), 'concurrent-read-deadline');
    check('12 concurrent snapshot reads across two explicit clients');

    const lock = worker(root, token, 'lock'); workers.push(lock);
    const lockReady = await lock.wait('held');
    assert.equal(lockReady.writes, 4);
    result.pragmas.worker = lockReady.pragmas;
    const readStart = performance.now();
    await bounded(Promise.all([a, b].map(async client => assert.deepEqual(await snapshot(client), baseline))), 'held-read-deadline');
    check('WAL readers see only committed baseline while writer held', { elapsedMs: Math.round(performance.now() - readStart) });
    const writeStart = performance.now();
    let lockCode;
    try {
      await bounded(b.$transaction(tx => transition(tx, 'contender'), { maxWait: 1000, timeout: 3000 }), 'competing-write-deadline');
      assert.fail('Contending write unexpectedly committed');
    } catch (error) {
      lockCode = error.code;
      assert.ok(['P1008', 'P2034', 'P2028'].includes(lockCode), 'Expected Prisma bounded lock/transaction failure');
    }
    const elapsedMs = Math.round(performance.now() - writeStart);
    assert.ok(elapsedMs < STEP_MS);
    check('Competing write fails within deadline while IPC-held lock remains', { code: lockCode, elapsedMs });
    assert.deepEqual(await snapshot(a), baseline);
    lock.release();
    await lock.wait('rolled-back');
    assert.equal((await bounded(lock.exit, 'lock-worker-exit')).code, 0);
    assert.deepEqual(await snapshot(b), baseline);
    check('Held transaction deliberate rollback leaves no Bug/Testcase/history effects');

    // A new transaction deliberately re-reads state after lock release, not a blind replay.
    assert.deepEqual(await snapshot(b), baseline);
    await bounded(b.$transaction(tx => transition(tx, 'retry'), { maxWait: 1000, timeout: 3000 }), 'fresh-retry-deadline');
    const committed = await snapshot(a);
    assert.equal(committed.bug.status, 'READY TO RETEST');
    assert.equal(committed.testcase.status, 'READY TO RETEST');
    assert.equal(committed.history.length, 2);
    check('Deliberate fresh retry commits one consistent pair and exactly two history rows');

    const crash = worker(root, token, 'crash'); workers.push(crash);
    const crashReady = await crash.wait('held');
    assert.equal(crashReady.writes, 4);
    assert.equal(crashReady.parentPid, process.pid);
    assert.deepEqual(await snapshot(a), committed);
    const exitPromise = crash.exit;
    assert.equal(crash.kill(), true);
    const killed = await bounded(exitPromise, 'crash-worker-exit');
    assert.ok(killed.signal === 'SIGKILL' || (process.platform === 'win32' && killed.code !== 0));
    check('Genuine owned fork killed after uncommitted Bug/Testcase/two-history writes', {
      handshake: 'IPC after all awaited writes', abrupt: true, exit: killed,
    });
    await bounded(Promise.all(clients.map(client => client.$disconnect())), 'pre-reopen-disconnect');
    const recovered = makeClient();
    assert.deepEqual(await snapshot(recovered), committed);
    check('Reopen preserves exact committed data and rolls back every crash write');
    const integrity = await recovered.$queryRawUnsafe('PRAGMA integrity_check');
    const foreignKeys = await recovered.$queryRawUnsafe('PRAGMA foreign_key_check');
    assert.deepEqual(integrity.map(row => Object.values(row)[0]), ['ok']);
    assert.deepEqual(foreignKeys, []);
    const final = await snapshot(recovered);
    assert.equal(final.bug.sourceTestCaseId, final.testcase.id);
    assert.equal(final.bug.projectId, final.testcase.projectId);
    assert.deepEqual(final.history.map(row => row.id), ['retry-bug', 'retry-case']);
    for (const row of final.history) {
      assert.equal(row.projectId, final.testcase.projectId);
      assert.equal(row.afterValue, 'READY TO RETEST');
      assert.equal(row.entityId, row.entityType === 'BugFix' ? final.bug.id : final.testcase.id);
    }
    result.integrity = { integrityCheck: 'ok', foreignKeyViolations: 0, historyRows: final.history.length };
    result.pragmas.reopened = await pragmas(recovered);
    check('integrity_check, foreign_key_check and pair/history consistency');
    result.status = 'PASS';
  } catch (error) {
    // Never serialize Prisma messages, SQL, environment, record data, or ownership token.
    result.failure = { type: error.name, code: error.code || 'CHECK_FAILED',
      checkIndex: result.checks.length + 1 };
  } finally {
    try {
      for (const item of workers) { item.kill(); await bounded(item.exit, 'cleanup-worker-exit'); }
      await bounded(Promise.all(clients.map(client => client.$disconnect())), 'cleanup-disconnect');
      const owned = await ownedPaths(root, token);
      // Delete only exact owned fixture files. Preserve the evidence directory.
      for (const suffix of ['', '-wal', '-shm', '-journal']) await fs.rm(owned.database + suffix, { force: true });
      await fs.rm(path.join(owned.root, 'owner.json'));
      result.cleanup = { databaseRemoved: true, workersReaped: true, evidenceRetained: true };
    } catch {
      result.status = 'FAIL';
      result.cleanup = { databaseRemoved: false, caveat: 'Cleanup incomplete; inspect owned evidence directory.' };
    }
    await fs.writeFile(result.evidencePath, `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' });
  }
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const watchdog = setTimeout(() => {
    process.stderr.write('{"phase":"6C","status":"FAIL","code":"CLI_DEADLINE"}\n');
    process.exit(1);
  }, 60000);
  try {
    const result = await runReliability();
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exitCode = result.status === 'PASS' ? 0 : 1;
  } catch {
    process.stderr.write('{"phase":"6C","status":"FAIL","code":"HARNESS_SETUP_OR_EVIDENCE_FAILURE"}\n');
    process.exitCode = 1;
  } finally { clearTimeout(watchdog); }
}
