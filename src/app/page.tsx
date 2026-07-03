'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import {
  AlertTriangle, Bug, CheckCircle2, Clock, HelpCircle, RefreshCw, XCircle
} from 'lucide-react';

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

function PanelFallback() {
  return <div className="h-48 animate-pulse rounded-xl border border-border/40 bg-card/50" aria-label="Loading view" />;
}

const DashboardPanel = dynamic(() => import('@/components/DashboardPanel').then(module => module.DashboardPanel), { loading: PanelFallback });
const TestCaseTable = dynamic(() => import('@/components/TestCaseTable').then(module => module.TestCaseTable), { loading: PanelFallback });
const BugFixPanel = dynamic(() => import('@/components/BugFixPanel').then(module => module.BugFixPanel), { loading: PanelFallback });
const AutomatedPanel = dynamic(() => import('@/components/AutomatedPanel').then(module => module.AutomatedPanel), { loading: PanelFallback });
const SettingsPanel = dynamic(() => import('@/components/SettingsPanel').then(module => module.SettingsPanel), { loading: PanelFallback });
const ProjectModuleDialogs = dynamic(() => import('@/components/ProjectModuleDialogs').then(module => module.ProjectModuleDialogs));
const TestCaseDialog = dynamic(() => import('@/components/TestCaseDialog').then(module => module.TestCaseDialog));
const TestCaseDetailDialog = dynamic(() => import('@/components/TestCaseDetailDialog').then(module => module.TestCaseDetailDialog));
const AIRefineDialog = dynamic(() => import('@/components/AIRefineDialog').then(module => module.AIRefineDialog));
const BulkStatusDialog = dynamic(() => import('@/components/BulkStatusDialog').then(module => module.BulkStatusDialog));
const ImportExcelDialog = dynamic(() => import('@/components/ImportExcelDialog').then(module => module.ImportExcelDialog));
const AIGenerateDialog = dynamic(() => import('@/components/AIGenerateDialog').then(module => module.AIGenerateDialog));
const FloatingAIChat = dynamic(() => import('@/components/FloatingAIChat').then(module => module.FloatingAIChat), { ssr: false });

type ModuleRiskItem = NonNullable<Stats['moduleRisks']>[number];

const LAST_ACTIVE_TAB_STORAGE_KEY = 'web-qa:last-active-tab';
const APP_TABS = ['dashboard', 'testcases', 'bugfix', 'automated', 'settings'] as const;
type AppTab = typeof APP_TABS[number];

// ============== PURE UTILITY FUNCTIONS (upgraded colors) ==============
const getStatusColor = (status: string) => {
  switch (status) {
    case TESTCASE_STATUS.DONE:
      return 'bg-emerald-50 text-emerald-700 border border-emerald-200/60 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20';
    case TESTCASE_STATUS.NOT_DONE:
      return 'bg-slate-50 text-slate-600 border border-slate-200/60 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/20';
    case TESTCASE_STATUS.IN_PROGRESS:
      return 'bg-amber-50 text-amber-700 border border-amber-200/60 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20';
    case TESTCASE_STATUS.BLOCKED:
      return 'bg-rose-50 text-rose-700 border border-rose-200/60 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20';
    case TESTCASE_STATUS.FAILED:
      return 'bg-red-50 text-red-700 border border-red-200/60 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20';
    case TESTCASE_STATUS.READY_TO_RETEST:
      return 'bg-cyan-50 text-cyan-700 border border-cyan-200/60 dark:bg-cyan-500/10 dark:text-cyan-400 dark:border-cyan-500/20';
    case BUGFIX_STATUS.VERIFIED_FIXED:
      return 'bg-emerald-50 text-emerald-700 border border-emerald-200/60 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20';
    case TESTCASE_STATUS.TBA:
      return 'bg-purple-50 text-purple-700 border border-purple-200/60 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20';
    default:
      return 'bg-slate-50 text-slate-600 border border-slate-200/60 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/20';
  }
};

