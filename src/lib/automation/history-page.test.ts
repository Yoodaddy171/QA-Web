import { describe, expect, it } from 'vitest';
import { automationHistoryPage } from './history-page';
const rows = Array.from({ length: 61 }, (_, i) => ({ id: String(i), automationSource: 'testcase', testCaseId: `QA-${i}`, page: 'Login', testAction: 'Verify login', status: 'NOT DONE', moduleId: i % 2 ? 'm' : null, automation: { hasManualCapture: i % 2 === 0, hasAutomationRun: true, lastRunAt: '2026-01-01' } }));
describe('history server pagination', () => {
  it('returns bounded rows, complete summary and lightweight testcase record flags', () => {
    const page = automationHistoryPage(rows, new URLSearchParams('page=2&limit=25'));
    expect(page.items).toHaveLength(25); expect(page.items[0].id).toBe('25'); expect(page.totalPages).toBe(3); expect(page.summary.total).toBe(61); expect(Object.keys(page.records)).toHaveLength(25);
    const flags = automationHistoryPage(rows, new URLSearchParams('view=records'));
    expect(flags.items).toEqual([]); expect(Object.keys(flags.records)).toHaveLength(61);
  });
  it('filters before pagination and clamps a page that no longer exists', () => {
    const page = automationHistoryPage(rows, new URLSearchParams('page=99&moduleId=unassigned&search=QA-6'));
    expect(page.items.map(item => item.id)).toEqual(['6', '60']); expect(page.page).toBe(1); expect(page.moduleIds.sort()).toEqual(['m', 'unassigned']);
  });
  it('returns a valid empty state and bounds abusive limits', () => {
    expect(automationHistoryPage([], new URLSearchParams()).totalPages).toBe(1);
    expect(automationHistoryPage(rows, new URLSearchParams('limit=999999')).limit).toBe(100);
  });
});
