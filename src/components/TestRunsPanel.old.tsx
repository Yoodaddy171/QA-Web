'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LatestRequest } from '@/lib/client/latest-request';
import { RunDraft, readLocal, resumeKey } from '@/lib/client/run-draft';
import { useCommittedActions } from '@/hooks/use-committed-actions';
import { MutationAction, useWorkspaceAccess } from '@/components/WorkspaceAccess';
import {
  ArrowLeft, Bug, Check, ChevronLeft, ChevronRight, CircleAlert, CircleDot,
  History, Info, ListChecks, Loader2, PanelRight, Plus, RefreshCw, Search,
  SlidersHorizontal, UploadCloud, X
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { DateRangePicker } from '@/components/ui/date-picker';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ExecutionEvidencePreview } from '@/components/ExecutionEvidencePreview';
import { BasketballUploadDropzone } from '@/components/BasketballUploadDropzone';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { Kbd } from '@/components/ui/kbd';
import { useToast } from '@/hooks/use-toast';
import { TEST_EXECUTION_STATUS } from '@/lib/domain/test-run';
import { TEST_RUN_STATUS } from '@/lib/domain/test-run';
import { resolveExecutionShortcut } from '@/lib/client/execution-shortcuts';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/ui/empty-state';

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
type TestRunDetail = TestRun & { testCases: RunCase[]; casePage?: { hasMore: boolean; nextCursor?: string | null; startOffset?: number } };
type TestPlanOption = { id: string; name: string; status: string };
type Activity = { id: string; action: string; field?: string | null; beforeValue?: unknown; afterValue?: unknown; actor?: string | null; createdAt: string };

const EXECUTION_ACTIONS = [
  { status: TEST_EXECUTION_STATUS.PASSED, label: 'Pass', shortcut: 'P', icon: Check, activeClass: 'bg-emerald-600 hover:bg-emerald-700 text-white border-transparent' },
  { status: TEST_EXECUTION_STATUS.FAILED, label: 'Fail', shortcut: 'F', icon: X, activeClass: 'bg-destructive hover:bg-destructive/90 text-destructive-foreground border-transparent' },
  { status: TEST_EXECUTION_STATUS.BLOCKED, label: 'Blocked', shortcut: 'B', icon: CircleAlert, activeClass: 'bg-amber-600 hover:bg-amber-700 text-white border-transparent' },
  { status: TEST_EXECUTION_STATUS.RETEST, label: 'Retest', shortcut: 'R', icon: RefreshCw, activeClass: 'bg-cyan-600 hover:bg-cyan-700 text-white border-transparent' },
];
const RUN_CASES_PER_PAGE = 10;
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

function statusDotClass(status: string) {
  if (status === TEST_EXECUTION_STATUS.PASSED || status === TEST_EXECUTION_STATUS.VERIFIED) return 'bg-emerald-500';
  if (status === TEST_EXECUTION_STATUS.FAILED) return 'bg-rose-500';
  if (status === TEST_EXECUTION_STATUS.BLOCKED) return 'bg-amber-500';
  if (status === TEST_EXECUTION_STATUS.RETEST) return 'bg-cyan-500';
  if (status === TEST_EXECUTION_STATUS.IN_PROGRESS) return 'bg-blue-500';
  return 'bg-muted-foreground/40';
}

function lastCaseStorageKey(projectId: string, testRunId: string) {
  return `qaDesk.testRun.lastCase.v1.${projectId}.${testRunId}`;
}

function notesStorageKey(projectId: string, testRunId: string, testCaseId: string) {
  return `qaDesk.testRun.notesDraft.v1.${projectId}.${testRunId}.${testCaseId}`;
}

