import { describe, expect, it, vi } from 'vitest';
import { BUGFIX_STATUS } from '@/lib/domain/bugfix';
import { TESTCASE_ACTUAL_RESULT, TESTCASE_STATUS } from '@/lib/domain/testcase';
import { syncBugFixForTestCaseStatus, type BugFixSourceSnapshot } from '@/lib/services/bugfix-sync-service';

const source: BugFixSourceSnapshot = {
  projectId: 'proj-1',
  testCaseId: 'A-001',
  page: 'Login',
  subMenu: null,
  testType: 'Positive',
  testAction: 'Login valid',
  steps: '1. buka halaman',
  expectedResult: 'berhasil login',
  priority: 'High',
  moduleId: null,
};

/**
 * Mock Prisma-ish client. `activeBug` / `resolvedBug` decide what findFirst
 * returns based on the status filter the service uses.
 */
function makeClient(opts: { activeBug?: { id: string }; resolvedBug?: { id: string } }) {
  const findFirst = vi.fn(({ where }: { where: { status?: unknown } }) => {
    const status = where.status as { not?: string } | string | undefined;
    // Active query uses `status: { not: VERIFIED_FIXED }`.
    if (status && typeof status === 'object' && 'not' in status) return Promise.resolve(opts.activeBug ?? null);
    // Resolved query uses `status: VERIFIED_FIXED`.
    if (status === BUGFIX_STATUS.VERIFIED_FIXED) return Promise.resolve(opts.resolvedBug ?? null);
    return Promise.resolve(null);
  });
  return {
    findFirst,
    create: vi.fn((_arg: any) => Promise.resolve({ id: 'new' })),
    update: vi.fn((_arg: any) => Promise.resolve({ id: 'updated' })),
    updateMany: vi.fn((_arg: any) => Promise.resolve({ count: 1 })),
  };
}

const run = (client: ReturnType<typeof makeClient>, finalStatus: string) =>
  syncBugFixForTestCaseStatus({
    client: { bugFix: client } as any,
    sourceTestCaseId: 'tc-1',
    source,
    finalStatus,
    finalActualResult: finalStatus === TESTCASE_STATUS.FAILED ? TESTCASE_ACTUAL_RESULT.NOT_AS_EXPECTED : null,
  });

describe('syncBugFixForTestCaseStatus — FAILED', () => {
  it('creates a new bug on first-time failure', async () => {
    const client = makeClient({});
    await run(client, TESTCASE_STATUS.FAILED);
    expect(client.create).toHaveBeenCalledTimes(1);
    expect(client.update).not.toHaveBeenCalled();
  });

  it('does nothing when an active bug already exists', async () => {
    const client = makeClient({ activeBug: { id: 'bug-active' } });
    await run(client, TESTCASE_STATUS.FAILED);
    expect(client.create).not.toHaveBeenCalled();
    expect(client.update).not.toHaveBeenCalled();
  });

  it('reopens the resolved bug on regression instead of hiding it', async () => {
    const client = makeClient({ resolvedBug: { id: 'bug-resolved' } });
    await run(client, TESTCASE_STATUS.FAILED);
    expect(client.create).not.toHaveBeenCalled();
    expect(client.update).toHaveBeenCalledTimes(1);
    const arg = client.update.mock.calls[0][0];
    expect(arg.where).toEqual({ id: 'bug-resolved' });
    expect(arg.data.status).toBe(BUGFIX_STATUS.REPORTED);
    expect(arg.data.fixedAt).toBeNull();
  });
});

describe('syncBugFixForTestCaseStatus — resolved', () => {
  it('marks active bugs verified & fixed when the case passes', async () => {
    const client = makeClient({});
    await run(client, TESTCASE_STATUS.DONE);
    expect(client.updateMany).toHaveBeenCalledTimes(1);
    const arg = client.updateMany.mock.calls[0][0];
    expect(arg.data.status).toBe(BUGFIX_STATUS.VERIFIED_FIXED);
  });
});
