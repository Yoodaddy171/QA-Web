import { useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { AutomatedTestCase } from '@/components/AutomatedPanel';
import { useToast } from '@/hooks/use-toast';
import { useAutomationLogs } from '@/hooks/useAutomationLogs';
import { fetchAutomationHistory } from '@/lib/client/api/automation-client';
import type { TestCase } from '@/lib/client/api/types';

export function useAutomationDevlog(input: {
  viewTestCase: TestCase | null;
  setViewTestCase: Dispatch<SetStateAction<TestCase | null>>;
}) {
  const { toast } = useToast();
  const [automatedItems, setAutomatedItems] = useState<AutomatedTestCase[]>([]);
  const [automatedSearch, setAutomatedSearch] = useState('');
  const [automatedFilterModule, setAutomatedFilterModule] = useState<string>('all');
  const [automatedLoading, setAutomatedLoading] = useState(false);
  const devlog = useAutomationLogs(input);

  const visibleAutomatedItems = useMemo(
    () => automatedItems.filter((item) => {
      if (automatedFilterModule !== 'all') {
        const moduleKey = item.moduleId || 'unassigned';
        if (moduleKey !== automatedFilterModule) return false;
      }

      const keyword = automatedSearch.trim().toLowerCase();
      if (!keyword) return true;
      return [
        item.testCaseId,
        item.page,
        item.subMenu || '',
        item.testAction,
        item.module?.name || '',
        item.status,
      ].some((value) => value.toLowerCase().includes(keyword));
    }),
    [automatedFilterModule, automatedItems, automatedSearch]
  );

  const testRecordById = useMemo(() => {
    return automatedItems.reduce<Record<string, {
      hasAutomationRun: boolean;
      hasManualCapture: boolean;
      lastRunAt: string | null;
    }>>((acc, item) => {
      if (item.automationSource !== 'testcase') return acc;
      acc[item.id] = {
        hasAutomationRun: item.automation.hasAutomationRun,
        hasManualCapture: item.automation.hasManualCapture,
        lastRunAt: item.automation.lastRunAt,
      };
      return acc;
    }, {});
  }, [automatedItems]);

  const loadAutomated = async (projId: string) => {
    if (!projId) return;
    setAutomatedLoading(true);
    try {
      const data = await fetchAutomationHistory(projId);
      setAutomatedItems(data.items || []);
    } catch {
      toast({ title: 'Error', description: 'Failed to load test records', variant: 'destructive' });
    } finally {
      setAutomatedLoading(false);
    }
  };

  return {
    ...devlog,
    automatedItems,
    automatedSearch,
    automatedFilterModule,
    automatedLoading,
    visibleAutomatedItems,
    testRecordById,
    setAutomatedSearch,
    setAutomatedFilterModule,
    loadAutomated,
  };
}
