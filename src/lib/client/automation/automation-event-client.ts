export type AutomationEventMode = 'manual' | 'katalon' | 'unknown';
export type AutomationEventType =
  | 'run.started'
  | 'run.finished'
  | 'step'
  | 'console'
  | 'network.request'
  | 'network.response'
  | 'screenshot'
  | 'evidence'
  | 'warning'
  | 'error'
  | 'log'
  | string;

export interface AutomationEventV1 {
  schemaVersion: 1;
  eventId?: string;
  runId?: string;
  mode?: AutomationEventMode;
  testCaseId?: string;
  testCaseName?: string;
  projectId?: string;
  source?: string;
  eventType?: AutomationEventType;
  stepName?: string;
  status?: string;
  message?: unknown;
  timestamp?: string | number | Date;
  durationMs?: number;
  url?: string;
  method?: string;
  requestHeaders?: unknown;
  requestBody?: unknown;
  responseStatus?: number;
  responseHeaders?: unknown;
  responseBody?: unknown;
  screenshotPath?: string;
  evidencePath?: string;
  browserName?: string;
  browserSessionId?: string;
  cdpAvailable?: boolean;
  fallbackUsed?: boolean;
  metadata?: Record<string, unknown>;
}

export interface AutomationEventEnvelope {
  type: 'automation.event';
  schemaVersion: 1;
  event: AutomationEventV1;
  cursor?: string;
  persistedRunId?: string;
}

export interface AutomationLogEntry {
  id?: string;
  type?: string;
  source?: string;
  testCaseId?: string;
  timestamp?: string | number | Date;
  relativeMs?: number;
  level?: string;
  log?: unknown;
  message?: unknown;
  console?: unknown;
  isExecution?: boolean;
  isConsole?: boolean;
  isNetwork?: boolean;
  network?: {
    event?: string;
    method?: string;
    url: string;
    status?: number;
    duration?: number;
    headers?: unknown;
    data?: unknown;
    success?: boolean;
  };
  sessionId?: string;
  eventId?: string;
  runId?: string;
  mode?: AutomationEventMode;
  eventType?: AutomationEventType;
  cdpAvailable?: boolean;
  fallbackUsed?: boolean;
  metadata?: Record<string, unknown>;
}

