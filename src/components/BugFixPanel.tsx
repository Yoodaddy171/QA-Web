'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Bug, CheckCircle2, Clock, Eye, RefreshCw, Search, Settings2 } from 'lucide-react';
import { motion } from 'framer-motion';
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
    case 'SUDAH DILAPORKAN': return 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-500/25 dark:bg-orange-500/10 dark:text-orange-300';
    case 'SEDANG DI FIX': return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300';
    case 'READY TO RETEST': return 'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-500/25 dark:bg-cyan-500/10 dark:text-cyan-300';
    case 'VERIFIED & FIXED': return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300';
    default: return 'border-border bg-muted text-muted-foreground';
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
      <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-border bg-card elevation-1">
        <div className="text-center">
          <Bug className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm font-medium text-muted-foreground">Select a project to view bugs</p>
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
          <Card variant="filled" padding="none" className="group hover:bg-orange-50 dark:hover:bg-orange-500/10 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-orange-100 p-2.5 dark:bg-orange-500/15 group-hover:scale-105 transition-transform">
                  <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.bugFixReported}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-orange-600 dark:text-orange-400">Reported</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card variant="filled" padding="none" className="group hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-amber-100 p-2.5 dark:bg-amber-500/15 group-hover:scale-105 transition-transform">
                  <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.bugFixFixing}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">Fixing</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card variant="filled" padding="none" className="group hover:bg-cyan-50 dark:hover:bg-cyan-500/10 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-cyan-100 p-2.5 dark:bg-cyan-500/15 group-hover:scale-105 transition-transform">
                  <RefreshCw className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.bugFixReadyRetest}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">Ready</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card variant="filled" padding="none" className="group hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-emerald-100 p-2.5 dark:bg-emerald-500/15 group-hover:scale-105 transition-transform">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.bugFixFixed}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Fixed</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex min-w-0 flex-col items-start justify-between gap-4 rounded-2xl border border-border/60 bg-card p-3 elevation-1 lg:flex-row lg:items-center">
        <Tabs
          value={bugFixTab}
          onValueChange={(v) => setBugFixTab(v as 'active' | 'resolved')}
          className="w-full sm:w-auto"
        >
          <TabsList className="h-10 rounded-xl border border-border/60 bg-secondary/50 p-1">
            <TabsTrigger value="active" className="gap-2 rounded-lg px-4 text-[11px] font-semibold uppercase tracking-wide data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:elevation-1">
              <Bug className="w-3.5 h-3.5" /> Active Bugs
            </TabsTrigger>
            <TabsTrigger value="resolved" className="gap-2 rounded-lg px-4 text-[11px] font-semibold uppercase tracking-wide data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:elevation-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Fixed History
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:w-auto xl:grid-cols-5">
          <Badge variant="outline" className="h-9 justify-center rounded-xl border-border/60 bg-muted px-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            Showing {visibleBugFixItems.length} data
          </Badge>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 justify-center rounded-xl border-border/60 bg-secondary/50 text-[10px] font-black uppercase tracking-widest text-foreground">
                <Settings2 className="h-3.5 w-3.5" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 rounded-xl bg-card border-border/60 elevation-3">
              <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Table Columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {BUGFIX_COLUMN_OPTIONS.map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.key}
                  checked={visibleColumns[column.key]}
                  onCheckedChange={(checked) => setVisibleColumns((current) => ({ ...current, [column.key]: Boolean(checked) }))}
                  className="text-xs font-semibold"
                >
                  {column.label}
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setVisibleColumns(DEFAULT_BUGFIX_COLUMNS)} className="text-xs font-bold">
                Reset columns
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Cari bug fix..."
              value={bugFixSearch}
              onChange={(e) => setBugFixSearch(e.target.value)}
              className="h-9 rounded-xl border-border/60 bg-secondary/50 pl-9 text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/30"
            />
          </div>
          <Select value={bugFixFilterModule} onValueChange={setBugFixFilterModule}>
            <SelectTrigger className="h-9 w-full rounded-xl border-border/60 bg-secondary/50 text-foreground sm:w-[180px]">
              <SelectValue placeholder="Filter module" />
            </SelectTrigger>
            <SelectContent className="rounded-xl bg-card border-border/60 elevation-3">
              <SelectItem value="all" className="rounded-lg">Semua Module</SelectItem>
              {modules.map((module) => (
                <SelectItem key={module.id} value={module.id} className="rounded-lg">{module.name}</SelectItem>
              ))}
              {hasUnassignedModule && (
                <SelectItem value="unassigned" className="rounded-lg">Tanpa Module</SelectItem>
              )}
            </SelectContent>
          </Select>
          {bugFixTab === 'active' && (
            <Select value={bugFixFilterStatus} onValueChange={setBugFixFilterStatus}>
              <SelectTrigger className="h-9 w-full rounded-xl border-border/60 bg-secondary/50 text-foreground sm:w-[180px]"><SelectValue placeholder="Filter status" /></SelectTrigger>
              <SelectContent className="rounded-xl bg-card border-border/60 elevation-3">
                <SelectItem value="all" className="rounded-lg">Semua Status</SelectItem>
                <SelectItem value="SUDAH DILAPORKAN" className="rounded-lg">Dilaporkan</SelectItem>
                <SelectItem value="SEDANG DI FIX" className="rounded-lg">Sedang Di Fix</SelectItem>
                <SelectItem value="READY TO RETEST" className="rounded-lg">Ready to Retest</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Table or Empty State */}
      {visibleBugFixItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center space-y-2 rounded-2xl border border-dashed border-border bg-card py-20 elevation-1">
          <Bug className="w-12 h-12 text-muted-foreground/20" />
          <p className="text-sm font-semibold text-foreground">No Defects Found</p>
          <p className="text-xs text-muted-foreground">No {bugFixTab === 'resolved' ? 'resolved defects' : 'active defects'} in this project.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card elevation-1">
          <div className="overflow-hidden">
            <Table>
              <TableHeader className="sticky top-0 z-10">
                <TableRow className="border-border/50 bg-secondary/30 hover:bg-secondary/30">
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
                  <TableRow key={bf.id} className="border-border/30 hover:bg-secondary/30 transition-colors group">
                    <TableCell className="text-center font-mono text-xs font-bold text-muted-foreground">{index + 1}</TableCell>
                    <TableCell className="font-mono text-sm font-bold text-foreground">{bf.testCaseId}</TableCell>
                    <TableCell className="text-sm font-medium text-foreground">{bf.page}</TableCell>
                    <TableCell className={getColumnClass('subMenu', 'text-muted-foreground text-[13px]')}>{bf.subMenu || '-'}</TableCell>
                    <TableCell className={getColumnClass('action', 'text-muted-foreground text-sm max-w-[200px] truncate group-hover:text-foreground transition-colors')}>{bf.testAction}</TableCell>
                    <TableCell className={getColumnClass('priority')}><Badge variant={bf.priority === 'Critical' ? 'failed' : bf.priority === 'High' ? 'warning' : 'outline'} className="text-[10px] font-semibold">{bf.priority}</Badge></TableCell>
                    <TableCell className={getColumnClass('status')}>
                      {bugFixTab === 'resolved' ? (
                        <Badge variant="success" className="text-[9px] font-semibold uppercase">
                          {bf.status}
                        </Badge>
                      ) : (
                        <Select value={bf.status} onValueChange={(val) => onStatusChange(bf.id, val)}>
                          <SelectTrigger className="h-8 rounded-lg text-[9px] font-semibold uppercase border-border/60 bg-secondary/50 text-foreground shadow-none">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl bg-card border-border/60 elevation-3">
                            <SelectItem value="SUDAH DILAPORKAN" className="text-[9px] font-semibold rounded-lg">DILAPORKAN</SelectItem>
                            <SelectItem value="SEDANG DI FIX" className="text-[9px] font-semibold rounded-lg">SEDANG DI FIX</SelectItem>
                            <SelectItem value="READY TO RETEST" className="text-[9px] font-semibold rounded-lg">READY TO RETEST</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell className={getColumnClass('reportedAt', 'text-[11px] font-medium text-muted-foreground')}>{formatDate(bf.reportedAt)}</TableCell>
                    <TableCell className={getColumnClass('timing', 'text-[11px] font-medium text-muted-foreground')}>
                      {bugFixTab === 'resolved'
                        ? formatDate(bf.fixedAt)
                        : bf.status === 'READY TO RETEST'
                          ? formatDate(bf.readyAt)
                          : formatDate(bf.fixingAt)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary"
                        onClick={() => onOpenDetail(bf)}
                      >
                        <Eye className="w-4 h-4" />
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
