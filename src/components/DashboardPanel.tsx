'use client';

import React from 'react';
import {
  AlertTriangle, ArrowUpRight, BarChart3, Bug, CheckCircle2, ChevronDown, ChevronUp,
  Clock, HelpCircle, Layers, Percent, Play, RefreshCw, XCircle, ShieldAlert
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Collapse } from '@/components/ui/collapse';
import {
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip
} from 'recharts';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfettiBurst } from '@/components/ui/confetti-burst';
import { Progress } from '@/components/ui/progress';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { DashboardStatsCards } from '@/components/DashboardStatsCards';
import { DashboardQueuesAndRisks } from '@/components/DashboardQueuesAndRisks';
import { DashboardModuleProgress } from '@/components/DashboardModuleProgress';
import { DashboardActivityTimeline } from '@/components/DashboardActivityTimeline';
import { useIsMobile } from '@/hooks/use-mobile';

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
  const [showMobileInsights, setShowMobileInsights] = React.useState(false);
  const isMobile = useIsMobile();
  const showAdvancedInsights = !isMobile || showMobileInsights;
  const statusDistribution = stats ? [
    { name: 'Done', value: stats.doneCount, color: '#10b981' },
    { name: 'Active', value: stats.inProgressCount, color: '#6366f1' },
    { name: 'Blocked', value: stats.blockedCount, color: '#f59e0b' },
    { name: 'Failed', value: stats.failedCount, color: '#ef4444' },
    { name: 'Retest', value: stats.readyToRetestCount, color: '#06b6d4' },
    { name: 'TBA', value: stats.tbaCount || 0, color: '#8b5cf6' },
    { name: 'Backlog', value: stats.notDoneCount, color: '#64748b' },
  ].filter(item => item.value > 0) : [];

  if (!stats) return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-border bg-card elevation-1">
        <div className="text-center">
          <BarChart3 className="mx-auto mb-3 h-10 w-10 text-primary/50" />
          <p className="text-sm font-medium text-muted-foreground">Pilih project untuk melihat dashboard</p>
        </div>
      </div>
    );

    const release = stats.releaseReadiness;
    const overdueBugs = (stats.bugAging || []).filter(item => item.ageDays >= 7).length;
    const runTotal = Math.max(1, release?.totalCases || 0);
    const runSegments = release ? [
      { label: 'Passed', value: release.passedCases, color: 'bg-status-passed' },
      { label: 'Failed', value: release.failedCases, color: 'bg-status-failed' },
      { label: 'Blocked', value: release.blockedCases, color: 'bg-status-blocked' },
      { label: 'Not run', value: release.notRunCases, color: 'bg-status-not-run' },
    ] : [];

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="space-y-4"
      >
        {/* Refresh indicator */}
        {(onRefresh || lastRefreshed) && (
          <div className="flex items-center justify-end gap-3 bg-secondary/20 p-2 rounded-xl border border-border/30 max-w-fit ml-auto">
            {lastRefreshed && (
              <span className="text-[11px] font-semibold text-muted-foreground">
                Terakhir diperbarui: {lastRefreshed.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
            {onRefresh && (
              <Button variant="ghost" size="sm" onClick={onRefresh} disabled={isLoading} className="h-7 px-2.5 gap-1.5 rounded-lg text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary transition">
                <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} /> Muat ulang
              </Button>
            )}
          </div>
        )}

        {/* Release decision command surface */}
        <Card className="signal-surface border-primary/35 bg-card shadow-sm">
          <CardContent className="p-0">
            <div className="grid lg:grid-cols-[minmax(0,1.35fr)_minmax(360px,.65fr)]">
              <div className="flex flex-col gap-6 p-5 sm:flex-row sm:items-center sm:p-7">
                <div className="relative h-28 w-28 shrink-0">
                  {stats.overallProgress === 100 && <ConfettiBurst radius={56} />}
                  <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden="true">
                    <circle cx="60" cy="60" r="52" fill="none" strokeWidth="8" className="stroke-secondary" />
                    <motion.circle cx="60" cy="60" r="52" fill="none" strokeWidth="8" strokeLinecap="round" className="stroke-primary"
                      strokeDasharray={2 * Math.PI * 52}
                      initial={{ strokeDashoffset: 2 * Math.PI * 52 }}
                      animate={{ strokeDashoffset: 2 * Math.PI * 52 * (1 - stats.overallProgress / 100) }}
                      transition={{ type: 'spring', stiffness: 90, damping: 22 }} />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <AnimatedNumber value={stats.overallProgress} suffix="%" className="font-mono text-2xl font-bold tracking-tight text-foreground tabular-nums" />
                    <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">readiness</span>
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">Release decision</span>
                    {stats.releaseReadiness && <Badge variant={stats.releaseReadiness.recommendation === 'READY' ? 'success' : stats.releaseReadiness.recommendation === 'NOT READY' ? 'failed' : 'warning'}>{stats.releaseReadiness.recommendation}</Badge>}
                  </div>
                  <h2 className="text-balance text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                    {stats.releaseReadiness?.recommendation === 'NOT READY' ? 'Release belum siap' : stats.releaseReadiness?.recommendation === 'READY' ? 'Release siap diluncurkan' : 'Release siap dengan risiko'}
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                    {stats.releaseReadiness
                      ? `${stats.releaseReadiness.reason}. Status inventori saat ini: ${stats.failedCount} failed, ${stats.blockedCount} blocked.`
                      : `${stats.doneCount} dari ${stats.totalTestCases} skenario telah terverifikasi.`}
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {onNavigate && <Button size="sm" onClick={() => onNavigate('testRuns')} className="gap-2"><Play className="h-3.5 w-3.5" /> Buka run aktif</Button>}
                    {onNavigate && <Button size="sm" variant="outline" onClick={() => onNavigate('reports')} className="gap-2">Lihat report <ArrowUpRight className="h-3.5 w-3.5" /></Button>}
                    {stats.failedCount > 0 && <Button size="sm" variant="ghost" onClick={onOpenFailedCases || (() => onNavigate?.('testcases'))} className="text-red-500">Testcase gagal</Button>}
                    {onNavigate && stats.bugFixReported > 0 && <Button size="sm" variant="ghost" onClick={() => onNavigate('bugfix')} className="text-orange-500">Buka bugs</Button>}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 border-t border-border/60 bg-secondary/15 lg:border-l lg:border-t-0">
                {[
                  ['Failed in run', stats.releaseReadiness?.failedCases ?? 0, 'text-red-500'],
                  ['Blocked in run', stats.releaseReadiness?.blockedCases ?? 0, 'text-amber-500'],
                  ['Not run in run', stats.releaseReadiness?.notRunCases ?? 0, 'text-muted-foreground'],
                  ['Open bugs', stats.releaseReadiness?.openBugs ?? stats.bugFixReported, 'text-rose-500'],
                  ['Critical bugs', stats.releaseReadiness?.criticalBugs ?? 0, 'text-red-500'],
                  ['Overdue bugs', overdueBugs, 'text-bug-open'],
                ].map(([label, value, tone]) => (
                  <div key={String(label)} className="border-b border-r border-border/50 p-4 last:border-b-0 lg:[&:nth-last-child(-n+2)]:border-b-0">
                    <p className={cn('font-mono text-2xl font-semibold tabular-nums', tone)}>{value}</p>
                    <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {release?.testRunName && (
          <Card className="border-border/70 bg-card shadow-none">
            <CardContent className="p-4 sm:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                <div className="min-w-0 lg:w-64">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2" aria-hidden="true"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60 motion-reduce:animate-none" /><span className="relative inline-flex h-2 w-2 rounded-full bg-primary" /></span>
                    <span className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-primary">Test Run terbaru</span>
                  </div>
                  <p className="mt-1 truncate text-sm font-semibold text-foreground">{release.testRunName}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">{release.testRunStatus} · {release.completedCases}/{release.totalCases} executed</p>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex items-center justify-between text-[10px] font-semibold text-muted-foreground">
                    <span>Execution progress</span><span className="font-mono text-foreground">{release.progress}%</span>
                  </div>
                  <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }} className="flex h-2 origin-left overflow-hidden rounded-full bg-secondary" aria-label={`Test Run progress ${release.progress}%`}>
                    {runSegments.map(segment => segment.value > 0 ? <span key={segment.label} className={segment.color} style={{ width: `${(segment.value / runTotal) * 100}%` }} title={`${segment.label}: ${segment.value}`} /> : null)}
                  </motion.div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                    {runSegments.map(segment => <span key={segment.label} className="flex items-center gap-1.5 text-[10px] text-muted-foreground"><span className={cn('h-1.5 w-1.5 rounded-full', segment.color)} />{segment.label} <strong className="font-mono text-foreground">{segment.value}</strong></span>)}
                  </div>
                </div>
                {onNavigate && <Button size="sm" variant="outline" onClick={() => onNavigate('testRuns')} className="shrink-0 gap-2">Lanjutkan run <ArrowUpRight className="h-3.5 w-3.5" /></Button>}
              </div>
            </CardContent>
          </Card>
        )}

        <Button
          type="button"
          variant="outline"
          className="w-full justify-between md:hidden"
          aria-expanded={showMobileInsights}
          onClick={() => setShowMobileInsights(value => !value)}
        >
          {showMobileInsights ? 'Sembunyikan analitik lanjutan' : 'Tampilkan analitik lanjutan'}
          {showMobileInsights ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </Button>

        {showAdvancedInsights && <div className="space-y-4">

            <DashboardStatsCards stats={stats} />



        {/* Visual Analytics Charts */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Status Distribution */}
          <Card variant="majestic" className="border-border/40 hover:border-primary/20 shadow-sm transition duration-300 bg-card">
            <CardHeader className="pb-3 border-b border-border/40">
              <div className="flex items-center gap-2">
                <Percent className="w-4 h-4 text-primary" />
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Distribusi Skenario</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-6 h-[250px] flex items-center justify-center">
              <div className="w-full h-full flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex-1 h-[200px] relative w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={75}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {statusDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        content={({ active, payload }: any) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-card border border-border/80 p-2.5 rounded-xl shadow-xl text-xs font-semibold text-foreground">
                                <span className="flex items-center gap-1.5">
                                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: data.color }} />
                                  {data.name}: {data.value} cases
                                </span>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-3xl font-bold tracking-tight font-mono text-foreground">{stats.totalTestCases}</span>
                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Total</span>
                  </div>
                </div>
                {/* Custom Legend */}
                <div className="flex flex-col gap-1.5 min-w-[120px] text-[11px] font-semibold text-muted-foreground">
                  {statusDistribution.map((entry, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-3 py-0.5 border-b border-border/10 last:border-0">
                      <span className="flex items-center gap-1.5 text-foreground/80">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                        <span>{entry.name}</span>
                      </span>
                      <span className="font-mono text-foreground font-bold">{entry.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Priority Distribution */}
          <Card variant="majestic" className="border-border/40 hover:border-primary/20 shadow-sm transition duration-300 bg-card">
            <CardHeader className="pb-3 border-b border-border/40">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Kasus per Prioritas</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-6 h-[250px] flex items-center justify-center">
              <div className="w-full h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { name: 'Critical', count: stats.criticalCount || 0, fill: '#ef4444' },
                      { name: 'High', count: stats.highCount || 0, fill: '#f59e0b' },
                      { name: 'Medium', count: stats.mediumCount || 0, fill: '#06b6d4' },
                      { name: 'Low', count: stats.lowCount || 0, fill: '#10b981' },
                    ]}
                    margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
                  >
                    <XAxis dataKey="name" stroke="currentColor" className="text-muted-foreground text-[10px] font-semibold" tickLine={false} axisLine={false} />
                    <YAxis stroke="currentColor" className="text-muted-foreground text-[10px] font-mono" tickLine={false} axisLine={false} allowDecimals={false} />
                    <RechartsTooltip
                      cursor={{ fill: 'rgba(255, 255, 255, 0.05)', radius: 8 }}
                      content={({ active, payload }: any) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-card border border-border/80 p-2.5 rounded-xl shadow-xl text-xs font-semibold text-foreground">
                              <span className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: data.fill }} />
                                {data.name}: {data.count} cases
                              </span>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]} barSize={40}>
                      {[
                        { name: 'Critical', count: stats.criticalCount || 0, fill: '#ef4444' },
                        { name: 'High', count: stats.highCount || 0, fill: '#f59e0b' },
                        { name: 'Medium', count: stats.mediumCount || 0, fill: '#06b6d4' },
                        { name: 'Low', count: stats.lowCount || 0, fill: '#10b981' },
                      ].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        <DashboardActivityTimeline
          activities={stats.recentActivities || []}
          onNavigate={onNavigate ? (tab) => onNavigate(tab) : undefined}
        />

        {stats.bugFixTotal > 0 && (
          <Card variant="majestic" className="border-border/40 bg-card shadow-sm">
            <CardHeader className="border-b border-border/40 pb-3">
              <div className="flex items-center gap-2">
                <Bug className="h-4 w-4 text-orange-500" />
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ringkasan Bug Fix</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 pt-5 sm:grid-cols-4">
              {[
                { label: 'Open', value: stats.bugFixReported, color: 'text-bug-open', surface: 'bg-bug-open/10' },
                { label: 'Fixing', value: stats.bugFixFixing, color: 'text-bug-fixing', surface: 'bg-bug-fixing/10' },
                { label: 'Ready', value: stats.bugFixReadyRetest, color: 'text-bug-ready', surface: 'bg-bug-ready/10' },
                { label: 'Resolved', value: stats.bugFixFixed, color: 'text-bug-fixed', surface: 'bg-bug-fixed/10' },
              ].map((item) => (
                <div key={item.label} className={cn('rounded-xl border border-border/40 p-4', item.surface)}>
                  <p className={cn('font-mono text-2xl font-semibold', item.color)}>{item.value}</p>
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{item.label}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <DashboardQueuesAndRisks
          stats={stats}
          onOpenDetail={onOpenDetail}
          onModuleRiskClick={onModuleRiskClick}
        />

        <DashboardModuleProgress stats={stats} modules={modules} selectedModuleFilter={selectedModuleFilter} setSelectedModuleFilter={setSelectedModuleFilter} expandedModules={expandedModules} setExpandedModules={setExpandedModules} />

        {/* Page Groups */}
        {stats.pageGroups.length > 0 && (
          <Card variant="majestic">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Test Cases per Page</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {stats.pageGroups.map((pg) => (
                  <Badge key={pg.page} variant="outline" className="text-[11px] font-medium py-1.5 px-3 bg-secondary/50 border-border/60 text-foreground rounded-xl">
                    {pg.page}: {pg._count.id}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
        </div>}
      </motion.div>
    );
}
