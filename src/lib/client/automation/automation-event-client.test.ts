import { describe, expect, it } from 'vitest';
import {
  adaptAutomationEventToLogEntry,
  adaptLegacyLogToLogEntry,
  getAutomationEventRunId,
  getAutomationEventTestCaseId,
  getAutomationLogDedupKeys,
  isAutomationEventEnvelope,
  isAutomationMessageForTestCase,
  isLegacyLogMessage,
} from './automation-event-client';

const envelope = {
  type: 'automation.event' as const,
  schemaVersion: 1 as const,
  event: {
    schemaVersion: 1 as const,
    eventId: 'event-1',
    runId: 'run-1',
    mode: 'manual' as const,
    testCaseId: 'tc-1',
    source: 'manual-cdp',
    eventType: 'step',
    message: 'Clicked submit',
    timestamp: '2026-06-04T00:00:00.000Z',
  },
};

describe('automation event client adapter', () => {
  it('detects automation.event envelopes', () => {
    expect(isAutomationEventEnvelope(envelope)).toBe(true);
    expect(isAutomationEventEnvelope({ type: 'log' })).toBe(false);
  });

  it('detects legacy log messages', () => {
    expect(isLegacyLogMessage({ type: 'log', testCaseId: 'tc-1' })).toBe(true);
    expect(isLegacyLogMessage(envelope)).toBe(false);
  });

  it('converts a normalized event into the current UI log shape', () => {
    const log = adaptAutomationEventToLogEntry(envelope);

    expect(log).toMatchObject({
      id: 'event-1',
      type: 'log',
      testCaseId: 'tc-1',
      log: 'Clicked submit',
      isExecution: true,
      isConsole: false,
      isNetwork: false,
    });
  });

  it('converts a legacy log into the current UI log shape', () => {
    const log = adaptLegacyLogToLogEntry({
      type: 'log',
      testCaseId: 'tc-1',
      source: 'devlog',
      message: 'Legacy step',
    });

    expect(log.id).toBeTruthy();
    expect(log.log).toBe('Legacy step');
    expect(log.isExecution).toBe(true);
  });

  it('filters messages by event testCaseId', () => {
    expect(getAutomationEventTestCaseId(envelope)).toBe('tc-1');
    expect(isAutomationMessageForTestCase(envelope, 'tc-1')).toBe(true);
    expect(isAutomationMessageForTestCase(envelope, 'tc-2')).toBe(false);
  });

  it('maps network.request to network activity', () => {
    const log = adaptAutomationEventToLogEntry({
      ...envelope,
      event: { ...envelope.event, eventType: 'network.request', method: 'POST', url: 'https://example.test/api' },
    });

    expect(log.isNetwork).toBe(true);
    expect(log.network).toMatchObject({ event: 'Request', method: 'POST', url: 'https://example.test/api' });
  });

  it('maps console to console activity', () => {
    const log = adaptAutomationEventToLogEntry({
      ...envelope,
      event: { ...envelope.event, eventType: 'console' },
    });

    expect(log.isConsole).toBe(true);
    expect(log.isExecution).toBe(false);
  });

  it('maps step to execution activity', () => {
    expect(adaptAutomationEventToLogEntry(envelope).isExecution).toBe(true);
  });

  it('preserves run.started and run.finished event types', () => {
    const started = adaptAutomationEventToLogEntry({
      ...envelope,
      event: { ...envelope.event, eventType: 'run.started' },
    });
    const finished = adaptAutomationEventToLogEntry({
      ...envelope,
      event: { ...envelope.event, eventType: 'run.finished' },
    });

    expect(started.eventType).toBe('run.started');
    expect(finished.eventType).toBe('run.finished');
    expect(started.isExecution).toBe(true);
    expect(finished.isExecution).toBe(true);
  });

  it('does not crash on an unknown eventType', () => {
    const log = adaptAutomationEventToLogEntry({
      ...envelope,
      event: { ...envelope.event, eventType: 'custom.event' },
    });

    expect(log.eventType).toBe('custom.event');
    expect(log.isExecution).toBe(true);
  });

  it('preserves normalized event identity and capture metadata', () => {
    const log = adaptAutomationEventToLogEntry({
      ...envelope,
      event: { ...envelope.event, cdpAvailable: true, fallbackUsed: false },
    });

    expect(log.eventId).toBe('event-1');
    expect(log.runId).toBe('run-1');
    expect(log.mode).toBe('manual');
    expect(log.cdpAvailable).toBe(true);
    expect(log.fallbackUsed).toBe(false);
    expect(getAutomationEventRunId(envelope)).toBe('run-1');
  });

  it('creates a shared fingerprint for legacy and normalized dual broadcasts', () => {
    const legacy = adaptLegacyLogToLogEntry({
      type: 'log',
      source: 'manual-cdp',
      testCaseId: 'tc-1',
      log: 'Clicked submit',
      timestamp: '2026-06-04T00:00:00.100Z',
    });
    const normalized = adaptAutomationEventToLogEntry({
      ...envelope,
      event: {
        ...envelope.event,
        source: 'manual-cdp',
        eventType: 'log',
        message: 'Clicked submit',
        timestamp: '2026-06-04T00:00:00.200Z',
      },
    });

    const legacyKeys = getAutomationLogDedupKeys(legacy);
    const normalizedKeys = getAutomationLogDedupKeys(normalized);
    expect(normalizedKeys.some(key => legacyKeys.includes(key))).toBe(true);
  });
});
