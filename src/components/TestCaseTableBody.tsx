'use client';

import React, { useRef } from 'react';
import { gsap, useGSAP, isMotionAllowed, scrambleDecodeText } from '@/lib/client/gsap-motion';
import { MutationAction, useWorkspaceAccess } from '@/components/WorkspaceAccess';
import {
  ArrowUpDown, CalendarClock, ChevronLeft, ChevronRight, Copy, Edit3, Eye, FileDown,
  FileSpreadsheet, MoreHorizontal, RefreshCw, Search, Trash2, Upload, X
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TestCaseStatusCell } from '@/components/TestCaseStatusCell';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterX, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SimpleTooltip } from '@/components/ui/tooltip';

type TestCaseTableBodyProps = Record<string, any>;
// Per-row diagnostics are compiled out of ordinary production builds.
const recordRow: React.ProfilerOnRenderCallback = (id, phase, actualDuration) => {
  const target = window as typeof window & { __qaRowCommits?: Array<{ id: string; phase: string; actualDuration: number }> };
  const commits = target.__qaRowCommits ??= [];
  commits.push({ id, phase, actualDuration });
  if (commits.length > 5000) commits.splice(0, commits.length - 5000);
};
const TestCaseDataRow = React.memo(function TestCaseDataRow(props: TestCaseTableBodyProps) {
  const { tc, index, isSelected, page, limit, rowClassName, openViewDialog, toggleSelect, ...cells } = props;
  return (
<TableRow
                    tabIndex={0}
                    data-state={isSelected ? 'selected' : undefined}
                    className={cn(
                      'group cursor-pointer border-border/30 transition-all duration-150 hover:bg-secondary/40 active:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset', rowClassName,
                      isSelected && 'bg-primary/[0.06] hover:bg-primary/10'
                    )}
                    onClick={(e) => {
                      // Ignore clicks on interactive controls inside the row.
                      if ((e.target as HTMLElement).closest('button, a, input, select, [role="checkbox"], [role="combobox"], [role="menu"]')) return;
                      openViewDialog(tc);
                    }}
                    onKeyDown={(e) => {
                      if ((e.target as HTMLElement).closest('button, a, input, select, [role="checkbox"], [role="combobox"], [role="menu"]')) return;
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openViewDialog(tc);
                      } else if (e.key === 'ArrowDown' || e.key === 'j') {
                        e.preventDefault();
                        const next = e.currentTarget.nextElementSibling as HTMLElement | null;
                        next?.focus();
                      } else if (e.key === 'ArrowUp' || e.key === 'k') {
                        e.preventDefault();
                        const prev = e.currentTarget.previousElementSibling as HTMLElement | null;
                        prev?.focus();
                      } else if (e.key === 'x') {
                        e.preventDefault();
                        toggleSelect(tc.id);
                      }
                    }}
                  >
                    <TableCell className="sticky left-0 z-10 bg-card pl-4 group-hover:bg-secondary">
                      <Checkbox
                        aria-label={`Pilih testcase ${tc.testCaseId}`}
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(tc.id)}
                        className="border-border/50 data-[state=checked]:bg-primary data-[state=checked]:border-primary rounded"
                      />
                    </TableCell>
                    <TableCell className="sticky left-10 z-10 bg-card text-center font-mono text-xs font-bold tabular-nums text-muted-foreground group-hover:bg-secondary">
                      {(page - 1) * limit + index + 1}
                    </TableCell>
                    <TestCaseDataCells tc={tc} openViewDialog={openViewDialog} {...cells} />
                  </TableRow>
  );
});

