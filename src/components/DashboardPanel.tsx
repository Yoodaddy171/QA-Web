'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Bug,
  CheckCircle2,
  Clock,
  HelpCircle,
  Layers,
  Percent,
  Play,
  RefreshCw,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { DashboardStatsCards } from '@/components/DashboardStatsCards';
import { DashboardQueuesAndRisks } from '@/components/DashboardQueuesAndRisks';
import { DashboardModuleProgress } from '@/components/DashboardModuleProgress';
import { DashboardActivityTimeline } from '@/components/DashboardActivityTimeline';

interface Module {
  id: string;
  name: string;
  projectId: string;
  _count?: { testCases: number };
}

interface MenuProgressItem {
  page: string;
  subMenu: string;
  totalCases: number;
  weightPerCase: number;
  progressPercent: number;
  doneCount: number;
  inProgressCount: number;
  notDoneCount: number;
  blockedCount: number;
  failedCount: number;
  readyToRetestCount: number;
  tbaCount: number;
  activeCount: number;
}

interface ModuleProgressItem {
  id: string;
  name: string;
  totalMenus: number;
  totalCases: number;
  totalDone: number;
  avgProgress: number;
  menus: MenuProgressItem[];
}

interface UngroupedProgressItem {
  id: null;
  name: string;
  totalMenus: number;
  totalCases: number;
  totalDone: number;
  avgProgress: number;
  menus: MenuProgressItem[];
}

interface RetestQueueItem {
  id: string;
  testCaseId: string;
  page: string;
  subMenu: string | null;
  priority: string;
  moduleName: string | null;
  updatedAt: string;
  waitingDays: number;
}

interface BugAgingItem {
  id: string;
  testCaseId: string;
  page: string;
  subMenu: string | null;
  testAction: string;
  priority: string;
  status: string;
  moduleName: string | null;
  startedAt: string;
  ageDays: number;
}

interface ModuleRiskItem {
  moduleId: string | null;
  moduleName: string;
  total: number;
  failed: number;
  readyToRetest: number;
  inProgress: number;
  blocked: number;
  notDone: number;
  riskScore: number;
}

export interface DashboardStats {
  totalTestCases: number;
  doneCount: number;
  notDoneCount: number;
  inProgressCount: number;
  blockedCount: number;
  failedCount: number;
  readyToRetestCount: number;
  tbaCount: number;
  bugFixTotal: number;
  bugFixReported: number;
  bugFixFixing: number;
  bugFixReadyRetest: number;
  bugFixFixed: number;
  positiveCount: number;
  negativeCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  overallProgress: number;
  moduleData: { name: string; total: number; done: number; notDone: number; inProgress: number; blocked: number }[];
  pageGroups: { page: string; _count: { id: number } }[];
  weightMap: Record<string, number>;
  menuProgress: {
    menuKey: string;
    page: string;
    subMenu: string;
    totalCases: number;
    weightPerCase: number;
    totalWeight: number;
    contributedWeight: number;
    progressPercent: number;
    doneCount: number;
    inProgressCount: number;
    notDoneCount: number;
    blockedCount: number;
    failedCount: number;
    readyToRetestCount: number;
    tbaCount: number;
    moduleId: string | null;
    moduleName: string | null;
  }[];
  moduleProgress: ModuleProgressItem[];
  ungroupedProgress: UngroupedProgressItem | null;
  retestQueue?: RetestQueueItem[];
  bugAging?: BugAgingItem[];
  moduleRisks?: ModuleRiskItem[];
  releaseReadiness?: {
    recommendation: 'READY' | 'READY WITH RISK' | 'NOT READY';
    testRunId: string | null;
    testRunName: string | null;
    testRunStatus: string | null;
    totalCases: number;
    completedCases: number;
    passedCases: number;
    progress: number;
    failedCases: number;
    blockedCases: number;
    notRunCases: number;
    criticalBugs: number;
    openBugs: number;
    reason: string;
  };
  recentActivities?: {
    id: string;
    entityType: string;
    entityId: string;
    entityLabel?: string | null;
    action: string;
    field: string | null;
    afterValue: unknown;
    actor: string | null;
    createdAt: string;
  }[];
}

