'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { FileImage, FileVideo, Paperclip } from 'lucide-react';
import { TestCaseEvidencePreview } from '@/components/TestCaseEvidencePreview';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TabsContent } from '@/components/ui/tabs';
import { LatestRequest } from '@/lib/client/latest-request';

type Evidence = { id: string; fileName: string; mimeType: string; createdAt: string; updatedAt?: string };
type Item = { evidence: Evidence; execution: { id: string; status: string }; run: { id: string; name: string } };
const urlFor = (item: Item, projectId: string) => `/api/test-runs/${item.run.id}/executions/${item.execution.id}/evidence/${item.evidence.id}?${new URLSearchParams({ projectId })}`;
function Thumbnail({ url, name }: { url: string; name: string }) {
  const [failed, setFailed] = useState(false);
  return failed ? <span className="flex items-center gap-2 text-sm"><FileImage className="size-5" />Buka gambar asli</span> : <img src={url} alt={name} loading="lazy" decoding="async" className="h-full w-full object-contain" onError={() => setFailed(true)} />;
}
export function TestCaseEvidenceTab(props: { projectId: string; testCaseId: string }) {
  return <EvidenceGallery key={`${props.projectId}:${props.testCaseId}`} {...props} />;
}
function EvidenceGallery({ projectId, testCaseId }: { projectId: string; testCaseId: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<Item | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const requests = useRef(new LatestRequest());
  const previewTrigger = useRef<HTMLButtonElement | null>(null);
  const load = useCallback(async (after?: string) => {
    const request = requests.current.begin();
    if (after) setLoadingMore(true); else setLoading(true);
    try {
      const params = new URLSearchParams({ projectId, limit: '25' }); if (after) params.set('cursor', after);
      const response = await fetch(`/api/testcases/${encodeURIComponent(testCaseId)}/evidence?${params}`, { signal: request.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal memuat evidence. Coba lagi.');
      if (!request.current()) return;
      const next: Item[] = data.items || [];
      setItems(previous => after ? [...previous, ...next.filter(item => !previous.some(old => old.evidence.id === item.evidence.id))] : next);
      setTotal(data.total || 0); setCursor(data.nextCursor || null); setError('');
      return next;
    } catch (cause) { if (request.current()) setError(cause instanceof Error ? cause.message : 'Evidence belum dimuat.'); }
    finally { if (request.current()) { setLoading(false); setLoadingMore(false); } }
  }, [projectId, testCaseId]);
  useEffect(() => { const timer = setTimeout(() => void load(), 0); return () => { clearTimeout(timer); requests.current.cancel(); }; }, [load]);
  const photos = items.filter(item => item.evidence.mimeType.startsWith('image/'));
  const photoIndex = photos.findIndex(item => item.evidence.id === preview?.evidence.id);
  const changePhoto = async (direction: -1 | 1) => {
    if (!preview || loadingMore) return;
    const next = photos[photoIndex + direction];
    if (next) { setPreview(next); return; }
    if (direction === 1 && cursor) {
      const currentId = preview.evidence.id;
      const rows = await load(cursor);
      const nextPhoto = rows?.find(item => item.evidence.mimeType.startsWith('image/'));
      if (nextPhoto) setPreview(current => current?.evidence.id === currentId ? nextPhoto : current);
    }
  };
  return (
    <TabsContent value="evidence" className="mt-0 flex flex-col gap-4 outline-none">
      <section className="space-y-3">
        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Paperclip className="size-4 text-primary" />
          Evidence ({total})
        </h3>
        {loading && <p role="status" className="text-sm text-muted-foreground">Memuat evidence…</p>}
        {error && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <p role="alert" className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={() => void load(items.length && cursor ? cursor : undefined)}>Coba lagi</Button>
          </div>
        )}
        {!loading && !error && !items.length && (
          <p className="text-sm text-muted-foreground">Belum ada evidence. Tambahkan dari Execution Workspace.</p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          {items.map(item => {
            const { evidence, execution, run } = item;
            const url = urlFor(item, projectId);
            const isVideo = evidence.mimeType.startsWith('video/');
            return (
              <div key={evidence.id} className="overflow-hidden rounded-lg border border-border bg-secondary/20">
                <button
                  type="button"
                  aria-label={`Preview evidence ${evidence.fileName}`}
                  className="flex h-44 w-full items-center justify-center bg-secondary/20 text-primary hover:bg-secondary/40 focus-visible:outline-2 focus-visible:outline-ring"
                  onClick={event => {
                    previewTrigger.current = event.currentTarget;
                    setPreview(item);
                    setPreviewOpen(true);
                  }}
                >
                  {evidence.mimeType.startsWith('image/') ? (
                    <Thumbnail url={`${url}&thumbnail=1&v=${encodeURIComponent(evidence.updatedAt || evidence.createdAt)}`} name={evidence.fileName} />
                  ) : (
                    <span className="flex items-center gap-2">
                      {isVideo ? <FileVideo className="size-5" /> : <FileImage className="size-5" />}
                      Preview {isVideo ? 'video' : evidence.mimeType === 'application/pdf' ? 'PDF' : 'file'}
                    </span>
                  )}
                </button>
                <div className="flex flex-col gap-1 p-3">
                  <p className="truncate text-sm font-semibold" title={evidence.fileName}>{evidence.fileName}</p>
                  <p className="text-xs text-muted-foreground">{run.name} · {new Date(evidence.createdAt).toLocaleString('id-ID')}</p>
                  <Badge variant="outline">{execution.status}</Badge>
                </div>
              </div>
            );
          })}
        </div>
        {!loading && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">{items.length} dari {total} evidence dimuat</p>
            {cursor && (
              <Button variant="outline" disabled={loadingMore} onClick={() => void load(cursor)}>
                {loadingMore ? 'Memuat…' : 'Muat evidence berikutnya'}
              </Button>
            )}
          </div>
        )}
      </section>
      {preview && (
        <TestCaseEvidencePreview
          evidence={preview.evidence}
          url={urlFor(preview, projectId)}
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          photoIndex={photoIndex}
          photoCount={photos.length}
          hasMorePhotos={Boolean(cursor)}
          loadingMore={loadingMore}
          onPhotoChange={direction => void changePhoto(direction)}
          onReturnFocus={() => { if (previewTrigger.current?.isConnected) previewTrigger.current.focus(); }}
        />
      )}
    </TabsContent>
  );
}
