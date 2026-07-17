'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpDown, Bookmark, CalendarClock, ChevronLeft, ChevronRight, Copy, Edit3, Eye, FileDown,
  FileSpreadsheet, MoreHorizontal, Plus, RefreshCw, Search, Settings2, SlidersHorizontal,
  Sparkles, Trash2, Upload, UserRound, X
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
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
import { DateRangePicker } from '@/components/ui/date-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { TestCase, TestCaseTableProps } from './TestCaseTable.types';
import { TestCaseTableBody } from './TestCaseTableBody';
import { DataTableDensityToggle } from '@/components/DataTableDensityToggle';
import { useTableDensity } from '@/hooks/use-table-density';
export type { TestCase } from './TestCaseTable.types';

type TestCaseColumnKey = 'subMenu' | 'weight' | 'type' | 'priority' | 'action' | 'status' | 'result' | 'record' | 'progress';

const TESTCASE_COLUMN_OPTIONS: Array<{ key: TestCaseColumnKey; label: string; responsiveClass?: string }> = [
  { key: 'subMenu', label: 'Sub Menu', responsiveClass: 'hidden lg:table-cell' },
  { key: 'weight', label: 'Bobot', responsiveClass: 'hidden 2xl:table-cell' },
  { key: 'type', label: 'Tipe', responsiveClass: 'hidden lg:table-cell' },
  { key: 'priority', label: 'Prioritas', responsiveClass: 'hidden md:table-cell' },
  { key: 'action', label: 'Test Action', responsiveClass: 'hidden md:table-cell' },
  { key: 'status', label: 'Status' },
  { key: 'result', label: 'Hasil', responsiveClass: 'hidden xl:table-cell' },
  { key: 'record', label: 'Test Record', responsiveClass: 'hidden 2xl:table-cell' },
  { key: 'progress', label: 'Progress', responsiveClass: 'hidden 2xl:table-cell' },
];

const DEFAULT_TESTCASE_COLUMNS = TESTCASE_COLUMN_OPTIONS.reduce<Record<TestCaseColumnKey, boolean>>((columns, option) => {
  columns[option.key] = true;
  return columns;
}, {} as Record<TestCaseColumnKey, boolean>);

const TESTCASE_COLUMN_STORAGE_KEY = 'qaDesk.testcaseTable.columns.v1';
const TESTCASE_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
type SavedView = { name: string; search: string; status: string; testType: string; priority: string; module: string; subMenu: string; testRun: string; bug: string; tag: string; createdFrom: string; createdTo: string };

