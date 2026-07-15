'use client';

import { Button } from '@/components/ui/button';
type Evidence = { id: string; fileName: string; mimeType: string };

export function ExecutionEvidencePreview({ evidence, testRunId, executionId, projectId, onReplace }: { evidence: Evidence[]; testRunId: string; executionId: string; projectId: string; onReplace?: (evidenceId: string, file: File) => void }) {
  const baseUrl = `/api/test-runs/${encodeURIComponent(testRunId)}/executions/${encodeURIComponent(executionId)}/evidence`;
  const urlFor = (id: string) => `${baseUrl}/${encodeURIComponent(id)}?projectId=${encodeURIComponent(projectId)}`;
  const visualEvidence = evidence.filter(item => item.mimeType.startsWith('image/') || item.mimeType.startsWith('video/'));
  if (!visualEvidence.length) return null;

  return (
    <div className="rounded-xl border border-border/70 bg-secondary/20 p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Inline evidence preview</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {visualEvidence.map(item => {
          const url = urlFor(item.id);
          return <div key={item.id} className="overflow-hidden rounded-lg border border-border/60 bg-background">
            {item.mimeType.startsWith('image/')
              ? <img src={url} alt={item.fileName} className="max-h-64 w-full object-contain" />
              : <video src={url} controls preload="metadata" className="max-h-64 w-full" />}
            <div className="flex items-center justify-between gap-2 px-2 py-1.5"><p className="truncate text-[10px] text-muted-foreground">{item.fileName}</p>{onReplace && <label className="shrink-0"><Button asChild variant="ghost" size="sm" className="h-6 px-2 text-[10px]"><span>Replace</span></Button><input type="file" className="sr-only" accept="image/*,video/mp4,video/webm,application/pdf" onChange={event => { const file = event.target.files?.[0]; if (file) onReplace(item.id, file); event.currentTarget.value = ''; }} /></label>}</div>
          </div>;
        })}
      </div>
    </div>
  );
}
