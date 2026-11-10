'use client';

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  Layers,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import type { DashboardStats } from './DashboardPanel';

export type DashboardQueuesAndRisksProps = {
  stats: DashboardStats;
  onOpenDetail: (item: any, context: any[]) => void;
  onModuleRiskClick?: (item: any) => void;
  onNavigate?: (tab: 'testRuns' | 'reports' | 'testcases' | 'bugfix') => void;
  children?: React.ReactNode;
};

const getPriorityDot = (priority: string) => {
  switch (priority) {
    case 'Critical':
      return 'bg-rose-500';
    case 'High':
      return 'bg-orange-500';
    case 'Medium':
      return 'bg-amber-500';
    case 'Low':
      return 'bg-emerald-500';
    default:
      return 'bg-muted-foreground';
  }
};

const getAgeBadgeStyle = (days: number) => {
  if (days >= 7) {
    return 'border-rose-500/25 bg-rose-500/10 text-rose-600 dark:text-rose-400';
  }
  if (days >= 3) {
    return 'border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400';
  }
  return 'border-border/60 bg-secondary/60 text-muted-foreground';
};

export function DashboardQueuesAndRisks({
  stats,
  onOpenDetail,
  onModuleRiskClick,
  onNavigate,
  children,
}: DashboardQueuesAndRisksProps) {
  const retestQueue = stats.retestQueue || [];
  const bugAging = stats.bugAging || [];
  const moduleRisks = stats.moduleRisks || [];

  // Smart default to the tab that has items
  const [holdingTab, setHoldingTab] = React.useState<'retest' | 'bug'>(() => {
    if (retestQueue.length > 0) return 'retest';
    if (bugAging.length > 0) return 'bug';
    return 'retest';
  });
  const [showAllRisks, setShowAllRisks] = React.useState(false);

  const sortedRisks = React.useMemo(() => {
    return [...moduleRisks].sort((a, b) => b.riskScore - a.riskScore);
  }, [moduleRisks]);

  const visibleRisks = showAllRisks ? sortedRisks : sortedRisks.slice(0, 5);
  const isRetest = holdingTab === 'retest';
  const activeHoldingList = isRetest ? retestQueue : bugAging;
  const visibleHoldingList = activeHoldingList.slice(0, 6);

  return (
    <div className={cn('grid grid-cols-1 gap-6', children ? 'md:grid-cols-2 xl:grid-cols-3' : 'lg:grid-cols-2')}>
      {/* 1. Card: Yang Menahan Rilis (TailAdmin Table Style) */}
      <div className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-xs flex flex-col justify-between">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-border/60">
            <div>
              <h3 className="text-base font-semibold text-foreground">
                Yang Menahan Rilis
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Antrean verifikasi ulang dan bug yang menua
              </p>
            </div>

            {/* Segmented Control Pills */}
            <div className="relative inline-flex items-center rounded-xl bg-secondary/80 p-1 text-xs">
              <button
                type="button"
                onClick={() => setHoldingTab('retest')}
                className={cn(
                  'relative z-10 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
                  isRetest
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {isRetest && (
                  <motion.div
                    layoutId="queues-risks-holding-tab-pill"
                    className="absolute inset-0 z-[-1] rounded-lg bg-background shadow-xs"
                    transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                  />
                )}
                <RefreshCw className={cn('h-3.5 w-3.5', isRetest ? 'text-cyan-500' : 'text-muted-foreground')} />
                <span>Retest</span>
                <span className="font-mono text-[11px] tabular-nums">({retestQueue.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setHoldingTab('bug')}
                className={cn(
                  'relative z-10 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
                  !isRetest
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {!isRetest && (
                  <motion.div
                    layoutId="queues-risks-holding-tab-pill"
                    className="absolute inset-0 z-[-1] rounded-lg bg-background shadow-xs"
                    transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                  />
                )}
                <Clock className={cn('h-3.5 w-3.5', !isRetest ? 'text-amber-500' : 'text-muted-foreground')} />
                <span>Umur Bug</span>
                <span className="font-mono text-[11px] tabular-nums">({bugAging.length})</span>
              </button>
            </div>
          </div>

          {/* List items */}
          <AnimatePresence mode="wait" initial={false}>
            {visibleHoldingList.length > 0 ? (
              <motion.div
                key={holdingTab}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                className="divide-y divide-border/50"
              >
                {visibleHoldingList.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onOpenDetail(item, activeHoldingList)}
                    className="group flex w-full items-center justify-between gap-3 py-3.5 text-left transition-all duration-150 hover:bg-secondary/30 active:scale-[0.99] rounded-lg px-2 -mx-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="rounded-md border border-border/70 bg-secondary/80 px-2 py-0.5 font-mono text-[11px] font-semibold text-foreground">
                          {item.testCaseId}
                        </span>
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span
                            className={cn('h-2 w-2 rounded-full shrink-0', getPriorityDot(item.priority))}
                            aria-hidden="true"
                          />
                          <span className="font-medium">{item.priority}</span>
                        </span>
                      </div>

                      <p className="mt-1.5 truncate text-xs font-medium text-foreground/90 group-hover:text-primary transition-colors">
                        {isRetest
                          ? (item.moduleName ? `${item.moduleName} / ${item.page}` : item.page)
                          : (item.testAction || item.page)}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <Badge
                        variant="outline"
                        className={cn('font-mono text-[11px] tabular-nums font-semibold px-2 py-0.5', getAgeBadgeStyle(isRetest ? item.waitingDays : item.ageDays))}
                      >
                        {isRetest ? `waiting ${item.waitingDays}d` : `${item.ageDays}d`}
                      </Badge>
                    </div>
                  </button>
                ))}
              </motion.div>
            ) : (
              <motion.div
                key={holdingTab}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                className="flex min-h-[220px] flex-col items-center justify-center p-6 text-center"
              >
                <div className="mb-2 rounded-full bg-secondary/80 p-3 text-muted-foreground">
                  <RefreshCw className="h-5 w-5 text-emerald-500" />
                </div>
                <p className="text-xs font-semibold text-foreground">
                  {isRetest ? 'Tidak ada antrean retest.' : 'Tidak ada bug yang menua.'}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {isRetest ? 'Semua skenario pengujian telah bersih.' : 'Seluruh bug aktif tertangani tepat waktu.'}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {activeHoldingList.length > 6 && onNavigate && (
          <div className="pt-3 border-t border-border/50 mt-2">
            <button
              type="button"
              onClick={() => onNavigate(isRetest ? 'testcases' : 'bugfix')}
              className="flex w-full items-center justify-center gap-1.5 text-xs font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-md py-1"
            >
              <span>Lihat semua {activeHoldingList.length} item antrean</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* 2. Card: Radar Risiko Modul (TailAdmin Progress List Style) */}
      <div className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-xs flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between pb-4 border-b border-border/60">
            <div>
              <h3 className="text-base font-semibold text-foreground">
                Radar Risiko Modul
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Modul dengan akumulasi kegagalan tertinggi
              </p>
            </div>

            <span className="font-mono text-xs font-medium text-muted-foreground tabular-nums">
              {moduleRisks.length} modul
            </span>
          </div>

          {visibleRisks.length > 0 ? (
            <div className="divide-y divide-border/50">
              {visibleRisks.map((item) => {
                const riskColor =
                  item.riskScore >= 70
                    ? 'bg-rose-500 text-rose-600 dark:text-rose-400'
                    : item.riskScore >= 40
                      ? 'bg-orange-500 text-orange-600 dark:text-orange-400'
                      : item.riskScore >= 20
                        ? 'bg-amber-500 text-amber-600 dark:text-amber-400'
                        : 'bg-emerald-500 text-emerald-600 dark:text-emerald-400';

                return (
                  <button
                    key={item.moduleId || 'ungrouped'}
                    type="button"
                    onClick={() => onModuleRiskClick?.(item)}
                    className="group flex w-full flex-col gap-2 py-3.5 text-left transition-all duration-150 hover:bg-secondary/30 active:scale-[0.99] rounded-lg px-2 -mx-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <span className="truncate text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                          {item.moduleName}
                        </span>
                        <span className="ml-2 font-mono text-[11px] text-muted-foreground">
                          {item.total} cases
                        </span>
                      </div>

                      <span
                        className={cn(
                          'rounded-md px-2 py-0.5 font-mono text-[11px] font-bold tabular-nums border border-border/50 bg-secondary/50',
                          riskColor.split(' ').slice(1).join(' ')
                        )}
                      >
                        Skor {item.riskScore}
                      </span>
                    </div>

                    {/* Proportional Risk Bar */}
                    <SimpleTooltip
                      content={
                        <span className="font-mono text-xs">
                          Skor {item.riskScore} · {item.failed} failed, {item.blocked} blocked, {item.readyToRetest} retest
                        </span>
                      }
                    >
                      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary cursor-pointer">
                        <div
                          className={cn('h-full rounded-full transition-all duration-300', riskColor.split(' ')[0])}
                          style={{ width: `${Math.min(item.riskScore, 100)}%` }}
                        />
                      </div>
                    </SimpleTooltip>

                    {/* Breakdown Chips */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-mono tabular-nums text-muted-foreground">
                      <span className={cn(item.failed > 0 && 'text-rose-500 font-semibold')}>
                        {item.failed} failed
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className={cn(item.blocked > 0 && 'text-amber-500 font-semibold')}>
                        {item.blocked} blocked
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className={cn(item.readyToRetest > 0 && 'text-cyan-500 font-semibold')}>
                        {item.readyToRetest} retest
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={Layers}
              title="Belum ada data risiko modul"
              description="Data akumulasi risiko akan dihitung otomatis saat eksekusi test run dijalankan."
            />
          )}
        </div>

        {sortedRisks.length > 5 && (
          <div className="pt-3 border-t border-border/50 mt-2">
            <button
              type="button"
              onClick={() => setShowAllRisks((prev) => !prev)}
              className="flex w-full items-center justify-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground active:scale-95 transition-transform duration-100 cursor-pointer"
            >
              {showAllRisks ? 'Tampilkan lebih sedikit' : `Tampilkan semua (${sortedRisks.length} modul)`}
            </button>
          </div>
        )}
      </div>

      {/* 3. Card: Aktivitas QA Terbaru (when provided via children) */}
      {children}
    </div>
  );
}
