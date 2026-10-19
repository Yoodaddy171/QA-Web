'use client';

import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useWorkspaceAccess } from '@/components/WorkspaceAccess';
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
import { BugFixStatusCell } from '@/components/BugFixStatusCell';
import { DataTableDensityToggle } from '@/components/DataTableDensityToggle';
import { useTableDensity } from '@/hooks/use-table-density';
import { cn } from '@/lib/utils';
import { BugFixStatsCards } from '@/components/BugFixStatsCards';

type BugFixColumnKey = 'subMenu' | 'action' | 'priority' | 'status' | 'reportedAt' | 'timing';

const BUGFIX_COLUMN_OPTIONS: Array<{ key: BugFixColumnKey; label: string; responsiveClass?: string }> = [
  { key: 'subMenu', label: 'Sub Menu', responsiveClass: 'hidden lg:table-cell' },
  { key: 'action', label: 'Test Action', responsiveClass: 'hidden md:table-cell' },
  { key: 'priority', label: 'Priority', responsiveClass: 'hidden sm:table-cell' },
  { key: 'status', label: 'Status' },
  { key: 'reportedAt', label: 'Dilaporkan', responsiveClass: 'hidden xl:table-cell' },
  { key: 'timing', label: 'Timing', responsiveClass: 'hidden xl:table-cell' },
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
    case 'SUDAH DILAPORKAN': return 'qa-status qa-bug-open';
    case 'SEDANG DI FIX': return 'qa-status qa-bug-fixing';
    case 'READY TO RETEST': return 'qa-status qa-bug-ready';
    case 'VERIFIED & FIXED': return 'qa-status qa-bug-fixed';
    default: return 'border-border/60 bg-muted text-muted-foreground font-semibold';
  }
};

type BugFixRowsProps = {
  visibleBugFixItems: BugFixItem[];
  rowClassName: string;
  bugFixTab: 'active' | 'resolved';
  getColumnClass: (column: BugFixColumnKey, extra?: string) => string;
  getPriorityColor: BugFixPanelProps['getPriorityColor'];
  onStatusChange: BugFixPanelProps['onStatusChange'];
  onOpenDetail: BugFixPanelProps['onOpenDetail'];
};

