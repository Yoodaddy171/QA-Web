'use client';

import { useEffect, useState } from 'react';
import { MutationAction, useWorkspaceAccess } from '@/components/WorkspaceAccess';
import { MessageSquare, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { TabsContent } from '@/components/ui/tabs';
import { Kbd } from '@/components/ui/kbd';

type CommentActivity = { id: string; actor?: string | null; createdAt: string; afterValue?: unknown };

function commentText(value: unknown) {
  if (!value || typeof value !== 'object') return '';
  const text = (value as { comment?: unknown }).comment;
  return typeof text === 'string' ? text : '';
}

export function TestCaseCommentsTab({ projectId, testCaseId, onDirtyChange }: { projectId: string; testCaseId: string; onDirtyChange?: (dirty: boolean) => void }) {
  const { canEdit } = useWorkspaceAccess();
  const [comments, setComments] = useState<CommentActivity[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadComments = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/activity?projectId=${encodeURIComponent(projectId)}&entityType=TestCase&entityId=${encodeURIComponent(testCaseId)}&action=COMMENTED`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal memuat komentar.');
      setComments(data.activities || []);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Gagal memuat komentar.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { const timer = window.setTimeout(() => { void loadComments(); }, 0); return () => window.clearTimeout(timer); }, [projectId, testCaseId]);
  useEffect(() => {
    onDirtyChange?.(Boolean(draft.trim()));
    return () => onDirtyChange?.(false);
  }, [draft, onDirtyChange]);
  useEffect(() => {
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!draft.trim()) return;
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [draft]);

  const addComment = async () => {
    const comment = draft.trim();
    if (!canEdit || !comment) return;
    setSaving(true);
    try {
      const response = await fetch('/api/activity', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId, entityType: 'TestCase', entityId: testCaseId, action: 'COMMENTED', afterValue: { comment } }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal menyimpan komentar.');
      setDraft('');
      setComments(previous => [data.activity, ...previous]);
      setError(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Gagal menyimpan komentar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <TabsContent value="comments" className="mt-0 space-y-4 outline-none">
      <section className="space-y-3">
        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <MessageSquare className="h-4 w-4 text-primary" />
          Comments
        </h3>
        <Textarea
          readOnly={!canEdit}
          aria-label="Komentar testcase"
          value={draft}
          onChange={event => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
              event.preventDefault();
              if (!saving && draft.trim()) {
                void addComment();
              }
            }
          }}
          placeholder="Tulis komentar untuk testcase ini... (tekan Ctrl+Enter untuk kirim)"
          className="min-h-20"
        />
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
            Tekan <Kbd size="sm">Ctrl</Kbd> + <Kbd size="sm">Enter</Kbd> untuk kirim
          </span>
          <MutationAction>
            <Button onClick={() => void addComment()} disabled={saving || !draft.trim()} size="sm">
              <Send className="mr-1.5 h-3.5 w-3.5" />
              {saving ? 'Menyimpan...' : 'Tambah komentar'}
            </Button>
          </MutationAction>
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {loading ? (
          <p className="text-sm text-muted-foreground">Memuat komentar...</p>
        ) : comments.length ? (
          comments.map(comment => (
            <div key={comment.id} className="rounded-lg border border-border/60 p-3">
              <p className="whitespace-pre-wrap text-sm">{commentText(comment.afterValue)}</p>
              <p className="mt-2 text-[11px] text-muted-foreground">
                {comment.actor || 'local-user'} · {new Date(comment.createdAt).toLocaleString('id-ID')}
              </p>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">Belum ada komentar.</p>
        )}
      </section>
    </TabsContent>
  );
}
