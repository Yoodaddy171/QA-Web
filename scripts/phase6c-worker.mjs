import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { ownedPaths, pragmas, configure, transition } from './phase6c-reliability.mjs';

// Internal fork-only entry point; no default/environment database and no user PID target.
const [root, token, mode] = process.argv.slice(2);
assert.ok(process.send && process.connected, 'IPC fork required');
assert.ok(['lock', 'crash'].includes(mode));
const send = message => process.send({ ...message, token, pid: process.pid, parentPid: process.ppid });
let client;
const watchdog = setTimeout(() => process.exit(2), 20000);
const parentGone = () => process.exit(3);
process.once('disconnect', parentGone);
try {
  const fixture = await ownedPaths(root, token);
  client = new PrismaClient({ datasourceUrl: fixture.url, log: [] });
  const defaults = await pragmas(client);
  const applied = await configure(client);
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  process.on('message', message => {
    if (message?.token === token && message.type === 'release' && mode === 'lock') release();
  });
  const rollback = new Error('synthetic-rollback');
  try {
    await client.$transaction(async tx => {
      if (mode === 'lock') await transition(tx, 'held');
      else {
        // Write against already committed rows; a kill must restore their exact contents.
        await tx.bugFix.update({ where: { id: 'bug' }, data: { status: 'SEDANG DI FIX', fixingAt: new Date() } });
        await tx.testCase.update({ where: { id: 'case' }, data: { status: 'FAILED', progress: 0 } });
        for (const [entityType, entityId] of [['BugFix', 'bug'], ['TestCase', 'case']]) {
          await tx.activityHistory.create({ data: {
            id: `crash-${entityId}`, projectId: 'project', entityType, entityId, action: 'UPDATED',
            field: 'status', beforeValue: 'READY TO RETEST', afterValue: entityId === 'bug' ? 'SEDANG DI FIX' : 'FAILED',
          } });
        }
      }
      send({ type: 'held', writes: 4, pragmas: { defaults, applied } });
      await gate; // Only IPC releases this transaction; no timing-based readiness.
      throw rollback;
    }, { maxWait: 1000, timeout: 18000 });
  } catch (error) { if (error !== rollback) throw error; }
  send({ type: 'rolled-back' });
  await client.$disconnect();
  clearTimeout(watchdog);
  process.removeListener('disconnect', parentGone);
  process.disconnect();
} catch (error) {
  send({ type: 'error', code: error.code || 'WORKER_FAILED' });
  await client?.$disconnect();
  clearTimeout(watchdog);
  process.exitCode = 1;
  process.removeListener('disconnect', parentGone);
  process.disconnect();
}
