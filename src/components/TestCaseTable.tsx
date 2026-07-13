'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpDown, CalendarClock, ChevronLeft, ChevronRight, Copy, Edit3, Eye, FileDown,
  FileSpreadsheet, MoreHorizontal, Plus, RefreshCw, Search, Settings2,
  Sparkles, Trash2, Upload, X
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ConfettiBurst } from '@/components/ui/confetti-burst';
import { cn } from '@/lib/utils';
import type { TestCase, TestCaseTableProps } from './TestCaseTable.types';
import { TestCaseTableBody } from './TestCaseTableBody';
export type { TestCase } from './TestCaseTable.types';

type TestCaseColumnKey = 'subMenu' | 'weight' | 'type' | 'priority' | 'action' | 'status' | 'result' | 'record' | 'progress';

const TESTCASE_COLUMN_OPTIONS: Array<{ key: TestCaseColumnKey; label: string; responsiveClass?: string }> = [
  { key: 'subMenu', label: 'Sub Menu', responsiveClass: 'hidden lg:table-cell' },
  { key: 'weight', label: 'Bobot', responsiveClass: 'hidden xl:table-cell' },
  { key: 'type', label: 'Tipe', responsiveClass: 'hidden lg:table-cell' },
  { key: 'priority', label: 'Prioritas', responsiveClass: 'hidden md:table-cell' },
  { key: 'action', label: 'Test Action', responsiveClass: 'hidden md:table-cell' },
  { key: 'status', label: 'Status' },
  { key: 'result', label: 'Hasil', responsiveClass: 'hidden xl:table-cell' },
  { key: 'record', label: 'Test Record', responsiveClass: 'hidden lg:table-cell' },
  { key: 'progress', label: 'Progress', responsiveClass: 'hidden lg:table-cell' },
];

const DEFAULT_TESTCASE_COLUMNS = TESTCASE_COLUMN_OPTIONS.reduce<Record<TestCaseColumnKey, boolean>>((columns, option) => {
  columns[option.key] = true;
  return columns;
}, {} as Record<TestCaseColumnKey, boolean>);

const TESTCASE_COLUMN_STORAGE_KEY = 'qaDesk.testcaseTable.columns.v1';
const TESTCASE_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const getInitialTestCaseColumns = () => {
  if (typeof window === 'undefined') return DEFAULT_TESTCASE_COLUMNS;

  try {
    const stored = window.localStorage.getItem(TESTCASE_COLUMN_STORAGE_KEY);
    if (!stored) return DEFAULT_TESTCASE_COLUMNS;
    const parsed = JSON.parse(stored) as Partial<Record<TestCaseColumnKey, boolean>>;
    return { ...DEFAULT_TESTCASE_COLUMNS, ...parsed };
  } catch {
    return DEFAULT_TESTCASE_COLUMNS;
  }
};

