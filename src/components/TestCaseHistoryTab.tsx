'use client';

import { useEffect, useState } from 'react';
import { History } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TabsContent } from '@/components/ui/tabs';

type Activity = { id: string; action: string; field?: string | null; actor?: string | null; createdAt: string; beforeValue?: unknown; afterValue?: unknown };

function compactValue(value: unknown) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'string') return value;
  try { return JSON.stringify(value); } catch { return String(value); }
}

export function TestCaseHistoryTab({ projectId, testCaseId }: { projectId: string; testCaseId: string }) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`/api/activity?projectId=${encodeURIComponent(projectId)}&entityType=TestCase&entityId=${encodeURIComponent(testCaseId)}`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Gagal memuat history.');
        setActivities(data.activities || []);
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Gagal memuat history.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [projectId, testCaseId]);

  return <TabsContent value="history" className="mt-0 space-y-4 outline-none"><Card><CardHeader><CardTitle className="flex items-center gap-2 text-sm"><History className="h-4 w-4 text-primary" />Immutable audit history ({activities.length})</CardTitle></CardHeader><CardContent className="space-y-3">{loading && <p className="text-sm text-muted-foreground">Memuat history...</p>}{error && <p role="alert" className="text-sm text-destructive">{error}</p>}{!loading && !error && !activities.length && <p className="text-sm text-muted-foreground">Belum ada history.</p>}{!loading && !error && activities.map(activity => <div key={activity.id} className="rounded-lg border border-border/60 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold">{activity.action}{activity.field ? ` · ${activity.field}` : ''}</p><span className="text-[11px] text-muted-foreground">{new Date(activity.createdAt).toLocaleString('id-ID')}</span></div><p className="mt-1 text-xs text-muted-foreground">Actor: {activity.actor || 'local-user'}</p>{(activity.field || activity.beforeValue !== undefined || activity.afterValue !== undefined) && <div className="mt-2 grid gap-2 text-xs md:grid-cols-2"><div className="rounded bg-secondary/40 p-2"><span className="font-semibold">Before:</span> {compactValue(activity.beforeValue)}</div><div className="rounded bg-primary/5 p-2"><span className="font-semibold">After:</span> {compactValue(activity.afterValue)}</div></div>}</div>)}</CardContent></Card></TabsContent>;
}
