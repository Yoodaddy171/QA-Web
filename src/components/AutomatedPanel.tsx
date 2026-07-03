'use client';

import type React from 'react';
import { useEffect, useState } from 'react';
import { Bot, CalendarClock, Eye, FileClock, MonitorDot, RefreshCw, Search, Settings2, TerminalSquare } from 'lucide-react';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

type AutomatedColumnKey = 'module' | 'action' | 'type' | 'priority' | 'status' | 'lastRun' | 'source' | 'history';

const AUTOMATED_COLUMN_OPTIONS: Array<{ key: AutomatedColumnKey; label: string; responsiveClass?: string }> = [
  { key: 'module', label: 'Module', responsiveClass: 'hidden lg:table-cell' },
  { key: 'action', label: 'Test Action', responsiveClass: 'hidden md:table-cell' },
  { key: 'type', label: 'Tipe', responsiveClass: 'hidden xl:table-cell' },
  { key: 'priority', label: 'Priority', responsiveClass: 'hidden sm:table-cell' },
  { key: 'status', label: 'Status' },
  { key: 'lastRun', label: 'Last Run', responsiveClass: 'hidden xl:table-cell' },
  { key: 'source', label: 'Source', responsiveClass: 'hidden lg:table-cell' },
  { key: 'history', label: 'History', responsiveClass: 'hidden lg:table-cell' },
];

const DEFAULT_AUTOMATED_COLUMNS = AUTOMATED_COLUMN_OPTIONS.reduce<Record<AutomatedColumnKey, boolean>>((columns, option) => {
  columns[option.key] = true;
  return columns;
}, {} as Record<AutomatedColumnKey, boolean>);

const AUTOMATED_COLUMN_STORAGE_KEY = 'qaDesk.automatedTable.columns.v1';

const getInitialAutomatedColumns = () => {
  if (typeof window === 'undefined') return DEFAULT_AUTOMATED_COLUMNS;
  try {
    const stored = window.localStorage.getItem(AUTOMATED_COLUMN_STORAGE_KEY);
    if (!stored) return DEFAULT_AUTOMATED_COLUMNS;
    return { ...DEFAULT_AUTOMATED_COLUMNS, ...JSON.parse(stored) as Partial<Record<AutomatedColumnKey, boolean>> };
  } catch {
    return DEFAULT_AUTOMATED_COLUMNS;
  }
};

interface Module {
  id: string;
  name: string;
  projectId: string;
  _count?: { testCases: number };
}

interface Project {
  id: string;
  name: string;
  description?: string;
  automationContext?: string;
  createdAt: string;
  _count?: { testCases: number; modules: number };
}

export interface AutomatedTestCase {
  id: string;
  testCaseId: string;
  page: string;
  subMenu?: string | null;
  weight?: string | null;
  calculatedWeight?: number | null;
  testType: string;
  testAction: string;
  steps: string;
  expectedResult: string;
  actualResult?: string | null;
  stepLogs?: string | null;
  status: string;
  progress: number;
  remarks?: string | null;
  priority: string;
  projectId: string;
  moduleId?: string | null;
  project?: Project;
  module?: Module;
  createdAt: string;
  updatedAt: string;
  automationSource?: 'testcase' | 'bugfix';
  sourceTestCaseId?: string;
  automation: {
    hasCurrent: boolean;
    hasPrevious: boolean;
    hasLegacy: boolean;
    hasAutomationRun: boolean;
    hasManualCapture: boolean;
    totalBytes: number;
    lastRunAt: string | null;
    files: Array<{
      kind: 'current' | 'previous' | 'legacy';
      name: string;
      size: number;
      updatedAt: string;
    }>;
  };
}

