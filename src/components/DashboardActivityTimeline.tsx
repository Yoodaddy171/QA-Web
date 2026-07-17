'use client';

import { Activity, ArrowUpRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type ActivityItem = {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  field: string | null;
  afterValue: unknown;
  actor: string | null;
  createdAt: string;
};

const ACTION_LABELS: Record<string, string> = {
  CREATED: 'dibuat',
  UPDATED: 'diperbarui',
  DELETED: 'dihapus',
  IMPORTED: 'diimpor',
  COMMENTED: 'dikomentari',
  CASES_ADDED: 'menerima testcase',
  CASE_REMOVED: 'menghapus testcase',
};

function activityDetail(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  for (const key of ['testCaseId', 'name', 'status']) {
    if (typeof record[key] === 'string' && record[key]) return String(record[key]);
  }
  return null;
}

function activityTarget(entityType: string): 'testRuns' | 'testcases' | 'bugfix' | null {
  if (entityType === 'TestRun' || entityType === 'TestExecution') return 'testRuns';
  if (entityType === 'TestCase') return 'testcases';
  if (entityType === 'BugFix') return 'bugfix';
  return null;
}

export function DashboardActivityTimeline({
  activities,
  onNavigate,
}: {
  activities: ActivityItem[];
  onNavigate?: (tab: 'testRuns' | 'testcases' | 'bugfix') => void;
}) {
  return (
    <Card className="border-border/70 bg-card/95">
      <CardHeader className="border-b border-border/50 pb-3">
        <CardTitle className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          <Activity className="h-4 w-4 text-primary" /> Aktivitas QA terbaru
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {activities.length ? (
          <ol className="divide-y divide-border/45">
            {activities.slice(0, 6).map((item, index) => {
              const target = activityTarget(item.entityType);
              const detail = activityDetail(item.afterValue);
              return (
                <li key={item.id} className="group relative flex gap-3 px-4 py-3 transition-colors duration-150 hover:bg-secondary/25">
                  <span className="relative mt-1.5 flex h-2.5 w-2.5 shrink-0">
                    {index === 0 && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/50 motion-reduce:animate-none" />}
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full border-2 border-card bg-primary" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-foreground">
                      {item.entityType} {ACTION_LABELS[item.action] || item.action.toLowerCase()}
                      {item.field ? <span className="font-normal text-muted-foreground"> · {item.field}</span> : null}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
                      <span>{item.actor || 'local-user'}</span>
                      <span aria-hidden="true">·</span>
                      <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}</time>
                      {detail ? <span className="font-mono text-primary">{detail}</span> : null}
                    </div>
                  </div>
                  {target && onNavigate ? (
                    <button type="button" onClick={() => onNavigate(target)} aria-label={`Buka ${item.entityType}`} className="self-center rounded-md p-1.5 text-muted-foreground opacity-60 transition-[opacity,color,transform] duration-150 hover:translate-x-0.5 hover:text-primary group-hover:opacity-100 focus-visible:opacity-100">
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ol>
        ) : (
          <div className="flex min-h-40 flex-col items-center justify-center px-5 text-center">
            <Activity className="mb-2 h-7 w-7 text-muted-foreground/35" />
            <p className="text-xs font-semibold text-muted-foreground">Aktivitas akan muncul setelah tim mulai mengubah atau menjalankan testcase.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
