import { describe, expect, it } from 'vitest';
import {
  getExecutionInteraction,
  getExecutionLogText,
  isExecutionLog,
  type LogEntry,
} from './TestCaseDetailDialog.helpers';

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
