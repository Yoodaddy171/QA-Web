import { describe, expect, it } from 'vitest';
import { getExecutionProgress, isTestExecutionStatus, isTestRunStatus, TEST_EXECUTION_STATUS, TEST_RUN_STATUS } from './test-run';

describe('test run domain', () => {
  it('validates supported run and execution statuses', () => {
    expect(isTestRunStatus(TEST_RUN_STATUS.IN_PROGRESS)).toBe(true);
    expect(isTestRunStatus('INVALID')).toBe(false);
    expect(isTestExecutionStatus(TEST_EXECUTION_STATUS.FAILED)).toBe(true);
    expect(isTestExecutionStatus('INVALID')).toBe(false);
  });

  it('calculates execution progress from case statuses', () => {
    expect(getExecutionProgress([
      TEST_EXECUTION_STATUS.PASSED,
      TEST_EXECUTION_STATUS.FAILED,
      TEST_EXECUTION_STATUS.NOT_RUN,
      TEST_EXECUTION_STATUS.IN_PROGRESS,
    ])).toEqual({ total: 4, completed: 2, percent: 50 });
  });
});
