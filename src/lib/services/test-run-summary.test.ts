import { describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/db', () => ({ db: {} }));
import { summarizeStatusCounts } from './test-run-service';
describe('aggregated run status counts', () => {
  it('preserves completion and pass semantics without expanding individual cases', () => {
    expect(summarizeStatusCounts([{ status: 'NOT RUN', count: 100000 }, { status: 'IN PROGRESS', count: 2 }, { status: 'PASSED', count: 5 }, { status: 'VERIFIED', count: 3 }, { status: 'FAILED', count: 4 }, { status: 'BLOCKED', count: 1 }])).toEqual({ total: 100015, completed: 13, passed: 8, failed: 4, blocked: 1, notRun: 100000 });
  });
});
