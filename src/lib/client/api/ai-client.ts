import type { RefinedTestCasePreview } from '@/components/AIRefineDialog';
import type { TestCase } from '@/lib/client/api/types';

export interface GeneratedTestCasePreview {
  testCaseId: string;
  page: string;
  subMenu: string;
  weight: string;
  testType: string;
  testAction: string;
  steps: string;
  expectedResult: string;
  priority: string;
  moduleId: string | null;
}

async function withTimeout<T>(timeoutMs: number, request: (signal: AbortSignal) => Promise<T>) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await request(controller.signal);
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function generateAiTestCases(input: {
  projectId: string;
  userPrompt: string;
  moduleFilter: string;
  count: number;
}) {
  return withTimeout(90000, async (signal) => {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal,
    });
    const data = await res.json();
    return { ok: res.ok, data: data as { error?: string; generated?: GeneratedTestCasePreview[] } };
  });
}

export async function refineAiTestCase(input: { mode: string; testCase: TestCase }) {
  return withTimeout(90000, async (signal) => {
    const response = await fetch('/api/ai/refine', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...input, projectId: input.testCase.projectId }),
      signal,
    });
    const data = await response.json();
    return { ok: response.ok, data: data as { error?: string; refined: RefinedTestCasePreview } };
  });
}
