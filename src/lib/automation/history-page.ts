type Row = {
  id: string; automationSource: string; testCaseId: string; page: string; subMenu?: string | null;
  testAction: string; status: string; moduleId?: string | null; module?: { name: string } | null;
  automation: { hasManualCapture: boolean; hasAutomationRun: boolean; lastRunAt: string | null };
};
/** Filtering runs once on the server. Navigation and table receive exactly the same page. */
export function automationHistoryPage<T extends Row>(items: T[], params: URLSearchParams) {
  const limit = Math.min(100, Math.max(1, Math.floor(Number(params.get('limit')) || 25)));
  const moduleId = params.get('moduleId') || 'all';
  const keyword = (params.get('search') || '').trim().toLowerCase();
  const filtered = items.filter(item => (moduleId === 'all' || (item.moduleId || 'unassigned') === moduleId)
    && (!keyword || [item.testCaseId, item.page, item.subMenu, item.testAction, item.status, item.module?.name].some(value => value?.toLowerCase().includes(keyword))));
  const totalPages = Math.max(1, Math.ceil(filtered.length / limit));
  const page = Math.min(totalPages, Math.max(1, Math.floor(Number(params.get('page')) || 1)));
  const pageItems = filtered.slice((page - 1) * limit, page * limit);
  const recordsOnly = params.get('view') === 'records';
  const records = Object.fromEntries((recordsOnly ? items : pageItems).filter(item => item.automationSource === 'testcase').map(item => [item.id, {
    hasAutomationRun: item.automation.hasAutomationRun, hasManualCapture: item.automation.hasManualCapture, lastRunAt: item.automation.lastRunAt,
  }]));
  return {
    items: recordsOnly ? [] : pageItems, total: filtered.length, totalPages, page, limit,
    summary: { total: filtered.length, manual: filtered.filter(item => item.automation.hasManualCapture).length, lastRunAt: filtered[0]?.automation.lastRunAt || null },
    moduleIds: [...new Set(items.map(item => item.moduleId || 'unassigned'))], records,
  };
}
