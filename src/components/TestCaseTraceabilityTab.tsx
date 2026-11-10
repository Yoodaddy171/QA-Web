'use client';

import { useEffect, useState } from 'react';
import { History, Link2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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
    <TabsContent value="traceability" className="mt-0 space-y-6 outline-none">
      {loading && <p className="text-sm text-muted-foreground">Memuat traceability...</p>}
      {error && <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div>}
      {!loading && !error && testCase && (
        <>
          <div className="grid gap-6 md:grid-cols-2">
            <section className="space-y-3">
              <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Link2 className="h-4 w-4 text-primary" />
                Requirements
              </h3>
              <div className="space-y-2">
                {testCase.requirements.length ? (
                  testCase.requirements.map(item => (
                    <div key={item.requirement.id} className="rounded-lg border border-border bg-card p-3">
                      <span className="font-mono text-xs font-semibold text-primary">{item.requirement.key}</span>
                      <p className="mt-1 text-sm">{item.requirement.title}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Belum terhubung ke requirement.</p>
                )}
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Eksekusi terakhir
              </h3>
              <div>
                {latestExecution ? (
                  <div className="space-y-2 rounded-lg border border-border bg-card p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{latestExecution.run.name}</span>
                      <Badge variant="outline">{latestExecution.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(latestExecution.createdAt).toLocaleString('id-ID')} · {latestExecution.tester || 'local-user'}
                    </p>
                    {latestExecution.evidence.length > 0 && (
                      <p className="text-xs text-muted-foreground">{latestExecution.evidence.length} evidence terlampir</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Belum pernah dijalankan.</p>
                )}
              </div>
            </section>
          </div>

          <section className="space-y-3">
            <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Test Runs, evidence, dan bugs
            </h3>
            <div className="space-y-2">
              {testCase.testRuns.length ? (
                testCase.testRuns.map(item => (
                  <div key={item.testRun.id} className="rounded-lg border border-border bg-card p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{item.testRun.name}</span>
                      <Badge variant="outline">{item.testRun.status}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.executions.length} execution · {item.executions.reduce((total, execution) => total + execution.evidence.length, 0)} evidence
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Testcase belum masuk Test Run.</p>
              )}
              {testCase.bugFixItems.length > 0 && (
                <div className="border-t border-border pt-3 text-sm">
                  <p className="font-semibold mb-2">Bug terkait</p>
                  <div className="space-y-2">
                    {testCase.bugFixItems.map(bug => (
                      <div key={bug.id} className="rounded-lg border border-destructive/20 bg-destructive/5 p-2.5">
                        <p className="text-xs font-semibold">{bug.title || bug.testCaseId} · {bug.status}</p>
                        {bug.sourceExecution ? (
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            Dibuat dari execution {bug.sourceExecution.id} · {bug.sourceExecution.tester || 'local-user'} · {new Date(bug.sourceExecution.createdAt).toLocaleString('id-ID')}
                          </p>
                        ) : (
                          <p className="mt-1 text-[11px] text-muted-foreground">Bug legacy belum memiliki link execution.</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <History className="h-4 w-4 text-primary" />
              Audit history
            </h3>
            <div className="space-y-2">
              {activities.length ? (
                activities.map(activity => (
                  <div key={activity.id} className="rounded-lg border border-border bg-card p-2.5">
                    <p className="text-xs font-semibold">{activity.action}{activity.field ? ` · ${activity.field}` : ''}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(activity.createdAt).toLocaleString('id-ID')} · {activity.actor || 'local-user'}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Belum ada history.</p>
              )}
            </div>
          </section>
        </>
      )}
    </TabsContent>
  );
}
