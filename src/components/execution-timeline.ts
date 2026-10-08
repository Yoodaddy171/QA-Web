import { getExecutionInteraction, type LogEntry } from './TestCaseDetailDialog.helpers';

export type ExecutionRow = { log: LogEntry; count: number; derivedTime: boolean; late: boolean; network: LogEntry[] };
const validOffset = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 7 * 86400000;
const timestamp = (log: LogEntry) => log.timestamp === undefined ? NaN : new Date(log.timestamp).getTime();
const scope = (log: LogEntry) => log.runId || String(log.metadata?.sessionId || 'legacy');
const manual = (log: LogEntry) => log.mode === 'manual' || String(log.source).startsWith('manual-');

export function executionTimeline(logs: LogEntry[], evidence: LogEntry[] = [], raw = false) {
  const anchors = new Map<string, number>();
  for (const log of [...logs, ...evidence]) {
    const time = timestamp(log);
    if (!Number.isFinite(time)) continue;
    const anchor = validOffset(log.relativeMs) ? time - log.relativeMs : log.eventType === 'run.started' ? time : undefined;
    if (anchor !== undefined && !anchors.has(scope(log))) anchors.set(scope(log), anchor);
  }
  const timed = (log: LogEntry) => {
    if (validOffset(log.relativeMs)) return log;
    const anchor = anchors.get(scope(log));
    const offset = anchor === undefined ? NaN : timestamp(log) - anchor;
    return { ...log, relativeMs: validOffset(offset) ? offset : undefined };
  };
  const stops = new Map<string, number>();
  for (const log of logs) if (log.eventType === 'run.finished') {
    const ms = timed(log).relativeMs;
    if (ms !== undefined) stops.set(scope(log), ms);
  }
  const rows: ExecutionRow[] = [];
  let hidden = 0;
  for (const original of logs) {
    const log = timed(original);
    const interaction = getExecutionInteraction(log);
    const isManual = manual(log);
    if (!raw && isManual && interaction?.type === 'navigation'
      && (interaction.url === 'about:blank' || /^(about:)?blank$/i.test(interaction.target || ''))) { hidden++; continue; }
    const last = rows.at(-1);
    const previous = last && getExecutionInteraction(last.log);
    const delta = log.relativeMs !== undefined && last?.log.relativeMs !== undefined ? log.relativeMs - last.log.relativeMs : NaN;
    if (!raw && isManual && last && manual(last.log) && scope(log) === scope(last.log)
      && interaction?.type === 'input' && previous?.type === 'input' && interaction.target
      && previous.target === interaction.target && previous.url === interaction.url && delta >= 0 && delta <= 10000) {
      last.log = log; last.count++; last.derivedTime ||= original.relativeMs !== log.relativeMs;
      continue;
    }
    rows.push({ log, count: 1, derivedTime: original.relativeMs !== log.relativeMs,
      late: log.relativeMs !== undefined && stops.has(scope(log)) && log.relativeMs > stops.get(scope(log))!, network: [] });
  }
  // Temporal proximity only, never imply that an interaction caused a request.
  const byScope = new Map<string, ExecutionRow[]>();
  for (const row of rows) if (validOffset(row.log.relativeMs)) {
    const key = scope(row.log); const list = byScope.get(key) || []; list.push(row); byScope.set(key, list);
  }
  for (const list of byScope.values()) list.sort((a, b) => a.log.relativeMs! - b.log.relativeMs!);
  for (const original of evidence) {
    if (!original.network) continue;
    const log = timed(original), list = byScope.get(scope(log));
    if (!list || log.relativeMs === undefined) continue;
    let lo = 0, hi = list.length;
    while (lo < hi) { const mid = (lo + hi) >>> 1; if (list[mid].log.relativeMs! <= log.relativeMs) lo = mid + 1; else hi = mid; }
    const row = list[lo - 1];
    if (row && log.relativeMs - row.log.relativeMs! <= 3000) row.network.push(log);
  }
  return { rows, hidden, merged: rows.reduce((sum, row) => sum + row.count - 1, 0) };
}

export function executionTime(ms?: number) {
  if (!validOffset(ms)) return 'Waktu tidak tersedia';
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
