'use client';

import React from 'react';
import {
  AlertTriangle, BarChart3, Bug, CheckCircle2, ChevronDown, ChevronUp,
  Clock, HelpCircle, Layers, Percent, RefreshCw, XCircle
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

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
  isLoading,
  lastRefreshed,
  onRefresh,
}: DashboardPanelProps) {
    if (!stats) return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-border bg-card elevation-1">
        <div className="text-center">
          <BarChart3 className="mx-auto mb-3 h-10 w-10 text-primary/50" />
          <p className="text-sm font-medium text-muted-foreground">Pilih project untuk melihat dashboard</p>
        </div>
      </div>
    );

    return (
      <div className="space-y-6">
        {/* Refresh indicator */}
        {(onRefresh || lastRefreshed) && (
          <div className="flex items-center justify-end gap-3">
            {lastRefreshed && (
              <span className="text-[11px] text-muted-foreground">
                Updated {lastRefreshed.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            {onRefresh && (
              <Button variant="ghost" size="sm" onClick={onRefresh} disabled={isLoading} className="h-7 gap-1.5 rounded-lg text-[11px] text-muted-foreground hover:text-foreground">
                <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
              </Button>
            )}
          </div>
        )}

        {/* Overall Progress - Hero Card */}
        <Card variant="glass" className="relative overflow-hidden border-primary/20">
          <div className="absolute top-0 right-0 p-8 opacity-[0.03]">
            <BarChart3 className="w-48 h-48" />
          </div>
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-chart-2 to-chart-5 rounded-t-2xl" />
          <CardContent className="p-8 relative z-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-3">
                <h3 className="text-primary font-semibold tracking-wide uppercase text-[11px]">Project Progress</h3>
                <div className="flex items-baseline gap-3">
                  <span className="text-5xl font-extrabold tracking-tight text-foreground">{stats.overallProgress}%</span>
                  <span className="text-muted-foreground text-sm font-medium">Completed</span>
                </div>
                <p className="text-muted-foreground text-sm max-w-sm leading-relaxed">
                  Verified <span className="text-primary font-semibold">{stats.doneCount}</span> of <span className="text-foreground font-semibold">{stats.totalTestCases}</span> test scenarios.
                </p>
              </div>
              <div className="flex-1 max-w-md w-full space-y-3">
                <Progress value={stats.overallProgress} className="h-3 bg-secondary rounded-full" />
                <div className="flex justify-between text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <span>Start</span>
                  <span>Midway</span>
                  <span>Complete</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards - Material Design filled cards */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
          {/* Done */}
          <Card variant="filled" padding="none" className="group hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-emerald-100 p-2.5 dark:bg-emerald-500/15 group-hover:scale-105 transition-transform">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.doneCount}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Done</p>
                </div>
              </div>
            </CardContent>
          </Card>
          {/* In Progress */}
          <Card variant="filled" padding="none" className="group hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-amber-100 p-2.5 dark:bg-amber-500/15 group-hover:scale-105 transition-transform">
                  <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.inProgressCount}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">Active</p>
                </div>
              </div>
            </CardContent>
          </Card>
          {/* Blocked */}
          <Card variant="filled" padding="none" className="group hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-rose-100 p-2.5 dark:bg-rose-500/15 group-hover:scale-105 transition-transform">
                  <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.blockedCount}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">Blocked</p>
                </div>
              </div>
            </CardContent>
          </Card>
          {/* Backlog */}
          <Card variant="filled" padding="none" className="group hover:bg-muted transition-colors">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-muted p-2.5 group-hover:scale-105 transition-transform">
                  <XCircle className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.notDoneCount}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Backlog</p>
                </div>
              </div>
            </CardContent>
          </Card>
          {/* Failed */}
          <Card variant="filled" padding="none" className="group hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-red-100 p-2.5 dark:bg-red-500/15 group-hover:scale-105 transition-transform">
                  <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.failedCount}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-red-600 dark:text-red-400">Failed</p>
                </div>
              </div>
            </CardContent>
          </Card>
          {/* Retest */}
          <Card variant="filled" padding="none" className="group hover:bg-cyan-50 dark:hover:bg-cyan-500/10 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-cyan-100 p-2.5 dark:bg-cyan-500/15 group-hover:scale-105 transition-transform">
                  <RefreshCw className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.readyToRetestCount}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">Retest</p>
                </div>
              </div>
            </CardContent>
          </Card>
          {/* TBA */}
          <Card variant="filled" padding="none" className="group hover:bg-sky-50 dark:hover:bg-sky-500/10 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-sky-100 p-2.5 dark:bg-sky-500/15 group-hover:scale-105 transition-transform">
                  <HelpCircle className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.tbaCount || 0}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-sky-600 dark:text-sky-400">TBA</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bug Fix Summary */}
        {stats.bugFixTotal > 0 && (
          <Card variant="majestic">
            <CardHeader className="pb-3 border-b border-border/50 mb-4">
              <div className="flex items-center gap-2">
                <Bug className="w-4 h-4 text-orange-500 dark:text-orange-400" />
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bug Fix Overview</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center group cursor-help">
                  <p className="text-3xl font-bold text-orange-600 dark:text-orange-400 group-hover:scale-105 transition-transform">{stats.bugFixReported}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-tight text-muted-foreground mt-1">Open</p>
                </div>
                <div className="text-center group cursor-help">
                  <p className="text-3xl font-bold text-amber-600 dark:text-amber-400 group-hover:scale-105 transition-transform">{stats.bugFixFixing}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-tight text-muted-foreground mt-1">Fixing</p>
                </div>
                <div className="text-center group cursor-help">
                  <p className="text-3xl font-bold text-cyan-600 dark:text-cyan-400 group-hover:scale-105 transition-transform">{stats.bugFixReadyRetest}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-tight text-muted-foreground mt-1">Ready</p>
                </div>
                <div className="text-center group cursor-help">
                  <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform">{stats.bugFixFixed}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-tight text-muted-foreground mt-1">Resolved</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* QA Readiness - 3 column grid */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          {/* Verification Pipeline */}
          <Card variant="majestic">
            <CardHeader className="pb-3 border-b border-border/50 mb-4">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-cyan-500 dark:text-cyan-400" />
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Verification Pipeline</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {(stats.retestQueue || []).length === 0 ? (
                <div className="rounded-xl border border-dashed border-border py-10 text-center text-xs text-muted-foreground font-medium">
                  Pipeline clear. No pending verifications.
                </div>
              ) : (
                (stats.retestQueue || []).map((item) => (
                  <div key={item.id} className="rounded-xl border border-border/60 bg-secondary/40 p-4 hover:bg-secondary/70 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-mono text-sm font-bold text-foreground">{item.testCaseId}</p>
                        <p className="truncate text-[11px] font-medium text-muted-foreground mt-0.5">
                          {item.moduleName || item.page} {item.subMenu ? `› ${item.subMenu}` : ''}
                        </p>
                      </div>
                      <Badge variant={item.priority === 'Critical' ? 'failed' : 'warning'} className="shadow-sm">
                        {item.priority}
                      </Badge>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-[10px]">
                      <span className="text-muted-foreground font-semibold uppercase tracking-wider">Queue Age</span>
                      <Badge variant="outline" className="text-foreground/70 border-border font-semibold">
                        {item.waitingDays} DAYS
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Bug Aging */}
          <Card variant="majestic">
            <CardHeader className="pb-3 border-b border-border/50 mb-4">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Defect Longevity</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {(stats.bugAging || []).length === 0 ? (
                <div className="rounded-xl border border-dashed border-border py-10 text-center text-xs text-muted-foreground font-medium">
                  No aging defects detected.
                </div>
              ) : (
                (stats.bugAging || []).map((item) => (
                  <div key={item.id} className="rounded-xl border border-border/60 bg-secondary/40 p-4 hover:bg-secondary/70 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-mono text-sm font-bold text-foreground">{item.testCaseId}</p>
                        <p className="truncate text-[11px] font-medium text-muted-foreground mt-0.5">
                          {item.moduleName || item.page} {item.subMenu ? `› ${item.subMenu}` : ''}
                        </p>
                      </div>
                      <Badge variant="outline" className={item.status === 'SEDANG DI FIX' ? 'border-amber-300 text-amber-700 bg-amber-50 dark:border-amber-500/30 dark:text-amber-400 dark:bg-amber-500/10' : 'border-orange-300 text-orange-700 bg-orange-50 dark:border-orange-500/30 dark:text-orange-400 dark:bg-orange-500/10'}>
                        {item.status === 'SEDANG DI FIX' ? 'Fixing' : 'Reported'}
                      </Badge>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-[10px]">
                      <span className="truncate pr-3 text-muted-foreground font-medium">{item.testAction}</span>
                      <Badge variant="outline" className={getAgeClass(item.ageDays)}>
                        {item.ageDays} DAYS
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Module Risk */}
          <Card variant="majestic">
            <CardHeader className="pb-3 border-b border-border/50 mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-500 dark:text-rose-400" />
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Module Risk</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {(stats.moduleRisks || []).length === 0 ? (
                <div className="rounded-xl border border-dashed border-border py-10 text-center text-xs text-muted-foreground font-medium">
                  No risk data available.
                </div>
              ) : (
                (stats.moduleRisks || []).map((item) => (
                  <div key={item.moduleId || 'ungrouped'} className="rounded-xl border border-border/60 bg-secondary/40 p-4 hover:bg-secondary/70 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-foreground">{item.moduleName}</p>
                        <p className="text-[11px] font-medium text-muted-foreground mt-0.5">
                          {item.total} cases
                        </p>
                      </div>
                      <Badge variant="outline" className={getPriorityBadgeClass(item.riskScore >= 70 ? 'Critical' : item.riskScore >= 40 ? 'High' : item.riskScore >= 20 ? 'Medium' : 'Low')}>
                        Risk: {item.riskScore}
                      </Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-[10px]">
                      {item.failed > 0 && <span className="text-red-600 dark:text-red-400 font-semibold">{item.failed} failed</span>}
                      {item.blocked > 0 && <span className="text-rose-600 dark:text-rose-400 font-semibold">{item.blocked} blocked</span>}
                      {item.readyToRetest > 0 && <span className="text-cyan-600 dark:text-cyan-400 font-semibold">{item.readyToRetest} retest</span>}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Module Progress */}
        {stats.moduleProgress.length > 0 && (
          <Card variant="majestic">
            <CardHeader className="pb-3 border-b border-border/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-primary" />
                  <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Module Progress</CardTitle>
                </div>
                <Select value={selectedModuleFilter} onValueChange={setSelectedModuleFilter}>
                  <SelectTrigger className="h-8 w-[160px] rounded-xl border-border/60 bg-secondary/50 text-xs">
                    <SelectValue placeholder="All modules" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="all" className="rounded-lg text-xs">All Modules</SelectItem>
                    {modules.map((m) => (
                      <SelectItem key={m.id} value={m.id} className="rounded-lg text-xs">{m.name}</SelectItem>
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
                      <button
                        onClick={toggleExpand}
                        className="flex w-full items-center justify-between gap-4 p-4 text-left hover:bg-secondary/50 transition-colors"
                      >
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
                          <div className="text-right">
                            <p className="text-lg font-bold text-foreground">{mod.avgProgress}%</p>
                          </div>
                          <div className="w-24 hidden sm:block">
                            <Progress value={mod.avgProgress} className="h-2 bg-secondary" />
                          </div>
                          {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="border-t border-border/50 bg-secondary/20">
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
                                      {mp.doneCount > 0 && (
                                        <Badge className="gap-1 border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-700 shadow-none dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                                          <CheckCircle2 className="w-3 h-3" /> {mp.doneCount}
                                        </Badge>
                                      )}
                                      {mp.inProgressCount > 0 && (
                                        <Badge className="gap-1 border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700 shadow-none dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
                                          <Clock className="w-3 h-3" /> {mp.inProgressCount}
                                        </Badge>
                                      )}
                                      {mp.notDoneCount > 0 && (
                                        <Badge className="gap-1 border-border bg-muted px-2 py-0.5 text-[10px] text-muted-foreground shadow-none">
                                          <XCircle className="w-3 h-3" /> {mp.notDoneCount}
                                        </Badge>
                                      )}
                                      {mp.blockedCount > 0 && (
                                        <Badge className="gap-1 border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] text-rose-700 shadow-none dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
                                          <AlertTriangle className="w-3 h-3" /> {mp.blockedCount}
                                        </Badge>
                                      )}
                                      {mp.failedCount > 0 && (
                                        <Badge className="gap-1 border-red-200 bg-red-50 px-2 py-0.5 text-[10px] text-red-700 shadow-none dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
                                          <XCircle className="w-3 h-3" /> {mp.failedCount}
                                        </Badge>
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
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
    );
}
