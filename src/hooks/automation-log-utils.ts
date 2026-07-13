import { adaptLegacyLogToLogEntry, type AutomationLogEntry } from '@/lib/client/automation/automation-event-client';

export function normalizeLogEntry(message: AutomationLogEntry): AutomationLogEntry {
  return adaptLegacyLogToLogEntry(message);
}

export const filterConsoleLogs = (logs: AutomationLogEntry[]) => logs.filter(log => log.isConsole);

export const isVideoProcessingStatus = (status?: string) => ['starting', 'recording', 'finalizing'].includes(status || '');

export const filterNetworkLogs = (logs: AutomationLogEntry[]) => logs.filter(log => {
  if (!log.isNetwork) return false;
  const url = log.network?.url?.toLowerCase() || '';
  const isStaticAsset = ['.js', '.css', '.png', '.jpg', '.jpeg', '.svg', '.gif', '.woff', '.woff2'].some(extension => url.endsWith(extension)) || url.includes('/assets/');
  return !isStaticAsset;
});

export function parseJsonlLogs(text: string) {
  return text.split('\n').filter(line => line.trim()).map(line => {
    try { return normalizeLogEntry(JSON.parse(line)); } catch { return null; }
  }).filter((log): log is AutomationLogEntry => log !== null);
}

export function getManualRecordingSessionId(logs: AutomationLogEntry[]) {
  return [...logs].reverse().find(log => String(log.source || '').startsWith('manual-') && log.sessionId)?.sessionId;
}
