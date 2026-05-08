'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
import { BugFixPanel, type BugFixItem } from '@/components/BugFixPanel';
import { AutomatedPanel, type AutomatedTestCase } from '@/components/AutomatedPanel';
import { TestCaseTable } from '@/components/TestCaseTable';
import { TestCaseDialog, EMPTY_TEST_CASE } from '@/components/TestCaseDialog';
import { TestCaseDetailDialog } from '@/components/TestCaseDetailDialog';
import { DashboardPanel } from '@/components/DashboardPanel';
import { ImportExcelDialog, type ImportPreview } from '@/components/ImportExcelDialog';
import { AIGenerateDialog } from '@/components/AIGenerateDialog';
import { AIRefineDialog, type RefinedTestCasePreview } from '@/components/AIRefineDialog';
import { BulkStatusDialog } from '@/components/BulkStatusDialog';
import { ProjectModuleDialogs } from '@/components/ProjectModuleDialogs';
import { SettingsPanel } from '@/components/SettingsPanel';
import { FloatingAIChat, type TestCaseDraft } from '@/components/FloatingAIChat';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useAutomationLogs } from '@/hooks/useAutomationLogs';

// ============== TYPES ==============
interface Project {
  id: string;
  name: string;
  description?: string;
  automationContext?: string;
  createdAt: string;
  _count?: { testCases: number; modules: number };
}

interface Module {
  id: string;
  name: string;
  projectId: string;
  _count?: { testCases: number };
}

interface TestCase {
  id: string;
  testCaseId: string;
  page: string;
  subMenu?: string | null;
  weight?: string | null;
  calculatedWeight?: number | null;
  testType: string;
  testAction: string;
  steps: string;
  expectedResult: string;
  actualResult?: string | null;
  stepLogs?: string | null;
  status: string;
  progress: number;
  remarks?: string | null;
  priority: string;
  projectId: string;
  moduleId?: string | null;
  project?: Project;
  module?: Module;
  createdAt: string;
  updatedAt: string;
}

interface MenuProgressItem {
  page: string;
  subMenu: string;
  totalCases: number;
  weightPerCase: number;
  progressPercent: number;
  doneCount: number;
  inProgressCount: number;
  notDoneCount: number;
  blockedCount: number;
  failedCount: number;
  readyToRetestCount: number;
  tbaCount: number;
  activeCount: number;
}

interface ModuleProgressItem {
  id: string;
  name: string;
  totalMenus: number;
  totalCases: number;
  totalDone: number;
  avgProgress: number;
  menus: MenuProgressItem[];
}

interface UngroupedProgressItem {
  id: null;
  name: string;
  totalMenus: number;
  totalCases: number;
  totalDone: number;
  avgProgress: number;
  menus: MenuProgressItem[];
}

interface Stats {
  totalTestCases: number;
  doneCount: number;
  notDoneCount: number;
  inProgressCount: number;
  blockedCount: number;
  failedCount: number;
  readyToRetestCount: number;
  tbaCount: number;
  bugFixTotal: number;
  bugFixReported: number;
  bugFixFixing: number;
  bugFixReadyRetest: number;
  bugFixFixed: number;
  positiveCount: number;
  negativeCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  overallProgress: number;
  moduleData: { name: string; total: number; done: number; notDone: number; inProgress: number; blocked: number }[];
  pageGroups: { page: string; _count: { id: number } }[];
  weightMap: Record<string, number>;
  menuProgress: {
    menuKey: string;
    page: string;
    subMenu: string;
    totalCases: number;
    weightPerCase: number;
    totalWeight: number;
    contributedWeight: number;
    progressPercent: number;
    doneCount: number;
    inProgressCount: number;
    notDoneCount: number;
    blockedCount: number;
    failedCount: number;
    readyToRetestCount: number;
    tbaCount: number;
    moduleId: string | null;
    moduleName: string | null;
  }[];
  moduleProgress: ModuleProgressItem[];
  ungroupedProgress: UngroupedProgressItem | null;
  retestQueue?: {
    id: string;
    testCaseId: string;
    page: string;
    subMenu: string | null;
    priority: string;
    moduleName: string | null;
    updatedAt: string;
    waitingDays: number;
  }[];
  bugAging?: {
    id: string;
    testCaseId: string;
    page: string;
    subMenu: string | null;
    testAction: string;
    priority: string;
    status: string;
    moduleName: string | null;
    startedAt: string;
    ageDays: number;
  }[];
  moduleRisks?: {
    moduleId: string | null;
    moduleName: string;
    total: number;
    failed: number;
    readyToRetest: number;
    inProgress: number;
    blocked: number;
    notDone: number;
    riskScore: number;
  }[];
}

