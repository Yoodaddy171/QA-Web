import { describe, expect, it } from 'vitest';
import { getStoredTableDensity } from '@/hooks/use-table-density';

describe('table density persistence', () => {
  it('restores compact and falls back safely', () => {
    expect(getStoredTableDensity({ getItem: () => 'compact' })).toBe('compact');
    expect(getStoredTableDensity({ getItem: () => 'unknown' })).toBe('comfortable');
    expect(getStoredTableDensity(null)).toBe('comfortable');
  });
});
