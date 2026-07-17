import { describe, expect, it } from 'vitest';
import { resolveExecutionShortcut } from '@/lib/client/execution-shortcuts';

describe('execution keyboard mapping', () => {
  it('maps outcome and next shortcuts', () => {
    expect(resolveExecutionShortcut('P')).toEqual({ type: 'execute', status: 'PASSED' });
    expect(resolveExecutionShortcut('f')).toEqual({ type: 'execute', status: 'FAILED' });
    expect(resolveExecutionShortcut('N')).toEqual({ type: 'next' });
  });

  it('ignores shortcuts while editing a field', () => {
    expect(resolveExecutionShortcut('p', 'INPUT')).toBeNull();
    expect(resolveExecutionShortcut('n', 'textarea')).toBeNull();
  });
});
