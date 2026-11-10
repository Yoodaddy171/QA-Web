import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  testCase: { findMany: vi.fn(), groupBy: vi.fn() }, module: { findMany: vi.fn() }, bugFix: { findMany: vi.fn(), groupBy: vi.fn() },
  testRun: { findMany: vi.fn() }, testRunCase: { findMany: vi.fn() }, activityHistory: { findMany: vi.fn() },
  $queryRaw: vi.fn(),
}));
vi.mock('@/lib/db', () => ({ db: mocks }));
import { getProjectStats, buildReleaseReadiness } from './stats-service';
import { calculateDashboardStats } from './stats-aggregation';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.testCase.findMany.mockResolvedValue([]); mocks.module.findMany.mockResolvedValue([]);
  mocks.bugFix.findMany.mockResolvedValue([]); mocks.activityHistory.findMany.mockResolvedValue([]);
  mocks.testCase.groupBy.mockResolvedValue([]); mocks.bugFix.groupBy.mockResolvedValue([]);
  mocks.$queryRaw.mockReset().mockResolvedValue([]);
});

it.each([
  ['IN PROGRESS', ['READY', 'COMPLETED', 'IN PROGRESS'], 2],
  ['READY', ['COMPLETED', 'READY', 'DRAFT'], 1],
  ['latest fallback', ['COMPLETED', 'DRAFT'], 0],
] as const)('6C-STATS: %s readiness loads only the selected run, preserving output', async (_name, statuses, selected) => {
  const runs = statuses.map((status, i) => ({ id: `run-${i}`, name: `Cycle ${i}`, status,
    testCases: [{ executions: [{ status: i === selected ? 'FAILED' : 'PASSED' }] }, { executions: [] }] }));
  mocks.testRun.findMany.mockResolvedValue(runs);
  mocks.$queryRaw.mockImplementation(async query => query.strings.join('').includes('TestRunCase')
    ? [{ status: 'FAILED', count: BigInt(1) }, { status: 'NOT RUN', count: BigInt(1) }] : []);
  const actual = await getProjectStats('own-project');
  expect(actual).toEqual({ ...calculateDashboardStats([], [], []), releaseReadiness: buildReleaseReadiness(runs, []), recentActivities: [] });
  expect(mocks.testRun.findMany).toHaveBeenCalledWith({ where: { projectId: 'own-project', status: { not: 'ARCHIVED' } },
    select: { id: true, name: true, status: true }, orderBy: { updatedAt: 'desc' }, take: 10 });
  expect(mocks.testRunCase.findMany).not.toHaveBeenCalled();
  const runQueries = mocks.$queryRaw.mock.calls.filter(([query]) => query.strings.join('').includes('TestRunCase'));
  expect(runQueries).toHaveLength(1);
  expect(runQueries[0][0].values).toEqual([`run-${selected}`, `run-${selected}`]);
});

it('6C-STATS: no run retains empty readiness and does not query executions', async () => {
  mocks.testRun.findMany.mockResolvedValue([]);
  const actual = await getProjectStats('own-project');
  expect(actual.releaseReadiness).toEqual(buildReleaseReadiness([], []));
  expect(mocks.testRunCase.findMany).not.toHaveBeenCalled();
  expect(mocks.$queryRaw.mock.calls.some(([query]) => query.strings.join('').includes('TestRunCase'))).toBe(false);
});

it('STATS-INFLIGHT: coalesces concurrent requests, never caches completed or failed snapshots', async () => {
  mocks.testRun.findMany.mockResolvedValue([]);
  const [a, b] = await Promise.all([getProjectStats('same'), getProjectStats('same')]);
  expect(a).toEqual(b);
  expect(mocks.testCase.groupBy).toHaveBeenCalledTimes(1);
  await getProjectStats('same');
  expect(mocks.testCase.groupBy).toHaveBeenCalledTimes(2);
  mocks.testCase.groupBy.mockRejectedValueOnce(new Error('Synthetic failure'));
  await expect(getProjectStats('same')).rejects.toThrow('Synthetic failure');
  await expect(getProjectStats('same')).resolves.toBeDefined();
});
