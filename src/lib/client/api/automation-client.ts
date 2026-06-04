import type { AutomatedTestCase } from '@/components/AutomatedPanel';

export async function fetchAutomationHistory(projectId: string): Promise<{ items?: AutomatedTestCase[] }> {
  const res = await fetch(`/api/automation/history?projectId=${projectId}`);
  return res.json();
}
