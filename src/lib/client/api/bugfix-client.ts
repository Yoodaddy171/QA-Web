import type { BugFixItem } from '@/components/BugFixPanel';

export type BugFixQueryOptions = {
  projectId: string;
  search?: string;
  status?: string;
  limit?: number;
  page?: number;
  moduleId?: string;
  tab?: 'active' | 'resolved';
};

export async function fetchBugFixes(options: BugFixQueryOptions, signal?: AbortSignal): Promise<{ bugFixItems?: BugFixItem[]; total?: number; totalPages?: number }> {
  const params = new URLSearchParams({
    projectId: options.projectId,
    limit: String(options.limit ?? 100),
  });
  if (options.search) params.set('search', options.search);
  if (options.status) params.set('status', options.status);
  if (options.page) params.set('page', String(options.page));
  if (options.moduleId && options.moduleId !== 'all') params.set('moduleId', options.moduleId);
  if (options.tab) params.set('tab', options.tab);

  const res = await fetch(`/api/bugfix?${params}`, { signal });
  if (!res.ok) throw new Error('Bug fix data gagal dimuat');
  return res.json();
}

export async function updateBugFix(input: { id: string; status: string }): Promise<BugFixItem> {
  const response = await fetch('/api/bugfix', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const updatedItem = await response.json();
  if (!response.ok) {
    throw new Error(updatedItem?.error || 'Status bug fix tidak dapat diubah');
  }
  return updatedItem;
}

export async function deleteBugFix(id: string) {
  const response = await fetch(`/api/bugfix?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Bug fix gagal dihapus');
  return data;
}
