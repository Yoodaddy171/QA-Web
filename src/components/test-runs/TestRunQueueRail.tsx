'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TEST_EXECUTION_STATUS } from '@/lib/domain/test-run';
import { UI_MOTION } from '@/lib/client/ui-motion';
import { cn } from '@/lib/utils';
import {
  type QueueStatusFilter,
  type RunCase,
  type TestRunDetail,
  statusDotClass,
  statusTextClass,
} from './types';

interface TestRunQueueRailProps {
  selectedRun: TestRunDetail;
  visibleRunCases: RunCase[];
  activeCaseIndex: number;
  caseSearch: string;
  onCaseSearchChange: (value: string) => void;
  caseStatusFilter: QueueStatusFilter;
  onCaseStatusFilterChange: (filter: QueueStatusFilter) => void;
  queueCounts: {
    all: number;
    failed: number;
    blocked: number;
    passed: number;
  };
  loadingCases: boolean;
  isSaving: boolean;
  reducedMotion: boolean | null;
  viewTransition: { duration: number; ease: readonly [number, number, number, number] };
  onChooseCase: (index: number) => void;
  onLoadMoreRunCases: (before: boolean) => void;
}

export const TestRunQueueRail = React.memo(function TestRunQueueRail({
  selectedRun,
  visibleRunCases,
  activeCaseIndex,
  caseSearch,
  onCaseSearchChange,
  caseStatusFilter,
  onCaseStatusFilterChange,
  queueCounts,
  loadingCases,
  isSaving,
  reducedMotion,
  viewTransition,
  onChooseCase,
  onLoadMoreRunCases,
}: TestRunQueueRailProps) {
  return (
    <motion.aside
      key="runner-queue-rail"
      initial={reducedMotion ? false : { opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={reducedMotion ? { opacity: 0 } : { opacity: 0, x: -12 }}
      transition={viewTransition}
      aria-label="Antrean Testcase"
      className="flex flex-col gap-2.5 rounded-xl border border-border bg-card p-3 shadow-2xs lg:sticky lg:top-4 lg:max-h-[calc(100svh-5.5rem)]"
    >
      {/* Queue Search Input */}
      <div className="relative shrink-0">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
        <Input
          value={caseSearch}
          onChange={event => onCaseSearchChange(event.target.value)}
          placeholder="Cari ID, halaman, atau aksi..."
          aria-label="Cari testcase dalam cycle"
          className="h-8 pl-8 pr-7 text-xs bg-background"
        />
        {caseSearch && (
          <button
            type="button"
            onClick={() => onCaseSearchChange('')}
            aria-label="Bersihkan pencarian testcase"
            className="absolute right-2 top-2 rounded p-0.5 text-muted-foreground hover:text-foreground"
          >
            <X className="size-3" />
          </button>
        )}
      </div>

      {/* 4-Column Segmented Filter Grid (Fits 100% in 300px, Zero Clipping) */}
      <div
        role="group"
        aria-label="Filter status antrean testcase"
        className="grid grid-cols-4 gap-1 rounded-lg border border-border/60 bg-secondary/40 p-1 shrink-0"
      >
        {([
          { key: 'ALL', label: 'Semua', count: queueCounts.all, activeText: 'text-primary' },
          { key: 'FAILED', label: 'Fail', count: queueCounts.failed, activeText: 'text-status-failed' },
          { key: 'BLOCKED', label: 'Block', count: queueCounts.blocked, activeText: 'text-status-blocked' },
          { key: 'PASSED', label: 'Pass', count: queueCounts.passed, activeText: 'text-status-passed' },
        ] as const).map(tab => {
          const active = caseStatusFilter === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              aria-pressed={active}
              onClick={() => onCaseStatusFilterChange(tab.key)}
              className={cn(
                'relative flex flex-col items-center justify-center rounded-md py-1 px-1 text-center transition-colors',
                active ? cn('font-semibold', tab.activeText) : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {active && (
                <motion.span
                  layoutId="runner-queue-filter-pill"
                  transition={{ duration: reducedMotion ? 0 : UI_MOTION.content, ease: UI_MOTION.ease }}
                  className="absolute inset-0 rounded-md border border-border/60 bg-background shadow-2xs"
                />
              )}
              <span className="relative z-10 text-[10px] leading-tight">{tab.label}</span>
              <span className="relative z-10 font-mono text-[11px] font-bold tabular-nums leading-tight mt-0.5">
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Scrollable Test Case Queue Items */}
      <div className="flex flex-col gap-1 overflow-y-auto pr-0.5 max-h-[280px] lg:max-h-[calc(100svh-14.5rem)] min-h-[180px]">
        {selectedRun.casePage?.startOffset ? (
          <Button
            variant="outline"
            size="sm"
            className="mb-1 h-7 text-xs shrink-0"
            disabled={loadingCases}
            onClick={() => onLoadMoreRunCases(true)}
          >
            Muat testcase sebelumnya
          </Button>
        ) : null}

        {visibleRunCases.length > 0 ? (
          visibleRunCases.map(testCase => {
            const index = selectedRun.testCases.findIndex(item => item.id === testCase.id);
            const latest = testCase.executions[0];
            const status = latest?.status || TEST_EXECUTION_STATUS.NOT_RUN;
            const active = index === activeCaseIndex;
            return (
              <button
                key={testCase.id}
                type="button"
                aria-current={active ? 'true' : undefined}
                disabled={isSaving}
                onClick={() => onChooseCase(index)}
                className={cn(
                  'group relative w-full overflow-hidden rounded-lg border px-2.5 py-2 text-left transition-colors duration-150 shrink-0',
                  active
                    ? 'border-primary/40 text-foreground shadow-2xs'
                    : 'border-transparent hover:border-border/70 hover:bg-secondary/50 text-foreground',
                  isSaving && 'opacity-60'
                )}
              >
                {active && (
                  <motion.span
                    layoutId="runner-active-case-bg"
                    transition={{ duration: reducedMotion ? 0 : UI_MOTION.content, ease: UI_MOTION.ease }}
                    className="qa-selected-row absolute inset-0 rounded-lg pointer-events-none"
                  />
                )}
                <div className="relative z-10 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-mono text-[11px] tabular-nums text-muted-foreground w-5 shrink-0">
                      {(selectedRun.casePage?.startOffset || 0) + index + 1}
                    </span>
                    <span className="font-mono text-xs font-bold text-foreground truncate">
                      {testCase.testCaseId}
                    </span>
                  </div>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide shrink-0',
                      statusTextClass(status)
                    )}
                  >
                    <span className={cn('size-1.5 rounded-full shrink-0', statusDotClass(status))} />
                    {status}
                  </span>
                </div>
                <p className="relative z-10 mt-1 pl-6 text-[11px] text-muted-foreground truncate">
                  {testCase.testAction || testCase.page}
                </p>
              </button>
            );
          })
        ) : (
          <div className="py-8 px-3 text-center">
            <p className="text-xs font-medium text-muted-foreground">Tidak ada testcase yang cocok.</p>
            {(caseSearch || caseStatusFilter !== 'ALL') && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  onCaseSearchChange('');
                  onCaseStatusFilterChange('ALL');
                }}
                className="mt-2 h-7 text-xs"
              >
                Reset filter antrean
              </Button>
            )}
          </div>
        )}

        {selectedRun.casePage?.hasMore ? (
          <Button
            variant="outline"
            size="sm"
            className="mt-1 h-7 text-xs shrink-0"
            disabled={loadingCases}
            onClick={() => onLoadMoreRunCases(false)}
          >
            {loadingCases ? 'Memuat...' : 'Muat testcase berikutnya'}
          </Button>
        ) : null}
      </div>
    </motion.aside>
  );
});
