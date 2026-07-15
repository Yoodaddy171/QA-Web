import type { Stats, TestCase } from '@/lib/client/api/types';

export type TestCaseQueryOptions = {
  searchVal?: string;
  statusVal?: string;
  typeVal?: string;
  prioVal?: string;
  modVal?: string;
  subMenuVal?: string;
  testRunVal?: string;
  bugVal?: string;
  tagVal?: string;
  createdFromVal?: string;
  createdToVal?: string;
  pageVal?: number;
  sortVal?: string;
  orderVal?: string;
};

export async function fetchTestCases(params: URLSearchParams, signal?: AbortSignal): Promise<{
  testCases?: TestCase[];
  total?: number;
  totalPages?: number;
}> {
  const res = await fetch(`/api/testcases?${params}`, { signal });
  return res.json();
}

export async function fetchStats(projectId: string): Promise<Stats> {
  const res = await fetch(`/api/stats?projectId=${projectId}`);
  return res.json();
}

export async function updateTestCase(input: Record<string, unknown>) {
  const res = await fetch('/api/testcases', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Failed to update status');
  return data;
}

export async function bulkUpdateTestCaseStatus(ids: string[], status: string) {
  const res = await fetch('/api/testcases', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids, status }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Bulk update gagal');
  return data as { updated: number };
}

export async function deleteTestCase(id: string) {
  const res = await fetch(`/api/testcases?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Test case gagal dihapus');
  return data;
}

export async function deleteTestCases(ids: string[]) {
  const res = await fetch(`/api/testcases?ids=${encodeURIComponent(ids.join(','))}`, { method: 'DELETE' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Bulk delete gagal');
  return data;
}

export async function createTestCase(input: Record<string, unknown>) {
  const response = await fetch('/api/testcases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Test case gagal diduplikasi');
  return data;
}

export async function fetchNextTestCaseId(input: { projectId: string; moduleId: string }) {
  const params = new URLSearchParams(input);
  const response = await fetch(`/api/testcases/next-id?${params}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return null;
  return data as { suggestedTestCaseId?: string };
}