interface GeneratedTestCasePreview {
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

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedValue(value), delayMs);
    return () => window.clearTimeout(timeoutId);
  }, [value, delayMs]);

  return debouncedValue;
}

const LAST_PROJECT_STORAGE_KEY = 'web-qa:last-project-id';

// ============== PURE UTILITY FUNCTIONS (outside component to avoid re-creation) ==============
const getStatusColor = (status: string) => {
  switch (status) {
    case 'DONE': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'NOT DONE': return 'bg-gray-100 text-gray-800 border-gray-200';
    case 'IN PROGRESS': return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'BLOCKED': return 'bg-red-100 text-red-800 border-red-200';
    case 'FAILED': return 'bg-red-100 text-red-800 border-red-200';
    case 'READY TO RETEST': return 'bg-cyan-100 text-cyan-800 border-cyan-200';
    case 'VERIFIED & FIXED': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'TBA': return 'bg-purple-100 text-purple-800 border-purple-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'DONE': return <CheckCircle2 className="w-3.5 h-3.5" />;
    case 'NOT DONE': return <XCircle className="w-3.5 h-3.5" />;
    case 'IN PROGRESS': return <Clock className="w-3.5 h-3.5" />;
    case 'BLOCKED': return <AlertTriangle className="w-3.5 h-3.5" />;
    case 'FAILED': return <XCircle className="w-3.5 h-3.5" />;
    case 'READY TO RETEST': return <RefreshCw className="w-3.5 h-3.5" />;
    case 'VERIFIED & FIXED': return <CheckCircle2 className="w-3.5 h-3.5" />;
    case 'TBA': return <HelpCircle className="w-3.5 h-3.5" />;
    default: return <XCircle className="w-3.5 h-3.5" />;
  }
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'Critical': return 'bg-red-100 text-red-800';
    case 'High': return 'bg-orange-100 text-orange-800';
    case 'Medium': return 'bg-yellow-100 text-yellow-800';
    case 'Low': return 'bg-green-100 text-green-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const getTestTypeColor = (type: string) => {
  return type === 'Positive'
    ? 'bg-blue-50 text-blue-700 border-blue-200'
    : 'bg-rose-50 text-rose-700 border-rose-200';
};

