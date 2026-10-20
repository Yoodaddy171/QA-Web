'use client';

import { Activity, ArrowUpRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { activityEntityLabel, activityFieldLabel, summarizeActivities, type DashboardActivity } from '@/lib/client/activity-summary';

const ACTION_LABELS: Record<string, string> = {
  CREATED: 'dibuat',
  UPDATED: 'diperbarui',
  DELETED: 'dihapus',
  IMPORTED: 'diimpor',
  COMMENTED: 'dikomentari',
  CASES_ADDED: 'menerima testcase',
  CASE_REMOVED: 'menghapus testcase',
};

const ENTITY_LABELS: Record<string, string> = { TestCase: 'Testcase', TestRun: 'Test Run', TestExecution: 'Eksekusi', BugFix: 'Bug', Requirement: 'Requirement', TestPlan: 'Test Plan' };

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
  activities: DashboardActivity[];
  onNavigate?: (tab: 'testRuns' | 'testcases' | 'bugfix') => void;
}) {
  return (
    <Card padding="none" className="gap-0 border-border bg-card shadow-none">
      <CardHeader className="border-b border-border p-4 sm:px-5">
        <CardTitle className="qa-module-heading flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" /> Aktivitas QA terbaru
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {activities.length ? (
          <ol className="divide-y divide-border/45">
            {summarizeActivities(activities).slice(0, 6).map(({ item, events }) => {
              const target = activityTarget(item.entityType);
              const label = activityEntityLabel(item);
              return (
                <li key={item.id} className="group relative flex gap-3 px-4 py-3 transition-colors duration-150 hover:bg-secondary/25">
                  <span className="relative mt-1.5 flex h-2.5 w-2.5 shrink-0">
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full border-2 border-card bg-primary" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">
                      {ENTITY_LABELS[item.entityType] || item.entityType} {ACTION_LABELS[item.action] || item.action.toLowerCase()}
                    </p>
                    <p className="mt-1 break-words text-sm font-medium text-foreground">{label}</p>
                    {events.some(event => event.field) ? <p className="mt-1 text-sm text-muted-foreground">{events.map(event => event.field ? activityFieldLabel(event.field) : null).filter(Boolean).join(' · ')}</p> : null}
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <span>{item.actor || 'local-user'}</span>
                      <span aria-hidden="true">·</span>
                      <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}</time>
                      {events.length > 1 ? <span>{events.length} perubahan terkait</span> : null}
                    </div>
                  </div>
                  {target && onNavigate ? (
                    <button type="button" onClick={() => onNavigate(target)} aria-label={`Buka daftar ${ENTITY_LABELS[item.entityType] || item.entityType}`} className="flex size-11 shrink-0 items-center justify-center self-center rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-secondary hover:text-primary focus-visible:outline-2 focus-visible:outline-ring sm:size-9">
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
