'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Bug, CheckCircle2, Clock, Eye, RefreshCw, Search, Settings2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

type BugFixColumnKey = 'subMenu' | 'action' | 'priority' | 'status' | 'reportedAt' | 'timing';

const BUGFIX_COLUMN_OPTIONS: Array<{ key: BugFixColumnKey; label: string; responsiveClass?: string }> = [
  { key: 'subMenu', label: 'Sub Menu', responsiveClass: 'hidden lg:table-cell' },
  { key: 'action', label: 'Test Action', responsiveClass: 'hidden md:table-cell' },
  { key: 'priority', label: 'Priority', responsiveClass: 'hidden sm:table-cell' },
  { key: 'status', label: 'Status' },
  { key: 'reportedAt', label: 'Dilaporkan', responsiveClass: 'hidden xl:table-cell' },
  { key: 'timing', label: 'Timing', responsiveClass: 'hidden lg:table-cell' },
];

const DEFAULT_BUGFIX_COLUMNS = BUGFIX_COLUMN_OPTIONS.reduce<Record<BugFixColumnKey, boolean>>((columns, option) => {
  columns[option.key] = true;
  return columns;
}, {} as Record<BugFixColumnKey, boolean>);

const BUGFIX_COLUMN_STORAGE_KEY = 'qaDesk.bugFixTable.columns.v1';

const getInitialBugFixColumns = () => {
  if (typeof window === 'undefined') return DEFAULT_BUGFIX_COLUMNS;
  try {
    const stored = window.localStorage.getItem(BUGFIX_COLUMN_STORAGE_KEY);
    if (!stored) return DEFAULT_BUGFIX_COLUMNS;
    return { ...DEFAULT_BUGFIX_COLUMNS, ...JSON.parse(stored) as Partial<Record<BugFixColumnKey, boolean>> };
  } catch {
    return DEFAULT_BUGFIX_COLUMNS;
  }
};

export interface BugFixItem {
  id: string;
  sourceTestCaseId: string;
  testCaseId: string;
  projectId: string;
  page: string;
  subMenu?: string | null;
  testType: string;
  testAction: string;
  steps: string;
  expectedResult: string;
  actualResult: string;
  priority: string;
  moduleId?: string | null;
  status: string;
  reportedAt: string | null;
  fixingAt: string | null;
  readyAt: string | null;
  fixedAt: string | null;
  createdAt: string;
  updatedAt: string;
  module?: { id: string; name: string } | null;
}

interface Module {
  id: string;
  name: string;
  projectId: string;
  _count?: { testCases: number };
}

interface BugFixStats {
  bugFixReported: number;
  bugFixFixing: number;
  bugFixReadyRetest: number;
  bugFixFixed: number;
}

interface BugFixPanelProps {
  selectedProject: string;
  modules: Module[];
  hasUnassignedModule: boolean;
  stats: BugFixStats | null;
  visibleBugFixItems: BugFixItem[];
  bugFixSearch: string;
  bugFixFilterStatus: string;
  bugFixFilterModule: string;
  bugFixTab: 'active' | 'resolved';
  setBugFixSearch: (value: string) => void;
  setBugFixFilterStatus: (value: string) => void;
  setBugFixFilterModule: (value: string) => void;
  setBugFixTab: (value: 'active' | 'resolved') => void;
  getPriorityColor: (priority: string) => string;
  onStatusChange: (bugFixId: string, status: string) => void;
  onOpenDetail: (bugFix: BugFixItem) => void;
}

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
};

const getBugFixStatusColor = (status: string) => {
  switch (status) {
    case 'SUDAH DILAPORKAN': return 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-400 font-semibold';
    case 'SEDANG DI FIX': return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400 font-semibold';
    case 'READY TO RETEST': return 'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-500/20 dark:bg-cyan-500/10 dark:text-cyan-400 font-semibold';
    case 'VERIFIED & FIXED': return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400 font-semibold';
    default: return 'border-border/60 bg-muted text-muted-foreground font-semibold';
  }
};

