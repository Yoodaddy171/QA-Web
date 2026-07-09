'use client';

import React from 'react';
import {
  AlertTriangle, BarChart3, Bug, CheckCircle2, ChevronDown, ChevronUp,
  Clock, HelpCircle, Layers, Percent, RefreshCw, XCircle, ShieldAlert
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
}

const getPriorityBadgeClass = (priority: string) => {
  switch (priority) {
    case 'Critical': return 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300';
    case 'High': return 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-500/25 dark:bg-orange-500/10 dark:text-orange-300';
    case 'Medium': return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300';
    case 'Low': return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300';
    default: return 'border-border bg-muted text-muted-foreground';
  }
};

const getAgeClass = (days: number) => {
  if (days >= 7) return 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300';
  if (days >= 3) return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300';
  return 'border-border bg-muted text-muted-foreground';
};

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
}: DashboardPanelProps) {
    const [retestAtBottom, setRetestAtBottom] = React.useState(false);
  const [bugAgingAtBottom, setBugAgingAtBottom] = React.useState(false);
  const [moduleRiskAtBottom, setModuleRiskAtBottom] = React.useState(false);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>, setter: (val: boolean) => void) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 5;
    setter(isAtBottom);
  };

  const statusDistribution = stats ? [
    { name: 'Done', value: stats.doneCount, color: '#10b981' },
    { name: 'Active', value: stats.inProgressCount, color: '#f59e0b' },
    { name: 'Blocked', value: stats.blockedCount, color: '#ec4899' },
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

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="space-y-6"
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
              <Button variant="ghost" size="sm" onClick={onRefresh} disabled={isLoading} className="h-7 px-2.5 gap-1.5 rounded-lg text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary transition-all">
                <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
              </Button>
            )}
          </div>
        )}

        {/* Overall Progress - Hero Card with readiness ring */}
        <Card>
          <CardContent className="p-6 sm:p-8">
            <div className="flex flex-col items-center gap-6 sm:flex-row sm:gap-10">
              {/* Animated readiness ring */}
              <div className="relative h-36 w-36 shrink-0 transition-transform duration-300 hover:scale-105 motion-reduce:hover:transform-none">
                {stats.overallProgress === 100 && <ConfettiBurst radius={72} />}
                <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
                  <circle cx="60" cy="60" r="52" fill="none" strokeWidth="10" className="stroke-secondary" />
                  <motion.circle
                    cx="60" cy="60" r="52" fill="none" strokeWidth="10" strokeLinecap="round"
                    className="stroke-primary"
                    strokeDasharray={2 * Math.PI * 52}
                    initial={{ strokeDashoffset: 2 * Math.PI * 52 }}
                    animate={{ strokeDashoffset: 2 * Math.PI * 52 * (1 - stats.overallProgress / 100) }}
                    transition={{ type: 'spring', stiffness: 60, damping: 18 }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <AnimatedNumber value={stats.overallProgress} suffix="%" className="text-3xl font-bold tracking-tight text-foreground tabular-nums" />
                  <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">verified</span>
                </div>
              </div>

              <div className="min-w-0 flex-1 space-y-3 text-center sm:text-left">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Project readiness
                </p>
                <p className="text-2xl font-semibold tracking-tight text-foreground">
                  <AnimatedNumber value={stats.doneCount} className="tabular-nums" /> dari {stats.totalTestCases} scenario terverifikasi
                </p>
                <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
                  {stats.failedCount > 0 && (
                    <Badge variant="failed" className="gap-1 text-[11px]"><XCircle className="h-3 w-3" /> {stats.failedCount} failed</Badge>
                  )}
                  {stats.blockedCount > 0 && (
                    <Badge variant="blocked" className="gap-1 text-[11px]"><AlertTriangle className="h-3 w-3" /> {stats.blockedCount} blocked</Badge>
                  )}
                  {stats.readyToRetestCount > 0 && (
                    <Badge variant="readyretest" className="gap-1 text-[11px]"><RefreshCw className="h-3 w-3" /> {stats.readyToRetestCount} retest</Badge>
                  )}
                  {stats.failedCount === 0 && stats.blockedCount === 0 && stats.readyToRetestCount === 0 && (
                    <Badge variant="success" className="gap-1 text-[11px]"><CheckCircle2 className="h-3 w-3" /> Tidak ada blocker</Badge>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">

            {/* Stats Cards - staggered spring pop-in */}
            <motion.div
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3"
              initial="hidden"
              animate="show"
              variants={{ show: { transition: { staggerChildren: 0.05 } } }}
            >
              {([
                { key: 'done', label: 'Done', value: stats.doneCount, icon: CheckCircle2, border: 'border-l-emerald-500', iconBg: 'bg-emerald-500/10 dark:bg-emerald-500/15', iconColor: 'text-emerald-600 dark:text-emerald-400' },
                { key: 'active', label: 'Active', value: stats.inProgressCount, icon: Clock, border: 'border-l-amber-500', iconBg: 'bg-amber-500/10 dark:bg-amber-500/15', iconColor: 'text-amber-600 dark:text-amber-400' },
                { key: 'blocked', label: 'Blocked', value: stats.blockedCount, icon: AlertTriangle, border: 'border-l-rose-500', iconBg: 'bg-rose-500/10 dark:bg-rose-500/15', iconColor: 'text-rose-600 dark:text-rose-400' },
                { key: 'backlog', label: 'Backlog', value: stats.notDoneCount, icon: XCircle, border: 'border-l-slate-400 dark:border-l-slate-500', iconBg: 'bg-secondary', iconColor: 'text-muted-foreground' },
                { key: 'failed', label: 'Failed', value: stats.failedCount, icon: XCircle, border: 'border-l-red-500', iconBg: 'bg-red-500/10 dark:bg-red-500/15', iconColor: 'text-red-600 dark:text-red-400' },
                { key: 'retest', label: 'Retest', value: stats.readyToRetestCount, icon: RefreshCw, border: 'border-l-cyan-500', iconBg: 'bg-cyan-500/10 dark:bg-cyan-500/15', iconColor: 'text-cyan-600 dark:text-cyan-400' },
                { key: 'tba', label: 'TBA', value: stats.tbaCount || 0, icon: HelpCircle, border: 'border-l-purple-500', iconBg: 'bg-purple-500/10 dark:bg-purple-500/15', iconColor: 'text-purple-600 dark:text-purple-400' },
              ] as const).map(({ key, label, value, icon: StatIcon, border, iconBg, iconColor }) => (
                <motion.div
                  key={key}
                  variants={{
                    hidden: { opacity: 0, y: 14, scale: 0.96 },
                    show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 320, damping: 24 } },
                  }}
                  whileHover={{ y: -3 }}
                  whileTap={{ scale: 0.97, rotate: -1 }}
                >
                  <Card variant="glass" padding="none" className={cn('group h-full border-l-4 transition-colors duration-300', border)}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className={cn('rounded-xl p-2.5 group-hover:scale-110 group-hover:-rotate-6 transition-transform duration-200 motion-reduce:group-hover:transform-none', iconBg)}>
                          <StatIcon className={cn('w-5 h-5', iconColor)} />
                        </div>
                        <div>
                          <AnimatedNumber value={value} className="block text-2xl font-bold text-foreground font-mono tabular-nums" />
                          <p className={cn('text-[10px] font-semibold uppercase tracking-wider', key === 'backlog' ? 'text-muted-foreground' : iconColor)}>{label}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </motion.div>

        {/* Visual Analytics Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Status Distribution */}
          <Card variant="majestic" className="border-border/40 hover:border-primary/20 shadow-sm transition-all duration-300 bg-card">
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
          <Card variant="majestic" className="border-border/40 hover:border-primary/20 shadow-sm transition-all duration-300 bg-card">
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
                { label: 'Open', value: stats.bugFixReported, color: 'text-orange-500', surface: 'bg-orange-500/10' },
                { label: 'Fixing', value: stats.bugFixFixing, color: 'text-amber-500', surface: 'bg-amber-500/10' },
                { label: 'Ready', value: stats.bugFixReadyRetest, color: 'text-cyan-500', surface: 'bg-cyan-500/10' },
                { label: 'Resolved', value: stats.bugFixFixed, color: 'text-emerald-500', surface: 'bg-emerald-500/10' },
              ].map((item) => (
                <div key={item.label} className={cn('rounded-xl border border-border/40 p-4', item.surface)}>
                  <p className={cn('font-mono text-2xl font-semibold', item.color)}>{item.value}</p>
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{item.label}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <Card variant="majestic" className="border-border/40 bg-card shadow-sm">
            <CardHeader className="border-b border-border/40 pb-3">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-cyan-500" />
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Antrian Retest</CardTitle>
              </div>
            </CardHeader>
            <CardContent
              className="group/scroll relative h-[330px] space-y-3 overflow-y-auto pt-4"
             
              onScroll={(event) => handleScroll(event, setRetestAtBottom)}
            >
              {(stats.retestQueue || []).length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-border/60 px-6 text-center">
                  <CheckCircle2 className="mb-3 h-8 w-8 text-emerald-500/50" />
                  <p className="text-xs font-semibold text-muted-foreground">Tidak ada test case yang menunggu retest.</p>
                </div>
              ) : (
                <>
                  {(stats.retestQueue || []).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onOpenDetail(item, stats.retestQueue)}
                      className="w-full rounded-xl border border-border/50 bg-secondary/30 p-3 text-left transition-colors hover:border-primary/30 hover:bg-secondary/60 focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-mono text-xs font-semibold text-foreground">{item.testCaseId}</p>
                          <p className="mt-1 truncate text-[10px] font-medium text-muted-foreground">{item.moduleName || item.page}</p>
                        </div>
                        <Badge variant="outline" className={getPriorityBadgeClass(item.priority)}>{item.priority}</Badge>
                      </div>
                      <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Menunggu {item.waitingDays} hari</p>
                    </button>
                  ))}
                  {(stats.retestQueue || []).length > 4 && !retestAtBottom && (
                    <p className="sticky bottom-0 bg-gradient-to-t from-card via-card to-transparent py-3 text-center text-[9px] font-bold uppercase tracking-wider text-primary">Scroll untuk lainnya</p>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card variant="majestic" className="border-border/40 bg-card shadow-sm">
            <CardHeader className="border-b border-border/40 pb-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-500" />
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Umur Bug</CardTitle>
              </div>
            </CardHeader>
            <CardContent
              className="group/scroll relative h-[330px] space-y-3 overflow-y-auto pt-4"
             
              onScroll={(event) => handleScroll(event, setBugAgingAtBottom)}
            >
              {(stats.bugAging || []).length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-border/60 px-6 text-center">
                  <ShieldAlert className="mb-3 h-8 w-8 text-amber-500/45" />
                  <p className="text-xs font-semibold text-muted-foreground">Tidak ada bug yang menua.</p>
                </div>
              ) : (
                <>
                  {(stats.bugAging || []).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onOpenDetail(item, stats.bugAging)}
                      className="w-full rounded-xl border border-border/50 bg-secondary/30 p-3 text-left transition-colors hover:border-primary/30 hover:bg-secondary/60 focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-mono text-xs font-semibold text-foreground">{item.testCaseId}</p>
                          <p className="mt-1 truncate text-[10px] font-medium text-muted-foreground">{item.testAction}</p>
                        </div>
                        <Badge variant="outline" className={getAgeClass(item.ageDays)}>{item.ageDays} hari</Badge>
                      </div>
                      <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-amber-500">{item.status}</p>
                    </button>
                  ))}
                  {(stats.bugAging || []).length > 4 && !bugAgingAtBottom && (
                    <p className="sticky bottom-0 bg-gradient-to-t from-card via-card to-transparent py-3 text-center text-[9px] font-bold uppercase tracking-wider text-primary">Scroll untuk lainnya</p>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card variant="majestic" className="border-border/40 bg-card shadow-sm">
            <CardHeader className="border-b border-border/40 pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-500" />
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Risiko per Module</CardTitle>
              </div>
            </CardHeader>
            <CardContent
              className="group/scroll relative h-[330px] space-y-3 overflow-y-auto pt-4"
             
              onScroll={(event) => handleScroll(event, setModuleRiskAtBottom)}
            >
              {(stats.moduleRisks || []).length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-border/60 px-6 text-center">
                  <Layers className="mb-3 h-8 w-8 text-muted-foreground/40" />
                  <p className="text-xs font-semibold text-muted-foreground">Belum ada data risiko module.</p>
                </div>
              ) : (
                <>
                  {(stats.moduleRisks || []).map((item) => (
                    <button
                      key={item.moduleId || 'ungrouped'}
                      type="button"
                      onClick={() => onModuleRiskClick?.(item)}
                      className="w-full rounded-xl border border-border/50 bg-secondary/30 p-3 text-left transition-colors hover:border-primary/30 hover:bg-secondary/60 focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-foreground">{item.moduleName}</p>
                          <p className="mt-1 text-[10px] font-medium text-muted-foreground">{item.total} test case</p>
                        </div>
                        <Badge variant="outline" className={getPriorityBadgeClass(item.riskScore >= 70 ? 'Critical' : item.riskScore >= 40 ? 'High' : item.riskScore >= 20 ? 'Medium' : 'Low')}>
                          Risiko {item.riskScore}
                        </Badge>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-semibold">
                        {item.failed > 0 && <span className="text-red-500">{item.failed} failed</span>}
                        {item.blocked > 0 && <span className="text-rose-500">{item.blocked} blocked</span>}
                        {item.readyToRetest > 0 && <span className="text-cyan-500">{item.readyToRetest} retest</span>}
                      </div>
                    </button>
                  ))}
                  {(stats.moduleRisks || []).length > 4 && !moduleRiskAtBottom && (
                    <p className="sticky bottom-0 bg-gradient-to-t from-card via-card to-transparent py-3 text-center text-[9px] font-bold uppercase tracking-wider text-primary">Scroll untuk lainnya</p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Module Progress */}
        {stats.moduleProgress.length > 0 && (
          <Card variant="majestic" className="border-border/40 shadow-sm bg-card">
            <CardHeader className="pb-3 border-b border-border/40">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-primary" />
                  <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Progress per Module</CardTitle>
                </div>
                <Select value={selectedModuleFilter} onValueChange={setSelectedModuleFilter}>
                  <SelectTrigger className="h-8 w-[160px] rounded-xl border border-border/50 bg-secondary/40 text-xs font-semibold">
                    <SelectValue placeholder="All Modules" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl bg-card border border-border/50 shadow-lg">
                    <SelectItem value="all" className="rounded-lg text-xs font-medium">All Modules</SelectItem>
                    {modules.map((m) => (
                      <SelectItem key={m.id} value={m.id} className="rounded-lg text-xs font-medium">{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-3">
                {(selectedModuleFilter === 'all'
                  ? [...stats.moduleProgress, ...(stats.ungroupedProgress ? [stats.ungroupedProgress] : [])]
                  : stats.moduleProgress.filter(m => m.id === selectedModuleFilter)
                ).map((mod) => {
                  const isExpanded = expandedModules.has(mod.id || 'ungrouped');
                  const toggleExpand = () => {
                    setExpandedModules(prev => {
                      const next = new Set(prev);
                      const key = mod.id || 'ungrouped';
                      if (next.has(key)) next.delete(key);
                      else next.add(key);
                      return next;
                    });
                  };
                  return (
                    <div key={mod.id || 'ungrouped'} className="rounded-xl border border-border/60 overflow-hidden">
                      <button onClick={toggleExpand} className="flex w-full items-center justify-between gap-4 p-4 text-left hover:bg-secondary/50 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                            <Layers className="h-4 w-4 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{mod.name}</p>
                            <p className="text-[11px] text-muted-foreground">{mod.totalCases} cases · {mod.totalMenus} menus</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <p className="text-lg font-bold text-foreground">{mod.avgProgress}%</p>
                          <div className="w-24 hidden sm:block"><Progress value={mod.avgProgress} className="h-2 bg-secondary" /></div>
                          {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                        </div>
                      </button>
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: 'easeInOut' }} className="border-t border-border/50 bg-secondary/20 overflow-hidden">
                            <Table>
                              <TableHeader>
                                <TableRow className="hover:bg-transparent border-border/50">
                                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground h-9">Page</TableHead>
                                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground h-9">Sub Menu</TableHead>
                                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground h-9 text-center">Cases</TableHead>
                                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground h-9 text-center">Progress</TableHead>
                                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground h-9">Status</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {mod.menus.map((mp, idx) => (
                                  <TableRow key={idx} className="hover:bg-secondary/50 border-border/30">
                                    <TableCell className="text-xs font-medium text-foreground py-3">{mp.page}</TableCell>
                                    <TableCell className="text-xs text-muted-foreground py-3">{mp.subMenu || '—'}</TableCell>
                                    <TableCell className="text-xs text-center font-medium text-foreground py-3">{mp.totalCases}</TableCell>
                                    <TableCell className="py-3">
                                      <div className="flex items-center justify-center gap-2">
                                        <Progress value={mp.progressPercent} className="h-1.5 w-16 bg-secondary" />
                                        <span className="text-[10px] font-semibold text-muted-foreground w-8">{mp.progressPercent}%</span>
                                      </div>
                                    </TableCell>
                                    <TableCell className="py-3">
                                      <div className="flex flex-wrap gap-1.5">
                                        {mp.doneCount > 0 && (<Badge className="gap-1 border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-700 shadow-none dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300"><CheckCircle2 className="w-3 h-3" /> {mp.doneCount}</Badge>)}
                                        {mp.inProgressCount > 0 && (<Badge className="gap-1 border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700 shadow-none dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300"><Clock className="w-3 h-3" /> {mp.inProgressCount}</Badge>)}
                                        {mp.notDoneCount > 0 && (<Badge className="gap-1 border-border bg-muted px-2 py-0.5 text-[10px] text-muted-foreground shadow-none"><XCircle className="w-3 h-3" /> {mp.notDoneCount}</Badge>)}
                                        {mp.blockedCount > 0 && (<Badge className="gap-1 border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] text-rose-700 shadow-none dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300"><AlertTriangle className="w-3 h-3" /> {mp.blockedCount}</Badge>)}
                                        {mp.failedCount > 0 && (<Badge className="gap-1 border-red-200 bg-red-50 px-2 py-0.5 text-[10px] text-red-700 shadow-none dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300"><XCircle className="w-3 h-3" /> {mp.failedCount}</Badge>)}
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

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
        </div>
      </motion.div>
    );
}
