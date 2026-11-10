import type { ReportData, ReportSummary } from '@/lib/services/report-types';
import { normalizeReportFilters, type ReportFilters } from '@/lib/domain/report-filters';

export type ReportAction = 'refresh' | 'finalize' | 'versions';

export interface ReportPage {
  reports: ReportSummary[];
  hasMore: boolean;
  nextCursor: string | null;
  total: number;
  matchedTotal: number;
}

export async function fetchReportPage(projectId: string, cursor?: string, signal?: AbortSignal, filters?: Partial<ReportFilters>): Promise<ReportPage> {
  const query = new URLSearchParams({ projectId, limit: '25', view: 'summary' });
  if (cursor) query.set('cursor', cursor);
  const normalized = normalizeReportFilters(filters);
  if (normalized.search) query.set('search', normalized.search);
  if (normalized.status !== 'ALL') query.set('status', normalized.status);
  if (normalized.type !== 'ALL') query.set('type', normalized.type);
  const response = await fetch(`/api/reports?${query}`, { signal });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Daftar report gagal dimuat.');
  return data;
}
export async function fetchReportDetail(projectId: string, id: string, signal?: AbortSignal): Promise<ReportData> {
  const response = await fetch(`/api/reports/${encodeURIComponent(id)}?projectId=${encodeURIComponent(projectId)}`, { signal });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Detail report gagal dimuat.');
  return data.report;
}

export async function fetchReports(projectId: string): Promise<ReportData[]> {
  const res = await fetch(`/api/reports?projectId=${encodeURIComponent(projectId)}&limit=100`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Report gagal dimuat');
  return data.reports || [];
}

export async function saveReport(payload: Record<string, unknown>, reportId?: string): Promise<ReportData> {
  const res = await fetch(reportId ? `/api/reports/${reportId}` : '/api/reports', {
    method: reportId ? 'PATCH' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Report gagal disimpan');
  return data.report;
}

export async function runReportAction(reportId: string, action: ReportAction): Promise<ReportData> {
  const res = await fetch(`/api/reports/${reportId}/${action}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Aksi report gagal dijalankan');
  return data.report;
}
