'use client';

import { useEffect, useRef, useState } from 'react';
import { FileImage, FileVideo, Paperclip } from 'lucide-react';
import { TestCaseEvidencePreview } from '@/components/TestCaseEvidencePreview';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TabsContent } from '@/components/ui/tabs';

type Evidence = { id: string; fileName: string; mimeType: string; createdAt: string };
type Run = { testRun: { id: string; name: string }; executions: Array<{ id: string; status: string; createdAt: string; evidence: Evidence[] }> };

export function TestCaseEvidenceTab({ projectId, testCaseId }: { projectId: string; testCaseId: string }) {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ evidence: Evidence; url: string; testCaseId: string } | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const previewTrigger = useRef<HTMLButtonElement | null>(null);

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
  const photos = evidenceItems.filter(item => item.evidence.mimeType.startsWith('image/'));
  const photoIndex = preview ? photos.findIndex(item => item.evidence.id === preview.evidence.id) : -1;
  const changePhoto = (direction: -1 | 1) => {
    setPreview(current => {
      if (!current || current.testCaseId !== testCaseId) return current;
      const index = photos.findIndex(item => item.evidence.id === current.evidence.id);
      if (index < 0) return current;
      const next = photos[index + direction];
      return next ? { evidence: next.evidence, url: `/api/test-runs/${next.run.id}/executions/${next.execution.id}/evidence/${next.evidence.id}?projectId=${encodeURIComponent(projectId)}`, testCaseId } : current;
    });
  };

  return <TabsContent value="evidence" className="mt-0 space-y-4 outline-none">
    <Card><CardHeader><CardTitle className="flex items-center gap-2 text-sm"><Paperclip className="h-4 w-4 text-primary" />Evidence ({evidenceItems.length})</CardTitle></CardHeader><CardContent>
      {loading && <p className="text-sm text-muted-foreground">Memuat evidence...</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {!loading && !error && !evidenceItems.length && <p className="text-sm text-muted-foreground">Belum ada evidence. Tambahkan dari Execution Workspace.</p>}
      {!loading && !error && evidenceItems.length > 0 && <div className="grid gap-4 sm:grid-cols-2">
        {evidenceItems.map(({ evidence, execution, run }) => {
          const url = `/api/test-runs/${run.id}/executions/${execution.id}/evidence/${evidence.id}?projectId=${encodeURIComponent(projectId)}`;
          const isVideo = evidence.mimeType.startsWith('video/');
          return <div key={evidence.id} className="overflow-hidden rounded-lg border border-border/60 bg-secondary/20">
            <button type="button" aria-label={`Preview evidence ${evidence.fileName}`} className="flex h-44 w-full items-center justify-center bg-secondary/20 text-primary hover:bg-secondary/40 focus-visible:outline-2 focus-visible:outline-ring" onClick={event => { previewTrigger.current = event.currentTarget; setPreview({ evidence, url, testCaseId }); setPreviewOpen(true); }}>
              {evidence.mimeType.startsWith('image/') ? <img src={url} alt={evidence.fileName} loading="lazy" className="h-full w-full object-contain" /> : <span className="flex items-center gap-2">{isVideo ? <FileVideo className="size-5" /> : <FileImage className="size-5" />}Preview {isVideo ? 'video' : evidence.mimeType === 'application/pdf' ? 'PDF' : 'file'}</span>}
            </button>
            <div className="space-y-1 p-3"><p className="truncate text-sm font-semibold" title={evidence.fileName}>{isVideo && <FileVideo className="mr-1 inline h-4 w-4" />}{evidence.fileName}</p><p className="text-[11px] text-muted-foreground">{run.name} · {new Date(evidence.createdAt).toLocaleString('id-ID')}</p><Badge variant="outline">{execution.status}</Badge></div>
          </div>;
        })}
      </div>}
    </CardContent></Card>
    {preview && <TestCaseEvidencePreview evidence={preview.evidence} url={preview.url} open={previewOpen && preview.testCaseId === testCaseId} onOpenChange={setPreviewOpen} photoIndex={photoIndex} photoCount={photos.length} onPhotoChange={changePhoto} onReturnFocus={() => { if (previewTrigger.current?.isConnected) previewTrigger.current.focus(); }} />}
  </TabsContent>;
}
