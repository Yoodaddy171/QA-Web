export type DashboardActivity = {
  id: string;
  entityType: string;
  entityId: string;
  entityLabel?: string | null;
  action: string;
  field: string | null;
  afterValue: unknown;
  actor: string | null;
  createdAt: string;
};

const FIELD_LABELS: Record<string, string> = {
  remarks: 'Catatan', actualResult: 'Hasil aktual', status: 'Status', steps: 'Test steps',
  testAction: 'Test action', expectedResult: 'Expected result', priority: 'Prioritas',
  assignee: 'Penanggung jawab', assignedTo: 'Penanggung jawab', moduleId: 'Module',
  testCaseId: 'Display ID', page: 'Page', subMenu: 'Sub Menu', name: 'Nama', progress: 'Progress',
};

export function activityFieldLabel(field: string) {
  return FIELD_LABELS[field] || field.replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll('_', ' ');
}

export function activityEntityLabel(item: DashboardActivity) {
  if (item.entityLabel) return item.entityLabel;
  if (item.afterValue && typeof item.afterValue === 'object' && !Array.isArray(item.afterValue)) {
    const value = item.afterValue as Record<string, unknown>;
    for (const key of ['testCaseId', 'name']) {
      if (typeof value[key] === 'string' && value[key]) return value[key];
    }
  }
  // Deleted entities and older servers may have no human-readable identity.
  return `UUID ${item.entityId}`;
}

/** Presentation only: retain every original event; never rewrite audit history.
 * Group adjacent, distinct-field updates within one second, not arbitrary events
 * in the same minute. Repeated writes to one field stay separate.
 */
export function summarizeActivities(items: DashboardActivity[]) {
  const groups: Array<{ item: DashboardActivity; events: DashboardActivity[] }> = [];
  for (const item of items) {
    const previous = groups.at(-1);
    const elapsed = previous ? Date.parse(previous.item.createdAt) - Date.parse(item.createdAt) : NaN;
    if (previous && item.action === 'UPDATED' && previous.item.action === item.action
      && previous.item.entityType === item.entityType && previous.item.entityId === item.entityId
      && previous.item.actor === item.actor && item.field && previous.events.every(event => event.field && event.field !== item.field)
      && Number.isFinite(elapsed) && elapsed >= 0 && elapsed <= 1000) {
      previous.events.push(item);
    } else {
      groups.push({ item, events: [item] });
    }
  }
  return groups;
}
