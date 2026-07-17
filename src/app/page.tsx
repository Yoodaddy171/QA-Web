'use client';

import React, { useCallback, useState, useEffect, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { AppShell } from '@/components/AppShell';
import type { BugFixItem } from '@/components/BugFixPanel';
import type { TestCaseDraftInput } from '@/components/TestCaseDialog';
import type { TestCaseDraft } from '@/components/FloatingAIChat';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useAiTestcaseFlows } from '@/hooks/use-ai-testcase-flows';
import { useAutomationDevlog } from '@/hooks/use-automation-devlog';
import { useBugFixes } from '@/hooks/use-bugfixes';
import { useExcelImportExport } from '@/hooks/use-excel-import-export';
import { useProjects } from '@/hooks/use-projects';
import { useTestCases } from '@/hooks/use-testcases';
import { fetchNextTestCaseId } from '@/lib/client/api/testcases-client';
import type { Stats, TestCase } from '@/lib/client/api/types';
import { BUGFIX_STATUS } from '@/lib/domain/bugfix';
import { TESTCASE_STATUS } from '@/lib/domain/testcase';
import { FEATURES } from '@/lib/features';
import {
  getPriorityColor,
  getStatusBadgeVariant,
  getStatusColor,
  getStatusIcon,
  getTestTypeColor,
} from '@/lib/client/workspace-formatters';
import { buildWorkspaceViews } from '@/lib/client/workspace-tab-views';

function PanelFallback() {
  return (
    <div className="animate-pulse space-y-4" aria-label="Loading view">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-20 rounded-xl border border-border/40 bg-card/60" />
        ))}
      </div>
      <div className="space-y-2 rounded-xl border border-border/40 bg-card/60 p-4">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-9 rounded-md bg-secondary/60" style={{ opacity: 1 - i * 0.13 }} />
        ))}
      </div>
    </div>
  );
}

const TestRunsPanel = dynamic(() => import('@/components/TestRunsPanel').then(module => module.TestRunsPanel), { loading: PanelFallback });
const TraceabilityPanel = dynamic(() => import('@/components/TraceabilityPanel').then(module => module.TraceabilityPanel), { loading: PanelFallback });
const ReportsPanel = dynamic(() => import('@/components/ReportsPanel').then(module => module.ReportsPanel), { loading: PanelFallback });
const ProjectModuleDialogs = dynamic(() => import('@/components/ProjectModuleDialogs').then(module => module.ProjectModuleDialogs));
const TestCaseDialog = dynamic(() => import('@/components/TestCaseDialog').then(module => module.TestCaseDialog));
const TestCaseDetailDialog = dynamic(() => import('@/components/TestCaseDetailDialog').then(module => module.TestCaseDetailDialog));
const AIRefineDialog = dynamic(() => import('@/components/AIRefineDialog').then(module => module.AIRefineDialog));
const BulkStatusDialog = dynamic(() => import('@/components/BulkStatusDialog').then(module => module.BulkStatusDialog));
const BulkExecutionDialog = dynamic(() => import('@/components/BulkExecutionDialog').then(module => module.BulkExecutionDialog));
const BulkAssignDialog = dynamic(() => import('@/components/BulkAssignDialog').then(module => module.BulkAssignDialog));
const ImportExcelDialog = dynamic(() => import('@/components/ImportExcelDialog').then(module => module.ImportExcelDialog));
const AIGenerateDialog = dynamic(() => import('@/components/AIGenerateDialog').then(module => module.AIGenerateDialog));
const FloatingAIChat = dynamic(() => import('@/components/FloatingAIChat').then(module => module.FloatingAIChat), { ssr: false });

type ModuleRiskItem = NonNullable<Stats['moduleRisks']>[number];

const LAST_ACTIVE_TAB_STORAGE_KEY = 'web-qa:last-active-tab';
const APP_TABS = ['dashboard', 'testcases', 'bugfix', 'automated', 'testRuns', 'traceability', 'reports', 'settings'] as const;
type AppTab = typeof APP_TABS[number];
const TAB_ROUTES: Record<AppTab, string> = { dashboard: 'dashboard', testcases: 'test-cases', bugfix: 'bugs', automated: 'automation', testRuns: 'test-runs', traceability: 'traceability', reports: 'reports', settings: 'settings' };
const ROUTE_TABS = Object.fromEntries(Object.entries(TAB_ROUTES).map(([tab, route]) => [route, tab])) as Record<string, AppTab>;
function workspaceRoute(pathname: string) {
  const match = pathname.match(/^\/projects\/([^/]+)\/([^/]+)\/?$/);
  const tab = match ? ROUTE_TABS[match[2]] : undefined;
  return match && tab ? { projectId: decodeURIComponent(match[1]), tab } : null;
}

