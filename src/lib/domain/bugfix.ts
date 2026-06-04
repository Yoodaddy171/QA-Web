export const BUGFIX_STATUS = {
  REPORTED: 'SUDAH DILAPORKAN',
  FIXING: 'SEDANG DI FIX',
  READY_TO_RETEST: 'READY TO RETEST',
  VERIFIED_FIXED: 'VERIFIED & FIXED',
} as const;

export const BUGFIX_STATUSES = [
  BUGFIX_STATUS.REPORTED,
  BUGFIX_STATUS.FIXING,
  BUGFIX_STATUS.READY_TO_RETEST,
  BUGFIX_STATUS.VERIFIED_FIXED,
] as const;

export const EDITABLE_BUGFIX_STATUSES = [
  BUGFIX_STATUS.REPORTED,
  BUGFIX_STATUS.FIXING,
  BUGFIX_STATUS.READY_TO_RETEST,
] as const;

export type BugFixStatus = typeof BUGFIX_STATUSES[number];

export const BUGFIX_STATUS_SET = new Set<string>(BUGFIX_STATUSES);
export const EDITABLE_BUGFIX_STATUS_SET = new Set<string>(EDITABLE_BUGFIX_STATUSES);

export function isBugFixStatus(value: unknown): value is BugFixStatus {
  return typeof value === 'string' && BUGFIX_STATUS_SET.has(value);
}

export function isEditableBugFixStatus(value: unknown): value is typeof EDITABLE_BUGFIX_STATUSES[number] {
  return typeof value === 'string' && EDITABLE_BUGFIX_STATUS_SET.has(value);
}
