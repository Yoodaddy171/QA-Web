'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ListChecks, Plus, RefreshCw, Search, X } from 'lucide-react';
import { MutationAction } from '@/components/WorkspaceAccess';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { UI_MOTION } from '@/lib/client/ui-motion';
import { cn } from '@/lib/utils';
import type { TestRun } from './types';

interface TestRunCyclesOverviewProps {
  runs: TestRun[];
  selectedRunId?: string | null;
  isLoading: boolean;
  cycleSearch: string;
  onCycleSearchChange: (value: string) => void;
  cycleFilterStatus: string;
  onCycleFilterStatusChange: (status: string) => void;
  reducedMotion: boolean | null;
  viewTransition: { duration: number; ease: readonly [number, number, number, number] };
  nextRunCursor: string | null;
  onOpenCreateRunForm: () => void;
  onReloadRuns: () => void;
  onManageRun: (runId: string) => void;
  onOpenRunInRunner: (runId: string) => void;
  onLoadMoreRuns: () => void;
}

export const TestRunCyclesOverview = React.memo(function TestRunCyclesOverview({
  runs,
  selectedRunId,
  isLoading,
  cycleSearch,
  onCycleSearchChange,
  cycleFilterStatus,
  onCycleFilterStatusChange,
  reducedMotion,
  viewTransition,
  nextRunCursor,
  onOpenCreateRunForm,
  onReloadRuns,
  onManageRun,
  onOpenRunInRunner,
  onLoadMoreRuns,
}: TestRunCyclesOverviewProps) {
  const totalCycles = runs.length;
  const inProgressCycles = runs.filter(r => r.status === 'IN PROGRESS').length;
  const completedCycles = runs.filter(r => r.status === 'COMPLETED').length;
  const draftCycles = runs.filter(r => r.status === 'DRAFT').length;
  const totalCasesInRuns = runs.reduce((sum, r) => sum + (r.summary?.total || 0), 0);
  const totalPassedInRuns = runs.reduce((sum, r) => sum + (r.summary?.passed || 0), 0);
  const avgPass = totalCasesInRuns > 0 ? Math.round((totalPassedInRuns / totalCasesInRuns) * 100) : 0;

  const displayedRuns = runs.filter(r => {
    if (cycleFilterStatus !== 'ALL' && r.status !== cycleFilterStatus) return false;
    if (cycleSearch.trim()) {
      const q = cycleSearch.trim().toLowerCase();
      const matchName = r.name.toLowerCase().includes(q);
      const matchAssignee = r.assignedTo?.toLowerCase().includes(q);
      if (!matchName && !matchAssignee) return false;
    }
    return true;
  });

  const cycleFilterTabs = [
    { key: 'ALL', label: 'Semua', count: runs.length },
    { key: 'IN PROGRESS', label: 'Berjalan', count: inProgressCycles },
    { key: 'DRAFT', label: 'Draft', count: draftCycles },
    { key: 'COMPLETED', label: 'Selesai', count: completedCycles },
  ];

  return (
    <motion.div
      key="cycles-view"
      initial={reducedMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
      transition={viewTransition}
      className="space-y-4"
    >
      {/* Top KPI Metrics Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-border/80 bg-card p-4 transition-colors hover:border-border">
          <span className="text-xs font-medium text-muted-foreground">Total Siklus</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold tabular-nums text-foreground">{totalCycles}</span>
            <span className="text-xs text-muted-foreground">cycle</span>
          </div>
        </div>
        <div className="rounded-xl border border-border/80 bg-card p-4 transition-colors hover:border-border">
          <span className="text-xs font-medium text-muted-foreground">Sedang Berjalan</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold tabular-nums text-status-in-progress">{inProgressCycles}</span>
            <span className="text-xs text-muted-foreground">aktif</span>
          </div>
        </div>
        <div className="rounded-xl border border-border/80 bg-card p-4 transition-colors hover:border-border">
          <span className="text-xs font-medium text-muted-foreground">Siklus Selesai</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold tabular-nums text-status-passed">{completedCycles}</span>
            <span className="text-xs text-muted-foreground">final</span>
          </div>
        </div>
        <div className="rounded-xl border border-border/80 bg-card p-4 transition-colors hover:border-border">
          <span className="text-xs font-medium text-muted-foreground">Total Kasus Diuji</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold tabular-nums text-primary">{totalCasesInRuns}</span>
            <span className="text-xs text-muted-foreground">({avgPass}% pass)</span>
          </div>
        </div>
      </div>

      {/* Cycles Header & Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3">
        <div className="relative min-w-[200px] flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Cari siklus pengujian..."
            value={cycleSearch}
            onChange={e => onCycleSearchChange(e.target.value)}
            className="h-9 pl-8 pr-8 text-xs bg-background/50"
          />
          {cycleSearch && (
            <button
              type="button"
              onClick={() => onCycleSearchChange('')}
              aria-label="Bersihkan pencarian siklus"
              className="absolute right-2.5 top-2.5 rounded text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-xl border border-border/60 bg-secondary/40 p-0.5 h-9">
            {cycleFilterTabs.map(tab => {
              const active = cycleFilterStatus === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onCycleFilterStatusChange(tab.key)}
                  className={cn(
                    'relative inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors',
                    active ? 'text-primary font-semibold' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="cycles-status-filter-pill"
                      transition={{ duration: reducedMotion ? 0 : UI_MOTION.content, ease: UI_MOTION.ease }}
                      className="absolute inset-0 rounded-lg border border-border/50 bg-background shadow-2xs"
                    />
                  )}
                  <span className="relative z-10">{tab.label}</span>
                  <span className="relative z-10 font-mono text-[11px] tabular-nums opacity-80">({tab.count})</span>
                </button>
              );
            })}
          </div>

          <div className="h-4 w-px bg-border/60 mx-0.5 hidden sm:block" />

          <MutationAction>
            <Button size="sm" onClick={onOpenCreateRunForm} className="h-9 text-xs">
              <Plus className="h-3.5 w-3.5 mr-1" />Cycle baru
            </Button>
          </MutationAction>
          <Button
            variant="outline"
            size="icon"
            className="size-9"
            onClick={onReloadRuns}
            disabled={isLoading}
            aria-label="Muat ulang cycle"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* Cycles List */}
      <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
        {isLoading && runs.length === 0 && (
          <div className="p-4 space-y-3" aria-label="Memuat Test Cycle">
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
          </div>
        )}

        {!runs.length && !isLoading && (
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <ListChecks className="size-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-semibold text-foreground">Belum ada Test Cycle</p>
            <p className="mt-1 text-xs text-muted-foreground">Buat cycle pertama untuk mulai execution.</p>
            <MutationAction>
              <Button size="sm" className="mt-4" onClick={onOpenCreateRunForm}>
                <Plus className="h-4 w-4 mr-1.5" />Buat cycle
              </Button>
            </MutationAction>
          </div>
        )}

        {runs.length > 0 && displayedRuns.length === 0 && !isLoading && (
          <EmptyState
            icon={Search}
            title="Tidak ada Test Cycle yang cocok"
            description={
              cycleSearch
                ? `Tidak ada siklus pengujian yang cocok dengan kata kunci "${cycleSearch}".`
                : `Tidak ada siklus pengujian berstatus ${cycleFilterStatus === 'IN PROGRESS' ? 'Berjalan' : cycleFilterStatus === 'DRAFT' ? 'Draft' : 'Selesai'}.`
            }
            action={{
              label: 'Reset Filter',
              onClick: () => {
                onCycleSearchChange('');
                onCycleFilterStatusChange('ALL');
              },
              variant: 'outline',
            }}
            className="py-12"
          />
        )}

        {displayedRuns.map(run => {
          const isCurrent = selectedRunId === run.id;
          return (
            <div
              key={run.id}
              className={cn(
                'group flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 transition-colors duration-150 hover:bg-secondary/30',
                isCurrent && 'bg-secondary/20'
              )}
            >
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">{run.name}</span>
                  <Badge variant={run.status === 'COMPLETED' ? 'success' : run.status === 'IN PROGRESS' ? 'inprogress' : 'outline'}>
                    {run.status}
                  </Badge>
                  {run.assignedTo && (
                    <span className="text-xs text-muted-foreground">· {run.assignedTo}</span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                  <SimpleTooltip content={<span className="font-mono text-xs">Progres eksekusi: {run.progress}%</span>}>
                    <div className="flex items-center gap-2 min-w-[140px] max-w-[200px] flex-1 cursor-pointer">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full rounded-full bg-primary transition-all duration-300 ease-[var(--motion-ease)]"
                          style={{ width: `${run.progress}%` }}
                        />
                      </div>
                      <span className="font-mono tabular-nums text-[11px] font-medium">{run.progress}%</span>
                    </div>
                  </SimpleTooltip>
                  <span className="font-mono tabular-nums text-xs">{run.summary.completed}/{run.summary.total} cases</span>
                  <div className="flex items-center gap-2.5 font-mono tabular-nums text-xs">
                    <SimpleTooltip content={<span className="font-mono text-xs">Passed: {run.summary.passed}</span>}>
                      <span className="inline-flex items-center gap-1 cursor-pointer">
                        <span className="size-1.5 rounded-full bg-emerald-500" />
                        {run.summary.passed}
                      </span>
                    </SimpleTooltip>
                    <SimpleTooltip content={<span className="font-mono text-xs">Failed: {run.summary.failed}</span>}>
                      <span className="inline-flex items-center gap-1 cursor-pointer">
                        <span className="size-1.5 rounded-full bg-rose-500" />
                        {run.summary.failed}
                      </span>
                    </SimpleTooltip>
                    <SimpleTooltip content={<span className="font-mono text-xs">Blocked: {run.summary.blocked}</span>}>
                      <span className="inline-flex items-center gap-1 cursor-pointer">
                        <span className="size-1.5 rounded-full bg-amber-500" />
                        {run.summary.blocked}
                      </span>
                    </SimpleTooltip>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onManageRun(run.id)}
                  className="text-xs h-8"
                >
                  Kelola
                </Button>
                <Button
                  size="sm"
                  onClick={() => onOpenRunInRunner(run.id)}
                  className="text-xs h-8"
                >
                  {run.progress > 0 && run.status !== 'COMPLETED' ? 'Lanjutkan' : 'Buka runner'}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {nextRunCursor && (
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={onLoadMoreRuns}
        >
          Muat cycle berikutnya
        </Button>
      )}
    </motion.div>
  );
});
