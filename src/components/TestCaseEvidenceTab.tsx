'use client';

import { useEffect, useState } from 'react';
import { FileImage, FileVideo, Paperclip } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TabsContent } from '@/components/ui/tabs';

type Evidence = { id: string; fileName: string; mimeType: string; createdAt: string };
type Run = { testRun: { id: string; name: string }; executions: Array<{ id: string; status: string; createdAt: string; evidence: Evidence[] }> };

export function TestCaseEvidenceTab({ projectId, testCaseId }: { projectId: string; testCaseId: string }) {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`/api/traceability?projectId=${encodeURIComponent(projectId)}&testCaseId=${encodeURIComponent(testCaseId)}`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Gagal memuat evidence.');
        setRuns(data.testCase?.testRuns || []);
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Gagal memuat evidence.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [projectId, testCaseId]);

  const evidenceItems = runs.flatMap(run => run.executions.flatMap(execution => execution.evidence.map(evidence => ({ evidence, execution, run: run.testRun }))));

  return <TabsContent value="evidence" className="mt-0 space-y-4 outline-none">
    <Card><CardHeader><CardTitle className="flex items-center gap-2 text-sm"><Paperclip className="h-4 w-4 text-primary" />Evidence ({evidenceItems.length})</CardTitle></CardHeader><CardContent>
      {loading && <p className="text-sm text-muted-foreground">Memuat evidence...</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {!loading && !error && !evidenceItems.length && <p className="text-sm text-muted-foreground">Belum ada evidence. Tambahkan dari Execution Workspace.</p>}
      {!loading && !error && evidenceItems.length > 0 && <div className="grid gap-4 sm:grid-cols-2">
        {evidenceItems.map(({ evidence, execution, run }) => {
          const url = `/api/test-runs/${run.id}/executions/${execution.id}/evidence/${evidence.id}?projectId=${encodeURIComponent(projectId)}`;
          const isImage = evidence.mimeType.startsWith('image/');
          const isVideo = evidence.mimeType.startsWith('video/');
          return <div key={evidence.id} className="overflow-hidden rounded-lg border border-border/60 bg-secondary/20">
            {isImage ? <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={evidence.fileName} className="h-44 w-full object-contain bg-black/10" /></a> : isVideo ? <video src={url} controls preload="metadata" className="h-44 w-full bg-black/10" /> : <a href={url} target="_blank" rel="noreferrer" className="flex h-44 items-center justify-center text-primary hover:underline"><FileImage className="mr-2 h-5 w-5" />Buka file</a>}
            <div className="space-y-1 p-3"><p className="truncate text-sm font-semibold" title={evidence.fileName}>{isVideo && <FileVideo className="mr-1 inline h-4 w-4" />}{evidence.fileName}</p><p className="text-[11px] text-muted-foreground">{run.name} · {new Date(evidence.createdAt).toLocaleString('id-ID')}</p><Badge variant="outline">{execution.status}</Badge></div>
          </div>;
        })}
      </div>}
    </CardContent></Card>
  </TabsContent>;
}
