export const TEST_RUN_STATUS = {
  DRAFT: 'DRAFT',
  READY: 'READY',
  IN_PROGRESS: 'IN PROGRESS',
  COMPLETED: 'COMPLETED',
  ARCHIVED: 'ARCHIVED',
} as const;

export const TEST_RUN_STATUSES = Object.values(TEST_RUN_STATUS);
export type TestRunStatus = typeof TEST_RUN_STATUS[keyof typeof TEST_RUN_STATUS];

export const TEST_EXECUTION_STATUS = {
  NOT_RUN: 'NOT RUN',
  IN_PROGRESS: 'IN PROGRESS',
  PASSED: 'PASSED',
  FAILED: 'FAILED',
  BLOCKED: 'BLOCKED',
  RETEST: 'RETEST',
  VERIFIED: 'VERIFIED',
} as const;

export const TEST_EXECUTION_STATUSES = Object.values(TEST_EXECUTION_STATUS);
export type TestExecutionStatus = typeof TEST_EXECUTION_STATUS[keyof typeof TEST_EXECUTION_STATUS];

export function isTestRunStatus(value: unknown): value is TestRunStatus {
  return typeof value === 'string' && TEST_RUN_STATUSES.includes(value as TestRunStatus);
}

export function isTestExecutionStatus(value: unknown): value is TestExecutionStatus {
  return typeof value === 'string' && TEST_EXECUTION_STATUSES.includes(value as TestExecutionStatus);
}

export function getExecutionProgress(statuses: string[]) {
  if (statuses.length === 0) return { total: 0, completed: 0, percent: 0 };
  const completed = statuses.filter(status => status !== TEST_EXECUTION_STATUS.NOT_RUN && status !== TEST_EXECUTION_STATUS.IN_PROGRESS).length;
  return { total: statuses.length, completed, percent: Math.round((completed / statuses.length) * 100) };
}
