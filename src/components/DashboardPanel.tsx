'use client';

import React from 'react';
import {
  AlertTriangle, BarChart3, Bug, CheckCircle2, ChevronDown, ChevronUp,
  Clock, HelpCircle, Layers, Percent, RefreshCw, XCircle, ShieldAlert
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
    failedCases: number;
    blockedCases: number;
    notRunCases: number;
    criticalBugs: number;
    openBugs: number;
    reason: string;
  };
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
  onNavigate?: (tab: 'testRuns' | 'reports') => void;
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
}: DashboardPanelProps) {
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
              <Button variant="ghost" size="sm" onClick={onRefresh} disabled={isLoading} className="h-7 px-2.5 gap-1.5 rounded-lg text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary transition">
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

        {stats.releaseReadiness && (
          <Card variant="majestic" className="border-border/40 bg-card shadow-sm">
            <CardHeader className="border-b border-border/40 pb-3">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><ShieldAlert className="h-4 w-4 text-primary" /> Release readiness</CardTitle>
                <Badge variant={stats.releaseReadiness.recommendation === 'READY' ? 'success' : stats.releaseReadiness.recommendation === 'NOT READY' ? 'failed' : 'warning'}>{stats.releaseReadiness.recommendation}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-5">
              <p className="text-sm font-semibold">{stats.releaseReadiness.testRunName || 'Belum ada Test Run aktif'}</p>
              <p className="text-xs text-muted-foreground">{stats.releaseReadiness.reason}</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {[
                  ['Failed', stats.releaseReadiness.failedCases],
                  ['Blocked', stats.releaseReadiness.blockedCases],
                  ['Not run', stats.releaseReadiness.notRunCases],
                  ['Critical bugs', stats.releaseReadiness.criticalBugs],
                  ['Open bugs', stats.releaseReadiness.openBugs],
                ].map(([label, value]) => <div key={String(label)} className="rounded-lg border border-border/50 bg-secondary/25 p-3"><p className="font-mono text-lg font-bold">{value}</p><p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p></div>)}
              </div>
              <div className="flex flex-wrap gap-2 border-t border-border/50 pt-3">
                {onNavigate && <Button size="sm" variant="outline" onClick={() => onNavigate('testRuns')}>Open Test Runs</Button>}
                {onNavigate && <Button size="sm" variant="ghost" onClick={() => onNavigate('reports')}>Open Reports</Button>}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-6">

            <DashboardStatsCards stats={stats} />



        {/* Visual Analytics Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
        </div>
      </motion.div>
    );
}
