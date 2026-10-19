'use client';

import React from 'react';
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
import { ConfettiBurst } from '@/components/ui/confetti-burst';
import { TestCaseStatusCell } from '@/components/TestCaseStatusCell';
import { cn } from '@/lib/utils';

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
                    data-state={isSelected ? 'selected' : undefined}
                    className={cn(
                      'group cursor-pointer border-border/30 transition-colors duration-150 hover:bg-secondary/40', rowClassName,
                      isSelected && 'bg-primary/[0.06] hover:bg-primary/10'
                    )}

                    title="Klik untuk melihat detail"
                    onClick={(e) => {
                      // Ignore clicks on interactive controls inside the row.
                      if ((e.target as HTMLElement).closest('button, a, input, select, [role="checkbox"], [role="combobox"], [role="menu"]')) return;
                      openViewDialog(tc);
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
                    <TableCell className="sticky left-10 z-10 bg-card text-center font-mono text-xs font-bold text-muted-foreground group-hover:bg-secondary">
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
                    <TableCell className="sticky left-[72px] z-10 w-[120px] min-w-[120px] max-w-[120px] overflow-hidden truncate whitespace-nowrap bg-card font-mono text-sm font-semibold text-foreground group-hover:bg-secondary" title={tc.testCaseId}>{tc.testCaseId}</TableCell>
                    <TableCell className="min-w-[120px] max-w-[144px] truncate whitespace-nowrap text-sm font-semibold text-foreground" title={tc.page}>{tc.page}</TableCell>
                    {mountedColumns.subMenu && <TableCell className={getColumnClass('subMenu', 'min-w-[128px] max-w-[144px] truncate whitespace-nowrap text-sm text-muted-foreground')} title={tc.subMenu || ''}>{tc.subMenu || '—'}</TableCell>}
                    {mountedColumns.weight && <TableCell className={getColumnClass('weight')}>
                      {tc.calculatedWeight != null ? (
                        <Badge variant="outline" className="rounded-md border-border/60 bg-secondary/50 text-xs font-mono text-muted-foreground">
                          {tc.calculatedWeight.toFixed(2)}%
                        </Badge>
                      ) : (
                      <span className="text-xs font-semibold text-muted-foreground">—</span>
                      )}
                    </TableCell>}
                    {mountedColumns.type && <TableCell className={getColumnClass('type')}>
                      <Badge variant="outline" className={cn("rounded-md text-xs font-bold", getTestTypeColor(tc.testType))}>
                        {tc.testType}
                      </Badge>
                    </TableCell>}
                    {mountedColumns.priority && <TableCell className={getColumnClass('priority')}>
                      <Badge variant="outline" className={cn("rounded-md text-xs font-bold", getPriorityColor(tc.priority))}>
                        {tc.priority}
                      </Badge>
                    </TableCell>}
                    {mountedColumns.action && <TableCell className={getColumnClass('action', 'min-w-[240px] max-w-[320px]')} title={tc.testAction}>
                      <p className="line-clamp-2 text-sm leading-5 text-foreground">{tc.testAction}</p>
                    </TableCell>}
                    {mountedColumns.status && <TableCell className={getColumnClass('status', 'min-w-[196px]')}>
                      {canEdit && onQuickStatusChange ? (
                        <div className="relative">
                          {celebrating && <ConfettiBurst radius={44} count={14} />}
                        <TestCaseStatusCell id={tc.id} displayId={tc.testCaseId} status={tc.status} onChange={onQuickStatusChange} celebrate={setCelebrateId} color={getStatusColor} icon={getStatusIcon} />
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
                        <span className="text-xs font-semibold text-muted-foreground">—</span>
                      )}
                    </TableCell>}
                    {mountedColumns.record && <TableCell className={getColumnClass('record', 'px-3')}>
                      {record ? (
                        <div className="space-y-1">
                          <div className="flex flex-wrap gap-1">
                            {record.hasAutomationRun && (
                              <Badge className="rounded-md bg-indigo-500/10 text-xs font-semibold text-status-in-progress border-indigo-500/20 shadow-none uppercase">
                                Auto
                              </Badge>
                            )}
                            {record.hasManualCapture && (
                              <Badge className="rounded-md bg-teal-500/10 text-xs font-semibold text-bug-fixed border-teal-500/20 shadow-none uppercase">
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
                        <span className="text-xs font-bold text-muted-foreground">{tc.progress}%</span>
                      </div>
                    </TableCell>}
                    <TableCell className="sticky right-0 z-10 bg-card group-hover:bg-secondary">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button aria-label={`Actions for ${tc.testCaseId}`} title={`Actions for ${tc.testCaseId}`} variant="ghost" size="icon" className="size-9 text-muted-foreground">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-card elevation-3 border-border/60 text-foreground">
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
    getPriorityColor, getTestTypeColor, handleLimitChange, setPage, rowClassName,
  } = props;

  return (
    <>
      <div className="relative min-w-0 rounded-xl border border-border bg-card" aria-busy={Boolean(isLoading)}>
      {isLoading && testCases.length > 0 && (
        <div className="pointer-events-none sticky top-1 z-30 ml-auto -mb-8 mr-2 flex h-8 w-fit items-center gap-2 rounded-md border border-border bg-card px-2 text-xs text-muted-foreground shadow-sm" role="status" aria-label="Memperbarui test cases">
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent motion-reduce:animate-none" />
          Memperbarui…
        </div>
      )}
      <Table className="qa-data-table w-full min-w-[720px] md:min-w-[1000px] xl:min-w-[1320px] table-auto"
        containerClassName="max-h-[max(180px,calc(100dvh-420px))] overflow-auto rounded-t-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
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
            <TableHead className="sticky left-[72px] z-20 w-[120px] min-w-[120px] cursor-pointer select-none bg-secondary/95 text-xs font-semibold uppercase tracking-wider text-muted-foreground" onClick={() => toggleSort('testCaseId')}>
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
        <TableBody>
              {isLoading && testCases.length === 0 ? (
                Array.from({ length: Math.min(limit, 8) }, (_, index) => (
                  <TableRow key={`skeleton-${index}`} className="h-14 border-border/25 hover:bg-transparent">
                    <TableCell colSpan={tableColSpan} className="px-4 py-3">
                      <div className="grid grid-cols-[24px_48px_100px_minmax(120px,1fr)_100px] items-center gap-4" aria-hidden="true">
                        <span className="h-4 w-4 animate-pulse rounded bg-secondary motion-reduce:animate-none" />
                        <span className="h-3 w-8 animate-pulse rounded bg-secondary motion-reduce:animate-none" />
                        <span className="h-3 w-20 animate-pulse rounded bg-secondary motion-reduce:animate-none" />
                        <span className="h-3 w-full max-w-80 animate-pulse rounded bg-secondary motion-reduce:animate-none" />
                        <span className="h-6 w-24 animate-pulse rounded-md bg-secondary motion-reduce:animate-none" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : testCases.length === 0 ? (
                <TableRow className="border-border/30 hover:bg-transparent">
                  <TableCell colSpan={tableColSpan} className="h-44 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      {hasActiveFilters ? <Search className="h-9 w-9 opacity-25" /> : <FileSpreadsheet className="h-9 w-9 opacity-25" />}
                      <p className="text-sm font-bold uppercase tracking-wider">
                        {!selectedProject ? 'Pilih project dulu' : hasActiveFilters ? 'Tidak ada hasil' : 'Belum ada test case'}
                      </p>
                      <p className="max-w-md text-xs font-semibold opacity-65">
                        {!selectedProject
                          ? 'Pilih project dari sidebar untuk melihat data.'
                          : hasActiveFilters
                            ? 'Tidak ada test case yang cocok dengan pencarian atau filter aktif.'
                            : 'Klik Add Test Case atau import Excel untuk mengisi daftar test case.'}
                      </p>
                      {selectedProject && hasActiveFilters && (
                        <Button variant="outline" size="sm" onClick={resetFilters} className="mt-1 h-8 rounded-lg gap-1.5 text-xs font-semibold">
                          <X className="h-3.5 w-3.5" /> Reset filter
                        </Button>
                      )}
                    </div>
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
      </div>
      {total > 0 && (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card px-3 py-3 pr-20 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground tabular-nums">
              Halaman {page} dari {totalPages} <span className="mx-2 opacity-20">|</span> {total} test cases
            </p>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Rows</span>
              <Select value={String(limit)} onValueChange={handleLimitChange}>
                <SelectTrigger className="h-8 w-[82px] rounded-md border-border/60 bg-secondary/50 text-xs font-bold text-foreground shadow-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card elevation-3 border-border/60 text-foreground">
                  {TESTCASE_PAGE_SIZE_OPTIONS.map((size) => (
                    <SelectItem key={size} value={String(size)} className="text-xs font-bold">
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)} className="h-8 border-border/60 bg-secondary/50 text-muted-foreground" aria-label="Halaman sebelumnya">
              <ChevronLeft className="w-4 h-4" />
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
                  className={`h-8 w-8 p-0 text-xs font-bold ${page === pageNum ? 'border-primary bg-primary text-primary-foreground' : 'border-border/60 bg-secondary/50 text-muted-foreground'}`}
                  onClick={() => setPage(pageNum)}
                >
                  {pageNum}
                </Button>
              );
            })}
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="h-8 border-border/60 bg-secondary/50 text-muted-foreground" aria-label="Halaman berikutnya">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
});
