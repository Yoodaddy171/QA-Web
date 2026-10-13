import { describe, expect, it } from 'vitest';
import { mountedTestCaseColumns, tableViewportBucket, type TestCaseColumnKey } from './testcase-column-visibility';
const all = Object.fromEntries(['subMenu', 'weight', 'type', 'priority', 'action', 'status', 'result', 'record', 'progress'].map(key => [key, true])) as Record<TestCaseColumnKey, boolean>;
describe('responsive Cases mounting', () => {
  it.each([[320, 0], [360, 0], [390, 0], [768, 1], [1024, 2], [1280, 3], [1440, 3], [1536, 4]])('matches Tailwind breakpoints at %ipx', (width, bucket) => {
    expect(tableViewportBucket(width)).toBe(bucket);
    const visible = mountedTestCaseColumns(all, bucket);
    expect(visible.status).toBe(true);
    expect(visible.record).toBe(width >= 1536);
    expect(visible.type).toBe(width >= 1024);
  });
  it('never overrides a user-hidden column and restores allowed columns on resize', () => {
    const preferences = { ...all, status: false, record: false };
    expect(mountedTestCaseColumns(preferences, 4).status).toBe(false);
    expect(mountedTestCaseColumns(preferences, 4).record).toBe(false);
    expect(mountedTestCaseColumns(preferences, 0).priority).toBe(false);
    expect(mountedTestCaseColumns(preferences, 4).priority).toBe(true);
  });
});