const savedViewsKey = (projectId: string) => `qaDesk.testcaseTable.views.v1.${projectId}`;
const readSavedViews = (projectId: string): SavedView[] => {
  if (typeof window === 'undefined') return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(savedViewsKey(projectId)) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
};

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
  filterTestRun,
  filterBug,
  filterTag,
  filterCreatedFrom,
  filterCreatedTo,
  testRunOptions,
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
  setFilterTestRun,
  setFilterBug,
  setFilterTag,
  setFilterCreatedFrom,
  setFilterCreatedTo,
  setPage,
  setLimit,
  setShowBulkAction,
  setShowBulkExecution,
  setShowBulkAssign,
  setShowDeleteConfirm,
  openCreateDialog,
  openAIDialog,
  openImportDialog,
  handleImportExcel,
  handleExportExcel,
  refreshList,
  toggleSelectAll,
  toggleSelect,
  clearSelection,
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
  const [savedViewsVersion, setSavedViewsVersion] = useState(0);
  const { density, setDensity, rowClassName } = useTableDensity();
  useEffect(() => {
    if (!celebrateId) return;
    const timer = window.setTimeout(() => setCelebrateId(null), 1100);
    return () => window.clearTimeout(timer);
  }, [celebrateId]);
  const resetPage = () => setPage(1);
  const hasExtendedFilters = Boolean(filterTag || filterCreatedFrom || filterCreatedTo);
  const hasActiveFilters = Boolean(search)
    || filterStatus !== 'all'
    || filterTestType !== 'all'
    || filterPriority !== 'all'
    || filterModule !== 'all'
    || filterSubMenu !== 'all'
    || filterTestRun !== 'all'
    || filterBug !== 'all'
    || hasExtendedFilters;
  const savedViews = useMemo(() => readSavedViews(selectedProject), [selectedProject, savedViewsVersion]);
  const currentView: Omit<SavedView, 'name'> = { search, status: filterStatus, testType: filterTestType, priority: filterPriority, module: filterModule, subMenu: filterSubMenu, testRun: filterTestRun, bug: filterBug, tag: filterTag, createdFrom: filterCreatedFrom, createdTo: filterCreatedTo };
  const saveCurrentView = () => {
    const name = window.prompt('Nama saved view:')?.trim();
    if (!name) return;
    const next = [...savedViews.filter(view => view.name !== name), { name, ...currentView }];
    window.localStorage.setItem(savedViewsKey(selectedProject), JSON.stringify(next));
    setSavedViewsVersion(version => version + 1);
  };
  const applySavedView = (view: SavedView) => {
    setSearch(view.search);
    setFilterStatus(view.status);
    setFilterTestType(view.testType);
    setFilterPriority(view.priority);
    setFilterModule(view.module);
    setFilterSubMenu(view.subMenu);
    setFilterTestRun(view.testRun || 'all');
    setFilterBug(view.bug || 'all');
    setFilterTag(view.tag || '');
    setFilterCreatedFrom(view.createdFrom || '');
    setFilterCreatedTo(view.createdTo || '');
    setPage(1);
  };
  const deleteSavedView = (name: string) => {
    window.localStorage.setItem(savedViewsKey(selectedProject), JSON.stringify(savedViews.filter(view => view.name !== name)));
    setSavedViewsVersion(version => version + 1);
  };
  const resetFilters = () => {
    setSearch('');
    setFilterStatus('all');
    setFilterTestType('all');
    setFilterPriority('all');
    setFilterModule('all');
    setFilterSubMenu('all');
    setFilterTestRun('all');
    setFilterBug('all');
    setFilterTag('');
    setFilterCreatedFrom('');
    setFilterCreatedTo('');
    setPage(1);
  };
  const activeFilterChips = [
    search ? { key: 'search', label: `Search: ${search}`, clear: () => setSearch('') } : null,
    filterStatus !== 'all' ? { key: 'status', label: `Status: ${filterStatus}`, clear: () => setFilterStatus('all') } : null,
    filterTestType !== 'all' ? { key: 'type', label: `Type: ${filterTestType}`, clear: () => setFilterTestType('all') } : null,
    filterPriority !== 'all' ? { key: 'priority', label: `Priority: ${filterPriority}`, clear: () => setFilterPriority('all') } : null,
    filterModule !== 'all' ? { key: 'module', label: `Module: ${filterModule === 'unassigned' ? 'No Module' : modules.find(module => module.id === filterModule)?.name || filterModule}`, clear: () => setFilterModule('all') } : null,
    filterSubMenu !== 'all' ? { key: 'submenu', label: `Sub Menu: ${filterSubMenu === '__empty__' ? 'None' : filterSubMenu}`, clear: () => setFilterSubMenu('all') } : null,
    filterTestRun !== 'all' ? { key: 'run', label: `Run: ${testRunOptions.find(run => run.id === filterTestRun)?.name || filterTestRun}`, clear: () => setFilterTestRun('all') } : null,
    filterBug !== 'all' ? { key: 'bug', label: filterBug === 'yes' ? 'Has bug' : 'No bug', clear: () => setFilterBug('all') } : null,
    filterTag ? { key: 'tag', label: `Tag: ${filterTag}`, clear: () => setFilterTag('') } : null,
  ].filter((item): item is { key: string; label: string; clear: () => void } => Boolean(item));
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
    getPriorityColor, getTestTypeColor, handleLimitChange, setPage, rowClassName,
  };

  useEffect(() => {
    window.localStorage.setItem(TESTCASE_COLUMN_STORAGE_KEY, JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="min-w-0 space-y-4"
    >
      <div className="rounded-xl border border-border/70 bg-card p-3 shadow-xs sm:p-4">
        <div className="grid min-w-0 gap-2 md:grid-cols-[minmax(260px,1fr)_auto_minmax(220px,auto)_auto]">
        <div className="relative min-w-0">
          <Search className={cn('absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary', isLoading && 'animate-bounce [animation-duration:0.7s] motion-reduce:animate-none')} />
          <Input
            data-search-input
            placeholder="Cari ID, page, action, atau steps..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); resetPage(); }}
            className="h-10 rounded-lg border-border/70 bg-background pl-9 pr-9 text-sm shadow-none"
          />
          <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-border bg-secondary px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground sm:block">/</kbd>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" className="h-10 justify-center gap-2 rounded-lg border-border/70 bg-background px-3 font-semibold">
              <SlidersHorizontal /> Filter
              {activeFilterChips.filter(chip => !['search', 'from', 'to'].includes(chip.key)).length > 0 ? (
                <Badge variant="secondary" className="min-w-5 justify-center px-1.5 font-mono text-[10px]">
                  {activeFilterChips.filter(chip => !['search', 'from', 'to'].includes(chip.key)).length}
                </Badge>
              ) : null}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[min(680px,calc(100vw-2rem))] p-4">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div><p className="text-sm font-semibold">Filter testcase</p><p className="mt-0.5 text-xs text-muted-foreground">Persempit daftar berdasarkan atribut QA.</p></div>
              <Button type="button" variant="ghost" size="sm" onClick={resetFilters} disabled={!hasActiveFilters}>Reset</Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); resetPage(); }}>
            <SelectTrigger className="h-10 w-full"><SelectValue placeholder="Status" /></SelectTrigger>
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
            <SelectTrigger className="h-10 w-full"><SelectValue placeholder="Test Type" /></SelectTrigger>
            <SelectContent className="bg-card border border-border/50 text-foreground rounded-xl shadow-lg">
              <SelectItem value="all" className="rounded-lg text-xs font-medium">All Types</SelectItem>
              <SelectItem value="Positive" className="rounded-lg text-xs font-medium">Positive</SelectItem>
              <SelectItem value="Negative" className="rounded-lg text-xs font-medium">Negative</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterPriority} onValueChange={(v) => { setFilterPriority(v); resetPage(); }}>
            <SelectTrigger className="h-10 w-full"><SelectValue placeholder="Priority" /></SelectTrigger>
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
              <SelectTrigger className="h-10 w-full"><SelectValue placeholder="Module" /></SelectTrigger>
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
            <SelectTrigger className="h-10 w-full">
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
          <Select value={filterTestRun} onValueChange={(v) => { setFilterTestRun(v); resetPage(); }}>
            <SelectTrigger className="h-10 w-full"><SelectValue placeholder="Test Run" /></SelectTrigger>
            <SelectContent className="bg-card border border-border/50 text-foreground rounded-xl shadow-lg">
              <SelectItem value="all" className="rounded-lg text-xs font-medium">All Test Runs</SelectItem>
              {testRunOptions.map(run => <SelectItem key={run.id} value={run.id} className="rounded-lg text-xs font-medium">{run.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterBug} onValueChange={(v) => { setFilterBug(v); resetPage(); }}>
            <SelectTrigger className="h-10 w-full"><SelectValue placeholder="Bug" /></SelectTrigger>
            <SelectContent className="bg-card border border-border/50 text-foreground rounded-xl shadow-lg">
              <SelectItem value="all" className="rounded-lg text-xs font-medium">All Bugs</SelectItem>
              <SelectItem value="yes" className="rounded-lg text-xs font-medium">Has Bug</SelectItem>
              <SelectItem value="no" className="rounded-lg text-xs font-medium">No Bug</SelectItem>
            </SelectContent>
          </Select>
          <Input value={filterTag} onChange={(event) => { setFilterTag(event.target.value); resetPage(); }} placeholder="Tag" aria-label="Filter tag" className="h-10" />
            </div>
          </PopoverContent>
        </Popover>
        <DateRangePicker
          from={filterCreatedFrom}
          to={filterCreatedTo}
          onFromChange={(value) => { setFilterCreatedFrom(value); resetPage(); }}
          onToChange={(value) => { setFilterCreatedTo(value); resetPage(); }}
          label="Tanggal dibuat"
        />
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" className="h-10 w-full justify-center gap-2 rounded-lg border-border/70 bg-background px-3 font-semibold">
                <Bookmark /> Views{savedViews.length ? ` (${savedViews.length})` : ''}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64 rounded-xl bg-card">
              <DropdownMenuItem onClick={saveCurrentView} className="font-semibold"><Bookmark className="mr-2 h-4 w-4" />Save current filters</DropdownMenuItem>
              {savedViews.length > 0 && <DropdownMenuSeparator />}
              {savedViews.map(view => <div key={view.name} className="flex items-center gap-1 px-1"><DropdownMenuItem onClick={() => applySavedView(view)} className="min-w-0 flex-1 truncate text-xs">{view.name}</DropdownMenuItem><button type="button" aria-label={`Delete saved view ${view.name}`} onClick={() => deleteSavedView(view.name)} className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><X className="h-3.5 w-3.5" /></button></div>)}
              {!savedViews.length && <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Belum ada saved view.</DropdownMenuLabel>}
            </DropdownMenuContent>
        </DropdownMenu>
        </div>

        <AnimatePresence initial={false}>
          {activeFilterChips.length > 0 && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden">
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/35 pt-3" aria-label="Active filters">
                <span className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Active</span>
                {activeFilterChips.map(chip => (
                  <button key={chip.key} type="button" onClick={() => { chip.clear(); resetPage(); }} className="group inline-flex max-w-56 items-center gap-1.5 rounded-full border border-primary/20 bg-primary/7 px-2.5 py-1 text-[10px] font-semibold text-primary transition-colors duration-150 hover:border-primary/40 hover:bg-primary/12" aria-label={`Remove filter ${chip.label}`}>
                    <span className="truncate">{chip.label}</span><X className="h-3 w-3 opacity-60 group-hover:opacity-100" />
                  </button>
                ))}
                <button type="button" onClick={resetFilters} className="text-[10px] font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">Clear all</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      <div className="mt-3 flex min-w-0 flex-col gap-3 border-t border-border/40 pt-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="grid min-w-0 grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <Button onClick={openCreateDialog} size="sm" variant="majestic" title="Shortcut: N" className="group h-9 rounded-lg gap-1.5 font-bold shadow-sm transition duration-150">
            <Plus className="w-4 h-4" /> Add Test Case
            <kbd className="ml-0.5 hidden rounded border border-primary-foreground/30 px-1 font-mono text-[9px] leading-4 opacity-70 lg:inline-block">N</kbd>
          </Button>
          {aiEnabled && (
            <Button onClick={openAIDialog} size="sm" className="group h-9 rounded-lg gap-1.5 border border-violet-500/20 bg-violet-500/10 font-bold text-violet-500 transition duration-150 hover:bg-violet-500/20 dark:text-violet-400">
              <Sparkles className="w-4 h-4" /> Generate AI
            </Button>
          )}
        </div>
        <div className="grid min-w-0 grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center lg:justify-end">
          <Badge key={showingLabel} variant="outline" className="col-span-2 h-9 justify-center rounded-xl border border-border/50 bg-muted/60 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:col-span-1 animate-in zoom-in-95 duration-200 tabular-nums">
            {showingLabel}
          </Badge>
          <DataTableDensityToggle value={density} onValueChange={setDensity} />
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

      <AnimatePresence initial={false}>
        {selectedIds.size > 0 && (
          <motion.div initial={{ opacity: 0, y: -8, scale: 0.99 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.99 }} transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }} className="sticky top-[72px] z-30 flex flex-col gap-3 rounded-xl border border-primary/25 bg-card/95 p-3 shadow-[0_16px_50px_-28px_rgba(99,102,241,.45)] backdrop-blur-md lg:flex-row lg:items-center">
            <div className="flex min-w-40 items-center gap-3">
              <span className="font-mono text-sm font-bold text-primary">{selectedIds.size}</span>
              <span className="text-xs font-semibold text-foreground">testcase selected</span>
              <button type="button" onClick={clearSelection} className="ml-auto rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground lg:ml-0" aria-label="Clear selection"><X className="h-4 w-4" /></button>
            </div>
            <div className="flex flex-1 flex-wrap gap-2 lg:justify-end">
              <Button onClick={() => setShowBulkAction(true)} variant="outline" size="sm" className="h-8 gap-1.5"><Settings2 className="h-3.5 w-3.5" /> Status</Button>
              <Button onClick={() => setShowBulkExecution(true)} variant="outline" size="sm" className="h-8 gap-1.5"><CalendarClock className="h-3.5 w-3.5" /> Execute</Button>
              <Button onClick={() => setShowBulkAssign(true)} variant="outline" size="sm" className="h-8 gap-1.5"><UserRound className="h-3.5 w-3.5" /> Assign</Button>
              <Button onClick={() => handleExportExcel('xlsx', [...selectedIds])} variant="outline" size="sm" className="h-8 gap-1.5"><FileDown className="h-3.5 w-3.5" /> Export</Button>
              <Button onClick={() => setShowDeleteConfirm(true)} variant="destructive" size="sm" className="h-8 gap-1.5"><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <TestCaseTableBody {...tableBodyProps} />

    </motion.div>
  );
}