// Memoize the row boundary as well as the page: one canonical changed record
// should not invalidate the other closed selector/date/cell trees.
const BugFixTableRow = memo(function BugFixTableRow({
  bf, index, ...props
}: Omit<BugFixRowsProps, 'visibleBugFixItems'> & { bf: BugFixItem; index: number }) {
  const { canEdit } = useWorkspaceAccess();
  const { rowClassName, bugFixTab, getColumnClass, getPriorityColor, onStatusChange, onOpenDetail } = props;
  return (
    <TableRow
      data-bug-id={bf.id}
      className={cn("cursor-pointer border-border/30 hover:bg-secondary/40 transition-colors group", rowClassName)}

      title="Klik untuk melihat detail"
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('button, a, input, select, [role="checkbox"], [role="combobox"], [role="menu"], [role="option"], [role="listbox"]')) return;
        onOpenDetail(bf);
      }}
    >
      <TableCell className="sticky left-0 z-10 bg-card text-center font-mono text-xs font-bold text-muted-foreground group-hover:bg-secondary">{index + 1}</TableCell>
      <TableCell className="sticky left-10 z-10 w-[130px] min-w-[130px] max-w-[130px] overflow-hidden whitespace-nowrap bg-card font-mono text-sm font-semibold text-foreground group-hover:bg-secondary">{bf.testCaseId}</TableCell>
      <TableCell className="min-w-[120px] max-w-[144px] truncate whitespace-nowrap text-sm font-semibold text-foreground" title={bf.page}>{bf.page}</TableCell>
      <TableCell className={getColumnClass('subMenu', 'min-w-[128px] max-w-[144px] truncate whitespace-nowrap text-sm text-muted-foreground')} title={bf.subMenu || ''}>{bf.subMenu || '—'}</TableCell>
      <TableCell className={getColumnClass('action', 'min-w-[240px] max-w-[320px]')} title={bf.testAction}>
        <p className="line-clamp-2 text-sm leading-5 text-foreground">{bf.testAction}</p>
      </TableCell>
      <TableCell className={getColumnClass('priority')}>
        <Badge variant="outline" className={cn("text-xs font-semibold", getPriorityColor(bf.priority))}>
          {bf.priority}
        </Badge>
      </TableCell>
      <TableCell className={getColumnClass('status', 'min-w-[196px]')}>
        {!canEdit || bugFixTab === 'resolved' ? (
          <Badge variant="outline" className={cn('text-xs font-semibold', getBugFixStatusColor(bf.status))}>
            {bf.status}
          </Badge>
        ) : (
          <BugFixStatusCell id={bf.id} displayId={bf.testCaseId} status={bf.status} color={getBugFixStatusColor(bf.status)} onChange={onStatusChange} />
        )}
      </TableCell>
      <TableCell className={getColumnClass('reportedAt', 'min-w-[144px] whitespace-nowrap text-xs tabular-nums text-muted-foreground')}>{formatDate(bf.reportedAt)}</TableCell>
      <TableCell className={getColumnClass('timing', 'min-w-[144px] whitespace-nowrap text-xs tabular-nums text-muted-foreground')}>
        {bugFixTab === 'resolved'
          ? formatDate(bf.fixedAt)
          : bf.status === 'READY TO RETEST'
            ? formatDate(bf.readyAt)
            : formatDate(bf.fixingAt)}
      </TableCell>
      <TableCell className="sticky right-0 z-10 bg-card group-hover:bg-secondary">
        <Button
          aria-label={`View bug ${bf.testCaseId}`}
          title={`View bug ${bf.testCaseId}`}
          variant="ghost"
          size="icon"
          className="size-9 text-muted-foreground"
          onClick={() => onOpenDetail(bf)}
        >
          <Eye className="w-4 h-4 text-primary" />
        </Button>
      </TableCell>
    </TableRow>
  );
});

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
  const { density, setDensity, rowClassName } = useTableDensity();
  const getColumnClass = useCallback((key: BugFixColumnKey, baseClass = '') => {
    const option = BUGFIX_COLUMN_OPTIONS.find((column) => column.key === key);
    return cn(!visibleColumns[key] && 'hidden', visibleColumns[key] && option?.responsiveClass, baseClass);
  }, [visibleColumns]);
  const detailHandler = useRef(onOpenDetail);
  useLayoutEffect(() => { detailHandler.current = onOpenDetail; }, [onOpenDetail]);
  const openDetail = useCallback((item: BugFixItem) => detailHandler.current(item), []);

  useEffect(() => {
    window.localStorage.setItem(BUGFIX_COLUMN_STORAGE_KEY, JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  if (!selectedProject) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-border/50 bg-card shadow-sm">
        <div className="text-center">
          <Bug className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30 animate-pulse" />
          <p className="text-sm font-semibold text-muted-foreground">Pilih project untuk melihat bug tracking</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0 }}
      className="qa-data-workspace flex min-w-0 flex-col gap-4"
    >
      {stats && <BugFixStatsCards stats={stats} />}
      <p className="text-xs text-muted-foreground">READY TO RETEST: uji ulang testcase inventory terkait. Pilih Done / As Expected untuk verifikasi Bug; Pass di Test Run saja tidak memverifikasi Bug.</p>



      {/* Toolbar */}
      <div className="qa-workspace-toolbar flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-card p-4">
        <Tabs
          value={bugFixTab}
          onValueChange={(v) => setBugFixTab(v as 'active' | 'resolved')}
          className="w-full sm:w-auto"
        >
          <TabsList className="qa-inspector-tabs h-10 border border-border bg-muted p-1">
            <TabsTrigger value="active" className="gap-2 rounded-lg px-4 text-xs font-semibold uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">
              <Bug className="w-3.5 h-3.5" /> Bug Aktif
            </TabsTrigger>
            <TabsTrigger value="resolved" className="gap-2 rounded-lg px-4 text-xs font-semibold uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">
              <CheckCircle2 className="w-3.5 h-3.5" /> Riwayat Fixed
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="grid w-full min-w-0 grid-cols-2 items-center gap-2 xl:grid-cols-[auto_auto_auto_minmax(160px,1fr)_160px_160px]">
          <Badge variant="outline" className="h-9.5 justify-center rounded-xl border border-border/50 bg-muted/60 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Menampilkan {visibleBugFixItems.length} data
          </Badge>
          <DataTableDensityToggle value={density} onValueChange={setDensity} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9.5 justify-center rounded-xl border border-border/50 bg-secondary/35 text-xs font-semibold uppercase tracking-wider text-foreground hover:bg-secondary/65 transition">
                <Settings2 className="h-3.5 w-3.5 text-primary" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 rounded-xl bg-card border border-border/50 shadow-lg text-foreground">
              <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-3 py-2">Kolom Tabel</DropdownMenuLabel>
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
          <div className="relative col-span-2 min-w-0 lg:col-span-1 2xl:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
            <Input
              placeholder="Cari bug..."
              value={bugFixSearch}
              onChange={(e) => setBugFixSearch(e.target.value)}
              className="h-9.5 rounded-xl border border-border/50 bg-secondary/35 pl-9 text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/20 text-xs font-medium"
            />
          </div>
          <Select value={bugFixFilterModule} onValueChange={setBugFixFilterModule}>
            <SelectTrigger className="h-9.5 w-full rounded-xl border border-border/50 bg-secondary/35 text-foreground sm:w-[180px] text-xs font-semibold hover:bg-secondary/65 transition duration-200">
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
              <SelectTrigger className="h-9.5 w-full rounded-xl border border-border/50 bg-secondary/35 text-foreground sm:w-[180px] text-xs font-semibold hover:bg-secondary/65 transition duration-200"><SelectValue placeholder="Filter status" /></SelectTrigger>
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
          <p className="text-sm font-bold uppercase tracking-wider text-foreground">
            {bugFixSearch || bugFixFilterStatus !== 'all' || bugFixFilterModule !== 'all' ? 'Tidak ada hasil' : 'Tidak ada bug'}
          </p>
          <p className="text-xs text-muted-foreground/80 font-medium">
            {bugFixSearch || bugFixFilterStatus !== 'all' || bugFixFilterModule !== 'all'
              ? 'Tidak ada bug yang cocok dengan pencarian atau filter aktif.'
              : `Tidak ada bug ${bugFixTab === 'resolved' ? 'yang sudah selesai' : 'aktif'} di project ini.`}
          </p>
        </div>
      ) : (
        <div className="relative min-w-0 rounded-xl border border-border bg-card">
            <Table className="qa-data-table w-full min-w-[720px] md:min-w-[1000px] xl:min-w-[1240px] table-auto"
              containerClassName="max-h-[max(180px,calc(100dvh-420px))] overflow-auto rounded-t-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              containerProps={{ role: 'region', tabIndex: 0, 'aria-label': 'Tabel bug, dapat digeser horizontal dan vertikal', 'aria-describedby': 'bugs-scroll-help' }}>
              <TableHeader className="sticky top-0 z-10 bg-secondary/95">
                <TableRow className="border-border/30 hover:bg-transparent">
                  <TableHead className="sticky left-0 z-20 w-10 bg-secondary/95 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">No</TableHead>
                  <TableHead className="sticky left-10 z-20 w-[130px] min-w-[130px] bg-secondary/95 text-xs font-semibold uppercase tracking-wider text-muted-foreground">TC ID</TableHead>
                  <TableHead className="w-[110px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">Page</TableHead>
                  <TableHead className={getColumnClass('subMenu', 'w-[100px] text-xs font-semibold uppercase tracking-wider text-muted-foreground')}>Sub Menu</TableHead>
                  <TableHead className={getColumnClass('action', 'text-xs font-semibold uppercase tracking-wider text-muted-foreground')}>Test Action</TableHead>
                  <TableHead className={getColumnClass('priority', 'w-[94px] text-xs font-semibold uppercase tracking-wider text-muted-foreground')}>Priority</TableHead>
                  <TableHead className={getColumnClass('status', 'w-[150px] text-xs font-semibold uppercase tracking-wider text-muted-foreground')}>Status</TableHead>
                  <TableHead className={getColumnClass('reportedAt', 'w-[132px] text-xs font-semibold uppercase tracking-wider text-muted-foreground')}>Dilaporkan</TableHead>
                  {bugFixTab === 'resolved' ? (
                    <TableHead className={getColumnClass('timing', 'w-[132px] text-xs font-semibold uppercase tracking-wider text-muted-foreground')}>Fixed At</TableHead>
                  ) : (
                    <TableHead className={getColumnClass('timing', 'w-[132px] text-xs font-semibold uppercase tracking-wider text-muted-foreground')}>Di Fix / Retest</TableHead>
                  )}
                  <TableHead className="sticky right-0 z-20 w-[52px] bg-secondary/95 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleBugFixItems.map((bf, index) => (
                  <BugFixTableRow key={bf.id} bf={bf} index={index} rowClassName={rowClassName}
                    bugFixTab={bugFixTab} getColumnClass={getColumnClass} getPriorityColor={getPriorityColor}
                    onStatusChange={onStatusChange} onOpenDetail={openDetail} />
                ))}
              </TableBody>
            </Table>
            <p id="bugs-scroll-help" className="qa-table-scroll-help">Geser tabel untuk melihat semua kolom. ID dan aksi tetap terlihat.</p>
        </div>
      )}
    </motion.div>
  );
}
