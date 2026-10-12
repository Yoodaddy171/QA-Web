import { describe, expect, it } from 'vitest';
import { getStatusBadgeVariant, getStatusColor } from './workspace-formatters';
import { badgeVariants } from '@/components/ui/badge';

describe('execution status presentation', () => {
  it.each([
    ['DONE', 'passed'], ['NOT DONE', 'not-run'], ['IN PROGRESS', 'in-progress'],
    ['FAILED', 'failed'], ['BLOCKED', 'blocked'], ['READY TO RETEST', 'retest'],
  ])('%s uses the same semantic color in a selector and badge', (status, token) => {
    expect(getStatusColor(status)).toContain(`qa-status-${token}`);
    expect(badgeVariants({ variant: getStatusBadgeVariant(status) })).toContain(`qa-status-${token}`);
  });
  it('keeps verified bug styling distinct from testcase success', () => {
    expect(getStatusColor('VERIFIED & FIXED')).toContain('qa-bug-fixed');
    expect(getStatusColor('DONE')).toContain('qa-status-passed');
  });
});
