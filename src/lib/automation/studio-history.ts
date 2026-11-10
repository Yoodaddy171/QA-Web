import { indexedStudioCaseIds, listRuns } from './script-store.mjs';

type StudioSummary = {
  id: string;
  hasCurrent: boolean;
  hasPrevious: boolean;
  hasLegacy: boolean;
  hasAutomationRun: boolean;
  hasManualCapture: boolean;
  hasPlaywrightStudio: boolean;
  totalBytes: number;
  lastRunAt: string | null;
  files: [];
  studioRunId: string;
  studioStatus: string;
};

// Only inspect cases already authorized by the project query. Read metadata, never scripts/events/artifacts.
export async function studioHistorySummaries(root: string, projectId: string, caseIds: string[]) {
  const indexedIds = await indexedStudioCaseIds(root, projectId, caseIds);
  const summaries = new Map<string, StudioSummary>();
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(8, indexedIds.length) }, async () => {
    while (next < indexedIds.length) {
      const id = indexedIds[next++] as string;
      const runs = await listRuns(root, projectId, id, 2);
      const run = runs[0];
      if (!run) continue;
      summaries.set(id, {
        id, hasCurrent: true, hasPrevious: runs.length > 1, hasLegacy: false,
        hasAutomationRun: true, hasManualCapture: false, hasPlaywrightStudio: true,
        totalBytes: (run.artifacts || []).reduce((sum: number, artifact: { size?: number }) => sum + Math.max(0, Number(artifact.size) || 0), 0),
        lastRunAt: run.endedAt || run.startedAt || run.createdAt || null,
        files: [], studioRunId: run.runId, studioStatus: run.status,
      });
    }
  }));
  return summaries;
}

type HistoryItem = {
  id: string;
  automationSource: string;
  automation: { lastRunAt: string | null; hasPrevious: boolean; hasManualCapture: boolean; hasAutomationRun: boolean };
};
const time = (value: string | null) => value ? new Date(value).getTime() || 0 : 0;

/** One row per testcase, with both sources retained; deleting Studio files cannot leave phantom DB copies. */
export function mergeAutomationHistory<T extends HistoryItem>(legacy: T[], studio: T[]): T[] {
  const rows = new Map(legacy.map(item => [`${item.automationSource}:${item.id}`, item]));
  for (const item of studio) {
    const key = `${item.automationSource}:${item.id}`;
    const old = rows.get(key);
    if (!old) { rows.set(key, item); continue; }
    const studioIsLatest = time(item.automation.lastRunAt) >= time(old.automation.lastRunAt);
    rows.set(key, {
      ...old,
      automation: {
        ...(studioIsLatest ? old.automation : item.automation),
        ...(studioIsLatest ? item.automation : old.automation),
        hasPrevious: true,
        hasManualCapture: old.automation.hasManualCapture,
        hasAutomationRun: old.automation.hasAutomationRun || item.automation.hasAutomationRun,
      },
    });
  }
  return [...rows.values()].sort((a, b) => time(b.automation.lastRunAt) - time(a.automation.lastRunAt));
}
