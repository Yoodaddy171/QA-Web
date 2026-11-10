import type { AutomatedTestCase } from '@/components/AutomatedPanel';

export type AutomationHistoryResponse = {
  items: AutomatedTestCase[]; total: number; totalPages: number; page: number; limit: number;
  summary: { total: number; manual: number; lastRunAt: string | null }; moduleIds: string[];
  records: Record<string, { hasAutomationRun: boolean; hasManualCapture: boolean; lastRunAt: string | null }>;
};
export async function fetchAutomationHistory(projectId: string, options: { page?: number; search?: string; moduleId?: string; signal?: AbortSignal; view?: 'records' } = {}): Promise<AutomationHistoryResponse> {
  const params = new URLSearchParams({ projectId, page: String(options.page || 1), limit: '25', search: options.search || '', moduleId: options.moduleId || 'all' });
  if (options.view) params.set('view', options.view);
  const res = await fetch(`/api/automation/history?${params}`, { cache: 'no-store', signal: options.signal });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Gagal memuat automation log. Coba sinkronkan kembali.');
  return data;
}