interface AutomatedPanelProps {
  selectedProject: string;
  modules: Module[];
  items: AutomatedTestCase[];
  search: string;
  filterModule: string;
  loading: boolean;
  setSearch: (value: string) => void;
  setFilterModule: (value: string) => void;
  onRefresh: () => void;
  onOpenDetail: (testCase: AutomatedTestCase) => void;
  getStatusColor: (status: string) => string;
  getStatusIcon: (status: string) => React.ReactNode;
  getStatusBadgeVariant: (status: string) => 'success' | 'failed' | 'warning' | 'info' | 'notdone' | 'inprogress' | 'blocked' | 'readyretest' | 'verifiedfixed' | 'tba' | 'outline';
  getPriorityColor: (priority: string) => string;
  getTestTypeColor: (type: string) => string;
}

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
};

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

export function AutomatedPanel({
  selectedProject,
  modules,
  items,
  search,
  filterModule,
  loading,
  setSearch,
  setFilterModule,
  onRefresh,
  onOpenDetail,
  getStatusColor,
  getStatusIcon,
  getStatusBadgeVariant,
  getPriorityColor,
  getTestTypeColor,
}: AutomatedPanelProps) {
  const [visibleColumns, setVisibleColumns] = useState<Record<AutomatedColumnKey, boolean>>(getInitialAutomatedColumns);
  const moduleIdsWithRuns = new Set(items.map(item => item.moduleId).filter(Boolean));
  const availableModules = modules.filter(module => moduleIdsWithRuns.has(module.id) || module.id === filterModule);
  const hasUnassignedRuns = items.some((item) => !item.moduleId);
  const filteredItems = items.filter((item) => {
    if (filterModule !== 'all') {
      const moduleKey = item.moduleId || 'unassigned';
      if (moduleKey !== filterModule) return false;
    }

    const keyword = search.trim().toLowerCase();
    if (!keyword) return true;
    return [
      item.testCaseId,
      item.page,
      item.subMenu || '',
      item.testAction,
      item.module?.name || '',
      item.status,
    ].some((value) => value.toLowerCase().includes(keyword));
  });
  const showingLabel = filteredItems.length !== items.length
    ? `Showing ${filteredItems.length} of ${items.length} data`
    : `Showing ${filteredItems.length} data`;
  const isColumnVisible = (key: AutomatedColumnKey) => visibleColumns[key];
  const getColumnClass = (key: AutomatedColumnKey, baseClass = '') => {
    const option = AUTOMATED_COLUMN_OPTIONS.find((column) => column.key === key);
    return cn(!isColumnVisible(key) && 'hidden', isColumnVisible(key) && option?.responsiveClass, baseClass);
  };

  useEffect(() => {
    window.localStorage.setItem(AUTOMATED_COLUMN_STORAGE_KEY, JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  if (!selectedProject) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-border/50 bg-card shadow-sm">
        <div className="text-center">
          <Bot className="mx-auto mb-2 h-9 w-9 text-muted-foreground opacity-30 animate-pulse" />
          <p className="text-sm font-semibold text-muted-foreground">Select a project to view automation logs</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-5 overflow-x-hidden">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card variant="glass" padding="none" className="border-l-4 border-l-cyan-500 hover:bg-cyan-500/[0.03] transition-all duration-300">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-xl bg-cyan-500/10 p-2.5 text-cyan-600 dark:text-cyan-400 group-hover:scale-105 transition-transform duration-300">
              <MonitorDot className="h-5 w-5" />
            </div>
            <div>
              <AnimatedNumber value={filteredItems.length} className="block text-2xl font-bold text-foreground font-mono tabular-nums" />
              <p className="text-[10px] font-semibold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">Recorded Scenarios</p>
            </div>
          </CardContent>
        </Card>
        <Card variant="glass" padding="none" className="border-l-4 border-l-emerald-500 hover:bg-emerald-500/[0.03] transition-all duration-300">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-xl bg-emerald-500/10 p-2.5 text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform duration-300">
              <FileClock className="h-5 w-5" />
            </div>
            <div>
              <AnimatedNumber
                value={filteredItems.filter((item) => item.automation.hasManualCapture).length}
                className="block text-2xl font-bold text-foreground font-mono tabular-nums"
              />
              <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Manual Artifacts</p>
            </div>
          </CardContent>
        </Card>
        <Card variant="glass" padding="none" className="border-l-4 border-l-amber-500 hover:bg-amber-500/[0.03] transition-all duration-300">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-xl bg-amber-500/10 p-2.5 text-amber-600 dark:text-amber-400 group-hover:scale-105 transition-transform duration-300">
              <CalendarClock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground font-mono uppercase truncate max-w-[190px]">
                {filteredItems[0]?.automation.lastRunAt ? new Date(filteredItems[0].automation.lastRunAt).toLocaleDateString('id-ID', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'No Activity'}
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">Latest Run</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and action toolbar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border/40 bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row">
          <div className="relative min-w-0 flex-1 sm:max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
            <Input
              placeholder="Search test intelligence..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-9.5 rounded-xl border border-border/50 bg-secondary/35 pl-9 text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/20 text-xs font-medium"
            />
          </div>
          <Select value={filterModule} onValueChange={setFilterModule}>
            <SelectTrigger className="h-9.5 w-full rounded-xl border border-border/50 bg-secondary/35 text-xs font-semibold text-foreground hover:bg-secondary/65 transition-all duration-200 sm:w-[190px]">
              <SelectValue placeholder="Module" />
            </SelectTrigger>
            <SelectContent className="border border-border/50 bg-card shadow-lg">
              <SelectItem value="all" className="rounded-lg text-xs font-medium">All Modules</SelectItem>
              {availableModules.map((module) => (
                <SelectItem key={module.id} value={module.id} className="rounded-lg text-xs font-medium">{module.name}</SelectItem>
              ))}
              {(hasUnassignedRuns || filterModule === 'unassigned') && (
                <SelectItem value="unassigned" className="rounded-lg text-xs font-medium">No Module</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="h-9.5 justify-center rounded-xl border border-border/50 bg-muted/60 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {showingLabel}
          </Badge>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9.5 rounded-xl gap-2 font-bold border border-border/50 bg-secondary/35 text-foreground hover:bg-secondary/65 transition-all">
                <Settings2 className="h-3.5 w-3.5 text-primary" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 border border-border/50 bg-card rounded-2xl shadow-xl">
              <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-3 py-2">Table Columns</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-border/40" />
              {AUTOMATED_COLUMN_OPTIONS.map((column) => (
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
              <DropdownMenuItem onClick={() => setVisibleColumns(DEFAULT_AUTOMATED_COLUMNS)} className="text-xs font-bold rounded-lg mx-1 my-0.5">
                Reset columns
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading} className="h-9.5 rounded-xl gap-2 font-bold border border-border/50 bg-secondary/35 text-foreground hover:bg-secondary/65 transition-all">
            <RefreshCw className={`h-3.5 w-3.5 text-primary ${loading ? 'animate-spin' : ''}`} />
            Synchronize
          </Button>
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center space-y-2 rounded-2xl border border-dashed border-border/60 bg-card py-20 shadow-sm text-center">
          <TerminalSquare className="h-12 w-12 text-muted-foreground/25 animate-pulse" />
          <p className="text-sm font-bold uppercase tracking-wider text-foreground">
            {items.length === 0 ? 'Belum ada test record' : 'No Matching Results'}
          </p>
          <p className="max-w-md text-center text-[11px] font-medium text-muted-foreground/80">
            {items.length === 0
              ? 'Capture a manual or automated run from a test case DevLog, then synchronize this vault.'
              : 'Adjust the search or module filter to find another intelligence record.'}
          </p>
          {items.length === 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={loading}
              className="mt-3 h-9 gap-2 rounded-xl border-primary/30 bg-primary/10 px-4 text-[10px] font-semibold uppercase tracking-wider text-primary hover:bg-primary/15"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
              {loading ? 'Synchronizing' : 'Synchronize now'}
            </Button>
          )}
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
                    <TableHead className={getColumnClass('module', 'text-[10px] font-semibold uppercase tracking-wider text-muted-foreground')}>Module</TableHead>
                    <TableHead className={getColumnClass('action', 'text-[10px] font-semibold uppercase tracking-wider text-muted-foreground')}>Test Action</TableHead>
                    <TableHead className={getColumnClass('type', 'w-[86px] text-[10px] font-semibold uppercase tracking-wider text-muted-foreground')}>Type</TableHead>
                    <TableHead className={getColumnClass('priority', 'w-[94px] text-[10px] font-semibold uppercase tracking-wider text-muted-foreground')}>Priority</TableHead>
                    <TableHead className={getColumnClass('status', 'w-[112px] text-[10px] font-semibold uppercase tracking-wider text-muted-foreground')}>Status</TableHead>
                    <TableHead className={getColumnClass('lastRun', 'text-[10px] font-semibold uppercase tracking-wider text-muted-foreground')}>Last Run</TableHead>
                    <TableHead className={getColumnClass('source', 'text-[10px] font-semibold uppercase tracking-wider text-muted-foreground')}>Source</TableHead>
                    <TableHead className={getColumnClass('history', 'text-[10px] font-semibold uppercase tracking-wider text-muted-foreground')}>History</TableHead>
                    <TableHead className="w-[80px] text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item, index) => (
                    <TableRow key={item.id} className="border-border/30 hover:bg-secondary/40 transition-colors group">
                      <TableCell className="text-center font-mono text-xs font-bold text-muted-foreground">{index + 1}</TableCell>
                      <TableCell className="font-mono text-sm font-bold text-foreground">{item.testCaseId}</TableCell>
                      <TableCell>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-foreground">{item.page}</p>
                            {item.automationSource === 'bugfix' && (
                              <Badge variant="warning" className="text-[9px] font-semibold border-orange-500/20 bg-orange-500/10">
                                BUGFIX
                              </Badge>
                            )}
                          </div>
                          {item.subMenu && <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-tight">{item.subMenu}</p>}
                        </div>
                      </TableCell>
                      <TableCell className={getColumnClass('module', 'text-[13px] font-semibold text-muted-foreground')}>{item.module?.name || '-'}</TableCell>
                      <TableCell className={getColumnClass('action', 'max-w-[260px] truncate text-sm text-muted-foreground group-hover:text-foreground transition-colors')}>{item.testAction}</TableCell>
                      <TableCell className={getColumnClass('type')}>
                        <Badge variant="outline" className={cn("rounded-xl text-[10px] font-bold px-2.5 py-0.5", getTestTypeColor(item.testType))}>
                          {item.testType}
                        </Badge>
                      </TableCell>
                      <TableCell className={getColumnClass('priority')}>
                        <Badge variant="outline" className={cn("text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 shadow-xs", getPriorityColor(item.priority))}>
                          {item.priority}
                        </Badge>
                      </TableCell>
                      <TableCell className={getColumnClass('status')}>
                        <Badge variant={getStatusBadgeVariant(item.status)} className="gap-1 text-[10px] font-bold tracking-wide uppercase px-2.5 py-0.5 shadow-xs">
                          {getStatusIcon(item.status)} {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell className={getColumnClass('lastRun', 'text-[11px] font-semibold text-muted-foreground uppercase tracking-tighter')}>{formatDate(item.automation.lastRunAt)}</TableCell>
                      <TableCell className={getColumnClass('source')}>
                        <div className="flex flex-wrap gap-1">
                          {item.automation.hasAutomationRun && <Badge className="rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5">Auto</Badge>}
                          {item.automation.hasManualCapture && <Badge className="rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5">Manual</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className={getColumnClass('history')}>
                        <div className="flex flex-wrap gap-1 items-center">
                          {item.automation.hasCurrent && <Badge variant="success" className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5">Latest</Badge>}
                          {(item.automation.hasPrevious || item.automation.hasLegacy) && <Badge variant="info" className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5">History</Badge>}
                          <Badge variant="outline" className="rounded-xl border border-border/50 bg-secondary/35 text-[9px] font-mono font-semibold text-muted-foreground px-2 py-0.5">
                            {formatSize(item.automation.totalBytes)}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 rounded-xl p-0 text-muted-foreground hover:text-foreground hover:bg-secondary/65 transition-all"
                          onClick={() => onOpenDetail(item)}
                        >
                          <Eye className="h-4 w-4 text-primary" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
        </div>
      )}
    </div>
  );
}
