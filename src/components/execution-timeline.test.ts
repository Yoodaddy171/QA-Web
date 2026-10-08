import { executionTimeline, executionTime } from './execution-timeline';
import { describe, it, expect } from 'vitest';
import type { LogEntry } from './TestCaseDetailDialog.helpers';
const event = (type: string, ms: number, target = 'Email', value = ''): LogEntry => ({
  source: 'manual-cdp', runId: 'one', relativeMs: ms, eventType: 'step',
  metadata: { interaction: { type, target, value, message: value } },
});
describe('manual execution timeline', () => {
  it('merges consecutive typing, preserves originals, and exposes every raw event', () => {
    const logs = [event('input', 100, 'Email', 'a'), event('input', 500, 'Email', 'ab'), event('click', 700)];
    const before = JSON.stringify(logs), result = executionTimeline(logs);
    expect(result.rows).toHaveLength(2); expect(result.rows[0].count).toBe(2);
    expect(result.rows[0].log).toBe(logs[1]); expect(JSON.stringify(logs)).toBe(before);
    expect(executionTimeline(logs, [], true).rows).toHaveLength(3);
  });
  it('does not merge across field, run, pause, or intervening action', () => {
    for (const next of [event('input', 11000), event('input', 400, 'Name'), { ...event('input', 400), runId: 'two' }, { ...event('input', 400), source: 'katalon' }]) {
      expect(executionTimeline([event('input', 100), next]).rows).toHaveLength(2);
    }
    expect(executionTimeline([event('input', 100), event('click', 200), event('input', 300)]).rows).toHaveLength(3);
  });
  it('hides only blank manual navigation and restores it in raw view', () => {
    const logs = [event('navigation', 0, 'blank'), event('navigation', 1, '/home'), { ...event('navigation', 2, 'blank'), source: 'katalon' }];
    expect(executionTimeline(logs).hidden).toBe(1); expect(executionTimeline(logs, [], true).rows).toHaveLength(3);
  });
  it('derives timestamps per run and flags events after stop', () => {
    const logs: LogEntry[] = [
      { runId: 'one', eventType: 'run.started', timestamp: '2026-09-19T00:00:00Z' },
      { ...event('click', 0), relativeMs: undefined, timestamp: '2026-09-19T00:00:02Z' },
      { runId: 'one', eventType: 'run.finished', relativeMs: 3000 }, event('click', 4000),
      { runId: 'two', timestamp: '2026-09-19T00:00:05Z' },
    ];
    const rows = executionTimeline(logs).rows;
    expect(rows[1].log.relativeMs).toBe(2000); expect(rows[1].derivedTime).toBe(true);
    expect(rows[3].late).toBe(true); expect(rows[4].log.relativeMs).toBeUndefined();
  });
  it('matches nearby network only within the same run and never changes verdict', () => {
    const net = (ms: number, runId = 'one'): LogEntry => ({ runId, relativeMs: ms, network: { url: '/test', method: 'POST' } });
    const rows = executionTimeline([event('click', 1000), event('click', 2000)], [net(1200), net(2100), net(9999), net(2100, 'two')]).rows;
    expect(rows.map(row => row.network.length)).toEqual([1, 1]);
    expect(rows.every(row => !('verdict' in row))).toBe(true);
    expect(executionTime(undefined)).toBe('Waktu tidak tersedia'); expect(executionTime(0)).toBe('0:00');
  });
});
