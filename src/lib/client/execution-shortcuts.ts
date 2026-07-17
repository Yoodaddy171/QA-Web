import { TEST_EXECUTION_STATUS } from '@/lib/domain/test-run';

export const EXECUTION_SHORTCUTS = {
  p: TEST_EXECUTION_STATUS.PASSED,
  f: TEST_EXECUTION_STATUS.FAILED,
  b: TEST_EXECUTION_STATUS.BLOCKED,
  r: TEST_EXECUTION_STATUS.RETEST,
} as const;

export function resolveExecutionShortcut(key: string, targetTag?: string | null) {
  if (targetTag && ['INPUT', 'TEXTAREA', 'SELECT'].includes(targetTag.toUpperCase())) return null;
  const normalized = key.toLowerCase();
  if (normalized === 'n') return { type: 'next' as const };
  const status = EXECUTION_SHORTCUTS[normalized as keyof typeof EXECUTION_SHORTCUTS];
  return status ? { type: 'execute' as const, status } : null;
}
