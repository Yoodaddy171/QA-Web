import { expect, it } from 'vitest';
import { resolveTestCaseStatusTransition, TESTCASE_ACTUAL_RESULT as A, TESTCASE_STATUS as T } from './testcase';

it.each([
  [T.READY_TO_RETEST, A.NOT_AS_EXPECTED, T.DONE, undefined, T.DONE, A.AS_EXPECTED],
  [T.READY_TO_RETEST, A.NOT_AS_EXPECTED, T.FAILED, undefined, T.FAILED, A.NOT_AS_EXPECTED],
  [T.FAILED, A.NOT_AS_EXPECTED, undefined, A.AS_EXPECTED, T.DONE, A.AS_EXPECTED],
  [T.DONE, A.AS_EXPECTED, T.FAILED, A.NOT_AS_EXPECTED, T.FAILED, A.NOT_AS_EXPECTED],
  [T.NOT_DONE, null, T.IN_PROGRESS, undefined, T.IN_PROGRESS, null],
  [T.FAILED, A.NOT_AS_EXPECTED, T.READY_TO_RETEST, undefined, T.FAILED, A.NOT_AS_EXPECTED],
])('6A-LIFECYCLE: preserves existing transition %s -> %s', (currentStatus, currentActualResult, nextStatus, nextActualResult, status, actualResult) => {
  expect(resolveTestCaseStatusTransition({ currentStatus: currentStatus!, currentActualResult: currentActualResult ?? null, nextStatus, nextActualResult }))
    .toEqual({ finalStatus: status, finalActualResult: actualResult });
});