const getStatusBadgeVariant = (status: string) => {
  switch (status) {
    case TESTCASE_STATUS.DONE: return 'success';
    case TESTCASE_STATUS.NOT_DONE: return 'notdone';
    case TESTCASE_STATUS.IN_PROGRESS: return 'inprogress';
    case TESTCASE_STATUS.BLOCKED: return 'blocked';
    case TESTCASE_STATUS.FAILED: return 'failed';
    case TESTCASE_STATUS.READY_TO_RETEST: return 'readyretest';
    case BUGFIX_STATUS.VERIFIED_FIXED: return 'verifiedfixed';
    case TESTCASE_STATUS.TBA: return 'tba';
    default: return 'outline';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case TESTCASE_STATUS.DONE: return <CheckCircle2 className="w-3.5 h-3.5" />;
    case TESTCASE_STATUS.NOT_DONE: return <XCircle className="w-3.5 h-3.5" />;
    case TESTCASE_STATUS.IN_PROGRESS: return <Clock className="w-3.5 h-3.5" />;
    case TESTCASE_STATUS.BLOCKED: return <AlertTriangle className="w-3.5 h-3.5" />;
    case TESTCASE_STATUS.FAILED: return <XCircle className="w-3.5 h-3.5" />;
    case TESTCASE_STATUS.READY_TO_RETEST: return <RefreshCw className="w-3.5 h-3.5" />;
    case BUGFIX_STATUS.VERIFIED_FIXED: return <CheckCircle2 className="w-3.5 h-3.5" />;
    case TESTCASE_STATUS.TBA: return <HelpCircle className="w-3.5 h-3.5" />;
    default: return <XCircle className="w-3.5 h-3.5" />;
  }
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'Critical': return 'bg-red-50 text-red-700 border border-red-200/60 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/20';
    case 'High': return 'bg-orange-50 text-orange-700 border border-orange-200/60 dark:bg-orange-500/15 dark:text-orange-400 dark:border-orange-500/20';
    case 'Medium': return 'bg-blue-50 text-blue-700 border border-blue-200/60 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/20';
    case 'Low': return 'bg-emerald-50 text-emerald-700 border border-emerald-200/60 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/20';
    default: return 'bg-slate-50 text-slate-700 border border-slate-200/60 dark:bg-slate-500/15 dark:text-slate-400 dark:border-slate-500/20';
  }
};

const getTestTypeColor = (type: string) => {
  return type === 'Positive'
    ? 'bg-sky-50 text-sky-700 border border-sky-200/60 dark:bg-sky-500/10 dark:text-sky-400 dark:border-sky-500/20'
    : 'bg-rose-50 text-rose-700 border border-rose-200/60 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20';
};

