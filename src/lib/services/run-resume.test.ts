import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ run: vi.fn(), target: vi.fn(), count: vi.fn(), rows: vi.fn(), latest: vi.fn(), raw: vi.fn() }));
vi.mock('@/lib/db', () => ({ db: { testRun: { findFirst: mocks.run }, testRunCase: { findFirst: mocks.target, count: mocks.count, findMany: mocks.rows }, testExecution: { findMany: mocks.latest }, $queryRaw: mocks.raw } }));
vi.mock('@/lib/services/guest-response', () => ({ guestSafeResponse: async (value: unknown) => value }));
import { getTestRunCasesPage } from './test-run-service';
beforeEach(() => { vi.resetAllMocks(); mocks.run.mockResolvedValue({ id: 'r' }); mocks.target.mockResolvedValue({ id: 'membership-150', createdAt: new Date('2026-01-01') }); mocks.count.mockResolvedValue(149); mocks.rows.mockResolvedValue([]); mocks.raw.mockResolvedValue([]); mocks.latest.mockResolvedValue([]); });
describe('bounded UUID resume queries', () => {
  it('resolves the page containing a UUID beyond the first 100 cases', async () => {
    const result = await getTestRunCasesPage('p', 'r', { focusCaseId: 'case-150', limit: 100 });
    expect(result?.startOffset).toBe(100); expect(mocks.rows).toHaveBeenCalledWith(expect.objectContaining({ where: { testRunId: 'r' }, skip: 100, take: 101 }));
    expect(mocks.target).toHaveBeenCalledWith(expect.objectContaining({ where: { testRunId: 'r', testCaseId: 'case-150' } }));
  });
  it('falls back to the first page when the saved testcase was removed', async () => {
    mocks.target.mockResolvedValue(null); const result = await getTestRunCasesPage('p', 'r', { focusCaseId: 'removed' }); expect(result?.startOffset).toBe(0);
  });
  it('clamps legacy index migration after a run shrinks', async () => {
    mocks.count.mockResolvedValue(151); const result = await getTestRunCasesPage('p', 'r', { focusIndex: 9999 }); expect(result?.startOffset).toBe(100);
  });
  it('does not query case membership for a foreign project run', async () => {
    mocks.run.mockResolvedValue(null); expect(await getTestRunCasesPage('other', 'r', { focusCaseId: 'case-150' })).toBeNull(); expect(mocks.target).not.toHaveBeenCalled(); expect(mocks.rows).not.toHaveBeenCalled();
  });
  it('supports loading a preceding bounded page without rescanning loaded pages', async () => {
    await getTestRunCasesPage('p', 'r', { offset: 200, limit: 100 }); expect(mocks.rows).toHaveBeenCalledWith(expect.objectContaining({ skip: 200, take: 101 })); expect(mocks.count).not.toHaveBeenCalled();
  });
});
