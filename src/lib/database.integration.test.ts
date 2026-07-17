import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { calculateProjectMetrics } from '@/lib/services/report-generator';

const enabled = process.env.QA_ALLOW_INTEGRATION_DB === '1';
const suite = enabled ? describe : describe.skip;
const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const workspaceId = `integration-workspace-${suffix}`;
const projectId = `integration-project-${suffix}`;
const outsiderId = `integration-outsider-${suffix}`;

suite('database integration matrix', () => {
  beforeAll(async () => {
    await db.workspace.create({ data: { id: workspaceId, name: 'Integration Workspace', slug: workspaceId } });
    await db.user.create({ data: { id: `owner-${suffix}`, email: `owner-${suffix}@example.test`, name: 'Owner', passwordHash: 'not-used' } });
    await db.user.create({ data: { id: outsiderId, email: `outsider-${suffix}@example.test`, name: 'Outsider', passwordHash: 'not-used' } });
    await db.workspaceMembership.create({ data: { workspaceId, userId: `owner-${suffix}`, role: 'OWNER' } });
    await db.project.create({ data: { id: projectId, workspaceId, name: 'Integration Project' } });
  });

  afterAll(async () => {
    await db.workspace.delete({ where: { id: workspaceId } }).catch(() => undefined);
    await db.user.deleteMany({ where: { id: { in: [`owner-${suffix}`, outsiderId] } } });
    await db.$disconnect();
  });

  it('isolates projects by workspace membership', async () => {
    const visibleToOwner = await db.project.count({ where: { id: projectId, workspace: { memberships: { some: { userId: `owner-${suffix}` } } } } });
    const visibleToOutsider = await db.project.count({ where: { id: projectId, workspace: { memberships: { some: { userId: outsiderId } } } } });
    expect(visibleToOwner).toBe(1);
    expect(visibleToOutsider).toBe(0);
  });

  it('enforces immutable business-ID uniqueness under concurrent creates', async () => {
    const data = {
      projectId,
      testCaseId: 'CONCURRENT-001',
      page: 'Checkout',
      testType: 'Positive',
      testAction: 'Pay',
      steps: 'Submit payment',
      expectedResult: 'Paid',
    };
    const results = await Promise.allSettled([
      db.testCase.create({ data }),
      db.testCase.create({ data }),
    ]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(await db.testCase.count({ where: { projectId, testCaseId: 'CONCURRENT-001' } })).toBe(1);
  });

  it('keeps latest execution state and report metrics consistent', async () => {
    const testCase = await db.testCase.create({ data: {
      projectId,
      testCaseId: 'REPORT-001',
      page: 'Checkout',
      testType: 'Positive',
      testAction: 'Pay',
      steps: 'Submit payment',
      expectedResult: 'Paid',
    } });
    const run = await db.testRun.create({ data: { projectId, name: 'Release integration' } });
    const runCase = await db.testRunCase.create({ data: { testRunId: run.id, testCaseId: testCase.id } });
    await db.testExecution.create({ data: { testRunId: run.id, testCaseId: testCase.id, testRunCaseId: runCase.id, status: 'FAILED' } });
    await db.$transaction([
      db.testExecution.create({ data: { testRunId: run.id, testCaseId: testCase.id, testRunCaseId: runCase.id, status: 'PASSED' } }),
      db.testRunCase.update({ where: { id: runCase.id }, data: { latestStatus: 'PASSED', latestExecutionAt: new Date() } }),
    ]);

    const metrics = await calculateProjectMetrics(projectId, run.id);
    expect(metrics.totalPlanned).toBe(1);
    expect(metrics.totalExecuted).toBe(1);
    expect(metrics.totalPassed).toBe(1);
    expect(metrics.totalFailed).toBe(0);
  });
});
