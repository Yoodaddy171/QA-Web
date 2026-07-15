import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
  bulkUpdateTestCaseStatus,
  createTestCase,
  deleteTestCase,
  deleteTestCases,
  fetchStats,
  fetchTestCases,
  type TestCaseQueryOptions,
  updateTestCase,
} from '@/lib/client/api/testcases-client';
import type { Stats, TestCase } from '@/lib/client/api/types';
import { TESTCASE_STATUS } from '@/lib/domain/testcase';

type RefreshCallback = () => void;

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedValue(value), delayMs);
    return () => window.clearTimeout(timeoutId);
  }, [value, delayMs]);

  return debouncedValue;
}

export function useTestCases(selectedProject: string) {
  const { toast } = useToast();
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterTestType, setFilterTestType] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterModule, setFilterModule] = useState<string>('all');
  const [filterSubMenu, setFilterSubMenu] = useState<string>('all');
  const [filterTestRun, setFilterTestRun] = useState<string>('all');
  const [filterBug, setFilterBug] = useState<string>('all');
  const [filterTag, setFilterTag] = useState('');
  const [filterCreatedFrom, setFilterCreatedFrom] = useState('');
  const [filterCreatedTo, setFilterCreatedTo] = useState('');
  const [testRunOptions, setTestRunOptions] = useState<Array<{ id: string; name: string; status: string }>>([]);
  const [sortBy, setSortBy] = useState<string>('testCaseId');
  const [sortOrder, setSortOrder] = useState<string>('asc');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoadingTestCases, setIsLoadingTestCases] = useState(false);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const testCaseAbortRef = useRef<AbortController | null>(null);
  const selectedProjectRef = useRef(selectedProject);
  const debouncedSearch = useDebouncedValue(search, 300);

  useEffect(() => {
    selectedProjectRef.current = selectedProject;
  }, [selectedProject]);

  const loadTestCases = useCallback(async (projId: string, opts?: TestCaseQueryOptions) => {
    if (!projId) return;

    testCaseAbortRef.current?.abort();
    const controller = new AbortController();
    testCaseAbortRef.current = controller;

    setIsLoadingTestCases(true);
    try {
      const params = new URLSearchParams({
        projectId: projId,
        page: String(opts?.pageVal ?? page),
        limit: String(limit),
        sortBy: opts?.sortVal ?? sortBy,
        sortOrder: opts?.orderVal ?? sortOrder,
      });
      const s = opts?.searchVal ?? debouncedSearch;
      const fs = opts?.statusVal ?? filterStatus;
      const ft = opts?.typeVal ?? filterTestType;
      const fp = opts?.prioVal ?? filterPriority;
      const fm = opts?.modVal ?? filterModule;
      const fsm = opts?.subMenuVal ?? filterSubMenu;
      const ftr = opts?.testRunVal ?? filterTestRun;
      const fb = opts?.bugVal ?? filterBug;
      const ftag = opts?.tagVal ?? filterTag;
      const ffrom = opts?.createdFromVal ?? filterCreatedFrom;
      const fto = opts?.createdToVal ?? filterCreatedTo;
      if (s) params.set('search', s);
      if (fs !== 'all') params.set('status', fs);
      if (ft !== 'all') params.set('testType', ft);
      if (fp !== 'all') params.set('priority', fp);
      if (fm !== 'all') params.set('moduleId', fm);
      if (fsm !== 'all') params.set('subMenu', fsm);
      if (ftr !== 'all') params.set('testRunId', ftr);
      if (fb !== 'all') params.set('hasBug', fb);
      if (ftag) params.set('tag', ftag);
      if (ffrom) params.set('createdFrom', ffrom);
      if (fto) params.set('createdTo', fto);

      const data = await fetchTestCases(params, controller.signal);
      setTestCases(data.testCases || []);
      setTotal(data.total || 0);
      const nextTotalPages = data.totalPages || 1;
      setTotalPages(nextTotalPages);
      // Clamp back when the current page no longer exists (e.g. after deleting
      // the last rows of the final page); the page effect re-fetches.
      if ((opts?.pageVal ?? page) > nextTotalPages) setPage(nextTotalPages);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      toast({ title: 'Error', description: 'Failed to load test cases', variant: 'destructive' });
    } finally {
      setIsLoadingTestCases(false);
    }
  }, [debouncedSearch, filterBug, filterCreatedFrom, filterCreatedTo, filterModule, filterPriority, filterStatus, filterSubMenu, filterTag, filterTestRun, filterTestType, limit, page, sortBy, sortOrder, toast]);

  useEffect(() => {
    if (!selectedProject) return;
    const controller = new AbortController();
    fetch(`/api/test-runs?projectId=${encodeURIComponent(selectedProject)}`, { signal: controller.signal })
      .then(response => response.json())
      .then(data => setTestRunOptions(data.testRuns || []))
      .catch(error => { if (!(error instanceof DOMException && error.name === 'AbortError')) setTestRunOptions([]); });
    return () => controller.abort();
  }, [selectedProject]);

  const loadStats = useCallback(async (projId: string) => {
    if (!projId) return;
    setIsLoadingStats(true);
    try {
      setStats(await fetchStats(projId));
      setLastRefreshed(new Date());
    } catch {
      // Preserve existing silent stats failure behavior.
    } finally {
      setIsLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (selectedProjectRef.current) loadTestCases(selectedProjectRef.current);
      setSelectedIds(new Set());
    }, 0);
    return () => window.clearTimeout(timer);
  }, [debouncedSearch, filterBug, filterCreatedFrom, filterCreatedTo, filterModule, filterPriority, filterStatus, filterSubMenu, filterTag, filterTestRun, filterTestType, limit, loadTestCases, page, sortBy, sortOrder]);

  const handleQuickStatusChange = useCallback(async (testCaseId: string, newStatus: string) => {
    try {
      await updateTestCase({ id: testCaseId, status: newStatus });
      setTestCases(prev => prev.map(tc => tc.id === testCaseId ? { ...tc, status: newStatus } : tc));
      loadStats(selectedProject);
      toast({ variant: 'success', title: 'Status updated', description: `Status diubah ke ${newStatus}` });
    } catch {
      toast({ title: 'Gagal', description: 'Status gagal diubah', variant: 'destructive' });
    }
  }, [loadStats, selectedProject, toast]);

  const handleDeleteTestCase = useCallback(async (id: string, refreshAll: RefreshCallback) => {
    try {
      await deleteTestCase(id);
      toast({ variant: 'success', title: 'Berhasil', description: 'Test case berhasil dihapus' });
      refreshAll();
      return true;
    } catch (error: any) {
      toast({ title: 'Gagal menghapus test case', description: error.message, variant: 'destructive' });
      return false;
    }
  }, [toast]);

  const handleBulkDelete = useCallback(async (refreshAll: RefreshCallback) => {
    const ids = Array.from(selectedIds);
    try {
      await deleteTestCases(ids);
      toast({ variant: 'success', title: 'Berhasil', description: `${selectedIds.size} test case berhasil dihapus` });
      setSelectedIds(new Set());
      refreshAll();
      return true;
    } catch (error: any) {
      toast({ title: 'Gagal bulk delete', description: error.message, variant: 'destructive' });
      return false;
    }
  }, [selectedIds, toast]);

  const handleBulkStatusUpdate = useCallback(async (bulkStatus: string, refreshAll: RefreshCallback) => {
    if (selectedIds.size === 0) return false;

    try {
      const result = await bulkUpdateTestCaseStatus(Array.from(selectedIds), bulkStatus);
      toast({ variant: 'success', title: 'Berhasil', description: `${result.updated} test case berhasil diupdate` });
      setSelectedIds(new Set());
      refreshAll();
      return true;
    } catch (error: any) {
      toast({
        title: 'Gagal update status',
        description: error.message || 'Tidak ada test case yang berhasil diupdate',
        variant: 'destructive',
      });
      return false;
    }
  }, [selectedIds, toast]);

  const handleDuplicate = useCallback(async (tc: TestCase) => {
    try {
      await createTestCase({
        testCaseId: `${tc.testCaseId}-COPY-${Date.now().toString().slice(-5)}`,
        page: tc.page,
        subMenu: tc.subMenu,
        weight: tc.weight,
        testType: tc.testType,
        testAction: tc.testAction,
        steps: tc.steps,
        expectedResult: tc.expectedResult,
        status: TESTCASE_STATUS.NOT_DONE,
        priority: tc.priority,
        projectId: selectedProject,
        moduleId: tc.moduleId,
      });

      toast({ variant: 'success', title: 'Berhasil', description: 'Test case berhasil diduplikasi' });
      loadTestCases(selectedProject);
    } catch (error: any) {
      toast({ title: 'Gagal duplikasi', description: error.message, variant: 'destructive' });
    }
  }, [loadTestCases, selectedProject, toast]);

  const toggleSort = useCallback((field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  }, [sortBy, sortOrder]);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === testCases.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(testCases.map((tc) => tc.id)));
    }
  }, [selectedIds.size, testCases]);

  const toggleSelect = useCallback((id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  }, [selectedIds]);

  return {
    testCases,
    setTestCases,
    stats,
    search,
    setSearch,
    filterStatus,
    setFilterStatus,
    filterTestType,
    setFilterTestType,
    filterPriority,
    setFilterPriority,
    filterModule,
    setFilterModule,
    filterSubMenu,
    setFilterSubMenu,
    filterTestRun,
    setFilterTestRun,
    filterBug,
    setFilterBug,
    filterTag,
    setFilterTag,
    filterCreatedFrom,
    setFilterCreatedFrom,
    filterCreatedTo,
    setFilterCreatedTo,
    testRunOptions,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    page,
    setPage,
    totalPages,
    total,
    limit,
    setLimit,
    isLoadingTestCases,
    isLoadingStats,
    selectedIds,
    setSelectedIds,
    lastRefreshed,
    loadTestCases,
    loadStats,
    handleQuickStatusChange,
    handleDeleteTestCase,
    handleBulkDelete,
    handleBulkStatusUpdate,
    handleDuplicate,
    toggleSort,
    toggleSelectAll,
    toggleSelect,
  };
}
