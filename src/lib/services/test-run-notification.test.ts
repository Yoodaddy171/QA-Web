import { beforeEach, describe, expect, it, vi } from 'vitest';

const createNotification = vi.fn();
vi.mock('@/lib/services/notification-service', () => ({ createNotification }));
vi.mock('@/lib/db', () => ({ db: {} }));
vi.mock('@/lib/services/activity-history-service', () => ({ recordActivity: vi.fn() }));

describe('test run notification events', () => {
  beforeEach(() => vi.clearAllMocks());

  it('emits an actionable deduplicated failure event', async () => {
    const { createExecutionNotification } = await import('@/lib/services/test-run-service');
    const client = {} as never;
    await createExecutionNotification({ projectId: 'project-1', executionId: 'execution-1', testRunId: 'run-1', testCaseId: 'case-1', displayId: 'API-001', status: 'FAILED' }, client);
    expect(createNotification).toHaveBeenCalledWith(expect.objectContaining({
      type: 'TESTCASE_FAILED',
      severity: 'critical',
      entityType: 'TestCase',
      entityId: 'case-1',
      dedupeKey: 'testcase_failed:execution-1',
      metadata: { tab: 'testRuns', testRunId: 'run-1', executionId: 'execution-1' },
    }), client);
  });

  it('does not notify for a passed execution', async () => {
    const { createExecutionNotification } = await import('@/lib/services/test-run-service');
    await createExecutionNotification({ projectId: 'project-1', executionId: 'execution-2', testRunId: 'run-1', testCaseId: 'case-2', displayId: 'API-002', status: 'PASSED' }, {} as never);
    expect(createNotification).not.toHaveBeenCalled();
  });
});
