import type { ReportStatus, ReportType } from '@/lib/services/report-types';

export interface ReportFilters {
  search: string;
  status: ReportStatus | 'ALL';
  type: ReportType | 'ALL';
}

export const DEFAULT_REPORT_FILTERS: ReportFilters = { search: '', status: 'ALL', type: 'ALL' };

export function normalizeSearch(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizeReportFilters(filters: Partial<ReportFilters> = {}): ReportFilters {
  return {
    search: normalizeSearch(filters.search || ''),
    status: filters.status || 'ALL',
    type: filters.type || 'ALL',
  };
}