// ============== MAIN APP ==============
export default function TestCaseManager() {
  const { toast } = useToast();
  const pathname = usePathname();
  const router = useRouter();

  const {
    projects,
    isLoadingProjects,
    modules,
    selectedProject,
    newProjectName,
    newProjectDesc,
    newModuleName,
    setSelectedProject,
    setNewProjectName,
    setNewProjectDesc,
    setNewModuleName,
    loadModules,
    handleCreateProject: createProject,
    handleDeleteProject,
    handleCreateModule: createModule,
    handleDeleteModule,
  } = useProjects();
  const {
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
    sortOrder,
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
    handleDeleteTestCase: deleteTestCase,
    handleBulkDelete: bulkDelete,
    handleBulkStatusUpdate: bulkStatusUpdate,
    handleDuplicate,
    toggleSort,
    toggleSelectAll,
    toggleSelect,
  } = useTestCases(selectedProject);
  const {
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
  } = useBugFixes(selectedProject, modules, () => {
    loadStats(selectedProject);
    loadTestCases(selectedProject);
  });
  const [activeTab, setActiveTab] = useState<AppTab>('dashboard');
  const skipInitialActiveTabPersistRef = useRef(true);

  // Dialogs
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [showCreateModule, setShowCreateModule] = useState(false);
  const [showTestCaseDialog, setShowTestCaseDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showBulkAction, setShowBulkAction] = useState(false);
  const [showBulkExecution, setShowBulkExecution] = useState(false);
  const [showBulkAssign, setShowBulkAssign] = useState(false);

  // Form state
  const [editingTestCase, setEditingTestCase] = useState<TestCase | null>(null);
  const [viewTestCase, setViewTestCase] = useState<TestCase | null>(null);
  const [navigationContextList, setNavigationContextList] = useState<TestCase[] | null>(null);
  const [draftTestCase, setDraftTestCase] = useState<TestCaseDraftInput | null>(null);

  // Bulk action
  const [bulkStatus, setBulkStatus] = useState<string>(TESTCASE_STATUS.DONE);
  const [bulkExecutionRun, setBulkExecutionRun] = useState('');
  const [bulkExecutionStatus, setBulkExecutionStatus] = useState('PASSED');
  const [bulkExecutionTester, setBulkExecutionTester] = useState('');
  const [bulkAssignRun, setBulkAssignRun] = useState('');
  const [bulkAssignee, setBulkAssignee] = useState('');

  // Expandable modules state
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  // Dashboard filter state
  const [selectedModuleFilter, setSelectedModuleFilter] = useState<string>('all');

  const navigateToTab = useCallback((tab: AppTab, projectId = selectedProject, replace = false) => {
    setActiveTab(tab);
    if (projectId) {
      const href = `/projects/${encodeURIComponent(projectId)}/${TAB_ROUTES[tab]}`;
      if (pathname !== href) {
        if (replace) router.replace(href);
        else router.push(href);
      }
    }
  }, [pathname, router, selectedProject]);
  const handleProjectChange = useCallback((projectId: string) => {
    setSelectedProject(projectId);
    if (projectId) navigateToTab(activeTab, projectId);
  }, [activeTab, navigateToTab, setSelectedProject]);

  const {
    automatedItems,
    automatedSearch,
    automatedFilterModule,
    automatedLoading,
    visibleAutomatedItems,
    testRecordById,
    setAutomatedSearch,
    setAutomatedFilterModule,
    loadAutomated,
    socketReady,
    liveLogs,
    activeDevLogTab,
    expandedLogId,
    isLoadingHistory,
    loadedRunLabel,
    aiSummary,
    isSummarizing,
    manualCaptureTargetUrl,
    manualCaptureSessionId,
    manualRecording,
    isManualCaptureActive,
    isStartingManualCapture,
    isStoppingManualCapture,
    isProcessingManualRecording,
    logEndRef,
    setManualCaptureTargetUrl,
    setActiveDevLogTab,
    setExpandedLogId,
    setAiSummary,
    clearLogs,
    startManualCapture,
    stopManualCapture,
    loadCurrentLogRun,
    generateAISummary,
    loadLogHistory,
    filterConsoleLogs,
  } = useAutomationDevlog({ viewTestCase, setViewTestCase });
  const selectedProjectName = useMemo(
    () => projects.find(project => project.id === selectedProject)?.name,
    [projects, selectedProject]
  );
  const subMenuOptions = useMemo(() => {
    const items = stats?.menuProgress || [];
    const filtered = filterModule === 'all'
      ? items
      : items.filter(item => (item.moduleId || 'unassigned') === filterModule);
    return Array.from(new Set(filtered.map(item => item.subMenu || ''))).sort((a, b) => a.localeCompare(b));
  }, [stats?.menuProgress, filterModule]);
  const testCaseFilterModules = useMemo(() => {
    const moduleIdsWithCases = new Set((stats?.menuProgress || [])
      .map(item => item.moduleId)
      .filter((id): id is string => Boolean(id)));
    return modules.filter(module => moduleIdsWithCases.has(module.id) || module.id === filterModule);
  }, [filterModule, modules, stats?.menuProgress]);
  const hasUnassignedTestCases = useMemo(
    () => (stats?.menuProgress || []).some(item => !item.moduleId),
    [stats?.menuProgress]
  );
  const openBugFixDetail = (bugFix: BugFixItem) => {
    const transformed = transformBugFixToDetail(bugFix);
    const contextList = visibleBugFixItems.map(transformBugFixToDetail);
    setViewTestCase(transformed);
    setNavigationContextList(contextList);
    setShowDetailDialog(true);
  };

  // ============== DATA FETCHING ==============
  const loadAll = async (projId: string) => {
    await Promise.all([loadModules(projId), loadStats(projId), loadTestCases(projId), loadBugFix(projId), loadAutomated(projId)]);
  };
  const {
    showImportDialog,
    setShowImportDialog,
    importCreateModules,
    setImportCreateModules,
    importing,
    previewingImport,
    importPreview,
    importMappings,
    setImportMappings,
    setImportPreview,
    selectedImportFile,
    fileInputRef,
    resetImportPreview,
    handleImportExcel,
    handleConfirmImportExcel,
    lastImportBatchId,
    handleUndoImport,
    handleExportExcel,
  } = useExcelImportExport(selectedProject, () => loadAll(selectedProject));
  const handleImportMappingChange = (sheetName: string, field: string, header: string) => {
    setImportMappings((current) => ({
      ...current,
      [sheetName]: { ...current[sheetName], [field]: header },
    }));
    // Keep the visible validation state in sync with the user's mapping choice.
    // The server revalidates the mapping again on confirmation.
    setImportPreview((current) => {
      if (!current) return current;
      const sheets = current.sheets.map((sheet) => {
        if (sheet.sheet !== sheetName) return sheet;
        const mapping = { ...sheet.mapping, [field]: header };
        return {
          ...sheet,
          mapping,
          missingHeaders: ['ID', 'Page', 'Feature', 'Test', 'Expected Result', 'Status'].filter((required) => !mapping[required]),
        };
      });
      return {
        ...current,
        sheets,
        canImport: sheets.every((sheet) => sheet.missingHeaders.length === 0 && sheet.duplicateIdsInFile.length === 0 && sheet.existingIds.length === 0 && sheet.invalidStatusRows.length === 0 && sheet.missingRequiredCounts.ID === 0),
      };
    });
  };
  const {
    showAIDialog,
    setShowAIDialog,
    aiGenerating,
    aiGeneratedCases,
    setAiGeneratedCases,
    aiSelectedCases,
    setAiSelectedCases,
    aiSaving,
    showAIRefineDialog,
    setShowAIRefineDialog,
    refiningTestCase,
    setRefiningTestCase,
    aiRefinedCase,
    setAiRefinedCase,
    aiRefining,
    aiRefineSaving,
    openAIDialog,
    openAIRefineDialog,
    handleAIGenerate,
    handleAISaveSelected,
    handleAIRefine,
    handleApplyAIRefinement,
    toggleAISelectAll,
    toggleAISelect,
  } = useAiTestcaseFlows({
    selectedProject,
    modules,
    loadAll,
    setViewTestCase,
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const routed = workspaceRoute(pathname);
      if (routed) {
        setActiveTab(routed.tab);
        if (projects.some(project => project.id === routed.projectId)) setSelectedProject(routed.projectId);
        return;
      }
      const savedTab = window.localStorage.getItem(LAST_ACTIVE_TAB_STORAGE_KEY);
      if (APP_TABS.includes(savedTab as AppTab)) {
        setActiveTab(savedTab as AppTab);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [pathname, projects, setSelectedProject]);
  useEffect(() => {
    if (pathname !== '/' || !selectedProject) return;
    const href = `/projects/${encodeURIComponent(selectedProject)}/${TAB_ROUTES[activeTab]}`;
    router.replace(href);
  }, [activeTab, pathname, router, selectedProject]);
  useEffect(() => {
    if (skipInitialActiveTabPersistRef.current) {
      skipInitialActiveTabPersistRef.current = false;
      return;
    }
    window.localStorage.setItem(LAST_ACTIVE_TAB_STORAGE_KEY, activeTab);
  }, [activeTab]);
  // Load shared project data first, then fetch tab-specific data on demand.
  useEffect(() => {
    if (!selectedProject) return;
    const timer = window.setTimeout(() => {
      void Promise.all([loadModules(selectedProject), loadStats(selectedProject)]);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [selectedProject]);
  useEffect(() => {
    if (!selectedProject) return;
    const timer = window.setTimeout(() => {
      if (activeTab === 'testcases') {
        void Promise.all([loadTestCases(selectedProject), loadAutomated(selectedProject)]);
      } else if (activeTab === 'bugfix') {
        void loadBugFix(selectedProject);
      } else if (activeTab === 'automated') {
        void loadAutomated(selectedProject);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeTab, selectedProject]);
  // Auto-refresh dashboard every 60s when on dashboard tab
  useEffect(() => {
    if (activeTab !== 'dashboard' || !selectedProject) return;
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') loadStats(selectedProject);
    }, 60000);
    return () => window.clearInterval(interval);
  }, [activeTab, selectedProject]);

  // ============== KEYBOARD SHORTCUTS ==============
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger when typing in inputs/textareas
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      // Don't trigger when any dialog is open
      if (showTestCaseDialog || showDetailDialog || showAIDialog || showAIRefineDialog || showImportDialog) return;

      switch (e.key) {
        case 'n':
        case 'N':
          if (!e.ctrlKey && !e.metaKey && selectedProject && activeTab === 'testcases') {
            e.preventDefault();
            openCreateDialog();
          }
          break;
        case '/':
          if (!e.ctrlKey && !e.metaKey && activeTab === 'testcases') {
            e.preventDefault();
            // Focus search inpu
            const searchInput = document.querySelector<HTMLInputElement>('[data-search-input]');
            searchInput?.focus();
          }
          break;
        case 'r':
        case 'R':
          if (!e.ctrlKey && !e.metaKey && selectedProject) {
            e.preventDefault();
            loadAll(selectedProject);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedProject, activeTab, showTestCaseDialog, showDetailDialog, showAIDialog, showAIRefineDialog, showImportDialog]);

  // ============== HANDLERS ==============
  const handleCreateProject = async () => {
    if (await createProject()) setShowCreateProject(false);
  };

  const handleCreateModule = async () => {
    if (await createModule()) setShowCreateModule(false);
  };

  const refreshAll = () => {
    loadAll(selectedProject);
  };

  const handleDeleteTestCase = async (id: string) => {
    if (await deleteTestCase(id, refreshAll)) setShowDeleteConfirm(false);
  };

  const handleBulkDelete = async () => {
    bulkDelete(refreshAll);
  };

  const handleBulkStatusUpdate = async () => {
    if (await bulkStatusUpdate(bulkStatus, refreshAll)) setShowBulkAction(false);
  };

  const handleBulkExecution = async () => {
    if (!bulkExecutionRun || selectedIds.size === 0) return;
    try {
      const response = await fetch(`/api/test-runs/${bulkExecutionRun}/executions/bulk`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: selectedProject, testCaseIds: [...selectedIds], status: bulkExecutionStatus, tester: bulkExecutionTester }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Bulk execute gagal.');
      toast({ variant: 'success', title: 'Bulk execute berhasil', description: `${data.executed} testcase dijalankan.` });
      setSelectedIds(new Set());
      setShowBulkExecution(false);
      refreshAll();
    } catch (error) {
      toast({ title: 'Bulk execute gagal', description: error instanceof Error ? error.message : 'Terjadi kesalahan.', variant: 'destructive' });
    }
  };

  const handleBulkAssign = async () => {
    if (!bulkAssignRun || !bulkAssignee.trim() || selectedIds.size === 0) return;
    try {
      const response = await fetch(`/api/test-runs/${bulkAssignRun}/cases`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: selectedProject, testCaseIds: [...selectedIds], assignedTo: bulkAssignee.trim() }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Bulk assign gagal.');
      toast({ variant: 'success', title: 'Bulk assign berhasil', description: `${data.added || selectedIds.size} testcase ditugaskan.` });
      setSelectedIds(new Set());
      setShowBulkAssign(false);
      refreshAll();
    } catch (error) {
      toast({ title: 'Bulk assign gagal', description: error instanceof Error ? error.message : 'Terjadi kesalahan.', variant: 'destructive' });
    }
  };

  const openEditDialog = (tc: TestCase) => {
    setDraftTestCase(null);
    setEditingTestCase(tc);
    setShowTestCaseDialog(true);
  };

  async function openCreateDialog() {
    setEditingTestCase(null);

    if (!selectedProject || filterModule === 'all' || filterModule === 'unassigned') {
      setDraftTestCase(null);
      setShowTestCaseDialog(true);
      return;
    }

    setDraftTestCase({ moduleId: filterModule });
    setShowTestCaseDialog(true);

    try {
      const data = await fetchNextTestCaseId({
        projectId: selectedProject,
        moduleId: filterModule,
      });
      if (!data) return;

      setDraftTestCase(prev => ({
        ...(prev || {}),
        moduleId: filterModule,
        testCaseId: data.suggestedTestCaseId || '',
      }));
    } catch {
      // Keep the dialog usable; users can still fill the ID manually.
    }
  }

  const openDraftCreateDialog = (draft: TestCaseDraft) => {
    setEditingTestCase(null);
    setDraftTestCase({
      testCaseId: draft.testCaseId,
      page: draft.page,
      subMenu: draft.subMenu,
      weight: draft.weight,
      testType: draft.testType,
      testAction: draft.testAction,
      steps: draft.steps,
      expectedResult: draft.expectedResult,
      priority: draft.priority,
      moduleId: draft.moduleId || '',
      status: TESTCASE_STATUS.NOT_DONE,
      progress: 0,
      actualResult: '',
      remarks: '',
    });
    setShowTestCaseDialog(true);
  };

  const openTestCaseFromChat = async (visualId: string) => {
    if (!selectedProject) {
      toast({ title: 'Project belum dipilih', description: 'Pilih project terlebih dahulu.', variant: 'destructive' });
      return;
    }

    try {
      const params = new URLSearchParams({
        projectId: selectedProject,
        search: visualId,
        limit: '10',
        sortBy: 'testCaseId',
        sortOrder: 'asc',
      });
      const response = await fetch(`/api/testcases?${params}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Gagal mencari testcase.');
      }

      const candidates = Array.isArray(data.testCases) ? data.testCases as TestCase[] : [];
      const exact = candidates.find(tc => tc.testCaseId.toLowerCase() === visualId.toLowerCase());
      const target = exact || candidates[0];
      if (!target) {
        toast({
          title: 'Testcase tidak ditemukan',
          description: `Tidak ada testcase dengan ID ${visualId} pada project ini.`,
          variant: 'destructive',
        });
        return;
      }

      setViewTestCase(target);
      setNavigationContextList([target]);
      setShowDetailDialog(true);
    } catch (error: any) {
      toast({
        title: 'Gagal membuka testcase',
        description: error.message || `Tidak bisa membuka ${visualId}.`,
        variant: 'destructive',
      });
    }
  };

  // Status/priority/type color functions moved outside component for stable references

  const handleOpenDetail = async (tc: any, contextList: any[] | null = null) => {
    // If we only have partial data (e.g. from dashboard), try to get full data
    if (!tc.steps || !tc.expectedResult) {
      try {
        const params = new URLSearchParams({
          projectId: selectedProject,
          search: tc.testCaseId,
          limit: '1',
          sortBy: 'testCaseId',
          sortOrder: 'asc',
        });
        const res = await fetch(`/api/testcases?${params}`);
        const data = await res.json();
        if (res.ok && data.testCases?.[0]) {
          const fullTc = data.testCases[0];
          // Merge to keep dashboard-specific fields if any (like waitingDays)
          setViewTestCase({ ...tc, ...fullTc });
        } else {
          setViewTestCase(tc);
        }
      } catch {
        setViewTestCase(tc);
      }
    } else {
      setViewTestCase(tc);
    }

    setNavigationContextList(contextList);
    setShowDetailDialog(true);
  };

  useEffect(() => {
    const openNotificationTarget = (event: Event) => {
      const target = (event as CustomEvent<{ entityType?: string; entityId?: string }>).detail;
      if (target?.entityType !== 'TestCase' || !target.entityId || !selectedProject) return;
      const entityId = target.entityId;
      window.setTimeout(async () => {
        try {
          const params = new URLSearchParams({ projectId: selectedProject, search: entityId, limit: '1', sortBy: 'testCaseId', sortOrder: 'asc' });
          const response = await fetch(`/api/testcases?${params}`);
          const data = await response.json();
          const testCase = response.ok ? data.testCases?.find((item: TestCase) => item.id === entityId) : null;
          if (!testCase) return;
          setViewTestCase(testCase);
          setNavigationContextList([testCase]);
          setShowDetailDialog(true);
        } catch {
          toast({ title: 'Gagal membuka notifikasi', description: 'Testcase target tidak dapat dimuat.', variant: 'destructive' });
        }
      }, 0);
    };
    window.addEventListener('qa-desk:navigate-entity', openNotificationTarget);
    return () => window.removeEventListener('qa-desk:navigate-entity', openNotificationTarget);
  }, [selectedProject, toast]);

  const handleNavigate = async (tc: any) => {
    // Re-use logic from handleOpenDetail but without resetting contextLis
    if (!tc.steps || !tc.expectedResult) {
      try {
        const params = new URLSearchParams({
          projectId: selectedProject,
          search: tc.testCaseId,
          limit: '1',
          sortBy: 'testCaseId',
          sortOrder: 'asc',
        });
        const res = await fetch(`/api/testcases?${params}`);
        const data = await res.json();
        if (res.ok && data.testCases?.[0]) {
          setViewTestCase({ ...tc, ...data.testCases[0] });
          return;
        }
      } catch (err) {
        console.error('Failed to navigate to full test case:', err);
      }
    }
    setViewTestCase(tc);
  };

  const getModuleRiskTargetStatus = (moduleRisk: ModuleRiskItem) => {
    if (moduleRisk.failed > 0) return TESTCASE_STATUS.FAILED;
    if (moduleRisk.blocked > 0) return TESTCASE_STATUS.BLOCKED;
    if (moduleRisk.readyToRetest > 0) return TESTCASE_STATUS.READY_TO_RETEST;
    if (moduleRisk.inProgress > 0) return TESTCASE_STATUS.IN_PROGRESS;
    if (moduleRisk.notDone > 0) return TESTCASE_STATUS.NOT_DONE;
    return 'all';
  };

  const handleModuleRiskClick = (moduleRisk: ModuleRiskItem) => {
    const nextModuleFilter = moduleRisk.moduleId || 'unassigned';
    const nextStatusFilter = getModuleRiskTargetStatus(moduleRisk);

    navigateToTab('testcases');
    setSearch('');
    setFilterTestType('all');
    setFilterPriority('all');
    setFilterModule(nextModuleFilter);
    setFilterSubMenu('all');
    setFilterStatus(nextStatusFilter);
    setPage(1);
    setSelectedIds(new Set());

    if (selectedProject) {
      loadTestCases(selectedProject, {
        searchVal: '',
        statusVal: nextStatusFilter,
        typeVal: 'all',
        prioVal: 'all',
        modVal: nextModuleFilter,
        subMenuVal: 'all',
        pageVal: 1,
      });
    }
  };

  const workspaceViewProps = {
    stats, modules, expandedModules, setExpandedModules, selectedModuleFilter, setSelectedModuleFilter,
    handleOpenDetail, handleModuleRiskClick, isLoadingStats, lastRefreshed, loadStats, loadTestCases,
    selectedProject, testCaseFilterModules, hasUnassignedTestCases, testCases, search, filterStatus, filterTestType,
    filterPriority, filterModule, filterSubMenu, subMenuOptions, selectedIds, page, limit, total, totalPages,
    filterTestRun, setFilterTestRun, filterBug, setFilterBug, filterTag, setFilterTag, filterCreatedFrom, setFilterCreatedFrom, filterCreatedTo, setFilterCreatedTo, testRunOptions,
    testRecordById, fileInputRef, setSearch, setFilterStatus, setFilterTestType, setFilterPriority, setFilterModule,
    setFilterSubMenu, setPage, setLimit, setShowBulkAction, setShowBulkExecution, setShowBulkAssign, setShowDeleteConfirm, openCreateDialog, openAIDialog,
    setShowImportDialog, handleImportExcel, handleExportExcel, isLoadingTestCases, handleQuickStatusChange,
    toggleSelectAll, toggleSelect, toggleSort, openEditDialog, handleDuplicate, setEditingTestCase,
    clearSelection: () => setSelectedIds(new Set()),
    getStatusColor, getStatusIcon, getStatusBadgeVariant, getPriorityColor, getTestTypeColor,
    bugFixFilterModules, hasUnassignedBugFixItems, visibleBugFixItems, bugFixSearch, bugFixFilterStatus,
    bugFixFilterModule, bugFixTab, setBugFixSearch, setBugFixFilterStatus, setBugFixFilterModule, setBugFixTab,
    handleBugFixStatusChange, openBugFixDetail, automatedItems, automatedSearch, automatedFilterModule,
    automatedLoading, setAutomatedSearch, setAutomatedFilterModule, loadAutomated, visibleAutomatedItems,
    projects, setSelectedProject: handleProjectChange, setShowCreateProject, setShowCreateModule, handleDeleteProject, handleDeleteModule,
    setActiveTab: navigateToTab,
  };
  const workspaceViews = buildWorkspaceViews(workspaceViewProps);

  const handleActiveTabChange = (value: string) => {
    if (APP_TABS.includes(value as AppTab)) {
      navigateToTab(value as AppTab);
    }
  };

  // ============== MAIN RENDER ==============
  return (
    <ErrorBoundary>
    <div>
      <AppShell
        projects={projects}
        projectsLoading={isLoadingProjects}
        selectedProject={selectedProject}
        activeTab={activeTab}
        projectHealth={stats?.overallProgress ?? null}
        setSelectedProject={handleProjectChange}
        setActiveTab={handleActiveTabChange}
      >
        {{
          dashboard: workspaceViews.dashboard,
          testcases: workspaceViews.testcases,
          bugfix: workspaceViews.bugfix,
          automated: workspaceViews.automated,
          testRuns: <TestRunsPanel key={selectedProject} projectId={selectedProject} />,
          traceability: <TraceabilityPanel key={selectedProject} projectId={selectedProject} />,
          reports: <ReportsPanel projectId={selectedProject} onNavigate={(tab) => handleActiveTabChange(tab)} />,
          settings: workspaceViews.settings,
        }}
      </AppShell>
      {/* ============== DIALOGS ============== */}

      {(showCreateProject || showCreateModule) && <ProjectModuleDialogs
        showCreateProject={showCreateProject}
        showCreateModule={showCreateModule}
        newProjectName={newProjectName}
        newProjectDesc={newProjectDesc}
        newModuleName={newModuleName}
        setShowCreateProject={setShowCreateProject}
        setShowCreateModule={setShowCreateModule}
        setNewProjectName={setNewProjectName}
        setNewProjectDesc={setNewProjectDesc}
        setNewModuleName={setNewModuleName}
        onCreateProject={handleCreateProject}
        onCreateModule={handleCreateModule}
      />}

      {/* Create/Edit Test Case Dialog */}
      {showTestCaseDialog && <TestCaseDialog
        open={showTestCaseDialog}
        onOpenChange={(open) => {
          setShowTestCaseDialog(open);
          if (!open) setDraftTestCase(null);
        }}
        editingTestCase={editingTestCase}
        initialTestCase={draftTestCase}
        selectedProject={selectedProject}
        modules={modules}
        onSaveSuccess={() => loadAll(selectedProject)}
      />}

      {/* Detail View Dialog */}
      {viewTestCase && <TestCaseDetailDialog
        open={showDetailDialog}
        onOpenChange={setShowDetailDialog}
        viewTestCase={viewTestCase}
        socketReady={socketReady}
        liveLogs={liveLogs}
        activeDevLogTab={activeDevLogTab}
        expandedLogId={expandedLogId}
        isLoadingHistory={isLoadingHistory}
        loadedRunLabel={loadedRunLabel}
        aiSummary={aiSummary}
        isSummarizing={isSummarizing}
        manualCaptureTargetUrl={manualCaptureTargetUrl}
        manualCaptureSessionId={manualCaptureSessionId}
        manualRecording={manualRecording}
        isManualCaptureActive={isManualCaptureActive}
        isStartingManualCapture={isStartingManualCapture}
        isStoppingManualCapture={isStoppingManualCapture}
        isProcessingManualRecording={isProcessingManualRecording}
        logEndRef={logEndRef}
        setManualCaptureTargetUrl={setManualCaptureTargetUrl}
        setActiveDevLogTab={setActiveDevLogTab}
        setExpandedLogId={setExpandedLogId}
        setAiSummary={setAiSummary}
        clearLogs={clearLogs}
        startManualCapture={startManualCapture}
        stopManualCapture={stopManualCapture}
        loadCurrentLogRun={loadCurrentLogRun}
        generateAISummary={generateAISummary}
        loadLogHistory={loadLogHistory}
        filterConsoleLogs={filterConsoleLogs}
        getStatusColor={getStatusColor}
        getStatusIcon={getStatusIcon}
        getStatusBadgeVariant={getStatusBadgeVariant}
        getTestTypeColor={getTestTypeColor}
        getPriorityColor={getPriorityColor}
        onEdit={openEditDialog}
        onRefine={FEATURES.aiTestcaseFlows ? openAIRefineDialog : undefined}
        onCopyId={(id) => {
          navigator.clipboard.writeText(id);
          toast({ variant: 'success', title: 'ID Disalin', description: 'Internal ID berhasil disalin untuk Katalon.' });
        }}
        testCaseList={navigationContextList ?? []}
        onNavigate={handleNavigate}
      />}

      {FEATURES.aiTestcaseFlows && showAIRefineDialog && (
        <AIRefineDialog
          open={showAIRefineDialog}
          onOpenChange={(open) => {
            setShowAIRefineDialog(open);
            if (!open) {
              setAiRefinedCase(null);
              setRefiningTestCase(null);
            }
          }}
          testCase={refiningTestCase}
          refinedCase={aiRefinedCase}
          refining={aiRefining}
          saving={aiRefineSaving}
          onRefine={handleAIRefine}
          onApply={handleApplyAIRefinement}
          onReset={() => setAiRefinedCase(null)}
          getPriorityColor={getPriorityColor}
          getTestTypeColor={getTestTypeColor}
        />
      )}
      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Test Case?</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedIds.size > 0
                ? `${selectedIds.size} test case yang dipilih akan dihapus. Tindakan ini tidak bisa dibatalkan.`
                : 'Test case ini akan dihapus. Tindakan ini tidak bisa dibatalkan.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (selectedIds.size > 0) handleBulkDelete();
                else if (editingTestCase) handleDeleteTestCase(editingTestCase.id);
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {showBulkAction && <BulkStatusDialog
        open={showBulkAction}
        selectedCount={selectedIds.size}
        bulkStatus={bulkStatus}
        onOpenChange={setShowBulkAction}
        setBulkStatus={setBulkStatus}
        onSubmit={handleBulkStatusUpdate}
      />}
      {showBulkExecution && <BulkExecutionDialog open={showBulkExecution} selectedCount={selectedIds.size} testRuns={testRunOptions} testRunId={bulkExecutionRun} status={bulkExecutionStatus} tester={bulkExecutionTester} onOpenChange={setShowBulkExecution} onTestRunChange={setBulkExecutionRun} onStatusChange={setBulkExecutionStatus} onTesterChange={setBulkExecutionTester} onSubmit={handleBulkExecution} />}
      {showBulkAssign && <BulkAssignDialog open={showBulkAssign} selectedCount={selectedIds.size} testRuns={testRunOptions} testRunId={bulkAssignRun} assignee={bulkAssignee} onOpenChange={setShowBulkAssign} onTestRunChange={setBulkAssignRun} onAssigneeChange={setBulkAssignee} onSubmit={handleBulkAssign} />}

      {/* Import Excel Dialog */}
      {showImportDialog && <ImportExcelDialog
        open={showImportDialog}
        onOpenChange={(open) => {
          setShowImportDialog(open);
          if (!open) resetImportPreview();
        }}
        createModules={importCreateModules}
        onCreateModulesChange={setImportCreateModules}
        importing={importing}
        previewing={previewingImport}
        selectedFileName={selectedImportFile?.name || ''}
        importPreview={importPreview}
        fileInputRef={fileInputRef}
        onChooseFile={() => fileInputRef.current?.click()}
        onConfirmImport={handleConfirmImportExcel}
        lastImportBatchId={lastImportBatchId}
        onUndoImport={handleUndoImport}
        onMappingChange={handleImportMappingChange}
        onClearPreview={resetImportPreview}
      />}

      {/* AI Generate Dialog */}
      {FEATURES.aiTestcaseFlows && (
        <>
          {showAIDialog && <AIGenerateDialog
            open={showAIDialog}
            onOpenChange={(open) => {
              setShowAIDialog(open);
              if (!open) {
                setAiGeneratedCases([]);
                setAiSelectedCases(new Set());
              }
            }}
            projectId={selectedProject}
            modules={modules}
            aiGenerating={aiGenerating}
            aiGeneratedCases={aiGeneratedCases}
            aiSelectedCases={aiSelectedCases}
            aiSaving={aiSaving}
            handleAIGenerate={handleAIGenerate}
            handleAISaveSelected={handleAISaveSelected}
            toggleAISelectAll={toggleAISelectAll}
            toggleAISelect={toggleAISelect}
            resetGeneratedCases={() => {
              setAiGeneratedCases([]);
              setAiSelectedCases(new Set());
            }}
            getTestTypeColor={getTestTypeColor}
            getPriorityColor={getPriorityColor}
          />}

          <FloatingAIChat
            projectId={selectedProject}
            projectName={selectedProjectName}
            selectedTestCase={viewTestCase?.projectId === selectedProject ? viewTestCase : null}
            onOpenTestCaseId={openTestCaseFromChat}
            onCreateTestCaseDraft={openDraftCreateDialog}
          />
        </>
      )}
    </div>
    </ErrorBoundary>
  );
}
