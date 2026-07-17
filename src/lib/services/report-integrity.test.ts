import { describe, expect, it } from 'vitest';
import { assertReportMetricsConsistent, executionOutcome } from './report-integrity';
import type { ReportMetrics } from './report-types';

describe('report execution source of truth', () => {
  it('maps execution statuses without reading inventory actualResult', () => {
    expect(executionOutcome('PASSED')).toEqual({ status: 'PASSED', executed: true, passed: true, failed: false });
    expect(executionOutcome('BLOCKED')).toEqual({ status: 'BLOCKED', executed: true, passed: false, failed: false });
    expect(executionOutcome()).toEqual({ status: 'NOT RUN', executed: false, passed: false, failed: false });
  });

  it('rejects a contradictory final snapshot', () => {
    const metrics = {
      totalPlanned: 2,
      totalExecuted: 1,
      totalPassed: 1,
      totalFailed: 1,
      totalPending: 1,
      byStatus: [{ status: 'PASSED', count: 1, percentage: 50 }, { status: 'NOT RUN', count: 1, percentage: 50 }],
    } as ReportMetrics;
    expect(() => assertReportMetricsConsistent(metrics)).toThrow('Snapshot report tidak konsisten');
  });
});
