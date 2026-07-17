import type { ReportMetrics } from './report-types';

export function executionOutcome(status?: string | null) {
  const normalized = status || 'NOT RUN';
  return {
    status: normalized,
    executed: !['NOT RUN', 'IN PROGRESS'].includes(normalized),
    passed: ['PASSED', 'VERIFIED'].includes(normalized),
    failed: normalized === 'FAILED',
  };
}
export function assertReportMetricsConsistent(metrics: ReportMetrics) {
  const statusTotal = metrics.byStatus.reduce((total, item) => total + item.count, 0);
  const invalid = metrics.totalPlanned < 0
    || metrics.totalExecuted < 0
    || metrics.totalExecuted > metrics.totalPlanned
    || metrics.totalPassed < 0
    || metrics.totalFailed < 0
    || metrics.totalPassed + metrics.totalFailed > metrics.totalExecuted
    || metrics.totalPending !== metrics.totalPlanned - metrics.totalExecuted
    || statusTotal !== metrics.totalPlanned;
  if (invalid) throw new Error('Snapshot report tidak konsisten. Refresh snapshot sebelum finalisasi.');
}
