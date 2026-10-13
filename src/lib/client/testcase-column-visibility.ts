export type TestCaseColumnKey = 'subMenu' | 'weight' | 'type' | 'priority' | 'action' | 'status' | 'result' | 'record' | 'progress';
const minimumBucket: Record<TestCaseColumnKey, number> = {
  subMenu: 2, weight: 4, type: 2, priority: 1, action: 1, status: 0, result: 3, record: 4, progress: 4,
};
export function tableViewportBucket(width: number) {
  return width >= 1536 ? 4 : width >= 1280 ? 3 : width >= 1024 ? 2 : width >= 768 ? 1 : 0;
}
export function mountedTestCaseColumns(preferences: Record<TestCaseColumnKey, boolean>, bucket: number) {
  return Object.fromEntries(Object.entries(preferences).map(([key, enabled]) => [key, enabled && bucket >= minimumBucket[key as TestCaseColumnKey]])) as Record<TestCaseColumnKey, boolean>;
}