export function TestRunsPanel({ projectId }: { projectId: string }) {
  const { canEdit, canExecute, canViewEvidence, canUploadEvidence, canCreateBug, actorName, guest } = useWorkspaceAccess();
  const { toast } = useToast();
  const [view, setView] = useState<'cycles' | 'runner'>('cycles');
  const [runs, setRuns] = useState<TestRun[]>([]);
  const [nextRunCursor, setNextRunCursor] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<TestRunDetail | null>(null);
  const [availableCases, setAvailableCases] = useState<Array<{ id: string; testCaseId: string; page: string; module?: { name: string } | null }>>([]);
  const [selectedCaseIds, setSelectedCaseIds] = useState<Set<string>>(new Set());
  const [activeCaseIndex, setActiveCaseIndex] = useState(0);
  const [casePage, setCasePage] = useState(0);
  const [runName, setRunName] = useState('');
  const [runDescription, setRunDescription] = useState('');
  const [runAssignee, setRunAssignee] = useState('');
  const [runStartDate, setRunStartDate] = useState('');
  const [runEndDate, setRunEndDate] = useState('');
  const [runTestPlanId, setRunTestPlanId] = useState('');
  const [testPlans, setTestPlans] = useState<TestPlanOption[]>([]);
  const [showCreateRun, setShowCreateRun] = useState(false);
  const [manageRunOpen, setManageRunOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDraggingEvidence, setIsDraggingEvidence] = useState(false);
  const [optimisticStatus, setOptimisticStatus] = useState<string | null>(null);
  const [contextOpen, setContextOpen] = useState(false);
  const [caseSearch, setCaseSearch] = useState('');
  const [caseStatusFilter, setCaseStatusFilter] = useState<'ALL' | 'FAILED' | 'BLOCKED' | 'PASSED' | 'NOT_RUN'>('ALL');
  const [cycleSearch, setCycleSearch] = useState('');
  const [cycleFilterStatus, setCycleFilterStatus] = useState<string>('ALL');
  const [notesDirty, setNotesDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeEvidence, setActiveEvidence] = useState<Evidence[]>([]);
  const [evidenceCursor, setEvidenceCursor] = useState<string | null>(null);
  const [evidenceOwner, setEvidenceOwner] = useState<string | null>(null);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [loadingCases, setLoadingCases] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerPage, setPickerPage] = useState(1);
  const [pickerPages, setPickerPages] = useState(1);
  const [pickerLoading, setPickerLoading] = useState(false);
  const runRequests = useRef(new LatestRequest());
  const listRequests = useRef(new LatestRequest());
  const caseRequests = useRef(new LatestRequest());
  const evidenceRequests = useRef(new LatestRequest());
  const currentRunId = useRef<string | null>(null);
  const currentExecutionId = useRef<string | null>(null);
  const [draft] = useState(() => new RunDraft((key, value) => window.localStorage.setItem(key, value), () => setError('Draft belum tersimpan: penyimpanan browser tidak tersedia. Salin catatan sebelum berpindah.')));
  const notesProjectScope = guest ? `${projectId}:guest:${guest.id}` : projectId;
  const activeCase = selectedRun?.testCases[activeCaseIndex] || null;
  const activeExecution = activeCase?.executions[0] || null;
  const visibleExecutionStatus = optimisticStatus || activeExecution?.status || TEST_EXECUTION_STATUS.NOT_RUN;
  const visibleEvidence = evidenceOwner === activeExecution?.id ? activeEvidence : [];

  useEffect(() => {
    if (!selectedRun || !activeCase) return;
    try { window.localStorage.setItem(resumeKey(notesProjectScope, selectedRun.id), activeCase.id); } catch { /* Notes persistence reports its own failure. */ }
  }, [activeCase?.id, notesProjectScope, selectedRun?.id]);

  useEffect(() => { currentExecutionId.current = activeExecution?.id || null; }, [activeExecution?.id]);

  useEffect(() => {
    const flush = () => draft.flush();
    const unload = (event: BeforeUnloadEvent) => { if (!draft.flush()) event.preventDefault(); };
    window.addEventListener('pagehide', flush); window.addEventListener('beforeunload', unload);
    return () => { draft.flush(); runRequests.current.cancel(); listRequests.current.cancel(); caseRequests.current.cancel(); evidenceRequests.current.cancel(); window.removeEventListener('pagehide', flush); window.removeEventListener('beforeunload', unload); };
  }, [draft]);

  const reloadRuns = useCallback(async () => {
    if (!projectId) return;
    const request = listRequests.current.begin();
    setIsLoading(true);
    try {
      const response = await fetch(`/api/test-runs?projectId=${encodeURIComponent(projectId)}&limit=25`, { signal: request.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal memuat Test Run.');
      if (!request.current()) return;
      setRuns(data.testRuns || []);
      setNextRunCursor(data.nextCursor || null);
      setError(null);
    } catch (loadError) {
      if (request.current()) setError(loadError instanceof Error ? loadError.message : 'Gagal memuat Test Run.');
    } finally {
      if (request.current()) setIsLoading(false);
    }
  }, [projectId]);

  const loadMoreRuns = useCallback(async () => {
    if (!nextRunCursor) return;
    const request = listRequests.current.begin();
    try {
      const response = await fetch(`/api/test-runs?projectId=${encodeURIComponent(projectId)}&limit=25&cursor=${encodeURIComponent(nextRunCursor)}`, { signal: request.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal memuat cycle berikutnya.');
      if (!request.current()) return;
      setRuns(current => [...current, ...(data.testRuns || []).filter((item: TestRun) => !current.some(existing => existing.id === item.id))]);
      setNextRunCursor(data.nextCursor || null);
    } catch (cause) { if (request.current()) throw cause; }
  }, [nextRunCursor, projectId]);

  const openRun = useCallback(async (runId: string) => {
    if (!draft.flush()) return;
    const request = runRequests.current.begin(); caseRequests.current.cancel(); evidenceRequests.current.cancel();
    currentRunId.current = runId; currentExecutionId.current = null;
    setSelectedRun(null); setActiveEvidence([]); setEvidenceCursor(null); setPickerOpen(false); setSelectedCaseIds(new Set());
    setLoadingCases(false); setEvidenceLoading(false); setPickerLoading(false); setPickerPage(1); setPickerSearch('');
    const savedCaseId = readLocal(resumeKey(notesProjectScope, runId));
    const legacyIndex = Number.parseInt(readLocal(lastCaseStorageKey(projectId, runId)) || '0', 10);
    const params = new URLSearchParams({ projectId });
    if (savedCaseId) params.set('focusCaseId', savedCaseId);
    else if (Number.isFinite(legacyIndex) && legacyIndex > 0) params.set('focusIndex', String(legacyIndex));
    setIsLoading(true);
    try {
      const [response, activityResponse] = await Promise.all([
        fetch(`/api/test-runs/${runId}?${params}`, { signal: request.signal }),
        fetch(`/api/activity?projectId=${encodeURIComponent(projectId)}&entityType=TestRun&entityId=${encodeURIComponent(runId)}`, { signal: request.signal }),
      ]);
      const [data, activityData] = await Promise.all([response.json(), activityResponse.json()]);
      if (!response.ok) throw new Error(data.error || 'Gagal membuka Test Run.');
      if (!request.current() || currentRunId.current !== runId) return;
      setSelectedRun(data);
      setShowCreateRun(false);
      setRunName(data.name || '');
      setRunDescription(data.description || '');
      setRunAssignee(data.assignedTo || '');
      setRunStartDate(data.startDate ? String(data.startDate).slice(0, 10) : '');
      setRunEndDate(data.endDate ? String(data.endDate).slice(0, 10) : '');
      setRunTestPlanId(data.testPlanId || '');
      setActivities(activityResponse.ok ? activityData.activities || [] : []);
      const maxIndex = Math.max(0, data.testCases.length - 1);
      const foundIndex = savedCaseId ? data.testCases.findIndex((item: RunCase) => item.id === savedCaseId) : -1;
      const nextIndex = foundIndex >= 0 ? foundIndex : Math.max(0, Math.min(maxIndex, savedCaseId ? 0 : (legacyIndex || 0) - (data.casePage?.startOffset || 0)));
      setActiveCaseIndex(nextIndex);
      setCasePage(Math.floor(nextIndex / RUN_CASES_PER_PAGE));
      const nextCase = data.testCases?.[nextIndex];
      const savedNotes = nextCase ? readLocal(notesStorageKey(notesProjectScope, runId, nextCase.id)) : null;
      setNotes(savedNotes ?? nextCase?.executions?.[0]?.notes ?? '');
      setNotesDirty(savedNotes !== null);
      setError(null);
      setView('runner');
    } catch (loadError) {
      if (request.current()) setError(loadError instanceof Error ? loadError.message : 'Gagal membuka Test Run.');
    } finally {
      if (request.current()) setIsLoading(false);
    }
  }, [projectId, notesProjectScope, draft]);
  const runActions = useCommittedActions({ openRun });

  const loadEvidence = useCallback(async (cursor?: string) => {
    if (!canViewEvidence || !selectedRun || !activeExecution) return;
    const request = evidenceRequests.current.begin(); setEvidenceLoading(true);
    try {
      const params = new URLSearchParams({ projectId, limit: '25' }); if (cursor) params.set('cursor', cursor);
      const response = await fetch(`/api/test-runs/${selectedRun.id}/executions/${activeExecution.id}/evidence?${params}`, { signal: request.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal memuat evidence.');
      if (!request.current() || currentRunId.current !== selectedRun.id || currentExecutionId.current !== activeExecution.id) return;
      setEvidenceOwner(activeExecution.id);
      setActiveEvidence(current => cursor ? [...current, ...(data.evidence || []).filter((item: Evidence) => !current.some(old => old.id === item.id))] : data.evidence || []);
      setEvidenceCursor(data.nextCursor || null);
    } catch (cause) { if (request.current()) setError(cause instanceof Error ? cause.message : 'Gagal memuat evidence.'); }
    finally { if (request.current()) setEvidenceLoading(false); }
  }, [activeExecution?.id, canViewEvidence, projectId, selectedRun?.id]);

  useEffect(() => {
    const timer = setTimeout(() => void loadEvidence(), 0);
    return () => { clearTimeout(timer); evidenceRequests.current.cancel(); };
  }, [loadEvidence]);

  const loadMoreRunCases = useCallback(async (previous = false) => {
    if (!selectedRun || loadingCases || (previous ? !(selectedRun.casePage?.startOffset) : !selectedRun.casePage?.nextCursor)) return;
    const request = caseRequests.current.begin(); setLoadingCases(true);
    try {
      const params = new URLSearchParams({ projectId, limit: '100' });
      if (previous) params.set('offset', String(Math.max(0, (selectedRun.casePage?.startOffset || 0) - 100)));
      else params.set('cursor', selectedRun.casePage!.nextCursor!);
      const response = await fetch(`/api/test-runs/${selectedRun.id}/cases?${params}`, { signal: request.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal memuat testcase berikutnya.');
      if (!request.current() || currentRunId.current !== selectedRun.id) return;
      const existingIds = new Set(selectedRun.testCases.map(item => item.id));
      const added: RunCase[] = (data.testCases || []).filter((item: RunCase) => !existingIds.has(item.id));
      if (previous) setActiveCaseIndex(index => index + added.length);
      setSelectedRun(current => current?.id === selectedRun.id ? {
        ...current,
        testCases: previous ? [...added, ...current.testCases] : [...current.testCases, ...added],
        casePage: previous ? { ...current.casePage!, startOffset: data.startOffset || 0 } : { ...current.casePage!, hasMore: Boolean(data.hasMore), nextCursor: data.nextCursor || null },
      } : current);
    } catch (cause) { if (request.current()) throw cause; }
    finally { if (request.current()) setLoadingCases(false); }
  }, [projectId, selectedRun, loadingCases]);

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

  useEffect(() => {
    if (!pickerOpen || !selectedRun) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setPickerLoading(true);
      try {
        const params = new URLSearchParams({ projectId, view: 'options', limit: '25', page: String(pickerPage), search: pickerSearch, sortBy: 'testCaseId', sortOrder: 'asc' });
        const response = await fetch(`/api/testcases?${params}`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Gagal memuat pilihan testcase.');
        if (controller.signal.aborted || currentRunId.current !== selectedRun.id) return;
        setAvailableCases(data.testCases || []); setPickerPages(Math.max(1, data.totalPages || 1));
      } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Gagal memuat pilihan testcase.'); }
      finally { if (!controller.signal.aborted) setPickerLoading(false); }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [pickerOpen, pickerPage, pickerSearch, selectedRun?.id, projectId]);

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
      setManageRunOpen(false);
      await Promise.all([reloadRuns(), openRun(selectedRun.id)]);
      toast({ variant: 'success', title: 'Detail Test Cycle disimpan' });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Gagal menyimpan detail Test Run.');
    } finally {
      setIsSaving(false);
    }
  };

  const execute = useCallback(async (status: string) => {
    if (!canExecute || !selectedRun || !activeCase) return;
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
      setSelectedRun(current => !current || current.id !== selectedRun.id ? current : { ...current, testCases: current.testCases.map(item => item.id === activeCase.id ? { ...item, executions: [data] } : item) });
      try {
        const overviewResponse = await fetch(`/api/test-runs/${selectedRun.id}?projectId=${encodeURIComponent(projectId)}&view=summary`);
        const overview = await overviewResponse.json();
        if (!overviewResponse.ok) throw new Error('Ringkasan belum dapat dimuat.');
        setRuns(current => current.map(item => item.id === overview.id ? { ...item, summary: overview.summary, progress: overview.progress, _count: overview._count, status: overview.status } : item));
        setSelectedRun(current => !current || current.id !== overview.id ? current : { ...current, summary: overview.summary, progress: overview.progress, _count: overview._count, status: overview.status });
      } catch { toast({ title: 'Execution tersimpan', description: 'Ringkasan belum diperbarui. Muat ulang jika diperlukan; jangan mengirim ulang hasil.' }); }
      const draftKey = notesStorageKey(notesProjectScope, selectedRun.id, activeCase.id);
      draft.clear(draftKey);
      try { window.localStorage.removeItem(draftKey); } catch { /* Server result is already saved. */ }
      if (currentRunId.current === selectedRun.id) { setNotesDirty(false); setError(null); }
      toast({ variant: 'success', title: `${activeCase.testCaseId} · ${status}`, description: 'Tersimpan di cycle ini. Tekan N untuk lanjut.' });
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Gagal menyimpan execution.';
      setError(message);
      toast({ title: 'Execution gagal disimpan', description: message, variant: 'destructive' });
    } finally {
      setOptimisticStatus(null);
      setIsSaving(false);
    }
  }, [canExecute, activeCase, notes, notesProjectScope, projectId, selectedRun, toast, draft]);

  const chooseCase = useCallback((nextIndex: number) => {
    if (!selectedRun || isSaving || !draft.flush()) return;
    setActiveCaseIndex(nextIndex);
    setCasePage(Math.floor(nextIndex / RUN_CASES_PER_PAGE));
    const nextCase = selectedRun.testCases[nextIndex];
    const savedNotes = readLocal(notesStorageKey(notesProjectScope, selectedRun.id, nextCase.id));
    setNotes(savedNotes ?? nextCase?.executions?.[0]?.notes ?? '');
    setNotesDirty(savedNotes !== null);
  }, [notesProjectScope, selectedRun, isSaving, draft]);

  const moveCase = useCallback((delta: number) => {
    if (selectedRun) chooseCase(Math.max(0, Math.min(selectedRun.testCases.length - 1, activeCaseIndex + delta)));
  }, [selectedRun, chooseCase, activeCaseIndex]);

  const changeNotes = (value: string) => {
    if (!selectedRun || !activeCase) return;
    draft.stage(notesStorageKey(notesProjectScope, selectedRun.id, activeCase.id), value);
    setNotes(value); setNotesDirty(true);
  };

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
    if (!canCreateBug || (guest && activeExecution?.tester !== actorName) || !selectedRun || !activeExecution || activeExecution.status !== TEST_EXECUTION_STATUS.FAILED) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/test-runs/${selectedRun.id}/executions/${activeExecution.id}/bug?projectId=${encodeURIComponent(projectId)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal membuat bug.');
      setError(null);
      toast({ variant: 'success', title: 'Bug berhasil dibuat', description: `${activeCase?.testCaseId || 'Testcase'} sudah terhubung ke execution gagal.` });
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Gagal membuat bug.';
      setError(message);
      toast({ title: 'Gagal membuat bug', description: message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const uploadEvidence = async (file: File | undefined, replaceEvidenceId?: string) => {
    if (!canUploadEvidence || (guest && (activeExecution?.tester !== actorName || replaceEvidenceId)) || !selectedRun || !activeExecution || !file) return;
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
      if (currentExecutionId.current === activeExecution.id && currentRunId.current === selectedRun.id) setActiveEvidence(current => [data, ...current.filter(item => item.id !== replaceEvidenceId)]);
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
    if (!canEdit || !selectedRun || !activeExecution) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/test-runs/${selectedRun.id}/executions/${activeExecution.id}/evidence?projectId=${encodeURIComponent(projectId)}&evidenceId=${encodeURIComponent(evidenceId)}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal menghapus evidence.');
      if (currentExecutionId.current === activeExecution.id && currentRunId.current === selectedRun.id) setActiveEvidence(current => current.filter(item => item.id !== evidenceId));
      toast({ variant: 'success', title: 'Evidence dihapus' });
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Gagal menghapus evidence.');
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    const handleDragOver = (event: DragEvent) => {
      if (view !== 'runner') return;
      if (!canUploadEvidence || (guest && activeExecution?.tester !== actorName) || !activeExecution || !event.dataTransfer?.types.includes('Files')) return;
      event.preventDefault();
      setIsDraggingEvidence(true);
    };
    const handleDragLeave = (event: DragEvent) => {
      if (view !== 'runner') return;
      if (!event.relatedTarget) setIsDraggingEvidence(false);
    };
    const handleDrop = (event: DragEvent) => {
      if (view !== 'runner') return;
      if (!activeExecution || !event.dataTransfer?.files.length) return;
      const target = event.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.closest?.('[data-basketball-dropzone="true"]')) return;
      event.preventDefault();
      setIsDraggingEvidence(false);
      void uploadEvidence(event.dataTransfer.files[0]);
    };
    const handlePaste = (event: ClipboardEvent) => {
      if (view !== 'runner') return;
      const target = event.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || !canUploadEvidence || (guest && activeExecution?.tester !== actorName) || isSaving || !activeExecution) return;
      const imageItem = Array.from(event.clipboardData?.items || []).find(item => item.type.startsWith('image/'));
      const imageFile = imageItem?.getAsFile();
      if (!imageFile) return;
      event.preventDefault();
      void uploadEvidence(new File([imageFile], `pasted-evidence-${Date.now()}.png`, { type: imageFile.type || 'image/png' }));
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (view !== 'runner') return;
      const target = event.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;
      const shortcut = resolveExecutionShortcut(event.key, target?.tagName);
      if (canExecute && !isSaving && shortcut?.type === 'execute') {
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
  }, [view, activeExecution, actorName, guest, canExecute, canUploadEvidence, execute, isSaving, moveCase]);

  const assignedCaseIds = useMemo(() => new Set(selectedRun?.testCases.map(testCase => testCase.id) || []), [selectedRun?.testCases]);
  const selectableCases = availableCases.filter(testCase => !assignedCaseIds.has(testCase.id));
  const visibleRunCases = useMemo(() => {
    let cases = selectedRun?.testCases || [];
    if (caseStatusFilter !== 'ALL') {
      cases = cases.filter(testCase => {
        const latestStatus = testCase.executions[0]?.status || TEST_EXECUTION_STATUS.NOT_RUN;
        return latestStatus === caseStatusFilter;
      });
    }
    const query = caseSearch.trim().toLowerCase();
    if (!query) return cases;
    return cases.filter(testCase => `${testCase.testCaseId} ${testCase.page} ${testCase.testAction}`.toLowerCase().includes(query));
  }, [caseSearch, caseStatusFilter, selectedRun?.testCases]);

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
    <div className="qa-module-page qa-cycle-workspace flex flex-col gap-4">
      {error && <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-status-blocked">{error}</div>}

      {/* ==================== 1. CYCLES VIEW ==================== */}
      {view === 'cycles' && (() => {
        const totalCycles = runs.length;
        const inProgressCycles = runs.filter(r => r.status === 'IN PROGRESS').length;
        const completedCycles = runs.filter(r => r.status === 'COMPLETED').length;
        const totalCasesInRuns = runs.reduce((sum, r) => sum + (r.summary?.total || 0), 0);
        const totalPassedInRuns = runs.reduce((sum, r) => sum + (r.summary?.passed || 0), 0);
        const avgPass = totalCasesInRuns > 0 ? Math.round((totalPassedInRuns / totalCasesInRuns) * 100) : 0;

        const displayedRuns = runs.filter(r => {
          if (cycleFilterStatus !== 'ALL' && r.status !== cycleFilterStatus) return false;
          if (cycleSearch.trim()) {
            const q = cycleSearch.trim().toLowerCase();
            const matchName = r.name.toLowerCase().includes(q);
            const matchAssignee = r.assignedTo?.toLowerCase().includes(q);
            if (!matchName && !matchAssignee) return false;
          }
          return true;
        });

        return (
        <div className="space-y-4">
          {/* Top KPI Metrics Strip */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-border/80 bg-card p-4">
              <span className="text-xs font-medium text-muted-foreground">Total Siklus</span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-mono text-2xl font-bold text-foreground">{totalCycles}</span>
                <span className="text-xs text-muted-foreground">cycle</span>
              </div>
            </div>
            <div className="rounded-xl border border-border/80 bg-card p-4">
              <span className="text-xs font-medium text-muted-foreground">Sedang Berjalan</span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-mono text-2xl font-bold text-status-in-progress">{inProgressCycles}</span>
                <span className="text-xs text-muted-foreground">aktif</span>
              </div>
            </div>
            <div className="rounded-xl border border-border/80 bg-card p-4">
              <span className="text-xs font-medium text-muted-foreground">Siklus Selesai</span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-mono text-2xl font-bold text-status-passed">{completedCycles}</span>
                <span className="text-xs text-muted-foreground">final</span>
              </div>
            </div>
            <div className="rounded-xl border border-border/80 bg-card p-4">
              <span className="text-xs font-medium text-muted-foreground">Total Kasus Diuji</span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-mono text-2xl font-bold text-primary">{totalCasesInRuns}</span>
                <span className="text-xs text-muted-foreground">({avgPass}% pass)</span>
              </div>
            </div>
          </div>

          {/* Cycles Header & Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3">
            <div className="relative min-w-[200px] flex-1 max-w-sm">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Cari siklus pengujian..."
                value={cycleSearch}
                onChange={e => setCycleSearch(e.target.value)}
                className="h-8 pl-8 text-xs bg-background/50"
              />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Button variant={cycleFilterStatus === 'ALL' ? 'secondary' : 'ghost'} size="sm" onClick={() => setCycleFilterStatus('ALL')} className="h-8 text-xs font-medium">Semua ({runs.length})</Button>
              <Button variant={cycleFilterStatus === 'IN PROGRESS' ? 'secondary' : 'ghost'} size="sm" onClick={() => setCycleFilterStatus('IN PROGRESS')} className="h-8 text-xs font-medium">Berjalan ({inProgressCycles})</Button>
              <Button variant={cycleFilterStatus === 'DRAFT' ? 'secondary' : 'ghost'} size="sm" onClick={() => setCycleFilterStatus('DRAFT')} className="h-8 text-xs font-medium">Draft ({runs.filter(r => r.status === 'DRAFT').length})</Button>
              <Button variant={cycleFilterStatus === 'COMPLETED' ? 'secondary' : 'ghost'} size="sm" onClick={() => setCycleFilterStatus('COMPLETED')} className="h-8 text-xs font-medium">Selesai ({completedCycles})</Button>
              <div className="h-4 w-px bg-border/60 mx-1" />
              <MutationAction>
                <Button size="sm" onClick={openCreateRunForm} className="h-8 text-xs">
                  <Plus className="h-3.5 w-3.5 mr-1" />Cycle baru
                </Button>
              </MutationAction>
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                onClick={() => void reloadRuns()}
                disabled={isLoading}
                aria-label="Muat ulang cycle"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
            {isLoading && runs.length === 0 && (
              <div className="p-4 space-y-3" aria-label="Memuat Test Cycle">
                <Skeleton className="h-16 w-full rounded-lg" />
                <Skeleton className="h-16 w-full rounded-lg" />
                <Skeleton className="h-16 w-full rounded-lg" />
              </div>
            )}

            {!runs.length && !isLoading && (
              <div className="p-12 text-center flex flex-col items-center justify-center">
                <ListChecks className="size-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-semibold text-foreground">Belum ada Test Cycle</p>
                <p className="mt-1 text-xs text-muted-foreground">Buat cycle pertama untuk mulai execution.</p>
                <MutationAction>
                  <Button size="sm" className="mt-4" onClick={openCreateRunForm}>
                    <Plus className="h-4 w-4 mr-1.5" />Buat cycle
                  </Button>
                </MutationAction>
              </div>
            )}

            {runs.length > 0 && displayedRuns.length === 0 && !isLoading && (
              <EmptyState
                icon={Search}
                title="Tidak ada Test Cycle yang cocok"
                description={
                  cycleSearch
                    ? `Tidak ada siklus pengujian yang cocok dengan kata kunci "${cycleSearch}".`
                    : `Tidak ada siklus pengujian berstatus ${cycleFilterStatus === 'IN PROGRESS' ? 'Berjalan' : cycleFilterStatus === 'DRAFT' ? 'Draft' : 'Selesai'}.`
                }
                action={{
                  label: 'Reset Filter',
                  onClick: () => {
                    setCycleSearch('');
                    setCycleFilterStatus('ALL');
                  },
                  variant: 'outline',
                }}
                className="py-12"
              />
            )}

            {displayedRuns.map(run => {
              const isCurrent = selectedRun?.id === run.id;
              return (
                <div
                  key={run.id}
                  className={cn(
                    "flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 transition-colors hover:bg-secondary/30",
                    isCurrent && "bg-secondary/20"
                  )}
                >
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-sm text-foreground">{run.name}</span>
                      <Badge variant={run.status === 'COMPLETED' ? 'success' : run.status === 'IN PROGRESS' ? 'inprogress' : 'outline'}>
                        {run.status}
                      </Badge>
                      {run.assignedTo && (
                        <span className="text-xs text-muted-foreground">· {run.assignedTo}</span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                      <SimpleTooltip content={<span className="font-mono text-xs">Progres eksekusi: {run.progress}%</span>}>
                        <div className="flex items-center gap-2 min-w-[140px] max-w-[200px] flex-1 cursor-pointer">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                            <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${run.progress}%` }} />
                          </div>
                          <span className="font-mono tabular-nums text-[11px] font-medium">{run.progress}%</span>
                        </div>
                      </SimpleTooltip>
                      <span className="font-mono tabular-nums text-xs">{run.summary.completed}/{run.summary.total} cases</span>
                      <div className="flex items-center gap-2.5 font-mono tabular-nums text-xs">
                        <SimpleTooltip content={<span className="font-mono text-xs">Passed: {run.summary.passed}</span>}>
                          <span className="inline-flex items-center gap-1 cursor-pointer">
                            <span className="size-1.5 rounded-full bg-emerald-500" />
                            {run.summary.passed}
                          </span>
                        </SimpleTooltip>
                        <SimpleTooltip content={<span className="font-mono text-xs">Failed: {run.summary.failed}</span>}>
                          <span className="inline-flex items-center gap-1 cursor-pointer">
                            <span className="size-1.5 rounded-full bg-rose-500" />
                            {run.summary.failed}
                          </span>
                        </SimpleTooltip>
                        <SimpleTooltip content={<span className="font-mono text-xs">Blocked: {run.summary.blocked}</span>}>
                          <span className="inline-flex items-center gap-1 cursor-pointer">
                            <span className="size-1.5 rounded-full bg-amber-500" />
                            {run.summary.blocked}
                          </span>
                        </SimpleTooltip>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (selectedRun?.id === run.id) {
                          setManageRunOpen(true);
                        } else {
                          void runActions.openRun(run.id).then(() => setManageRunOpen(true));
                        }
                      }}
                      className="text-xs h-8"
                    >
                      Kelola
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        if (selectedRun?.id === run.id) {
                          setView('runner');
                        } else {
                          void runActions.openRun(run.id);
                        }
                      }}
                      className="text-xs h-8"
                    >
                      {run.progress > 0 && run.status !== 'COMPLETED' ? 'Lanjutkan' : 'Buka runner'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {nextRunCursor && (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => void loadMoreRuns().catch(err => setError(err instanceof Error ? err.message : 'Gagal memuat cycle.'))}
            >
              Muat cycle berikutnya
            </Button>
          )}
        </div>
        );
      })()}

      {/* ==================== 2. RUNNER VIEW ==================== */}
      {view === 'runner' && selectedRun && (
        <div className="space-y-4">
          {/* Runner Header */}
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (!draft.flush()) return;
                    setView('cycles');
                  }}
                  className="h-8 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Semua cycle
                </Button>
                <span className="text-muted-foreground/40">/</span>
                <h2 className="text-sm font-bold truncate text-foreground">{selectedRun.name}</h2>
                {selectedRun.assignedTo && (
                  <span className="text-xs text-muted-foreground hidden sm:inline">· {selectedRun.assignedTo}</span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={selectedRun.status} onValueChange={value => void updateRunStatus(value)} disabled={!canEdit || isSaving}>
                  <SelectTrigger aria-label="Status Test Run" className="h-8 w-32 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={TEST_RUN_STATUS.DRAFT} className="text-xs">Draft</SelectItem>
                    <SelectItem value={TEST_RUN_STATUS.READY} className="text-xs">Ready</SelectItem>
                    <SelectItem value={TEST_RUN_STATUS.IN_PROGRESS} className="text-xs">In Progress</SelectItem>
                    <SelectItem value={TEST_RUN_STATUS.COMPLETED} className="text-xs">Completed</SelectItem>
                    <SelectItem value={TEST_RUN_STATUS.ARCHIVED} className="text-xs">Archived</SelectItem>
                  </SelectContent>
                </Select>
                <div className="hidden sm:flex items-center gap-2.5 font-mono tabular-nums text-xs px-2">
                  <span className="inline-flex items-center gap-1 text-emerald-500 font-medium">
                    <span className="size-1.5 rounded-full bg-emerald-500" />
                    {selectedRun.summary.passed}
                  </span>
                  <span className="inline-flex items-center gap-1 text-rose-500 font-medium">
                    <span className="size-1.5 rounded-full bg-rose-500" />
                    {selectedRun.summary.failed}
                  </span>
                  <span className="inline-flex items-center gap-1 text-amber-500 font-medium">
                    <span className="size-1.5 rounded-full bg-amber-500" />
                    {selectedRun.summary.blocked}
                  </span>
                </div>
                <MutationAction>
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setManageRunOpen(true)}>
                    Kelola cycle
                  </Button>
                </MutationAction>
                <Button variant="outline" size="icon" className="size-8 min-[1440px]:hidden" onClick={() => setContextOpen(true)} aria-label="Buka execution context">
                  <PanelRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Thin Progress Bar + Case count */}
            <div className="flex items-center gap-3 pt-1">
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-secondary" aria-label={`Progress ${selectedRun.progress}%`}>
                <span className="block h-full origin-left rounded-full bg-primary transition-transform duration-200" style={{ transform: `scaleX(${selectedRun.progress / 100})` }} />
              </div>
              <span className="font-mono text-xs font-semibold text-foreground">{selectedRun.progress}%</span>
              {activeCase && (
                <span className="font-mono text-xs text-muted-foreground">
                  Case {(selectedRun.casePage?.startOffset || 0) + activeCaseIndex + 1}/{selectedRun.summary.total}
                </span>
              )}
            </div>
          </div>

          {/* Runner Layout: 2 Panels + 3rd Panel at >=1440px */}
          <div className="grid h-[calc(100svh-14rem)] min-h-[500px] gap-4 lg:grid-cols-[280px_minmax(0,1fr)] min-[1440px]:grid-cols-[280px_minmax(0,1fr)_320px] overflow-hidden">
            {/* Left Queue Rail (280px) */}
            <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3 overflow-hidden">
              <div className="relative shrink-0">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
                <Input
                  value={caseSearch}
                  onChange={event => setCaseSearch(event.target.value)}
                  placeholder="Cari testcase..."
                  className="h-8 pl-8 text-xs bg-background"
                />
              </div>

              {/* Status Filter Tabs for Runner Queue */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px] scrollbar-none shrink-0">
                <button
                  type="button"
                  onClick={() => setCaseStatusFilter('ALL')}
                  className={cn(
                    "rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors whitespace-nowrap",
                    caseStatusFilter === 'ALL'
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  Semua ({selectedRun.testCases.length})
                </button>
                <button
                  type="button"
                  onClick={() => setCaseStatusFilter('FAILED')}
                  className={cn(
                    "rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors whitespace-nowrap",
                    caseStatusFilter === 'FAILED'
                      ? "bg-red-500 text-white font-semibold"
                      : "bg-red-500/10 text-red-400 hover:bg-red-500/20"
                  )}
                >
                  Failed ({selectedRun.summary.failed})
                </button>
                <button
                  type="button"
                  onClick={() => setCaseStatusFilter('BLOCKED')}
                  className={cn(
                    "rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors whitespace-nowrap",
                    caseStatusFilter === 'BLOCKED'
                      ? "bg-amber-500 text-black font-semibold"
                      : "bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
                  )}
                >
                  Blocked ({selectedRun.summary.blocked})
                </button>
                <button
                  type="button"
                  onClick={() => setCaseStatusFilter('PASSED')}
                  className={cn(
                    "rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors whitespace-nowrap",
                    caseStatusFilter === 'PASSED'
                      ? "bg-emerald-500 text-white font-semibold"
                      : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                  )}
                >
                  Passed ({selectedRun.summary.passed})
                </button>
              </div>

              <div className="flex-1 space-y-1 overflow-y-auto pr-0.5">
                {Boolean(selectedRun.casePage?.startOffset) && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={loadingCases}
                    className="w-full text-xs h-7 mb-1"
                    onClick={() => void loadMoreRunCases(true).catch(err => setError(err instanceof Error ? err.message : 'Gagal memuat testcase sebelumnya.'))}
                  >
                    Muat testcase sebelumnya
                  </Button>
                )}

                {visibleRunCases.map((testCase, vIndex) => {
                  const index = selectedRun.testCases.findIndex(item => item.id === testCase.id);
                  const latestStatus = testCase.executions[0]?.status || TEST_EXECUTION_STATUS.NOT_RUN;
                  const isActive = index === activeCaseIndex;
                  return (
                    <button
                      key={testCase.id}
                      type="button"
                      disabled={isSaving}
                      onClick={() => chooseCase(index)}
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          const next = visibleRunCases[vIndex + 1];
                          if (next) {
                            const nextIndex = selectedRun.testCases.findIndex(item => item.id === next.id);
                            if (nextIndex >= 0) {
                              chooseCase(nextIndex);
                              const target = (e.currentTarget.parentElement?.children[vIndex + 1] as HTMLElement);
                              target?.focus();
                            }
                          }
                        } else if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          const prev = visibleRunCases[vIndex - 1];
                          if (prev) {
                            const prevIndex = selectedRun.testCases.findIndex(item => item.id === prev.id);
                            if (prevIndex >= 0) {
                              chooseCase(prevIndex);
                              const target = (e.currentTarget.parentElement?.children[vIndex - 1] as HTMLElement);
                              target?.focus();
                            }
                          }
                        }
                      }}
                      className={cn(
                        "flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
                        isActive
                          ? "border-l-2 border-primary bg-secondary/50 font-medium"
                          : "border-l-2 border-transparent hover:bg-secondary/30"
                      )}
                    >
                      <span className="font-mono tabular-nums text-xs text-muted-foreground w-5 shrink-0">
                        {(selectedRun.casePage?.startOffset || 0) + index + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-mono text-xs font-semibold text-foreground">
                          {testCase.testCaseId}
                        </span>
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {testCase.testAction}
                        </span>
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                        <span className={cn("size-2 rounded-full", statusDotClass(latestStatus))} />
                        <span className="text-[11px] font-mono text-muted-foreground">{latestStatus}</span>
                      </div>
                    </button>
                  );
                })}

                {selectedRun.casePage?.hasMore && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs h-7 mt-1"
                    onClick={() => void loadMoreRunCases().catch(err => setError(err instanceof Error ? err.message : 'Gagal memuat testcase.'))}
                  >
                    Muat testcase berikutnya
                  </Button>
                )}

                {!visibleRunCases.length && (
                  <p className="text-xs text-muted-foreground text-center py-6">Tidak ada testcase.</p>
                )}
              </div>
            </div>

            {/* Middle Canvas: Single surface */}
            <div className="flex flex-col min-h-0 h-full overflow-hidden rounded-xl border border-border bg-card p-5">
              {activeCase ? (
                <div key={activeCase.id} className="flex flex-col flex-1 min-h-0">
                  <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                    {/* Case Header */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-bold text-primary">{activeCase.testCaseId}</span>
                          <span className="text-xs text-muted-foreground">
                            · {activeCase.module?.name || 'Unassigned'} / {activeCase.page}{activeCase.subMenu ? ` / ${activeCase.subMenu}` : ''}
                          </span>
                        </div>
                        <Badge variant={statusVariant(visibleExecutionStatus)}>
                          {visibleExecutionStatus}
                        </Badge>
                      </div>
                      <h2 className="text-lg font-bold text-foreground pt-0.5">{activeCase.testAction}</h2>
                      {activeCaseIndex > 0 && (
                        <p className="text-xs text-muted-foreground pt-0.5">
                          Dilanjutkan dari {(selectedRun.casePage?.startOffset || 0) + activeCaseIndex + 1}/{selectedRun.summary.total}
                        </p>
                      )}
                    </div>

                    {/* Steps and Expected Result */}
                    <div className="grid gap-4 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border pt-1">
                      <div className="space-y-1.5">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Steps</h4>
                        <pre className="min-h-32 whitespace-pre-wrap rounded-lg bg-secondary/30 p-3 text-sm font-sans leading-6 text-foreground">
                          {activeCase.steps || '-'}
                        </pre>
                      </div>
                      <div className="space-y-1.5 md:pl-4 pt-4 md:pt-0">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Expected result</h4>
                        <div className="min-h-32 rounded-lg bg-secondary/30 p-3 text-sm leading-6 text-foreground">
                          {activeCase.expectedResult || '-'}
                        </div>
                      </div>
                    </div>

                    {/* Notes Area */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="execution-notes" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Execution notes
                        </Label>
                        <span className="text-xs text-muted-foreground">
                          {notesDirty ? 'Draft tersimpan lokal' : 'Tersimpan'}
                        </span>
                      </div>
                      <Textarea
                        readOnly={!canExecute || isSaving}
                        id="execution-notes"
                        value={notes}
                        onChange={event => changeNotes(event.target.value)}
                        placeholder="Catatan execution..."
                        className="min-h-24 bg-background"
                      />
                    </div>
                  </div>

                  {/* Command Bar (Pinned Bottom) */}
                  <div className="mt-3 shrink-0 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card/95 p-3 backdrop-blur-sm shadow-sm">
                    <Button
                      variant="outline"
                      className="h-10 text-xs"
                      onClick={() => moveCase(-1)}
                      disabled={activeCaseIndex === 0}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Previous
                    </Button>
                    <span className="font-mono text-xs text-muted-foreground px-2">
                      {(selectedRun.casePage?.startOffset || 0) + activeCaseIndex + 1}/{selectedRun.summary.total}
                    </span>

                    {EXECUTION_ACTIONS.map(action => {
                      const Icon = action.icon;
                      const active = visibleExecutionStatus === action.status;
                      return (
                        <Button
                          key={action.status}
                          variant={active ? 'default' : 'outline'}
                          className={cn(
                            "h-10 text-xs font-medium",
                            active ? action.activeClass : "border-border/70 text-foreground hover:bg-secondary/60"
                          )}
                          onClick={() => void execute(action.status)}
                          disabled={!canExecute || isSaving}
                          aria-pressed={active}
                        >
                          <Icon className="h-3.5 w-3.5 mr-1" />
                          {action.label}
                          <Kbd size="sm" className="ml-1.5 border-current/25 bg-current/10 text-current">
                            {action.shortcut}
                          </Kbd>
                        </Button>
                      );
                    })}

                    <Button
                      className="h-10 text-xs ml-auto"
                      onClick={() => moveCase(1)}
                      disabled={activeCaseIndex >= selectedRun.testCases.length - 1}
                    >
                      Next Case
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>

                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-9 text-muted-foreground hover:text-foreground shrink-0" aria-label="Informasi aturan execution">
                          <Info className="size-4" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80 text-xs leading-relaxed" align="end" side="top">
                        <p className="font-semibold text-foreground mb-1">Aturan Execution Cycle</p>
                        <p className="text-muted-foreground">
                          Hasil execution hanya berlaku untuk cycle ini; tidak otomatis mengubah status testcase inventory atau memverifikasi Bug.
                        </p>
                        <p className="mt-2 text-muted-foreground flex flex-wrap items-center gap-1">
                          <span>Shortcut:</span>
                          <Kbd size="sm">P</Kbd> Pass ·
                          <Kbd size="sm">F</Kbd> Fail ·
                          <Kbd size="sm">B</Kbd> Blocked ·
                          <Kbd size="sm">R</Kbd> Retest ·
                          <Kbd size="sm">N</Kbd> Next Case
                        </p>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border p-12 text-center flex flex-col items-center justify-center gap-3 my-auto">
                  <ListChecks className="size-8 text-muted-foreground/40" />
                  <p className="text-sm font-semibold text-foreground">Tambahkan testcase untuk mulai execution.</p>
                  <p className="text-xs text-muted-foreground max-w-sm">Cycle ini belum memiliki testcase yang ditugaskan.</p>
                  <Button size="sm" onClick={() => setManageRunOpen(true)} className="mt-2">
                    <Plus className="size-4 mr-1.5" />Kelola testcase cycle
                  </Button>
                </div>
              )}
            </div>

            {/* 3rd Column: Context Panel on >= 1440px */}
            <aside className="hidden min-w-0 min-[1440px]:block min-[1440px]:sticky min-[1440px]:top-20 min-[1440px]:max-h-[calc(100svh-6rem)] min-[1440px]:self-start min-[1440px]:overflow-y-auto">
              <ExecutionContextPanel
                selectedRun={selectedRun}
                activeCase={activeCase}
                activeExecution={activeExecution}
                activeEvidence={visibleEvidence}
                evidenceCursor={evidenceOwner === activeExecution?.id ? evidenceCursor : null}
                evidenceLoading={evidenceLoading}
                loadMoreEvidence={() => void loadEvidence(evidenceCursor || undefined)}
                activities={activities}
                projectId={projectId}
                isSaving={isSaving}
                isDraggingEvidence={isDraggingEvidence}
                uploadEvidence={uploadEvidence}
                removeEvidence={removeEvidence}
                createBug={createBug}
              />
            </aside>
          </div>
        </div>
      )}

      {/* ==================== 3. SHEET: CYCLE BARU ==================== */}
      <Sheet open={showCreateRun} onOpenChange={setShowCreateRun}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto p-0">
          <SheetHeader className="border-b border-border/40 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                <Plus className="h-5 w-5" />
              </div>
              <div>
                <SheetTitle className="text-base font-semibold text-foreground tracking-tight">Test Cycle Baru</SheetTitle>
                <SheetDescription className="text-xs text-muted-foreground mt-0.5">Buat cycle pengujian baru untuk project ini.</SheetDescription>
              </div>
            </div>
          </SheetHeader>
          <div className="p-5 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-run-name">Nama cycle <span className="text-destructive">*</span></Label>
              <Input
                id="new-run-name"
                value={runName}
                onChange={event => setRunName(event.target.value)}
                placeholder="Regression Release 1.2"
                className="h-10 rounded-xl border-border/60 bg-secondary/30 text-sm font-medium"
              />
              {!runName.trim() && <p className="text-xs text-muted-foreground">Nama cycle wajib diisi.</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-run-description">Deskripsi</Label>
              <Textarea
                id="new-run-description"
                value={runDescription}
                onChange={event => setRunDescription(event.target.value)}
                placeholder="Tujuan dan ruang lingkup cycle"
                className="min-h-20 rounded-xl border-border/60 bg-secondary/30 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-run-assignee">Tester / assignee</Label>
              <Input
                id="new-run-assignee"
                value={runAssignee}
                onChange={event => setRunAssignee(event.target.value)}
                placeholder="Nama tester (opsional)"
                className="h-10 rounded-xl border-border/60 bg-secondary/30 text-sm font-medium"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Periode cycle</Label>
              <DateRangePicker
                from={runStartDate}
                to={runEndDate}
                onFromChange={setRunStartDate}
                onToChange={setRunEndDate}
                label="Pilih periode cycle"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Test Plan</Label>
              <Select value={runTestPlanId || 'none'} onValueChange={value => setRunTestPlanId(value === 'none' ? '' : value)}>
                <SelectTrigger className="h-10 rounded-xl border-border/60 bg-secondary/30 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-xl shadow-lg border-border/60 bg-card">
                  <SelectItem value="none">Tanpa Test Plan</SelectItem>
                  {testPlans.map(plan => <SelectItem key={plan.id} value={plan.id}>{plan.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full mt-2 h-10 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-medium text-xs shadow-sm" onClick={() => void createRun()} disabled={isSaving || !runName.trim()}>
              <Plus className="h-4 w-4 mr-1.5" />Buat Test Cycle
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ==================== 4. SHEET: KELOLA CYCLE ==================== */}
      <Sheet open={manageRunOpen} onOpenChange={setManageRunOpen}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto p-0">
          <SheetHeader className="border-b border-border/40 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                <SlidersHorizontal className="h-5 w-5" />
              </div>
              <div>
                <SheetTitle className="text-base font-semibold text-foreground tracking-tight">Kelola Test Cycle</SheetTitle>
                <SheetDescription className="text-xs text-muted-foreground mt-0.5">
                  {selectedRun ? `${selectedRun.name} · ${selectedRun.summary.total} testcase` : 'Tambahkan atau kurangi test case dalam cycle ini.'}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>
          {selectedRun && (
            <div className="p-5 space-y-6">
              {/* Metadata & Status */}
              <div className="space-y-4 rounded-xl border border-border bg-card p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Detail & Status</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="manage-run-name">Nama cycle <span className="text-destructive">*</span></Label>
                    <Input id="manage-run-name" value={runName} onChange={e => setRunName(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Status cycle</Label>
                    <Select value={selectedRun.status} onValueChange={v => void updateRunStatus(v)} disabled={!canEdit || isSaving}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={TEST_RUN_STATUS.DRAFT}>Draft</SelectItem>
                        <SelectItem value={TEST_RUN_STATUS.READY}>Ready</SelectItem>
                        <SelectItem value={TEST_RUN_STATUS.IN_PROGRESS}>In Progress</SelectItem>
                        <SelectItem value={TEST_RUN_STATUS.COMPLETED}>Completed</SelectItem>
                        <SelectItem value={TEST_RUN_STATUS.ARCHIVED}>Archived</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="manage-run-assignee">Assignee</Label>
                    <Input id="manage-run-assignee" value={runAssignee} onChange={e => setRunAssignee(e.target.value)} placeholder="Tester / assignee" />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="manage-run-desc">Deskripsi</Label>
                    <Textarea id="manage-run-desc" value={runDescription} onChange={e => setRunDescription(e.target.value)} className="min-h-16" />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Periode cycle</Label>
                    <DateRangePicker from={runStartDate} to={runEndDate} onFromChange={setRunStartDate} onToChange={setRunEndDate} label="Pilih periode cycle" />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Test Plan</Label>
                    <Select value={runTestPlanId || 'none'} onValueChange={v => setRunTestPlanId(v === 'none' ? '' : v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Tanpa Test Plan</SelectItem>
                        {testPlans.map(plan => <SelectItem key={plan.id} value={plan.id}>{plan.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button onClick={() => void updateRunDetails()} disabled={isSaving || !runName.trim()} className="w-full">
                  Simpan detail
                </Button>
              </div>

              {/* Testcase Management */}
              <div className="space-y-4 rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Testcase dalam Run</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{selectedRun.testCases.length} testcase terdaftar</p>
                  </div>
                  <MutationAction>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setPickerOpen(v => !v);
                        setPickerPage(1);
                        setPickerSearch('');
                        setAvailableCases([]);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      {pickerOpen ? 'Tutup picker' : 'Tambah testcase'}
                    </Button>
                  </MutationAction>
                </div>

                {pickerOpen && (
                  <div className="space-y-3 rounded-lg border border-border bg-secondary/20 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold">Pilih testcase untuk ditambahkan</span>
                      <Button size="sm" onClick={() => void addCases()} disabled={isSaving || selectedCaseIds.size === 0} className="h-8 text-xs">
                        Tambahkan pilihan ({selectedCaseIds.size})
                      </Button>
                    </div>
                    <Input
                      aria-label="Cari testcase untuk Test Run"
                      placeholder="Cari ID, halaman, atau aksi…"
                      value={pickerSearch}
                      onChange={e => {
                        setPickerSearch(e.target.value);
                        setPickerPage(1);
                        setAvailableCases([]);
                      }}
                      className="h-8 text-xs bg-background"
                    />
                    {pickerLoading && <p role="status" className="text-xs text-muted-foreground">Memuat pilihan…</p>}
                    <div className="max-h-48 space-y-1 overflow-auto">
                      {selectableCases.map(testCase => (
                        <label key={testCase.id} className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-xs hover:bg-secondary/60">
                          <input
                            type="checkbox"
                            checked={selectedCaseIds.has(testCase.id)}
                            onChange={e => setSelectedCaseIds(prev => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(testCase.id);
                              else next.delete(testCase.id);
                              return next;
                            })}
                            className="rounded border-border"
                          />
                          <span className="font-mono font-semibold text-primary">{testCase.testCaseId}</span>
                          <span className="text-muted-foreground truncate">{testCase.page}</span>
                        </label>
                      ))}
                      {!selectableCases.length && !pickerLoading && (
                        <p className="text-xs text-muted-foreground py-2 text-center">Semua testcase yang sesuai sudah dimasukkan.</p>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/50 text-xs text-muted-foreground">
                      <Button variant="ghost" size="sm" className="h-7 px-2" disabled={pickerLoading || pickerPage <= 1} onClick={() => { setAvailableCases([]); setPickerPage(v => v - 1); }}>Sebelumnya</Button>
                      <span>Halaman {pickerPage} dari {pickerPages}</span>
                      <Button variant="ghost" size="sm" className="h-7 px-2" disabled={pickerLoading || pickerPage >= pickerPages} onClick={() => { setAvailableCases([]); setPickerPage(v => v + 1); }}>Berikutnya</Button>
                    </div>
                  </div>
                )}

                {selectedRun.testCases.length > 0 ? (() => {
                  const totalCasePages = Math.max(1, Math.ceil(selectedRun.testCases.length / RUN_CASES_PER_PAGE));
                  const page = Math.min(casePage, totalCasePages - 1);
                  const pageStart = page * RUN_CASES_PER_PAGE;
                  const pageCases = selectedRun.testCases.slice(pageStart, pageStart + RUN_CASES_PER_PAGE);
                  return (
                    <div className="space-y-1.5">
                      {pageCases.map(testCase => {
                        const index = selectedRun.testCases.findIndex(item => item.id === testCase.id);
                        return (
                          <div key={testCase.id} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-secondary/15 px-3 py-2 text-xs">
                            <div className="min-w-0 flex-1 truncate">
                              <span className="mr-2 font-mono text-muted-foreground">{index + 1}.</span>
                              <span className="font-mono font-semibold text-primary mr-2">{testCase.testCaseId}</span>
                              <span className="text-muted-foreground">{testCase.page}</span>
                            </div>
                            <MutationAction>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                                disabled={isSaving}
                                onClick={async () => {
                                  const response = await fetch(`/api/test-runs/${selectedRun.id}/cases?projectId=${encodeURIComponent(projectId)}&testCaseId=${encodeURIComponent(testCase.id)}`, { method: 'DELETE' });
                                  if (!response.ok) {
                                    const data = await response.json().catch(() => ({}));
                                    setError(data.error || 'Gagal menghapus testcase dari Test Run.');
                                    return;
                                  }
                                  await runActions.openRun(selectedRun.id);
                                }}
                                aria-label={`Hapus ${testCase.testCaseId} dari Test Run`}
                              >
                                Hapus
                              </Button>
                            </MutationAction>
                          </div>
                        );
                      })}
                      {totalCasePages > 1 && (
                        <div className="flex items-center justify-between gap-2 pt-2 text-xs text-muted-foreground">
                          <Button variant="outline" size="sm" className="h-7 px-2" disabled={page === 0} onClick={() => setCasePage(page - 1)}>
                            <ChevronLeft className="h-3.5 w-3.5 mr-1" />Sebelumnya
                          </Button>
                          <span>{pageStart + 1}–{pageStart + pageCases.length} dari {selectedRun.testCases.length}</span>
                          <Button variant="outline" size="sm" className="h-7 px-2" disabled={page >= totalCasePages - 1} onClick={() => setCasePage(page + 1)}>
                            Berikutnya<ChevronRight className="h-3.5 w-3.5 ml-1" />
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })() : (
                  <p className="text-xs text-muted-foreground">Belum ada testcase di Test Run ini.</p>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ==================== 5. SHEET: CONTEXT PANEL (<1440px) ==================== */}
      <Sheet open={contextOpen} onOpenChange={setContextOpen}>
        <SheetContent side="right" className="w-full p-0 sm:max-w-md">
          <SheetHeader className="border-b border-border/40 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                <PanelRight className="h-4 w-4" />
              </div>
              <div>
                <SheetTitle className="text-sm font-semibold text-foreground tracking-tight">Execution Context</SheetTitle>
                <SheetDescription className="text-xs text-muted-foreground mt-0.5">Evidence, bug, tester, dan riwayat case aktif.</SheetDescription>
              </div>
            </div>
          </SheetHeader>
          <div className="h-[calc(100dvh-5rem)] overflow-y-auto p-4">
            {selectedRun ? (
              <ExecutionContextPanel
                selectedRun={selectedRun}
                activeCase={activeCase}
                activeExecution={activeExecution}
                activeEvidence={visibleEvidence}
                evidenceCursor={evidenceOwner === activeExecution?.id ? evidenceCursor : null}
                evidenceLoading={evidenceLoading}
                loadMoreEvidence={() => void loadEvidence(evidenceCursor || undefined)}
                activities={activities}
                projectId={projectId}
                isSaving={isSaving}
                isDraggingEvidence={isDraggingEvidence}
                uploadEvidence={uploadEvidence}
                removeEvidence={removeEvidence}
                createBug={createBug}
              />
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function ExecutionContextPanel({ selectedRun, activeCase, activeExecution, activeEvidence, activities, projectId, isSaving, isDraggingEvidence, uploadEvidence, removeEvidence, createBug, evidenceCursor, evidenceLoading, loadMoreEvidence }: {
  selectedRun: TestRunDetail;
  activeCase: RunCase | null;
  activeExecution: Execution | null;
  activeEvidence: Evidence[];
  evidenceCursor: string | null;
  evidenceLoading: boolean;
  loadMoreEvidence: () => void;
  activities: Activity[];
  projectId: string;
  isSaving: boolean;
  isDraggingEvidence: boolean;
  uploadEvidence: (file: File | undefined, replaceEvidenceId?: string) => Promise<void>;
  removeEvidence: (id: string) => Promise<void>;
  createBug: () => Promise<void>;
}) {
  const { canEdit, canExecute, canViewEvidence, canUploadEvidence, canCreateBug, actorName, guest } = useWorkspaceAccess();
  return (
    <div className="qa-module-form qa-module-toolbar flex min-w-0 flex-col gap-4">
      <section className="rounded-xl border border-border/70 bg-card p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Execution</p>
        <p className="mt-3 text-sm font-medium">{activeExecution ? new Date(activeExecution.createdAt).toLocaleString() : 'Belum dijalankan'}</p>
        <p className="mt-1 text-xs text-muted-foreground">{activeExecution?.tester || selectedRun.assignedTo || 'Tester belum ditentukan'}</p>
        {activeExecution?.status === TEST_EXECUTION_STATUS.FAILED && (
          <>
            <Button variant="destructive" className="mt-4 w-full" onClick={() => void createBug()} disabled={!canCreateBug || (Boolean(guest) && activeExecution.tester !== actorName) || isSaving}>
              <Bug data-icon="inline-start" />Create Bug
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">
              Create Bug menghubungkan execution gagal dengan testcase inventory. Retest Bug diselesaikan melalui status/hasil testcase inventory.
            </p>
          </>
        )}
      </section>

      <section className="rounded-xl border border-border/70 bg-card p-4">
        <p className="text-sm font-semibold">Evidence</p>
        {canUploadEvidence && (!guest || activeExecution?.tester === actorName) && (
          <div className="mt-3">
            <BasketballUploadDropzone
              compact
              title="Upload Evidence"
              subtitle="Drag and drop, paste, or take the shot."
              dropLabel="Drop, paste, atau pilih file"
              helperText="PNG, JPEG, WebP, GIF, MP4, WebM, atau PDF · maks. 25 MB"
              accept="image/*,video/mp4,video/webm,application/pdf"
              defaultBadge="EVID"
              disabled={!canUploadEvidence || isSaving || !activeExecution}
              busy={isSaving}
              uploadedCount={activeEvidence.length}
              onFileSelect={(file) => { void uploadEvidence(file); }}
            />
          </div>
        )}
        <div className="mt-3 flex flex-col gap-2">
          {!canViewEvidence ? (
            <p className="text-xs text-muted-foreground">Admin belum memberikan izin melihat evidence.</p>
          ) : activeEvidence.length ? (
            activeEvidence.map(item => (
              <div key={item.id} className="flex items-center gap-2 rounded-lg bg-secondary/40 px-3 py-2 text-xs">
                <a className="min-w-0 flex-1 truncate text-primary hover:underline" href={`/api/test-runs/${selectedRun.id}/executions/${activeExecution?.id}/evidence/${item.id}?projectId=${encodeURIComponent(projectId)}`} target="_blank" rel="noreferrer">
                  {item.fileName}
                </a>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive" onClick={() => void removeEvidence(item.id)} disabled={!canEdit || isSaving}>
                  Hapus
                </Button>
              </div>
            ))
          ) : (
            <p className="text-xs text-muted-foreground">{activeExecution ? 'Belum ada evidence.' : 'Jalankan testcase sebelum menambah evidence.'}</p>
          )}
        </div>
        {evidenceLoading && <p role="status" className="mt-2 text-sm text-muted-foreground">Memuat evidence…</p>}
        {canViewEvidence && evidenceCursor && (
          <Button variant="outline" size="sm" className="mt-3 w-full" disabled={evidenceLoading} onClick={loadMoreEvidence}>
            Muat evidence berikutnya
          </Button>
        )}
        {canViewEvidence && activeEvidence.length > 0 && activeExecution?.id ? (
          <ExecutionEvidencePreview
            evidence={activeEvidence}
            testRunId={selectedRun.id}
            executionId={activeExecution.id}
            projectId={projectId}
            onReplace={canEdit ? (id, file) => void uploadEvidence(file, id) : undefined}
          />
        ) : null}
      </section>

      <section className="rounded-xl border border-border/70 bg-card p-4">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <History className="size-4" /> History
        </p>
        <div className="mt-3 max-h-52 space-y-3 overflow-y-auto">
          {activities.length ? (
            activities.slice(0, 12).map(activity => (
              <div key={activity.id} className="border-l-2 border-primary/30 pl-3">
                <p className="text-xs font-semibold">{activity.action}{activity.field ? ` · ${activity.field}` : ''}</p>
                <p className="text-xs text-muted-foreground">{new Date(activity.createdAt).toLocaleString()}</p>
              </div>
            ))
          ) : (
            <p className="text-xs text-muted-foreground">Belum ada history.</p>
          )}
        </div>
      </section>
      {activeCase && (
        <p className="px-1 text-xs text-muted-foreground">
          Context aktif: <span className="font-mono text-foreground">{activeCase.testCaseId}</span>
        </p>
      )}
    </div>
  );
}
