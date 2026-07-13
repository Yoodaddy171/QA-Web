import { describe, expect, it } from 'vitest';
import { BUGFIX_STATUS, canTransitionBugFixStatus } from '@/lib/domain/bugfix';

describe('canTransitionBugFixStatus', () => {
  it('allows a single forward step', () => {
    expect(canTransitionBugFixStatus(BUGFIX_STATUS.REPORTED, BUGFIX_STATUS.FIXING)).toBe(true);
    expect(canTransitionBugFixStatus(BUGFIX_STATUS.FIXING, BUGFIX_STATUS.READY_TO_RETEST)).toBe(true);
    expect(canTransitionBugFixStatus(BUGFIX_STATUS.READY_TO_RETEST, BUGFIX_STATUS.VERIFIED_FIXED)).toBe(true);
  });

  it('allows a single backward step (bounce back)', () => {
    expect(canTransitionBugFixStatus(BUGFIX_STATUS.READY_TO_RETEST, BUGFIX_STATUS.FIXING)).toBe(true);
    expect(canTransitionBugFixStatus(BUGFIX_STATUS.FIXING, BUGFIX_STATUS.REPORTED)).toBe(true);
  });

  it('allows a no-op (same status)', () => {
    expect(canTransitionBugFixStatus(BUGFIX_STATUS.FIXING, BUGFIX_STATUS.FIXING)).toBe(true);
  });

  it('blocks skipping a stage forward', () => {
    expect(canTransitionBugFixStatus(BUGFIX_STATUS.REPORTED, BUGFIX_STATUS.READY_TO_RETEST)).toBe(false);
    expect(canTransitionBugFixStatus(BUGFIX_STATUS.REPORTED, BUGFIX_STATUS.VERIFIED_FIXED)).toBe(false);
  });

  it('blocks skipping a stage backward', () => {
    expect(canTransitionBugFixStatus(BUGFIX_STATUS.READY_TO_RETEST, BUGFIX_STATUS.REPORTED)).toBe(false);
    expect(canTransitionBugFixStatus(BUGFIX_STATUS.VERIFIED_FIXED, BUGFIX_STATUS.FIXING)).toBe(false);
  });

  it('rejects unknown statuses', () => {
    expect(canTransitionBugFixStatus('WHATEVER', BUGFIX_STATUS.FIXING)).toBe(false);
    expect(canTransitionBugFixStatus(BUGFIX_STATUS.FIXING, 'WHATEVER')).toBe(false);
  });
});
