'use client';

import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useWorkspaceAccess } from '@/components/WorkspaceAccess';
import { AlertTriangle, CheckCircle2, Clock, Eye, Info, LayoutGrid, List, RefreshCw, Search, Settings2 } from 'lucide-react';
import { BugFixKanbanBoard } from '@/components/BugFixKanbanBoard';
import { DefectIcon } from '@/components/icons/qa-icons';
import { AnimatePresence, motion } from 'framer-motion';
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
import { EmptyState } from '@/components/ui/empty-state';
import { SimpleTooltip } from '@/components/ui/tooltip';
import type { Module } from '@/lib/client/api/types';

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

interface BugFixStats {
  bugFixReported: number;
  bugFixFixing: number;
  bugFixReadyRetest: number;
  bugFixFixed: number;
}

interface BugFixPanelProps {
  pagination?: { page: number; total: number; totalPages: number; loading: boolean; error: string; setPage: (page: number) => void; reload: () => void };
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
      tabIndex={0}
      data-bug-id={bf.id}
      className={cn("cursor-pointer border-border/30 hover:bg-secondary/40 active:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset transition-all group", rowClassName)}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('button, a, input, select, [role="checkbox"], [role="combobox"], [role="menu"], [role="option"], [role="listbox"]')) return;
        onOpenDetail(bf);
      }}
      onKeyDown={(e) => {
        if ((e.target as HTMLElement).closest('button, a, input, select, [role="checkbox"], [role="combobox"], [role="menu"], [role="option"], [role="listbox"]')) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpenDetail(bf);
        } else if (e.key === 'ArrowDown' || e.key === 'j') {
          e.preventDefault();
          const next = e.currentTarget.nextElementSibling as HTMLElement | null;
          next?.focus();
        } else if (e.key === 'ArrowUp' || e.key === 'k') {
          e.preventDefault();
          const prev = e.currentTarget.previousElementSibling as HTMLElement | null;
          prev?.focus();
        }
      }}
    >
      <TableCell className="sticky left-0 z-10 w-10 bg-card text-center font-mono text-xs font-bold tabular-nums text-muted-foreground group-hover:bg-secondary">{index + 1}</TableCell>
      <TableCell title={bf.testCaseId} className="sticky left-10 z-10 w-[136px] min-w-[136px] max-w-[140px] overflow-hidden whitespace-nowrap bg-card font-mono text-sm font-semibold tabular-nums text-foreground group-hover:bg-secondary">{bf.testCaseId}</TableCell>
      <TableCell className="min-w-[110px] max-w-[130px] truncate whitespace-nowrap text-sm font-semibold text-foreground" title={bf.page}>{bf.page}</TableCell>
      <TableCell className={getColumnClass('subMenu', 'min-w-[100px] max-w-[120px] truncate whitespace-nowrap text-sm text-muted-foreground')} title={bf.subMenu || ''}>{bf.subMenu || '-'}</TableCell>
      <TableCell className={getColumnClass('action', 'min-w-[200px] max-w-[320px]')} title={bf.testAction}>
        <p className="line-clamp-2 text-sm leading-5 text-foreground">{bf.testAction}</p>
      </TableCell>
      <TableCell className={getColumnClass('priority', 'w-[84px] min-w-[84px]')}>
        <Badge variant="outline" className={cn("text-xs font-semibold", getPriorityColor(bf.priority))}>
          {bf.priority}
        </Badge>
      </TableCell>
      <TableCell className={getColumnClass('status', 'w-[150px] min-w-[150px]')}>
        {!canEdit || bugFixTab === 'resolved' ? (
          <Badge variant="outline" className={cn('text-xs font-semibold', getBugFixStatusColor(bf.status))}>
            {bf.status}
          </Badge>
        ) : (
          <BugFixStatusCell id={bf.id} displayId={bf.testCaseId} status={bf.status} color={getBugFixStatusColor(bf.status)} onChange={onStatusChange} />
        )}
      </TableCell>
      <TableCell className={getColumnClass('reportedAt', 'w-[140px] min-w-[140px] whitespace-nowrap text-xs tabular-nums text-muted-foreground')}>{formatDate(bf.reportedAt)}</TableCell>
      <TableCell className={getColumnClass('timing', 'w-[140px] min-w-[140px] whitespace-nowrap text-xs tabular-nums text-muted-foreground')}>
        {bugFixTab === 'resolved'
          ? formatDate(bf.fixedAt)
          : bf.status === 'READY TO RETEST'
            ? formatDate(bf.readyAt)
            : formatDate(bf.fixingAt)}
      </TableCell>
      <TableCell className="sticky right-0 z-10 w-[48px] min-w-[48px] bg-card group-hover:bg-secondary border-l border-border/30">
        <SimpleTooltip content={`Lihat bug ${bf.testCaseId}`}>
        <Button
          aria-label={`View bug ${bf.testCaseId}`}
          variant="ghost"
          size="icon"
          className="size-9 text-muted-foreground"
          onClick={() => onOpenDetail(bf)}
        >
          <Eye className="w-4 h-4 text-primary" />
        </Button>
        </SimpleTooltip>
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
  pagination,
}: BugFixPanelProps) {
  const [visibleColumns, setVisibleColumns] = useState<Record<BugFixColumnKey, boolean>>(getInitialBugFixColumns);
  const { density, setDensity, rowClassName } = useTableDensity();
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');
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
          <DefectIcon className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30 animate-pulse" />
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
      <div className="flex items-center gap-2.5 rounded-lg border border-border/70 bg-card/60 px-3.5 py-2.5 text-xs text-muted-foreground">
        <Info className="size-4 shrink-0 text-primary" />
        <span><strong className="font-semibold text-foreground">Ready to Retest:</strong> Uji ulang skenario terkait. Verifikasi bug tercatat otomatis saat testcase ditandai <span className="font-semibold text-status-passed">Done / As Expected</span>.</span>
      </div>



      {/* Toolbar */}
      <div className="qa-workspace-toolbar flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-card p-4">
        <Tabs
          value={bugFixTab}
          onValueChange={(v) => setBugFixTab(v as 'active' | 'resolved')}
          className="w-full sm:w-auto"
        >
          <TabsList className="qa-inspector-tabs h-10 border border-border bg-muted p-1">
            <TabsTrigger value="active" className="gap-2 rounded-lg px-4 text-xs font-semibold uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">
              <DefectIcon className="w-3.5 h-3.5" /> Bug Aktif
            </TabsTrigger>
            <TabsTrigger value="resolved" className="gap-2 rounded-lg px-4 text-xs font-semibold uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">
              <CheckCircle2 className="w-3.5 h-3.5" /> Riwayat Fixed
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="grid w-full min-w-0 grid-cols-2 items-center gap-2 xl:grid-cols-[auto_auto_auto_minmax(160px,1fr)_160px_160px]">
          <Badge variant="outline" className="h-9 justify-center rounded-lg border border-border/60 bg-secondary/40 px-3 text-xs font-medium text-muted-foreground">
            {visibleBugFixItems.length} Bug {bugFixTab === 'resolved' ? 'Fixed' : 'Aktif'}
          </Badge>
          <DataTableDensityToggle value={density} onValueChange={setDensity} />
          <div className="flex items-center rounded-lg border border-border/60 bg-muted/40 p-0.5">
            <SimpleTooltip content="Tampilan Tabel">
            <Button
              type="button"
              variant={viewMode === 'table' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 px-2 text-xs gap-1 font-medium"
              onClick={() => setViewMode('table')}
            >
              <List className="size-3.5" /> Tabel
            </Button>
            </SimpleTooltip>
            <SimpleTooltip content="Tampilan Papan Kanban">
            <Button
              type="button"
              variant={viewMode === 'kanban' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 px-2 text-xs gap-1 font-medium"
              onClick={() => setViewMode('kanban')}
            >
              <LayoutGrid className="size-3.5" /> Kanban
            </Button>
            </SimpleTooltip>
          </div>
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
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={bugFixTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          className="flex min-w-0 flex-1 flex-col"
        >
      {visibleBugFixItems.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-12 shadow-sm">
          <EmptyState
            icon={DefectIcon}
            title={bugFixSearch || bugFixFilterStatus !== 'all' || bugFixFilterModule !== 'all' ? 'Tidak ada bug yang cocok' : bugFixTab === 'resolved' ? 'Belum ada bug terselesaikan' : 'Semua bug telah tertangani'}
            description={
              bugFixSearch || bugFixFilterStatus !== 'all' || bugFixFilterModule !== 'all'
                ? 'Tidak ada isu bug yang sesuai dengan kriteria filter atau kata kunci pencarian.'
                : bugFixTab === 'resolved'
                  ? 'Belum ada riwayat bug yang ditandai selesai pada project ini.'
                  : 'Bagus! Tidak ada isu bug aktif atau tertunda yang menahan rilis.'
            }
            action={
              bugFixSearch || bugFixFilterStatus !== 'all' || bugFixFilterModule !== 'all'
                ? {
                    label: 'Reset Filter',
                    onClick: () => {
                      setBugFixSearch('');
                      setBugFixFilterStatus('all');
                      setBugFixFilterModule('all');
                    },
                    variant: 'outline',
                  }
                : undefined
            }
          />
        </div>
      ) : viewMode === 'kanban' ? (
        <BugFixKanbanBoard
          items={visibleBugFixItems}
          getPriorityColor={getPriorityColor}
          onStatusChange={onStatusChange}
          onOpenDetail={openDetail}
        />
      ) : (
        <div className="relative flex min-w-0 flex-col rounded-xl border border-border bg-card">
            <Table className="qa-data-table w-full min-w-[720px] md:min-w-[1000px] xl:min-w-[1240px] table-auto"
              containerClassName="max-h-[calc(100dvh-245px)] overflow-auto rounded-t-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              containerProps={{ role: 'region', tabIndex: 0, 'aria-label': 'Tabel bug, dapat digeser horizontal dan vertikal', 'aria-describedby': 'bugs-scroll-help' }}>
              <TableHeader className="sticky top-0 z-10 bg-secondary/95">
                <TableRow className="border-border/30 hover:bg-transparent">
                  <TableHead className="sticky left-0 z-20 w-10 bg-secondary/95 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">No</TableHead>
                  <TableHead className="sticky left-10 z-20 w-[136px] min-w-[136px] bg-secondary/95 text-xs font-semibold uppercase tracking-wider text-muted-foreground">TC ID</TableHead>
                  <TableHead className="w-[110px] min-w-[110px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">Page</TableHead>
                  <TableHead className={getColumnClass('subMenu', 'w-[100px] min-w-[100px] text-xs font-semibold uppercase tracking-wider text-muted-foreground')}>Sub Menu</TableHead>
                  <TableHead className={getColumnClass('action', 'text-xs font-semibold uppercase tracking-wider text-muted-foreground')}>Test Action</TableHead>
                  <TableHead className={getColumnClass('priority', 'w-[84px] min-w-[84px] text-xs font-semibold uppercase tracking-wider text-muted-foreground')}>Priority</TableHead>
                  <TableHead className={getColumnClass('status', 'w-[150px] min-w-[150px] text-xs font-semibold uppercase tracking-wider text-muted-foreground')}>Status</TableHead>
                  <TableHead className={getColumnClass('reportedAt', 'w-[140px] min-w-[140px] text-xs font-semibold uppercase tracking-wider text-muted-foreground')}>Dilaporkan</TableHead>
                  {bugFixTab === 'resolved' ? (
                    <TableHead className={getColumnClass('timing', 'w-[140px] min-w-[140px] text-xs font-semibold uppercase tracking-wider text-muted-foreground')}>Fixed At</TableHead>
                  ) : (
                    <TableHead className={getColumnClass('timing', 'w-[140px] min-w-[140px] text-xs font-semibold uppercase tracking-wider text-muted-foreground')}>Di Fix / Retest</TableHead>
                  )}
                  <TableHead className="sticky right-0 z-20 w-[48px] min-w-[48px] bg-secondary/95 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-l border-border/30">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleBugFixItems.map((bf, index) => (
                  <BugFixTableRow key={bf.id} bf={bf} index={index + ((pagination?.page || 1) - 1) * 25} rowClassName={rowClassName}
                    bugFixTab={bugFixTab} getColumnClass={getColumnClass} getPriorityColor={getPriorityColor}
                    onStatusChange={onStatusChange} onOpenDetail={openDetail} />
                ))}
              </TableBody>
            </Table>
            <p id="bugs-scroll-help" className="qa-table-scroll-help">Geser tabel untuk melihat semua kolom. ID dan aksi tetap terlihat.</p>
          </div>
        )}
        </motion.div>
      </AnimatePresence>
      {pagination && <div className="flex flex-wrap items-center justify-between gap-3 text-sm" aria-busy={pagination.loading}>
        <p className="text-muted-foreground" role="status">{pagination.loading ? 'Memuat bug…' : `${pagination.total} bug · Halaman ${pagination.page} dari ${pagination.totalPages}`}</p>
        {pagination.error && <p role="alert" className="text-destructive">{pagination.error} <Button variant="outline" size="sm" onClick={pagination.reload}>Muat ulang</Button></p>}
        <div className="flex gap-2"><Button variant="outline" size="sm" disabled={pagination.loading || pagination.page <= 1} onClick={() => pagination.setPage(pagination.page - 1)}>Sebelumnya</Button><Button variant="outline" size="sm" disabled={pagination.loading || pagination.page >= pagination.totalPages} onClick={() => pagination.setPage(pagination.page + 1)}>Berikutnya</Button></div>
      </div>}
    </motion.div>
  );
}