// Sorting and selection change the row shell, not unchanged data/control trees.
const TestCaseDataCells = React.memo(function TestCaseDataCells(props: TestCaseTableBodyProps) {
  const { tc, record, celebrating, mountedColumns, getColumnClass, openViewDialog, onQuickStatusChange, setCelebrateId, getStatusColor, getStatusIcon, getStatusBadgeVariant, getTestTypeColor, getPriorityColor, openEditDialog, handleDuplicate, requestDelete } = props;
  const { canEdit } = useWorkspaceAccess();
  return (
    <>
                    <TableCell
                      className="sticky left-[72px] z-10 w-[156px] min-w-[156px] max-w-[168px] overflow-hidden truncate whitespace-nowrap bg-card font-mono text-sm font-semibold tabular-nums text-foreground group-hover:bg-secondary"
                      title={tc.testCaseId}
                      onMouseEnter={(e) => {
                        const span = e.currentTarget.querySelector<HTMLElement>('[data-tc-id]');
                        if (span) scrambleDecodeText(span, tc.testCaseId, { duration: 0.3 });
                      }}
                    >
                      <span data-tc-id>{tc.testCaseId}</span>
                    </TableCell>
                    <TableCell className="min-w-[120px] max-w-[144px] truncate whitespace-nowrap text-sm font-semibold text-foreground" title={tc.page}>{tc.page}</TableCell>
                    {mountedColumns.subMenu && <TableCell className={getColumnClass('subMenu', 'min-w-[128px] max-w-[144px] truncate whitespace-nowrap text-sm text-muted-foreground')} title={tc.subMenu || ''}>{tc.subMenu || '-'}</TableCell>}
                    {mountedColumns.weight && <TableCell className={getColumnClass('weight')}>
                      {tc.calculatedWeight != null ? (
                        <Badge variant="outline" className="rounded-md border-border/60 bg-secondary/50 text-xs font-mono tabular-nums text-muted-foreground">
                          {tc.calculatedWeight.toFixed(2)}%
                        </Badge>
                      ) : (
                      <span className="text-xs font-semibold text-muted-foreground">-</span>
                      )}
                    </TableCell>}
                    {mountedColumns.type && <TableCell className={getColumnClass('type')}>
                      <span className={cn(
                        "inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[11px] font-semibold",
                        getTestTypeColor(tc.testType)
                      )}>
                        {tc.testType}
                      </span>
                    </TableCell>}
                    {mountedColumns.priority && <TableCell className={getColumnClass('priority')}>
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground">
                        <span className={cn(
                          "size-2 rounded-full",
                          tc.priority === 'Critical' && "bg-status-failed",
                          tc.priority === 'High' && "bg-bug-open",
                          tc.priority === 'Medium' && "bg-status-in-progress",
                          tc.priority === 'Low' && "bg-status-not-run"
                        )} />
                        {tc.priority}
                      </span>
                    </TableCell>}
                    {mountedColumns.action && <TableCell className={getColumnClass('action', 'min-w-[240px] max-w-[320px]')} title={tc.testAction}>
                      <p className="line-clamp-2 text-sm leading-5 text-foreground">{tc.testAction}</p>
                    </TableCell>}
                    {mountedColumns.status && <TableCell className={getColumnClass('status', 'min-w-[196px]')}>
                      {canEdit && onQuickStatusChange ? (
                        <div className="relative">
                          <TestCaseStatusCell id={tc.id} displayId={tc.testCaseId} status={tc.status} onChange={onQuickStatusChange} color={getStatusColor} icon={getStatusIcon} />
                        </div>
                      ) : (
                        <Badge variant={getStatusBadgeVariant(tc.status)} className="gap-1 text-xs font-semibold">
                          {getStatusIcon(tc.status)} {tc.status}
                        </Badge>
                      )}
                    </TableCell>}
                    {mountedColumns.result && <TableCell className={getColumnClass('result', 'min-w-[152px] whitespace-nowrap px-3')}>
                      {tc.actualResult ? (
                        <Badge variant={tc.actualResult === 'As Expected' ? 'success' : tc.actualResult === 'Not As Expected' ? 'failed' : 'outline'} className="text-xs font-semibold">
                          {tc.actualResult}
                        </Badge>
                      ) : (
                        <span className="text-xs font-semibold text-muted-foreground">-</span>
                      )}
                    </TableCell>}
                    {mountedColumns.record && <TableCell className={getColumnClass('record', 'px-3')}>
                      {record ? (
                        <div className="space-y-1">
                          <div className="flex flex-wrap gap-1">
                            {record.hasAutomationRun && (
                              <Badge className="qa-status qa-status-in-progress rounded-md text-xs font-semibold shadow-none uppercase">
                                Auto
                              </Badge>
                            )}
                            {record.hasManualCapture && (
                              <Badge className="qa-status qa-bug-fixed rounded-md text-xs font-semibold shadow-none uppercase">
                                Manual
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-xs font-bold text-muted-foreground uppercase tracking-tighter">
                            <CalendarClock className="h-2.5 w-2.5" />
                            {formatLastRun(record.lastRunAt)}
                          </div>
                        </div>
                      ) : (
                        <Badge variant="outline" className="rounded-md border-border/60 bg-secondary/50 text-xs font-semibold text-muted-foreground uppercase">
                          No Records
                        </Badge>
                      )}
                    </TableCell>}
                    {mountedColumns.progress && <TableCell className={getColumnClass('progress')}>
                      <div className="flex items-center gap-2">
                        <Progress value={tc.progress} className="h-1 w-12 bg-secondary/50" />
                        <span className="text-xs font-mono font-bold tabular-nums text-muted-foreground">{tc.progress}%</span>
                      </div>
                    </TableCell>}
                    <TableCell className="sticky right-0 z-10 bg-card group-hover:bg-secondary">
                      <DropdownMenu>
                        <SimpleTooltip content={`Aksi testcase ${tc.testCaseId}`}>
                        <DropdownMenuTrigger asChild>
                          <Button aria-label={`Actions for ${tc.testCaseId}`} variant="ghost" size="icon" className="size-9 text-muted-foreground">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        </SimpleTooltip>
                        <DropdownMenuContent align="end" className="bg-card shadow-lg border-border/60 text-foreground">
                          <DropdownMenuItem onClick={() => openViewDialog(tc)}>
                            <Eye className="w-4 h-4 mr-2" /> Lihat Detail
                          </DropdownMenuItem>
                          <MutationAction><DropdownMenuItem onClick={() => openEditDialog(tc)}>
                            <Edit3 className="w-4 h-4 mr-2" /> Edit
                          </DropdownMenuItem></MutationAction>
                          <MutationAction><DropdownMenuItem onClick={() => handleDuplicate(tc)}>
                            <Copy className="w-4 h-4 mr-2" /> Duplikasi
                          </DropdownMenuItem></MutationAction>
                          <MutationAction><DropdownMenuItem onClick={() => requestDelete(tc)} className="text-status-failed focus:text-status-failed">
                            <Trash2 className="w-4 h-4 mr-2" /> Hapus
                          </DropdownMenuItem></MutationAction>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
    </>
  );
});
const TESTCASE_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const formatLastRun = (dateStr: string | null) => {
  if (!dateStr) return 'Belum dites';
  return new Date(dateStr).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' });
};

export const TestCaseTableBody = React.memo(function TestCaseTableBody(props: TestCaseTableBodyProps) {
  const {
    selectedProject, testCases, selectedIds, testRecordById, page, limit, total, totalPages, tableColSpan,
    isLoading, hasActiveFilters, resetFilters, toggleSelectAll, toggleSort, getColumnClass, mountedColumns,
    openViewDialog, openEditDialog, handleDuplicate, requestDelete, toggleSelect, onQuickStatusChange,
    celebrateId, setCelebrateId, getStatusColor, getStatusIcon, getStatusBadgeVariant,
    getPriorityColor, getTestTypeColor, handleLimitChange, setPage, rowClassName, showingLabel: propShowingLabel,
  } = props;

  const showingLabel = propShowingLabel || (total !== testCases.length
    ? `Menampilkan ${testCases.length} dari ${total} data`
    : `Menampilkan ${testCases.length} data`);

  const tbodyRef = useRef<HTMLTableSectionElement>(null);
  useGSAP(
    () => {
      if (!tbodyRef.current || !isMotionAllowed() || isLoading || testCases.length === 0) return;
      const rows = tbodyRef.current.querySelectorAll('tr');
      if (!rows.length) return;
      gsap.fromTo(
        rows,
        { y: 7, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.22,
          stagger: 0.012,
          ease: 'power2.out',
          clearProps: 'y,opacity',
        }
      );
    },
    { dependencies: [page, selectedProject, testCases.length], scope: tbodyRef }
  );

  return (
    <>
      <div className="relative flex min-w-0 flex-col rounded-xl border border-border bg-card" aria-busy={Boolean(isLoading)}>
      {isLoading && testCases.length > 0 && (
        <div className="pointer-events-none sticky top-1 z-30 ml-auto -mb-8 mr-2 flex h-8 w-fit items-center gap-2 rounded-md border border-border bg-card px-2 text-xs text-muted-foreground shadow-sm" role="status" aria-label="Memperbarui test cases">
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent motion-reduce:animate-none" />
          Memperbarui…
        </div>
      )}
      <Table className="qa-data-table w-full min-w-[720px] md:min-w-[1000px] xl:min-w-[1320px] table-auto"
        containerClassName="max-h-[calc(100dvh-245px)] overflow-auto rounded-t-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        containerProps={{ role: 'region', tabIndex: 0, 'aria-label': 'Tabel testcase, dapat digeser horizontal dan vertikal', 'aria-describedby': 'cases-scroll-help' }}>
        <TableHeader className="sticky top-0 z-10 bg-secondary/95">
          <TableRow className="border-border/30 hover:bg-transparent">
            <TableHead className="sticky left-0 z-20 w-10 bg-secondary/95 pl-4">
              <Checkbox
                aria-label="Pilih semua di halaman ini"
                checked={testCases.length > 0 && selectedIds.size === testCases.length
                  ? true
                  : selectedIds.size > 0 ? 'indeterminate' : false}
                onCheckedChange={toggleSelectAll}
                className="border-border/50 data-[state=checked]:bg-primary data-[state=checked]:border-primary data-[state=indeterminate]:bg-primary/60 data-[state=indeterminate]:border-primary rounded"
              />
            </TableHead>
            <TableHead className="sticky left-10 z-20 w-8 min-w-8 bg-secondary/95 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">No</TableHead>
            <TableHead className="sticky left-[72px] z-20 w-[156px] min-w-[156px] cursor-pointer select-none bg-secondary/95 text-xs font-semibold uppercase tracking-wider text-muted-foreground" onClick={() => toggleSort('testCaseId')}>
              <div className="flex items-center gap-1">ID <ArrowUpDown className="w-3 h-3 text-primary" /></div>
            </TableHead>
            <TableHead className="w-[110px] cursor-pointer select-none text-xs font-semibold uppercase tracking-wider text-muted-foreground" onClick={() => toggleSort('page')}>
              <div className="flex items-center gap-1">Page <ArrowUpDown className="w-3 h-3 text-primary" /></div>
            </TableHead>
            {mountedColumns.subMenu && <TableHead className={getColumnClass('subMenu', 'w-[144px] text-xs font-semibold uppercase tracking-wider text-muted-foreground')}>Sub Menu</TableHead>}
            {mountedColumns.weight && <TableHead className={getColumnClass('weight', 'w-[68px] text-xs font-semibold uppercase tracking-wider text-muted-foreground')}>Weight</TableHead>}
            {mountedColumns.type && <TableHead className={getColumnClass('type', 'w-[80px] text-xs font-semibold uppercase tracking-wider text-muted-foreground')}>Type</TableHead>}
            {mountedColumns.priority && <TableHead className={getColumnClass('priority', 'w-[84px] text-xs font-semibold uppercase tracking-wider text-muted-foreground')}>Priority</TableHead>}
            {mountedColumns.action && <TableHead className={getColumnClass('action', 'text-xs font-semibold uppercase tracking-wider text-muted-foreground')}>Test Action</TableHead>}
            {mountedColumns.status && <TableHead className={getColumnClass('status', 'w-[196px] text-xs font-semibold uppercase tracking-wider text-muted-foreground')}>Status</TableHead>}
            {mountedColumns.result && <TableHead className={getColumnClass('result', 'w-[152px] text-xs font-semibold uppercase tracking-wider text-muted-foreground')}>Result</TableHead>}
            {mountedColumns.record && <TableHead className={getColumnClass('record', 'w-[140px] text-xs font-semibold uppercase tracking-wider text-muted-foreground')}>Test Record</TableHead>}
            {mountedColumns.progress && <TableHead className={getColumnClass('progress', 'w-[88px] text-xs font-semibold uppercase tracking-wider text-muted-foreground')}>Progress</TableHead>}
            <TableHead className="sticky right-0 z-20 w-[52px] bg-secondary/95 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody ref={tbodyRef}>
              {isLoading && testCases.length === 0 ? (
                Array.from({ length: Math.min(limit, 8) }, (_, index) => (
                  <TableRow key={`skeleton-${index}`} className="h-14 border-border/25 hover:bg-transparent">
                    <TableCell colSpan={tableColSpan} className="px-4 py-3">
                      <div className="grid grid-cols-[24px_48px_100px_minmax(120px,1fr)_100px] items-center gap-4" aria-hidden="true">
                        <Skeleton className="h-4 w-4 rounded" />
                        <Skeleton className="h-3 w-8" />
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className="h-3 w-full max-w-80" />
                        <Skeleton className="h-6 w-24 rounded-md" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : testCases.length === 0 ? (
                <TableRow className="border-border/30 hover:bg-transparent">
                  <TableCell colSpan={tableColSpan} className="py-12">
                    <EmptyState
                      icon={!selectedProject ? FolderOpen : hasActiveFilters ? FilterX : FileSpreadsheet}
                      title={!selectedProject ? 'Pilih project terlebih dahulu' : hasActiveFilters ? 'Tidak ada testcase yang cocok' : 'Belum ada testcase di project ini'}
                      description={
                        !selectedProject
                          ? 'Pilih project dari sidebar untuk melihat daftar skenario pengujian.'
                          : hasActiveFilters
                            ? 'Tidak ada testcase yang cocok dengan kata kunci atau filter status yang sedang aktif.'
                            : 'Mulai dengan menambahkan testcase baru atau import data skenario dari file spreadsheet.'
                      }
                      action={
                        selectedProject && hasActiveFilters
                          ? { label: 'Reset Filter', onClick: resetFilters, icon: X, variant: 'outline' }
                          : undefined
                      }
                    />
                  </TableCell>
                </TableRow>
              ) : (
                testCases.map((tc, index) => {
                  const record = testRecordById[tc.id];

                  const row = (
<TestCaseDataRow key={tc.id} tc={tc} index={index} record={record} isSelected={selectedIds.has(tc.id)} celebrating={celebrateId === tc.id} page={page} limit={limit} rowClassName={rowClassName} getColumnClass={getColumnClass} mountedColumns={mountedColumns} openViewDialog={openViewDialog} toggleSelect={toggleSelect} onQuickStatusChange={onQuickStatusChange} setCelebrateId={setCelebrateId} getStatusColor={getStatusColor} getStatusIcon={getStatusIcon} getStatusBadgeVariant={getStatusBadgeVariant} getTestTypeColor={getTestTypeColor} getPriorityColor={getPriorityColor} openEditDialog={openEditDialog} handleDuplicate={handleDuplicate} requestDelete={requestDelete} />
                  );
                  return process.env.NEXT_PUBLIC_QA_PERF_PROFILING === '1'
                    ? <React.Profiler key={tc.id} id={tc.id} onRender={recordRow}>{row}</React.Profiler>
                    : row;
                })
              )}
            </TableBody>
          </Table>
        <p id="cases-scroll-help" className="qa-table-scroll-help">Geser tabel untuk melihat semua kolom. ID dan aksi tetap terlihat.</p>
        {total > 0 && (
          <div className="flex flex-col gap-3 border-t border-border bg-card px-4 py-2.5 rounded-b-xl sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs text-muted-foreground tabular-nums">
                {showingLabel}
              </span>
              <span className="text-muted-foreground/30 hidden sm:inline">|</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Rows</span>
                <Select value={String(limit)} onValueChange={handleLimitChange}>
                  <SelectTrigger className="h-7 w-[72px] rounded-md border-border/60 bg-secondary/50 text-xs font-medium text-foreground shadow-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card shadow-lg border-border/60 text-foreground">
                    {TESTCASE_PAGE_SIZE_OPTIONS.map((size) => (
                      <SelectItem key={size} value={String(size)} className="text-xs font-medium">
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)} className="h-7 w-7 p-0 border-border/60 bg-transparent text-muted-foreground hover:text-foreground" aria-label="Halaman sebelumnya">
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              {totalPages > 1 && Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) pageNum = i + 1;
                else if (page <= 3) pageNum = i + 1;
                else if (page >= totalPages - 2) pageNum = totalPages - 4 + i;
                else pageNum = page - 2 + i;

                return (
                  <Button
                    key={pageNum}
                    variant={page === pageNum ? 'default' : 'outline'}
                    size="sm"
                    className={`h-7 w-7 p-0 text-xs font-medium ${page === pageNum ? 'border-primary bg-primary text-primary-foreground' : 'border-border/60 bg-transparent text-muted-foreground hover:text-foreground'}`}
                    onClick={() => setPage(pageNum)}
                  >
                    {pageNum}
                  </Button>
                );
              })}
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="h-7 w-7 p-0 border-border/60 bg-transparent text-muted-foreground hover:text-foreground" aria-label="Halaman berikutnya">
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
});