// ============== MAIN APP ==============
export default function TestCaseManager() {
  const { toast } = useToast();

  const {
    projects,
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

  // Form state
  const [editingTestCase, setEditingTestCase] = useState<TestCase | null>(null);
  const [viewTestCase, setViewTestCase] = useState<TestCase | null>(null);
  const [navigationContextList, setNavigationContextList] = useState<TestCase[] | null>(null);
  const [draftTestCase, setDraftTestCase] = useState<TestCaseDraftInput | null>(null);

  // Bulk action
  const [bulkStatus, setBulkStatus] = useState<string>(TESTCASE_STATUS.DONE);

  // Expandable modules state
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  // Dashboard filter state
  const [selectedModuleFilter, setSelectedModuleFilter] = useState<string>('all');

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
    selectedImportFile,
    fileInputRef,
    resetImportPreview,
    handleImportExcel,
    handleConfirmImportExcel,
    handleExportExcel,
  } = useExcelImportExport(selectedProject, () => loadAll(selectedProject));
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
      const savedTab = window.localStorage.getItem(LAST_ACTIVE_TAB_STORAGE_KEY);
      if (APP_TABS.includes(savedTab as AppTab)) {
        setActiveTab(savedTab as AppTab);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
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
      loadStats(selectedProject);
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

    setActiveTab('testcases');
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

  // ============== RENDER: DASHBOARD ==============
  const renderDashboard = () => (
    <DashboardPanel
      stats={stats}
      modules={modules}
      expandedModules={expandedModules}
      setExpandedModules={setExpandedModules}
      selectedModuleFilter={selectedModuleFilter}
      setSelectedModuleFilter={setSelectedModuleFilter}
      onOpenDetail={handleOpenDetail}
      onModuleRiskClick={handleModuleRiskClick}
      isLoading={isLoadingStats}
      lastRefreshed={lastRefreshed}
      onRefresh={() => { loadStats(selectedProject); loadTestCases(selectedProject); }}
    />
  );
  // ============== RENDER: TEST CASE TABLE ==============
  const renderTestCases = () => (
    <TestCaseTable
      selectedProject={selectedProject}
      modules={testCaseFilterModules}
      hasUnassignedModule={hasUnassignedTestCases}
      testCases={testCases}
      search={search}
      filterStatus={filterStatus}
      filterTestType={filterTestType}
      filterPriority={filterPriority}
      filterModule={filterModule}
      filterSubMenu={filterSubMenu}
      subMenuOptions={subMenuOptions}
      selectedIds={selectedIds}
      page={page}
      limit={limit}
      total={total}
      totalPages={totalPages}
      testRecordById={testRecordById}
      fileInputRef={fileInputRef}
      aiEnabled={FEATURES.aiTestcaseFlows}
      setSearch={setSearch}
      setFilterStatus={setFilterStatus}
      setFilterTestType={setFilterTestType}
      setFilterPriority={setFilterPriority}
      setFilterModule={setFilterModule}
      setFilterSubMenu={setFilterSubMenu}
      setPage={setPage}
      setLimit={setLimit}
      setShowBulkAction={setShowBulkAction}
      setShowDeleteConfirm={setShowDeleteConfirm}
      openCreateDialog={openCreateDialog}
      openAIDialog={FEATURES.aiTestcaseFlows ? openAIDialog : () => {}}
      openImportDialog={() => setShowImportDialog(true)}
      handleImportExcel={handleImportExcel}
      handleExportExcel={handleExportExcel}
      isLoading={isLoadingTestCases}
      onQuickStatusChange={handleQuickStatusChange}
      refreshList={() => { if (selectedProject) { loadTestCases(selectedProject); loadStats(selectedProject); } }}
      toggleSelectAll={toggleSelectAll}
      toggleSelect={toggleSelect}
      toggleSort={toggleSort}
      openViewDialog={(tc) => handleOpenDetail(tc, testCases)}
      openEditDialog={openEditDialog}
      handleDuplicate={handleDuplicate}
      requestDelete={(tc) => { setEditingTestCase(tc); setShowDeleteConfirm(true); }}
      getStatusColor={getStatusColor}
      getStatusIcon={getStatusIcon}
      getStatusBadgeVariant={getStatusBadgeVariant}
      getPriorityColor={getPriorityColor}
      getTestTypeColor={getTestTypeColor}
    />
  );

  // ============== RENDER: BUGFIX ==============
  const renderBugFix = () => (
    <BugFixPanel
      selectedProject={selectedProject}
      modules={bugFixFilterModules}
      hasUnassignedModule={hasUnassignedBugFixItems}
      stats={stats}
      visibleBugFixItems={visibleBugFixItems}
      bugFixSearch={bugFixSearch}
      bugFixFilterStatus={bugFixFilterStatus}
      bugFixFilterModule={bugFixFilterModule}
      bugFixTab={bugFixTab}
      setBugFixSearch={setBugFixSearch}
      setBugFixFilterStatus={setBugFixFilterStatus}
      setBugFixFilterModule={setBugFixFilterModule}
      setBugFixTab={setBugFixTab}
      getPriorityColor={getPriorityColor}
      onStatusChange={handleBugFixStatusChange}
      onOpenDetail={openBugFixDetail}
    />
  );

  // ============== RENDER: TEST RECORDS ==============
  const renderAutomated = () => (
    <AutomatedPanel
      selectedProject={selectedProject}
      modules={modules}
      items={automatedItems}
      search={automatedSearch}
      filterModule={automatedFilterModule}
      loading={automatedLoading}
      setSearch={setAutomatedSearch}
      setFilterModule={setAutomatedFilterModule}
      onRefresh={() => loadAutomated(selectedProject)}
      onOpenDetail={(tc) => handleOpenDetail(tc, visibleAutomatedItems)}
      getStatusColor={getStatusColor}
      getStatusIcon={getStatusIcon}
      getStatusBadgeVariant={getStatusBadgeVariant}
      getPriorityColor={getPriorityColor}
      getTestTypeColor={getTestTypeColor}
    />
  );

  // ============== RENDER: PROJECT & MODULE MANAGEMENT ==============
  const renderSettings = () => (
    <SettingsPanel
      projects={projects}
      modules={modules}
      selectedProject={selectedProject}
      setSelectedProject={setSelectedProject}
      onCreateProject={() => setShowCreateProject(true)}
      onCreateModule={() => setShowCreateModule(true)}
      onDeleteProject={handleDeleteProject}
      onDeleteModule={handleDeleteModule}
    />
  );

  const handleActiveTabChange = (value: string) => {
    if (APP_TABS.includes(value as AppTab)) {
      setActiveTab(value as AppTab);
    }
  };

  // ============== MAIN RENDER ==============
  return (
    <ErrorBoundary>
    <div>
      <AppShell
        projects={projects}
        selectedProject={selectedProject}
        activeTab={activeTab}
        projectHealth={stats?.overallProgress ?? null}
        setSelectedProject={setSelectedProject}
        setActiveTab={handleActiveTabChange}
      >
        {{
          dashboard: renderDashboard(),
          testcases: renderTestCases(),
          bugfix: renderBugFix(),
          automated: renderAutomated(),
          settings: renderSettings(),
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
      {showDetailDialog && <TestCaseDetailDialog
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
          toast({ title: 'ID Disalin', description: 'Internal ID berhasil disalin untuk Katalon.' });
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
