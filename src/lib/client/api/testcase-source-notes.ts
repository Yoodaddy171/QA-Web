export async function fetchSourceTestCaseNotes(projectId: string, testCaseId: string, signal?: AbortSignal): Promise<string | null> {
  const params = new URLSearchParams({ projectId, search: testCaseId, limit: '1' });
  const response = await fetch(`/api/testcases?${params}`, { signal, cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Catatan testcase asal gagal dimuat.');
  const source = data.testCases?.find((item: { id: string; projectId: string }) => item.id === testCaseId && item.projectId === projectId);
  if (!source) throw new Error('Testcase asal tidak ditemukan dalam project ini.');
  return typeof source.remarks === 'string' ? source.remarks : null;
}
