'use client';

import { useEffect, useState } from 'react';
import { Link2, Plus, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

type Requirement = { id: string; key: string; title: string; description?: string | null; status: string; priority: string; _count?: { testCases: number; testPlans: number } };
type TestPlan = { id: string; name: string; description?: string | null; status: string; _count?: { requirements: number; testRuns: number } };
type TestCaseOption = { id: string; testCaseId: string; page: string; status: string };
type Traceability = { requirement?: Requirement & { testCases: Array<{ testCase: TestCaseOption }>; testPlans: Array<{ testPlan: TestPlan & { testRuns: Array<{ id: string; name: string; status: string }> } }> } };

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

  const load = async () => {
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
      setRequirements(requirementsData.requirements || []);
      setTestPlans(plansData.testPlans || []);
      setTestCases(casesData.testCases || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Gagal memuat traceability.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [projectId]);

  useEffect(() => {
    if (!selectedRequirementId) {
      const timer = window.setTimeout(() => setTraceability(null), 0);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(async () => {
      const response = await fetch(`/api/traceability?projectId=${encodeURIComponent(projectId)}&requirementId=${encodeURIComponent(selectedRequirementId)}`);
      const data = await response.json();
      if (response.ok) setTraceability(data);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [projectId, selectedRequirementId]);

  const createRequirement = async () => {
    const response = await fetch('/api/requirements', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId, key: requirementKey, title: requirementTitle, description: requirementDescription }) });
    const data = await response.json();
    if (!response.ok) return setMessage(data.error || 'Gagal membuat requirement.');
    setRequirementKey(''); setRequirementTitle(''); setRequirementDescription(''); setMessage('Requirement dibuat.'); await load();
  };

  const createPlan = async () => {
    const response = await fetch('/api/test-plans', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId, name: planName, description: planDescription }) });
    const data = await response.json();
    if (!response.ok) return setMessage(data.error || 'Gagal membuat Test Plan.');
    setPlanName(''); setPlanDescription(''); setMessage('Test Plan dibuat.'); await load();
  };

  const linkCase = async () => {
    if (!selectedRequirementId || !selectedCaseId) return;
    const response = await fetch(`/api/requirements/${selectedRequirementId}/test-cases`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId, testCaseIds: [selectedCaseId] }) });
    const data = await response.json();
    setMessage(response.ok ? `${data.linked || 0} testcase dihubungkan.` : data.error || 'Gagal menghubungkan testcase.');
    if (response.ok) await load();
  };

  const linkRequirement = async () => {
    if (!selectedPlanId || !selectedRequirementId) return;
    const response = await fetch(`/api/test-plans/${selectedPlanId}/requirements`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId, requirementIds: [selectedRequirementId] }) });
    const data = await response.json();
    setMessage(response.ok ? `${data.linked || 0} requirement dihubungkan.` : data.error || 'Gagal menghubungkan requirement.');
    if (response.ok) await load();
  };

  return <div className="space-y-5"><div className="flex items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Traceability</p><h1 className="mt-1 text-2xl font-bold">Requirements & Test Plans</h1><p className="mt-1 text-sm text-muted-foreground">Hubungkan kebutuhan bisnis ke testcase dan execution.</p></div><Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className="h-4 w-4" />Refresh</Button></div>{message && <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">{message}</div>}<div className="grid gap-5 lg:grid-cols-2"><Card padding="none"><CardHeader className="border-b border-border/70 py-5"><CardTitle className="flex items-center gap-2"><Plus className="h-4 w-4 text-primary" />Requirement</CardTitle><CardDescription>{requirements.length} requirement</CardDescription></CardHeader><CardContent className="space-y-3 py-5"><Input value={requirementKey} onChange={event => setRequirementKey(event.target.value)} placeholder="REQ-001" /><Input value={requirementTitle} onChange={event => setRequirementTitle(event.target.value)} placeholder="Judul requirement" /><Textarea value={requirementDescription} onChange={event => setRequirementDescription(event.target.value)} placeholder="Deskripsi requirement" /><Button onClick={() => void createRequirement()} disabled={!requirementKey.trim() || !requirementTitle.trim()}>Create Requirement</Button><div className="max-h-48 space-y-2 overflow-auto">{requirements.map(requirement => <button key={requirement.id} type="button" onClick={() => setSelectedRequirementId(requirement.id)} className={`w-full rounded-lg border p-3 text-left ${selectedRequirementId === requirement.id ? 'border-primary/50 bg-primary/5' : 'border-border/60 hover:bg-secondary/50'}`}><div className="flex items-center justify-between gap-2"><span className="font-mono text-xs font-bold text-primary">{requirement.key}</span><Badge variant="outline">{requirement.priority}</Badge></div><p className="mt-1 text-sm font-semibold">{requirement.title}</p><p className="mt-1 text-xs text-muted-foreground">{requirement._count?.testCases || 0} testcase · {requirement._count?.testPlans || 0} plan</p></button>)}</div></CardContent></Card><Card padding="none"><CardHeader className="border-b border-border/70 py-5"><CardTitle className="flex items-center gap-2"><Plus className="h-4 w-4 text-primary" />Test Plan</CardTitle><CardDescription>{testPlans.length} plan</CardDescription></CardHeader><CardContent className="space-y-3 py-5"><Input value={planName} onChange={event => setPlanName(event.target.value)} placeholder="Regression v1.2" /><Textarea value={planDescription} onChange={event => setPlanDescription(event.target.value)} placeholder="Deskripsi test plan" /><Button onClick={() => void createPlan()} disabled={!planName.trim()}>Create Test Plan</Button><div className="max-h-48 space-y-2 overflow-auto">{testPlans.map(plan => <button key={plan.id} type="button" onClick={() => setSelectedPlanId(plan.id)} className={`w-full rounded-lg border p-3 text-left ${selectedPlanId === plan.id ? 'border-primary/50 bg-primary/5' : 'border-border/60 hover:bg-secondary/50'}`}><div className="flex items-center justify-between gap-2"><span className="text-sm font-semibold">{plan.name}</span><Badge variant="outline">{plan.status}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{plan._count?.requirements || 0} requirement · {plan._count?.testRuns || 0} run</p></button>)}</div></CardContent></Card></div><Card padding="none"><CardHeader className="border-b border-border/70 py-5"><CardTitle className="flex items-center gap-2"><Link2 className="h-4 w-4 text-primary" />Link relationship</CardTitle><CardDescription>Pilih requirement, testcase, dan Test Plan untuk membuat hubungan traceability.</CardDescription></CardHeader><CardContent className="grid gap-3 py-5 md:grid-cols-[1fr_1fr_auto]"><select value={selectedRequirementId} onChange={event => setSelectedRequirementId(event.target.value)} className="h-9 rounded-md border border-border bg-background px-3 text-sm"><option value="">Pilih requirement</option>{requirements.map(item => <option key={item.id} value={item.id}>{item.key} — {item.title}</option>)}</select><select value={selectedCaseId} onChange={event => setSelectedCaseId(event.target.value)} className="h-9 rounded-md border border-border bg-background px-3 text-sm"><option value="">Pilih testcase</option>{testCases.map(item => <option key={item.id} value={item.id}>{item.testCaseId} — {item.page}</option>)}</select><Button onClick={() => void linkCase()} disabled={!selectedRequirementId || !selectedCaseId}>Link testcase</Button><select value={selectedPlanId} onChange={event => setSelectedPlanId(event.target.value)} className="h-9 rounded-md border border-border bg-background px-3 text-sm"><option value="">Pilih Test Plan</option>{testPlans.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><Button onClick={() => void linkRequirement()} disabled={!selectedPlanId || !selectedRequirementId}>Link requirement</Button></CardContent></Card>{traceability?.requirement && <Card padding="none"><CardHeader className="border-b border-border/70 py-5"><CardTitle>Traceability detail: {traceability.requirement.key}</CardTitle><CardDescription>{traceability.requirement.title}</CardDescription></CardHeader><CardContent className="grid gap-5 py-5 md:grid-cols-2"><div><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Linked testcase</p><div className="mt-3 space-y-2">{traceability.requirement.testCases.map(item => <div key={item.testCase.id} className="rounded-lg border border-border/60 p-3 text-sm"><span className="font-mono font-semibold text-primary">{item.testCase.testCaseId}</span><span className="ml-2 text-muted-foreground">{item.testCase.page}</span><Badge className="ml-2" variant="outline">{item.testCase.status}</Badge></div>)}{!traceability.requirement.testCases.length && <p className="text-sm text-muted-foreground">Belum ada testcase.</p>}</div></div><div><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Linked Test Plan & runs</p><div className="mt-3 space-y-2">{traceability.requirement.testPlans.map(item => <div key={item.testPlan.id} className="rounded-lg border border-border/60 p-3 text-sm"><p className="font-semibold">{item.testPlan.name}</p><p className="mt-1 text-xs text-muted-foreground">{item.testPlan.testRuns.length} Test Run</p></div>)}{!traceability.requirement.testPlans.length && <p className="text-sm text-muted-foreground">Belum ada Test Plan.</p>}</div></div></CardContent></Card>}</div>;
}
