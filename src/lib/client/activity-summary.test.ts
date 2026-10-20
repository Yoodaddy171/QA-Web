import { describe, expect, it } from 'vitest';
import { activityEntityLabel, activityFieldLabel, summarizeActivities, type DashboardActivity } from './activity-summary';

const event = (overrides: Partial<DashboardActivity> = {}): DashboardActivity => ({
  id: 'a', entityType: 'TestCase', entityId: 'uuid-a', action: 'UPDATED',
  field: 'status', afterValue: 'DONE', actor: 'Tester A', createdAt: '2026-10-20T01:00:00.500Z', ...overrides,
});

describe('dashboard activity presentation', () => {
  it('combines adjacent distinct fields without modifying or dropping audit events', () => {
    const items = [event(), event({ id: 'b', field: 'actualResult', createdAt: '2026-10-20T01:00:00.400Z' }), event({ id: 'c', field: 'remarks', createdAt: '2026-10-20T01:00:00.300Z' })];
    const snapshot = structuredClone(items);
    const groups = summarizeActivities(items);
    expect(groups).toHaveLength(1);
    expect(groups[0].events.map(item => item.id)).toEqual(['a', 'b', 'c']);
    expect(items).toEqual(snapshot);
  });
  it.each([
    { actor: 'Tester B' }, { entityId: 'uuid-b' }, { entityType: 'BugFix' },
    { action: 'CREATED' }, { field: 'status' }, { field: null },
    { createdAt: '2026-10-20T00:59:59.000Z' }, { createdAt: 'invalid' },
    { createdAt: '2026-10-20T01:00:01.000Z' },
  ])('keeps unrelated/repeated/invalid updates separate: %j', overrides => {
    expect(summarizeActivities([event(), event({ id: 'b', field: 'remarks', ...overrides })])).toHaveLength(2);
  });
  it('does not group an unbounded chain of adjacent timestamps', () => {
    const groups = summarizeActivities([event(), event({ id: 'b', field: 'remarks', createdAt: '2026-10-20T01:00:00.000Z' }), event({ id: 'c', field: 'priority', createdAt: '2026-10-20T00:59:59.400Z' })]);
    expect(groups.map(group => group.events.length)).toEqual([2, 1]);
  });
  it('prefers current server identity and never mistakes a status for a name', () => {
    expect(activityEntityLabel(event({ entityLabel: 'AUTH-001' }))).toBe('AUTH-001');
    expect(activityEntityLabel(event({ afterValue: { testCaseId: 'OLD-001' } }))).toBe('OLD-001');
    expect(activityEntityLabel(event({ afterValue: { status: 'DONE' } }))).toBe('UUID uuid-a');
  });
  it('translates internal field names and accepts an empty feed', () => {
    expect(activityFieldLabel('actualResult')).toBe('Hasil aktual');
    expect(activityFieldLabel('remarks')).toBe('Catatan');
    expect(activityFieldLabel('customField')).toBe('custom Field');
    expect(summarizeActivities([])).toEqual([]);
  });
});
