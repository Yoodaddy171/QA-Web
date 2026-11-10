'use client';

import React from 'react';
import { Activity, ArrowUpRight, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import {
  activityActorLabel,
  activityDetail,
  activityEntityLabel,
  activityEntityTypeLabel,
  activityTitle,
  summarizeActivities,
  type DashboardActivity,
} from '@/lib/client/activity-summary';

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
  const summarized = summarizeActivities(activities).slice(0, 6);

  return (
    <div className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-xs flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between pb-4 border-b border-border/60">
          <div>
            <h3 className="text-base font-semibold text-foreground">
              Aktivitas QA Terbaru
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Riwayat log dan mutasi terbaru
            </p>
          </div>
          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            {activities.length} event
          </span>
        </div>

        {summarized.length > 0 ? (
          <div className="divide-y divide-border/50">
            {summarized.map(({ item, events }) => {
              const target = activityTarget(item.entityType);
              const label = activityEntityLabel(item);
              const detail = activityDetail(item);
              const actor = activityActorLabel(item.actor);
              const initial = (actor.charAt(0) || 'U').toUpperCase();

              return (
                <div
                  key={item.id}
                  className="group flex items-start gap-3 py-3 transition-colors hover:bg-secondary/30 rounded-lg px-1.5"
                >
                  {/* Avatar badge */}
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary border border-primary/20 text-xs font-semibold">
                    {initial}
                  </div>

                  <div className="min-w-0 flex-1 text-xs">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate font-medium text-foreground">
                        {activityTitle(item)}
                      </p>
                      <time
                        dateTime={item.createdAt}
                        className="shrink-0 font-mono text-[11px] text-muted-foreground tabular-nums"
                      >
                        {new Date(item.createdAt).toLocaleTimeString('id-ID', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </time>
                    </div>

                    {label && (
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground font-mono">
                        {label}
                      </p>
                    )}

                    {detail && (
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        {detail}
                      </p>
                    )}

                    <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="h-2.5 w-2.5" />
                        <span>{actor}</span>
                        {events.length > 1 && (
                          <span className="font-mono tabular-nums">({events.length} logs)</span>
                        )}
                      </span>

                      {target && onNavigate && (
                        <button
                          type="button"
                          onClick={() => onNavigate(target)}
                          className="flex items-center gap-0.5 text-primary hover:underline text-[11px] active:scale-95 transition-transform duration-100 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-sm px-1 py-0.5"
                          aria-label={`Buka ${activityEntityTypeLabel(item.entityType)}`}
                        >
                          <span>Buka</span>
                          <ArrowUpRight className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={Activity}
            title="Belum ada aktivitas QA"
            description="Perubahan status eksekusi, testcase, dan bug akan terekam otomatis di sini."
          />
        )}
      </div>
    </div>
  );
}