export function TestCaseTable({
  selectedProject,
  modules,
  hasUnassignedModule,
  testCases,
  search,
  filterStatus,
  filterTestType,
  filterPriority,
  filterModule,
  filterSubMenu,
  subMenuOptions,
  selectedIds,
  page,
  limit,
  total,
  totalPages,
  testRecordById,
  fileInputRef,
  aiEnabled = true,
  setSearch,
  setFilterStatus,
  setFilterTestType,
  setFilterPriority,
  setFilterModule,
  setFilterSubMenu,
  setPage,
  setLimit,
  setShowBulkAction,
  setShowDeleteConfirm,
  openCreateDialog,
  openAIDialog,
  openImportDialog,
  handleImportExcel,
  handleExportExcel,
  refreshList,
  toggleSelectAll,
  toggleSelect,
  toggleSort,
  openViewDialog,
  openEditDialog,
  handleDuplicate,
  requestDelete,
  getStatusColor,
  getStatusIcon,
  getStatusBadgeVariant,
  getPriorityColor,
  getTestTypeColor,
  isLoading,
  onQuickStatusChange,
}: TestCaseTableProps) {
  const [visibleColumns, setVisibleColumns] = useState<Record<TestCaseColumnKey, boolean>>(getInitialTestCaseColumns);
  // "Quest complete": row id that just got flipped to DONE, celebrated briefly.
  const [celebrateId, setCelebrateId] = useState<string | null>(null);
  useEffect(() => {
    if (!celebrateId) return;
    const timer = window.setTimeout(() => setCelebrateId(null), 1100);
    return () => window.clearTimeout(timer);
  }, [celebrateId]);
  const resetPage = () => setPage(1);
  const hasActiveFilters = Boolean(search)
    || filterStatus !== 'all'
    || filterTestType !== 'all'
    || filterPriority !== 'all'
    || filterModule !== 'all'
    || filterSubMenu !== 'all';
  const resetFilters = () => {
    setSearch('');
    setFilterStatus('all');
    setFilterTestType('all');
    setFilterPriority('all');
    setFilterModule('all');
    setFilterSubMenu('all');
    setPage(1);
  };
  const selectTriggerClass = 'h-9 rounded-md border-border/60 bg-secondary/50 text-foreground text-sm shadow-sm';
  const toolbarButtonClass = 'h-9 rounded-md gap-1.5 font-semibold';
  const formatLastRun = (dateStr: string | null) => {
    if (!dateStr) return 'Belum dites';
    return new Date(dateStr).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' });
  };
  const showingLabel = total !== testCases.length
    ? `Menampilkan ${testCases.length} dari ${total} data`
    : `Menampilkan ${testCases.length} data`;
  const shownOptionalColumnCount = useMemo(
    () => TESTCASE_COLUMN_OPTIONS.filter((column) => visibleColumns[column.key]).length,
    [visibleColumns]
  );
  const tableColSpan = 4 + shownOptionalColumnCount + 1;
  const isColumnVisible = (key: TestCaseColumnKey) => visibleColumns[key];
  const getColumnClass = (key: TestCaseColumnKey, baseClass = '') => {
    const option = TESTCASE_COLUMN_OPTIONS.find((column) => column.key === key);
    return cn(!isColumnVisible(key) && 'hidden', isColumnVisible(key) && option?.responsiveClass, baseClass);
  };
  const setColumnVisible = (key: TestCaseColumnKey, checked: boolean) => {
    setVisibleColumns((current) => ({ ...current, [key]: checked }));
  };
  const resetColumns = () => setVisibleColumns(DEFAULT_TESTCASE_COLUMNS);
  const handleLimitChange = (value: string) => {
    setLimit(Number(value));
    setPage(1);
  };

  const tableBodyProps = {
    selectedProject, testCases, selectedIds, testRecordById, page, limit, total, totalPages, tableColSpan,
    isLoading, hasActiveFilters, resetFilters, toggleSelectAll, toggleSort, getColumnClass,
    openViewDialog, openEditDialog, handleDuplicate, requestDelete, toggleSelect, onQuickStatusChange,
    celebrateId, setCelebrateId, getStatusColor, getStatusIcon, getStatusBadgeVariant,
    getPriorityColor, getTestTypeColor, handleLimitChange, setPage,
  };

  useEffect(() => {
    window.localStorage.setItem(TESTCASE_COLUMN_STORAGE_KEY, JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="min-w-0 space-y-4"
    >      <div className="rounded-2xl border border-border/40 bg-card p-4 shadow-sm">
        <div className="flex min-w-0 flex-col gap-3 lg:flex-row">
        <div className="relative min-w-0 flex-1">
          <Search className={cn('absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary', isLoading && 'animate-bounce [animation-duration:0.7s] motion-reduce:animate-none')} />
          <Input
            data-search-input
            placeholder="Cari test case... (ID, Page, Action, Steps)  [/]"
            value={search}
            onChange={(e) => { setSearch(e.target.value); resetPage(); }}
            className="h-9.5 rounded-xl border border-border/50 bg-secondary/35 text-foreground placeholder:text-muted-foreground pl-9 shadow-xs hover:border-border transition duration-200 focus-visible:ring-2 focus-visible:ring-primary/20 text-xs font-medium"
          />
        </div>
        <div className="grid min-w-0 grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); resetPage(); }}>
            <SelectTrigger className="h-9.5 w-full border border-border/50 bg-secondary/35 text-foreground rounded-xl text-xs font-semibold shadow-xs hover:bg-secondary/65 transition duration-200 sm:w-[145px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent className="bg-card border border-border/50 text-foreground rounded-xl shadow-lg">
              <SelectItem value="all" className="rounded-lg text-xs font-medium">All Status</SelectItem>
              <SelectItem value="DONE" className="rounded-lg text-xs font-medium">Done</SelectItem>
              <SelectItem value="NOT DONE" className="rounded-lg text-xs font-medium">Not Done</SelectItem>
              <SelectItem value="IN PROGRESS" className="rounded-lg text-xs font-medium">In Progress</SelectItem>
              <SelectItem value="BLOCKED" className="rounded-lg text-xs font-medium">Blocked</SelectItem>
              <SelectItem value="FAILED" className="rounded-lg text-xs font-medium">Failed</SelectItem>
              <SelectItem value="READY TO RETEST" className="rounded-lg text-xs font-medium">Ready to Retest</SelectItem>
              <SelectItem value="TBA" className="rounded-lg text-xs font-medium">TBA (To Be Announced)</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterTestType} onValueChange={(v) => { setFilterTestType(v); resetPage(); }}>
            <SelectTrigger className="h-9.5 w-full border border-border/50 bg-secondary/35 text-foreground rounded-xl text-xs font-semibold shadow-xs hover:bg-secondary/65 transition duration-200 sm:w-[135px]"><SelectValue placeholder="Test Type" /></SelectTrigger>
            <SelectContent className="bg-card border border-border/50 text-foreground rounded-xl shadow-lg">
              <SelectItem value="all" className="rounded-lg text-xs font-medium">All Types</SelectItem>
              <SelectItem value="Positive" className="rounded-lg text-xs font-medium">Positive</SelectItem>
              <SelectItem value="Negative" className="rounded-lg text-xs font-medium">Negative</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterPriority} onValueChange={(v) => { setFilterPriority(v); resetPage(); }}>
            <SelectTrigger className="h-9.5 w-full border border-border/50 bg-secondary/35 text-foreground rounded-xl text-xs font-semibold shadow-xs hover:bg-secondary/65 transition duration-200 sm:w-[145px]"><SelectValue placeholder="Priority" /></SelectTrigger>
            <SelectContent className="bg-card border border-border/50 text-foreground rounded-xl shadow-lg">
              <SelectItem value="all" className="rounded-lg text-xs font-medium">All Priorities</SelectItem>
              <SelectItem value="Critical" className="rounded-lg text-xs font-medium">Critical</SelectItem>
              <SelectItem value="High" className="rounded-lg text-xs font-medium">High</SelectItem>
              <SelectItem value="Medium" className="rounded-lg text-xs font-medium">Medium</SelectItem>
              <SelectItem value="Low" className="rounded-lg text-xs font-medium">Low</SelectItem>
            </SelectContent>
          </Select>
          {(modules.length > 0 || hasUnassignedModule || filterModule === 'unassigned') && (
            <Select value={filterModule} onValueChange={(v) => { setFilterModule(v); resetPage(); }}>
              <SelectTrigger className="h-9.5 w-full border border-border/50 bg-secondary/35 text-foreground rounded-xl text-xs font-semibold shadow-xs hover:bg-secondary/65 transition duration-200 sm:w-[165px]"><SelectValue placeholder="Module" /></SelectTrigger>
              <SelectContent className="bg-card border border-border/50 text-foreground rounded-xl shadow-lg">
                <SelectItem value="all" className="rounded-lg text-xs font-medium">All Modules</SelectItem>
                {modules.map((m) => (
                  <SelectItem key={m.id} value={m.id} className="rounded-lg text-xs font-medium">{m.name}</SelectItem>
                ))}
                {(hasUnassignedModule || filterModule === 'unassigned') && (
                  <SelectItem value="unassigned" className="rounded-lg text-xs font-medium">No Module</SelectItem>
                )}
              </SelectContent>
            </Select>
          )}
          <Select value={filterSubMenu} onValueChange={(v) => { setFilterSubMenu(v); resetPage(); }}>
            <SelectTrigger className="h-9.5 w-full border border-border/50 bg-secondary/35 text-foreground rounded-xl text-xs font-semibold shadow-xs hover:bg-secondary/65 transition duration-200 sm:w-[165px]">
              <SelectValue placeholder="Sub Menu" />
            </SelectTrigger>
            <SelectContent className="bg-card border border-border/50 text-foreground rounded-xl shadow-lg">
              <SelectItem value="all" className="rounded-lg text-xs font-medium">All Sub Menus</SelectItem>
              {subMenuOptions.map((subMenu) => (
                <SelectItem key={subMenu || '__empty__'} value={subMenu || '__empty__'} className="rounded-lg text-xs font-medium">
                  {subMenu || 'No Sub Menu'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={resetFilters}
            disabled={!hasActiveFilters}
            className="h-9.5 rounded-xl gap-1.5 border border-border/50 bg-secondary/35 text-xs font-bold text-foreground shadow-xs hover:bg-secondary disabled:opacity-40 transition duration-200"
          >
            <X className="h-3.5 w-3.5" />
            Reset
          </Button>
        </div>
        </div>

      <div className="mt-3 flex min-w-0 flex-col gap-3 border-t border-border/40 pt-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="grid min-w-0 grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <Button onClick={openCreateDialog} size="sm" variant="majestic" title="Shortcut: N" className="group h-9 rounded-xl gap-1.5 font-bold shadow-sm transition duration-200">
            <Plus className="w-4 h-4 transition-transform duration-300 group-hover:rotate-90 motion-reduce:group-hover:transform-none" /> Add Test Case
            <kbd className="ml-0.5 hidden rounded border border-primary-foreground/30 px-1 font-mono text-[9px] leading-4 opacity-70 lg:inline-block">N</kbd>
          </Button>
          {aiEnabled && (
            <Button onClick={openAIDialog} size="sm" className="group h-9 rounded-xl gap-1.5 font-bold bg-violet-500/10 text-violet-500 border border-violet-500/20 hover:bg-violet-500/20 dark:text-violet-400 transition duration-200">
              <Sparkles className="w-4 h-4 transition-transform duration-300 group-hover:scale-125 group-hover:rotate-12 motion-reduce:group-hover:transform-none" /> Generate AI
            </Button>
          )}
          {selectedIds.size > 0 && (
            <>
              <Button onClick={() => setShowBulkAction(true)} variant="outline" size="sm" className="h-9 rounded-xl gap-1.5 font-bold border-border/50 bg-secondary/35 text-foreground hover:bg-secondary/65 transition">
                <Settings2 className="w-4 h-4" /> Update Status ({selectedIds.size})
              </Button>
              <Button onClick={() => setShowDeleteConfirm(true)} variant="destructive" size="sm" className="h-9 rounded-xl gap-1.5 font-bold shadow-md shadow-red-900/10 transition duration-200">
                <Trash2 className="w-4 h-4" /> Delete ({selectedIds.size})
              </Button>
            </>
          )}
        </div>
        <div className="grid min-w-0 grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center lg:justify-end">
          <Badge key={showingLabel} variant="outline" className="col-span-2 h-9 justify-center rounded-xl border border-border/50 bg-muted/60 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:col-span-1 animate-in zoom-in-95 duration-200 tabular-nums">
            {showingLabel}
          </Badge>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 rounded-xl gap-1.5 font-bold border border-border/50 bg-secondary/35 text-foreground hover:bg-secondary/65 transition">
                <Settings2 className="w-4 h-4" /> Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 bg-card border border-border/50 text-foreground rounded-2xl shadow-xl">
              <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-3 py-2">
                Kolom Tabel
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-border/40" />
              {TESTCASE_COLUMN_OPTIONS.map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.key}
                  checked={visibleColumns[column.key]}
                  onCheckedChange={(checked) => setColumnVisible(column.key, Boolean(checked))}
                  className="text-xs font-semibold rounded-lg mx-1 my-0.5"
                >
                  {column.label}
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={resetColumns} className="text-xs font-bold">
                Reset columns
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleImportExcel}
          />
          <Button onClick={openImportDialog} variant="outline" size="sm" className="h-9 rounded-xl gap-1.5 font-bold border border-border/50 bg-secondary/35 text-foreground hover:bg-secondary/65 transition">
            <Upload className="w-4 h-4 text-primary" /> Import Excel
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 rounded-xl gap-1.5 font-bold border border-border/50 bg-secondary/35 text-foreground hover:bg-secondary/65 transition">
                <FileSpreadsheet className="w-4 h-4 text-primary" /> Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-card border border-border/50 text-foreground rounded-2xl shadow-xl">
              <DropdownMenuItem onClick={() => handleExportExcel('xlsx')} className="rounded-lg text-xs font-semibold mx-1 my-0.5">
                <FileDown className="w-4 h-4 mr-2 text-primary" /> Export XLSX (1 Sheet)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { if (!selectedProject) return; window.open(`/api/excel?projectId=${selectedProject}&format=xlsx&multiSheet=true`, '_blank'); }} className="rounded-lg text-xs font-semibold mx-1 my-0.5">
                <FileDown className="w-4 h-4 mr-2 text-primary" /> Export XLSX (Per Module)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExportExcel('csv')} className="rounded-lg text-xs font-semibold mx-1 my-0.5">
                <FileDown className="w-4 h-4 mr-2 text-primary" /> Export CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button aria-label="Refresh test cases" title="Refresh test cases (shortcut: R)" onClick={refreshList} variant="ghost" size="sm" className="h-9 w-9 rounded-xl border border-border/50 p-0 text-muted-foreground hover:text-foreground hover:bg-secondary/65 transition">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>
      </div>

      <TestCaseTableBody {...tableBodyProps} />

    </motion.div>
  );
}
