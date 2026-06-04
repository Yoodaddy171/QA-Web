export const TESTCASE_STATUS = {
  DONE: 'DONE',
  NOT_DONE: 'NOT DONE',
  IN_PROGRESS: 'IN PROGRESS',
  BLOCKED: 'BLOCKED',
  FAILED: 'FAILED',
  READY_TO_RETEST: 'READY TO RETEST',
  TBA: 'TBA',
} as const;

export const TESTCASE_STATUSES = [
  TESTCASE_STATUS.DONE,
  TESTCASE_STATUS.NOT_DONE,
  TESTCASE_STATUS.IN_PROGRESS,
  TESTCASE_STATUS.BLOCKED,
  TESTCASE_STATUS.FAILED,
  TESTCASE_STATUS.READY_TO_RETEST,
  TESTCASE_STATUS.TBA,
] as const;

export type TestCaseStatus = typeof TESTCASE_STATUSES[number];

export const TEST_TYPES = ['Positive', 'Negative'] as const;
export type TestType = typeof TEST_TYPES[number];

export const TESTCASE_PRIORITIES = ['Low', 'Medium', 'High', 'Critical'] as const;
export type TestCasePriority = typeof TESTCASE_PRIORITIES[number];
export const HIGH_TESTCASE_PRIORITIES: readonly string[] = ['High', 'Critical'];

export const TESTCASE_ACTUAL_RESULT = {
  AS_EXPECTED: 'As Expected',
  NOT_AS_EXPECTED: 'Not As Expected',
} as const;

export type TestCaseActualResult = typeof TESTCASE_ACTUAL_RESULT[keyof typeof TESTCASE_ACTUAL_RESULT];

export const TESTCASE_STATUS_SET = new Set<string>(TESTCASE_STATUSES);
export const TEST_TYPE_SET = new Set<string>(TEST_TYPES);
export const TESTCASE_PRIORITY_SET = new Set<string>(TESTCASE_PRIORITIES);

export function isTestCaseStatus(value: unknown): value is TestCaseStatus {
  return typeof value === 'string' && TESTCASE_STATUS_SET.has(value);
}

export function isTestType(value: unknown): value is TestType {
  return typeof value === 'string' && TEST_TYPE_SET.has(value);
}

export function isTestCasePriority(value: unknown): value is TestCasePriority {
  return typeof value === 'string' && TESTCASE_PRIORITY_SET.has(value);
}

export function resolveTestCaseStatusTransition(input: {
  currentStatus: string;
  currentActualResult: string | null;
  nextStatus?: unknown;
  nextActualResult?: unknown;
}) {
  let finalStatus = typeof input.nextStatus === 'string' ? input.nextStatus : input.currentStatus;
  let finalActualResult = typeof input.nextActualResult === 'string' || input.nextActualResult === null
    ? input.nextActualResult
    : input.currentActualResult;

  if (finalStatus === TESTCASE_STATUS.DONE) {
    finalActualResult = TESTCASE_ACTUAL_RESULT.AS_EXPECTED;
  }

  if (finalActualResult === TESTCASE_ACTUAL_RESULT.NOT_AS_EXPECTED) {
    finalStatus = TESTCASE_STATUS.FAILED;
  } else if (
    finalActualResult === TESTCASE_ACTUAL_RESULT.AS_EXPECTED
    && (input.currentStatus === TESTCASE_STATUS.FAILED || finalStatus === TESTCASE_STATUS.DONE)
  ) {
    finalStatus = TESTCASE_STATUS.DONE;
  }

  return { finalStatus, finalActualResult };
}
