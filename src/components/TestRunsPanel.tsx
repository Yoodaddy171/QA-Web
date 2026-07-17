'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bug, Check, ChevronLeft, ChevronRight, CircleAlert, CircleDot, History, ListChecks, Loader2, PanelRight, Plus, RefreshCw, Search, UploadCloud, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { DateRangePicker } from '@/components/ui/date-picker';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ExecutionEvidencePreview } from '@/components/ExecutionEvidencePreview';
import { useToast } from '@/hooks/use-toast';
import { TEST_EXECUTION_STATUS } from '@/lib/domain/test-run';
import { TEST_RUN_STATUS } from '@/lib/domain/test-run';
import { resolveExecutionShortcut } from '@/lib/client/execution-shortcuts';

type TestRunSummary = { total: number; completed: number; passed: number; failed: number; blocked: number; notRun: number };
type TestRun = {
  id: string;
  name: string;
  description?: string | null;
  status: string;
  startDate?: string | null;
  endDate?: string | null;
  assignedTo?: string | null;
  progress: number;
  summary: TestRunSummary;
  _count?: { testCases: number; executions: number };
};
type RunCase = {
  id: string;
  testCaseId: string;
  page: string;
  subMenu?: string | null;
  testAction: string;
  steps: string;
  expectedResult: string;
  module?: { id: string; name: string } | null;
  executions: Execution[];
};
type Execution = {
  id: string;
  testRunId: string;
  testCaseId: string;
  tester?: string | null;
  status: string;
  actualResult?: string | null;
  notes?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  evidence?: Evidence[];
};
type Evidence = { id: string; fileName: string; mimeType: string; sizeBytes: number; createdAt: string };
type TestRunDetail = TestRun & { testCases: RunCase[]; executions: Execution[] };
type TestPlanOption = { id: string; name: string; status: string };
type Activity = { id: string; action: string; field?: string | null; beforeValue?: unknown; afterValue?: unknown; actor?: string | null; createdAt: string };

const EXECUTION_ACTIONS = [
  { status: TEST_EXECUTION_STATUS.PASSED, label: 'Pass', shortcut: 'P', icon: Check, variant: 'secondary' as const },
  { status: TEST_EXECUTION_STATUS.FAILED, label: 'Fail', shortcut: 'F', icon: X, variant: 'destructive' as const },
  { status: TEST_EXECUTION_STATUS.BLOCKED, label: 'Blocked', shortcut: 'B', icon: CircleAlert, variant: 'secondary' as const },
  { status: TEST_EXECUTION_STATUS.RETEST, label: 'Retest', shortcut: 'R', icon: RefreshCw, variant: 'secondary' as const },
];
const MAX_EVIDENCE_FILE_SIZE = 25 * 1024 * 1024;
const ALLOWED_EVIDENCE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'application/pdf']);

function statusVariant(status: string): 'success' | 'failed' | 'blocked' | 'readyretest' | 'inprogress' | 'notdone' | 'outline' {
  if (status === TEST_EXECUTION_STATUS.PASSED || status === TEST_EXECUTION_STATUS.VERIFIED) return 'success';
  if (status === TEST_EXECUTION_STATUS.FAILED) return 'failed';
  if (status === TEST_EXECUTION_STATUS.BLOCKED) return 'blocked';
  if (status === TEST_EXECUTION_STATUS.RETEST) return 'readyretest';
  if (status === TEST_EXECUTION_STATUS.IN_PROGRESS) return 'inprogress';
  if (status === TEST_EXECUTION_STATUS.NOT_RUN) return 'notdone';
  return 'outline';
}

function lastCaseStorageKey(projectId: string, testRunId: string) {
  return `qaDesk.testRun.lastCase.v1.${projectId}.${testRunId}`;
}

function notesStorageKey(projectId: string, testRunId: string, testCaseId: string) {
  return `qaDesk.testRun.notesDraft.v1.${projectId}.${testRunId}.${testCaseId}`;
}

