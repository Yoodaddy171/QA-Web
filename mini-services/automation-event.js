const crypto = require('crypto');

const AUTOMATION_EVENT_SCHEMA_VERSION = 1;
const RUN_BUCKET_MS = 5 * 60 * 1000;
const MODES = new Set(['manual', 'katalon', 'unknown']);
const EVENT_TYPES = new Set([
  'run.started',
  'run.finished',
  'step',
  'console',
  'network.request',
  'network.response',
  'screenshot',
  'evidence',
  'warning',
  'error',
  'log',
]);

const EVENT_FIELDS = new Set([
  'schemaVersion',
  'eventId',
  'runId',
  'mode',
  'testCaseId',
  'testCaseName',
  'projectId',
  'source',
  'eventType',
  'stepName',
  'status',
  'message',
  'timestamp',
  'durationMs',
  'url',
  'method',
  'requestHeaders',
  'requestBody',
  'responseStatus',
  'responseHeaders',
  'responseBody',
  'screenshotPath',
  'evidencePath',
  'browserName',
  'browserSessionId',
  'cdpAvailable',
  'fallbackUsed',
  'metadata',
]);

const LEGACY_FIELDS = new Set([
  ...EVENT_FIELDS,
  'type',
  'sessionId',
  'executionId',
  'relativeMs',
  'level',
  'log',
  'console',
  'network',
  'interaction',
]);

function createEventId() {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : crypto.randomBytes(16).toString('hex');
}

function createRunId(prefix = 'run') {
  return `${prefix}-${createEventId()}`;
}

function inferMode(source, requestedMode) {
  if (MODES.has(requestedMode)) return requestedMode;
  const normalizedSource = String(source || '').toLowerCase();
  if (normalizedSource.startsWith('manual')) return 'manual';
  if (normalizedSource.includes('katalon') || normalizedSource.includes('devlog')) return 'katalon';
  return 'unknown';
}

function toIsoTimestamp(value) {
  if (value) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return new Date().toISOString();
}

function stableFallbackRunId(testCaseId, timestamp) {
  const bucket = Math.floor(new Date(timestamp).getTime() / RUN_BUCKET_MS);
  const identity = `${String(testCaseId || 'unknown')}:${bucket}`;
  const hash = crypto.createHash('sha1').update(identity).digest('hex').slice(0, 16);
  return `fallback-${hash}`;
}

function deriveRunId(input, testCaseId, timestamp) {
  return input.runId
    || input.sessionId
    || input.executionId
    || stableFallbackRunId(testCaseId, timestamp);
}

function getUnknownFields(input, knownFields) {
  return Object.fromEntries(
    Object.entries(input || {}).filter(([key]) => !knownFields.has(key))
  );
}

function compactObject(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, fieldValue]) => fieldValue !== undefined)
  );
}

function inferLegacyEventType(input) {
  const networkEvent = String(input.network?.event || '').toLowerCase();
  if (networkEvent.includes('request')) return 'network.request';
  if (input.network) return 'network.response';
  if (input.screenshotPath) return 'screenshot';
  if (input.evidencePath) return 'evidence';

  const message = String(input.message ?? input.log ?? '');
  if (/Starting\s+.*(Automation|Manual\s+Capture)/i.test(message)) return 'run.started';
  if (/Execution\s+complete|Manual\s+Capture\s+Stopped/i.test(message)) return 'run.finished';
  if (input.level || input.console) return 'console';
  return 'log';
}

