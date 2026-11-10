'use client';

import { useEffect, useState } from 'react';
import { Clock3, PlayCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { TabsContent } from '@/components/ui/tabs';
import { ExecutionMarkdown } from '@/components/ExecutionMarkdown';

type Execution = { id: string; status: string; tester?: string | null; actualResult?: string | null; notes?: string | null; createdAt: string; completedAt?: string | null; evidence: Array<{ id: string; fileName: string; mimeType: string }> };
type RunExecution = { testRun: { id: string; name: string; status: string }; executions: Execution[] };

export function TestCaseExecutionTab({ projectId, testCaseId }: { projectId: string; testCaseId: string }) {
  const [runs, setRuns] = useState<RunExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const response = await fetch(`/api/traceability?projectId=${encodeURIComponent(projectId)}&testCaseId=${encodeURIComponent(testCaseId)}`);
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || 'Gagal memuat execution.');
          setRuns(data.testCase?.testRuns || []);
        } catch (loadError) {
          setError(loadError instanceof Error ? loadError.message : 'Gagal memuat execution.');
        } finally {
          setLoading(false);
        }
      })();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [projectId, testCaseId]);

  const executions = runs.flatMap(run => run.executions.map(execution => ({ ...execution, run: run.testRun })));
  const orderedExecutions = [...executions].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const latest = orderedExecutions[0];

  return (
    <TabsContent value="execution" className="mt-0 space-y-6 outline-none">
      <section className="space-y-3">
        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <PlayCircle className="h-4 w-4 text-primary" />
          Execution workspace history
        </h3>
        {loading ? (
          <p className="text-sm text-muted-foreground">Memuat execution...</p>
        ) : error ? (
          <p role="alert" className="text-sm text-destructive">{error}</p>
        ) : latest ? (
          <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">Latest: {latest.run.name}</p>
                <p className="text-xs text-muted-foreground">
                  {latest.tester || 'local-user'} · {new Date(latest.createdAt).toLocaleString('id-ID')}
                </p>
              </div>
              <Badge variant="outline">{latest.status}</Badge>
            </div>
            {latest.actualResult && (
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-medium">Actual result:</p>
                <ExecutionMarkdown>{latest.actualResult}</ExecutionMarkdown>
              </div>
            )}
            {latest.notes && (
              <div className="min-w-0 text-muted-foreground">
                <ExecutionMarkdown>{latest.notes}</ExecutionMarkdown>
              </div>
            )}
            <p className="text-xs text-muted-foreground">{latest.evidence.length} evidence terlampir</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Belum pernah dijalankan.</p>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Clock3 className="h-4 w-4 text-primary" />
          All executions ({orderedExecutions.length})
        </h3>
        <div className="space-y-2">
          {orderedExecutions.map(execution => (
            <div key={execution.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-secondary/15 p-3">
              <div>
                <p className="text-sm font-medium">{execution.run.name}</p>
                <p className="text-xs text-muted-foreground">
                  {execution.tester || 'local-user'} · {new Date(execution.createdAt).toLocaleString('id-ID')}
                </p>
              </div>
              <Badge variant="outline">{execution.status}</Badge>
            </div>
          ))}
          {!loading && !error && !orderedExecutions.length && (
            <p className="text-sm text-muted-foreground">Belum ada history execution.</p>
          )}
        </div>
      </section>
    </TabsContent>
  );
}
