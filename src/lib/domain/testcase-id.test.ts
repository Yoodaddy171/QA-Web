import { describe, expect, it } from 'vitest';
import { parseTestCaseId } from './testcase-id';

describe('immutable testcase display id parsing', () => {
  it('parses prefixes containing multiple hyphens', () => {
    expect(parseTestCaseId('API-AUTH-003')).toEqual({ prefix: 'API-AUTH', number: 3, width: 3 });
  });

  it('keeps gaps as valid immutable business identifiers', () => {
    expect(['API-AUTH-001', 'API-AUTH-003'].map(parseTestCaseId)).toEqual([
      { prefix: 'API-AUTH', number: 1, width: 3 },
      { prefix: 'API-AUTH', number: 3, width: 3 },
    ]);
  });
});
