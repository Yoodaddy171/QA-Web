'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Bug, CirclePlay, Focus, GitBranch, Layers, ListChecks, Minus, Plus, RefreshCw, RotateCcw, Route, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { directGraphNeighbors, graphViewport, isTraceGraphData, GRAPH_NODE_HEIGHT, GRAPH_NODE_WIDTH, GRAPH_TYPES, layoutTraceGraph, type GraphFocus, type GraphSeedType, type TraceGraphData, type TraceGraphNode } from '@/lib/traceability-graph';

const TYPE_META = {
  Requirement: { label: 'Requirement', icon: Route, tone: 'text-primary' },
  TestCase: { label: 'Testcase', icon: ListChecks, tone: 'text-primary' },
  TestPlan: { label: 'Test Plan', icon: GitBranch, tone: 'text-primary' },
  TestRun: { label: 'Test Cycle', icon: CirclePlay, tone: 'text-status-in-progress' },
  Execution: { label: 'Execution', icon: CirclePlay, tone: 'text-status-passed' },
  BugFix: { label: 'Bug', icon: Bug, tone: 'text-status-failed' },
  Module: { label: 'Module', icon: Layers, tone: 'text-muted-foreground' },
} as const;
const SEED_TYPES: GraphSeedType[] = ['TestCase', 'Requirement', 'TestRun', 'BugFix'];
type Option = { id: string; label: string; status: string };

