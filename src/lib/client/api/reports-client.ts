import type { ReportData } from '@/lib/services/report-types';

export type ReportAction = 'refresh' | 'finalize' | 'versions';

export async function fetchReports(projectId: string): Promise<ReportData[]> {
  const res = await fetch(`/api/reports?projectId=${encodeURIComponent(projectId)}`);
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
  const res = await fetch(`/api/reports/${reportId}/${action}`, { method: 'POST' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Aksi report gagal dijalankan');
  return data.report;
}