// ============== MAIN APP ==============
export default function TestCaseManager() {
  const { toast } = useToast();

  // Core state
  const [projects, setProjects] = useState<Project[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [activeTab, setActiveTab] = useState('dashboard');

  // Filter & search
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterTestType, setFilterTestType] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterModule, setFilterModule] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<string>('desc');
  const debouncedSearch = useDebouncedValue(search, 300);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 50;

  // Loading states
  const [isLoadingTestCases, setIsLoadingTestCases] = useState(false);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // AbortController for race condition prevention
  const testCaseAbortRef = useRef<AbortController | null>(null);

  // Dashboard refresh
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

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
  const [draftTestCase, setDraftTestCase] = useState<Partial<typeof EMPTY_TEST_CASE> | null>(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [newModuleName, setNewModuleName] = useState('');

  // Bulk action
  const [bulkStatus, setBulkStatus] = useState<string>('DONE');

  // AI Generation
  const [showAIDialog, setShowAIDialog] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiGeneratedCases, setAiGeneratedCases] = useState<GeneratedTestCasePreview[]>([]);
  const [aiSelectedCases, setAiSelectedCases] = useState<Set<number>>(new Set());
  const [aiSaving, setAiSaving] = useState(false);
  const [showAIRefineDialog, setShowAIRefineDialog] = useState(false);
  const [refiningTestCase, setRefiningTestCase] = useState<TestCase | null>(null);
  const [aiRefinedCase, setAiRefinedCase] = useState<RefinedTestCasePreview | null>(null);
  const [aiRefining, setAiRefining] = useState(false);
  const [aiRefineSaving, setAiRefineSaving] = useState(false);

  // BugFix state
  const [bugFixItems, setBugFixItems] = useState<BugFixItem[]>([]);
  const [bugFixSearch, setBugFixSearch] = useState('');
  const [bugFixFilterStatus, setBugFixFilterStatus] = useState<string>('all');
  const [bugFixTab, setBugFixTab] = useState<'active' | 'resolved'>('active');
  const debouncedBugFixSearch = useDebouncedValue(bugFixSearch, 300);

  // Test record state
  const [automatedItems, setAutomatedItems] = useState<AutomatedTestCase[]>([]);
  const [automatedSearch, setAutomatedSearch] = useState('');
  const [automatedLoading, setAutomatedLoading] = useState(false);

  // Import state
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importCreateModules, setImportCreateModules] = useState(true);
  const [importing, setImporting] = useState(false);
  const [previewingImport, setPreviewingImport] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [selectedImportFile, setSelectedImportFile] = useState<File | null>(null);

  // Expandable modules state
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  // Dashboard filter state
  const [selectedModuleFilter, setSelectedModuleFilter] = useState<string>('all');

  // File ref
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
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
  } = useAutomationLogs({ viewTestCase, setViewTestCase });

  const visibleBugFixItems = useMemo(
    () => bugFixItems.filter(bf => bugFixTab === 'resolved' ? bf.status === 'VERIFIED & FIXED' : bf.status !== 'VERIFIED & FIXED'),
    [bugFixItems, bugFixTab]
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
  const selectedProjectName = useMemo(
    () => projects.find(project => project.id === selectedProject)?.name,
    [projects, selectedProject]
  );

  const handleBugFixStatusChange = async (bfId: string, newStatus: string) => {
    const response = await fetch('/api/bugfix', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: bfId, status: newStatus }),
    });
    const updatedItem = await response.json();
    if (response.ok) {
      setBugFixItems(prev => prev.map(item => item.id === bfId ? updatedItem : item));
      loadStats(selectedProject);
      loadTestCases(selectedProject);
      toast({ title: 'Berhasil', description: `Status bug fix diubah ke ${newStatus}` });
    } else {
      toast({
        title: 'Gagal mengubah status',
        description: updatedItem?.error || 'Status bug fix tidak dapat diubah',
        variant: 'destructive',
      });
    }
  };

  const openBugFixDetail = (bugFix: BugFixItem) => {
    const transformed = {
      ...bugFix,
      status: bugFix.status,
      progress: bugFix.status === 'VERIFIED & FIXED' ? 100 : bugFix.status === 'READY TO RETEST' ? 50 : 0,
      module: bugFix.module ? { name: bugFix.module.name } : null,
      detailSource: 'bugfix',
    } as unknown as TestCase;

    setViewTestCase(transformed);
    setShowDetailDialog(true);
  };

  // ============== DATA FETCHING ==============
  const loadProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      if (Array.isArray(data)) {
        setProjects(data);
        if (data.length > 0) {
          const lastProjectId = window.localStorage.getItem(LAST_PROJECT_STORAGE_KEY);
          const restoredProject = lastProjectId
            ? data.find((project: Project) => project.id === lastProjectId)
            : null;
          const selectedStillExists = selectedProject
            ? data.some((project: Project) => project.id === selectedProject)
            : false;
          if (!selectedStillExists) {
            setSelectedProject(restoredProject?.id || data[0].id);
          }
        } else if (selectedProject) {
          setSelectedProject('');
        }
      } else {
        console.error('Projects API returned non-array data:', data);
        setProjects([]);
        if (data.error) {
          toast({ title: 'Database Error', description: data.error, variant: 'destructive' });
        }
      }
    } catch (err: any) {
      console.error('Failed to load projects:', err);
      toast({ title: 'Error', description: 'Failed to load projects', variant: 'destructive' });
      setProjects([]);
    }
  };

  const loadModules = async (projId: string) => {
    if (!projId) return;
    try {
      const res = await fetch(`/api/modules?projectId=${projId}`);
      const data = await res.json();
      setModules(data);
    } catch {
      toast({ title: 'Error', description: 'Failed to load modules', variant: 'destructive' });
    }
  };

  const loadTestCases = async (projId: string, opts?: { searchVal?: string; statusVal?: string; typeVal?: string; prioVal?: string; modVal?: string; pageVal?: number; sortVal?: string; orderVal?: string }) => {
    if (!projId) return;

    // Abort previous request to prevent race conditions
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
      if (s) params.set('search', s);
      if (fs !== 'all') params.set('status', fs);
      if (ft !== 'all') params.set('testType', ft);
      if (fp !== 'all') params.set('priority', fp);
      if (fm !== 'all') params.set('moduleId', fm);

      const res = await fetch(`/api/testcases?${params}`, { signal: controller.signal });
      const data = await res.json();
      setTestCases(data.testCases || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return; // Expected, ignore
      toast({ title: 'Error', description: 'Failed to load test cases', variant: 'destructive' });
    } finally {
      setIsLoadingTestCases(false);
    }
  };

  const loadStats = async (projId: string) => {
    if (!projId) return;
    setIsLoadingStats(true);
    try {
      const res = await fetch(`/api/stats?projectId=${projId}`);
      const data = await res.json();
      setStats(data);
      setLastRefreshed(new Date());
    } catch {
      // silently fail
    } finally {
      setIsLoadingStats(false);
    }
  };

  const loadBugFix = async (projId: string) => {
    if (!projId) return;
    try {
      const params = new URLSearchParams({ projectId: projId, limit: '100' });
      if (debouncedBugFixSearch) params.set('search', debouncedBugFixSearch);
      
      // Filter by status if not 'all'
      // When in resolved tab, we specifically want 'VERIFIED & FIXED'
      if (bugFixTab === 'resolved') {
        params.set('status', 'VERIFIED & FIXED');
      } else if (bugFixFilterStatus !== 'all') {
        params.set('status', bugFixFilterStatus);
      }

      const res = await fetch(`/api/bugfix?${params}`);
      const data = await res.json();
      setBugFixItems(data.bugFixItems || []);
    } catch {
      // silently fail
    }
  };

  const loadAutomated = async (projId: string) => {
    if (!projId) return;
    setAutomatedLoading(true);
    try {
      const res = await fetch(`/api/automation/history?projectId=${projId}`);
      const data = await res.json();
      setAutomatedItems(data.items || []);
    } catch {
      toast({ title: 'Error', description: 'Failed to load test records', variant: 'destructive' });
    } finally {
      setAutomatedLoading(false);
    }
  };

  const loadAll = async (projId: string) => {
    await Promise.all([loadModules(projId), loadStats(projId), loadTestCases(projId), loadBugFix(projId), loadAutomated(projId)]);
  };

  // Initial load
  useEffect(() => {
    const timer = window.setTimeout(() => loadProjects(), 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (selectedProject) {
      window.localStorage.setItem(LAST_PROJECT_STORAGE_KEY, selectedProject);
    }
  }, [selectedProject]);
  // Reload when project changes
  useEffect(() => {
    if (!selectedProject) return;
    const timer = window.setTimeout(() => loadAll(selectedProject), 0);
    return () => window.clearTimeout(timer);
  }, [selectedProject]);
  // Reload test cases when filters/pagination change
  useEffect(() => {
    if (selectedProject) loadTestCases(selectedProject);
    // Clear selection when filters/page change to prevent invisible selections
    setSelectedIds(new Set());
  }, [page, sortBy, sortOrder, debouncedSearch, filterStatus, filterTestType, filterPriority, filterModule]);
  // Reload bugfix when filters or tab change
  useEffect(() => {
    if (!selectedProject) return;
    const timer = window.setTimeout(() => loadBugFix(selectedProject), 0);
    return () => window.clearTimeout(timer);
  }, [debouncedBugFixSearch, bugFixFilterStatus, bugFixTab]);

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
            // Focus search input
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
    if (!newProjectName.trim()) return;
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newProjectName.trim(), description: newProjectDesc.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Project gagal dibuat');

      toast({ title: 'Berhasil', description: 'Project berhasil dibuat' });
      setShowCreateProject(false);
      setNewProjectName('');
      setNewProjectDesc('');
      loadProjects();
    } catch (error: any) {
      toast({ title: 'Gagal membuat project', description: error.message, variant: 'destructive' });
    }
  };

  const handleDeleteProject = async (id: string) => {
    try {
      const res = await fetch(`/api/projects?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Project gagal dihapus');
      toast({ title: 'Berhasil', description: 'Project berhasil dihapus' });
      if (selectedProject === id) {
        window.localStorage.removeItem(LAST_PROJECT_STORAGE_KEY);
        setSelectedProject('');
      }
      loadProjects();
    } catch (error: any) {
      toast({ title: 'Gagal menghapus project', description: error.message, variant: 'destructive' });
    }
  };

  const handleCreateModule = async () => {
    if (!newModuleName.trim() || !selectedProject) return;
    try {
      const res = await fetch('/api/modules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newModuleName.trim(), projectId: selectedProject }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Module gagal dibuat');

      toast({ title: 'Berhasil', description: 'Module berhasil dibuat' });
      setShowCreateModule(false);
      setNewModuleName('');
      loadModules(selectedProject);
    } catch (error: any) {
      toast({ title: 'Gagal membuat module', description: error.message, variant: 'destructive' });
    }
  };

  const handleDeleteModule = async (id: string) => {
    try {
      const res = await fetch(`/api/modules?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Module gagal dihapus');
      toast({ title: 'Berhasil', description: 'Module berhasil dihapus' });
      loadModules(selectedProject);
    } catch (error: any) {
      toast({ title: 'Gagal menghapus module', description: error.message, variant: 'destructive' });
    }
  };

  const handleQuickStatusChange = async (testCaseId: string, newStatus: string) => {
    try {
      const res = await fetch('/api/testcases', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: testCaseId, status: newStatus }),
      });
      if (!res.ok) throw new Error('Failed to update status');
      // Optimistic update in local state
      setTestCases(prev => prev.map(tc => tc.id === testCaseId ? { ...tc, status: newStatus } : tc));
      loadStats(selectedProject);
      toast({ title: 'Status updated', description: `Status diubah ke ${newStatus}` });
    } catch {
      toast({ title: 'Gagal', description: 'Status gagal diubah', variant: 'destructive' });
    }
  };

  const handleDeleteTestCase = async (id: string) => {
    try {
      const res = await fetch(`/api/testcases?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Test case gagal dihapus');
      toast({ title: 'Berhasil', description: 'Test case berhasil dihapus' });
      setShowDeleteConfirm(false);
      loadAll(selectedProject);
    } catch (error: any) {
      toast({ title: 'Gagal menghapus test case', description: error.message, variant: 'destructive' });
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds).join(',');
    try {
      const res = await fetch(`/api/testcases?ids=${encodeURIComponent(ids)}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Bulk delete gagal');
      toast({ title: 'Berhasil', description: `${selectedIds.size} test case berhasil dihapus` });
      setSelectedIds(new Set());
      loadAll(selectedProject);
    } catch (error: any) {
      toast({ title: 'Gagal bulk delete', description: error.message, variant: 'destructive' });
    }
  };

  const handleBulkStatusUpdate = async () => {
    if (selectedIds.size === 0) return;

    const updates = await Promise.all(Array.from(selectedIds).map(async (id) => {
      try {
        const response = await fetch('/api/testcases', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, status: bulkStatus }),
        });
        const data = await response.json().catch(() => ({}));
        return { ok: response.ok, error: data.error || 'Update gagal' };
      } catch (error: any) {
        return { ok: false, error: error.message || 'Update gagal' };
      }
    }));

    const successCount = updates.filter(result => result.ok).length;
    const errorCount = updates.length - successCount;

    if (successCount > 0) {
      toast({
        title: errorCount > 0 ? 'Sebagian Berhasil' : 'Berhasil',
        description: `${successCount} test case berhasil diupdate${errorCount > 0 ? `, ${errorCount} gagal` : ''}`,
        variant: errorCount > 0 ? 'default' : undefined,
      });
      setSelectedIds(new Set());
      setShowBulkAction(false);
      loadAll(selectedProject);
    } else {
      toast({
        title: 'Gagal update status',
        description: updates[0]?.error || 'Tidak ada test case yang berhasil diupdate',
        variant: 'destructive',
      });
    }
  };

  const handleDuplicate = async (tc: TestCase) => {
    try {
      const response = await fetch('/api/testcases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...EMPTY_TEST_CASE,
          testCaseId: `${tc.testCaseId}-COPY-${Date.now().toString().slice(-5)}`,
          page: tc.page,
          subMenu: tc.subMenu,
          weight: tc.weight,
          testType: tc.testType,
          testAction: tc.testAction,
          steps: tc.steps,
          expectedResult: tc.expectedResult,
          status: 'NOT DONE',
          priority: tc.priority,
          projectId: selectedProject,
          moduleId: tc.moduleId,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Test case gagal diduplikasi');

      toast({ title: 'Berhasil', description: 'Test case berhasil diduplikasi' });
      loadTestCases(selectedProject);
    } catch (error: any) {
      toast({ title: 'Gagal duplikasi', description: error.message, variant: 'destructive' });
    }
  };

  const resetImportPreview = () => {
    setImportPreview(null);
    setSelectedImportFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedProject) return;

    setPreviewingImport(true);
    setImportPreview(null);
    setSelectedImportFile(file);
    try {
      const formDataObj = new FormData();
      formDataObj.append('file', file);
      formDataObj.append('projectId', selectedProject);
      formDataObj.append('createModules', importCreateModules ? 'true' : 'false');
      formDataObj.append('mode', 'preview');

      const res = await fetch('/api/excel', {
        method: 'POST',
        body: formDataObj,
      });

      if (res.ok) {
        const data = await res.json() as ImportPreview;
        setImportPreview(data);
        toast({
          title: data.canImport ? 'Preview Siap' : 'Preview Perlu Dicek',
          description: `${data.importableRows}/${data.totalRows} row siap import dari ${data.totalSheets} sheet`,
          variant: data.canImport ? undefined : 'destructive',
        });
      } else {
        resetImportPreview();
        toast({ title: 'Preview Gagal', description: 'Format file tidak sesuai', variant: 'destructive' });
      }
    } catch {
      resetImportPreview();
      toast({ title: 'Preview Gagal', description: 'Terjadi kesalahan saat membaca file', variant: 'destructive' });
    }
    setPreviewingImport(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleConfirmImportExcel = async () => {
    if (!selectedImportFile || !selectedProject) return;

    setImporting(true);
    try {
      const formDataObj = new FormData();
      formDataObj.append('file', selectedImportFile);
      formDataObj.append('projectId', selectedProject);
      formDataObj.append('createModules', importCreateModules ? 'true' : 'false');
      formDataObj.append('mode', 'import');

      const res = await fetch('/api/excel', {
        method: 'POST',
        body: formDataObj,
      });

      if (res.ok) {
        const data = await res.json();
        const sheetInfo = data.sheets?.map((s: { sheet: string; imported: number; skipped: number }) =>
          `${s.sheet}: ${s.imported} TC${s.skipped > 0 ? ` (${s.skipped} skipped)` : ''}`
        ).join('\n');
        toast({
          title: 'Import Berhasil',
          description: `${data.imported} test case dari ${data.totalSheets} sheet berhasil diimport${sheetInfo ? '\n' + sheetInfo : ''}`,
        });
        loadAll(selectedProject);
        setShowImportDialog(false);
        resetImportPreview();
      } else {
        toast({ title: 'Import Gagal', description: 'Format file tidak sesuai', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Import Gagal', description: 'Terjadi kesalahan saat import', variant: 'destructive' });
    }
    setImporting(false);
  };

  const handleExportExcel = (format: string = 'xlsx') => {
    if (!selectedProject) return;
    window.open(`/api/excel?projectId=${selectedProject}&format=${format}`, '_blank');
  };

  // ============== AI HANDLERS ==============
  const handleAIGenerate = async ({ prompt, moduleFilter, count }: { prompt: string; moduleFilter: string; count: number }) => {
    if (!selectedProject || !prompt.trim()) return;
    setAiGenerating(true);
    setAiGeneratedCases([]);
    setAiSelectedCases(new Set());

    try {
      // Use AbortController with 90s timeout for AI generation
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90000);

      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedProject,
          userPrompt: prompt,
          moduleFilter,
          count,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await res.json();

      if (!res.ok) {
        toast({ title: 'AI Error', description: data.error || 'Gagal generate test case', variant: 'destructive' });
        setAiGenerating(false);
        return;
      }

      const generated = data.generated || [];
      if (generated.length === 0) {
        toast({ title: 'Info', description: 'AI tidak menghasilkan test case. Coba prompt yang lebih spesifik.' });
      } else {
        setAiGeneratedCases(generated);
        // Select all by default
        setAiSelectedCases(new Set(generated.map((_: unknown, i: number) => i)));
        toast({ title: 'Berhasil', description: `AI menghasilkan ${generated.length} test case` });
      }
    } catch (err: unknown) {
      console.error('AI generate error:', err);
      if (err instanceof DOMException && err.name === 'AbortError') {
        toast({ title: 'Timeout', description: 'AI membutuhkan waktu terlalu lama. Silakan coba lagi dengan prompt yang lebih singkat.', variant: 'destructive' });
      } else {
        toast({ title: 'Error', description: 'Gagal menghubungi AI. Silakan coba lagi.', variant: 'destructive' });
      }
    }
    setAiGenerating(false);
  };

  const handleAISaveSelected = async () => {
    if (aiSelectedCases.size === 0 || !selectedProject) return;
    setAiSaving(true);

    try {
      const casesToSave = Array.from(aiSelectedCases).map(i => aiGeneratedCases[i]);
      let savedCount = 0;
      let errorCount = 0;

      // Save one by one to avoid Promise.all failing entirely
      for (const tc of casesToSave) {
        try {
          const res = await fetch('/api/testcases', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...tc,
              actualResult: null,
              status: 'NOT DONE',
              progress: 0,
              remarks: '',
              projectId: selectedProject,
              // Ensure moduleId is valid or null
              moduleId: tc.moduleId && modules.some(m => m.id === tc.moduleId) ? tc.moduleId : null,
              // Ensure subMenu is null if empty
              subMenu: tc.subMenu || null,
            }),
          });
          if (res.ok) {
            savedCount++;
          } else {
            errorCount++;
            console.error('Failed to save AI test case:', tc.testCaseId, await res.text());
          }
        } catch (err) {
          errorCount++;
          console.error('Error saving AI test case:', tc.testCaseId, err);
        }
      }

      if (savedCount > 0) {
        toast({
          title: 'Berhasil',
          description: `${savedCount} test case berhasil disimpan${errorCount > 0 ? ` (${errorCount} gagal)` : ''}`,
          variant: errorCount > 0 ? 'default' : undefined,
        });
        setShowAIDialog(false);
        setAiGeneratedCases([]);
        setAiSelectedCases(new Set());
        loadAll(selectedProject);
      } else {
        toast({ title: 'Error', description: 'Gagal menyimpan semua test case. Silakan coba lagi.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Gagal menyimpan test case', variant: 'destructive' });
    }
    setAiSaving(false);
  };

  const openAIRefineDialog = (testCase: TestCase) => {
    setRefiningTestCase(testCase);
    setAiRefinedCase(null);
    setShowAIRefineDialog(true);
  };

  const handleAIRefine = async (mode: string) => {
    if (!refiningTestCase) return;

    setAiRefining(true);
    setAiRefinedCase(null);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90000);

      const response = await fetch('/api/ai/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, testCase: refiningTestCase }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const data = await response.json();

      if (!response.ok) {
        toast({ title: 'AI Error', description: data.error || 'Gagal refine testcase', variant: 'destructive' });
        return;
      }

      setAiRefinedCase(data.refined);
      toast({ title: 'Preview Siap', description: 'AI refinement sudah dibuat. Review dulu sebelum apply.' });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        toast({ title: 'Timeout', description: 'AI membutuhkan waktu terlalu lama. Coba mode refinement lain.', variant: 'destructive' });
      } else {
        toast({ title: 'Error', description: 'Gagal menghubungi AI refinement.', variant: 'destructive' });
      }
    } finally {
      setAiRefining(false);
    }
  };

  const handleApplyAIRefinement = async () => {
    if (!refiningTestCase || !aiRefinedCase) return;

    setAiRefineSaving(true);
    try {
      const response = await fetch('/api/testcases', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: refiningTestCase.id,
          testAction: aiRefinedCase.testAction,
          steps: aiRefinedCase.steps,
          expectedResult: aiRefinedCase.expectedResult,
          remarks: aiRefinedCase.remarks,
          priority: aiRefinedCase.priority,
          testType: aiRefinedCase.testType,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        toast({ title: 'Gagal Apply', description: data.error || 'Refinement tidak tersimpan', variant: 'destructive' });
        return;
      }

      setViewTestCase(prev => prev?.id === data.id ? { ...prev, ...data } : prev);
      setShowAIRefineDialog(false);
      setAiRefinedCase(null);
      setRefiningTestCase(null);
      loadAll(selectedProject);
      toast({ title: 'Berhasil', description: 'AI refinement berhasil diterapkan ke testcase.' });
    } catch {
      toast({ title: 'Error', description: 'Gagal menyimpan refinement', variant: 'destructive' });
    } finally {
      setAiRefineSaving(false);
    }
  };

  const toggleAISelectAll = () => {
    if (aiSelectedCases.size === aiGeneratedCases.length) {
      setAiSelectedCases(new Set());
    } else {
      setAiSelectedCases(new Set(aiGeneratedCases.map((_, i) => i)));
    }
  };

  const toggleAISelect = (idx: number) => {
    const next = new Set(aiSelectedCases);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    setAiSelectedCases(next);
  };

  const toggleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === testCases.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(testCases.map((tc) => tc.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const openEditDialog = (tc: TestCase) => {
    setDraftTestCase(null);
    setEditingTestCase(tc);
    setShowTestCaseDialog(true);
  };

  const openCreateDialog = () => {
    setDraftTestCase(null);
    setEditingTestCase(null);
    setShowTestCaseDialog(true);
  };

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
      status: 'NOT DONE',
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

  // ============== RENDER: DASHBOARD ==============
  const renderDashboard = () => (
    <DashboardPanel
      stats={stats}
      modules={modules}
      expandedModules={expandedModules}
      setExpandedModules={setExpandedModules}
      selectedModuleFilter={selectedModuleFilter}
      setSelectedModuleFilter={setSelectedModuleFilter}
      isLoading={isLoadingStats}
      lastRefreshed={lastRefreshed}
      onRefresh={() => { loadStats(selectedProject); loadTestCases(selectedProject); }}
    />
  );
  // ============== RENDER: TEST CASE TABLE ==============
  const renderTestCases = () => (
    <TestCaseTable
      selectedProject={selectedProject}
      modules={modules}
      testCases={testCases}
      search={search}
      filterStatus={filterStatus}
      filterTestType={filterTestType}
      filterPriority={filterPriority}
      filterModule={filterModule}
      selectedIds={selectedIds}
      page={page}
      limit={limit}
      total={total}
      totalPages={totalPages}
      testRecordById={testRecordById}
      fileInputRef={fileInputRef}
      setSearch={setSearch}
      setFilterStatus={setFilterStatus}
      setFilterTestType={setFilterTestType}
      setFilterPriority={setFilterPriority}
      setFilterModule={setFilterModule}
      setPage={setPage}
      setShowBulkAction={setShowBulkAction}
      setShowDeleteConfirm={setShowDeleteConfirm}
      openCreateDialog={openCreateDialog}
      openAIDialog={() => { setShowAIDialog(true); setAiGeneratedCases([]); }}
      openImportDialog={() => setShowImportDialog(true)}
      handleImportExcel={handleImportExcel}
      handleExportExcel={handleExportExcel}
      isLoading={isLoadingTestCases}
      onQuickStatusChange={handleQuickStatusChange}
      refreshList={() => { if (selectedProject) { loadTestCases(selectedProject); loadStats(selectedProject); } }}
      toggleSelectAll={toggleSelectAll}
      toggleSelect={toggleSelect}
      toggleSort={toggleSort}
      openViewDialog={(tc) => { setViewTestCase(tc); setShowDetailDialog(true); }}
      openEditDialog={openEditDialog}
      handleDuplicate={handleDuplicate}
      requestDelete={(tc) => { setEditingTestCase(tc); setShowDeleteConfirm(true); }}
      getStatusColor={getStatusColor}
      getStatusIcon={getStatusIcon}
      getPriorityColor={getPriorityColor}
      getTestTypeColor={getTestTypeColor}
    />
  );

  // ============== RENDER: BUGFIX ==============
  const renderBugFix = () => (
    <BugFixPanel
      selectedProject={selectedProject}
      stats={stats}
      visibleBugFixItems={visibleBugFixItems}
      bugFixSearch={bugFixSearch}
      bugFixFilterStatus={bugFixFilterStatus}
      bugFixTab={bugFixTab}
      setBugFixSearch={setBugFixSearch}
      setBugFixFilterStatus={setBugFixFilterStatus}
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
      items={automatedItems}
      search={automatedSearch}
      loading={automatedLoading}
      setSearch={setAutomatedSearch}
      onRefresh={() => loadAutomated(selectedProject)}
      onOpenDetail={(tc) => { setViewTestCase(tc); setShowDetailDialog(true); }}
      getStatusColor={getStatusColor}
      getStatusIcon={getStatusIcon}
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
        setActiveTab={setActiveTab}
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

      <ProjectModuleDialogs
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
      />

      {/* Create/Edit Test Case Dialog */}
      <TestCaseDialog
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
      />

      {/* Detail View Dialog */}
      <TestCaseDetailDialog
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
        getTestTypeColor={getTestTypeColor}
        getPriorityColor={getPriorityColor}
        onEdit={openEditDialog}
        onRefine={openAIRefineDialog}
        onCopyId={(id) => {
          navigator.clipboard.writeText(id);
          toast({ title: 'ID Disalin', description: 'Internal ID berhasil disalin untuk Katalon.' });
        }}
        testCaseList={testCases}
        onNavigate={(tc) => setViewTestCase(tc)}
      />

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

      <BulkStatusDialog
        open={showBulkAction}
        selectedCount={selectedIds.size}
        bulkStatus={bulkStatus}
        onOpenChange={setShowBulkAction}
        setBulkStatus={setBulkStatus}
        onSubmit={handleBulkStatusUpdate}
      />

      {/* Import Excel Dialog */}
      <ImportExcelDialog
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
      />

      {/* AI Generate Dialog */}
      <AIGenerateDialog
        open={showAIDialog}
        onOpenChange={(open) => {
          setShowAIDialog(open);
          if (!open) {
            setAiGeneratedCases([]);
            setAiSelectedCases(new Set());
          }
        }}
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
      />

      <FloatingAIChat
        projectId={selectedProject}
        projectName={selectedProjectName}
        selectedTestCase={viewTestCase?.projectId === selectedProject ? viewTestCase : null}
        onOpenTestCaseId={openTestCaseFromChat}
        onCreateTestCaseDraft={openDraftCreateDialog}
      />
    </div>
    </ErrorBoundary>
  );
}
