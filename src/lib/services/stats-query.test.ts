import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  testCase: { findMany: vi.fn() }, module: { findMany: vi.fn() }, bugFix: { findMany: vi.fn() },
  testRun: { findMany: vi.fn() }, testRunCase: { findMany: vi.fn() }, activityHistory: { findMany: vi.fn() },
}));
vi.mock('@/lib/db', () => ({ db: mocks }));
import { getProjectStats, buildReleaseReadiness } from './stats-service';
import { calculateDashboardStats } from './stats-aggregation';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.testCase.findMany.mockResolvedValue([]); mocks.module.findMany.mockResolvedValue([]);
  mocks.bugFix.findMany.mockResolvedValue([]); mocks.activityHistory.findMany.mockResolvedValue([]);
});

it.each([
  ['IN PROGRESS', ['READY', 'COMPLETED', 'IN PROGRESS'], 2],
  ['READY', ['COMPLETED', 'READY', 'DRAFT'], 1],
  ['latest fallback', ['COMPLETED', 'DRAFT'], 0],
] as const)('6C-STATS: %s readiness loads only the selected run, preserving output', async (_name, statuses, selected) => {
  const runs = statuses.map((status, i) => ({ id: `run-${i}`, name: `Cycle ${i}`, status,
    testCases: [{ executions: [{ status: i === selected ? 'FAILED' : 'PASSED' }] }, { executions: [] }] }));
  mocks.testRun.findMany.mockResolvedValue(runs);
  mocks.testRunCase.findMany.mockResolvedValue(runs[selected].testCases);
  const actual = await getProjectStats('own-project');
  expect(actual).toEqual({ ...calculateDashboardStats([], [], []), releaseReadiness: buildReleaseReadiness(runs, []), recentActivities: [] });
  expect(mocks.testRun.findMany).toHaveBeenCalledWith({ where: { projectId: 'own-project', status: { not: 'ARCHIVED' } },
    select: { id: true, name: true, status: true }, orderBy: { updatedAt: 'desc' }, take: 10 });
  expect(mocks.testRunCase.findMany).toHaveBeenCalledOnce();
  expect(mocks.testRunCase.findMany).toHaveBeenCalledWith({ where: { testRunId: `run-${selected}` },
    select: { executions: { orderBy: { createdAt: 'desc' }, take: 1, select: { status: true } } } });
});

it('6C-STATS: no run retains empty readiness and does not query executions', async () => {
  mocks.testRun.findMany.mockResolvedValue([]);
  const actual = await getProjectStats('own-project');
  expect(actual.releaseReadiness).toEqual(buildReleaseReadiness([], []));
  expect(mocks.testRunCase.findMany).not.toHaveBeenCalled();
});
