'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, ChevronRight, GitBranch, Link2, ListChecks, PencilLine, Plus, RefreshCw, Route, Settings2, Unlink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
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

export function TraceabilityPanel({ projectId }: { projectId: string }) {
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [testPlans, setTestPlans] = useState<TestPlan[]>([]);
  const [testCases, setTestCases] = useState<TestCaseOption[]>([]);
  const [selectedRequirementId, setSelectedRequirementId] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [selectedCaseId, setSelectedCaseId] = useState('');
  const [traceability, setTraceability] = useState<Traceability | null>(null);
  const [requirementKey, setRequirementKey] = useState('');
  const [requirementTitle, setRequirementTitle] = useState('');
  const [requirementDescription, setRequirementDescription] = useState('');
  const [planName, setPlanName] = useState('');
  const [planDescription, setPlanDescription] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [uncoveredOnly, setUncoveredOnly] = useState(false);
  const [editRequirementKey, setEditRequirementKey] = useState('');
  const [editRequirementTitle, setEditRequirementTitle] = useState('');
  const [editRequirementDescription, setEditRequirementDescription] = useState('');

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const [requirementsResponse, plansResponse, casesResponse] = await Promise.all([
        fetch(`/api/requirements?projectId=${encodeURIComponent(projectId)}`),
        fetch(`/api/test-plans?projectId=${encodeURIComponent(projectId)}`),
        fetch(`/api/testcases?projectId=${encodeURIComponent(projectId)}&limit=200&sortBy=testCaseId&sortOrder=asc`),
      ]);
      const [requirementsData, plansData, casesData] = await Promise.all([requirementsResponse.json(), plansResponse.json(), casesResponse.json()]);
      if (!requirementsResponse.ok || !plansResponse.ok || !casesResponse.ok) throw new Error('Gagal memuat traceability.');
      const nextRequirements = requirementsData.requirements || [];
      setRequirements(nextRequirements);
      setTestPlans(plansData.testPlans || []);
      setTestCases(casesData.testCases || []);
      setSelectedRequirementId(current => current || nextRequirements[0]?.id || '');
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Gagal memuat traceability.');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const loadTraceability = useCallback(async (requirementId: string, signal?: AbortSignal) => {
    if (!requirementId) { setTraceability(null); return; }
    const response = await fetch(`/api/traceability?projectId=${encodeURIComponent(projectId)}&requirementId=${encodeURIComponent(requirementId)}`, { signal });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Gagal memuat detail traceability.');
    setTraceability(data);
  }, [projectId]);

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  useEffect(() => {
    if (!selectedRequirementId) { setTraceability(null); return; }
    const controller = new AbortController();
    void loadTraceability(selectedRequirementId, controller.signal)
      .catch(error => { if (error instanceof Error && error.name !== 'AbortError') setMessage(error.message); });
    return () => controller.abort();
  }, [loadTraceability, selectedRequirementId]);

  const summary = useMemo(() => requirements.reduce((result, requirement) => { result[coverageState(requirement)] += 1; return result; }, { covered: 0, partial: 0, uncovered: 0 }), [requirements]);
  const visibleRequirements = useMemo(() => uncoveredOnly ? requirements.filter(item => coverageState(item) !== 'covered') : requirements, [requirements, uncoveredOnly]);

  const createRequirement = async () => {
    const response = await fetch('/api/requirements', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId, key: requirementKey, title: requirementTitle, description: requirementDescription }) });
    const data = await response.json();
    if (!response.ok) return setMessage(data.error || 'Gagal membuat requirement.');
    setRequirementKey(''); setRequirementTitle(''); setRequirementDescription(''); setSelectedRequirementId(data.id); setMessage('Requirement berhasil dibuat.'); await load();
  };
  const createPlan = async () => {
    const response = await fetch('/api/test-plans', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId, name: planName, description: planDescription }) });
    const data = await response.json();
    if (!response.ok) return setMessage(data.error || 'Gagal membuat Test Plan.');
    setPlanName(''); setPlanDescription(''); setSelectedPlanId(data.id); setMessage('Test Plan berhasil dibuat.'); await load();
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
    const response = await fetch(`/api/requirements/${selectedRequirementId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId, key: editRequirementKey, title: editRequirementTitle, description: editRequirementDescription }) });
    const data = await response.json();
    if (!response.ok) return setMessage(data.error || 'Gagal memperbarui requirement.');
    setMessage('Requirement berhasil diperbarui.');
    await load();
    await loadTraceability(selectedRequirementId);
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
  };

  const selectedRequirement = traceability?.requirement;
  const linkedPlans = selectedRequirement?.testPlans.map(item => item.testPlan) || [];
  const linkedRuns = linkedPlans.flatMap(plan => plan.testRuns.map(run => ({ ...run, planName: plan.name })));

  useEffect(() => {
    if (!selectedRequirement) return;
    setEditRequirementKey(selectedRequirement.key);
    setEditRequirementTitle(selectedRequirement.title);
    setEditRequirementDescription(selectedRequirement.description || '');
  }, [selectedRequirement]);

  return <div className="flex flex-col gap-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold">Traceability</p><p className="text-xs text-muted-foreground">Requirement → Test Cases → Test Plans → Test Runs</p></div><div className="flex flex-wrap gap-2"><Button variant={uncoveredOnly ? 'secondary' : 'outline'} onClick={() => setUncoveredOnly(value => !value)}><AlertCircle data-icon="inline-start" />View Uncovered Gaps {summary.uncovered + summary.partial}</Button><Button onClick={() => setCreateOpen(true)}><Plus data-icon="inline-start" />Buat Relation</Button><Button variant="outline" onClick={() => setManageOpen(true)} disabled={!selectedRequirementId} title={!selectedRequirementId ? 'Pilih atau buat requirement terlebih dahulu' : undefined}><Settings2 data-icon="inline-start" />Manage Relations</Button><Button variant="outline" size="icon" onClick={() => void load()} disabled={loading} aria-label="Muat ulang"><RefreshCw /></Button></div></div>
    {message && <div className="rounded-lg border border-primary/25 bg-primary/5 px-4 py-3 text-sm" role="status">{message}</div>}
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4"><Metric label="Requirements" value={requirements.length} /><Metric label="Covered" value={summary.covered} tone="success" /><Metric label="Partial" value={summary.partial} tone="warning" /><Metric label="Uncovered" value={summary.uncovered} tone="failed" /></div>

    {loading && !requirements.length ? <div className="grid gap-3 lg:grid-cols-4"><Skeleton className="h-96" /><Skeleton className="h-96" /><Skeleton className="h-96" /><Skeleton className="h-96" /></div> : <div className="overflow-x-auto rounded-xl border border-border/70 bg-card p-3"><div className="grid min-w-[1120px] grid-cols-4 gap-3">
      <TraceLane title="Requirements" count={visibleRequirements.length} icon={Route}>{visibleRequirements.map(requirement => { const state = coverageState(requirement); const config = stateStyle[state]; const Icon = config.icon; return <button key={requirement.id} type="button" onClick={() => setSelectedRequirementId(requirement.id)} className={cn('qa-interactive w-full rounded-lg border p-3 text-left', config.className, selectedRequirementId === requirement.id ? 'qa-selected-row bg-primary/5' : 'hover:bg-secondary/50')}><span className="flex items-start justify-between gap-2"><span className="font-mono text-xs font-bold text-primary">{requirement.key}</span><Badge variant={config.badge} className="gap-1 text-[9px]"><Icon className="size-3" />{config.label}</Badge></span><span className="mt-1 block truncate text-xs font-semibold">{requirement.title}</span><span className="mt-2 block text-[10px] text-muted-foreground">{requirement._count?.testCases || 0} cases · {requirement._count?.testPlans || 0} plans</span></button>; })}{!visibleRequirements.length && <EmptyLane text="Tidak ada gap coverage." />}</TraceLane>
      <TraceLane title="Test Cases" count={selectedRequirement?.testCases.length || 0} icon={ListChecks}>{selectedRequirement?.testCases.map(({ testCase }) => <button key={testCase.id} type="button" onClick={() => navigate('testcases', { entityType: 'TestCase', entityId: testCase.id })} className="qa-interactive w-full rounded-lg border border-border/70 p-3 text-left hover:border-primary/30 hover:bg-secondary/50"><span className="flex items-center justify-between gap-2"><span className="font-mono text-xs font-semibold text-primary">{testCase.testCaseId}</span><Badge variant={testCase.status === 'FAILED' ? 'failed' : testCase.status === 'BLOCKED' ? 'blocked' : 'outline'} className="text-[9px]">{testCase.status}</Badge></span><span className="mt-1 block truncate text-[11px] text-muted-foreground">{testCase.page}</span></button>)}{selectedRequirement && !selectedRequirement.testCases.length && <EmptyLane text="Requirement belum memiliki testcase." />}</TraceLane>
      <TraceLane title="Test Plans" count={linkedPlans.length} icon={GitBranch}>{linkedPlans.map(plan => <button key={plan.id} type="button" onClick={() => setSelectedPlanId(plan.id)} className="qa-interactive w-full rounded-lg border border-border/70 p-3 text-left hover:border-primary/30 hover:bg-secondary/50"><span className="flex items-center justify-between gap-2"><span className="truncate text-xs font-semibold">{plan.name}</span><Badge variant="outline" className="text-[9px]">{plan.status}</Badge></span><span className="mt-2 block text-[10px] text-muted-foreground">{plan.testRuns.length} Test Runs</span></button>)}{selectedRequirement && !linkedPlans.length && <EmptyLane text="Requirement belum masuk Test Plan." />}</TraceLane>
      <TraceLane title="Test Runs" count={linkedRuns.length} icon={CheckCircle2}>{linkedRuns.map(run => <button key={run.id} type="button" onClick={() => navigate('testRuns', { entityType: 'TestRun', entityId: run.id, testRunId: run.id })} className="qa-interactive w-full rounded-lg border border-border/70 p-3 text-left hover:border-primary/30 hover:bg-secondary/50"><span className="flex items-center justify-between gap-2"><span className="truncate text-xs font-semibold">{run.name}</span><Badge variant={run.status === 'COMPLETED' ? 'success' : run.status === 'IN PROGRESS' ? 'inprogress' : 'outline'} className="text-[9px]">{run.status}</Badge></span><span className="mt-2 block truncate text-[10px] text-muted-foreground">{run.planName}</span></button>)}{selectedRequirement && !linkedRuns.length && <EmptyLane text="Belum ada execution cycle." />}</TraceLane>
    </div></div>}

    <Sheet open={createOpen} onOpenChange={setCreateOpen}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader><SheetTitle>Buat Relation</SheetTitle><SheetDescription>Buat requirement atau Test Plan baru, kemudian hubungkan ke object QA yang sesuai.</SheetDescription></SheetHeader>
        <div className="mt-6 flex flex-col gap-6">
          <ManageSection title="Requirement baru"><Input value={requirementKey} onChange={event => setRequirementKey(event.target.value)} placeholder="REQ-001" /><Input value={requirementTitle} onChange={event => setRequirementTitle(event.target.value)} placeholder="Judul requirement" /><Textarea value={requirementDescription} onChange={event => setRequirementDescription(event.target.value)} placeholder="Deskripsi" /><Button onClick={() => void createRequirement()} disabled={!requirementKey.trim() || !requirementTitle.trim()}><Plus data-icon="inline-start" />Buat Requirement</Button></ManageSection>
          <ManageSection title="Test Plan baru"><Input value={planName} onChange={event => setPlanName(event.target.value)} placeholder="Regression v1.2" /><Textarea value={planDescription} onChange={event => setPlanDescription(event.target.value)} placeholder="Deskripsi Test Plan" /><Button onClick={() => void createPlan()} disabled={!planName.trim()}><Plus data-icon="inline-start" />Buat Test Plan</Button></ManageSection>
          <ManageSection title="Hubungkan requirement ke testcase"><TraceSelect value={selectedRequirementId} placeholder="Pilih requirement" onChange={setSelectedRequirementId} items={requirements.map(item => ({ value: item.id, label: `${item.key} — ${item.title}` }))} /><TraceSelect value={selectedCaseId} placeholder="Pilih testcase" onChange={setSelectedCaseId} items={testCases.map(item => ({ value: item.id, label: `${item.testCaseId} — ${item.page}` }))} /><Button onClick={() => void linkCase()} disabled={!selectedRequirementId || !selectedCaseId}><Link2 data-icon="inline-start" />Buat relasi testcase</Button></ManageSection>
          <ManageSection title="Hubungkan requirement ke Test Plan"><TraceSelect value={selectedPlanId} placeholder="Pilih Test Plan" onChange={setSelectedPlanId} items={testPlans.map(item => ({ value: item.id, label: item.name }))} /><Button onClick={() => void linkRequirement()} disabled={!selectedPlanId || !selectedRequirementId}><Link2 data-icon="inline-start" />Buat relasi Test Plan</Button></ManageSection>
        </div>
      </SheetContent>
    </Sheet>

    <Sheet open={manageOpen} onOpenChange={setManageOpen}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader><SheetTitle>Manage Relations</SheetTitle><SheetDescription>Edit requirement dan kelola relasi yang sudah terhubung. Pembuatan relasi baru tersedia melalui tombol “Buat Relation”.</SheetDescription></SheetHeader>
        <div className="mt-6 flex flex-col gap-6">
          <ManageSection title="Pilih requirement yang akan dikelola"><TraceSelect value={selectedRequirementId} placeholder="Pilih requirement" onChange={setSelectedRequirementId} items={requirements.map(item => ({ value: item.id, label: `${item.key} — ${item.title}` }))} /></ManageSection>
          {selectedRequirement && <>
            <ManageSection title="Edit data requirement"><Input value={editRequirementKey} onChange={event => setEditRequirementKey(event.target.value)} placeholder="REQ-001" /><Input value={editRequirementTitle} onChange={event => setEditRequirementTitle(event.target.value)} placeholder="Judul requirement" /><Textarea value={editRequirementDescription} onChange={event => setEditRequirementDescription(event.target.value)} placeholder="Deskripsi" /><Button onClick={() => void saveRequirement()} disabled={!editRequirementKey.trim() || !editRequirementTitle.trim()}><PencilLine data-icon="inline-start" />Simpan perubahan</Button></ManageSection>
            <ManageSection title={`Testcase terhubung (${selectedRequirement.testCases.length})`}>
              {selectedRequirement.testCases.map(({ testCase }) => <RelationRow key={testCase.id} title={testCase.testCaseId} description={testCase.page} onRemove={() => void unlinkCase(testCase.id)} />)}
              {!selectedRequirement.testCases.length && <p className="text-xs text-muted-foreground">Belum ada testcase yang terhubung.</p>}
            </ManageSection>
            <ManageSection title={`Test Plan terhubung (${linkedPlans.length})`}>
              {linkedPlans.map(plan => <RelationRow key={plan.id} title={plan.name} description={plan.status} onRemove={() => void unlinkPlan(plan.id)} />)}
              {!linkedPlans.length && <p className="text-xs text-muted-foreground">Belum ada Test Plan yang terhubung.</p>}
            </ManageSection>
          </>}
        </div>
      </SheetContent>
    </Sheet>
  </div>;
}

function TraceLane({ title, count, icon: Icon, children }: { title: string; count: number; icon: typeof Route; children: React.ReactNode }) {
  return <section className="relative min-h-[430px] rounded-xl border border-border/60 bg-secondary/15 p-3"><div className="mb-3 flex items-center gap-2 border-b border-border/60 pb-3"><Icon className="size-4 text-primary" /><h2 className="text-xs font-semibold">{title}</h2><Badge variant="outline" className="ml-auto">{count}</Badge>{title !== 'Test Runs' && <ChevronRight className="absolute -right-3.5 top-5 z-10 size-5 rounded-full border border-border bg-card p-1 text-muted-foreground" />}</div><div className="flex max-h-[620px] flex-col gap-2 overflow-y-auto">{children}</div></section>;
}

function EmptyLane({ text }: { text: string }) { return <div className="flex min-h-36 items-center justify-center rounded-lg border border-dashed border-border/70 px-5 text-center text-xs text-muted-foreground">{text}</div>; }
function Metric({ label, value, tone }: { label: string; value: number; tone?: 'success' | 'warning' | 'failed' }) { return <Card className={cn('shadow-none', tone === 'success' && 'border-emerald-500/25', tone === 'warning' && 'border-amber-500/25', tone === 'failed' && 'border-red-500/25')}><CardContent className="p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1 font-mono text-2xl font-semibold">{value}</p></CardContent></Card>; }
function ManageSection({ title, children }: { title: string; children: React.ReactNode }) { return <section className="flex flex-col gap-3 rounded-xl border border-border/70 p-4"><h3 className="text-xs font-semibold">{title}</h3>{children}</section>; }
function RelationRow({ title, description, onRemove }: { title: string; description?: string | null; onRemove: () => void }) { return <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-secondary/20 p-3"><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{title}</p>{description && <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{description}</p>}</div><Button type="button" variant="ghost" size="sm" className="shrink-0 text-destructive hover:text-destructive" onClick={onRemove}><Unlink data-icon="inline-start" />Lepas</Button></div>; }
function TraceSelect({ value, placeholder, onChange, items }: { value: string; placeholder: string; onChange: (value: string) => void; items: Array<{ value: string; label: string }> }) { return <Select value={value || 'none'} onValueChange={next => onChange(next === 'none' ? '' : next)}><SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger><SelectContent><SelectItem value="none">{placeholder}</SelectItem>{items.map(item => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select>; }
