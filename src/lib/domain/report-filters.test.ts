import { describe, expect, it } from 'vitest';
import { DEFAULT_REPORT_FILTERS, normalizeReportFilters, normalizeSearch } from './report-filters';

describe('REPORT-SEARCH-SPACES', () => {
  it.each([' IAPAYS ', '\tIAPAYS\n', 'iapays'])('normalizes pasted search %j', (query) => {
    expect(normalizeSearch(query)).toBe('iapays');
  });
  it('normalizes blank filters without mutating defaults', () => {
    expect(normalizeReportFilters({ search: '  ' })).toEqual(DEFAULT_REPORT_FILTERS);
    expect(normalizeReportFilters({ search: ' V1.0 ', status: 'FINAL' })).toEqual({ search: 'v1.0', status: 'FINAL', type: 'ALL' });
  });
});
