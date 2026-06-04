const {
  adaptLegacyLogToAutomationEvent,
  createEventId,
  normalizeAutomationEvent,
  validateAutomationEvent,
} = require('./automation-event');

describe('automation event normalizer', () => {
  it('normalizes an already-valid manual automation event', () => {
    const event = normalizeAutomationEvent({
      schemaVersion: 1,
      eventId: 'event-1',
      runId: 'manual-run-1',
      mode: 'manual',
      testCaseId: 'tc-1',
      source: 'manual-cdp',
      eventType: 'console',
      timestamp: '2026-06-04T00:00:00.000Z',
      message: 'hello',
    });

    expect(event).toMatchObject({
      eventId: 'event-1',
      runId: 'manual-run-1',
      mode: 'manual',
      testCaseId: 'tc-1',
      eventType: 'console',
      message: 'hello',
    });
    expect(validateAutomationEvent(event).valid).toBe(true);
  });

  it('normalizes an already-valid Katalon automation event', () => {
    const event = normalizeAutomationEvent({
      schemaVersion: 1,
      eventId: 'event-2',
      runId: 'katalon-run-1',
      mode: 'katalon',
      testCaseId: 'tc-2',
      source: 'katalon-devtools',
      eventType: 'network.response',
      timestamp: '2026-06-04T00:00:00.000Z',
      responseStatus: 200,
    });

    expect(event.mode).toBe('katalon');
    expect(event.responseStatus).toBe(200);
    expect(validateAutomationEvent(event).valid).toBe(true);
  });

  it('adapts a legacy manual source payload', () => {
    const event = adaptLegacyLogToAutomationEvent({
      type: 'log',
      source: 'manual-cdp',
      sessionId: 'manual-session-1',
      testCaseId: 'tc-3',
      log: 'Network Trace',
      network: { event: 'Response', method: 'GET', url: 'https://example.test', status: 204 },
    });

    expect(event).toMatchObject({
      runId: 'manual-session-1',
      mode: 'manual',
      testCaseId: 'tc-3',
      eventType: 'network.response',
      method: 'GET',
      responseStatus: 204,
      browserSessionId: 'manual-session-1',
    });
  });

  it('adapts a legacy Katalon/devlog payload', () => {
    const event = adaptLegacyLogToAutomationEvent({
      type: 'log',
      source: 'devlog',
      executionId: 'execution-1',
      testCaseId: 'tc-4',
      log: 'Clicked submit',
    });

    expect(event).toMatchObject({
      runId: 'execution-1',
      mode: 'katalon',
      testCaseId: 'tc-4',
      eventType: 'log',
      message: 'Clicked submit',
    });
  });

  it('generates eventId and timestamp when missing', () => {
    const event = normalizeAutomationEvent({
      eventType: 'step',
      source: 'manual-cdp',
      testCaseId: 'tc-5',
    });

    expect(event.eventId).toBeTruthy();
    expect(Number.isNaN(new Date(event.timestamp).getTime())).toBe(false);
  });

  it('preserves testCaseId and a provided runId', () => {
    const event = normalizeAutomationEvent({
      eventType: 'step',
      runId: 'provided-run',
      source: 'katalon-devlog',
      testCaseId: 'tc-6',
    });

    expect(event.testCaseId).toBe('tc-6');
    expect(event.runId).toBe('provided-run');
  });

  it('derives mode from source', () => {
    expect(normalizeAutomationEvent({ eventType: 'log', source: 'manual-capture', testCaseId: 'tc-7' }).mode).toBe('manual');
    expect(normalizeAutomationEvent({ eventType: 'log', source: 'katalon-devtools', testCaseId: 'tc-7' }).mode).toBe('katalon');
    expect(normalizeAutomationEvent({ eventType: 'log', source: 'other', testCaseId: 'tc-7' }).mode).toBe('unknown');
  });

  it('preserves unknown legacy fields in metadata', () => {
    const event = adaptLegacyLogToAutomationEvent({
      type: 'log',
      source: 'devlog',
      testCaseId: 'tc-8',
      customLegacyValue: 'preserved',
    });

    expect(event.metadata.legacy.customLegacyValue).toBe('preserved');
  });

  it('preserves unknown v1 fields only in metadata.raw', () => {
    const event = normalizeAutomationEvent({
      eventType: 'log',
      source: 'manual-capture',
      testCaseId: 'tc-9',
      customValue: 'preserved',
    });

    expect(event.customValue).toBeUndefined();
    expect(event.metadata.raw.customValue).toBe('preserved');
  });

  it('creates unique event IDs', () => {
    expect(createEventId()).not.toBe(createEventId());
  });

  it('reports invalid critical payloads without preventing legacy adaptation', () => {
    const event = adaptLegacyLogToAutomationEvent({ type: 'log', log: 'unmapped log' });
    const validation = validateAutomationEvent(event);

    expect(event.message).toBe('unmapped log');
    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain('testCaseId is required');
  });
});
