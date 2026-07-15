import { describe, expect, it } from 'vitest';
import { parseTestCaseId, resequenceTestCaseIds } from './testcase-id';

describe('testcase id resequencing', () => {
  it('parses prefixes containing multiple hyphens', () => {
    expect(parseTestCaseId('API-AUTH-003')).toEqual({ prefix: 'API-AUTH', number: 3, width: 3 });
  });

  it('closes numeric gaps while preserving UUIDs', () => {
    const updates = resequenceTestCaseIds([
      { id: 'uuid-1', testCaseId: 'API-AUTH-001' },
      { id: 'uuid-3', testCaseId: 'API-AUTH-003' },
      { id: 'uuid-4', testCaseId: 'API-AUTH-004' },
    ]);

    expect(updates).toEqual([
      { id: 'uuid-3', oldTestCaseId: 'API-AUTH-003', newTestCaseId: 'API-AUTH-002' },
      { id: 'uuid-4', oldTestCaseId: 'API-AUTH-004', newTestCaseId: 'API-AUTH-003' },
    ]);
  });

  it('restarts numbering independently for each prefix', () => {
    const updates = resequenceTestCaseIds([
      { id: 'a-1', testCaseId: 'API-AUTH-003' },
      { id: 'b-1', testCaseId: 'WEB-002' },
    ]);

    expect(updates).toEqual([
      { id: 'a-1', oldTestCaseId: 'API-AUTH-003', newTestCaseId: 'API-AUTH-001' },
      { id: 'b-1', oldTestCaseId: 'WEB-002', newTestCaseId: 'WEB-001' },
    ]);
  });
});
