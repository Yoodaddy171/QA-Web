'use client';

import type React from 'react';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Bot, Eye, RefreshCw, Search, Settings2, TerminalSquare } from 'lucide-react';
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
import { AutomationStatsCards } from '@/components/AutomationStatsCards';

type AutomatedColumnKey = 'module' | 'action' | 'type' | 'priority' | 'status' | 'lastRun' | 'source' | 'history';

const AUTOMATED_COLUMN_OPTIONS: Array<{ key: AutomatedColumnKey; label: string; responsiveClass?: string }> = [
  { key: 'module', label: 'Module', responsiveClass: 'hidden lg:table-cell' },
  { key: 'action', label: 'Test Action', responsiveClass: 'hidden md:table-cell' },
  { key: 'type', label: 'Tipe', responsiveClass: 'hidden xl:table-cell' },
  { key: 'priority', label: 'Priority', responsiveClass: 'hidden sm:table-cell' },
  { key: 'status', label: 'Status' },
  { key: 'lastRun', label: 'Last Run', responsiveClass: 'hidden xl:table-cell' },
  { key: 'source', label: 'Source', responsiveClass: 'hidden 2xl:table-cell' },
  { key: 'history', label: 'History', responsiveClass: 'hidden 2xl:table-cell' },
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
  const deferredSearch = useDeferredValue(search);
  const moduleIdsWithRuns = useMemo(() => new Set(items.map(item => item.moduleId).filter(Boolean)), [items]);
  const availableModules = modules.filter(module => moduleIdsWithRuns.has(module.id) || module.id === filterModule);
  const hasUnassignedRuns = items.some((item) => !item.moduleId);
  const filteredItems = useMemo(() => items.filter((item) => {
    if (filterModule !== 'all') {
      const moduleKey = item.moduleId || 'unassigned';
      if (moduleKey !== filterModule) return false;
    }

    const keyword = deferredSearch.trim().toLowerCase();
    if (!keyword) return true;
    return [
      item.testCaseId,
      item.page,
      item.subMenu || '',
      item.testAction,
      item.module?.name || '',
      item.status,
    ].some((value) => value.toLowerCase().includes(keyword));
  }), [items, filterModule, deferredSearch]);
  const showingLabel = filteredItems.length !== items.length
    ? `Menampilkan ${filteredItems.length} dari ${items.length} data`
    : `Menampilkan ${filteredItems.length} data`;
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
          <p className="text-sm font-semibold text-muted-foreground">Pilih project untuk melihat test record</p>
        </div>
      </div>
    );
  }

  return (
    <div className="qa-module-page flex flex-col gap-5">
      <AutomationStatsCards
        total={filteredItems.length}
        manual={filteredItems.filter((item) => item.automation.hasManualCapture).length}
        lastRunAt={filteredItems[0]?.automation.lastRunAt}
      />



      {/* Filter and action toolbar */}
      <div className="qa-module-toolbar flex flex-col gap-3 rounded-xl border border-border bg-card p-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row">
          <div className="relative min-w-0 flex-1 sm:max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
            <Input
              placeholder="Cari test record..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-9"
              aria-label="Cari automation record"
            />
          </div>
          <Select value={filterModule} onValueChange={setFilterModule}>
            <SelectTrigger className="w-full sm:w-48">
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
          <Badge variant="outline" className="min-h-9 justify-center text-muted-foreground">
            {showingLabel}
          </Badge>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Settings2 className="h-3.5 w-3.5 text-primary" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 border border-border/50 bg-card rounded-2xl shadow-xl">
              <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-3 py-2">Kolom Tabel</DropdownMenuLabel>
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
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading} className="gap-2">
            <RefreshCw className={`h-3.5 w-3.5 text-primary ${loading ? 'animate-spin' : ''}`} />
            Sinkronkan
          </Button>
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card px-5 py-12 text-center">
          <TerminalSquare className="size-9 text-muted-foreground" />
          <p className="qa-module-heading">
            {items.length === 0 ? 'Belum ada test record' : 'Tidak ada hasil yang cocok'}
          </p>
          <p className="max-w-md text-center text-xs font-medium text-muted-foreground/80">
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
              className="mt-3 h-9 gap-2 rounded-xl border-primary/30 bg-primary/10 px-4 text-xs font-semibold uppercase tracking-wider text-primary hover:bg-primary/15"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
              {loading ? 'Menyinkronkan...' : 'Sinkronkan sekarang'}
            </Button>
          )}
        </div>
      ) : (
        <div className="relative rounded-xl border border-border bg-card">
              <Table className="qa-data-table w-full min-w-[720px] table-auto md:min-w-[1040px] xl:min-w-[1380px]"
                containerClassName="max-h-[70vh] overflow-auto rounded-t-xl focus-visible:outline-2 focus-visible:outline-ring"
                containerProps={{role:'region',tabIndex:0,'aria-label':'Tabel automation record','aria-describedby':'automation-scroll-help'}}>
                <TableHeader className="sticky top-0 z-10 bg-secondary/95">
                   <TableRow className="border-border/30 hover:bg-transparent">
                    <TableHead className="sticky left-0 z-20 w-10 bg-secondary/95 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">No</TableHead>
                    <TableHead className="sticky left-10 z-20 w-[130px] min-w-[130px] bg-secondary/95 text-xs font-semibold uppercase tracking-wider text-muted-foreground">TC ID</TableHead>
                    <TableHead className="w-[130px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">Page</TableHead>
                    <TableHead className={getColumnClass('module', 'w-[110px] text-xs font-semibold uppercase tracking-wider text-muted-foreground')}>Module</TableHead>
                    <TableHead className={getColumnClass('action', 'text-xs font-semibold uppercase tracking-wider text-muted-foreground')}>Test Action</TableHead>
                    <TableHead className={getColumnClass('type', 'w-[86px] text-xs font-semibold uppercase tracking-wider text-muted-foreground')}>Type</TableHead>
                    <TableHead className={getColumnClass('priority', 'w-[94px] text-xs font-semibold uppercase tracking-wider text-muted-foreground')}>Priority</TableHead>
                    <TableHead className={getColumnClass('status', 'w-[112px] text-xs font-semibold uppercase tracking-wider text-muted-foreground')}>Status</TableHead>
                    <TableHead className={getColumnClass('lastRun', 'w-[132px] text-xs font-semibold uppercase tracking-wider text-muted-foreground')}>Last Run</TableHead>
                    <TableHead className={getColumnClass('source', 'w-[100px] text-xs font-semibold uppercase tracking-wider text-muted-foreground')}>Source</TableHead>
                    <TableHead className={getColumnClass('history', 'w-[160px] text-xs font-semibold uppercase tracking-wider text-muted-foreground')}>History</TableHead>
                    <TableHead className="sticky right-0 z-20 w-[52px] bg-secondary/95 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item, index) => (
                    <TableRow
                      key={item.id}
                      className="group h-14 cursor-pointer border-border/30 transition-colors hover:bg-secondary/40"

                      title="Klik untuk melihat detail"
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest('button, a, input, select, [role="checkbox"], [role="combobox"], [role="menu"]')) return;
                        onOpenDetail(item);
                      }}
                    >
                      <TableCell className="sticky left-0 z-10 bg-card text-center font-mono text-xs font-bold text-muted-foreground group-hover:bg-secondary">{index + 1}</TableCell>
                      <TableCell className="sticky left-10 z-10 w-[130px] min-w-[130px] max-w-[130px] overflow-hidden whitespace-nowrap bg-card font-mono text-sm font-semibold text-foreground group-hover:bg-secondary">{item.testCaseId}</TableCell>
                      <TableCell className="max-w-[130px]" title={`${item.page}${item.subMenu ? ` / ${item.subMenu}` : ''}`}>
                        <div className="min-w-0">
                          <div className="flex min-w-0 items-center gap-2">
                            <p className="truncate text-sm font-bold text-foreground">{item.page}</p>
                            {item.automationSource === 'bugfix' && (
                              <Badge variant="warning" className="text-xs font-semibold border-orange-500/20 bg-orange-500/10">
                                BUGFIX
                              </Badge>
                            )}
                          </div>
                          {item.subMenu && <p className="truncate text-xs font-medium uppercase text-muted-foreground">{item.subMenu}</p>}
                        </div>
                      </TableCell>
                      <TableCell className={getColumnClass('module', 'max-w-[110px] truncate text-[13px] font-medium text-muted-foreground')} title={item.module?.name || ''}>{item.module?.name || '-'}</TableCell>
                      <TableCell className={getColumnClass('action', 'min-w-[240px] max-w-[320px]')} title={item.testAction}>
                        <p className="line-clamp-2 text-sm leading-5 text-foreground">{item.testAction}</p>
                      </TableCell>
                      <TableCell className={getColumnClass('type')}>
                        <Badge variant="outline" className={cn("rounded-xl text-xs font-bold px-2.5 py-0.5", getTestTypeColor(item.testType))}>
                          {item.testType}
                        </Badge>
                      </TableCell>
                      <TableCell className={getColumnClass('priority')}>
                        <Badge variant="outline" className={cn("text-xs font-bold tracking-wide uppercase px-2 py-0.5 shadow-xs", getPriorityColor(item.priority))}>
                          {item.priority}
                        </Badge>
                      </TableCell>
                      <TableCell className={getColumnClass('status', 'min-w-[160px] whitespace-nowrap')}>
                        <Badge variant={getStatusBadgeVariant(item.status)} className="gap-1 text-xs font-bold tracking-wide uppercase px-2.5 py-0.5 shadow-xs">
                          {getStatusIcon(item.status)} {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell className={getColumnClass('lastRun', 'min-w-[172px] whitespace-nowrap text-xs tabular-nums text-muted-foreground')}>{formatDate(item.automation.lastRunAt)}</TableCell>
                      <TableCell className={getColumnClass('source')}>
                        <div className="flex flex-wrap gap-1">
                          {item.automation.hasAutomationRun && <Badge className="rounded-xl bg-indigo-500/10 text-status-in-progress border border-indigo-500/20 text-xs font-bold uppercase tracking-wider px-2 py-0.5">Auto</Badge>}
                          {item.automation.hasManualCapture && <Badge className="rounded-xl bg-teal-500/10 text-bug-fixed border border-teal-500/20 text-xs font-bold uppercase tracking-wider px-2 py-0.5">Manual</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className={getColumnClass('history')}>
                        <div className="flex flex-wrap gap-1 items-center">
                          {item.automation.hasCurrent && <Badge variant="success" className="text-xs font-bold uppercase tracking-wider px-2 py-0.5">Latest</Badge>}
                          {(item.automation.hasPrevious || item.automation.hasLegacy) && <Badge variant="info" className="text-xs font-bold uppercase tracking-wider px-2 py-0.5">History</Badge>}
                          <Badge variant="outline" className="rounded-xl border border-border/50 bg-secondary/35 text-xs font-mono font-semibold text-muted-foreground px-2 py-0.5">
                            {formatSize(item.automation.totalBytes)}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="sticky right-0 z-10 bg-card group-hover:bg-secondary">
                        <Button
                          aria-label={`View run ${item.testCaseId}`}
                          title={`View run ${item.testCaseId}`}
                          variant="ghost"
                          size="sm"
                          className="size-9 rounded-lg p-0 text-muted-foreground hover:bg-secondary hover:text-foreground"
                          onClick={() => onOpenDetail(item)}
                        >
                          <Eye className="h-4 w-4 text-primary" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p id="automation-scroll-help" className="qa-table-scroll-help">Geser tabel untuk melihat metadata lainnya. ID dan aksi tetap terlihat.</p>
        </div>
      )}
    </div>
  );
}
