'use client';

import { useEffect, useState } from 'react';
import { Bug, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TabsContent } from '@/components/ui/tabs';

type BugItem = { id: string; status: string; priority?: string; testCaseId: string; sourceExecution?: { id: string; testRunId: string; status: string; tester?: string | null; createdAt: string } | null };

export function TestCaseBugsTab({ projectId, testCaseId }: { projectId: string; testCaseId: string }) {
  const [bugs, setBugs] = useState<BugItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`/api/traceability?projectId=${encodeURIComponent(projectId)}&testCaseId=${encodeURIComponent(testCaseId)}`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Gagal memuat bugs.');
        setBugs(data.testCase?.bugFixItems || []);
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Gagal memuat bugs.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [projectId, testCaseId]);

  return <TabsContent value="bugs" className="mt-0 space-y-4 outline-none"><Card><CardHeader><CardTitle className="flex items-center gap-2 text-sm"><Bug className="h-4 w-4 text-destructive" />Bugs terkait ({bugs.length})</CardTitle></CardHeader><CardContent className="space-y-3">{loading && <p className="text-sm text-muted-foreground">Memuat bugs...</p>}{error && <p role="alert" className="text-sm text-destructive">{error}</p>}{!loading && !error && !bugs.length && <p className="text-sm text-muted-foreground">Belum ada bug terkait testcase ini.</p>}{!loading && !error && bugs.map(bug => <div key={bug.id} className="rounded-lg border border-destructive/20 bg-destructive/5 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-mono text-xs font-semibold">{bug.id}</span><div className="flex gap-2"><Badge variant="outline">{bug.priority || 'Medium'}</Badge><Badge variant="failed">{bug.status}</Badge></div></div>{bug.sourceExecution ? <p className="mt-2 text-xs text-muted-foreground">Dibuat dari execution {bug.sourceExecution.id} · {bug.sourceExecution.tester || 'local-user'} · {new Date(bug.sourceExecution.createdAt).toLocaleString('id-ID')}</p> : <p className="mt-2 text-xs text-muted-foreground">Bug legacy belum memiliki link execution.</p>}<Button asChild size="sm" variant="ghost" className="mt-2 h-8 px-2"><a href={`/api/bugfix?projectId=${encodeURIComponent(projectId)}&search=${encodeURIComponent(bug.id)}`} target="_blank" rel="noreferrer">Buka data bug <ExternalLink className="ml-1 h-3.5 w-3.5" /></a></Button></div>)}</CardContent></Card></TabsContent>;
}
