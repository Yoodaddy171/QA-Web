'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, CircleAlert, CircleDot, ListChecks, Loader2, Plus, RefreshCw, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ExecutionEvidencePreview } from '@/components/ExecutionEvidencePreview';
import { TEST_EXECUTION_STATUS } from '@/lib/domain/test-run';
import { TEST_RUN_STATUS } from '@/lib/domain/test-run';

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
  { status: TEST_EXECUTION_STATUS.PASSED, label: 'Pass', shortcut: 'P', icon: Check, variant: 'success' as const },
  { status: TEST_EXECUTION_STATUS.FAILED, label: 'Fail', shortcut: 'F', icon: X, variant: 'failed' as const },
  { status: TEST_EXECUTION_STATUS.BLOCKED, label: 'Blocked', shortcut: 'B', icon: CircleAlert, variant: 'blocked' as const },
  { status: TEST_EXECUTION_STATUS.RETEST, label: 'Retest', shortcut: 'R', icon: RefreshCw, variant: 'readyretest' as const },
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

export function TestRunsPanel({ projectId }: { projectId: string }) {
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
  const [notes, setNotes] = useState('');
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeCase = selectedRun?.testCases[activeCaseIndex] || null;
  const activeExecution = activeCase?.executions[0] || null;
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
      const response = await fetch(`/api/test-runs/${runId}?projectId=${encodeURIComponent(projectId)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal membuka Test Run.');
      setSelectedRun(data);
      setRunName(data.name || '');
      setRunDescription(data.description || '');
      setRunAssignee(data.assignedTo || '');
      setRunStartDate(data.startDate ? String(data.startDate).slice(0, 10) : '');
      setRunEndDate(data.endDate ? String(data.endDate).slice(0, 10) : '');
      setRunTestPlanId(data.testPlanId || '');
      const activityResponse = await fetch(`/api/activity?projectId=${encodeURIComponent(projectId)}&entityType=TestRun&entityId=${encodeURIComponent(runId)}`);
      const activityData = await activityResponse.json();
      setActivities(activityResponse.ok ? activityData.activities || [] : []);
      const storedIndex = Number.parseInt(window.localStorage.getItem(lastCaseStorageKey(projectId, runId)) || '0', 10);
      const maxIndex = Math.max(0, data.testCases.length - 1);
      const nextIndex = Number.isFinite(storedIndex) ? Math.max(0, Math.min(maxIndex, storedIndex)) : 0;
      setActiveCaseIndex(nextIndex);
      setNotes(data.testCases?.[nextIndex]?.executions?.[0]?.notes || '');
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
      setError(data.added ? `${data.added} testcase ditambahkan.` : 'Testcase sudah ada di Test Run.');
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
    setIsSaving(true);
    try {
      const response = await fetch(`/api/test-runs/${selectedRun.id}/executions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, testCaseId: activeCase.id, status, notes, tester: selectedRun.assignedTo || undefined }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal menyimpan execution.');
      await openRun(selectedRun.id);
      setError(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Gagal menyimpan execution.');
    } finally {
      setIsSaving(false);
    }
  }, [activeCase, notes, openRun, projectId, selectedRun]);

  const moveCase = useCallback((delta: number) => {
    if (!selectedRun) return;
    setActiveCaseIndex(index => {
      const nextIndex = Math.max(0, Math.min(selectedRun.testCases.length - 1, index + delta));
      window.localStorage.setItem(lastCaseStorageKey(projectId, selectedRun.id), String(nextIndex));
      setNotes(selectedRun.testCases[nextIndex]?.executions?.[0]?.notes || '');
      return nextIndex;
    });
  }, [projectId, selectedRun]);

  const createBug = async () => {
    if (!selectedRun || !activeExecution || activeExecution.status !== TEST_EXECUTION_STATUS.FAILED) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/test-runs/${selectedRun.id}/executions/${activeExecution.id}/bug?projectId=${encodeURIComponent(projectId)}`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal membuat bug.');
      setError(`Bug untuk ${activeCase?.testCaseId || 'testcase'} berhasil dibuat.`);
      await openRun(selectedRun.id);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Gagal membuat bug.');
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
      setError(`${file.name} berhasil ditambahkan.`);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Gagal mengunggah evidence.');
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
    };
    const handleDrop = (event: DragEvent) => {
      if (!activeExecution || !event.dataTransfer?.files.length) return;
      const target = event.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;
      event.preventDefault();
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
      const action = EXECUTION_ACTIONS.find(item => item.shortcut.toLowerCase() === event.key.toLowerCase());
      if (action) {
        event.preventDefault();
        void execute(action.status);
      } else if (event.key.toLowerCase() === 'n') {
        event.preventDefault();
        moveCase(1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('paste', handlePaste);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('paste', handlePaste);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, [activeExecution, execute, isSaving, moveCase]);

  const assignedCaseIds = useMemo(() => new Set(selectedRun?.testCases.map(testCase => testCase.id) || []), [selectedRun?.testCases]);
  const selectableCases = availableCases.filter(testCase => !assignedCaseIds.has(testCase.id));

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">QA execution</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Test Runs</h1>
          <p className="mt-1 text-sm text-muted-foreground">Jalankan testcase dalam cycle yang terukur dan simpan hasil historisnya.</p>
        </div>
        <Button variant="outline" onClick={() => void reloadRuns()} disabled={isLoading}><RefreshCw className="h-4 w-4" />Refresh</Button>
      </div>

      {error && <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">{error}</div>}

      <div className="grid gap-5 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.8fr)]">
        <Card padding="none">
          <CardHeader className="border-b border-border/70 py-5">
            <CardTitle className="flex items-center gap-2"><ListChecks className="h-4 w-4 text-primary" /> Test Run list</CardTitle>
            <CardDescription>{runs.length} cycle pada project ini</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 py-5">
            <div className="space-y-2 rounded-xl border border-dashed border-border/80 p-3">
              <Input value={runName} onChange={event => setRunName(event.target.value)} placeholder="Nama cycle baru" aria-label="Nama Test Run" />
              <Textarea value={runDescription} onChange={event => setRunDescription(event.target.value)} placeholder="Deskripsi singkat (opsional)" className="min-h-16" />
              <Input value={runAssignee} onChange={event => setRunAssignee(event.target.value)} placeholder="Tester / assignee (opsional)" aria-label="Tester atau assignee" />
              <div className="grid grid-cols-2 gap-2"><Input type="date" value={runStartDate} onChange={event => setRunStartDate(event.target.value)} aria-label="Tanggal mulai Test Run" /><Input type="date" value={runEndDate} onChange={event => setRunEndDate(event.target.value)} aria-label="Tanggal selesai Test Run" /></div>
              <select value={runTestPlanId} onChange={event => setRunTestPlanId(event.target.value)} aria-label="Test Plan" className="h-9 rounded-md border border-border bg-background px-3 text-xs"><option value="">Tanpa Test Plan</option>{testPlans.map(plan => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</select>
              <Button className="w-full" onClick={() => void createRun()} disabled={isSaving || !runName.trim()}><Plus className="h-4 w-4" />Create Test Run</Button>
            </div>
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
            {!runs.length && !isLoading && <p className="py-6 text-center text-sm text-muted-foreground">Belum ada Test Run.</p>}
          </CardContent>
        </Card>

        <Card padding="none">
          {!selectedRun ? (
            <div className="flex min-h-[480px] flex-col items-center justify-center gap-3 p-8 text-center"><CircleDot className="h-10 w-10 text-muted-foreground/40" /><h2 className="text-lg font-semibold">Pilih Test Run</h2><p className="max-w-sm text-sm text-muted-foreground">Buat atau pilih cycle untuk mulai menambahkan testcase dan menjalankan execution.</p></div>
          ) : (
            <>
              <CardHeader className="border-b border-border/70 py-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><CardTitle>{selectedRun.name}</CardTitle><CardDescription className="mt-1">{selectedRun.description || 'Execution workspace'}{selectedRun.assignedTo ? ` · ${selectedRun.assignedTo}` : ''}</CardDescription><Button size="sm" variant="ghost" className="mt-2 px-0" onClick={() => setEditingRun(true)}>Edit details</Button></div><div className="flex flex-wrap items-center gap-2"><select value={selectedRun.status} onChange={event => void updateRunStatus(event.target.value)} disabled={isSaving} className="h-9 rounded-md border border-border bg-background px-3 text-xs font-medium"><option value={TEST_RUN_STATUS.DRAFT}>Draft</option><option value={TEST_RUN_STATUS.READY}>Ready</option><option value={TEST_RUN_STATUS.IN_PROGRESS}>In Progress</option><option value={TEST_RUN_STATUS.COMPLETED}>Completed</option><option value={TEST_RUN_STATUS.ARCHIVED}>Archived</option></select><Badge variant="info">{selectedRun.summary.passed} passed</Badge><Badge variant="failed">{selectedRun.summary.failed} failed</Badge><Badge variant="blocked">{selectedRun.summary.blocked} blocked</Badge></div></div>{editingRun && <div className="mt-4 space-y-2"><Input value={runName} onChange={event => setRunName(event.target.value)} aria-label="Edit nama Test Run" /><Textarea value={runDescription} onChange={event => setRunDescription(event.target.value)} className="min-h-16" aria-label="Edit deskripsi Test Run" /><Input value={runAssignee} onChange={event => setRunAssignee(event.target.value)} placeholder="Tester / assignee" aria-label="Edit assignee Test Run" /><div className="flex gap-2"><Button size="sm" onClick={() => void updateRunDetails()} disabled={isSaving || !runName.trim()}>Save details</Button><Button size="sm" variant="ghost" onClick={() => setEditingRun(false)}>Cancel</Button></div></div>}</CardHeader>
              <CardContent className="space-y-5 py-5">
                <div className="flex flex-wrap items-end gap-2 rounded-xl border border-border/70 bg-secondary/20 p-3"><label className="space-y-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Start date<Input type="date" value={runStartDate} onChange={event => setRunStartDate(event.target.value)} /></label><label className="space-y-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">End date<Input type="date" value={runEndDate} onChange={event => setRunEndDate(event.target.value)} /></label><label className="space-y-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Test Plan<select value={runTestPlanId} onChange={event => setRunTestPlanId(event.target.value)} className="h-9 rounded-md border border-border bg-background px-2 text-xs"><option value="">Tanpa Test Plan</option>{testPlans.map(plan => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</select></label><Button size="sm" variant="outline" onClick={() => void updateRunDates()} disabled={isSaving}>Save metadata</Button></div>
                {activeExecution?.evidence?.length && activeExecution.id && <ExecutionEvidencePreview evidence={activeExecution.evidence} testRunId={selectedRun.id} executionId={activeExecution.id} projectId={projectId} onReplace={(evidenceId, file) => void uploadEvidence(file, evidenceId)} />}
                <div className="grid gap-3 sm:grid-cols-4"><Metric label="Total" value={selectedRun.summary.total} /><Metric label="Completed" value={selectedRun.summary.completed} /><Metric label="Not run" value={selectedRun.summary.notRun} /><Metric label="Progress" value={`${selectedRun.progress}%`} /></div>
                <div className="flex flex-wrap items-center gap-2"><Button variant="outline" size="sm" onClick={() => { void loadAvailableCases(); }}><Plus className="h-4 w-4" />Load testcase picker</Button>{selectedRun.testCases.length > 0 && <span className="text-xs text-muted-foreground">Keyboard: P pass · F fail · B blocked · R retest · N next</span>}</div>
                {availableCases.length > 0 && <div className="space-y-3 rounded-xl border border-border/70 p-4"><div className="flex items-center justify-between"><p className="text-sm font-semibold">Tambah testcase</p><Button size="sm" onClick={() => void addCases()} disabled={isSaving || selectedCaseIds.size === 0}>Add selected ({selectedCaseIds.size})</Button></div><div className="max-h-44 space-y-1 overflow-auto">{selectableCases.map(testCase => <label key={testCase.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-secondary/60"><input type="checkbox" checked={selectedCaseIds.has(testCase.id)} onChange={event => setSelectedCaseIds(previous => { const next = new Set(previous); if (event.target.checked) next.add(testCase.id); else next.delete(testCase.id); return next; })} /><span className="font-mono font-semibold">{testCase.testCaseId}</span><span className="text-muted-foreground">{testCase.page}</span></label>)}{!selectableCases.length && <p className="text-sm text-muted-foreground">Semua testcase sudah dimasukkan.</p>}</div></div>}
                {selectedRun.testCases.length > 0 && <div className="space-y-2 rounded-xl border border-border/70 p-4"><p className="text-sm font-semibold">Testcase dalam run</p>{selectedRun.testCases.map(testCase => <div key={testCase.id} className="flex items-center justify-between gap-3 rounded-lg bg-secondary/30 px-3 py-2 text-xs"><button type="button" className="min-w-0 truncate text-left hover:text-primary" onClick={() => setActiveCaseIndex(selectedRun.testCases.findIndex(item => item.id === testCase.id))}><span className="font-mono font-semibold">{testCase.testCaseId}</span><span className="ml-2 text-muted-foreground">{testCase.page}</span></button><Button variant="ghost" size="sm" className="h-7 px-2 text-destructive" disabled={isSaving} onClick={async () => { const response = await fetch(`/api/test-runs/${selectedRun.id}/cases?projectId=${encodeURIComponent(projectId)}&testCaseId=${encodeURIComponent(testCase.id)}`, { method: 'DELETE' }); if (!response.ok) { const data = await response.json().catch(() => ({})); setError(data.error || 'Gagal menghapus testcase dari Test Run.'); return; } await openRun(selectedRun.id); }} aria-label={`Hapus ${testCase.testCaseId} dari Test Run`}>Remove</Button></div>)}</div>}
                {activeCase ? <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)]"><div className="rounded-xl border border-border/70 p-5"><div className="flex items-start justify-between gap-3"><div><p className="font-mono text-xs font-bold text-primary">{activeCase.testCaseId}</p><h2 className="mt-1 text-lg font-bold">{activeCase.testAction}</h2><p className="mt-1 text-xs text-muted-foreground">{activeCase.module?.name || 'Unassigned'} · {activeCase.page}{activeCase.subMenu ? ` · ${activeCase.subMenu}` : ''}</p></div><Badge variant={statusVariant(activeExecution?.status || TEST_EXECUTION_STATUS.NOT_RUN)}>{activeExecution?.status || TEST_EXECUTION_STATUS.NOT_RUN}</Badge></div><div className="mt-5 grid gap-4 md:grid-cols-2"><div><p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Steps</p><pre className="min-h-28 whitespace-pre-wrap rounded-lg bg-secondary/50 p-3 text-sm font-sans leading-6">{activeCase.steps}</pre></div><div><p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Expected result</p><p className="min-h-28 rounded-lg bg-secondary/50 p-3 text-sm leading-6">{activeCase.expectedResult}</p></div></div><Textarea value={notes} onChange={event => setNotes(event.target.value)} placeholder="Catatan execution..." className="mt-4 min-h-20" /><div className="mt-4 flex flex-wrap gap-2">{EXECUTION_ACTIONS.map(action => { const Icon = action.icon; return <Button key={action.status} variant="outline" size="sm" onClick={() => void execute(action.status)} disabled={isSaving}><Icon className="h-4 w-4" />{action.label} <kbd className="rounded bg-secondary px-1.5 py-0.5 text-[10px]">{action.shortcut}</kbd></Button>; })}<Button variant="destructive" size="sm" onClick={() => void createBug()} disabled={isSaving || activeExecution?.status !== TEST_EXECUTION_STATUS.FAILED}><CircleAlert className="h-4 w-4" />Create Bug</Button></div><div className="mt-5 flex items-center justify-between border-t border-border/70 pt-4"><Button variant="ghost" size="sm" onClick={() => moveCase(-1)} disabled={activeCaseIndex === 0}><ChevronLeft className="h-4 w-4" />Previous</Button><span className="text-xs text-muted-foreground">{activeCaseIndex + 1} / {selectedRun.testCases.length}</span><Button variant="ghost" size="sm" onClick={() => moveCase(1)} disabled={activeCaseIndex >= selectedRun.testCases.length - 1}>Next<ChevronRight className="h-4 w-4" /></Button></div></div><div className="space-y-3"><div className="rounded-xl border border-border/70 p-4"><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Latest execution</p><p className="mt-3 text-sm">{activeExecution ? `Dijalankan ${new Date(activeExecution.createdAt).toLocaleString()}` : 'Belum pernah dijalankan.'}</p><p className="mt-1 text-xs text-muted-foreground">{activeExecution?.tester || 'Tester belum ditentukan'}</p></div><div className="rounded-xl border border-border/70 p-4"><p className="text-sm font-semibold">Evidence</p><label className="mt-3 flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-border/80 px-3 py-4 text-center text-xs text-muted-foreground hover:bg-secondary/50"><input type="file" className="sr-only" accept="image/*,video/mp4,video/webm,application/pdf" disabled={isSaving || !activeExecution} onChange={event => { const file = event.target.files?.[0]; void uploadEvidence(file); event.currentTarget.value = ''; }} />Upload screenshot/video/PDF</label><div className="mt-3 space-y-2">{activeExecution?.evidence?.length ? activeExecution.evidence.map(item => <div key={item.id} className="flex items-center justify-between gap-2 rounded-lg bg-secondary/40 px-3 py-2 text-xs"><a className="min-w-0 truncate text-primary hover:underline" href={`/api/test-runs/${selectedRun.id}/executions/${activeExecution.id}/evidence/${item.id}?projectId=${encodeURIComponent(projectId)}`} target="_blank" rel="noreferrer">{item.fileName}</a><Button variant="ghost" size="sm" className="h-7 px-2 text-destructive" onClick={() => void removeEvidence(item.id)} disabled={isSaving}>Remove</Button></div>) : <p className="mt-2 text-xs text-muted-foreground">Belum ada evidence.</p>}</div></div><div className="rounded-xl border border-border/70 p-4"><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">History</p><div className="mt-3 max-h-36 space-y-2 overflow-auto">{activities.length ? activities.map(activity => <div key={activity.id} className="border-l-2 border-primary/30 pl-3"><p className="text-xs font-semibold">{activity.action}{activity.field ? ` · ${activity.field}` : ''}</p><p className="text-[10px] text-muted-foreground">{new Date(activity.createdAt).toLocaleString()}</p></div>) : <p className="text-xs text-muted-foreground">Belum ada history.</p>}</div></div></div></div> : <div className="rounded-xl border border-dashed border-border/70 p-8 text-center text-sm text-muted-foreground">Tambahkan testcase untuk mulai execution.</div>}
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return <div className="rounded-xl border border-border/70 bg-secondary/30 p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1 text-xl font-bold">{value}</p></div>;
}
