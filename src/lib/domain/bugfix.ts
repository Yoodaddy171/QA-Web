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

// Ordered lifecycle. Status may only move one step at a time (forward or
// backward) — skipping a stage is not allowed. VERIFIED_FIXED is the final
// stage and is reached from the Test Case page, not the Bugs menu.
export const BUGFIX_STATUS_ORDER: readonly BugFixStatus[] = [
  BUGFIX_STATUS.REPORTED,
  BUGFIX_STATUS.FIXING,
  BUGFIX_STATUS.READY_TO_RETEST,
  BUGFIX_STATUS.VERIFIED_FIXED,
];

export function bugFixStatusIndex(status: string): number {
  return BUGFIX_STATUS_ORDER.indexOf(status as BugFixStatus);
}

/**
 * Whether a bug fix may move from `from` to `to`: same status (no-op) or a
 * single adjacent step in either direction. Skipping stages returns false.
 */
export function canTransitionBugFixStatus(from: string, to: string): boolean {
  const fromIndex = bugFixStatusIndex(from);
  const toIndex = bugFixStatusIndex(to);
  if (fromIndex === -1 || toIndex === -1) return false;
  return Math.abs(toIndex - fromIndex) <= 1;
}