type UnknownMessage = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownMessage {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function createLogId() {
  return Math.random().toString(36).slice(2, 11);
}

function inferLegacyCategory(message: AutomationLogEntry) {
  const logValue = message.log ?? message.message;
  const isNetwork = !!message.network || logValue?.toString().startsWith('Network:');
  const isConsole = !!message.level || !!message.console;
  return { isNetwork, isConsole, isExecution: !isNetwork && !isConsole };
}

function inferLegacyEventType(message: AutomationLogEntry): AutomationEventType {
  if (message.eventType) return message.eventType;
  if (message.network?.event?.toLowerCase().includes('request')) return 'network.request';
  if (message.network) return 'network.response';
  if (message.level || message.console) return 'console';

  const logText = String(message.log ?? message.message ?? '');
  if (/Starting\s+.*(Automation|Manual\s+Capture)/i.test(logText)) return 'run.started';
  if (/Execution\s+complete|Manual\s+Capture\s+Stopped/i.test(logText)) return 'run.finished';
  return 'log';
}

function inferEventCategory(eventType?: AutomationEventType) {
  const isNetwork = eventType === 'network.request' || eventType === 'network.response';
  const isConsole = eventType === 'console';
  return { isNetwork, isConsole, isExecution: !isNetwork && !isConsole };
}

function getLegacyMetadataValue(event: AutomationEventV1, key: string) {
  const legacy = isRecord(event.metadata?.legacy) ? event.metadata.legacy : null;
  return legacy?.[key];
}

export function isAutomationEventEnvelope(message: unknown): message is AutomationEventEnvelope {
  return isRecord(message)
    && message.type === 'automation.event'
    && message.schemaVersion === 1
    && isRecord(message.event);
}

export function isLegacyLogMessage(message: unknown): message is AutomationLogEntry {
  return isRecord(message) && message.type === 'log';
}

export function extractAutomationEvent(message: unknown): AutomationEventV1 | null {
  return isAutomationEventEnvelope(message) ? message.event : null;
}

export function adaptAutomationEventToLogEntry(message: AutomationEventEnvelope | AutomationEventV1): AutomationLogEntry {
  const event = isAutomationEventEnvelope(message) ? message.event : message;
  const category = inferEventCategory(event.eventType);
  const networkEvent = event.eventType === 'network.request' ? 'Request' : 'Response';
  const legacyLevel = getLegacyMetadataValue(event, 'level');
  const relativeMs = getLegacyMetadataValue(event, 'relativeMs');

  return {
    id: event.eventId || createLogId(),
    type: 'log',
    source: event.source,
    testCaseId: event.testCaseId,
    timestamp: event.timestamp || new Date().toISOString(),
    relativeMs: typeof relativeMs === 'number' ? relativeMs : undefined,
    level: typeof legacyLevel === 'string' ? legacyLevel : event.eventType === 'console' ? event.status : undefined,
    log: event.message ?? event.stepName ?? event.eventType ?? 'Automation event',
    console: category.isConsole || undefined,
    isExecution: category.isExecution,
    isConsole: category.isConsole,
    isNetwork: category.isNetwork,
    network: category.isNetwork ? {
      event: networkEvent,
      method: event.method,
      url: event.url || '',
      status: event.responseStatus,
      duration: event.durationMs,
      headers: event.responseHeaders ?? event.requestHeaders,
      data: {
        requestHeaders: event.requestHeaders,
        requestBody: event.requestBody,
        responseBody: event.responseBody,
      },
      success: typeof event.responseStatus === 'number' ? event.responseStatus < 400 : undefined,
    } : undefined,
    sessionId: event.browserSessionId,
    eventId: event.eventId,
    runId: event.runId,
    mode: event.mode,
    eventType: event.eventType,
    cdpAvailable: event.cdpAvailable,
    fallbackUsed: event.fallbackUsed,
    metadata: event.metadata,
  };
}

export function adaptLegacyLogToLogEntry(message: AutomationLogEntry): AutomationLogEntry {
  const category = inferLegacyCategory(message);
  return {
    ...message,
    id: message.id || createLogId(),
    timestamp: message.timestamp || new Date().toISOString(),
    log: message.log ?? message.message,
    eventType: inferLegacyEventType(message),
    ...category,
  };
}

export function getAutomationEventTestCaseId(message: unknown): string | undefined {
  if (isAutomationEventEnvelope(message)) return message.event.testCaseId;
  if (isLegacyLogMessage(message)) return message.testCaseId;
  return undefined;
}

export function getAutomationEventRunId(message: unknown): string | undefined {
  if (isAutomationEventEnvelope(message)) return message.event.runId;
  if (isLegacyLogMessage(message)) return message.runId;
  return undefined;
}

export function isAutomationMessageForTestCase(message: unknown, testCaseId: string | null | undefined) {
  return Boolean(testCaseId && getAutomationEventTestCaseId(message) === testCaseId);
}

function timestampFingerprint(value: AutomationLogEntry['timestamp']) {
  if (!value) return '';
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? String(value) : String(Math.floor(timestamp / 1000));
}

export function getAutomationLogDedupKeys(entry: AutomationLogEntry) {
  const keys: string[] = [];
  if (entry.eventId) keys.push(`event:${entry.eventId}`);

  const timestamp = timestampFingerprint(entry.timestamp);
  const message = typeof entry.log === 'string' ? entry.log : JSON.stringify(entry.log ?? '');
  if (timestamp && (entry.source || message || entry.eventType)) {
    keys.push(`fingerprint:${timestamp}|${entry.source || ''}|${message}|${entry.eventType || ''}`);
  }

  return keys;
}
