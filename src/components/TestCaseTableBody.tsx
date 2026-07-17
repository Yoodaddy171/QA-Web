'use client';

import React from 'react';
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
import { cn } from '@/lib/utils';

type TestCaseTableBodyProps = Record<string, any>;
const TESTCASE_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const formatLastRun = (dateStr: string | null) => {
  if (!dateStr) return 'Belum dites';
  return new Date(dateStr).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' });
};

export function TestCaseTableBody(props: TestCaseTableBodyProps) {
  const {
    selectedProject, testCases, selectedIds, testRecordById, page, limit, total, totalPages, tableColSpan,
    isLoading, hasActiveFilters, resetFilters, toggleSelectAll, toggleSort, getColumnClass,
    openViewDialog, openEditDialog, handleDuplicate, requestDelete, toggleSelect, onQuickStatusChange,
    celebrateId, setCelebrateId, getStatusColor, getStatusIcon, getStatusBadgeVariant,
    getPriorityColor, getTestTypeColor, handleLimitChange, setPage, rowClassName,
  } = props;

  return (
    <>
      <div className="relative max-h-[70vh] overflow-auto rounded-xl border border-border/70 bg-card/95 shadow-sm" aria-busy={Boolean(isLoading)}>
      {isLoading && testCases.length > 0 && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/45 backdrop-blur-[1px]" role="status" aria-label="Memperbarui test cases">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent motion-reduce:animate-none" />
        </div>
      )}
      <Table className="w-full table-auto">
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
            <TableHead className="sticky left-10 z-20 w-10 bg-secondary/95 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">No</TableHead>
            <TableHead className="sticky left-[72px] z-20 w-[120px] min-w-[120px] cursor-pointer select-none bg-secondary/95 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground" onClick={() => toggleSort('testCaseId')}>
              <div className="flex items-center gap-1">ID <ArrowUpDown className="w-3 h-3 text-primary" /></div>
            </TableHead>
            <TableHead className="w-[110px] cursor-pointer select-none text-[10px] font-semibold uppercase tracking-wider text-muted-foreground" onClick={() => toggleSort('page')}>
              <div className="flex items-center gap-1">Page <ArrowUpDown className="w-3 h-3 text-primary" /></div>
            </TableHead>
            <TableHead className={getColumnClass('subMenu', 'w-[100px] text-[10px] font-semibold uppercase tracking-wider text-muted-foreground')}>Sub Menu</TableHead>
            <TableHead className={getColumnClass('weight', 'w-[68px] text-[10px] font-semibold uppercase tracking-wider text-muted-foreground')}>Weight</TableHead>
            <TableHead className={getColumnClass('type', 'w-[80px] text-[10px] font-semibold uppercase tracking-wider text-muted-foreground')}>Type</TableHead>
            <TableHead className={getColumnClass('priority', 'w-[84px] text-[10px] font-semibold uppercase tracking-wider text-muted-foreground')}>Priority</TableHead>
            <TableHead className={getColumnClass('action', 'text-[10px] font-semibold uppercase tracking-wider text-muted-foreground')}>Test Action</TableHead>
            <TableHead className={getColumnClass('status', 'w-[140px] text-[10px] font-semibold uppercase tracking-wider text-muted-foreground')}>Status</TableHead>
            <TableHead className={getColumnClass('result', 'w-[120px] text-[10px] font-semibold uppercase tracking-wider text-muted-foreground')}>Result</TableHead>
            <TableHead className={getColumnClass('record', 'w-[140px] text-[10px] font-semibold uppercase tracking-wider text-muted-foreground')}>Test Record</TableHead>
            <TableHead className={getColumnClass('progress', 'w-[88px] text-[10px] font-semibold uppercase tracking-wider text-muted-foreground')}>Progress</TableHead>
            <TableHead className="sticky right-0 z-20 w-[52px] bg-secondary/95 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Action</TableHead>
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
                      {hasActiveFilters ? <Search className="h-9 w-9 opacity-25 animate-bounce [animation-duration:2.2s] motion-reduce:animate-none" /> : <FileSpreadsheet className="h-9 w-9 opacity-25 animate-bounce [animation-duration:2.2s] motion-reduce:animate-none" />}
                      <p className="text-sm font-bold uppercase tracking-wider">
                        {!selectedProject ? 'Pilih project dulu' : hasActiveFilters ? 'Tidak ada hasil' : 'Belum ada test case'}
                      </p>
                      <p className="max-w-md text-[11px] font-semibold opacity-65">
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

                  return (
                  <TableRow
                    key={tc.id}
                    className={cn(
                      'group cursor-pointer border-border/30 transition-colors duration-150 hover:bg-secondary/40 animate-in fade-in slide-in-from-bottom-1 fill-mode-backwards', rowClassName,
                      selectedIds.has(tc.id) && 'bg-primary/[0.06] hover:bg-primary/10'
                    )}
                    style={{ animationDelay: `${Math.min(index, 10) * 18}ms`, animationDuration: '180ms' }}
                    title="Klik untuk melihat detail"
                    onClick={(e) => {
                      // Ignore clicks on interactive controls inside the row.
                      if ((e.target as HTMLElement).closest('button, a, input, select, [role="checkbox"], [role="combobox"], [role="menu"]')) return;
                      openViewDialog(tc);
                    }}
                  >
                    <TableCell className="sticky left-0 z-10 bg-card pl-4 group-hover:bg-secondary">
                      <Checkbox
                        checked={selectedIds.has(tc.id)}
                        onCheckedChange={() => toggleSelect(tc.id)}
                        className="border-border/50 data-[state=checked]:bg-primary data-[state=checked]:border-primary rounded"
                      />
                    </TableCell>
                    <TableCell className="sticky left-10 z-10 bg-card text-center font-mono text-xs font-bold text-muted-foreground group-hover:bg-secondary">
                      {(page - 1) * limit + index + 1}
                    </TableCell>
                    <TableCell className="sticky left-[72px] z-10 w-[120px] min-w-[120px] max-w-[120px] overflow-hidden truncate whitespace-nowrap bg-card font-mono text-sm font-semibold text-foreground group-hover:bg-secondary" title={tc.testCaseId}>{tc.testCaseId}</TableCell>
                    <TableCell className="max-w-[110px] truncate text-sm font-bold text-foreground" title={tc.page}>{tc.page}</TableCell>
                    <TableCell className={getColumnClass('subMenu', 'text-muted-foreground text-[13px] font-medium max-w-[100px] truncate')} title={tc.subMenu || ''}>{tc.subMenu || '-'}</TableCell>
                    <TableCell className={getColumnClass('weight')}>
                      {tc.calculatedWeight != null ? (
                        <Badge variant="outline" className="rounded-md border-border/60 bg-secondary/50 text-[10px] font-mono text-muted-foreground">
                          {tc.calculatedWeight.toFixed(2)}%
                        </Badge>
                      ) : (
                      <span className="text-xs font-semibold text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className={getColumnClass('type')}>
                      <Badge variant="outline" className={cn("rounded-md text-[10px] font-bold", getTestTypeColor(tc.testType))}>
                        {tc.testType}
                      </Badge>
                    </TableCell>
                    <TableCell className={getColumnClass('priority')}>
                      <Badge variant="outline" className={cn("rounded-md text-[10px] font-bold", getPriorityColor(tc.priority))}>
                        {tc.priority}
                      </Badge>
                    </TableCell>
                    <TableCell className={getColumnClass('action', 'max-w-[180px]')}>
                      <p className="truncate text-sm text-muted-foreground group-hover:text-foreground transition-colors">{tc.testAction}</p>
                    </TableCell>
                    <TableCell className={getColumnClass('status')}>
                      {onQuickStatusChange ? (
                        <div className="relative">
                          {celebrateId === tc.id && <ConfettiBurst radius={44} count={14} />}
                        <Select value={tc.status} onValueChange={(val) => { if (val === 'DONE' && tc.status !== 'DONE') setCelebrateId(tc.id); onQuickStatusChange(tc.id, val); }}>
                          <SelectTrigger key={tc.status} className={cn("h-7 w-[130px] rounded-lg text-[10px] font-bold shadow-none gap-1 px-2 animate-in zoom-in-90 duration-200", getStatusColor(tc.status))}>
                            {getStatusIcon(tc.status)} <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl bg-card border-border/60 elevation-3">
                            <SelectItem value="DONE" className="text-[10px] font-bold rounded-lg">DONE</SelectItem>
                            <SelectItem value="NOT DONE" className="text-[10px] font-bold rounded-lg">NOT DONE</SelectItem>
                            <SelectItem value="IN PROGRESS" className="text-[10px] font-bold rounded-lg">IN PROGRESS</SelectItem>
                            <SelectItem value="BLOCKED" className="text-[10px] font-bold rounded-lg">BLOCKED</SelectItem>
                            <SelectItem value="FAILED" className="text-[10px] font-bold rounded-lg">FAILED</SelectItem>
                            <SelectItem value="READY TO RETEST" className="text-[10px] font-bold rounded-lg">READY TO RETEST</SelectItem>
                            <SelectItem value="TBA" className="text-[10px] font-bold rounded-lg">TBA</SelectItem>
                          </SelectContent>
                        </Select>
                        </div>
                      ) : (
                        <Badge variant={getStatusBadgeVariant(tc.status)} className="gap-1 text-[10px] font-semibold">
                          {getStatusIcon(tc.status)} {tc.status}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className={getColumnClass('result', 'px-3')}>
                      {tc.actualResult ? (
                        <Badge variant={tc.actualResult === 'As Expected' ? 'success' : tc.actualResult === 'Not As Expected' ? 'failed' : 'outline'} className="text-[10px] font-semibold">
                          {tc.actualResult}
                        </Badge>
                      ) : (
                        <span className="text-xs font-semibold text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className={getColumnClass('record', 'px-3')}>
                      {record ? (
                        <div className="space-y-1">
                          <div className="flex flex-wrap gap-1">
                            {record.hasAutomationRun && (
                              <Badge className="rounded-md bg-indigo-500/10 text-[9px] font-semibold text-indigo-400 border-indigo-500/20 shadow-none uppercase">
                                Auto
                              </Badge>
                            )}
                            {record.hasManualCapture && (
                              <Badge className="rounded-md bg-teal-500/10 text-[9px] font-semibold text-teal-400 border-teal-500/20 shadow-none uppercase">
                                Manual
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-[9px] font-bold text-muted-foreground uppercase tracking-tighter">
                            <CalendarClock className="h-2.5 w-2.5" />
                            {formatLastRun(record.lastRunAt)}
                          </div>
                        </div>
                      ) : (
                        <Badge variant="outline" className="rounded-md border-border/60 bg-secondary/50 text-[9px] font-semibold text-muted-foreground uppercase">
                          No Records
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className={getColumnClass('progress')}>
                      <div className="flex items-center gap-2">
                        <Progress value={tc.progress} className="h-1 w-12 bg-secondary/50" />
                        <span className="text-[10px] font-bold text-muted-foreground">{tc.progress}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="sticky right-0 z-10 bg-card group-hover:bg-secondary">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button aria-label={`Actions for ${tc.testCaseId}`} title={`Actions for ${tc.testCaseId}`} variant="ghost" size="sm" className="h-7 w-7 rounded-md p-0 text-muted-foreground opacity-45 transition-opacity duration-150 hover:bg-secondary hover:text-foreground hover:opacity-100 group-hover:opacity-100 focus-visible:opacity-100">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-card elevation-3 border-border/60 text-foreground">
                          <DropdownMenuItem onClick={() => openViewDialog(tc)}>
                            <Eye className="w-4 h-4 mr-2" /> Lihat Detail
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEditDialog(tc)}>
                            <Edit3 className="w-4 h-4 mr-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDuplicate(tc)}>
                            <Copy className="w-4 h-4 mr-2" /> Duplikasi
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => requestDelete(tc)} className="text-red-400 focus:text-red-300">
                            <Trash2 className="w-4 h-4 mr-2" /> Hapus
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
      </div>
      {total > 0 && (
        <div className="flex flex-col gap-3 rounded-lg border border-white/5 bg-secondary/50 px-3 py-2 shadow-xl sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground tabular-nums">
              Halaman {page} dari {totalPages} <span className="mx-2 opacity-20">|</span> {total} test cases
            </p>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Rows</span>
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
                  className={`h-8 w-8 p-0 text-[11px] font-bold ${page === pageNum ? 'border-primary bg-primary text-primary-foreground' : 'border-border/60 bg-secondary/50 text-muted-foreground'}`}
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
}