function adaptLegacyLogToAutomationEvent(input = {}) {
  const timestamp = toIsoTimestamp(input.timestamp);
  const source = String(input.source || '');
  const testCaseId = input.testCaseId;
  const network = input.network || {};
  const networkData = network.data && typeof network.data === 'object' ? network.data : {};
  const unknownLegacyFields = getUnknownFields(input, LEGACY_FIELDS);
  const metadata = {
    ...(input.metadata && typeof input.metadata === 'object' ? input.metadata : {}),
    legacy: compactObject({
      type: input.type,
      sessionId: input.sessionId,
      executionId: input.executionId,
      relativeMs: input.relativeMs,
      level: input.level,
      console: input.console,
      interaction: input.interaction,
      ...unknownLegacyFields,
    }),
  };

  return compactObject({
    schemaVersion: AUTOMATION_EVENT_SCHEMA_VERSION,
    eventId: input.eventId || createEventId(),
    runId: deriveRunId(input, testCaseId, timestamp),
    mode: inferMode(source, input.mode),
    testCaseId,
    testCaseName: input.testCaseName,
    projectId: input.projectId,
    source,
    eventType: inferLegacyEventType(input),
    stepName: input.stepName,
    status: input.status,
    message: input.message ?? input.log,
    timestamp,
    durationMs: input.durationMs ?? network.duration,
    url: input.url ?? network.url,
    method: input.method ?? network.method,
    requestHeaders: input.requestHeaders ?? networkData.requestHeaders,
    requestBody: input.requestBody ?? networkData.requestBody,
    responseStatus: input.responseStatus ?? network.status,
    responseHeaders: input.responseHeaders ?? network.responseHeaders ?? network.headers,
    responseBody: input.responseBody ?? networkData.responseBody,
    screenshotPath: input.screenshotPath,
    evidencePath: input.evidencePath,
    browserName: input.browserName,
    browserSessionId: input.browserSessionId ?? input.sessionId,
    cdpAvailable: input.cdpAvailable,
    fallbackUsed: input.fallbackUsed,
    metadata,
  });
}

function normalizeAutomationEvent(input = {}) {
  const isEventInput = input.schemaVersion === AUTOMATION_EVENT_SCHEMA_VERSION || Boolean(input.eventType);
  if (!isEventInput) return adaptLegacyLogToAutomationEvent(input);

  const timestamp = toIsoTimestamp(input.timestamp);
  const source = String(input.source || '');
  const testCaseId = input.testCaseId;
  const unknownFields = getUnknownFields(input, EVENT_FIELDS);
  const metadata = {
    ...(input.metadata && typeof input.metadata === 'object' ? input.metadata : {}),
  };
  if (Object.keys(unknownFields).length) metadata.raw = unknownFields;

  const normalizedFields = Object.fromEntries(
    Object.entries(input).filter(([key]) => EVENT_FIELDS.has(key))
  );

  return compactObject({
    ...normalizedFields,
    schemaVersion: AUTOMATION_EVENT_SCHEMA_VERSION,
    eventId: input.eventId || createEventId(),
    runId: deriveRunId(input, testCaseId, timestamp),
    mode: inferMode(source, input.mode),
    eventType: EVENT_TYPES.has(input.eventType) ? input.eventType : 'log',
    timestamp,
    metadata,
  });
}

function validateAutomationEvent(event) {
  const errors = [];
  const warnings = [];

  if (!event || typeof event !== 'object') {
    return { valid: false, errors: ['event must be an object'], warnings };
  }
  if (event.schemaVersion !== AUTOMATION_EVENT_SCHEMA_VERSION) errors.push('schemaVersion must be 1');
  if (!event.eventId) errors.push('eventId is required');
  if (!event.runId) errors.push('runId is required');
  if (!event.testCaseId) errors.push('testCaseId is required');
  if (!event.timestamp || Number.isNaN(new Date(event.timestamp).getTime())) errors.push('timestamp must be a valid date');
  if (!MODES.has(event.mode)) errors.push('mode is invalid');
  if (!EVENT_TYPES.has(event.eventType)) errors.push('eventType is invalid');
  if (event.mode === 'unknown') warnings.push('mode could not be inferred');
  if (!event.source) warnings.push('source is missing');

  return { valid: errors.length === 0, errors, warnings };
}

module.exports = {
  AUTOMATION_EVENT_SCHEMA_VERSION,
  EVENT_TYPES,
  MODES,
  adaptLegacyLogToAutomationEvent,
  createEventId,
  createRunId,
  normalizeAutomationEvent,
  validateAutomationEvent,
};
