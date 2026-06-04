import type { BugFixItem } from '@/components/BugFixPanel';

export type BugFixQueryOptions = {
  projectId: string;
  search?: string;
  status?: string;
  limit?: number;
};

export async function fetchBugFixes(options: BugFixQueryOptions): Promise<{ bugFixItems?: BugFixItem[] }> {
  const params = new URLSearchParams({
    projectId: options.projectId,
    limit: String(options.limit ?? 100),
  });
  if (options.search) params.set('search', options.search);
  if (options.status) params.set('status', options.status);

  const res = await fetch(`/api/bugfix?${params}`);
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
