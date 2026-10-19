import assert from 'node:assert/strict';
import { ChildProcess } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const FIXING = 'SEDANG DI FIX';
const READY = 'READY TO RETEST';
const REPORTED = 'SUDAH DILAPORKAN';
const DEADLINE = 15000;
const PROJECT = 'bench-p';
const BUG = 'bug-0';
const CASE = 'case-000000';

function gate() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

async function within(promise, ms = DEADLINE) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('phase6c-deadline')), ms);
    })]);
  } finally { clearTimeout(timer); }
}

function inside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative !== '' && !relative.startsWith(`..${path.sep}`)
    && relative !== '..' && !path.isAbsolute(relative);
}

/**
 * Caller owns server lifecycle, fixture creation/cleanup, and result persistence.
 * No server spawn/kill, filesystem writes, env edits, disconnect, or automatic retry.
 * Each HTTP/DB operation has a 15s deadline (not a 15s whole-suite budget).
 * HTTP concurrency uses a shared launch barrier, not a server-side stale-read barrier.
 */
export async function runHttpConcurrency({ origin, token, client, server, root }) {
  const result = {
    phase: '6C-HTTP', status: 'FAIL', requests: [], checks: [],
    limits: { requestMs: DEADLINE, heldRequestMs: 10000, heldTransactionMs: 14000 },
    caveats: [
      'Shared HTTP launch barriers do not guarantee overlapping handler reads or deterministic stale-state conflicts.',
      'Race HTTP 400 is allowed as sequential observation of the winning state; it is not stale-write proof.',
      'Synthetic fixture is intentionally changed by successful HTTP requests; caller owns cleanup.',
      'Client database URL is verified via Prisma private engine config; unsupported client shapes fail closed.',
      'Server spawnargs and IPC ownership are checked; caller must ensure its server uses this same synthetic database.',
    ],
  };
  let stage = 'guards';
  const record = (name, details = {}) => result.checks.push({ name, pass: true, ...details });
  try {
    const base = new URL(origin);
    assert.ok(base.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname));
    assert.match(base.port, /^31\d{2}$/);
    assert.ok(!base.username && !base.password && base.pathname === '/' && !base.search && !base.hash);
    assert.ok(typeof token === 'string' && /^[A-Za-z0-9_-]+$/.test(token), 'Raw session token required');
    assert.ok(server instanceof ChildProcess && server.pid > 0 && server.pid !== process.pid);
    assert.ok(server.connected && server.exitCode === null && server.signalCode === null && !server.killed);
    assert.ok(server.spawnargs.some(arg => path.basename(arg) === 'phase6c-server.mjs'));
    const ownedRoot = await fs.realpath(root);
    assert.ok(inside(await fs.realpath(os.tmpdir()), ownedRoot), 'Temp fixture root required');
    assert.ok(!(await fs.lstat(root)).isSymbolicLink());
    const explicitUrl = client?._engineConfig?.overrideDatasources?.db?.url;
    assert.ok(typeof explicitUrl === 'string' && explicitUrl.startsWith('file:'), 'Explicit SQLite override required');
    const databasePath = explicitUrl.slice(5).split('?')[0];
    assert.ok(path.isAbsolute(databasePath), 'Absolute explicit database required');
    const database = await fs.realpath(databasePath);
    assert.ok(inside(ownedRoot, database));
    assert.ok(!(await fs.lstat(databasePath)).isSymbolicLink());
    record('Owned IPC server, loopback31xx and explicit temporary SQLite guards');

    const query = (model, method, args) => within(client[model][method](args));
    const state = async () => {
      const [bug, testcase, history] = await Promise.all([
        query('bugFix', 'findUniqueOrThrow', { where: { id: BUG } }),
        query('testCase', 'findUniqueOrThrow', { where: { id: CASE } }),
        query('activityHistory', 'findMany', { where: { projectId: PROJECT,
          OR: [{ entityType: 'BugFix', entityId: BUG }, { entityType: 'TestCase', entityId: CASE }] },
        orderBy: { id: 'asc' } }),
      ]);
      assert.equal(bug.projectId, PROJECT);
      assert.equal(testcase.projectId, PROJECT);
      assert.equal(bug.sourceTestCaseId, CASE);
      return { bug, testcase, history };
    };
    const requests = new Set();
    const http = async (label, endpoint, method = 'GET', body, timeout = DEADLINE) => {
      // Revalidate that the caller's server is still alive, without controlling it.
      assert.ok(server.connected && server.exitCode === null && server.signalCode === null && !server.killed);
      const started = performance.now();
      const entry = { label, method, path: endpoint, status: null, durationMs: null };
      result.requests.push(entry);
      const controller = new AbortController();
      requests.add(controller);
      const timer = setTimeout(() => controller.abort(), timeout);
      try {
        const response = await fetch(new URL(endpoint, base), {
          method, redirect: 'error', signal: controller.signal,
          headers: { Cookie: `qa_session=${token}`, Origin: base.origin,
            ...(body ? { 'Content-Type': 'application/json' } : {}) },
          ...(body ? { body: JSON.stringify(body) } : {}),
        });
        entry.status = response.status;
        const data = await response.json();
        if (response.status >= 400) {
          assert.ok(typeof data?.error === 'string' && data.error.length <= 1000);
          assert.ok(!/PrismaClient|SELECT\s|UPDATE\s|node_modules|\bat\s+\S+\s*\(/i.test(data.error), 'Unsafe error response');
        }
        return { status: response.status, data };
      } catch (error) {
        entry.failure = controller.signal.aborted ? 'DEADLINE' : 'REQUEST_OR_RESPONSE_FAILED';
        throw error;
      } finally {
        clearTimeout(timer); requests.delete(controller);
        entry.durationMs = Math.round(performance.now() - started);
      }
    };
    // Always settle every launched request before inspecting state or entering the next scenario.
    const simultaneous = async jobs => {
      const launch = gate();
      const pending = jobs.map(job => launch.promise.then(job));
      launch.resolve();
      const settled = await Promise.allSettled(pending);
      for (const item of settled) if (item.status === 'rejected') throw item.reason;
      return settled.map(item => item.value);
    };
    const casesPath = `/api/testcases?projectId=${PROJECT}&limit=10&page=1`;
    const bugsPath = `/api/bugfix?projectId=${PROJECT}&limit=10&page=1`;
    const list = async (label, bugs = false) => {
      const response = await http(label, bugs ? bugsPath : casesPath);
      assert.equal(response.status, 200);
      assert.ok(Array.isArray(response.data[bugs ? 'bugFixItems' : 'testCases']));
      return response;
    };
    const put = (label, status, timeout) => http(label, '/api/bugfix', 'PUT', { id: BUG, status }, timeout);
    const transitionCheck = (before, after, target) => {
      assert.equal(after.bug.status, target);
      const expectedCase = target === READY ? READY
        : before.bug.status === READY && target === FIXING ? 'FAILED' : before.testcase.status;
      assert.equal(after.testcase.status, expectedCase);
      assert.equal(after.bug.actualResult, 'Not As Expected');
      assert.equal(after.testcase.actualResult, 'Not As Expected');
      const existing = new Map(before.history.map(row => [row.id, row]));
      for (const row of after.history.filter(row => existing.has(row.id))) assert.deepEqual(row, existing.get(row.id));
      assert.equal(after.history.filter(row => existing.has(row.id)).length, before.history.length);
      const added = after.history.filter(row => !existing.has(row.id));
      const expected = [['BugFix', BUG, before.bug.status, target]];
      if (expectedCase !== before.testcase.status) expected.push(['TestCase', CASE, before.testcase.status, expectedCase]);
      assert.equal(added.length, expected.length);
      for (const [type, id, oldStatus, newStatus] of expected) {
        const matches = added.filter(row => row.entityType === type && row.entityId === id && row.field === 'status');
        assert.equal(matches.length, 1);
        assert.equal(matches[0].beforeValue, oldStatus);
        assert.equal(matches[0].afterValue, newStatus);
      }
      if (target === READY) assert.ok(after.bug.readyAt);
      return added.length;
    };
    const setFixing = async label => {
      const before = await state();
      if (before.bug.status === FIXING) return before;
      assert.ok([READY, REPORTED].includes(before.bug.status));
      assert.equal((await put(label, FIXING)).status, 200);
      const after = await state();
      transitionCheck(before, after, FIXING);
      return after;
    };

    stage = 'fixture';
    let before = await state();
    assert.equal(before.bug.status, FIXING);
    assert.equal(before.testcase.status, 'FAILED');
    const moduleRecord = await query('module', 'findUniqueOrThrow', { where: { id: 'module-0' } });
    assert.equal(moduleRecord.projectId, PROJECT);
    // Choose statuses whose retained actualResult does not force FAILED/DONE.
    const nonbugs = await query('testCase', 'findMany', { where: { projectId: PROJECT, bugFixItems: { none: {} }, actualResult: null, status: { not: 'IN PROGRESS' } },
      orderBy: { id: 'desc' }, take: 2 });
    assert.equal(nonbugs.length, 2);
    assert.ok(nonbugs.every(row => row.id !== CASE && row.status !== 'IN PROGRESS'));

    stage = 'four-GET';
    await simultaneous([0, 1, 2, 3].map(index => () => list(`four-GET-${index + 1}`, index % 2 === 1)));
    assert.deepEqual(await state(), before);
    record('Four simultaneously launched authenticated GET requests');

    stage = 'GET-during-READY';
    const [ready] = await simultaneous([
      () => put('READY-with-reads', READY), () => list('READY-case-list'), () => list('READY-bug-list', true),
    ]);
    assert.equal(ready.status, 200);
    let after = await state();
    record('READY mutation alongside list reads', { historyAdded: transitionCheck(before, after, READY) });

    stage = 'competing-transitions';
    before = await setFixing('prepare-race-FIXING');
    const race = await simultaneous([() => put('race-READY', READY), () => put('race-REPORTED', REPORTED)]);
    assert.equal(race.filter(response => response.status === 200).length, 1);
    assert.ok(race.every(response => [200, 400, 409].includes(response.status)));
    const winner = race[0].status === 200 ? READY : REPORTED;
    after = await state();
    record('Two valid transitions launched from FIXING', {
      winner, statuses: race.map(response => response.status), historyAdded: transitionCheck(before, after, winner),
      classification: race.some(response => response.status === 400)
        ? 'Sequential winning-state validation permitted; no deterministic stale-read claim'
        : 'Observed conflict; no deterministic stale-read claim',
    });

    stage = 'bulk-with-reads';
    const bulkIds = nonbugs.map(row => row.id);
    const oldBulkHistory = await query('activityHistory', 'findMany', {
      where: { projectId: PROJECT, entityType: 'TestCase', entityId: { in: bulkIds } }, orderBy: { id: 'asc' },
    });
    const [bulk] = await simultaneous([
      () => http('bulk-two-IN-PROGRESS', '/api/testcases', 'PATCH', { ids: bulkIds, status: 'IN PROGRESS' }),
      () => list('bulk-case-list'), () => list('bulk-bug-list', true),
    ]);
    assert.equal(bulk.status, 200);
    assert.equal(bulk.data.updated, 2);
    const updated = await query('testCase', 'findMany', { where: { id: { in: bulkIds }, projectId: PROJECT } });
    assert.equal(updated.length, 2);
    assert.ok(updated.every(row => row.status === 'IN PROGRESS'));
    assert.equal(await query('bugFix', 'count', { where: { sourceTestCaseId: { in: bulkIds } } }), 0);
    const bulkHistory = await query('activityHistory', 'findMany', {
      where: { projectId: PROJECT, entityType: 'TestCase', entityId: { in: bulkIds } }, orderBy: { id: 'asc' },
    });
    const oldIds = new Set(oldBulkHistory.map(row => row.id));
    assert.deepEqual(bulkHistory.filter(row => oldIds.has(row.id)), oldBulkHistory);
    const addedBulk = bulkHistory.filter(row => !oldIds.has(row.id));
    for (const row of nonbugs) {
      const changes = addedBulk.filter(item => item.entityId === row.id && item.field === 'status');
      assert.equal(changes.length, 1);
      assert.equal(changes[0].beforeValue, row.status);
      assert.equal(changes[0].afterValue, 'IN PROGRESS');
    }
    assert.deepEqual(await state(), after);
    record('Bulk two eligible nonbug cases IN PROGRESS alongside lists', { updated: 2 });

    stage = 'held-write-conflict';
    before = await setFixing('prepare-held-FIXING');
    const acquired = gate();
    const release = gate();
    const rollback = new Error('synthetic-module-rollback');
    let active = false;
    let heldFinished = false;
    const holdStarted = performance.now();
    const holding = client.$transaction(async tx => {
      await tx.module.update({ where: { id: moduleRecord.id }, data: { name: `${moduleRecord.name} [phase6c-held]` } });
      active = true;
      acquired.resolve(); // Real awaited write acquired the SQLite writer lock, no sleep.
      try { await within(release.promise, 12000); }
      finally { active = false; }
      throw rollback;
    }, { maxWait: 1000, timeout: 14000 }).then(() => {
      throw new Error('Held transaction unexpectedly committed');
    }, error => {
      acquired.reject(error);
      if (error !== rollback) throw error;
    }).finally(() => { heldFinished = true; });
    // Attach a rejection observer immediately, including before acquisition.
    void holding.catch(() => {});
    let conflict;
    let holdError;
    try {
      await within(acquired.promise, 14000);
      assert.ok(active && !heldFinished);
      conflict = await put('held-Bug-READY', READY, 10000);
      assert.ok(active && !heldFinished, 'Writer lock must remain held until response');
      assert.equal(conflict.status, 409, 'Expected bounded safe conflict, not timeout/500/success');
    } catch (error) { holdError = error; }
    finally {
      release.resolve();
      try { await within(holding); } catch (error) { holdError ||= error; }
    }
    if (holdError) throw holdError;
    assert.deepEqual(await query('module', 'findUniqueOrThrow', { where: { id: moduleRecord.id } }), moduleRecord);
    assert.deepEqual(await state(), before, 'Failed HTTP write must leave pair and history exactly unchanged');
    record('Acquired-write barrier produces bounded HTTP409 with unchanged pair/history and rolled-back module', {
      status: conflict.status, holdElapsedMs: Math.round(performance.now() - holdStarted),
    });

    stage = 'fresh-after-release';
    assert.equal((await put('fresh-after-release-READY', READY)).status, 200);
    after = await state();
    record('Deliberate new request after release commits consistent pair/history', {
      historyAdded: transitionCheck(before, after, READY),
    });
    result.status = 'PASS';
  } catch (error) {
    // No messages, bodies, cookies, tokens, full Prisma errors, or database URLs in output.
    result.failure = { stage, type: error?.name || 'Error',
      code: /^P\d{4}$/.test(String(error?.code)) ? error.code : 'CHECK_FAILED' };
  }
  return result;
}
