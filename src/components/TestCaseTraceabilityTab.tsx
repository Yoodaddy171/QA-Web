'use client';

import { useEffect, useState } from 'react';
import { History, Link2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TabsContent } from '@/components/ui/tabs';

type TraceabilityData = {
  testCase?: {
    testCaseId: string;
    requirements: Array<{ requirement: { id: string; key: string; title: string } }>;
    testRuns: Array<{
      testRun: { id: string; name: string; status: string };
      executions: Array<{ id: string; status: string; tester?: string | null; createdAt: string; completedAt?: string | null; evidence: Array<{ id: string; fileName: string }> }>;
    }>;
    bugFixItems: Array<{ id: string; status: string; title?: string | null; testCaseId: string; sourceExecution?: { id: string; testRunId: string; status: string; tester?: string | null; createdAt: string } | null }>;
  };
};

type Activity = { id: string; action: string; field?: string | null; actor?: string | null; createdAt: string; beforeValue?: unknown; afterValue?: unknown };

export function TestCaseTraceabilityTab({ projectId, testCaseId }: { projectId: string; testCaseId: string }) {
  const [data, setData] = useState<TraceabilityData | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void (async () => {
        setLoading(true);
        try {
          const [traceabilityResponse, activityResponse] = await Promise.all([
            fetch(`/api/traceability?projectId=${encodeURIComponent(projectId)}&testCaseId=${encodeURIComponent(testCaseId)}`),
            fetch(`/api/activity?projectId=${encodeURIComponent(projectId)}&entityType=TestCase&entityId=${encodeURIComponent(testCaseId)}`),
          ]);
          const traceability = await traceabilityResponse.json();
          const activity = await activityResponse.json();
          if (!traceabilityResponse.ok) throw new Error(traceability.error || 'Gagal memuat traceability.');
          setData(traceability);
          setActivities(activityResponse.ok ? activity.activities || [] : []);
          setError(null);
        } catch (loadError) {
          setError(loadError instanceof Error ? loadError.message : 'Gagal memuat traceability.');
        } finally {
          setLoading(false);
        }
      })();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [projectId, testCaseId]);

  const testCase = data?.testCase;
  const executions = testCase?.testRuns.flatMap(run => run.executions.map(execution => ({ ...execution, run: run.testRun }))) || [];
  const latestExecution = [...executions].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];

  return (
    <TabsContent value="traceability" className="mt-0 space-y-4 outline-none">
      {loading && <p className="text-sm text-muted-foreground">Memuat traceability...</p>}
      {error && <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div>}
      {!loading && !error && testCase && <>
        <div className="grid gap-4 md:grid-cols-2">
          <Card><CardHeader><CardTitle className="flex items-center gap-2 text-sm"><Link2 className="h-4 w-4 text-primary" />Requirements</CardTitle></CardHeader><CardContent className="space-y-2">{testCase.requirements.length ? testCase.requirements.map(item => <div key={item.requirement.id} className="rounded-md border p-3"><span className="font-mono text-xs font-semibold text-primary">{item.requirement.key}</span><p className="mt-1 text-sm">{item.requirement.title}</p></div>) : <p className="text-sm text-muted-foreground">Belum terhubung ke requirement.</p>}</CardContent></Card>
          <Card><CardHeader><CardTitle className="text-sm">Latest execution</CardTitle></CardHeader><CardContent>{latestExecution ? <div className="space-y-2 text-sm"><div className="flex items-center justify-between gap-2"><span>{latestExecution.run.name}</span><Badge variant="outline">{latestExecution.status}</Badge></div><p className="text-xs text-muted-foreground">{new Date(latestExecution.createdAt).toLocaleString('id-ID')} · {latestExecution.tester || 'local-user'}</p>{latestExecution.evidence.length > 0 && <p className="text-xs text-muted-foreground">{latestExecution.evidence.length} evidence terlampir</p>}</div> : <p className="text-sm text-muted-foreground">Belum pernah dijalankan.</p>}</CardContent></Card>
        </div>
          <Card><CardHeader><CardTitle className="text-sm">Test Runs, evidence, dan bugs</CardTitle></CardHeader><CardContent className="space-y-2">{testCase.testRuns.length ? testCase.testRuns.map(item => <div key={item.testRun.id} className="rounded-md border p-3"><div className="flex items-center justify-between gap-2"><span className="font-medium">{item.testRun.name}</span><Badge variant="outline">{item.testRun.status}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{item.executions.length} execution · {item.executions.reduce((total, execution) => total + execution.evidence.length, 0)} evidence</p></div>) : <p className="text-sm text-muted-foreground">Testcase belum masuk Test Run.</p>}{testCase.bugFixItems.length > 0 && <div className="border-t pt-3 text-sm"><p className="font-semibold">Bug terkait</p>{testCase.bugFixItems.map(bug => <div key={bug.id} className="mt-2 rounded-md border border-destructive/20 bg-destructive/5 p-2"><p className="text-xs font-semibold">{bug.title || bug.testCaseId} · {bug.status}</p>{bug.sourceExecution ? <p className="mt-1 text-[11px] text-muted-foreground">Dibuat dari execution {bug.sourceExecution.id} · {bug.sourceExecution.tester || 'local-user'} · {new Date(bug.sourceExecution.createdAt).toLocaleString('id-ID')}</p> : <p className="mt-1 text-[11px] text-muted-foreground">Bug legacy belum memiliki link execution.</p>}</div>)}</div>}</CardContent></Card>
        <Card><CardHeader><CardTitle className="flex items-center gap-2 text-sm"><History className="h-4 w-4 text-primary" />Audit history</CardTitle></CardHeader><CardContent className="space-y-2">{activities.length ? activities.map(activity => <div key={activity.id} className="border-l-2 border-primary/30 pl-3"><p className="text-xs font-semibold">{activity.action}{activity.field ? ` · ${activity.field}` : ''}</p><p className="text-[11px] text-muted-foreground">{new Date(activity.createdAt).toLocaleString('id-ID')} · {activity.actor || 'local-user'}</p></div>) : <p className="text-sm text-muted-foreground">Belum ada history.</p>}</CardContent></Card>
      </>}
    </TabsContent>
  );
}
