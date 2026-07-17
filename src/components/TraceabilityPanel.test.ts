import { describe, expect, it } from 'vitest';
import { coverageState } from '@/components/TraceabilityPanel';

const base = { id: 'req-1', key: 'REQ-1', title: 'Requirement', status: 'DRAFT', priority: 'High' };

describe('traceability coverage', () => {
  it('classifies covered, partial, and uncovered requirements', () => {
    expect(coverageState({ ...base, _count: { testCases: 1, testPlans: 1 } })).toBe('covered');
    expect(coverageState({ ...base, _count: { testCases: 1, testPlans: 0 } })).toBe('partial');
    expect(coverageState({ ...base, _count: { testCases: 0, testPlans: 0 } })).toBe('uncovered');
  });
});