export function TestRunsPanel({ projectId }: { projectId: string }) {
  const { toast } = useToast();
  const [runs, setRuns] = useState<TestRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<TestRunDetail | null>(null);
  const [availableCases, setAvailableCases] = useState<Array<{ id: string; testCaseId: string; page: string; module?: { name: string } | null }>>([]);
  const [selectedCaseIds, setSelectedCaseIds] = useState<Set<string>>(new Set());
  const [activeCaseIndex, setActiveCaseIndex] = useState(0);
  const [runName, setRunName] = useState('');
  const [runDescription, setRunDescription] = useState('');
  const [runAssignee, setRunAssignee] = useState('');
  const [runStartDate, setRunStartDate] = useState('');
  const [runEndDate, setRunEndDate] = useState('');
  const [runTestPlanId, setRunTestPlanId] = useState('');
  const [testPlans, setTestPlans] = useState<TestPlanOption[]>([]);
  const [editingRun, setEditingRun] = useState(false);
  const [showCreateRun, setShowCreateRun] = useState(false);
  const [notes, setNotes] = useState('');
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDraggingEvidence, setIsDraggingEvidence] = useState(false);
  const [optimisticStatus, setOptimisticStatus] = useState<string | null>(null);
  const [contextOpen, setContextOpen] = useState(false);
  const [caseSearch, setCaseSearch] = useState('');
  const [notesDirty, setNotesDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeCase = selectedRun?.testCases[activeCaseIndex] || null;
  const activeExecution = activeCase?.executions[0] || null;
  const visibleExecutionStatus = optimisticStatus || activeExecution?.status || TEST_EXECUTION_STATUS.NOT_RUN;
  useEffect(() => {
    if (!selectedRun) return;
    window.localStorage.setItem(lastCaseStorageKey(projectId, selectedRun.id), String(activeCaseIndex));
  }, [activeCaseIndex, projectId, selectedRun]);
  const reloadRuns = useCallback(async () => {
    if (!projectId) return;
    setIsLoading(true);
    try {
      const response = await fetch(`/api/test-runs?projectId=${encodeURIComponent(projectId)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal memuat Test Run.');
      setRuns(data.testRuns || []);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Gagal memuat Test Run.');
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  const openRun = useCallback(async (runId: string) => {
    setIsLoading(true);
    try {
      const [response, activityResponse] = await Promise.all([
        fetch(`/api/test-runs/${runId}?projectId=${encodeURIComponent(projectId)}`),
        fetch(`/api/activity?projectId=${encodeURIComponent(projectId)}&entityType=TestRun&entityId=${encodeURIComponent(runId)}`),
      ]);
      const [data, activityData] = await Promise.all([response.json(), activityResponse.json()]);
      if (!response.ok) throw new Error(data.error || 'Gagal membuka Test Run.');
      setSelectedRun(data);
      setShowCreateRun(false);
      setRunName(data.name || '');
      setRunDescription(data.description || '');
      setRunAssignee(data.assignedTo || '');
      setRunStartDate(data.startDate ? String(data.startDate).slice(0, 10) : '');
      setRunEndDate(data.endDate ? String(data.endDate).slice(0, 10) : '');
      setRunTestPlanId(data.testPlanId || '');
      setActivities(activityResponse.ok ? activityData.activities || [] : []);
      const storedIndex = Number.parseInt(window.localStorage.getItem(lastCaseStorageKey(projectId, runId)) || '0', 10);
      const maxIndex = Math.max(0, data.testCases.length - 1);
      const nextIndex = Number.isFinite(storedIndex) ? Math.max(0, Math.min(maxIndex, storedIndex)) : 0;
      setActiveCaseIndex(nextIndex);
      const nextCase = data.testCases?.[nextIndex];
      const savedNotes = nextCase ? window.localStorage.getItem(notesStorageKey(projectId, runId, nextCase.id)) : null;
      setNotes(savedNotes ?? nextCase?.executions?.[0]?.notes ?? '');
      setNotesDirty(savedNotes !== null);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Gagal membuka Test Run.');
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void reloadRuns(); }, 0);
    const plansTimer = window.setTimeout(async () => {
      if (!projectId) return;
      const response = await fetch(`/api/test-plans?projectId=${encodeURIComponent(projectId)}`);
      const data = await response.json();
      if (response.ok) setTestPlans(data.testPlans || []);
    }, 0);
    return () => { window.clearTimeout(timer); window.clearTimeout(plansTimer); };
  }, [projectId, reloadRuns]);

  const loadAvailableCases = useCallback(async () => {
    const response = await fetch(`/api/testcases?projectId=${encodeURIComponent(projectId)}&limit=200&sortBy=testCaseId&sortOrder=asc`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Gagal memuat testcase.');
    setAvailableCases(data.testCases || []);
  }, [projectId]);

  const createRun = async () => {
    if (!runName.trim()) return;
    setIsSaving(true);
    try {
      const response = await fetch('/api/test-runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, name: runName, description: runDescription, assignedTo: runAssignee, startDate: runStartDate || null, endDate: runEndDate || null, testPlanId: runTestPlanId || null }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal membuat Test Run.');
      setRunName('');
      setRunDescription('');
      setRunAssignee('');
      setRunStartDate('');
      setRunEndDate('');
      setRunTestPlanId('');
      await reloadRuns();
      await openRun(data.id);
      setShowCreateRun(false);
      toast({ variant: 'success', title: 'Test Run dibuat', description: `${data.name || runName} siap diisi testcase.` });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Gagal membuat Test Run.');
    } finally {
      setIsSaving(false);
    }
  };

  const addCases = async () => {
    if (!selectedRun || selectedCaseIds.size === 0) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/test-runs/${selectedRun.id}/cases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, testCaseIds: [...selectedCaseIds] }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal menambahkan testcase.');
      setSelectedCaseIds(new Set());
      await openRun(selectedRun.id);
      const message = data.added ? `${data.added} testcase ditambahkan.` : 'Testcase sudah ada di Test Run.';
      setError(null);
      toast({ variant: 'success', title: 'Test Run diperbarui', description: message });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Gagal menambahkan testcase.');
    } finally {
      setIsSaving(false);
    }
  };

  const updateRunStatus = async (status: string) => {
    if (!selectedRun) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/test-runs/${selectedRun.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, status }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal mengubah status Test Run.');
      await Promise.all([reloadRuns(), openRun(selectedRun.id)]);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Gagal mengubah status Test Run.');
    } finally {
      setIsSaving(false);
    }
  };

  const updateRunDetails = async () => {
    if (!selectedRun || !runName.trim()) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/test-runs/${selectedRun.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, name: runName, description: runDescription, assignedTo: runAssignee, startDate: runStartDate || null, endDate: runEndDate || null, testPlanId: runTestPlanId || null }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal menyimpan detail Test Run.');
      setEditingRun(false);
      await Promise.all([reloadRuns(), openRun(selectedRun.id)]);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Gagal menyimpan detail Test Run.');
    } finally {
      setIsSaving(false);
    }
  };

  const updateRunDates = async () => {
    if (!selectedRun) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/test-runs/${selectedRun.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId, startDate: runStartDate || null, endDate: runEndDate || null, testPlanId: runTestPlanId || null }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal menyimpan tanggal Test Run.');
      await Promise.all([reloadRuns(), openRun(selectedRun.id)]);
      setError('Tanggal Test Run berhasil disimpan.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Gagal menyimpan tanggal Test Run.');
    } finally {
      setIsSaving(false);
    }
  };

  const execute = useCallback(async (status: string) => {
    if (!selectedRun || !activeCase) return;
    setOptimisticStatus(status);
    setIsSaving(true);
    try {
      const response = await fetch(`/api/test-runs/${selectedRun.id}/executions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, testCaseId: activeCase.id, status, notes, tester: selectedRun.assignedTo || undefined }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal menyimpan execution.');
      await Promise.all([openRun(selectedRun.id), reloadRuns()]);
      window.localStorage.removeItem(notesStorageKey(projectId, selectedRun.id, activeCase.id));
      setNotesDirty(false);
      setError(null);
      toast({ variant: 'success', title: `${activeCase.testCaseId} · ${status}`, description: 'Hasil tersimpan. Tekan N untuk lanjut ke testcase berikutnya.' });
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Gagal menyimpan execution.';
      setError(message);
      toast({ title: 'Execution gagal disimpan', description: message, variant: 'destructive' });
    } finally {
      setOptimisticStatus(null);
      setIsSaving(false);
    }
  }, [activeCase, notes, openRun, projectId, reloadRuns, selectedRun, toast]);

  const moveCase = useCallback((delta: number) => {
    if (!selectedRun) return;
    setActiveCaseIndex(index => {
      const nextIndex = Math.max(0, Math.min(selectedRun.testCases.length - 1, index + delta));
      window.localStorage.setItem(lastCaseStorageKey(projectId, selectedRun.id), String(nextIndex));
      const nextCase = selectedRun.testCases[nextIndex];
      const savedNotes = window.localStorage.getItem(notesStorageKey(projectId, selectedRun.id, nextCase.id));
      setNotes(savedNotes ?? nextCase?.executions?.[0]?.notes ?? '');
      setNotesDirty(savedNotes !== null);
      return nextIndex;
    });
  }, [projectId, selectedRun]);

  useEffect(() => {
    if (!selectedRun || !activeCase || !notesDirty) return;
    const timer = window.setTimeout(() => {
      window.localStorage.setItem(notesStorageKey(projectId, selectedRun.id, activeCase.id), notes);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [activeCase, notes, notesDirty, projectId, selectedRun]);

  useEffect(() => {
    const navigate = (event: Event) => {
      const detail = (event as CustomEvent<{ testRunId?: string }>).detail;
      if (detail?.testRunId) void openRun(detail.testRunId);
    };
    window.addEventListener('qa-desk:navigate-entity', navigate);
    const stored = window.localStorage.getItem(`qaDesk.navigationTarget.v1.${projectId}`);
    if (stored) {
      try {
        const target = JSON.parse(stored) as { testRunId?: string };
        if (target.testRunId) window.setTimeout(() => void openRun(target.testRunId!), 0);
      } catch { /* Ignore stale navigation targets. */ }
      window.localStorage.removeItem(`qaDesk.navigationTarget.v1.${projectId}`);
    }
    return () => window.removeEventListener('qa-desk:navigate-entity', navigate);
  }, [openRun, projectId]);

  const createBug = async () => {
    if (!selectedRun || !activeExecution || activeExecution.status !== TEST_EXECUTION_STATUS.FAILED) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/test-runs/${selectedRun.id}/executions/${activeExecution.id}/bug?projectId=${encodeURIComponent(projectId)}`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal membuat bug.');
      setError(null);
      toast({ variant: 'success', title: 'Bug berhasil dibuat', description: `${activeCase?.testCaseId || 'Testcase'} sudah terhubung ke execution gagal.` });
      await openRun(selectedRun.id);
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Gagal membuat bug.';
      setError(message);
      toast({ title: 'Gagal membuat bug', description: message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const uploadEvidence = async (file: File | undefined, replaceEvidenceId?: string) => {
    if (!selectedRun || !activeExecution || !file) return;
    if (!ALLOWED_EVIDENCE_TYPES.has(file.type)) {
      setError('Tipe evidence tidak didukung. Gunakan PNG, JPEG, WebP, GIF, MP4, WebM, atau PDF.');
      return;
    }
    if (file.size === 0 || file.size > MAX_EVIDENCE_FILE_SIZE) {
      setError('Ukuran evidence harus lebih dari 0 dan maksimal 25 MB.');
      return;
    }
    setIsSaving(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (replaceEvidenceId) formData.append('replaceEvidenceId', replaceEvidenceId);
      const response = await fetch(`/api/test-runs/${selectedRun.id}/executions/${activeExecution.id}/evidence?projectId=${encodeURIComponent(projectId)}`, { method: 'POST', body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal mengunggah evidence.');
      await openRun(selectedRun.id);
      setError(null);
      toast({ variant: 'success', title: 'Evidence ditambahkan', description: file.name });
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : 'Gagal mengunggah evidence.';
      setError(message);
      toast({ title: 'Upload evidence gagal', description: message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const removeEvidence = async (evidenceId: string) => {
    if (!selectedRun || !activeExecution) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/test-runs/${selectedRun.id}/executions/${activeExecution.id}/evidence?projectId=${encodeURIComponent(projectId)}&evidenceId=${encodeURIComponent(evidenceId)}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal menghapus evidence.');
      await openRun(selectedRun.id);
      toast({ variant: 'success', title: 'Evidence dihapus' });
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Gagal menghapus evidence.');
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    const handleDragOver = (event: DragEvent) => {
      if (!activeExecution || !event.dataTransfer?.types.includes('Files')) return;
      event.preventDefault();
      setIsDraggingEvidence(true);
    };
    const handleDragLeave = (event: DragEvent) => {
      if (!event.relatedTarget) setIsDraggingEvidence(false);
    };
    const handleDrop = (event: DragEvent) => {
      if (!activeExecution || !event.dataTransfer?.files.length) return;
      const target = event.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;
      event.preventDefault();
      setIsDraggingEvidence(false);
      void uploadEvidence(event.dataTransfer.files[0]);
    };
    const handlePaste = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || isSaving || !activeExecution) return;
      const imageItem = Array.from(event.clipboardData?.items || []).find(item => item.type.startsWith('image/'));
      const imageFile = imageItem?.getAsFile();
      if (!imageFile) return;
      event.preventDefault();
      void uploadEvidence(new File([imageFile], `pasted-evidence-${Date.now()}.png`, { type: imageFile.type || 'image/png' }));
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;
      const shortcut = resolveExecutionShortcut(event.key, target?.tagName);
      if (shortcut?.type === 'execute') {
        event.preventDefault();
        void execute(shortcut.status);
      } else if (shortcut?.type === 'next') {
        event.preventDefault();
        moveCase(1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('paste', handlePaste);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('paste', handlePaste);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
    };
  }, [activeExecution, execute, isSaving, moveCase]);

  const assignedCaseIds = useMemo(() => new Set(selectedRun?.testCases.map(testCase => testCase.id) || []), [selectedRun?.testCases]);
  const selectableCases = availableCases.filter(testCase => !assignedCaseIds.has(testCase.id));
  const visibleRunCases = useMemo(() => {
    const query = caseSearch.trim().toLowerCase();
    if (!query) return selectedRun?.testCases || [];
    return (selectedRun?.testCases || []).filter(testCase => `${testCase.testCaseId} ${testCase.page} ${testCase.testAction}`.toLowerCase().includes(query));
  }, [caseSearch, selectedRun?.testCases]);
  const openCreateRunForm = () => {
    setRunName('');
    setRunDescription('');
    setRunAssignee('');
    setRunStartDate('');
    setRunEndDate('');
    setRunTestPlanId('');
    setShowCreateRun(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Kelola cycle dan jalankan testcase dalam execution workspace.</p>
        <Button variant="outline" onClick={() => void reloadRuns()} disabled={isLoading}><RefreshCw className="h-4 w-4" />Muat ulang</Button>
      </div>

      {error && <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">{error}</div>}

      {isDraggingEvidence && activeExecution && (
        <div className="pointer-events-none fixed inset-4 z-[100] flex animate-in items-center justify-center rounded-2xl border-2 border-dashed border-primary/60 bg-background/88 fade-in duration-150 backdrop-blur-sm" role="status" aria-live="polite">
          <div className="text-center"><UploadCloud className="mx-auto h-9 w-9 text-primary" /><p className="mt-3 text-sm font-semibold text-foreground">Drop evidence untuk {activeCase?.testCaseId}</p><p className="mt-1 text-xs text-muted-foreground">PNG, JPEG, WebP, GIF, MP4, WebM, atau PDF · maks. 25 MB</p></div>
        </div>
      )}

      <div className="grid min-h-[calc(100svh-11rem)] gap-3 lg:grid-cols-[280px_minmax(0,1fr)] min-[1440px]:grid-cols-[280px_minmax(0,1fr)_320px]">
        <Card padding="none" className="border-border/70">
          <CardHeader className="border-b border-border/70 px-5 py-5">
            <div className="flex flex-col gap-4">
              <div className="min-w-0">
                <CardTitle className="flex items-center gap-2 whitespace-nowrap"><ListChecks className="h-4 w-4 shrink-0 text-primary" /> Daftar Test Run</CardTitle>
                <CardDescription className="mt-1.5 leading-relaxed">{isLoading && runs.length === 0 ? 'Memuat cycle...' : `${runs.length} cycle pada project ini`}</CardDescription>
              </div>
              <Button className="w-full justify-center" size="sm" variant={showCreateRun ? 'secondary' : 'outline'} onClick={() => showCreateRun ? setShowCreateRun(false) : openCreateRunForm()} aria-expanded={showCreateRun}><Plus className="h-4 w-4" />{showCreateRun ? 'Tutup' : 'Cycle baru'}</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 py-5">
            {showCreateRun && <div className="flex flex-col gap-3 rounded-xl border border-dashed border-primary/30 bg-primary/[0.03] p-3">
              <div className="flex flex-col gap-1.5"><Label htmlFor="new-run-name">Nama cycle <span className="text-destructive">*</span></Label><Input id="new-run-name" value={runName} onChange={event => setRunName(event.target.value)} placeholder="Regression Release 1.2" /></div>
              <div className="flex flex-col gap-1.5"><Label htmlFor="new-run-description">Deskripsi</Label><Textarea id="new-run-description" value={runDescription} onChange={event => setRunDescription(event.target.value)} placeholder="Tujuan dan ruang lingkup cycle" className="min-h-16" /></div>
              <div className="flex flex-col gap-1.5"><Label htmlFor="new-run-assignee">Tester / assignee</Label><Input id="new-run-assignee" value={runAssignee} onChange={event => setRunAssignee(event.target.value)} placeholder="Nama tester (opsional)" /></div>
              <div className="flex flex-col gap-1.5"><Label>Periode cycle</Label><DateRangePicker from={runStartDate} to={runEndDate} onFromChange={setRunStartDate} onToChange={setRunEndDate} label="Pilih periode cycle" /></div>
              <div className="flex flex-col gap-1.5"><Label>Test Plan</Label><Select value={runTestPlanId || 'none'} onValueChange={value => setRunTestPlanId(value === 'none' ? '' : value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Tanpa Test Plan</SelectItem>{testPlans.map(plan => <SelectItem key={plan.id} value={plan.id}>{plan.name}</SelectItem>)}</SelectContent></Select></div>
              <Button className="w-full" onClick={() => void createRun()} disabled={isSaving || !runName.trim()} title={!runName.trim() ? 'Isi nama cycle untuk melanjutkan' : undefined}><Plus className="h-4 w-4" />Buat Test Run</Button>
              {!runName.trim() && <p className="text-[11px] text-muted-foreground">Nama cycle wajib diisi.</p>}
            </div>}
            {isLoading && runs.length === 0 && <div className="flex flex-col gap-2" aria-label="Memuat Test Run"><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></div>}
            {runs.map(run => (
              <button key={run.id} type="button" onClick={() => void openRun(run.id)} className={`w-full rounded-xl border p-4 text-left transition-colors ${selectedRun?.id === run.id ? 'border-primary/50 bg-primary/5' : 'border-border/70 hover:bg-secondary/50'}`}>
                <div className="flex items-start justify-between gap-3">
                  <span className="font-semibold">{run.name}</span>
                  <Badge variant={run.status === 'COMPLETED' ? 'success' : run.status === 'IN PROGRESS' ? 'inprogress' : 'outline'}>{run.status}</Badge>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground"><span>{run.summary.total} cases</span><span>{run.progress}% complete</span></div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${run.progress}%` }} /></div>
              </button>
            ))}
            {!runs.length && !isLoading && <div className="rounded-xl border border-dashed border-border/70 px-4 py-8 text-center"><p className="text-sm font-semibold">Belum ada Test Run</p><p className="mt-1 text-xs text-muted-foreground">Buat cycle pertama untuk mulai execution.</p><Button size="sm" className="mt-4" onClick={openCreateRunForm}><Plus className="h-4 w-4" />Buat cycle</Button></div>}
            {selectedRun && selectedRun.testCases.length > 0 && <div className="mt-4 border-t border-border/70 pt-4"><div className="relative mb-2"><Search className="pointer-events-none absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" /><Input value={caseSearch} onChange={event => setCaseSearch(event.target.value)} placeholder="Cari testcase..." className="h-8 pl-8 text-xs" /></div><div className="max-h-[42svh] space-y-1 overflow-y-auto">{visibleRunCases.map(testCase => { const index = selectedRun.testCases.findIndex(item => item.id === testCase.id); const latestStatus = testCase.executions[0]?.status || TEST_EXECUTION_STATUS.NOT_RUN; return <button key={testCase.id} type="button" onClick={() => { setActiveCaseIndex(index); const draft = window.localStorage.getItem(notesStorageKey(projectId, selectedRun.id, testCase.id)); setNotes(draft ?? testCase.executions[0]?.notes ?? ''); setNotesDirty(draft !== null); }} className={`qa-content-auto flex w-full items-start gap-2 rounded-lg border px-2.5 py-2 text-left ${index === activeCaseIndex ? 'qa-selected-row border-primary/30' : 'border-transparent hover:bg-secondary/60'}`}><span className="font-mono text-[10px] text-muted-foreground">{index + 1}</span><span className="min-w-0 flex-1"><span className="block truncate font-mono text-[11px] font-semibold">{testCase.testCaseId}</span><span className="block truncate text-[10px] text-muted-foreground">{testCase.testAction}</span></span><Badge variant={statusVariant(latestStatus)} className="px-1 text-[8px]">{latestStatus}</Badge></button>; })}</div></div>}
          </CardContent>
        </Card>

        <Card padding="none" className={selectedRun ? 'signal-surface signal-sweep border-primary/25' : 'border-border/70'}>
          {!selectedRun ? (
            <div className="flex min-h-[360px] flex-col items-center justify-center gap-3 p-8 text-center"><span className="relative flex h-14 w-14 items-center justify-center rounded-full border border-primary/20 bg-primary/5"><CircleDot className="h-7 w-7 text-primary/55" /></span><p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Execution workspace</p><h2 className="text-lg font-semibold">Pilih Test Run</h2><p className="max-w-sm text-sm text-muted-foreground">Pilih cycle di sebelah kiri atau buat cycle baru untuk mulai execution.</p></div>
          ) : (
            <>
              <CardHeader className="sticky top-16 z-20 border-b border-border/70 bg-card/95 py-4 backdrop-blur-md">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div><CardTitle>{selectedRun.name}</CardTitle><CardDescription className="mt-1">{selectedRun.description || 'Execution workspace'}{selectedRun.assignedTo ? ` · ${selectedRun.assignedTo}` : ''}</CardDescription><Button size="sm" variant="ghost" className="mt-1 px-0" onClick={() => setEditingRun(true)}>Edit detail</Button></div>
                  <div className="flex flex-wrap items-center gap-2"><Select value={selectedRun.status} onValueChange={value => void updateRunStatus(value)} disabled={isSaving}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={TEST_RUN_STATUS.DRAFT}>Draft</SelectItem><SelectItem value={TEST_RUN_STATUS.READY}>Ready</SelectItem><SelectItem value={TEST_RUN_STATUS.IN_PROGRESS}>In Progress</SelectItem><SelectItem value={TEST_RUN_STATUS.COMPLETED}>Completed</SelectItem><SelectItem value={TEST_RUN_STATUS.ARCHIVED}>Archived</SelectItem></SelectContent></Select><Badge variant="success">{selectedRun.summary.passed} passed</Badge><Badge variant="failed">{selectedRun.summary.failed} failed</Badge><Badge variant="blocked">{selectedRun.summary.blocked} blocked</Badge><Button variant="outline" size="icon" className="size-9 min-[1440px]:hidden" onClick={() => setContextOpen(true)} aria-label="Buka execution context"><PanelRight /></Button></div>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary" aria-label={`Progress ${selectedRun.progress}%`}><span className="block h-full origin-left rounded-full bg-primary transition-transform duration-200" style={{ transform: `scaleX(${selectedRun.progress / 100})` }} /></div>
                  <span className="font-mono text-[10px] font-bold text-foreground">{selectedRun.progress}%</span>
                  {activeCase ? <span className="hidden text-[10px] text-muted-foreground sm:inline">Case {activeCaseIndex + 1}/{selectedRun.testCases.length}</span> : null}
                </div>
                {editingRun && <div className="mt-4 space-y-2"><Input value={runName} onChange={event => setRunName(event.target.value)} aria-label="Edit nama Test Run" /><Textarea value={runDescription} onChange={event => setRunDescription(event.target.value)} className="min-h-16" aria-label="Edit deskripsi Test Run" /><Input value={runAssignee} onChange={event => setRunAssignee(event.target.value)} placeholder="Tester / assignee" aria-label="Edit assignee Test Run" /><div className="flex gap-2"><Button size="sm" onClick={() => void updateRunDetails()} disabled={isSaving || !runName.trim()}>Simpan detail</Button><Button size="sm" variant="ghost" onClick={() => setEditingRun(false)}>Batal</Button></div></div>}
              </CardHeader>
              <CardContent className="space-y-5 py-5">
                <div className="grid gap-3 rounded-xl border border-border/70 bg-secondary/20 p-3 sm:grid-cols-2 2xl:grid-cols-[1.5fr_1.2fr_auto] 2xl:items-end"><div className="flex flex-col gap-1.5"><Label>Periode cycle</Label><DateRangePicker from={runStartDate} to={runEndDate} onFromChange={setRunStartDate} onToChange={setRunEndDate} label="Pilih periode cycle" /></div><div className="flex flex-col gap-1.5"><Label>Test Plan</Label><Select value={runTestPlanId || 'none'} onValueChange={value => setRunTestPlanId(value === 'none' ? '' : value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Tanpa Test Plan</SelectItem>{testPlans.map(plan => <SelectItem key={plan.id} value={plan.id}>{plan.name}</SelectItem>)}</SelectContent></Select></div><Button size="sm" variant="outline" onClick={() => void updateRunDates()} disabled={isSaving} className="sm:col-span-2 2xl:col-span-1">Simpan metadata</Button></div>
                {activeExecution?.evidence?.length && activeExecution.id && <ExecutionEvidencePreview evidence={activeExecution.evidence} testRunId={selectedRun.id} executionId={activeExecution.id} projectId={projectId} onReplace={(evidenceId, file) => void uploadEvidence(file, evidenceId)} />}
                <div className="grid gap-3 sm:grid-cols-4"><Metric label="Total" value={selectedRun.summary.total} /><Metric label="Selesai" value={selectedRun.summary.completed} /><Metric label="Belum dijalankan" value={selectedRun.summary.notRun} /><Metric label="Progress" value={`${selectedRun.progress}%`} /></div>
                <div className="flex flex-wrap items-center gap-2"><Button variant="outline" size="sm" onClick={() => { void loadAvailableCases(); }}><Plus className="h-4 w-4" />Pilih testcase</Button>{selectedRun.testCases.length > 0 && <span className="text-xs text-muted-foreground">Keyboard: P pass · F fail · B blocked · R retest · N next</span>}{activeCaseIndex > 0 && <Badge variant="info">Dilanjutkan dari {activeCaseIndex + 1}/{selectedRun.testCases.length}</Badge>}</div>
                {availableCases.length > 0 && <div className="space-y-3 rounded-xl border border-border/70 p-4"><div className="flex items-center justify-between"><p className="text-sm font-semibold">Tambah testcase</p><Button size="sm" onClick={() => void addCases()} disabled={isSaving || selectedCaseIds.size === 0}>Tambahkan pilihan ({selectedCaseIds.size})</Button></div><div className="max-h-44 space-y-1 overflow-auto">{selectableCases.map(testCase => <label key={testCase.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-secondary/60"><input type="checkbox" checked={selectedCaseIds.has(testCase.id)} onChange={event => setSelectedCaseIds(previous => { const next = new Set(previous); if (event.target.checked) next.add(testCase.id); else next.delete(testCase.id); return next; })} /><span className="font-mono font-semibold">{testCase.testCaseId}</span><span className="text-muted-foreground">{testCase.page}</span></label>)}{!selectableCases.length && <p className="text-sm text-muted-foreground">Semua testcase sudah dimasukkan.</p>}</div></div>}
                {selectedRun.testCases.length > 0 && <div className="space-y-2 rounded-xl border border-border/70 p-4"><p className="text-sm font-semibold">Testcase dalam run</p>{selectedRun.testCases.map(testCase => <div key={testCase.id} className="flex items-center justify-between gap-3 rounded-lg bg-secondary/30 px-3 py-2 text-xs"><button type="button" className="min-w-0 truncate text-left hover:text-primary" onClick={() => setActiveCaseIndex(selectedRun.testCases.findIndex(item => item.id === testCase.id))}><span className="font-mono font-semibold">{testCase.testCaseId}</span><span className="ml-2 text-muted-foreground">{testCase.page}</span></button><Button variant="ghost" size="sm" className="h-7 px-2 text-destructive" disabled={isSaving} onClick={async () => { const response = await fetch(`/api/test-runs/${selectedRun.id}/cases?projectId=${encodeURIComponent(projectId)}&testCaseId=${encodeURIComponent(testCase.id)}`, { method: 'DELETE' }); if (!response.ok) { const data = await response.json().catch(() => ({})); setError(data.error || 'Gagal menghapus testcase dari Test Run.'); return; } await openRun(selectedRun.id); }} aria-label={`Hapus ${testCase.testCaseId} dari Test Run`}>Hapus</Button></div>)}</div>}
                {activeCase ? <div key={activeCase.id} className="animate-in fade-in slide-in-from-right-2 duration-150"><div className="rounded-xl border border-border/70 p-5"><div className="flex items-start justify-between gap-3"><div><p className="font-mono text-xs font-bold text-primary">{activeCase.testCaseId}</p><h2 className="mt-1 text-lg font-bold">{activeCase.testAction}</h2><p className="mt-1 text-xs text-muted-foreground">{activeCase.module?.name || 'Unassigned'} · {activeCase.page}{activeCase.subMenu ? ` · ${activeCase.subMenu}` : ''}</p></div><Badge key={visibleExecutionStatus} variant={statusVariant(visibleExecutionStatus)} className="animate-in zoom-in-90 duration-150">{visibleExecutionStatus}</Badge></div><div className="mt-5 grid gap-4 md:grid-cols-2"><div><p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Steps</p><pre className="min-h-36 whitespace-pre-wrap rounded-lg bg-secondary/50 p-3 text-sm font-sans leading-6">{activeCase.steps || '—'}</pre></div><div><p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Expected result</p><p className="min-h-36 rounded-lg bg-secondary/50 p-3 text-sm leading-6">{activeCase.expectedResult || '—'}</p></div></div><div className="mt-4 flex items-center justify-between"><Label htmlFor="execution-notes">Execution notes</Label><span className="text-[10px] text-muted-foreground">{notesDirty ? 'Draft tersimpan lokal' : 'Tersimpan'}</span></div><Textarea id="execution-notes" value={notes} onChange={event => { setNotes(event.target.value); setNotesDirty(true); }} placeholder="Catatan execution..." className="mt-2 min-h-24" /></div><div className="qa-command-bar sticky bottom-0 z-20 mt-4 flex flex-wrap items-center gap-2 rounded-xl p-3"><Button variant="ghost" size="sm" onClick={() => moveCase(-1)} disabled={activeCaseIndex === 0}><ChevronLeft data-icon="inline-start" />Previous</Button><span className="mr-auto text-xs text-muted-foreground">{activeCaseIndex + 1}/{selectedRun.testCases.length}</span>{EXECUTION_ACTIONS.map(action => { const Icon = action.icon; const active = visibleExecutionStatus === action.status; return <Button key={action.status} variant={active ? action.variant : 'outline'} size="sm" onClick={() => void execute(action.status)} disabled={isSaving} aria-pressed={active}><Icon data-icon="inline-start" />{action.label}<kbd className="rounded border border-current/20 px-1 text-[9px]">{action.shortcut}</kbd></Button>; })}<Button size="sm" onClick={() => moveCase(1)} disabled={activeCaseIndex >= selectedRun.testCases.length - 1}>Next Case<ChevronRight data-icon="inline-end" /></Button></div></div> : <div className="rounded-xl border border-dashed border-border/70 p-8 text-center text-sm text-muted-foreground">Tambahkan testcase untuk mulai execution.</div>}
              </CardContent>
            </>
          )}
        </Card>
        <aside className="hidden min-w-0 min-[1440px]:block">{selectedRun ? <ExecutionContextPanel selectedRun={selectedRun} activeCase={activeCase} activeExecution={activeExecution} activities={activities} projectId={projectId} isSaving={isSaving} isDraggingEvidence={isDraggingEvidence} uploadEvidence={uploadEvidence} removeEvidence={removeEvidence} createBug={createBug} /> : null}</aside>
      </div>
      <Sheet open={contextOpen} onOpenChange={setContextOpen}><SheetContent side="right" className="w-full p-0 sm:max-w-md"><SheetHeader className="border-b border-border/70 p-4"><SheetTitle>Execution context</SheetTitle><SheetDescription>Evidence, bug, tester, dan riwayat case aktif.</SheetDescription></SheetHeader><div className="h-[calc(100dvh-5rem)] overflow-y-auto p-4">{selectedRun ? <ExecutionContextPanel selectedRun={selectedRun} activeCase={activeCase} activeExecution={activeExecution} activities={activities} projectId={projectId} isSaving={isSaving} isDraggingEvidence={isDraggingEvidence} uploadEvidence={uploadEvidence} removeEvidence={removeEvidence} createBug={createBug} /> : null}</div></SheetContent></Sheet>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return <div className="rounded-xl border border-border/70 bg-secondary/30 p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1 text-xl font-bold">{value}</p></div>;
}

function ExecutionContextPanel({ selectedRun, activeCase, activeExecution, activities, projectId, isSaving, isDraggingEvidence, uploadEvidence, removeEvidence, createBug }: {
  selectedRun: TestRunDetail;
  activeCase: RunCase | null;
  activeExecution: Execution | null;
  activities: Activity[];
  projectId: string;
  isSaving: boolean;
  isDraggingEvidence: boolean;
  uploadEvidence: (file: File | undefined, replaceEvidenceId?: string) => Promise<void>;
  removeEvidence: (id: string) => Promise<void>;
  createBug: () => Promise<void>;
}) {
  return <div className="flex flex-col gap-3">
    <section className="rounded-xl border border-border/70 bg-card p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Execution</p><p className="mt-3 text-sm font-medium">{activeExecution ? new Date(activeExecution.createdAt).toLocaleString() : 'Belum dijalankan'}</p><p className="mt-1 text-xs text-muted-foreground">{activeExecution?.tester || selectedRun.assignedTo || 'Tester belum ditentukan'}</p>{activeExecution?.status === TEST_EXECUTION_STATUS.FAILED && <Button variant="destructive" className="mt-4 w-full" onClick={() => void createBug()} disabled={isSaving}><Bug data-icon="inline-start" />Create Bug</Button>}</section>
    <section className="rounded-xl border border-border/70 bg-card p-4"><p className="text-sm font-semibold">Evidence</p><label className={`mt-3 flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-3 py-5 text-center text-xs transition-colors ${isDraggingEvidence ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-secondary/50'}`}><input type="file" className="sr-only" accept="image/*,video/mp4,video/webm,application/pdf" disabled={isSaving || !activeExecution} onChange={event => { void uploadEvidence(event.target.files?.[0]); event.currentTarget.value = ''; }} /><UploadCloud className="mb-2" />Drop, paste, atau pilih file</label><div className="mt-3 flex flex-col gap-2">{activeExecution?.evidence?.length ? activeExecution.evidence.map(item => <div key={item.id} className="flex items-center gap-2 rounded-lg bg-secondary/40 px-3 py-2 text-xs"><a className="min-w-0 flex-1 truncate text-primary hover:underline" href={`/api/test-runs/${selectedRun.id}/executions/${activeExecution.id}/evidence/${item.id}?projectId=${encodeURIComponent(projectId)}`} target="_blank" rel="noreferrer">{item.fileName}</a><Button variant="ghost" size="sm" className="h-7 px-2 text-destructive" onClick={() => void removeEvidence(item.id)} disabled={isSaving}>Hapus</Button></div>) : <p className="text-xs text-muted-foreground">{activeExecution ? 'Belum ada evidence.' : 'Jalankan testcase sebelum menambah evidence.'}</p>}</div>{activeExecution?.evidence?.length && activeExecution.id ? <ExecutionEvidencePreview evidence={activeExecution.evidence} testRunId={selectedRun.id} executionId={activeExecution.id} projectId={projectId} onReplace={(id, file) => void uploadEvidence(file, id)} /> : null}</section>
    <section className="rounded-xl border border-border/70 bg-card p-4"><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground"><History className="size-4" /> History</p><div className="mt-3 max-h-52 space-y-3 overflow-y-auto">{activities.length ? activities.slice(0, 12).map(activity => <div key={activity.id} className="border-l-2 border-primary/30 pl-3"><p className="text-xs font-semibold">{activity.action}{activity.field ? ` · ${activity.field}` : ''}</p><p className="text-[10px] text-muted-foreground">{new Date(activity.createdAt).toLocaleString()}</p></div>) : <p className="text-xs text-muted-foreground">Belum ada history.</p>}</div></section>
    {activeCase && <p className="px-1 text-[10px] text-muted-foreground">Context aktif: <span className="font-mono text-foreground">{activeCase.testCaseId}</span></p>}
  </div>;
}
