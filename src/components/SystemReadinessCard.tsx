'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, CircleDashed, Database, HardDrive, Loader2, RefreshCw, ServerCog, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type CheckStatus = 'ready' | 'warning' | 'blocked' | 'skipped';

interface ReadinessResponse {
  status: 'ready' | 'warning' | 'blocked';
  score: number;
  checkedAt: string;
  host: string;
  summary: Record<CheckStatus, number>;
  checks: Array<{ id: string; label: string; status: CheckStatus; detail: string; durationMs: number }>;
}

const statusMeta: Record<CheckStatus, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  ready: { label: 'Ready', className: 'border-emerald-500/25 bg-emerald-500/8 text-emerald-600 dark:text-emerald-400', icon: CheckCircle2 },
  warning: { label: 'Warning', className: 'border-amber-500/25 bg-amber-500/8 text-amber-600 dark:text-amber-400', icon: AlertTriangle },
  blocked: { label: 'Blocked', className: 'border-red-500/25 bg-red-500/8 text-red-600 dark:text-red-400', icon: ShieldAlert },
  skipped: { label: 'N/A', className: 'border-border bg-secondary/50 text-muted-foreground', icon: CircleDashed },
};

const categoryIcon: Record<string, typeof Database> = {
  database: Database,
  migrations: Database,
  relay: ServerCog,
  disk: HardDrive,
  'evidence-storage': HardDrive,
  'recording-storage': HardDrive,
};

export function SystemReadinessCard() {
  const [data, setData] = useState<ReadinessResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/readiness', { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Pemeriksaan readiness gagal.');
      setData(payload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Pemeriksaan readiness gagal.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  return (
    <Card variant="majestic" className="overflow-hidden">
      <CardHeader className="border-b border-border/60 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg"><ServerCog className="size-5 text-primary" />System readiness</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">Validasi dependency host sebelum menjalankan automation, evidence, dan deployment.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />} Periksa ulang
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 pt-5">
        {error && <div role="alert" className="rounded-xl border border-red-500/25 bg-red-500/8 p-4 text-sm text-red-600 dark:text-red-400">{error}</div>}
        {loading && !data ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => <div key={index} className="h-28 animate-pulse rounded-xl bg-secondary/60" />)}
          </div>
        ) : data ? (
          <>
            <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-border/60 bg-secondary/25 p-4">
              <div className="grid size-16 place-items-center rounded-2xl bg-primary/10 text-xl font-bold tabular-nums text-primary">{data.score}%</div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{data.status === 'ready' ? 'Host siap digunakan' : data.status === 'warning' ? 'Host siap dengan catatan' : 'Ada dependency yang memblokir'}</p>
                <p className="mt-1 text-xs text-muted-foreground">{data.host} · diperiksa {new Date(data.checkedAt).toLocaleString('id-ID')}</p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline" className={statusMeta.ready.className}>{data.summary.ready} ready</Badge>
                <Badge variant="outline" className={statusMeta.warning.className}>{data.summary.warning} warning</Badge>
                <Badge variant="outline" className={statusMeta.blocked.className}>{data.summary.blocked} blocked</Badge>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {data.checks.map(check => {
                const meta = statusMeta[check.status];
                const StatusIcon = meta.icon;
                const CategoryIcon = categoryIcon[check.id] || CheckCircle2;
                return (
                  <div key={check.id} className="rounded-xl border border-border/60 bg-card p-4 transition-colors hover:border-primary/25">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2.5"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-secondary text-muted-foreground"><CategoryIcon className="size-4" /></span><p className="truncate text-sm font-semibold">{check.label}</p></div>
                      <Badge variant="outline" className={meta.className}><StatusIcon className="size-3" />{meta.label}</Badge>
                    </div>
                    <p className="mt-3 min-h-10 text-xs leading-relaxed text-muted-foreground">{check.detail}</p>
                    <p className="mt-2 text-[10px] tabular-nums text-muted-foreground/70">{check.durationMs} ms</p>
                  </div>
                );
              })}
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
