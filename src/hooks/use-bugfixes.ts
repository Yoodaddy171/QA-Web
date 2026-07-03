import { useEffect, useMemo, useRef, useState } from 'react';
import type { BugFixItem } from '@/components/BugFixPanel';
import { useToast } from '@/hooks/use-toast';
import { fetchBugFixes, updateBugFix } from '@/lib/client/api/bugfix-client';
import type { Module, TestCase } from '@/lib/client/api/types';
import { BUGFIX_STATUS } from '@/lib/domain/bugfix';
import { getProgressFromStatus } from '@/lib/domain/progress';
import { TESTCASE_STATUS } from '@/lib/domain/testcase';

type BugFixTab = 'active' | 'resolved';

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedValue(value), delayMs);
    return () => window.clearTimeout(timeoutId);
  }, [value, delayMs]);

  return debouncedValue;
}

export function useBugFixes(
  selectedProject: string,
  modules: Module[],
  refreshRelatedData: () => void
) {
  const { toast } = useToast();
  const [bugFixItems, setBugFixItems] = useState<BugFixItem[]>([]);
  const [bugFixSearch, setBugFixSearch] = useState('');
  const [bugFixFilterStatus, setBugFixFilterStatus] = useState<string>('all');
  const [bugFixFilterModule, setBugFixFilterModule] = useState<string>('all');
  const [bugFixTab, setBugFixTab] = useState<BugFixTab>('active');
  const debouncedBugFixSearch = useDebouncedValue(bugFixSearch, 300);
  const selectedProjectRef = useRef(selectedProject);

  useEffect(() => {
    selectedProjectRef.current = selectedProject;
  }, [selectedProject]);

  const visibleBugFixItems = useMemo(
    () => bugFixItems.filter((bf) => {
      const tabMatches = bugFixTab === 'resolved'
        ? bf.status === BUGFIX_STATUS.VERIFIED_FIXED
        : bf.status !== BUGFIX_STATUS.VERIFIED_FIXED;
      if (!tabMatches) return false;
      if (bugFixFilterModule === 'all') return true;
      return (bf.moduleId || 'unassigned') === bugFixFilterModule;
    }),
    [bugFixFilterModule, bugFixItems, bugFixTab]
  );

  const bugFixFilterModules = useMemo(() => {
    const visibleModuleIds = new Set(bugFixItems
      .filter((item) => bugFixTab === 'resolved' ? item.status === BUGFIX_STATUS.VERIFIED_FIXED : item.status !== BUGFIX_STATUS.VERIFIED_FIXED)
      .map(item => item.moduleId)
      .filter((id): id is string => Boolean(id)));
    return modules.filter(module => visibleModuleIds.has(module.id) || module.id === bugFixFilterModule);
  }, [bugFixFilterModule, bugFixItems, bugFixTab, modules]);

  const hasUnassignedBugFixItems = useMemo(
    () => bugFixItems
      .filter((item) => bugFixTab === 'resolved' ? item.status === BUGFIX_STATUS.VERIFIED_FIXED : item.status !== BUGFIX_STATUS.VERIFIED_FIXED)
      .some(item => !item.moduleId),
    [bugFixItems, bugFixTab]
  );

  const loadBugFix = async (projId: string) => {
    if (!projId) return;
    try {
      const status = bugFixTab === 'resolved'
        ? BUGFIX_STATUS.VERIFIED_FIXED
        : bugFixFilterStatus !== 'all'
          ? bugFixFilterStatus
          : undefined;
      const data = await fetchBugFixes({
        projectId: projId,
        limit: 100,
        search: debouncedBugFixSearch || undefined,
        status,
      });
      setBugFixItems(data.bugFixItems || []);
    } catch {
      // Preserve existing silent bugfix fetch failure behavior.
    }
  };

  useEffect(() => {
    if (!selectedProjectRef.current) return;
    const timer = window.setTimeout(() => loadBugFix(selectedProjectRef.current), 0);
    return () => window.clearTimeout(timer);
  }, [debouncedBugFixSearch, bugFixFilterStatus, bugFixTab]);

  const handleBugFixStatusChange = async (bfId: string, newStatus: string) => {
    try {
      const updatedItem = await updateBugFix({ id: bfId, status: newStatus });
      setBugFixItems(prev => prev.map(item => item.id === bfId ? updatedItem : item));
      refreshRelatedData();
      toast({ variant: 'success', title: 'Berhasil', description: `Status bug fix diubah ke ${newStatus}` });
    } catch (error: any) {
      toast({
        title: 'Gagal mengubah status',
        description: error.message || 'Status bug fix tidak dapat diubah',
        variant: 'destructive',
      });
    }
  };

  const transformBugFixToDetail = (bugFix: BugFixItem) => ({
    ...bugFix,
    status: bugFix.status,
    progress: bugFix.status === BUGFIX_STATUS.VERIFIED_FIXED ? 100 : bugFix.status === BUGFIX_STATUS.READY_TO_RETEST ? getProgressFromStatus(TESTCASE_STATUS.READY_TO_RETEST) : 0,
    module: bugFix.module ? { name: bugFix.module.name } : null,
    detailSource: 'bugfix',
  }) as unknown as TestCase;

  return {
    bugFixItems,
    setBugFixItems,
    visibleBugFixItems,
    bugFixFilterModules,
    hasUnassignedBugFixItems,
    bugFixSearch,
    bugFixFilterStatus,
    bugFixFilterModule,
    bugFixTab,
    setBugFixSearch,
    setBugFixFilterStatus,
    setBugFixFilterModule,
    setBugFixTab,
    loadBugFix,
    handleBugFixStatusChange,
    transformBugFixToDetail,
  };
}
