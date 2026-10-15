import { describe, expect, it } from 'vitest';
import { reconcileRows } from './reconcile-rows';
import type { BugFixItem } from '@/components/BugFixPanel';

const row: BugFixItem = {
  id: 'bug-a', sourceTestCaseId: 'case-a', testCaseId: 'QA-001', projectId: 'project-a',
  page: 'Checkout', subMenu: null, testType: 'Positive', testAction: 'Pay', steps: 'Submit',
  expectedResult: 'Success', actualResult: 'Error', priority: 'High', moduleId: 'module-a',
  status: 'SUDAH DILAPORKAN', reportedAt: '2026-01-01', fixingAt: null, readyAt: null,
  fixedAt: null, createdAt: '2026-01-01', updatedAt: '2026-01-01', module: { id: 'module-a', name: 'Checkout' },
};
describe('Bugs equivalent-refresh reconciliation', () => {
  it('preserves the page and every unchanged row identity', () => {
    const previous = [row, { ...row, id: 'bug-b' }];
    expect(reconcileRows(previous, structuredClone(previous))).toBe(previous);
  });
  it.each(Object.keys(row).filter(key => key !== 'id' && key !== 'module'))('does not hide a changed %s', key => {
    const next = { ...row, [key]: 'changed' };
    const other = { ...row, id: 'bug-b' };
    const result = reconcileRows([row, other], [next, structuredClone(other)]);
    expect(result[0]).toBe(next);
    expect(result[1]).toBe(other);
  });
  it('detects nested module changes and server ordering/removal', () => {
    const next = { ...row, module: { id: 'module-a', name: 'Renamed' } };
    expect(reconcileRows([row], [next])[0]).toBe(next);
    const other = { ...row, id: 'bug-b' };
    const result = reconcileRows([row, other], [structuredClone(other)]);
    expect(result).toEqual([other]);
    expect(result[0]).toBe(other);
  });
});
