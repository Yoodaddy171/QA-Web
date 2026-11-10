'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import type { GraphFocus, TraceGraphNode } from '@/lib/traceability-graph';
import { MutationAction } from '@/components/WorkspaceAccess';
import { AlertCircle, CheckCircle2, ChevronRight, GitBranch, Link2, ListChecks, PencilLine, Plus, RefreshCw, Route, Settings2, Trash2, Unlink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { cn } from '@/lib/utils';

type Requirement = { id: string; key: string; title: string; description?: string | null; status: string; priority: string; _count?: { testCases: number; testPlans: number } };
type TestPlan = { id: string; name: string; description?: string | null; status: string; _count?: { requirements: number; testRuns: number } };
type TestCaseOption = { id: string; testCaseId: string; page: string; status: string };
type TestRunOption = { id: string; name: string; status: string };
type Traceability = { requirement?: Requirement & { testCases: Array<{ testCase: TestCaseOption }>; testPlans: Array<{ testPlan: TestPlan & { testRuns: TestRunOption[] } }> } };

export function coverageState(requirement: Requirement) {
  const cases = requirement._count?.testCases || 0;
  const plans = requirement._count?.testPlans || 0;
  if (cases > 0 && plans > 0) return 'covered' as const;
  if (cases > 0 || plans > 0) return 'partial' as const;
  return 'uncovered' as const;
}

const stateStyle = {
  covered: { label: 'Covered', icon: CheckCircle2, badge: 'success' as const, className: 'border-emerald-500/30' },
  partial: { label: 'Partial', icon: AlertCircle, badge: 'warning' as const, className: 'border-amber-500/30' },
  uncovered: { label: 'Uncovered', icon: AlertCircle, badge: 'failed' as const, className: 'border-red-500/30' },
};

const TraceabilityGraphView = dynamic(() => import('./TraceabilityGraphView').then(module => module.TraceabilityGraphView), { loading: () => <Skeleton className="h-[560px] w-full" /> });

export function TraceabilityPanel({ projectId }: { projectId: string }) {
  const [viewMode, setViewMode] = useState<'lanes' | 'graph'>('lanes');
  const [graphFocus, setGraphFocus] = useState<{ projectId: string; focus: GraphFocus } | null>(null);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [testPlans, setTestPlans] = useState<TestPlan[]>([]);
  const [testCases, setTestCases] = useState<TestCaseOption[]>([]);
  const [selectedRequirementId, setSelectedRequirementId] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [selectedCaseId, setSelectedCaseId] = useState('');
  const [caseSearch, setCaseSearch] = useState('');
  const [casePage, setCasePage] = useState(1);
  const [casePages, setCasePages] = useState(1);
  const [caseLoading, setCaseLoading] = useState(false);
  const [caseError, setCaseError] = useState('');
  const [loadedCaseQuery, setLoadedCaseQuery] = useState('');
  const caseQueryKey = JSON.stringify([projectId, casePage, caseSearch]);
  const caseOptionsReady = loadedCaseQuery === caseQueryKey;
  const [traceability, setTraceability] = useState<Traceability | null>(null);
  const [requirementKey, setRequirementKey] = useState('');
  const [requirementTitle, setRequirementTitle] = useState('');
  const [requirementDescription, setRequirementDescription] = useState('');
  const [requirementPriority, setRequirementPriority] = useState('Medium');
  const [requirementStatus, setRequirementStatus] = useState('DRAFT');
  const [planName, setPlanName] = useState('');
  const [planDescription, setPlanDescription] = useState('');
  const [planStatus, setPlanStatus] = useState('DRAFT');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [uncoveredOnly, setUncoveredOnly] = useState(false);
  const [editRequirementKey, setEditRequirementKey] = useState('');
  const [editRequirementTitle, setEditRequirementTitle] = useState('');
  const [editRequirementDescription, setEditRequirementDescription] = useState('');
  const [editRequirementPriority, setEditRequirementPriority] = useState('Medium');
  const [editRequirementStatus, setEditRequirementStatus] = useState('DRAFT');
  const [managedPlanId, setManagedPlanId] = useState('');
  const [editPlanName, setEditPlanName] = useState('');
  const [editPlanDescription, setEditPlanDescription] = useState('');
  const [editPlanStatus, setEditPlanStatus] = useState('DRAFT');

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const [requirementsResponse, plansResponse] = await Promise.all([
        fetch(`/api/requirements?projectId=${encodeURIComponent(projectId)}`),
        fetch(`/api/test-plans?projectId=${encodeURIComponent(projectId)}`),
      ]);
      if (!requirementsResponse.ok || !plansResponse.ok) throw new Error('Gagal memuat traceability.');
      const [requirementsData, plansData] = await Promise.all([
        requirementsResponse.json().catch(() => ({ requirements: [] })),
        plansResponse.json().catch(() => ({ testPlans: [] })),
      ]);
      const nextRequirements = requirementsData.requirements || [];
      setRequirements(nextRequirements);
      setTestPlans(plansData.testPlans || []);

      let navRequirementId = '';
      try {
        const rawTarget = window.localStorage.getItem(`qaDesk.navigationTarget.v1.${projectId}`);
        if (rawTarget) {
          const parsed = JSON.parse(rawTarget);
          if (parsed?.entityType === 'Requirement' && typeof parsed.entityId === 'string') {
            navRequirementId = parsed.entityId;
            window.localStorage.removeItem(`qaDesk.navigationTarget.v1.${projectId}`);
          }
        }
      } catch {
        // Ignore storage read errors
      }

      setSelectedRequirementId(current => navRequirementId || current || nextRequirements[0]?.id || '');
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Gagal memuat traceability.');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    const onNavigateRequirement = (event: Event) => {
      const detail = (event as CustomEvent<{ entityId?: string; requirementId?: string }>).detail;
      const reqId = detail?.entityId || detail?.requirementId;
      if (reqId) {
        setViewMode('lanes');
        setUncoveredOnly(false);
        setSelectedRequirementId(reqId);
      }
    };
    window.addEventListener('qa-desk:navigate-requirement', onNavigateRequirement);
    return () => window.removeEventListener('qa-desk:navigate-requirement', onNavigateRequirement);
  }, []);

  useEffect(() => {
    if (!createOpen) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setCaseLoading(true); setCaseError('');
      try {
        const query = new URLSearchParams({ projectId, view: 'options', limit: '25', page: String(casePage), search: caseSearch, sortBy: 'testCaseId' });
        const response = await fetch(`/api/testcases?${query}`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Pilihan testcase gagal dimuat.');
        if (controller.signal.aborted) return;
        setTestCases(data.testCases || []); setCasePages(Math.max(1, data.totalPages || 1)); setLoadedCaseQuery(JSON.stringify([projectId, casePage, caseSearch]));
      } catch (error) { if (!controller.signal.aborted) setCaseError(error instanceof Error ? error.message : 'Pilihan testcase gagal dimuat.'); }
      finally { if (!controller.signal.aborted) setCaseLoading(false); }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [projectId, createOpen, casePage, caseSearch]);

  const loadTraceability = useCallback(async (requirementId: string, signal?: AbortSignal) => {
    if (!requirementId) { setTraceability(null); return; }
    const response = await fetch(`/api/traceability?projectId=${encodeURIComponent(projectId)}&requirementId=${encodeURIComponent(requirementId)}`, { signal });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Gagal memuat detail traceability.' }));
      throw new Error(err.error || 'Gagal memuat detail traceability.');
    }
    const data = await response.json().catch(() => null);
    setTraceability(data);
  }, [projectId]);

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  useEffect(() => {
    if (viewMode === 'graph') return;
    if (!selectedRequirementId) {
      const timer = window.setTimeout(() => setTraceability(null), 0);
      return () => window.clearTimeout(timer);
    }
    const controller = new AbortController();
    queueMicrotask(() => {
      void loadTraceability(selectedRequirementId, controller.signal)
        .catch(error => { if (error instanceof Error && error.name !== 'AbortError') setMessage(error.message); });
    });
    return () => controller.abort();
  }, [loadTraceability, selectedRequirementId, viewMode]);

  const summary = useMemo(() => requirements.reduce((result, requirement) => { result[coverageState(requirement)] += 1; return result; }, { covered: 0, partial: 0, uncovered: 0 }), [requirements]);
  const visibleRequirements = useMemo(() => uncoveredOnly ? requirements.filter(item => coverageState(item) !== 'covered') : requirements, [requirements, uncoveredOnly]);

  const createRequirement = async () => {
    const response = await fetch('/api/requirements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        key: requirementKey,
        title: requirementTitle,
        description: requirementDescription,
        priority: requirementPriority,
        status: requirementStatus,
      }),
    });
    const data = await response.json();
    if (!response.ok) return setMessage(data.error || 'Gagal membuat requirement.');
    setRequirementKey(''); setRequirementTitle(''); setRequirementDescription(''); setRequirementPriority('Medium'); setRequirementStatus('DRAFT');
    setSelectedRequirementId(data.id); setMessage('Requirement berhasil dibuat.'); await load();
  };
  const createPlan = async () => {
    const response = await fetch('/api/test-plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, name: planName, description: planDescription, status: planStatus }),
    });
    const data = await response.json();
    if (!response.ok) return setMessage(data.error || 'Gagal membuat Test Plan.');
    setPlanName(''); setPlanDescription(''); setPlanStatus('DRAFT'); setSelectedPlanId(data.id); setMessage('Test Plan berhasil dibuat.'); await load();
  };
  const linkCase = async () => {
    if (!selectedRequirementId || !selectedCaseId) return;
    const response = await fetch(`/api/requirements/${selectedRequirementId}/test-cases`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId, testCaseIds: [selectedCaseId] }) });
    const data = await response.json(); setMessage(response.ok ? `${data.linked || 0} testcase dihubungkan.` : data.error || 'Gagal menghubungkan testcase.'); if (response.ok) { await load(); await loadTraceability(selectedRequirementId); }
  };
  const linkRequirement = async () => {
    if (!selectedPlanId || !selectedRequirementId) return;
    const response = await fetch(`/api/test-plans/${selectedPlanId}/requirements`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId, requirementIds: [selectedRequirementId] }) });
    const data = await response.json(); setMessage(response.ok ? `${data.linked || 0} requirement dihubungkan.` : data.error || 'Gagal menghubungkan requirement.'); if (response.ok) { await load(); await loadTraceability(selectedRequirementId); }
  };

  const saveRequirement = async () => {
    if (!selectedRequirementId) return;
    const response = await fetch(`/api/requirements/${selectedRequirementId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        key: editRequirementKey,
        title: editRequirementTitle,
        description: editRequirementDescription,
        priority: editRequirementPriority,
        status: editRequirementStatus,
      }),
    });
    const data = await response.json();
    if (!response.ok) return setMessage(data.error || 'Gagal memperbarui requirement.');
    setMessage('Requirement berhasil diperbarui.');
    await load();
    await loadTraceability(selectedRequirementId);
  };

  const deleteRequirement = async () => {
    if (!selectedRequirementId) return;
    const response = await fetch(`/api/requirements/${encodeURIComponent(selectedRequirementId)}?projectId=${encodeURIComponent(projectId)}`, { method: 'DELETE' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return setMessage(data.error || 'Gagal menghapus requirement.');
    setMessage('Requirement berhasil dihapus.');
    setSelectedRequirementId('');
    setManageOpen(false);
    await load();
  };

  const savePlan = async () => {
    if (!managedPlanId || !editPlanName.trim()) return;
    const response = await fetch('/api/test-plans', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: managedPlanId,
        projectId,
        name: editPlanName,
        description: editPlanDescription,
        status: editPlanStatus,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return setMessage(data.error || 'Gagal memperbarui Test Plan.');
    setMessage('Test Plan berhasil diperbarui.');
    await load();
    if (selectedRequirementId) await loadTraceability(selectedRequirementId);
  };

  const deletePlan = async () => {
    if (!managedPlanId) return;
    const response = await fetch(`/api/test-plans?id=${encodeURIComponent(managedPlanId)}&projectId=${encodeURIComponent(projectId)}`, { method: 'DELETE' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return setMessage(data.error || 'Gagal menghapus Test Plan.');
    setMessage('Test Plan berhasil dihapus.');
    setManagedPlanId('');
    await load();
    if (selectedRequirementId) await loadTraceability(selectedRequirementId);
  };

  const unlinkCase = async (testCaseId: string) => {
    if (!selectedRequirementId) return;
    const response = await fetch(`/api/requirements/${selectedRequirementId}/test-cases`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId, testCaseIds: [testCaseId] }) });
    const data = await response.json();
    setMessage(response.ok ? 'Relasi testcase berhasil dilepas.' : data.error || 'Gagal melepas relasi testcase.');
    if (response.ok) { await load(); await loadTraceability(selectedRequirementId); }
  };

  const unlinkPlan = async (testPlanId: string) => {
    if (!selectedRequirementId) return;
    const response = await fetch(`/api/test-plans/${testPlanId}/requirements`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId, requirementIds: [selectedRequirementId] }) });
    const data = await response.json();
    setMessage(response.ok ? 'Relasi Test Plan berhasil dilepas.' : data.error || 'Gagal melepas relasi Test Plan.');
    if (response.ok) { await load(); await loadTraceability(selectedRequirementId); }
  };

  const navigate = (tab: string, target: Record<string, string | undefined>) => {
    window.localStorage.setItem(`qaDesk.navigationTarget.v1.${projectId}`, JSON.stringify(target));
    window.dispatchEvent(new CustomEvent('qa-desk:set-tab', { detail: tab }));
    if (target.entityType === 'TestCase') window.dispatchEvent(new CustomEvent('qa-desk:navigate-entity', { detail: target }));
  };

  const openGraphNode = (node: TraceGraphNode) => {
    if (node.type === 'Requirement') { setSelectedRequirementId(node.entityId); setUncoveredOnly(false); setViewMode('lanes'); }
    else if (node.type === 'TestCase') navigate('testcases', { entityType: 'TestCase', entityId: node.entityId });
    else if (node.type === 'BugFix') navigate('bugfix', { entityType: 'BugFix', entityId: node.entityId });
    else if (node.type === 'TestRun') navigate('testRuns', { entityType: 'TestRun', entityId: node.entityId, testRunId: node.entityId });
    else if (node.type === 'Execution' && typeof node.details?.['Cycle ID'] === 'string') {
      const runId = node.details['Cycle ID'];
      navigate('testRuns', { entityType: 'TestRun', entityId: runId, testRunId: runId });
    }
  };

  const selectedRequirement = traceability?.requirement;
  const linkedPlans = selectedRequirement?.testPlans.map(item => item.testPlan) || [];
  const linkedRuns = linkedPlans.flatMap(plan => plan.testRuns.map(run => ({ ...run, planName: plan.name })));

  useEffect(() => {
    if (!selectedRequirement) return;
    const timer = window.setTimeout(() => {
      setEditRequirementKey(selectedRequirement.key);
      setEditRequirementTitle(selectedRequirement.title);
      setEditRequirementDescription(selectedRequirement.description || '');
      setEditRequirementPriority(selectedRequirement.priority || 'Medium');
      setEditRequirementStatus(selectedRequirement.status || 'DRAFT');
    }, 0);
    return () => window.clearTimeout(timer);
  }, [selectedRequirement]);

  useEffect(() => {
    const plan = testPlans.find(p => p.id === managedPlanId);
    if (!plan) return;
    setEditPlanName(plan.name);
    setEditPlanDescription(plan.description || '');
    setEditPlanStatus(plan.status || 'DRAFT');
  }, [managedPlanId, testPlans]);

  return <div className="qa-module-page flex flex-col gap-5">
    <div className="qa-module-toolbar flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-4"><div><h2 className="qa-module-heading">Traceability</h2><p className="qa-module-meta mt-1">Requirement → Test Cases → Test Plans → Test Cycles</p></div><div className="flex flex-wrap gap-2"><Button variant={uncoveredOnly ? 'secondary' : 'outline'} onClick={() => { setViewMode('lanes'); setUncoveredOnly(value => !value); }}><AlertCircle data-icon="inline-start" />Filter Celah Coverage ({summary.uncovered + summary.partial})</Button><MutationAction><Button onClick={() => setCreateOpen(true)}><Plus data-icon="inline-start" />Buat Relasi</Button></MutationAction><MutationAction><Button variant="outline" onClick={() => setManageOpen(true)} disabled={!selectedRequirementId && !testPlans.length} title={!selectedRequirementId && !testPlans.length ? 'Pilih atau buat requirement/plan terlebih dahulu' : undefined}><Settings2 data-icon="inline-start" />Kelola Relasi</Button></MutationAction><Button variant="outline" size="icon" onClick={() => void load()} disabled={loading} aria-label="Muat ulang"><RefreshCw /></Button></div></div>
    {message && <div className="rounded-lg border border-primary/25 bg-primary/5 px-4 py-3 text-sm" role="status">{message}</div>}
    <div className="flex flex-wrap gap-2" role="group" aria-label="Tampilan Traceability"><Button variant={viewMode === 'lanes' ? 'secondary' : 'outline'} aria-pressed={viewMode === 'lanes'} onClick={() => setViewMode('lanes')}><ListChecks data-icon="inline-start" />Tampilan Jalur Uji</Button><Button variant={viewMode === 'graph' ? 'secondary' : 'outline'} aria-pressed={viewMode === 'graph'} onClick={() => setViewMode('graph')}><GitBranch data-icon="inline-start" />Tampilan Graf</Button></div>
    {viewMode === 'graph' ? <TraceabilityGraphView key={projectId} projectId={projectId} onOpenNode={openGraphNode} initialFocus={graphFocus?.projectId === projectId ? graphFocus.focus : undefined} onFocusChange={focus => setGraphFocus({ projectId, focus })} /> : <>
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4"><Metric label="Requirements" value={requirements.length} /><Metric label="Covered" value={summary.covered} tone="success" /><Metric label="Partial" value={summary.partial} tone="warning" /><Metric label="Uncovered" value={summary.uncovered} tone="failed" /></div>

    {loading && !requirements.length ? <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]"><Skeleton className="h-96" /><Skeleton className="h-96" /></div> : <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)] items-start">
      <TraceLane title="Requirements" count={visibleRequirements.length} icon={Route}>{visibleRequirements.map(requirement => { const state = coverageState(requirement); const config = stateStyle[state]; const Icon = config.icon; const active = selectedRequirementId === requirement.id; return <button key={requirement.id} type="button" onClick={() => setSelectedRequirementId(requirement.id)} className={cn('qa-interactive relative overflow-hidden w-full rounded-lg border p-3 text-left transition-all duration-150 active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none', config.className, active ? 'border-primary/40 shadow-2xs' : 'hover:bg-secondary/50')}>{active && <span className="qa-selected-row absolute inset-0 rounded-lg pointer-events-none" />}<span className="relative z-10 flex items-start justify-between gap-2"><span className="font-mono text-xs font-bold text-primary">{requirement.key}</span><Badge variant={config.badge} className="gap-1 text-xs"><Icon className="size-3" />{config.label}</Badge></span><span className="relative z-10 mt-1 block truncate text-xs font-semibold">{requirement.title}</span><span className="relative z-10 mt-2 flex flex-wrap items-center gap-1.5 font-mono text-xs text-muted-foreground"><span>{requirement._count?.testCases || 0} cases · {requirement._count?.testPlans || 0} plans</span><Badge variant="outline" className="ml-auto text-[10px] py-0 h-4">{requirement.priority || 'Medium'}</Badge><Badge variant="outline" className="text-[10px] py-0 h-4">{requirement.status || 'DRAFT'}</Badge></span></button>; })}{!visibleRequirements.length && <EmptyLane text="Tidak ada gap coverage." />}</TraceLane>
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
        {selectedRequirement ? (
          <div key={`req-header-${selectedRequirement.id}`} className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 pb-3 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-bold text-primary">{selectedRequirement.key}</span>
                <span className="text-sm font-semibold text-foreground">{selectedRequirement.title}</span>
                <Badge variant="outline" className="text-[10px] py-0 h-4">{selectedRequirement.priority || 'Medium'}</Badge>
                <Badge variant="outline" className="text-[10px] py-0 h-4">{selectedRequirement.status || 'DRAFT'}</Badge>
              </div>
              {selectedRequirement.description && <p className="mt-1 text-xs text-muted-foreground">{selectedRequirement.description}</p>}
            </div>
            <MutationAction><Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setManageOpen(true)}><Settings2 className="mr-1.5 size-3.5" />Kelola Relasi</Button></MutationAction>
          </div>
        ) : null}
        <div key={`req-lanes-${selectedRequirementId || 'none'}`} className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-200">
            <TraceLane title="Test Cases" count={selectedRequirement?.testCases.length || 0} icon={ListChecks}>{!selectedRequirement ? <EmptyLane text="Pilih Requirement di sebelah kiri untuk melihat relasi test case." /> : selectedRequirement.testCases.map(({ testCase }) => <button key={testCase.id} type="button" onClick={() => navigate('testcases', { entityType: 'TestCase', entityId: testCase.id })} className="qa-interactive w-full rounded-lg border border-border/70 bg-card p-3 text-left hover:border-primary/40 hover:-translate-y-0.5 hover:bg-secondary/50 hover:shadow-2xs transition-all duration-150 active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"><span className="flex items-center justify-between gap-2"><span className="font-mono text-xs font-semibold text-primary">{testCase.testCaseId}</span><Badge variant={testCase.status === 'FAILED' ? 'failed' : testCase.status === 'BLOCKED' ? 'blocked' : 'outline'} className="text-xs">{testCase.status}</Badge></span><span className="mt-1 block truncate text-xs text-muted-foreground">{testCase.page}</span></button>)}{selectedRequirement && !selectedRequirement.testCases.length && <EmptyLane text="Requirement belum memiliki testcase." />}</TraceLane>
          </div>
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-200 delay-75 fill-mode-both">
            <TraceLane title="Test Plans" count={linkedPlans.length} icon={GitBranch}>{!selectedRequirement ? <EmptyLane text="Pilih Requirement untuk melihat Test Plan terkait." /> : linkedPlans.map(plan => <button key={plan.id} type="button" onClick={() => { setSelectedPlanId(plan.id); setManagedPlanId(plan.id); }} className="qa-interactive w-full rounded-lg border border-border/70 bg-card p-3 text-left hover:border-primary/40 hover:-translate-y-0.5 hover:bg-secondary/50 hover:shadow-2xs transition-all duration-150 active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"><span className="flex items-center justify-between gap-2"><span className="truncate text-xs font-semibold">{plan.name}</span><Badge variant="outline" className="text-xs">{plan.status}</Badge></span><span className="mt-2 block font-mono text-xs text-muted-foreground">{plan.testRuns.length} Test Runs</span></button>)}{selectedRequirement && !linkedPlans.length && <EmptyLane text="Requirement belum masuk Test Plan." />}</TraceLane>
          </div>
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-200 delay-150 fill-mode-both">
            <TraceLane title="Test Runs" count={linkedRuns.length} icon={CheckCircle2}>{!selectedRequirement ? <EmptyLane text="Pilih Requirement untuk melihat siklus eksekusi." /> : linkedRuns.map(run => <button key={run.id} type="button" onClick={() => navigate('testRuns', { entityType: 'TestRun', entityId: run.id, testRunId: run.id })} className="qa-interactive w-full rounded-lg border border-border/70 bg-card p-3 text-left hover:border-primary/40 hover:-translate-y-0.5 hover:bg-secondary/50 hover:shadow-2xs transition-all duration-150 active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"><span className="flex items-center justify-between gap-2"><span className="truncate text-xs font-semibold">{run.name}</span><Badge variant={run.status === 'COMPLETED' ? 'success' : run.status === 'IN PROGRESS' ? 'inprogress' : 'outline'} className="text-xs">{run.status}</Badge></span><span className="mt-2 block truncate text-xs text-muted-foreground">{run.planName}</span></button>)}{selectedRequirement && !linkedRuns.length && <EmptyLane text="Belum ada execution cycle." />}</TraceLane>
          </div>
        </div>
      </div>
    </div>}

    </>}
    <Sheet open={createOpen} onOpenChange={setCreateOpen}>
      <SheetContent side="right" className="qa-module-form w-full overflow-y-auto p-0 sm:max-w-xl">
        <SheetHeader className="border-b border-border p-5"><SheetTitle>Buat Relasi & Objek</SheetTitle><SheetDescription>Pilih tab untuk menghubungkan relasi atau membuat Requirement dan Test Plan baru.</SheetDescription></SheetHeader>
        <div className="p-5">
          <Tabs defaultValue="link" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-5">
              <TabsTrigger value="link">Hubungkan Relasi</TabsTrigger>
              <TabsTrigger value="create">Buat Objek Baru</TabsTrigger>
            </TabsList>
            <TabsContent value="link" className="flex flex-col gap-6 mt-0">
              <ManageSection title="Hubungkan requirement ke testcase"><TraceSelect value={selectedRequirementId} placeholder="Pilih requirement" onChange={setSelectedRequirementId} items={requirements.map(item => ({ value: item.id, label: `${item.key}: ${item.title}` }))} />
                <Input aria-label="Cari testcase untuk relasi" placeholder="Cari ID, halaman, atau aksi testcase…" value={caseSearch} onChange={event => { setCaseSearch(event.target.value); setCasePage(1); setSelectedCaseId(''); }} />
                {caseError && <p role="alert" className="text-sm text-destructive">{caseError}</p>}
                <TraceSelect value={selectedCaseId} placeholder={caseLoading || !caseOptionsReady ? 'Memuat testcase…' : 'Pilih testcase'} onChange={setSelectedCaseId} items={caseOptionsReady ? testCases.map(item => ({ value: item.id, label: `${item.testCaseId} - ${item.page}` })) : []} />
                <div className="flex flex-wrap items-center justify-between gap-2"><Button size="sm" variant="outline" disabled={caseLoading || !caseOptionsReady || casePage <= 1} onClick={() => { setCasePage(value => value - 1); setSelectedCaseId(''); }}>Sebelumnya</Button><span className="text-sm text-muted-foreground" role="status">{caseLoading || !caseOptionsReady ? 'Memuat…' : `Halaman ${casePage} dari ${casePages}`}</span><Button size="sm" variant="outline" disabled={caseLoading || !caseOptionsReady || casePage >= casePages} onClick={() => { setCasePage(value => value + 1); setSelectedCaseId(''); }}>Berikutnya</Button></div>
                <Button onClick={() => void linkCase()} disabled={caseLoading || !caseOptionsReady || Boolean(caseError) || !selectedRequirementId || !selectedCaseId}><Link2 data-icon="inline-start" />Buat relasi testcase</Button></ManageSection>
              <ManageSection title="Hubungkan requirement ke Test Plan"><TraceSelect value={selectedPlanId} placeholder="Pilih Test Plan" onChange={setSelectedPlanId} items={testPlans.map(item => ({ value: item.id, label: item.name }))} /><Button onClick={() => void linkRequirement()} disabled={!selectedPlanId || !selectedRequirementId}><Link2 data-icon="inline-start" />Buat relasi Test Plan</Button></ManageSection>
            </TabsContent>
            <TabsContent value="create" className="flex flex-col gap-6 mt-0">
              <ManageSection title="Requirement baru">
                <Input value={requirementKey} onChange={event => setRequirementKey(event.target.value)} placeholder="REQ-001" />
                <Input value={requirementTitle} onChange={event => setRequirementTitle(event.target.value)} placeholder="Judul requirement" />
                <div className="grid grid-cols-2 gap-2">
                  <Select value={requirementPriority} onValueChange={setRequirementPriority}>
                    <SelectTrigger aria-label="Prioritas requirement"><SelectValue placeholder="Prioritas" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Low">Prioritas: Low</SelectItem>
                      <SelectItem value="Medium">Prioritas: Medium</SelectItem>
                      <SelectItem value="High">Prioritas: High</SelectItem>
                      <SelectItem value="Critical">Prioritas: Critical</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={requirementStatus} onValueChange={setRequirementStatus}>
                    <SelectTrigger aria-label="Status requirement"><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DRAFT">Status: DRAFT</SelectItem>
                      <SelectItem value="ACTIVE">Status: ACTIVE</SelectItem>
                      <SelectItem value="APPROVED">Status: APPROVED</SelectItem>
                      <SelectItem value="DEPRECATED">Status: DEPRECATED</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Textarea value={requirementDescription} onChange={event => setRequirementDescription(event.target.value)} placeholder="Deskripsi" />
                <Button onClick={() => void createRequirement()} disabled={!requirementKey.trim() || !requirementTitle.trim()}><Plus data-icon="inline-start" />Buat Requirement</Button>
              </ManageSection>
              <ManageSection title="Test Plan baru">
                <Input value={planName} onChange={event => setPlanName(event.target.value)} placeholder="Regression v1.2" />
                <Select value={planStatus} onValueChange={setPlanStatus}>
                  <SelectTrigger aria-label="Status Test Plan"><SelectValue placeholder="Status Test Plan" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DRAFT">Status: DRAFT</SelectItem>
                    <SelectItem value="ACTIVE">Status: ACTIVE</SelectItem>
                    <SelectItem value="COMPLETED">Status: COMPLETED</SelectItem>
                    <SelectItem value="ARCHIVED">Status: ARCHIVED</SelectItem>
                  </SelectContent>
                </Select>
                <Textarea value={planDescription} onChange={event => setPlanDescription(event.target.value)} placeholder="Deskripsi Test Plan" />
                <Button onClick={() => void createPlan()} disabled={!planName.trim()}><Plus data-icon="inline-start" />Buat Test Plan</Button>
              </ManageSection>
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>

    <Sheet open={manageOpen} onOpenChange={setManageOpen}>
      <SheetContent side="right" className="qa-module-form w-full overflow-y-auto p-0 sm:max-w-xl">
        <SheetHeader className="border-b border-border p-5"><SheetTitle>Kelola Relasi & Objek</SheetTitle><SheetDescription>Edit requirement, Test Plan, dan kelola relasi yang sudah terhubung.</SheetDescription></SheetHeader>
        <div className="flex flex-col gap-6 p-5">
          <ManageSection title="Pilih requirement yang akan dikelola"><TraceSelect value={selectedRequirementId} placeholder="Pilih requirement" onChange={setSelectedRequirementId} items={requirements.map(item => ({ value: item.id, label: `${item.key}: ${item.title}` }))} /></ManageSection>
          {selectedRequirement && <>
            <ManageSection title="Edit data requirement">
              <Input value={editRequirementKey} onChange={event => setEditRequirementKey(event.target.value)} placeholder="REQ-001" />
              <Input value={editRequirementTitle} onChange={event => setEditRequirementTitle(event.target.value)} placeholder="Judul requirement" />
              <div className="grid grid-cols-2 gap-2">
                <Select value={editRequirementPriority} onValueChange={setEditRequirementPriority}>
                  <SelectTrigger aria-label="Edit prioritas requirement"><SelectValue placeholder="Prioritas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Low">Prioritas: Low</SelectItem>
                    <SelectItem value="Medium">Prioritas: Medium</SelectItem>
                    <SelectItem value="High">Prioritas: High</SelectItem>
                    <SelectItem value="Critical">Prioritas: Critical</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={editRequirementStatus} onValueChange={setEditRequirementStatus}>
                  <SelectTrigger aria-label="Edit status requirement"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DRAFT">Status: DRAFT</SelectItem>
                    <SelectItem value="ACTIVE">Status: ACTIVE</SelectItem>
                    <SelectItem value="APPROVED">Status: APPROVED</SelectItem>
                    <SelectItem value="DEPRECATED">Status: DEPRECATED</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Textarea value={editRequirementDescription} onChange={event => setEditRequirementDescription(event.target.value)} placeholder="Deskripsi" />
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={() => void saveRequirement()} disabled={!editRequirementKey.trim() || !editRequirementTitle.trim()} className="flex-1"><PencilLine data-icon="inline-start" />Simpan perubahan</Button>
                <Button type="button" variant="outline" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => void deleteRequirement()}><Trash2 data-icon="inline-start" />Hapus Requirement</Button>
              </div>
            </ManageSection>
            <ManageSection title={`Testcase terhubung (${selectedRequirement.testCases.length})`}>
              {selectedRequirement.testCases.map(({ testCase }) => <RelationRow key={testCase.id} title={testCase.testCaseId} description={testCase.page} onRemove={() => void unlinkCase(testCase.id)} />)}
              {!selectedRequirement.testCases.length && <p className="text-xs text-muted-foreground">Belum ada testcase yang terhubung.</p>}
            </ManageSection>
            <ManageSection title={`Test Plan terhubung (${linkedPlans.length})`}>
              {linkedPlans.map(plan => <RelationRow key={plan.id} title={plan.name} description={plan.status} onRemove={() => void unlinkPlan(plan.id)} />)}
              {!linkedPlans.length && <p className="text-xs text-muted-foreground">Belum ada Test Plan yang terhubung.</p>}
            </ManageSection>
          </>}
          <ManageSection title="Kelola & Edit Test Plan Project">
            <TraceSelect value={managedPlanId} placeholder="Pilih Test Plan untuk diedit" onChange={setManagedPlanId} items={testPlans.map(item => ({ value: item.id, label: `${item.name} (${item.status})` }))} />
            {managedPlanId && (
              <>
                <Input value={editPlanName} onChange={event => setEditPlanName(event.target.value)} placeholder="Nama Test Plan" />
                <Select value={editPlanStatus} onValueChange={setEditPlanStatus}>
                  <SelectTrigger aria-label="Edit status Test Plan"><SelectValue placeholder="Status Test Plan" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DRAFT">Status: DRAFT</SelectItem>
                    <SelectItem value="ACTIVE">Status: ACTIVE</SelectItem>
                    <SelectItem value="COMPLETED">Status: COMPLETED</SelectItem>
                    <SelectItem value="ARCHIVED">Status: ARCHIVED</SelectItem>
                  </SelectContent>
                </Select>
                <Textarea value={editPlanDescription} onChange={event => setEditPlanDescription(event.target.value)} placeholder="Deskripsi Test Plan" />
                <div className="flex flex-wrap items-center gap-2">
                  <Button onClick={() => void savePlan()} disabled={!editPlanName.trim()} className="flex-1"><PencilLine data-icon="inline-start" />Simpan Test Plan</Button>
                  <Button type="button" variant="outline" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => void deletePlan()}><Trash2 data-icon="inline-start" />Hapus Plan</Button>
                </div>
              </>
            )}
          </ManageSection>
        </div>
      </SheetContent>
    </Sheet>
  </div>;
}

function TraceLane({ title, count, icon: Icon, children }: { title: string; count: number; icon: typeof Route; children: React.ReactNode }) {
  return <section className="relative min-h-[380px] min-w-0 rounded-xl border border-border bg-secondary/15 p-3.5"><div className="mb-3 flex items-center gap-2 border-b border-border pb-2.5"><Icon className="size-4 text-primary" /><h2 className="qa-module-heading">{title}</h2><Badge variant="outline" className="ml-auto">{count}</Badge></div><div className="flex max-h-[560px] flex-col gap-2.5 overflow-y-auto">{children}</div></section>;
}

function EmptyLane({ text }: { text: string }) { return <div className="flex min-h-36 items-center justify-center rounded-lg border border-dashed border-border px-4 text-center text-sm leading-6 text-muted-foreground">{text}</div>; }
function Metric({ label, value, tone }: { label: string; value: number; tone?: 'success' | 'warning' | 'failed' }) { return <Card padding="none" className="border-border bg-card shadow-none"><CardContent className="p-4"><p className="qa-module-meta">{label}</p><p className={cn('mt-2 text-2xl font-semibold font-mono tabular-nums', tone === 'success' && 'text-status-passed', tone === 'warning' && 'text-status-blocked', tone === 'failed' && 'text-status-failed')}><AnimatedNumber value={value} /></p></CardContent></Card>; }
function ManageSection({ title, children }: { title: string; children: React.ReactNode }) { return <section className="flex flex-col gap-3 border-b border-border pb-6 last:border-b-0 last:pb-0"><h3 className="qa-module-heading">{title}</h3>{children}</section>; }
function RelationRow({ title, description, onRemove }: { title: string; description?: string | null; onRemove: () => void }) { return <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-secondary/20 p-3"><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{title}</p>{description && <p className="mt-0.5 truncate text-xs text-muted-foreground">{description}</p>}</div><Button type="button" variant="ghost" size="sm" className="shrink-0 text-destructive hover:text-destructive" onClick={onRemove}><Unlink data-icon="inline-start" />Lepas</Button></div>; }
function TraceSelect({ value, placeholder, onChange, items }: { value: string; placeholder: string; onChange: (value: string) => void; items: Array<{ value: string; label: string }> }) { return <Select value={value || 'none'} onValueChange={next => onChange(next === 'none' ? '' : next)}><SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger><SelectContent><SelectItem value="none">{placeholder}</SelectItem>{items.map(item => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select>; }