interface DashboardPanelProps {
  stats: DashboardStats | null;
  modules: Module[];
  expandedModules: Set<string>;
  setExpandedModules: React.Dispatch<React.SetStateAction<Set<string>>>;
  selectedModuleFilter: string;
  setSelectedModuleFilter: (value: string) => void;
  onOpenDetail: (testCase: any, contextList?: any[]) => void;
  onModuleRiskClick?: (moduleRisk: ModuleRiskItem) => void;
  isLoading?: boolean;
  lastRefreshed?: Date | null;
  onRefresh?: () => void;
  onNavigate?: (tab: 'testRuns' | 'reports' | 'testcases' | 'bugfix') => void;
  onOpenFailedCases?: () => void;
}

export function DashboardPanel({
  stats,
  modules,
  expandedModules,
  setExpandedModules,
  selectedModuleFilter,
  setSelectedModuleFilter,
  onOpenDetail,
  onModuleRiskClick,
  isLoading,
  lastRefreshed,
  onRefresh,
  onNavigate,
  onOpenFailedCases,
}: DashboardPanelProps) {
  const [chartView, setChartView] = useState<'status' | 'priority'>('status');
  const [showAllPages, setShowAllPages] = useState(false);

  if (!stats) {
    return (
      <div className="flex h-72 items-center justify-center rounded-2xl border border-dashed border-border bg-card/30">
        <div className="text-center">
          <BarChart3 className="mx-auto mb-3 h-10 w-10 text-primary/40" />
          <p className="text-sm font-medium text-foreground">Pilih project untuk melihat dashboard</p>
          <p className="mt-1 text-xs text-muted-foreground">Pilih project di sidebar atau switcher untuk memuat metrik QA.</p>
        </div>
      </div>
    );
  }

  const release = stats.releaseReadiness;
  const overdueBugs = (stats.bugAging || []).filter((item) => item.ageDays >= 7).length;
  const openBugs = release?.openBugs ?? stats.bugFixReported;
  const criticalBugs = release?.criticalBugs ?? stats.criticalCount ?? 0;

  // Ledger calculation
  const ledgerPassed = release ? release.passedCases : stats.doneCount;
  const ledgerFailed = release ? release.failedCases : stats.failedCount;
  const ledgerBlocked = release ? release.blockedCases : stats.blockedCount;
  const ledgerNotRun = release ? release.notRunCases : stats.notDoneCount;
  const ledgerTotal = Math.max(1, ledgerPassed + ledgerFailed + ledgerBlocked + ledgerNotRun);

  // Active run segments
  const runTotal = Math.max(1, release?.totalCases || 0);
  const runSegments = release
    ? [
        { label: 'Passed', value: release.passedCases, color: 'bg-emerald-500' },
        { label: 'Failed', value: release.failedCases, color: 'bg-rose-500' },
        { label: 'Blocked', value: release.blockedCases, color: 'bg-amber-500' },
        { label: 'Not run', value: release.notRunCases, color: 'bg-secondary' },
      ]
    : [];

  const verdictHeadline =
    release?.recommendation === 'NOT READY'
      ? 'Release belum siap'
      : release?.recommendation === 'READY'
        ? 'Release siap diluncurkan'
        : 'Siap dengan risiko';

  const verdictReason = release
    ? `${release.reason}. Status inventori: ${stats.failedCount} failed, ${stats.blockedCount} blocked.`
    : `${stats.doneCount} dari ${stats.totalTestCases} skenario telah terverifikasi. ${stats.failedCount} failed, ${stats.blockedCount} blocked.`;

  const totalCases = Math.max(1, stats.totalTestCases || 1);

  // Data for the TailAdmin "Monthly Sales" style vertical bar chart
  const statusBars = [
    { label: 'Done', count: stats.doneCount, color: 'bg-emerald-500', hex: '#10b981' },
    { label: 'In Progress', count: stats.inProgressCount, color: 'bg-indigo-500', hex: '#6366f1' },
    { label: 'Blocked', count: stats.blockedCount, color: 'bg-amber-500', hex: '#f59e0b' },
    { label: 'Failed', count: stats.failedCount, color: 'bg-rose-500', hex: '#f43f5e' },
    { label: 'Retest', count: stats.readyToRetestCount, color: 'bg-cyan-500', hex: '#06b6d4' },
    { label: 'Backlog', count: stats.notDoneCount, color: 'bg-zinc-500', hex: '#71717a' },
  ];

  const priorityBars = [
    { label: 'Critical', count: stats.criticalCount || 0, color: 'bg-rose-500', hex: '#f43f5e' },
    { label: 'High', count: stats.highCount || 0, color: 'bg-orange-500', hex: '#f97316' },
    { label: 'Medium', count: stats.mediumCount || 0, color: 'bg-amber-500', hex: '#f59e0b' },
    { label: 'Low', count: stats.lowCount || 0, color: 'bg-emerald-500', hex: '#10b981' },
  ];

  const activeBars = chartView === 'status' ? statusBars : priorityBars;
  const maxBarCount = Math.max(1, ...activeBars.map((b) => b.count));

  // Gauge styling
  const gaugeColor =
    release?.recommendation === 'READY'
      ? '#10b981'
      : release?.recommendation === 'NOT READY'
        ? '#f43f5e'
        : '#f59e0b';

  return (
    <div className="flex flex-col gap-6">
      {/* =========================================================================
          ROW 1: TOP KPI METRIC CARDS (TailAdmin style with circular icons)
         ========================================================================= */}
      <DashboardStatsCards stats={stats} />

      {/* =========================================================================
          ROW 2: TAILADMIN DUAL BENTO
          - Left (7 cols): "Monthly Sales" style vertical bar chart
          - Right (5 cols): "Monthly Target" style 180° semi-circular gauge card
         ========================================================================= */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Left: Monthly Sales Style Bar Chart (xl:col-span-7) */}
        <div className="flex flex-col justify-between overflow-hidden rounded-2xl border border-border/80 bg-card shadow-xs xl:col-span-7">
          {/* Header with Title and Segmented Switch */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 p-5 sm:px-6">
            <div>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                <h3 className="text-base font-semibold text-foreground">Distribusi Pengujian</h3>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Total <span className="font-mono font-medium text-foreground">{stats.totalTestCases}</span> skenario dalam inventori
              </p>
            </div>

            {/* Segmented view switcher */}
            <div className="relative flex items-center rounded-xl bg-secondary/70 p-1 border border-border/50 text-xs">
              <button
                type="button"
                onClick={() => setChartView('status')}
                className={cn(
                  'relative z-10 rounded-lg px-3 py-1 font-medium transition-colors duration-150 active:scale-[0.98]',
                  chartView === 'status'
                    ? 'text-foreground font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {chartView === 'status' && (
                  <motion.div
                    layoutId="dashboard-chart-view-pill"
                    className="absolute inset-0 z-[-1] rounded-lg bg-card shadow-xs"
                    transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                  />
                )}
                Distribusi Status Skenario
              </button>
              <button
                type="button"
                onClick={() => setChartView('priority')}
                className={cn(
                  'relative z-10 rounded-lg px-3 py-1 font-medium transition-colors duration-150 active:scale-[0.98]',
                  chartView === 'priority'
                    ? 'text-foreground font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {chartView === 'priority' && (
                  <motion.div
                    layoutId="dashboard-chart-view-pill"
                    className="absolute inset-0 z-[-1] rounded-lg bg-card shadow-xs"
                    transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                  />
                )}
                Kasus per Tingkat Prioritas
              </button>
            </div>
          </div>

          {/* Vertical Bar Chart Canvas (TailAdmin style) */}
          <div className="p-5 sm:p-6 flex-1 flex flex-col justify-center min-h-[260px]">
            <div className="relative flex items-end justify-between gap-2 sm:gap-4 h-[220px] px-2 sm:px-4">
              {/* Subtle horizontal grid lines */}
              <div className="absolute inset-x-2 sm:inset-x-4 top-4 bottom-8 flex flex-col justify-between pointer-events-none opacity-20">
                <div className="border-b border-border/80 w-full" />
                <div className="border-b border-border/80 w-full" />
                <div className="border-b border-border/80 w-full" />
                <div className="border-b border-border/80 w-full" />
              </div>
              {activeBars.map((bar) => {
                const pctOfTotal = Math.round((bar.count / totalCases) * 100);
                const barHeightPercent =
                  bar.count > 0 ? Math.max(6, Math.round((bar.count / maxBarCount) * 100)) : 0;

                return (
                  <div key={bar.label} className="relative z-10 group flex flex-1 flex-col items-center h-full justify-end">
                    {/* Floating percentage/count indicator */}
                    <div className="mb-2 flex flex-col items-center">
                      <span
                        className={cn(
                          'font-mono text-xs tabular-nums',
                          bar.count > 0
                            ? 'font-semibold text-foreground'
                            : 'font-normal text-muted-foreground/50'
                        )}
                      >
                        {pctOfTotal}%
                      </span>
                    </div>

                    {/* Bar track and fill (TailAdmin style) */}
                    <div className="relative flex h-[160px] w-8 sm:w-12 items-end justify-center overflow-hidden rounded-t-lg bg-secondary/50 dark:bg-muted/30">
                      <SimpleTooltip
                        content={
                          <div className="flex flex-col gap-0.5 text-center">
                            <span className="font-semibold text-foreground">{bar.label}</span>
                            <span className="font-mono text-[11px] text-muted-foreground">
                              {bar.count} kasus ({pctOfTotal}%)
                            </span>
                          </div>
                        }
                      >
                        <div
                          tabIndex={0}
                          role="img"
                          data-chart-bar={bar.label}
                          aria-label={`${bar.label}: ${bar.count} kasus (${pctOfTotal}%)`}
                          className={cn(
                            'w-full rounded-t-lg transition-all duration-500 ease-out group-hover:brightness-110 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
                            bar.color
                          )}
                          style={{ height: `${barHeightPercent}%` }}
                        />
                      </SimpleTooltip>
                    </div>

                    {/* Category Label */}
                    <span className="mt-2.5 truncate text-center text-xs font-medium text-muted-foreground group-hover:text-foreground">
                      {bar.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Horizontal Legend / Breakdown Strip */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 bg-secondary/20 px-5 py-3 text-xs">
            {activeBars.map((item) => (
              <div key={item.label} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: item.hex }} />
                <span className="text-muted-foreground">{item.label}:</span>
                <span className="font-mono font-semibold text-foreground tabular-nums">{item.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Monthly Target Style Release Readiness Card (xl:col-span-5) */}
        <div className="flex flex-col justify-between overflow-hidden rounded-2xl border border-border/80 bg-card shadow-xs xl:col-span-5">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/60 p-5 sm:px-6">
            <div>
              <h3 className="text-base font-semibold text-foreground">Target Kesiapan Rilis</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Release decision & target kesiapan peluncuran
              </p>
            </div>

            <div className="flex items-center gap-2">
              {lastRefreshed && (
                <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                  Diperbarui {lastRefreshed.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
              {onRefresh && (
                <SimpleTooltip content="Muat ulang data">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onRefresh}
                    disabled={isLoading}
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    aria-label="Muat ulang data"
                  >
                    <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
                  </Button>
                </SimpleTooltip>
              )}
            </div>
          </div>

          {/* Body: 180° Semi-circular Gauge (TailAdmin "Monthly Target") */}
          <div className="flex flex-col items-center p-5 sm:p-6">
            {/* 180° Gauge Arc */}
            <div className="relative flex h-[135px] w-[240px] items-center justify-center">
              <svg viewBox="0 0 240 135" className="h-full w-full" aria-hidden="true">
                {/* Background Track Arc (180deg from (35,120) to (205,120) with R=85) */}
                <path
                  d="M 35,120 A 85,85 0 0,1 205,120"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="16"
                  strokeLinecap="round"
                  className="stroke-secondary/70 dark:stroke-muted/40"
                />
                {/* Active Colored Arc */}
                <path
                  d="M 35,120 A 85,85 0 0,1 205,120"
                  fill="none"
                  stroke={gaugeColor}
                  strokeWidth="16"
                  strokeLinecap="round"
                  strokeDasharray={267.04}
                  strokeDashoffset={267.04 * (1 - Math.min(stats.overallProgress, 100) / 100)}
                  className="transition-all duration-700 ease-out"
                />
              </svg>

              {/* Centered Values inside the Half-Circle */}
              <div className="absolute inset-0 flex flex-col items-center justify-end pb-1 pointer-events-none">
                <AnimatedNumber
                  value={stats.overallProgress}
                  suffix="%"
                  className="font-mono text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground tabular-nums"
                />
                {release && (
                  <Badge
                    variant={
                      release.recommendation === 'READY'
                        ? 'success'
                        : release.recommendation === 'NOT READY'
                          ? 'failed'
                          : 'warning'
                    }
                    className="mt-1 font-semibold"
                  >
                    {release.recommendation}
                  </Badge>
                )}
                <span className="text-[11px] font-medium text-muted-foreground mt-0.5">
                  Release decision
                </span>
              </div>
            </div>

            {/* Verdict Headline & Reason */}
            <h4 className="mt-3 text-center text-balance text-lg font-bold tracking-tight text-foreground">
              {verdictHeadline}
            </h4>
            <p className="mt-1 max-w-sm text-center text-xs text-muted-foreground leading-relaxed">
              {verdictReason}
            </p>

            {/* Hint Notice */}
            <div className="mt-2 flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground/80">
              <HelpCircle className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" aria-hidden="true" />
              <span>
                Readiness merangkum inventory, execution cycle, dan Bug. Pass execution tidak otomatis menandai Bug terverifikasi.
              </span>
            </div>

            {/* Action Buttons: 2-column balanced grid */}
            <div className="mt-4 grid w-full max-w-sm grid-cols-2 gap-2">
              {onNavigate && (
                <Button size="sm" onClick={() => onNavigate('testRuns')} className="w-full justify-center gap-1.5 h-8 text-xs font-medium">
                  <Play className="h-3.5 w-3.5" /> Buka run aktif
                </Button>
              )}
              {onNavigate && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onNavigate('reports')}
                  className="w-full justify-center gap-1.5 h-8 text-xs font-medium"
                >
                  Lihat report <ArrowUpRight className="h-3.5 w-3.5" />
                </Button>
              )}
              {stats.failedCount > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onOpenFailedCases || (() => onNavigate?.('testcases'))}
                  className="w-full justify-center h-8 text-xs font-medium border-rose-500/20 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 dark:border-rose-500/30"
                >
                  Testcase gagal ({stats.failedCount})
                </Button>
              )}
              {onNavigate && stats.bugFixReported > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onNavigate('bugfix')}
                  className="w-full justify-center h-8 text-xs font-medium border-amber-500/20 text-amber-500 hover:text-amber-600 hover:bg-amber-500/10 dark:border-amber-500/30"
                >
                  Buka bugs ({stats.bugFixReported})
                </Button>
              )}
            </div>
          </div>

          {/* Footer: TailAdmin 3-Column Stats Divider + Ledger Bar */}
          <div className="border-t border-border/60 bg-secondary/20">
            <div className="grid grid-cols-3 divide-x divide-border/60 py-3 text-center">
              <div>
                <p className="text-[11px] font-medium text-muted-foreground">Open Bugs</p>
                <p className="font-mono text-base sm:text-lg font-bold tabular-nums text-rose-500 mt-0.5">
                  {openBugs}
                </p>
                <span className="text-[10px] text-muted-foreground">Aktif</span>
              </div>
              <div>
                <p className="text-[11px] font-medium text-muted-foreground">Critical</p>
                <p className="font-mono text-base sm:text-lg font-bold tabular-nums text-rose-600 dark:text-rose-400 mt-0.5">
                  {criticalBugs}
                </p>
                <span className="text-[10px] text-muted-foreground">Prioritas</span>
              </div>
              <div>
                <p className="text-[11px] font-medium text-muted-foreground">Overdue</p>
                <p className="font-mono text-base sm:text-lg font-bold tabular-nums text-amber-500 mt-0.5">
                  {overdueBugs}
                </p>
                <span className="text-[10px] text-muted-foreground">≥7 hari</span>
              </div>
            </div>

            {/* Bottom Ledger Line */}
            <div className="px-5 pb-3 pt-1">
              <div
                className="flex h-1.5 w-full overflow-hidden rounded-full bg-secondary gap-0.5"
                role="progressbar"
                aria-valuenow={stats.overallProgress}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                {ledgerPassed > 0 && (
                  <SimpleTooltip content={<span className="font-mono text-xs">Passed: {ledgerPassed} kasus</span>}>
                    <span
                      className="bg-emerald-500 h-full cursor-pointer hover:opacity-85 transition-opacity"
                      style={{ width: `${(ledgerPassed / ledgerTotal) * 100}%` }}
                    />
                  </SimpleTooltip>
                )}
                {ledgerFailed > 0 && (
                  <SimpleTooltip content={<span className="font-mono text-xs">Failed: {ledgerFailed} kasus</span>}>
                    <span
                      className="bg-rose-500 h-full cursor-pointer hover:opacity-85 transition-opacity"
                      style={{ width: `${(ledgerFailed / ledgerTotal) * 100}%` }}
                    />
                  </SimpleTooltip>
                )}
                {ledgerBlocked > 0 && (
                  <SimpleTooltip content={<span className="font-mono text-xs">Blocked: {ledgerBlocked} kasus</span>}>
                    <span
                      className="bg-amber-500 h-full cursor-pointer hover:opacity-85 transition-opacity"
                      style={{ width: `${(ledgerBlocked / ledgerTotal) * 100}%` }}
                    />
                  </SimpleTooltip>
                )}
                {ledgerNotRun > 0 && (
                  <SimpleTooltip content={<span className="font-mono text-xs">Not run: {ledgerNotRun} kasus</span>}>
                    <span
                      className="bg-zinc-500 h-full cursor-pointer hover:opacity-85 transition-opacity"
                      style={{ width: `${(ledgerNotRun / ledgerTotal) * 100}%` }}
                    />
                  </SimpleTooltip>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          ROW 3: OPERATIONAL TRIO (Yang Menahan Rilis, Radar Risiko Modul, Aktivitas QA Terbaru)
         ========================================================================= */}
      <DashboardQueuesAndRisks
        stats={stats}
        onOpenDetail={onOpenDetail}
        onModuleRiskClick={onModuleRiskClick}
        onNavigate={onNavigate}
      >
        <DashboardActivityTimeline
          activities={stats.recentActivities || []}
          onNavigate={onNavigate ? (tab) => onNavigate(tab) : undefined}
        />
      </DashboardQueuesAndRisks>

      {/* =========================================================================
          ROW 4: TEST CYCLE AKTIF (Full Width, below the trio)
         ========================================================================= */}
      {release?.testRunName && (
        <Card padding="none" className="overflow-hidden rounded-2xl border-border/80 bg-card shadow-xs">
          <CardHeader className="border-b border-border/60 p-4 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60 motion-reduce:animate-none" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-sm sm:text-base font-semibold text-foreground">
                    Test Cycle Aktif:
                  </CardTitle>
                  <span className="text-sm sm:text-base font-semibold text-primary truncate max-w-lg">
                    {release.testRunName}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Badge variant="outline" className="text-[11px] font-medium border-primary/30 text-primary">
                  {release.testRunStatus || 'IN PROGRESS'}
                </Badge>
                {onNavigate && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onNavigate('testRuns')}
                    className="gap-1.5 text-xs h-8 font-medium"
                  >
                    Lanjutkan Cycle Runner <ArrowUpRight className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-4 sm:p-5 flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between text-xs text-muted-foreground">
              <span className="font-mono tabular-nums">
                {release.completedCases} dari {release.totalCases} kasus dieksekusi ({release.progress}%)
              </span>
              <span className="font-mono tabular-nums">
                Total {release.totalCases} kasus
              </span>
            </div>

            {/* Progress bar */}
            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-secondary gap-0.5">
              {runSegments.map((segment) =>
                segment.value > 0 ? (
                  <SimpleTooltip
                    key={segment.label}
                    content={<span className="font-mono text-xs">{segment.label}: {segment.value} kasus</span>}
                  >
                    <span
                      className={cn(segment.color, 'h-full cursor-pointer hover:opacity-85 transition-opacity')}
                      style={{ width: `${(segment.value / runTotal) * 100}%` }}
                    />
                  </SimpleTooltip>
                ) : null
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-0.5 text-xs text-muted-foreground">
              <div className="flex flex-wrap items-center gap-4">
                {runSegments.map((seg) => (
                  <span key={seg.label} className="flex items-center gap-1.5 font-mono">
                    <span className={cn('h-2 w-2 rounded-full', seg.color)} />
                    <span>{seg.label}:</span>
                    <strong className="text-foreground">{seg.value}</strong>
                  </span>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* =========================================================================
          ROW 4: BUG FIX LIFECYCLE SUMMARY (If bug fixes exist)
         ========================================================================= */}
      {stats.bugFixTotal > 0 && (
        <Card padding="none" className="overflow-hidden rounded-2xl border-border/80 bg-card shadow-xs">
          <CardHeader className="border-b border-border/60 p-4 sm:px-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bug className="h-4 w-4 text-orange-500" />
                <CardTitle className="text-sm font-semibold text-foreground">
                  Siklus Hidup Bug Fix
                </CardTitle>
              </div>
              <span className="font-mono text-xs text-muted-foreground tabular-nums">
                Total {stats.bugFixTotal} bug tercatat
              </span>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4 sm:p-5">
            {[
              {
                label: 'Reported (Baru)',
                value: stats.bugFixReported,
                color: 'text-rose-500',
                surface: 'bg-rose-500/10 border-rose-500/20',
              },
              {
                label: 'Sedang Diperbaiki',
                value: stats.bugFixFixing,
                color: 'text-amber-500',
                surface: 'bg-amber-500/10 border-amber-500/20',
              },
              {
                label: 'Siap Uji Ulang',
                value: stats.bugFixReadyRetest,
                color: 'text-cyan-500',
                surface: 'bg-cyan-500/10 border-cyan-500/20',
              },
              {
                label: 'Selesai Terverifikasi',
                value: stats.bugFixFixed,
                color: 'text-emerald-500',
                surface: 'bg-emerald-500/10 border-emerald-500/20',
              },
            ].map((item) => {
              const isZero = item.value === 0;
              return (
                <div
                  key={item.label}
                  className={cn(
                    'rounded-xl border p-4 transition-colors',
                    isZero
                      ? 'border-border/60 bg-secondary/30 opacity-75'
                      : cn(item.surface, 'hover:shadow-xs')
                  )}
                >
                  <p
                    className={cn(
                      'font-mono text-2xl font-bold tabular-nums',
                      isZero ? 'text-muted-foreground/60' : item.color
                    )}
                  >
                    {item.value}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-muted-foreground">{item.label}</p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* =========================================================================
          ROW 5: MODULE TEST COVERAGE & PROGRESS
         ========================================================================= */}
      <DashboardModuleProgress
        stats={stats}
        modules={modules}
        selectedModuleFilter={selectedModuleFilter}
        setSelectedModuleFilter={setSelectedModuleFilter}
        expandedModules={expandedModules}
        setExpandedModules={setExpandedModules}
      />

      {/* =========================================================================
          ROW 6: TEST CASES PER PAGE (Tag Cloud with Expand/Collapse)
         ========================================================================= */}
      {stats.pageGroups.length > 0 && (
        <Card padding="none" className="overflow-hidden rounded-2xl border-border/80 bg-card shadow-xs">
          <CardHeader className="border-b border-border/60 p-4 sm:px-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Sebaran Kasus Berdasarkan Halaman Aplikasi
              </CardTitle>
              {stats.pageGroups.length > 16 && (
                <button
                  type="button"
                  onClick={() => setShowAllPages((prev) => !prev)}
                  className="text-xs font-medium text-primary hover:underline cursor-pointer active:scale-95 transition-transform duration-100"
                >
                  {showAllPages ? 'Tampilkan lebih sedikit' : `Tampilkan semua (${stats.pageGroups.length} halaman)`}
                </button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-wrap gap-2">
              {(showAllPages ? stats.pageGroups : stats.pageGroups.slice(0, 16)).map((pg) => (
                <div
                  key={pg.page}
                  className="flex items-center gap-1.5 rounded-lg border border-border/70 bg-secondary/40 px-2.5 py-1 text-xs font-medium text-foreground hover:bg-secondary/70 hover:border-border transition-all duration-150"
                >
                  <span>{pg.page}</span>
                  <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                    {pg._count.id}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
