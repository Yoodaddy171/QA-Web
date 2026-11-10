'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Code2, Download, FileCode2, Play, RefreshCw, Save, ShieldAlert, Square, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import type { AutomationLogEntry } from '@/hooks/useAutomationLogs';
import { cn } from '@/lib/utils';
import { latestScriptResult } from '@/lib/client/automation/latest-result';
import { EventBuffer } from '@/lib/client/automation/event-buffer';

export type ScriptArtifact = { id: string; name: string; kind: 'video' | 'screenshot' | 'trace'; size: number; startedAtRelativeMs?: number };
export type ScriptRun = { runId: string; status: string; actor: string; createdAt: string; startedAt: string | null; endedAt: string | null; durationMs?: number; artifacts: ScriptArtifact[]; error?: string | null };
const ACTIVE = new Set(['QUEUED', 'RUNNING']);
const LABELS: Record<string, string> = { QUEUED: 'Dalam antrean', RUNNING: 'Sedang berjalan', PASSED: 'Script berhasil', FAILED: 'Script gagal', CANCELLED: 'Dibatalkan', INTERRUPTED: 'Terputus', TIMED_OUT: 'Batas waktu habis', RESOURCE_LIMIT: 'Batas artefak tercapai', SKIPPED: 'Dilewati' };
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

