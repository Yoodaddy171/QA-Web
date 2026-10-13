import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { scryptSync } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(process.env.QA_BENCH_ROOT || process.cwd());
const target = path.resolve(os.tmpdir(), 'qadesk-performance-fixture.db');
const url = `file:${target.replaceAll('\\', '/')}`;
if (process.env.DATABASE_URL && process.env.DATABASE_URL !== url) throw new Error('Refusing non-benchmark database.');
// This script never reads .env or copies a user database. Only its fixed Temp fixture is disposable.
for (const suffix of ['', '-wal', '-shm', '-journal']) fs.rmSync(target + suffix, { force: true });
const push = spawnSync(process.execPath, [path.join(root, 'node_modules/prisma/build/index.js'), 'db', 'push', '--skip-generate', '--schema', path.join(root, 'prisma/sqlite.prisma')], {
  cwd: root, stdio: 'inherit', env: { ...process.env, DATABASE_URL: url },
});
if (push.status !== 0) {
  // On Windows schema-engine db push can fail while diff still works. Apply the
  // generated empty-schema SQL only to the fixed disposable fixture above.
  const diff = spawnSync(process.execPath, [path.join(root, 'node_modules/prisma/build/index.js'), 'migrate', 'diff', '--from-empty', '--to-schema-datamodel', path.join(root, 'prisma/sqlite.prisma'), '--script'], { cwd: root, encoding: 'utf8', env: { ...process.env, DATABASE_URL: url } });
  if (diff.status !== 0) throw new Error(diff.stderr || 'Fixture schema generation failed');
  const { DatabaseSync } = await import('node:sqlite');
  const fixture = new DatabaseSync(target);
  try { fixture.exec(diff.stdout); } finally { fixture.close(); }
}
const require = createRequire(path.join(root, 'package.json'));
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient({ datasources: { db: { url } } });
try {
  const salt = 'qadesk-isolated-performance-fixture';
  const passwordHash = `scrypt$${salt}$${scryptSync('E2E-only-password-2026!', salt, 64).toString('hex')}`;
  await db.workspace.create({ data: { id: 'perf-workspace', name: 'Performance fixture', slug: 'performance-fixture' } });
  await db.user.create({ data: { id: 'perf-owner', name: 'Synthetic QA Owner', email: 'owner@qa-desk.test', passwordHash, memberships: { create: { workspaceId: 'perf-workspace', role: 'OWNER' } } } });
  await db.project.create({ data: { id: 'perf-project', workspaceId: 'perf-workspace', name: 'Production benchmark fixture' } });
  const modules = ['Checkout', 'Authentication', 'Orders'];
  for (let n = 0; n < modules.length; n++) await db.module.create({ data: { id: `perf-module-${n}`, name: modules[n], projectId: 'perf-project' } });
  const statuses = ['DONE', 'FAILED', 'BLOCKED', 'READY TO RETEST', 'IN PROGRESS', 'NOT DONE'];
  const cases = Array.from({ length: 150 }, (_, n) => ({ id: `perf-case-${n + 1}`, testCaseId: `PERF-${String(n + 1).padStart(3, '0')}`, projectId: 'perf-project', moduleId: `perf-module-${n % 3}`, page: modules[n % 3], subMenu: 'Validation', testType: n % 2 ? 'Negative' : 'Positive', testAction: `Validate ${modules[n % 3]} recovery and confirmation with realistic boundary input ${n + 1}`, steps: 'Open the relevant menu\nEnter valid or boundary input\nSubmit and verify the resulting state', expectedResult: 'Data is persisted and confirmation matches the submitted values.', status: statuses[n % 6], priority: ['Critical', 'High', 'Medium', 'Low'][n % 4], progress: n % 6 === 0 ? 100 : 0 }));
  await db.testCase.createMany({ data: cases });
  await db.testRun.create({ data: { id: 'perf-run', projectId: 'perf-project', name: 'Performance regression cycle', status: 'IN_PROGRESS', assignedTo: 'Synthetic QA', testCases: { create: cases.slice(0, 30).map(c => ({ testCaseId: c.id })) } } });
  await db.testExecution.createMany({ data: cases.slice(0, 30).flatMap((c, n) => [0, 1].map(i => ({ id: `perf-execution-${n}-${i}`, testRunId: 'perf-run', testCaseId: c.id, tester: 'Synthetic QA', status: i ? 'PASSED' : 'FAILED', notes: 'Synthetic historical execution', createdAt: new Date(1700000000000 + n * 10000 + i * 1000) }))) });
  await db.bugFix.createMany({ data: cases.slice(0, 120).map((c, n) => ({ sourceTestCaseId: c.id, testCaseId: c.testCaseId, projectId: c.projectId, moduleId: c.moduleId, page: c.page, subMenu: c.subMenu, testType: c.testType, testAction: c.testAction, steps: c.steps, expectedResult: c.expectedResult, actualResult: 'Synthetic error state', priority: c.priority, status: ['SUDAH DILAPORKAN', 'SEDANG DI FIX', 'READY TO RETEST', 'VERIFIED & FIXED'][n % 4], reportedAt: new Date(1700000000000) })) });
  await db.automationRun.createMany({ data: cases.slice(0, 100).map((c, n) => ({ id: `perf-auto-${n}`, runKey: `perf-auto-${n}`, projectId: c.projectId, testCaseId: c.id, source: 'testcase', mode: 'manual', status: 'passed', startedAt: new Date(1700000000000 + n * 10000), endedAt: new Date(1700000005000 + n * 10000) })) });
  await db.automationEvent.createMany({ data: Array.from({ length: 300 }, (_, n) => ({ eventId: `perf-event-${n}`, runId: 'perf-auto-0', testCaseId: 'perf-case-1', eventType: n % 3 ? 'console.log' : 'network.response', timestamp: new Date(1700000000000 + n * 30), relativeMs: n * 30, payload: { message: `Synthetic event ${n}`, category: n % 3 ? 'console' : 'network' } })) });
  await db.activityHistory.createMany({ data: Array.from({ length: 100 }, (_, n) => ({ projectId: 'perf-project', entityType: 'TestCase', entityId: 'perf-case-1', action: 'UPDATED', field: 'steps', beforeValue: 'Previous synthetic steps', afterValue: 'Updated synthetic steps', actor: 'Synthetic QA', createdAt: new Date(1700000000000 + n * 1000) })) });
  await db.requirement.create({ data: { id: 'perf-requirement', projectId: 'perf-project', key: 'REQ-PERF-001', title: 'Order confirmation', testCases: { create: { testCaseId: 'perf-case-1' } } } });
  console.log('Isolated performance fixture ready: 150 cases, 120 bugs, 100 automation runs, 60 executions.');
} finally { await db.$disconnect(); }
