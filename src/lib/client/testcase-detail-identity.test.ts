import { describe, expect, it } from 'vitest';
import { detailTab, detailTestCaseId, isBugDetail } from './testcase-detail-identity';

describe('FUNC-INSPECTOR: bug and testcase identities', () => {
  it('binds related tabs to the source without changing bug identity', () => {
    const bug = { id: 'bug-1', sourceTestCaseId: 'case-1', detailSource: 'bugfix' };
    expect(detailTestCaseId(bug)).toBe('case-1');
    expect(bug.id).toBe('bug-1');
    expect(isBugDetail(bug)).toBe(true);
  });
  it('keeps a normal testcase identity and supports legacy bug details', () => {
    expect(detailTestCaseId({ id: 'case-1' })).toBe('case-1');
    expect(detailTestCaseId({ id: 'bug-1', sourceTestCaseId: 'case-1', reportedAt: '2026-11-03' })).toBe('case-1');
    expect(isBugDetail({ id: 'bug-1', sourceTestCaseId: 'case-1', reportedAt: '2026-11-03' })).toBe(true);
    expect(detailTestCaseId(null)).toBe('');
  });
  it('leaves Lifecycle on bug details but falls back to Overview for Cases', () => {
    expect(detailTab('lifecycle', true)).toBe('lifecycle');
    expect(detailTab('lifecycle', false)).toBe('details');
    expect(detailTab('execution', false)).toBe('execution');
  });
});