export function PlaywrightScriptPanel({ projectId, testCaseId, onInspect, onDirtyChange, onRunsDeleted, view = 'script', onShowResults, onCaptureResults, selectedRunId, captureStartedAt }: {
  projectId: string; testCaseId: string;
  onInspect: (run: ScriptRun, logs: AutomationLogEntry[], artifactId?: string, activate?: boolean) => void;
  onDirtyChange?: (dirty: boolean) => void;
  onRunsDeleted?: (runIds: string[]) => void;
  view?: 'results' | 'script' | 'hidden';
  onShowResults?: () => void;
  onCaptureResults?: () => void;
  selectedRunId?: string | null;
  captureStartedAt?: string | number | Date | null;
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
  const [manageHistory, setManageHistory] = useState(false);
  const [checked, setChecked] = useState<string[]>([]);
  const [deletingIds, setDeletingIds] = useState<string[]>([]);
  const [deleteError, setDeleteError] = useState('');
  const deleting = useRef(false);
  const loadVersion = useRef(0);
  const initial = useRef(false);
  const selection = useRef<string | null>(null);
  const loadedEvents = useRef(new EventBuffer<AutomationLogEntry>());
  const lastPublished = useRef(0);
  const cursor = useRef(0);
  const fetchingRun = useRef(false);
  const selectionDrained = useRef(false);
  const busy = useRef(false);
  const generation = useRef(0);
  const inspectRef = useRef(onInspect);
  const deletedRef = useRef(onRunsDeleted);
  const fileInput = useRef<HTMLInputElement>(null);
  const draftSnapshot = useRef({ script, baseURL, timeoutSeconds, dirty });
  const inspectLatest = useRef<(run: ScriptRun) => void>(() => {});
  const viewRef = useRef(view);
  const captureStartedAtRef = useRef(captureStartedAt);
  const endpoint = `/api/automation/scripts?${new URLSearchParams({ projectId, testCaseId })}`;
  const draftKey = `traceva:playwright-draft:v1:${projectId}:${testCaseId}`;
  useEffect(() => { inspectRef.current = onInspect; }, [onInspect]);
  useEffect(() => { deletedRef.current = onRunsDeleted; }, [onRunsDeleted]);
  useEffect(() => { viewRef.current = view; captureStartedAtRef.current = captureStartedAt; }, [view, captureStartedAt]);

  const markDirty = (value: boolean) => { draftSnapshot.current.dirty = value; setDirty(value); onDirtyChange?.(value); };
  const load = useCallback(async (signal?: AbortSignal) => {
    if (deleting.current) return;
    const version = ++loadVersion.current;
    const response = await fetch(endpoint, { cache: 'no-store', signal });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Gagal memuat script.');
    if (signal?.aborted || deleting.current || version !== loadVersion.current) return;
    setOnline(data.health.online); setRuns(data.runs); setError(''); setLoading(false);
    busy.current = data.runs.some((run: ScriptRun) => ACTIVE.has(run.status));
    setChecked(previous => previous.filter(id => data.runs.some((run: ScriptRun) => run.runId === id && !ACTIVE.has(run.status))));
    if (!initial.current) {
      initial.current = true;
      let draft;
      try { draft = JSON.parse(localStorage.getItem(draftKey) || 'null'); } catch { /* Server copy remains available. */ }
      const saved = draft || data.script;
      if (saved) { setScript(saved.script); setBaseURL(saved.baseURL || ''); setTimeoutSeconds(saved.timeoutSeconds || 60); }
      if (draft) { setDirty(true); onDirtyChange?.(true); }
      const latest = latestScriptResult<ScriptRun>(data.runs, captureStartedAtRef.current);
      if (latest && viewRef.current === 'results') inspectLatest.current(latest);
    }
  }, [endpoint, draftKey, onDirtyChange]);

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let polling = false;
    let draining = false;
    const poll = async () => {
      if (polling || controller.signal.aborted) return;
      if (document.visibilityState === 'hidden') { timer = setTimeout(poll, 10_000); return; }
      polling = true;
      let more = false;
      try {
        // Backfill pages do not need to re-read the editor and all 20 run headers.
        if (!draining) await load(controller.signal);
        if (selection.current && !selectionDrained.current && !fetchingRun.current && !deleting.current) {
          const id = selection.current;
          const requestedCursor = cursor.current;
          const requestedGeneration = generation.current;
          const response = await fetch(`${endpoint}&runId=${encodeURIComponent(id)}&cursor=${requestedCursor}`, { signal: controller.signal, cache: 'no-store' });
          const data = await response.json();
          if (response.status === 404 && selection.current === id && generation.current === requestedGeneration) {
            selection.current = null; setSelected(null); ++generation.current; loadedEvents.current.reset(); cursor.current = 0;
            deletedRef.current?.([id]);
          } else if (!response.ok) throw new Error(data.error || 'Gagal memuat hasil run.');
          else if (!controller.signal.aborted && selection.current === id && generation.current === requestedGeneration && cursor.current === requestedCursor) {
            more = data.hasMore && data.nextCursor > requestedCursor;
            selectionDrained.current = !ACTIVE.has(data.run.status) && !data.hasMore;
            if (data.events.length || data.nextCursor !== requestedCursor || selectionDrained.current) {
              loadedEvents.current.append(data.events); cursor.current = data.nextCursor;
              if (!deleting.current && (!more || performance.now() - lastPublished.current >= 200)) {
                lastPublished.current = performance.now();
                inspectRef.current(data.run, loadedEvents.current.snapshot(), undefined, false);
              }
            }
          }
        }
      } catch (err) { if (!controller.signal.aborted) { setError(err instanceof Error ? err.message : 'Gagal memuat automation.'); setLoading(false); } }
      polling = false;
      draining = more;
      if (!controller.signal.aborted) timer = setTimeout(poll, more ? 0 : busy.current || (selection.current && !selectionDrained.current) ? 2000 : 15_000);
    };
    const wake = () => { clearTimeout(timer); void poll(); };
    window.addEventListener('traceva:script-wake', wake);
    document.addEventListener('visibilitychange', wake);
    void poll();
    return () => { controller.abort(); clearTimeout(timer); window.removeEventListener('traceva:script-wake', wake); document.removeEventListener('visibilitychange', wake); };
  }, [load, endpoint]);

  useEffect(() => {
    draftSnapshot.current = { script, baseURL, timeoutSeconds, dirty };
    if (!dirty) return;
    const timer = setTimeout(() => { try { localStorage.setItem(draftKey, JSON.stringify({ script, baseURL, timeoutSeconds })); } catch { /* Keep the unsaved warning. */ } }, 300);
    return () => clearTimeout(timer);
  }, [dirty, draftKey, script, baseURL, timeoutSeconds]);
  useEffect(() => {
    const flush = () => { const draft = draftSnapshot.current; if (!draft.dirty) return; try { localStorage.setItem(draftKey, JSON.stringify({ script: draft.script, baseURL: draft.baseURL, timeoutSeconds: draft.timeoutSeconds })); } catch {} };
    window.addEventListener('pagehide', flush);
    return () => { window.removeEventListener('pagehide', flush); flush(); };
  }, [draftKey]);

  const inspect = async (run: ScriptRun, artifactId?: string, showResults = true) => {
    if (showResults) onShowResults?.();
    const id = run.runId;
    const requestGeneration = ++generation.current;
    fetchingRun.current = true;
    selection.current = id; selectionDrained.current = false; setSelected(id); cursor.current = 0; loadedEvents.current.reset(); lastPublished.current = 0;
    inspectRef.current(run, [], artifactId, true);
    try {
      const response = await fetch(`${endpoint}&runId=${encodeURIComponent(id)}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal memuat hasil.');
      if (!deleting.current && selection.current === id && generation.current === requestGeneration) { selectionDrained.current = !ACTIVE.has(data.run.status) && !data.hasMore; loadedEvents.current.reset(data.events); cursor.current = data.nextCursor; inspectRef.current(data.run, data.events, artifactId, false); }
    } catch (err) { setError(err instanceof Error ? err.message : 'Gagal memuat hasil.'); }
    finally { if (generation.current === requestGeneration) { fetchingRun.current = false; if (!selectionDrained.current) window.dispatchEvent(new Event('traceva:script-wake')); } }
  };
  useEffect(() => { inspectLatest.current = run => { void inspect(run, undefined, false); }; });

  const mutate = async (action: 'save' | 'run' | 'stop', runId?: string) => {
    setPending(action); setError('');
    try {
      const response = await fetch(`${endpoint}${runId ? `&runId=${encodeURIComponent(runId)}` : ''}`, { method: action === 'save' ? 'PUT' : action === 'stop' ? 'DELETE' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ script, baseURL, timeoutSeconds }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Tindakan gagal.');
      if (action === 'save') { markDirty(false); try { localStorage.removeItem(draftKey); } catch {} }
      if (action === 'run') void inspect(data.run);
      toast({ title: action === 'save' ? 'Script tersimpan' : action === 'run' ? 'Run masuk antrean' : 'Permintaan Stop dikirim', description: action === 'run' ? 'Buka Hasil untuk video dan devlog. Status testcase tidak diubah otomatis.' : undefined });
      await load();
    } catch (err) { const message = err instanceof Error ? err.message : 'Tindakan gagal.'; setError(message); toast({ title: 'Automation belum berhasil', description: message, variant: 'destructive' }); }
    finally { setPending(''); }
  };
  const active = runs.find(run => ACTIVE.has(run.status));
  const displayedId = selectedRunId === undefined ? selected : selectedRunId;
  const displayedRun = runs.find(run => run.runId === displayedId);
  const deletable = runs.filter(run => !ACTIVE.has(run.status));
  const checkedVisible = checked.filter(id => deletable.some(run => run.runId === id));
  const requestDelete = (ids: string[]) => { setDeleteError(''); setDeletingIds(ids); };
  const removeHistory = async () => {
    if (deleting.current || !deletingIds.length) return;
    deleting.current = true; ++loadVersion.current; setPending('delete'); setDeleteError('');
    try {
      const response = await fetch(`/api/automation/scripts/history?${new URLSearchParams({ projectId, testCaseId })}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ runIds: deletingIds, confirmed: true }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Riwayat gagal dihapus. Muat ulang sebelum mencoba lagi.');
      const removed: string[] = data.deletedRunIds;
      setChecked(previous => previous.filter(id => !removed.includes(id)));
      setRuns(previous => previous.filter(run => !removed.includes(run.runId)));
      if (selection.current && removed.includes(selection.current)) {
        selection.current = null; setSelected(null); ++generation.current;
        fetchingRun.current = false; cursor.current = 0; loadedEvents.current.reset();
      }
      onRunsDeleted?.(removed);
      if (data.failedRunIds.length) { setDeletingIds(data.failedRunIds); setDeleteError(`${removed.length} run dihapus; ${data.failedRunIds.length} belum berhasil. Muat ulang riwayat sebelum mencoba lagi.`); }
      else setDeletingIds([]);
      if (removed.length) toast({ title: `${removed.length} riwayat dihapus`, description: 'Artefak run dibersihkan. Testcase, script tersimpan, dan evidence QA terpisah tetap ada.' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Penghapusan gagal.';
      setDeleteError(message); toast({ title: 'Riwayat belum berhasil dihapus', description: message, variant: 'destructive' });
    } finally {
      deleting.current = false; setPending('');
      await load().catch(() => setError('Muat ulang riwayat untuk memeriksa hasil penghapusan.'));
    }
  };

  return <section hidden={view === 'hidden'} className="mb-4 min-w-0 shrink-0 overflow-hidden rounded-xl border border-border bg-card" aria-label="Playwright script runner">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
      <div className="flex items-center gap-2"><Code2 className="size-4 text-primary" /><h3 className="text-sm font-semibold">{view === 'script' ? 'Playwright Studio' : 'Hasil pengujian'}</h3></div>
      <span className={cn('text-xs font-medium', online ? 'text-status-passed' : 'text-muted-foreground')} role="status">{loading ? 'Memeriksa runner…' : online ? 'Runner lokal terhubung' : 'Runner offline'}</span>
    </header>
    {view === 'script' && <div className="flex flex-col gap-4 p-4">
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
    {view === 'results' && error && <p role="alert" className="m-4 break-words text-sm text-destructive">{error}</p>}
    {view === 'results' && <div>
      <div className="flex flex-wrap items-end gap-2 p-4">
        <label className="min-w-0 basis-full text-xs font-medium text-muted-foreground sm:flex-1 sm:basis-0">Sumber hasil
          <select aria-label="Pilih hasil pengujian" value={displayedId || 'capture'} disabled={loading || pending === 'delete'} className="mt-1.5 h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-ring" onChange={event => {
            if (event.target.value === 'capture') { selection.current = null; setSelected(null); ++generation.current; fetchingRun.current = false; onCaptureResults?.(); }
            else { const run = runs.find(item => item.runId === event.target.value); if (run) void inspect(run); }
          }}>
            <option value="capture">Capture manual / integrasi</option>
            {runs.map(run => <option key={run.runId} value={run.runId}>{LABELS[run.status] || run.status} · {new Date(run.createdAt).toLocaleString('id-ID')}</option>)}
          </select>
        </label>
        {runs.length > 0 && <Button type="button" variant="outline" className="h-10" aria-expanded={manageHistory} aria-controls="script-run-history" onClick={() => { setManageHistory(value => !value); setChecked([]); }}>{manageHistory ? 'Selesai mengelola' : 'Kelola riwayat'}</Button>}
        <Button type="button" variant="ghost" className="size-10" disabled={Boolean(pending)} aria-label="Muat ulang riwayat eksekusi" onClick={() => void load().catch(err => setError(err.message))}><RefreshCw className="size-4" /></Button>
      </div>
      {displayedRun && <div className="space-y-2 px-4 pb-4">
        <p className="text-xs text-muted-foreground">{displayedRun.actor} · {displayedRun.durationMs !== undefined ? `${(displayedRun.durationMs / 1000).toFixed(1)} detik · ` : ''}Hasil script tidak mengubah status testcase.</p>
        {displayedRun.error && <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted p-3 text-xs text-destructive">{displayedRun.error}</pre>}
        {displayedRun.artifacts.length > 0 && <div className="flex flex-wrap gap-2">{displayedRun.artifacts.map(artifact => artifact.kind === 'video' ? <Button key={artifact.id} variant="outline" size="sm" onClick={() => void inspect(displayedRun, artifact.id)}><Play className="size-3" />Video {displayedRun.artifacts.filter(item => item.kind === 'video').indexOf(artifact) + 1}</Button> : <a key={artifact.id} className="inline-flex min-h-9 items-center gap-1 rounded-md px-2 text-xs text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring" href={scriptArtifactUrl(projectId, testCaseId, displayedRun.runId, artifact.id)} download={artifact.name}><Download className="size-3" />{artifact.kind === 'trace' ? 'Trace' : 'Screenshot'}</a>)}</div>}
      </div>}
      {active && <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3"><p role="status" className="text-sm">{LABELS[active.status]} · {new Date(active.createdAt).toLocaleTimeString('id-ID')}</p><Button type="button" variant="outline" size="sm" disabled={Boolean(pending)} onClick={() => void mutate('stop', active.runId)}><Square className="size-3" />Stop script</Button></div>}
      {manageHistory && <div id="script-run-history" className="border-t border-border">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"><h4 className="text-sm font-semibold">Riwayat script <span className="font-normal text-muted-foreground">· 20 run terbaru</span></h4></div>
      {runs.length > 0 && <div className="flex flex-wrap items-center justify-between gap-3 px-4 pb-3">
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm"><Checkbox aria-label="Pilih semua run selesai yang ditampilkan" disabled={Boolean(pending) || !deletable.length} checked={checkedVisible.length === deletable.length && deletable.length > 0 ? true : checkedVisible.length > 0 ? 'indeterminate' : false} onCheckedChange={value => setChecked(value === true ? deletable.map(run => run.runId) : [])} />Pilih run selesai <span className="text-muted-foreground" aria-live="polite">({checkedVisible.length} dipilih)</span></label>
        <Button type="button" variant="outline" size="sm" className="min-h-11 sm:min-h-9" disabled={!checkedVisible.length || Boolean(pending)} onClick={() => requestDelete(checkedVisible)}><Trash2 data-icon="inline-start" />Hapus terpilih</Button>
      </div>}
      {runs.length === 0 ? <p className="px-4 pb-4 text-sm text-muted-foreground">Belum ada run script.</p> : <ol className="max-h-80 divide-y divide-border overflow-y-auto overscroll-contain">
        {runs.map(run => <li key={run.runId} className={cn('px-4 py-3', displayedId === run.runId && 'bg-muted/60')}>
          <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex min-w-0 flex-1 items-center gap-3"><label className="flex min-h-11 min-w-6 items-center"><Checkbox aria-label={`Pilih run ${new Date(run.createdAt).toLocaleString('id-ID')} · ${run.runId}`} disabled={ACTIVE.has(run.status) || Boolean(pending)} checked={checkedVisible.includes(run.runId)} onCheckedChange={value => setChecked(previous => value === true ? [...previous, run.runId] : previous.filter(id => id !== run.runId))} /></label><button type="button" disabled={pending === 'delete'} className="min-w-0 rounded text-left focus-visible:outline-2 focus-visible:outline-ring" onClick={() => void inspect(run)} aria-pressed={selected === run.runId}><span className={cn('text-sm font-semibold', run.status === 'PASSED' ? 'text-status-passed' : run.status === 'FAILED' ? 'text-status-failed' : 'text-foreground')}>{LABELS[run.status] || 'Status tidak diketahui'}</span><span className="ml-2 text-xs text-muted-foreground">{new Date(run.createdAt).toLocaleString('id-ID')} {run.durationMs !== undefined ? `· ${(run.durationMs / 1000).toFixed(1)} dtk` : ''}</span><span className="mt-1 block break-words text-xs text-muted-foreground">{run.actor} · Buka hasil di viewer bawah</span></button></div>
            {ACTIVE.has(run.status) && <Button type="button" variant="outline" size="sm" disabled={Boolean(pending)} onClick={() => void mutate('stop', run.runId)}><Square className="size-3" />Stop</Button>}
            {!ACTIVE.has(run.status) && <Button type="button" variant="ghost" size="sm" className="min-h-11 sm:min-h-9" disabled={Boolean(pending)} aria-label={`Hapus run ${run.runId}`} onClick={() => requestDelete([run.runId])}><Trash2 data-icon="inline-start" />Hapus</Button>}
          </div>
          {run.artifacts.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{run.artifacts.map(artifact => artifact.kind === 'video' ? <Button key={artifact.id} variant="outline" size="sm" onClick={() => void inspect(run, artifact.id)}><Play className="size-3" />Video {run.artifacts.filter(item => item.kind === 'video').indexOf(artifact) + 1}</Button> : <a key={artifact.id} className="inline-flex min-h-9 items-center gap-1 rounded-md px-2 text-xs text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring" href={scriptArtifactUrl(projectId, testCaseId, run.runId, artifact.id)} download={artifact.name}><Download className="size-3" />{artifact.kind === 'trace' ? 'Trace' : 'Screenshot'}</a>)}</div>}
          {selected === run.runId && run.error && <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-muted p-3 text-xs text-destructive">{run.error}</pre>}
        </li>)}
      </ol>}
      </div>}
      {!loading && runs.length === 0 && <p className="px-4 pb-4 text-xs text-muted-foreground">Belum ada hasil script. Gunakan Script untuk menjalankan skenario, atau Capture Manual untuk merekam pengujian.</p>}
    </div>}
    <AlertDialog open={deletingIds.length > 0} onOpenChange={open => { if (!open && !deleting.current) setDeletingIds([]); }}>
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Hapus {deletingIds.length} riwayat eksekusi?</AlertDialogTitle><AlertDialogDescription>Video, screenshot, trace, salinan script saat run, dan devlog run terpilih akan dihapus permanen. Testcase, script tersimpan di editor, dan evidence QA terpisah tidak dihapus. Tindakan ini tidak dapat dibatalkan.</AlertDialogDescription></AlertDialogHeader>
        <ul className="max-h-36 overflow-y-auto text-sm text-muted-foreground">{deletingIds.map(id => { const run = runs.find(item => item.runId === id); return <li key={id} className="break-words py-1">{run ? `${new Date(run.createdAt).toLocaleString('id-ID')} · ${LABELS[run.status] || run.status}` : 'Run tidak lagi ditampilkan'}<span className="block font-mono text-xs">{id}</span></li>; })}</ul>
        {deleteError && <p role="alert" className="text-sm text-destructive">{deleteError}</p>}
        <AlertDialogFooter><AlertDialogCancel disabled={pending === 'delete'}>Batal</AlertDialogCancel><Button type="button" variant="destructive" disabled={Boolean(pending)} onClick={() => void removeHistory()}>{pending === 'delete' ? 'Menghapus…' : 'Hapus permanen'}</Button></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </section>;
}
