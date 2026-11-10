import { describe, expect, it } from 'vitest';
import {
  dedupeNetworkLogs,
  getExecutionInteraction,
  getExecutionLogText,
  isExecutionLog,
  type LogEntry,
} from './TestCaseDetailDialog.helpers';

describe('Network request rows', () => {
  const request = (id: string, requestId?: string): LogEntry => ({
    id,
    sessionId: 'capture',
    eventType: 'network.request',
    network: { event: 'Request', method: 'POST', url: 'https://example.test/orders', data: { requestId } },
  });
  const response = (id: string, status: number, requestId?: string): LogEntry => ({
    ...request(id, requestId),
    eventType: 'network.response',
    network: { ...request(id, requestId).network!, event: 'Response', status },
  });

  it('replaces only the matching request even when two identical URLs complete out of order', () => {
    expect(dedupeNetworkLogs([
      request('start-a', 'a'), request('start-b', 'b'), request('start-c', 'c'),
      response('end-b', 422, 'b'), response('end-a', 200, 'a'),
    ]).map(log => log.id)).toEqual(['end-a', 'end-b', 'start-c']);
  });

  it('does not hide all pending requests for a legacy URL when only one response was captured', () => {
    expect(dedupeNetworkLogs([
      request('start-a'), request('start-b'), response('end-a', 200),
    ]).map(log => log.id)).toEqual(['end-a', 'start-b']);
  });
});

describe('execution log helpers', () => {
  it('reads structured manual interaction metadata', () => {
    const log: LogEntry = {
      eventType: 'step',
      log: 'Menekan tombol "Masuk"',
      metadata: {
        interaction: {
          type: 'click',
          message: 'Menekan tombol "Masuk"',
          target: 'Masuk',
        },
      },
    };

    expect(getExecutionInteraction(log)).toMatchObject({ type: 'click', target: 'Masuk' });
    expect(getExecutionLogText(log)).toBe('Menekan tombol "Masuk"');
    expect(isExecutionLog(log)).toBe(true);
  });

  it('supports interaction metadata adapted from legacy relay logs', () => {
    const log: LogEntry = {
      isExecution: true,
      log: 'Memilih "Done" untuk field "Status"',
      metadata: {
        legacy: {
          interaction: {
            type: 'select',
            value: 'Done',
          },
        },
      },
    };

    expect(getExecutionInteraction(log)?.type).toBe('select');
    expect(getExecutionLogText(log)).toContain('Status');
  });

  it('does not classify console and network telemetry as execution', () => {
    expect(isExecutionLog({ eventType: 'console', isConsole: true })).toBe(false);
    expect(isExecutionLog({ eventType: 'network.response', isNetwork: true })).toBe(false);
  });
});
