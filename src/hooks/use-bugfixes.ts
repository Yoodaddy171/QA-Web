import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { BugFixItem } from '@/components/BugFixPanel';
import { useToast } from '@/hooks/use-toast';
import { fetchBugFixes, updateBugFix } from '@/lib/client/api/bugfix-client';
import type { Module, TestCase } from '@/lib/client/api/types';
import { BUGFIX_STATUS } from '@/lib/domain/bugfix';
import { getProgressFromStatus } from '@/lib/domain/progress';
import { TESTCASE_STATUS } from '@/lib/domain/testcase';
import { reconcileRows } from '@/lib/client/reconcile-rows';
import { isLatestResult } from '@/lib/client/latest-result';

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
  const [bugFixSearch, setSearch] = useState('');
  const [bugFixFilterStatus, setStatus] = useState<string>('all');
  const [bugFixFilterModule, setModule] = useState<string>('all');
  const [bugFixTab, setTab] = useState<BugFixTab>('active');
  const [page, setPage] = useState(1);
  const [paging, setPaging] = useState({ total: 0, totalPages: 1, loading: false, error: '' });
  const setBugFixSearch = useCallback((value: string) => { setSearch(value); setPage(1); }, []);
  const setBugFixFilterStatus = useCallback((value: string) => { setStatus(value); setPage(1); }, []);
  const setBugFixFilterModule = useCallback((value: string) => { setModule(value); setPage(1); }, []);
  const setBugFixTab = useCallback((value: BugFixTab) => { setTab(value); setPage(1); }, []);
  const debouncedBugFixSearch = useDebouncedValue(bugFixSearch, 300);
  const selectedProjectRef = useRef(selectedProject);
  const currentSearchRef = useRef(bugFixSearch);
  const currentStatusFilterRef = useRef(bugFixFilterStatus);
  const requestVersion = useRef(0);
  const requestController = useRef<AbortController | null>(null);
  const latestLoad = useRef<(projectId: string) => Promise<void>>(async () => {});
  const refreshRelatedRef = useRef(refreshRelatedData);

  useLayoutEffect(() => {
    selectedProjectRef.current = selectedProject;
    currentSearchRef.current = bugFixSearch;
    currentStatusFilterRef.current = bugFixFilterStatus;
    requestVersion.current++;
    requestController.current?.abort();
  }, [selectedProject, bugFixSearch, bugFixFilterStatus, bugFixTab, bugFixFilterModule, page]);

  useLayoutEffect(() => { refreshRelatedRef.current = refreshRelatedData; }, [refreshRelatedData]);
  useEffect(() => () => { requestVersion.current++; requestController.current?.abort(); }, []);

  const visibleBugFixItems = useMemo(
    () => bugFixItems.filter((bf) => {
      if (bf.projectId !== selectedProject) return false;
      const tabMatches = bugFixTab === 'resolved'
        ? bf.status === BUGFIX_STATUS.VERIFIED_FIXED
        : bf.status !== BUGFIX_STATUS.VERIFIED_FIXED;
      if (!tabMatches) return false;
      if (bugFixFilterModule === 'all') return true;
      return (bf.moduleId || 'unassigned') === bugFixFilterModule;
    }),
    [bugFixFilterModule, bugFixItems, bugFixTab, selectedProject]
  );

  // Options must not disappear just because their records are on another page.
  const bugFixFilterModules = modules;
  const hasUnassignedBugFixItems = true;

  const loadBugFix = useCallback(async (projId: string) => {
    if (!projId || projId !== selectedProjectRef.current || currentSearchRef.current !== debouncedBugFixSearch) return;
    requestController.current?.abort();
    const controller = new AbortController();
    requestController.current = controller;
    const version = ++requestVersion.current;
    setPaging(previous => ({ ...previous, loading: true, error: '' }));
    try {
      const status = bugFixTab === 'resolved'
        ? BUGFIX_STATUS.VERIFIED_FIXED
        : bugFixFilterStatus !== 'all'
          ? bugFixFilterStatus
          : undefined;
      const data = await fetchBugFixes({
        projectId: projId,
        limit: 25,
        page, moduleId: bugFixFilterModule, tab: bugFixTab,
        search: debouncedBugFixSearch || undefined,
        status,
      }, controller.signal);
      if (!isLatestResult(controller.signal, version, requestVersion.current, projId, selectedProjectRef.current)) return;
      const pages = Math.max(1, data.totalPages || 1);
      if (page > pages) setPage(pages);
      setPaging({ total: data.total || 0, totalPages: pages, loading: false, error: '' });
      setBugFixItems(previous => isLatestResult(controller.signal, version, requestVersion.current, projId, selectedProjectRef.current)
        ? reconcileRows(previous, (data.bugFixItems || []).filter(item => item.projectId === projId)) : previous);
    } catch {
      if (!controller.signal.aborted && version === requestVersion.current) setPaging(previous => ({ ...previous, loading: false, error: 'Bug gagal dimuat. Coba muat ulang.' }));
    } finally {
      if (requestController.current === controller) requestController.current = null;
    }
  }, [bugFixTab, bugFixFilterStatus, debouncedBugFixSearch, bugFixFilterModule, page]);

  useLayoutEffect(() => { latestLoad.current = loadBugFix; }, [loadBugFix]);

  useEffect(() => {
    if (!selectedProjectRef.current) return;
    const timer = window.setTimeout(() => loadBugFix(selectedProjectRef.current), 0);
    return () => window.clearTimeout(timer);
  }, [loadBugFix, selectedProject]);

  const handleBugFixStatusChange = useCallback(async (bfId: string, newStatus: string) => {
    const project = selectedProjectRef.current;
    const hadPendingQuery = requestController.current !== null;
    const mutationVersion = ++requestVersion.current;
    requestController.current?.abort();
    try {
      const updatedItem = await updateBugFix({ id: bfId, status: newStatus });
      if (selectedProjectRef.current !== project || updatedItem.projectId !== project) return;
      const needsQueryRefresh = hadPendingQuery || requestVersion.current !== mutationVersion || currentStatusFilterRef.current !== 'all' || updatedItem.status === BUGFIX_STATUS.VERIFIED_FIXED;
      requestVersion.current++;
      requestController.current?.abort();
      setBugFixItems(prev => prev.map(item => item.id === bfId ? updatedItem : item));
      refreshRelatedRef.current();
      // The PUT is canonical for this row. Preserve the existing page when its
      // membership cannot change; refill filtered/changed or interrupted queries.
      if (needsQueryRefresh) void latestLoad.current(project);
      toast({ variant: 'success', title: 'Berhasil', description: `Status bug fix diubah ke ${newStatus}` });
    } catch (error: any) {
      toast({
        title: 'Gagal mengubah status',
        description: error.message || 'Status bug fix tidak dapat diubah',
        variant: 'destructive',
      });
    }
  }, [toast]);

  const transformBugFixToDetail = (bugFix: BugFixItem) => ({
    ...bugFix,
    status: bugFix.status,
    progress: bugFix.status === BUGFIX_STATUS.VERIFIED_FIXED ? 100 : bugFix.status === BUGFIX_STATUS.READY_TO_RETEST ? getProgressFromStatus(TESTCASE_STATUS.READY_TO_RETEST) : 0,
    module: bugFix.module ? { name: bugFix.module.name } : null,
    detailSource: 'bugfix',
  }) as unknown as TestCase;

  return {
    bugFixItems,
    bugFixPagination: { ...paging, page, setPage, reload: () => loadBugFix(selectedProject) },
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
