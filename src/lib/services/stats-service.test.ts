import { describe, expect, it } from 'vitest';
import { buildReleaseReadiness } from './stats-service';

describe('buildReleaseReadiness', () => {
  it('marks a run not ready when failed, blocked, or critical bugs exist', () => {
    const result = buildReleaseReadiness([
      { id: 'run-1', name: 'Release', status: 'IN PROGRESS', testCases: [{ executions: [{ status: 'FAILED' }] }, { executions: [{ status: 'BLOCKED' }] }] },
    ], [{ id: 'bug-1', priority: 'Critical', status: 'REPORTED' }]);

    expect(result.recommendation).toBe('NOT READY');
    expect(result.failedCases).toBe(1);
    expect(result.blockedCases).toBe(1);
    expect(result.criticalBugs).toBe(1);
  });

  it('marks a fully executed run ready', () => {
    const result = buildReleaseReadiness([
      { id: 'run-1', name: 'Smoke', status: 'COMPLETED', testCases: [{ executions: [{ status: 'PASSED' }] }] },
    ], [{ id: 'bug-1', priority: 'High', status: 'VERIFIED & FIXED' }]);

    expect(result.recommendation).toBe('READY');
  });
});
