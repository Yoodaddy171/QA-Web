'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Code2, Download, FileCode2, Play, RefreshCw, Save, ShieldAlert, Square, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import type { AutomationLogEntry } from '@/hooks/useAutomationLogs';
import { cn } from '@/lib/utils';

export type ScriptArtifact = { id: string; name: string; kind: 'video' | 'screenshot' | 'trace'; size: number; startedAtRelativeMs?: number };
export type ScriptRun = { runId: string; status: string; actor: string; createdAt: string; startedAt: string | null; endedAt: string | null; durationMs?: number; artifacts: ScriptArtifact[]; error?: string | null };
const ACTIVE = new Set(['QUEUED', 'RUNNING']);
const LABELS: Record<string, string> = { QUEUED: 'Dalam antrean', RUNNING: 'Sedang berjalan', PASSED: 'Berhasil', FAILED: 'Gagal', CANCELLED: 'Dibatalkan', INTERRUPTED: 'Terputus', TIMED_OUT: 'Batas waktu habis', RESOURCE_LIMIT: 'Batas artefak tercapai', SKIPPED: 'Dilewati' };
export const PLAYWRIGHT_TEMPLATE = `import { test, expect } from '@playwright/test';

test('Skenario pengujian', async ({ page }) => {
  await test.step('Buka halaman target', async () => {
    await page.goto('/');
  });

  await test.step('Verifikasi halaman berhasil dimuat', async () => {
    await expect(page.locator('body')).toBeVisible();
  });
});
`;

export function scriptArtifactUrl(projectId: string, testCaseId: string, runId: string, artifact: string) {
  return `/api/automation/scripts?${new URLSearchParams({ projectId, testCaseId, runId, artifact })}`;
}