export function TraceabilityGraphView({ projectId, onOpenNode, initialFocus, onFocusChange }: { projectId: string; onOpenNode: (node: TraceGraphNode) => void; initialFocus?: GraphFocus; onFocusChange: (focus: GraphFocus) => void }) {
  const uid = useId();
  const marker = `graph-arrow-${uid.replace(/:/g, '')}`;
  const [seedType, setSeedType] = useState<GraphSeedType>(initialFocus?.type || 'TestCase');
  const [seed, setSeed] = useState<GraphFocus | null>(initialFocus || null);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(!initialFocus);
  const [options, setOptions] = useState<Option[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [data, setData] = useState<TraceGraphData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [selectedId, setSelectedId] = useState('');
  const [entityFilter, setEntityFilter] = useState('all');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [onlyConnected, setOnlyConnected] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState('');
  const [view, setView] = useState({ x: 24, y: 24, zoom: 0.8 });
  const viewport = useRef<HTMLDivElement>(null);
  const drag = useRef<{ pointerId: number; x: number; y: number; startX: number; startY: number } | null>(null);
  const [size, setSize] = useState({ width: 800, height: 560 });

  useEffect(() => {
    if (!searchOpen || !projectId) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setSearchLoading(true); setSearchError('');
      const params = new URLSearchParams({ projectId, seedType, q: query });
      void fetch(`/api/traceability/graph?${params}`, { signal: controller.signal }).then(async r => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error || 'Pencarian gagal.');
        if (!Array.isArray(body.options) || body.options.length > 20 || !body.options.every((o: Option) => o && typeof o.id === 'string' && typeof o.label === 'string' && typeof o.status === 'string')) throw new Error('Hasil pencarian tidak valid.');
        if (!controller.signal.aborted) { setOptions(body.options); setHasMore(Boolean(body.hasMore)); }
      }).catch(e => { if (!controller.signal.aborted) { setOptions([]); setSearchError(e instanceof Error ? e.message : 'Pencarian gagal.'); } })
        .finally(() => { if (!controller.signal.aborted) setSearchLoading(false); });
    }, 250);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [projectId, seedType, query, searchOpen, reload]);

  useEffect(() => {
    if (!seed || !projectId) return;
    const controller = new AbortController();
    queueMicrotask(() => { if (!controller.signal.aborted) { setLoading(true); setError(''); setData(null); } });
    const params = new URLSearchParams({ projectId, seedType: seed.type, seedId: seed.id });
    void fetch(`/api/traceability/graph?${params}`, { signal: controller.signal }).then(async r => {
      const body = await r.json();
      if (!r.ok) throw new Error(body.error || 'Graph gagal dimuat.');
      if (!isTraceGraphData(body)) throw new Error('Data graph tidak valid. Pilih object lain atau muat ulang.');
      if (!controller.signal.aborted) { setData(body); setSelectedId(body.rootId); }
    }).catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Graph gagal dimuat.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [projectId, seed, reload]);

  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const selected = data?.nodes.find(n => n.id === selectedId);
  const neighbors = useMemo(() => directGraphNeighbors(selectedId, data?.edges || []), [selectedId, data]);
  const neighborFilter = onlyConnected ? neighbors : null;
  const modules = useMemo(() => data?.nodes.filter(n => n.type === 'Module') || [], [data]);
  const statuses = useMemo(() => [...new Set(data?.nodes.map(n => n.status).filter(Boolean))].sort(), [data]);
  const visibleNodes = useMemo(() => (data?.nodes || []).filter(n =>
    (entityFilter === 'all' || n.type === entityFilter)
    && (statusFilter === 'all' || n.status === statusFilter)
    && (moduleFilter === 'all' || (n.type !== 'TestCase' && n.type !== 'BugFix' && n.type !== 'Module') || n.moduleId === moduleFilter || (n.type === 'Module' && n.entityId === moduleFilter))
    && (!neighborFilter || neighborFilter.has(n.id))), [data, entityFilter, statusFilter, moduleFilter, neighborFilter]);
  const positioned = useMemo(() => layoutTraceGraph(visibleNodes), [visibleNodes]);
  const positions = useMemo(() => new Map(positioned.map(n => [n.id, n])), [positioned]);
  const visibleEdges = useMemo(() => (data?.edges || []).filter(e => positions.has(e.source) && positions.has(e.target)), [data, positions]);
  const fit = useCallback(() => {
    if (!positioned.length) return;
    if (viewport.current) { viewport.current.scrollLeft = 0; viewport.current.scrollTop = 0; }
    setView(graphViewport(positioned, size, '', true));
  }, [positioned, size]);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (viewport.current) { viewport.current.scrollLeft = 0; viewport.current.scrollTop = 0; }
      setView(graphViewport(positioned, size, data?.rootId || ''));
    });
    return () => cancelAnimationFrame(frame);
  }, [positioned, size, data?.rootId]);
  const zoomBy = (factor: number) => setView(v => {
    const zoom = Math.max(0.08, Math.min(2, v.zoom * factor));
    return { zoom, x: size.width / 2 - (size.width / 2 - v.x) * zoom / v.zoom, y: size.height / 2 - (size.height / 2 - v.y) * zoom / v.zoom };
  });
  const chooseSeed = (next: GraphFocus) => {
    onFocusChange(next); setLoading(true); setSeed(next); setSeedType(next.type); setSelectedId(''); setData(null); setError(''); setSearchOpen(false);
    setEntityFilter('all'); setModuleFilter('all'); setStatusFilter('all'); setOnlyConnected(false);
  };
  const focusSelected = () => {
    const node = positions.get(selectedId);
    if (viewport.current) { viewport.current.scrollLeft = 0; viewport.current.scrollTop = 0; }
    if (node) setView({ zoom: 1, x: size.width / 2 - node.x - GRAPH_NODE_WIDTH / 2, y: Math.min(160, size.height * 0.35) - node.y - GRAPH_NODE_HEIGHT / 2 });
  };
  const canNavigate = selected && (['TestCase', 'Requirement', 'TestRun', 'BugFix'].includes(selected.type) || (selected.type === 'Execution' && selected.details?.['Cycle ID']));
  const links = data?.edges.filter(e => e.source === selectedId || e.target === selectedId) || [];
  const nodeMap = useMemo(() => new Map((data?.nodes || []).map(n => [n.id, n])), [data]);
  const focused = data?.nodes.find(n => n.id === data.rootId);
  const filterCount = [entityFilter, moduleFilter, statusFilter].filter(value => value !== 'all').length + Number(onlyConnected);
  const clearFilters = () => { setEntityFilter('all'); setModuleFilter('all'); setStatusFilter('all'); setOnlyConnected(false); };

  return <section className="flex min-w-0 flex-col gap-4" aria-label="Graph View Traceability">
    <div className="qa-module-toolbar qa-module-form flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      {!seed && <div><h3 className="text-sm font-semibold">Pilih Testcase atau Requirement untuk melihat hubungannya.</h3><p className="mt-1 text-sm text-muted-foreground">Cari object di bawah, lalu pilih hasilnya. Lihat requirement, cycle, execution dan Bug yang terhubung.</p></div>}
      {seed && <div className="flex flex-wrap items-center justify-between gap-3"><div className="min-w-0"><p className="text-xs text-muted-foreground">Area hubungan yang dimuat</p><p className="mt-1 break-words text-sm font-semibold">{focused ? `${TYPE_META[focused.type].label} · ${focused.label}` : error ? 'Object tidak dapat dimuat' : 'Memuat object terpilih...'}</p></div><Button variant="outline" size="sm" disabled={searchOpen} onClick={() => { setOptions([]); setSearchLoading(true); setSearchOpen(true); }}><Search data-icon="inline-start" />Ganti object</Button></div>}
      {searchOpen && <div className="grid gap-3 sm:grid-cols-[160px_minmax(0,1fr)_auto] sm:items-end">
        <div className="flex flex-col gap-2"><Label htmlFor={`${uid}-seed`}>Mulai dari</Label><Select value={seedType} onValueChange={v => { setSeedType(v as GraphSeedType); setQuery(''); setOptions([]); setHasMore(false); setSearchLoading(true); setSearchOpen(true); }}><SelectTrigger id={`${uid}-seed`}><SelectValue /></SelectTrigger><SelectContent>{SEED_TYPES.map(t => <SelectItem key={t} value={t}>{TYPE_META[t].label}</SelectItem>)}</SelectContent></Select></div>
        <div className="flex flex-col gap-2"><Label htmlFor={`${uid}-search`}>Cari nama atau ID</Label><div className="relative"><Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" /><Input id={`${uid}-search`} value={query} maxLength={120} onFocus={() => setSearchOpen(true)} onChange={e => { setQuery(e.target.value); setOptions([]); setHasMore(false); setSearchLoading(true); setSearchOpen(true); }} placeholder="Contoh: AUTH-001 atau judul requirement" className="pl-9" /></div></div>
        <Button variant="outline" onClick={() => setReload(v => v + 1)} disabled={loading || searchLoading}><RefreshCw data-icon="inline-start" />Muat ulang</Button>
      </div>}
      {searchOpen && <div className="max-h-48 overflow-y-auto rounded-lg border border-border" aria-label="Hasil pencarian fokus graph" aria-busy={searchLoading}>
        {searchLoading ? <p className="p-3 text-sm text-muted-foreground" role="status">Mencari object...</p> : searchError ? <p className="p-3 text-sm text-destructive" role="alert">{searchError}</p> : options.length ? options.map(o => <button key={o.id} type="button" className="flex w-full flex-wrap items-center justify-between gap-2 border-b border-border p-3 text-left text-sm last:border-0 hover:bg-secondary/50 focus-visible:outline-2 focus-visible:outline-ring" onClick={() => chooseSeed({ type: seedType, id: o.id })}><span className="min-w-0 flex-1 break-words">{o.label}</span><Badge variant="outline">{o.status}</Badge></button>) : <p className="p-3 text-sm text-muted-foreground">Tidak ada object yang cocok pada project ini.</p>}
        {hasMore && <p className="border-t border-border p-3 text-xs text-muted-foreground">20 hasil pertama. Ketik ID atau nama yang lebih spesifik.</p>}
        {seed && <Button className="m-2" size="sm" variant="ghost" onClick={() => setSearchOpen(false)}>Tutup pencarian</Button>}
      </div>}
      {seed && <details className="rounded-lg border border-border p-3"><summary className="cursor-pointer text-sm font-medium">Filter tampilan ({filterCount} aktif)</summary><div className="mt-3 grid gap-2 sm:grid-cols-3">
        <Select value={entityFilter} onValueChange={setEntityFilter}><SelectTrigger aria-label="Filter tipe entity graph"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Semua entity</SelectItem>{GRAPH_TYPES.map(t => <SelectItem key={t} value={t}>{TYPE_META[t].label}</SelectItem>)}</SelectContent></Select>
        <Select value={moduleFilter} onValueChange={setModuleFilter}><SelectTrigger aria-label="Filter module testcase graph"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Semua module testcase</SelectItem>{modules.map(m => <SelectItem key={m.id} value={m.entityId}>{m.label}</SelectItem>)}</SelectContent></Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger aria-label="Filter status graph"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Semua status</SelectItem>{statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
      </div>
      <div className="flex flex-wrap items-center gap-2"><Button variant={onlyConnected ? 'secondary' : 'outline'} size="sm" aria-pressed={onlyConnected} disabled={!selected} onClick={() => setOnlyConnected(v => !v)}>Hubungan langsung</Button><Button variant="ghost" size="sm" onClick={clearFilters}>Semua yang dimuat</Button><span className="ml-auto text-xs text-muted-foreground">{visibleNodes.length} nodes · {visibleEdges.length} relasi</span></div>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">Filter hanya menyembunyikan node, bukan mengubah relasi. Ganti object memuat area baru. Filter module mempertahankan konteks requirement, plan dan cycle.</p></details>}
      {seed && <p className="text-xs text-muted-foreground" role="status">{visibleNodes.length} dari {data?.nodes.length || 0} object dimuat terlihat · {visibleEdges.length} relasi · {filterCount} filter aktif</p>}
    </div>

    {data?.truncated && <p role="status" className="rounded-lg border border-status-blocked/30 bg-status-blocked/5 p-3 text-sm">Sebagian hubungan tidak ditampilkan karena batas pemuatan. Pilih “Ganti object” atau “Lihat hubungan object ini” untuk menjelajahi area lain. Bukan seluruh data project (maksimal 12 testcase, 24 execution, 16 Bug, 120 node).</p>}
    <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
        <div className="qa-module-toolbar flex flex-wrap items-center gap-2 border-b border-border p-3">
          <Button variant="outline" size="icon" aria-label="Zoom out graph" disabled={!data} onClick={() => zoomBy(1 / 1.2)}><Minus /></Button><span data-testid="graph-zoom" className="w-12 text-center text-xs tabular-nums">{Math.round(view.zoom * 100)}%</span><Button variant="outline" size="icon" aria-label="Zoom in graph" disabled={!data} onClick={() => zoomBy(1.2)}><Plus /></Button>
          <Button variant="outline" size="sm" onClick={fit} disabled={!visibleNodes.length}><Focus data-icon="inline-start" />Paskan semua</Button><Button variant="ghost" size="sm" title="Kembalikan posisi dan zoom ke node pilihan; pilihan dan filter tetap" disabled={!selected || !positions.has(selected.id)} onClick={focusSelected}><RotateCcw data-icon="inline-start" />Reset tampilan</Button>
          <span className="text-xs text-muted-foreground">Drag ruang kosong untuk pan · Tab pilih node · panah untuk pan saat canvas terfokus</span>
        </div>
        {data && view.zoom < 0.7 && <p className="border-b border-border px-3 py-2 text-xs text-muted-foreground">Mode ringkasan: label diperkecil. Gunakan Zoom + atau Reset tampilan untuk membaca pilihan.</p>}
        <div ref={viewport} role="region" aria-label="Canvas graph relasi, gunakan Tab untuk memilih node" tabIndex={0} className="relative h-[480px] overflow-hidden bg-background focus-visible:outline-2 focus-visible:outline-ring sm:h-[560px]" style={{ touchAction: 'pan-y' }}
          onKeyDown={e => { if (e.target !== e.currentTarget) return; const delta: Record<string, [number, number]> = { ArrowLeft: [40, 0], ArrowRight: [-40, 0], ArrowUp: [0, 40], ArrowDown: [0, -40] }; if (delta[e.key]) { e.preventDefault(); const [x,y] = delta[e.key]; setView(v => ({ ...v, x: v.x + x, y: v.y + y })); } else if (e.key === 'Home') { e.preventDefault(); fit(); } }}
          onPointerDown={e => { if (e.button !== 0 || (e.target as HTMLElement).closest('button')) return; drag.current = { pointerId: e.pointerId, x: e.clientX, y: e.clientY, startX: view.x, startY: view.y }; e.currentTarget.setPointerCapture(e.pointerId); }}
          onPointerMove={e => { const d = drag.current; if (d && d.pointerId === e.pointerId) setView(v => ({ ...v, x: d.startX + e.clientX - d.x, y: d.startY + e.clientY - d.y })); }}
          onPointerUp={e => { if (drag.current?.pointerId === e.pointerId) { drag.current = null; if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); } }} onPointerCancel={() => { drag.current = null; }}>
          {loading ? <div className="grid h-full place-content-center gap-4 p-8" role="status" aria-label="Memuat dan menyiapkan graph"><Skeleton className="h-24 w-56" /><Skeleton className="h-24 w-56" /><p className="text-sm text-muted-foreground">Memuat relasi dan menyiapkan layout...</p></div> : error ? <div role="alert" className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center"><p className="text-sm text-destructive">{error}</p><Button variant="outline" onClick={() => setReload(v => v + 1)}>Coba lagi</Button></div> : !seed ? <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center"><GitBranch className="size-8 text-primary" /><h3 className="text-sm font-semibold">Pilih testcase atau requirement untuk melihat hubungan</h3><p className="max-w-md text-sm leading-6 text-muted-foreground">Cari object di atas. Graph hanya membaca hubungan yang tersimpan dan tidak mengubah data.</p></div> : !positioned.length ? <div className="grid h-full place-content-center p-6 text-center text-sm text-muted-foreground">Tidak ada object yang cocok dengan filter. Gunakan “Semua yang dimuat” untuk memulihkan tampilan.</div> : <div className="absolute left-0 top-0" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`, transformOrigin: '0 0' }}>
            <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width="1" height="1" aria-hidden="true"><defs><marker id={marker} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7" fill="var(--muted-foreground)" /></marker></defs>{visibleEdges.map(e => {
              const source = positions.get(e.source)!, target = positions.get(e.target)!;
              const forward = target.x >= source.x, sx = source.x + (forward ? GRAPH_NODE_WIDTH : 0), tx = target.x + (forward ? 0 : GRAPH_NODE_WIDTH), sy = source.y + GRAPH_NODE_HEIGHT / 2, ty = target.y + GRAPH_NODE_HEIGHT / 2;
              const curve = Math.max(60, Math.abs(tx - sx) / 2) * (forward ? 1 : -1);
              const active = e.source === selectedId || e.target === selectedId;
              return <path key={e.id} data-graph-edge={e.id} data-source={e.source} data-target={e.target} data-relation={e.label} d={`M${sx},${sy} C${sx + curve},${sy} ${tx - curve},${ty} ${tx},${ty}`} fill="none" stroke={active ? 'var(--primary)' : 'var(--muted-foreground)'} opacity={active ? 1 : selectedId ? 0.2 : 0.4} strokeWidth={active ? 2 : 1.2} markerEnd={`url(#${marker})`} />;
            })}</svg>
            {positioned.map(n => { const meta = TYPE_META[n.type], Icon = meta.icon, active = n.id === selectedId; return <button key={n.id} data-graph-node={n.id} type="button" aria-pressed={active} aria-label={`${meta.label}: ${n.label}${n.id === data?.rootId ? ', fokus graph' : ''}`} title={`${meta.label}: ${n.label} — ${n.title} — ${n.status}`} className={cn('absolute flex flex-col gap-2 overflow-hidden rounded-xl border bg-card p-3 text-left text-foreground transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-ring', active ? 'border-primary ring-2 ring-primary/30' : 'border-border')} style={{ left: n.x, top: n.y, width: GRAPH_NODE_WIDTH, height: GRAPH_NODE_HEIGHT, opacity: !selectedId || neighbors.has(n.id) ? 1 : 0.75 }} onFocus={event => { if (!event.currentTarget.matches(':focus-visible')) return; if (viewport.current) { viewport.current.scrollLeft = 0; viewport.current.scrollTop = 0; } setView(v => ({ ...v, x: size.width / 2 - (n.x + GRAPH_NODE_WIDTH / 2) * v.zoom, y: size.height / 2 - (n.y + GRAPH_NODE_HEIGHT / 2) * v.zoom })); }} onClick={() => setSelectedId(n.id)}>
              <span className="flex items-center gap-2"><Icon className={cn('size-4 shrink-0', meta.tone)} /><span className="truncate text-xs font-semibold">{n.label}</span><span className="ml-auto text-xs text-muted-foreground">{meta.label}</span></span><span className="line-clamp-2 text-xs leading-4 text-muted-foreground">{n.title}</span><span className="mt-auto flex items-center gap-2 text-xs"><span className={cn('truncate', meta.tone)}>{n.status || meta.label}</span>{n.id === data?.rootId && <span className="ml-auto text-primary">Fokus</span>}</span>
            </button>; })}
          </div>}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-border p-3" aria-label="Legenda entity graph">{GRAPH_TYPES.map(t => { const meta = TYPE_META[t], Icon = meta.icon; return <span key={t} className="flex items-center gap-1.5 text-xs"><Icon className={cn('size-3.5', meta.tone)} />{meta.label}</span>; })}<span className="text-xs text-muted-foreground">Panah mengikuti arti relasi; bukan urutan proses.</span></div>
      </div>

      <aside className="min-w-0 rounded-xl border border-border bg-card p-4" aria-label="Detail node terpilih" aria-live="polite">
        {selected && !loading && !error ? <><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">{TYPE_META[selected.type].label}</h3><Badge variant="outline">{selected.status || 'Context'}</Badge></div><p className="mt-3 break-words text-sm font-semibold">{selected.label}</p><p className="mt-2 break-words text-sm leading-6 text-muted-foreground">{selected.title}</p>{selected.moduleName && <p className="mt-2 text-xs text-muted-foreground">Module: {selected.moduleName}</p>}
          {selected.details && <dl className="mt-4 flex flex-col gap-2 text-xs">{Object.entries(selected.details).filter(([key]) => key !== 'Cycle ID').map(([key,value]) => <div key={key} className="flex flex-col gap-1 border-t border-border pt-2"><dt className="text-muted-foreground">{key}</dt><dd className="break-words">{value}</dd></div>)}</dl>}
          <div className="mt-4 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={focusSelected} disabled={!positions.has(selected.id)}><Focus data-icon="inline-start" />Pusatkan</Button>{canNavigate && <Button size="sm" variant="outline" onClick={() => onOpenNode(selected)}>{selected.type === 'BugFix' ? 'Buka menu Bugs' : selected.type === 'Execution' ? 'Buka cycle' : selected.type === 'TestCase' ? 'Buka testcase' : selected.type === 'Requirement' ? 'Lihat requirement' : 'Buka cycle'}<ArrowUpRight data-icon="inline-end" /></Button>}{SEED_TYPES.includes(selected.type as GraphSeedType) && <Button size="sm" onClick={() => chooseSeed({ type: selected.type as GraphSeedType, id: selected.entityId })}>Lihat hubungan object ini</Button>}</div>
          <details className="mt-4 text-xs"><summary className="cursor-pointer text-muted-foreground">ID teknis</summary><p className="mt-2 break-all font-mono">UUID: {selected.entityId}</p><p className="mt-2 break-all">Project: {projectId}</p><Button size="sm" variant="ghost" onClick={async () => { try { await navigator.clipboard.writeText(selected.entityId); setCopyFeedback('ID disalin.'); } catch { setCopyFeedback('Gagal menyalin. Pilih ID di atas secara manual.'); } }}>Salin ID</Button><p role="status">{copyFeedback}</p></details>
          {selected.type === 'BugFix' && <p className="mt-3 text-xs leading-5 text-muted-foreground">Buka menu Bugs, lalu cari {selected.label}. Navigasi ini tidak langsung memilih satu Bug.</p>}
          {!positions.has(selected.id) && <p className="mt-3 text-xs text-muted-foreground">Node terpilih disembunyikan filter aktif.</p>}
          <h4 className="mt-6 text-sm font-semibold">Relasi dalam area ini ({links.length})</h4><div className="mt-3 flex max-h-80 flex-col gap-2 overflow-y-auto">{links.length ? links.map(l => { const other = nodeMap.get(l.source === selected.id ? l.target : l.source); return other ? <button key={l.id} type="button" className="rounded-lg border border-border p-3 text-left text-xs hover:bg-secondary/50 focus-visible:outline-2 focus-visible:outline-ring" onClick={() => { setSelectedId(other.id); const n = positions.get(other.id); if (n) { if (viewport.current) { viewport.current.scrollLeft = 0; viewport.current.scrollTop = 0; } setView({ zoom: 1, x: size.width / 2 - n.x - GRAPH_NODE_WIDTH / 2, y: size.height / 2 - n.y - GRAPH_NODE_HEIGHT / 2 }); } }}><span className="block text-muted-foreground">{l.source === selected.id ? '→' : '←'} {l.label}</span><span className="mt-1 block break-words font-semibold">{TYPE_META[other.type].label}: {other.label}</span></button> : null; }) : <p className="text-xs text-muted-foreground">Belum ada hubungan pada area yang dimuat. Ini bukan jaminan bahwa seluruh riwayat sudah dimuat.</p>}</div>
        </> : <p className="text-sm leading-6 text-muted-foreground">Pilih node untuk melihat ID, status, konteks dan relasi langsungnya.</p>}
      </aside>
    </div>
  </section>;
}
