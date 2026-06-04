import { TESTCASE_STATUS } from '@/lib/domain/testcase';

export function getProgressFromStatus(status: string): number {
  switch (status) {
    case TESTCASE_STATUS.DONE: return 100;
    case TESTCASE_STATUS.IN_PROGRESS: return 50;
    case TESTCASE_STATUS.BLOCKED: return 0;
    case TESTCASE_STATUS.NOT_DONE: return 0;
    case TESTCASE_STATUS.FAILED: return 0;
    case TESTCASE_STATUS.READY_TO_RETEST: return 50;
    case TESTCASE_STATUS.TBA: return 0;
    default: return 0;
  }
}

export function getStatusProgressFactor(status: string): number {
  switch (status) {
    case TESTCASE_STATUS.DONE: return 1;
    case TESTCASE_STATUS.IN_PROGRESS: return 0.5;
    case TESTCASE_STATUS.READY_TO_RETEST: return 0.5;
    case TESTCASE_STATUS.TBA: return 0;
    case TESTCASE_STATUS.BLOCKED: return 0;
    case TESTCASE_STATUS.NOT_DONE: return 0;
    case TESTCASE_STATUS.FAILED: return 0;
    default: return 0;
  }
}