export function PlaywrightScriptPanel({ projectId, testCaseId, onInspect, onDirtyChange }: {
  projectId: string; testCaseId: string;
  onInspect: (run: ScriptRun, logs: AutomationLogEntry[], artifactId?: string, activate?: boolean) => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const { toast } = useToast();
  const [script, setScript] = useState(PLAYWRIGHT_TEMPLATE);
  const [baseURL, setBaseURL] = useState('');
  const [timeoutSeconds, setTimeoutSeconds] = useState(60);
  const [runs, setRuns] = useState<ScriptRun[]>([]);
  const [online, setOnline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pending, setPending] = useState('');
  const [trusted, setTrusted] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(true);
  const initial = useRef(false);
  const selection = useRef<string | null>(null);
  const loadedEvents = useRef<AutomationLogEntry[]>([]);
  const cursor = useRef(0);
  const fetchingRun = useRef(false);
  const generation = useRef(0);
  const inspectRef = useRef(onInspect);
  const fileInput = useRef<HTMLInputElement>(null);
  const endpoint = `/api/automation/scripts?${new URLSearchParams({ projectId, testCaseId })}`;
  const draftKey = `traceva:playwright-draft:v1:${projectId}:${testCaseId}`;
  useEffect(() => { inspectRef.current = onInspect; }, [onInspect]);

  const markDirty = (value: boolean) => { setDirty(value); onDirtyChange?.(value); };
  const load = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch(endpoint, { cache: 'no-store', signal });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Gagal memuat script.');
    if (signal?.aborted) return;
    setOnline(data.health.online); setRuns(data.runs); setError(''); setLoading(false);
    if (!initial.current) {
      initial.current = true;
      let draft;
      try { draft = JSON.parse(localStorage.getItem(draftKey) || 'null'); } catch { /* Server copy remains available. */ }
      const saved = draft || data.script;
      if (saved) { setScript(saved.script); setBaseURL(saved.baseURL || ''); setTimeoutSeconds(saved.timeoutSeconds || 60); }
      if (draft) { setDirty(true); onDirtyChange?.(true); }
    }
  }, [endpoint, draftKey, onDirtyChange]);

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        await load(controller.signal);
        if (selection.current && !fetchingRun.current) {
          const id = selection.current;
          const requestedCursor = cursor.current;
          const requestedGeneration = generation.current;
          const response = await fetch(`${endpoint}&runId=${encodeURIComponent(id)}&cursor=${requestedCursor}`, { signal: controller.signal, cache: 'no-store' });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || 'Gagal memuat hasil run.');
          if (!controller.signal.aborted && selection.current === id && generation.current === requestedGeneration && cursor.current === requestedCursor) {
            loadedEvents.current = [...loadedEvents.current, ...data.events]; cursor.current = data.nextCursor;
            inspectRef.current(data.run, loadedEvents.current, undefined, false);
          }
        }
      } catch (err) { if (!controller.signal.aborted) { setError(err instanceof Error ? err.message : 'Gagal memuat automation.'); setLoading(false); } }
      if (!controller.signal.aborted) timer = setTimeout(poll, 2000);
    };
    void poll();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [load, endpoint]);

  useEffect(() => {
    if (!dirty) return;
    try { localStorage.setItem(draftKey, JSON.stringify({ script, baseURL, timeoutSeconds })); } catch { /* Unsaved warning remains active if storage is full. */ }
  }, [dirty, draftKey, script, baseURL, timeoutSeconds]);

  const inspect = async (run: ScriptRun, artifactId?: string) => {
    setEditorOpen(false);
    const id = run.runId;
    const requestGeneration = ++generation.current;
    fetchingRun.current = true;
    selection.current = id; setSelected(id); cursor.current = 0; loadedEvents.current = [];
    inspectRef.current(run, [], artifactId, true);
    try {
      const response = await fetch(`${endpoint}&runId=${encodeURIComponent(id)}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal memuat hasil.');
      if (selection.current === id && generation.current === requestGeneration) { loadedEvents.current = data.events; cursor.current = data.nextCursor; inspectRef.current(data.run, data.events, artifactId, false); }
    } catch (err) { setError(err instanceof Error ? err.message : 'Gagal memuat hasil.'); }
    finally { if (generation.current === requestGeneration) fetchingRun.current = false; }
  };

  const mutate = async (action: 'save' | 'run' | 'stop', runId?: string) => {
    setPending(action); setError('');
    try {
      const response = await fetch(`${endpoint}${runId ? `&runId=${encodeURIComponent(runId)}` : ''}`, { method: action === 'save' ? 'PUT' : action === 'stop' ? 'DELETE' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ script, baseURL, timeoutSeconds }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Tindakan gagal.');
      if (action === 'save') { markDirty(false); try { localStorage.removeItem(draftKey); } catch {} }
      if (action === 'run') void inspect(data.run);
      toast({ title: action === 'save' ? 'Script tersimpan' : action === 'run' ? 'Run masuk antrean' : 'Permintaan Stop dikirim', description: action === 'run' ? 'Video dan devlog akan muncul di bawah. Status testcase tidak diubah otomatis.' : undefined });
      await load();
    } catch (err) { const message = err instanceof Error ? err.message : 'Tindakan gagal.'; setError(message); toast({ title: 'Automation belum berhasil', description: message, variant: 'destructive' }); }
    finally { setPending(''); }
  };
  const active = runs.find(run => ACTIVE.has(run.status));

  return <section className="mb-5 min-w-0 shrink-0 overflow-hidden rounded-xl border border-border bg-card" aria-label="Playwright script runner">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-4">
      <div className="flex items-start gap-3"><Code2 className="mt-0.5 size-5 text-primary" /><div><h3 className="text-base font-semibold">Playwright Studio</h3><p className="mt-1 text-sm text-muted-foreground">Tulis skenario. Jalankan. Tinjau video dan devlog di satu tempat.</p></div></div>
      <div className="flex flex-wrap items-center gap-3"><span className={cn('text-xs font-medium', online ? 'text-status-passed' : 'text-muted-foreground')} role="status">{loading ? 'Memeriksa runner…' : online ? 'Runner lokal terhubung' : 'Runner offline'}</span><Button type="button" variant="outline" size="sm" aria-expanded={editorOpen} onClick={() => setEditorOpen(value => !value)}>{editorOpen ? 'Sembunyikan editor' : 'Edit script'}</Button></div>
    </header>
    {editorOpen && <div className="flex flex-col gap-4 p-4">
      {!loading && !online && <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">Jalankan <code className="text-foreground">npm run automation:runner</code> di mesin Traceva. Tidak perlu membuka port tambahan.</p>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-medium"><FileCode2 className="size-4" />test.spec.ts <span className="text-xs text-muted-foreground">{script.split('\n').length} baris · {dirty ? 'Draft belum disimpan' : 'Script siap'}</span></span>
        <div className="flex gap-2"><Button type="button" variant="ghost" size="sm" onClick={() => { if (!dirty || window.confirm('Ganti draft dengan template?')) { setScript(PLAYWRIGHT_TEMPLATE); markDirty(true); } }}>Template</Button><Button type="button" variant="outline" size="sm" onClick={() => fileInput.current?.click()}><Upload className="size-4" />Unggah script</Button></div>
        <input ref={fileInput} aria-label="Unggah file script Playwright" type="file" accept=".ts,.js,.mts,.mjs" className="hidden" onChange={async event => { const file = event.target.files?.[0]; if (!file) return; if (file.size > 100000) { setError('Ukuran script maksimal 100 KB.'); return; } if (dirty && !window.confirm('Ganti draft dengan file ini?')) return; setScript(await file.text()); markDirty(true); event.target.value = ''; }} />
      </div>
      <Textarea aria-label="Script Playwright" value={script} spellCheck={false} className="h-72 min-h-60 max-h-[480px] resize-y overflow-auto whitespace-pre font-mono text-sm leading-6 [field-sizing:fixed]" onChange={event => { setScript(event.target.value); markDirty(true); }} onKeyDown={event => { if ((event.ctrlKey || event.metaKey) && event.key === 's') { event.preventDefault(); void mutate('save'); } }} />
      <div className="grid min-w-0 gap-3 sm:grid-cols-[1fr_160px]">
        <label className="min-w-0 space-y-2 text-sm font-medium">Base URL <span className="font-normal text-muted-foreground">(opsional)</span><Input className="mt-2" value={baseURL} placeholder="https://website-yang-dites.com" onChange={event => { setBaseURL(event.target.value); markDirty(true); }} /></label>
        <label className="space-y-2 text-sm font-medium">Batas waktu (detik)<Input className="mt-2" type="number" min={10} max={180} value={timeoutSeconds} onChange={event => { setTimeoutSeconds(Number(event.target.value)); markDirty(true); }} /></label>
      </div>
      <label className="flex items-start gap-3 text-sm leading-6 text-muted-foreground"><input type="checkbox" checked={trusted} onChange={event => setTrusted(event.target.checked)} className="mt-1 size-4 accent-primary" /><ShieldAlert className="mt-1 size-4 shrink-0" /><span>Saya mempercayai script ini. Script berjalan dengan akses akun sistem runner, bukan di sandbox. Jangan menaruh password atau token di script.</span></label>
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-muted-foreground">Chromium · Video & trace otomatis · Satu run bersamaan</p><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={Boolean(pending) || loading} onClick={() => void mutate('save')}><Save className="size-4" />{pending === 'save' ? 'Menyimpan…' : 'Simpan script'}</Button><Button type="button" disabled={!online || !trusted || Boolean(pending) || Boolean(active) || loading || !script.trim()} onClick={() => void mutate('run')}><Play className="size-4" />{pending === 'run' ? 'Mengantrekan…' : 'Run script'}</Button></div></div>
      {error && <p role="alert" className="break-words rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
    </div>}
    {!editorOpen && error && <p role="alert" className="m-4 break-words text-sm text-destructive">{error}</p>}
    <div className="border-t border-border">
      <div className="flex items-center justify-between gap-3 px-4 py-3"><h4 className="text-sm font-semibold">Riwayat eksekusi <span className="font-normal text-muted-foreground">· 20 run terbaru</span></h4><Button type="button" variant="ghost" size="sm" aria-label="Muat ulang riwayat eksekusi" onClick={() => void load().catch(err => setError(err.message))}><RefreshCw className="size-4" /></Button></div>
      {runs.length === 0 ? <p className="px-4 pb-4 text-sm text-muted-foreground">Belum ada run. Jalankan script untuk merekam hasil pengujian pertama.</p> : <ol className="max-h-80 divide-y divide-border overflow-y-auto overscroll-contain">
        {runs.map(run => <li key={run.runId} className={cn('px-4 py-3', selected === run.runId && 'bg-muted/60')}>
          <div className="flex flex-wrap items-center justify-between gap-2"><button type="button" className="min-w-0 rounded text-left focus-visible:outline-2 focus-visible:outline-ring" onClick={() => void inspect(run)} aria-pressed={selected === run.runId}><span className={cn('text-sm font-semibold', run.status === 'PASSED' ? 'text-status-passed' : run.status === 'FAILED' ? 'text-status-failed' : 'text-foreground')}>{LABELS[run.status] || 'Status tidak diketahui'}</span><span className="ml-2 text-xs text-muted-foreground">{new Date(run.createdAt).toLocaleString('id-ID')} {run.durationMs !== undefined ? `· ${(run.durationMs / 1000).toFixed(1)} dtk` : ''}</span><span className="mt-1 block text-xs text-muted-foreground">{run.actor} · Buka hasil di viewer bawah</span></button>
            {ACTIVE.has(run.status) && <Button type="button" variant="outline" size="sm" disabled={Boolean(pending)} onClick={() => void mutate('stop', run.runId)}><Square className="size-3" />Stop</Button>}
          </div>
          {run.artifacts.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{run.artifacts.map(artifact => artifact.kind === 'video' ? <Button key={artifact.id} variant="outline" size="sm" onClick={() => void inspect(run, artifact.id)}><Play className="size-3" />Video {run.artifacts.filter(item => item.kind === 'video').indexOf(artifact) + 1}</Button> : <a key={artifact.id} className="inline-flex min-h-9 items-center gap-1 rounded-md px-2 text-xs text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring" href={scriptArtifactUrl(projectId, testCaseId, run.runId, artifact.id)} download={artifact.name}><Download className="size-3" />{artifact.kind === 'trace' ? 'Trace' : 'Screenshot'}</a>)}</div>}
          {selected === run.runId && run.error && <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-muted p-3 text-xs text-destructive">{run.error}</pre>}
        </li>)}
      </ol>}
    </div>
  </section>;
}