export function BugFixPanel({
  selectedProject,
  modules,
  hasUnassignedModule,
  stats,
  visibleBugFixItems,
  bugFixSearch,
  bugFixFilterStatus,
  bugFixFilterModule,
  bugFixTab,
  setBugFixSearch,
  setBugFixFilterStatus,
  setBugFixFilterModule,
  setBugFixTab,
  getPriorityColor,
  onStatusChange,
  onOpenDetail,
}: BugFixPanelProps) {
  const [visibleColumns, setVisibleColumns] = useState<Record<BugFixColumnKey, boolean>>(getInitialBugFixColumns);
  const isColumnVisible = (key: BugFixColumnKey) => visibleColumns[key];
  const getColumnClass = (key: BugFixColumnKey, baseClass = '') => {
    const option = BUGFIX_COLUMN_OPTIONS.find((column) => column.key === key);
    return cn(!isColumnVisible(key) && 'hidden', isColumnVisible(key) && option?.responsiveClass, baseClass);
  };

  useEffect(() => {
    window.localStorage.setItem(BUGFIX_COLUMN_STORAGE_KEY, JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  if (!selectedProject) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-border/50 bg-card shadow-sm">
        <div className="text-center">
          <Bug className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30 animate-pulse" />
          <p className="text-sm font-semibold text-muted-foreground">Select a project to view bug tracking</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="min-w-0 space-y-6 overflow-x-hidden"
    >
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Card variant="glass" padding="none" className="group border-l-4 border-l-orange-500 hover:bg-orange-500/[0.03] transition-all duration-300">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-orange-500/10 p-2.5 dark:bg-orange-500/15 group-hover:scale-105 transition-transform duration-300">
                  <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <AnimatedNumber value={stats.bugFixReported} className="block text-2xl font-bold text-foreground font-mono tabular-nums" />
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-orange-650 dark:text-orange-400">Reported</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card variant="glass" padding="none" className="group border-l-4 border-l-amber-500 hover:bg-amber-500/[0.03] transition-all duration-300">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-amber-500/10 p-2.5 dark:bg-amber-500/15 group-hover:scale-105 transition-transform duration-300">
                  <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <AnimatedNumber value={stats.bugFixFixing} className="block text-2xl font-bold text-foreground font-mono tabular-nums" />
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-650 dark:text-amber-400">Fixing</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card variant="glass" padding="none" className="group border-l-4 border-l-cyan-500 hover:bg-cyan-500/[0.03] transition-all duration-300">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-cyan-500/10 p-2.5 dark:bg-cyan-500/15 group-hover:scale-105 transition-transform duration-300">
                  <RefreshCw className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                </div>
                <div>
                  <AnimatedNumber value={stats.bugFixReadyRetest} className="block text-2xl font-bold text-foreground font-mono tabular-nums" />
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-cyan-650 dark:text-cyan-400">Ready</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card variant="glass" padding="none" className="group border-l-4 border-l-emerald-500 hover:bg-emerald-500/[0.03] transition-all duration-300">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-emerald-500/10 p-2.5 dark:bg-emerald-500/15 group-hover:scale-105 transition-transform duration-300">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <AnimatedNumber value={stats.bugFixFixed} className="block text-2xl font-bold text-foreground font-mono tabular-nums" />
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-650 dark:text-emerald-400">Fixed</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex min-w-0 flex-col items-start justify-between gap-4 rounded-2xl border border-border/40 bg-card p-4 shadow-sm lg:flex-row lg:items-center">
        <Tabs
          value={bugFixTab}
          onValueChange={(v) => setBugFixTab(v as 'active' | 'resolved')}
          className="w-full sm:w-auto"
        >
          <TabsList className="h-10 rounded-xl border border-border/50 bg-secondary/35 p-1 shadow-inner">
            <TabsTrigger value="active" className="gap-2 rounded-lg px-4 text-[11px] font-semibold uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">
              <Bug className="w-3.5 h-3.5" /> Active Bugs
            </TabsTrigger>
            <TabsTrigger value="resolved" className="gap-2 rounded-lg px-4 text-[11px] font-semibold uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">
              <CheckCircle2 className="w-3.5 h-3.5" /> Fixed History
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:w-auto xl:grid-cols-5">
          <Badge variant="outline" className="h-9.5 justify-center rounded-xl border border-border/50 bg-muted/60 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Showing {visibleBugFixItems.length} data
          </Badge>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9.5 justify-center rounded-xl border border-border/50 bg-secondary/35 text-[10px] font-semibold uppercase tracking-wider text-foreground hover:bg-secondary/65 transition-all">
                <Settings2 className="h-3.5 w-3.5 text-primary" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 rounded-xl bg-card border border-border/50 shadow-lg text-foreground">
              <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-3 py-2">Table Columns</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-border/40" />
              {BUGFIX_COLUMN_OPTIONS.map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.key}
                  checked={visibleColumns[column.key]}
                  onCheckedChange={(checked) => setVisibleColumns((current) => ({ ...current, [column.key]: Boolean(checked) }))}
                  className="text-xs font-semibold rounded-lg mx-1 my-0.5"
                >
                  {column.label}
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator className="bg-border/40" />
              <DropdownMenuItem onClick={() => setVisibleColumns(DEFAULT_BUGFIX_COLUMNS)} className="text-xs font-bold rounded-lg mx-1 my-0.5">
                Reset columns
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
            <Input
              placeholder="Search bugs..."
              value={bugFixSearch}
              onChange={(e) => setBugFixSearch(e.target.value)}
              className="h-9.5 rounded-xl border border-border/50 bg-secondary/35 pl-9 text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/20 text-xs font-medium"
            />
          </div>
          <Select value={bugFixFilterModule} onValueChange={setBugFixFilterModule}>
            <SelectTrigger className="h-9.5 w-full rounded-xl border border-border/50 bg-secondary/35 text-foreground sm:w-[180px] text-xs font-semibold hover:bg-secondary/65 transition-all duration-200">
              <SelectValue placeholder="Filter module" />
            </SelectTrigger>
            <SelectContent className="rounded-xl bg-card border border-border/50 shadow-lg">
              <SelectItem value="all" className="rounded-lg text-xs font-medium">All Modules</SelectItem>
              {modules.map((module) => (
                <SelectItem key={module.id} value={module.id} className="rounded-lg text-xs font-medium">{module.name}</SelectItem>
              ))}
              {hasUnassignedModule && (
                <SelectItem value="unassigned" className="rounded-lg text-xs font-medium">No Module</SelectItem>
              )}
            </SelectContent>
          </Select>
          {bugFixTab === 'active' && (
            <Select value={bugFixFilterStatus} onValueChange={setBugFixFilterStatus}>
              <SelectTrigger className="h-9.5 w-full rounded-xl border border-border/50 bg-secondary/35 text-foreground sm:w-[180px] text-xs font-semibold hover:bg-secondary/65 transition-all duration-200"><SelectValue placeholder="Filter status" /></SelectTrigger>
              <SelectContent className="rounded-xl bg-card border border-border/50 shadow-lg">
                <SelectItem value="all" className="rounded-lg text-xs font-medium">All Status</SelectItem>
                <SelectItem value="SUDAH DILAPORKAN" className="rounded-lg text-xs font-medium">Reported</SelectItem>
                <SelectItem value="SEDANG DI FIX" className="rounded-lg text-xs font-medium">Fixing</SelectItem>
                <SelectItem value="READY TO RETEST" className="rounded-lg text-xs font-medium">Ready to Retest</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Table or Empty State */}
      {visibleBugFixItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center space-y-2 rounded-2xl border border-dashed border-border/60 bg-card p-20 shadow-sm text-center">
          <Bug className="w-12 h-12 text-muted-foreground/25 animate-pulse" />
          <p className="text-sm font-bold uppercase tracking-wider text-foreground">No Defects Found</p>
          <p className="text-xs text-muted-foreground/80 font-medium">No {bugFixTab === 'resolved' ? 'resolved defects' : 'active defects'} in this project.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/40 bg-card shadow-sm">
          <div className="overflow-hidden">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-secondary/95">
                <TableRow className="border-border/30 hover:bg-transparent">
                  <TableHead className="w-[52px] text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">No</TableHead>
                  <TableHead className="w-[90px] text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">TC ID</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Page</TableHead>
                  <TableHead className={getColumnClass('subMenu', 'text-[10px] font-semibold uppercase tracking-wider text-muted-foreground')}>Sub Menu</TableHead>
                  <TableHead className={getColumnClass('action', 'text-[10px] font-semibold uppercase tracking-wider text-muted-foreground')}>Test Action</TableHead>
                  <TableHead className={getColumnClass('priority', 'w-[94px] text-[10px] font-semibold uppercase tracking-wider text-muted-foreground')}>Priority</TableHead>
                  <TableHead className={getColumnClass('status', 'w-[150px] text-[10px] font-semibold uppercase tracking-wider text-muted-foreground')}>Status</TableHead>
                  <TableHead className={getColumnClass('reportedAt', 'w-[132px] text-[10px] font-semibold uppercase tracking-wider text-muted-foreground')}>Dilaporkan</TableHead>
                  {bugFixTab === 'resolved' ? (
                    <TableHead className={getColumnClass('timing', 'w-[132px] text-[10px] font-semibold uppercase tracking-wider text-muted-foreground')}>Fixed At</TableHead>
                  ) : (
                    <TableHead className={getColumnClass('timing', 'w-[132px] text-[10px] font-semibold uppercase tracking-wider text-muted-foreground')}>Di Fix / Retest</TableHead>
                  )}
                  <TableHead className="w-[80px] text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleBugFixItems.map((bf, index) => (
                  <TableRow
                    key={bf.id}
                    className="border-border/30 hover:bg-secondary/40 transition-colors group animate-in fade-in slide-in-from-bottom-2 fill-mode-backwards duration-300"
                    style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}
                  >
                    <TableCell className="text-center font-mono text-xs font-bold text-muted-foreground">{index + 1}</TableCell>
                    <TableCell className="font-mono text-sm font-bold text-foreground">{bf.testCaseId}</TableCell>
                    <TableCell className="text-sm font-medium text-foreground">{bf.page}</TableCell>
                    <TableCell className={getColumnClass('subMenu', 'text-muted-foreground text-[13px] font-semibold')}>{bf.subMenu || '-'}</TableCell>
                    <TableCell className={getColumnClass('action', 'max-w-[200px]')} title={bf.testAction}>
                      <p className="truncate text-sm text-muted-foreground group-hover:text-foreground transition-colors">{bf.testAction}</p>
                    </TableCell>
                    <TableCell className={getColumnClass('priority')}>
                      <Badge variant="outline" className={cn("text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 shadow-xs", getPriorityColor(bf.priority))}>
                        {bf.priority}
                      </Badge>
                    </TableCell>
                    <TableCell className={getColumnClass('status')}>
                      {bugFixTab === 'resolved' ? (
                        <Badge variant="success" className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5">
                          {bf.status}
                        </Badge>
                      ) : (
                        <Select value={bf.status} onValueChange={(val) => onStatusChange(bf.id, val)}>
                          <SelectTrigger className={cn("h-8 rounded-xl text-[9px] font-bold uppercase tracking-wider shadow-xs border transition-all", getBugFixStatusColor(bf.status))}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-2xl bg-card border border-border/50 shadow-lg text-foreground">
                            <SelectItem value="SUDAH DILAPORKAN" className="text-[9px] font-bold rounded-lg my-0.5 mx-1">DILAPORKAN</SelectItem>
                            <SelectItem value="SEDANG DI FIX" className="text-[9px] font-bold rounded-lg my-0.5 mx-1">SEDANG DI FIX</SelectItem>
                            <SelectItem value="READY TO RETEST" className="text-[9px] font-bold rounded-lg my-0.5 mx-1">READY TO RETEST</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell className={getColumnClass('reportedAt', 'text-[11px] font-semibold text-muted-foreground')}>{formatDate(bf.reportedAt)}</TableCell>
                    <TableCell className={getColumnClass('reportedAt', 'text-[11px] font-semibold text-muted-foreground')}>
                      {bugFixTab === 'resolved'
                        ? formatDate(bf.fixedAt)
                        : bf.status === 'READY TO RETEST'
                          ? formatDate(bf.readyAt)
                          : formatDate(bf.fixingAt)}
                    </TableCell>
                    <TableCell>
                      <Button
                        aria-label={`View bug ${bf.testCaseId}`}
                        title={`View bug ${bf.testCaseId}`}
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary/65 transition-all"
                        onClick={() => onOpenDetail(bf)}
                      >
                        <Eye className="w-4 h-4 text-primary" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </motion.div>
  );
}
