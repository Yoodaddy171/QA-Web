import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { guestRoutePermission } from '@/lib/domain/guest-access';
const mocks = vi.hoisted(() => ({ testcase: vi.fn(), rows: vi.fn(), count: vi.fn() }));
vi.mock('@/lib/db', () => ({ db: { testCase: { findFirst: mocks.testcase }, testExecutionEvidence: { findMany: mocks.rows, count: mocks.count } } }));
import { GET } from './route';
const request = (query = '') => new NextRequest(`http://localhost/api/testcases/c/evidence?projectId=p${query}`);
const context = { params: Promise.resolve({ id: 'c' }) };
beforeEach(() => { vi.resetAllMocks(); mocks.testcase.mockResolvedValue({ id: 'c' }); mocks.count.mockResolvedValue(70); mocks.rows.mockResolvedValue(Array.from({ length: 26 }, (_, i) => ({ id: `e${i}`, fileName: 'evidence.png', mimeType: 'image/png', execution: { id: 'x', status: 'FAILED', testRun: { id: 'r', name: 'Regression' } } }))); });
describe('paged testcase evidence metadata', () => {
  it('returns only 25 evidence metadata entries, not the whole traceability tree', async () => {
    const response = await GET(request(), context); const body = await response.json(); expect(body.items).toHaveLength(25); expect(body.nextCursor).toBe('e24'); expect(body.total).toBe(70);
    expect(mocks.rows).toHaveBeenCalledWith(expect.objectContaining({ where: { execution: { testCaseId: 'c', testRun: { projectId: 'p' } } }, take: 26 }));
    expect(body.items[0]).toMatchObject({ run: { id: 'r' }, execution: { id: 'x' } }); expect(JSON.stringify(body)).not.toContain('storagePath');
  });
  it('uses cursors and fails closed on a foreign testcase', async () => {
    await GET(request('&cursor=e24'), context); expect(mocks.rows).toHaveBeenCalledWith(expect.objectContaining({ cursor: { id: 'e24' }, skip: 1 }));
    mocks.testcase.mockResolvedValue(null); mocks.rows.mockClear(); expect((await GET(request(), context)).status).toBe(404); expect(mocks.rows).not.toHaveBeenCalled();
  });
  it('requires evidence.view for guests and never permits writes through the gallery route', () => {
    expect(guestRoutePermission('/api/testcases/c/evidence', 'GET')).toBe('evidence.view'); expect(guestRoutePermission('/api/testcases/c/evidence', 'POST')).toBeNull();
  });
});
