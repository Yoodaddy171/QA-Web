export const DEVLOG_SCHEMA_VERSION = 2 as const;

export type AutomationRunner = 'katalon' | 'playwright' | 'manual';
export type DevLogCategory = 'execution' | 'console' | 'network' | 'artifact';
export type DevLogLevel = 'DEBUG' | 'INFO' | 'WARNING' | 'SEVERE';

export type DevLogEventName =
  | 'run.started'
  | 'run.finished'
  | 'step'
  | 'console'
  | 'network.request'
  | 'network.response'
  | 'network.error'
  | 'artifact';

export interface DevLogNetworkData {
  event?: string;
  method?: string;
  url: string;
  status?: number;
  duration?: number;
  headers?: unknown;
  data?: unknown;
  success?: boolean;
}

export interface DevLogEvent {
  schemaVersion?: number;
  type: 'log';
  category?: DevLogCategory;
  event?: DevLogEventName | string;
  source?: string;
  runner?: AutomationRunner;
  testCaseId: string;
  sessionId?: string;
  timestamp?: string | number | Date;
  relativeMs?: number;
  level?: DevLogLevel | string;
  console?: unknown;
  log?: unknown;
  network?: DevLogNetworkData;
}

export function inferDevLogRunner(
  event: Pick<DevLogEvent, 'runner' | 'source' | 'sessionId'>,
): AutomationRunner | undefined {
  if (event.runner) return event.runner;

  const source = String(event.source || '').toLowerCase();
  const sessionId = String(event.sessionId || '').toLowerCase();

  if (source.includes('playwright') || sessionId.startsWith('pw-')) return 'playwright';
  if (source.startsWith('manual-') || source === 'manual-capture' || sessionId.startsWith('manual-')) return 'manual';
  if (source.includes('katalon')) return 'katalon';

  return undefined;
}

export function inferDevLogCategory(
  event: Pick<DevLogEvent, 'category' | 'network' | 'console' | 'level' | 'log'>,
): DevLogCategory {
  if (event.category) return event.category;

  if (event.network || String(event.log || '').startsWith('Network:')) {
    return 'network';
  }

  if (event.console || event.level) {
    return 'console';
  }

  return 'execution';
}
