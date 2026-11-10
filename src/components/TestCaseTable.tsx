'use client';

import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { MutationAction, useWorkspaceAccess } from '@/components/WorkspaceAccess';
import { useCommittedActions } from '@/hooks/use-committed-actions';
import {
  ArrowUpDown, Bookmark, CalendarClock, ChevronLeft, ChevronRight, Copy, Edit3, Eye, FileDown,
  FileSpreadsheet, MoreHorizontal, Plus, RefreshCw, Search, Settings2,
  Trash2, Upload, UserRound, X
} from 'lucide-react';
import { GenerateTestCaseIcon } from '@/components/icons/qa-icons';
import { AnimatePresence, motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DateRangePicker } from '@/components/ui/date-picker';
import { Kbd } from '@/components/ui/kbd';
import { cn } from '@/lib/utils';
import type { TestCase, TestCaseTableProps } from './TestCaseTable.types';
import { TestCaseTableBody } from './TestCaseTableBody';
import { TestCaseFilterPanel } from './TestCaseFilterPanel';
import { DataTableDensityToggle } from '@/components/DataTableDensityToggle';
import { useTableDensity } from '@/hooks/use-table-density';
import { useTableViewport } from '@/hooks/use-table-viewport';
import { mountedTestCaseColumns, type TestCaseColumnKey } from '@/lib/client/testcase-column-visibility';
export type { TestCase } from './TestCaseTable.types';

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

const DEFAULT_TESTCASE_COLUMNS: Record<TestCaseColumnKey, boolean> = {
  subMenu: true,
  weight: false,
  type: true,
  priority: true,
  action: true,
  status: true,
  result: true,
  record: false,
  progress: false,
};

const TESTCASE_COLUMN_STORAGE_KEY = 'qaDesk.testcaseTable.columns.v2';
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
  sortBy,
  sortOrder,
  toggleNewestSort,
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
  const viewportBucket = useTableViewport();
  const mountedColumns = useMemo(() => mountedTestCaseColumns(visibleColumns, viewportBucket), [visibleColumns, viewportBucket]);
  const [savedViewsVersion, setSavedViewsVersion] = useState(0);
  const [newSavedViewName, setNewSavedViewName] = useState('');
  const { density, setDensity, rowClassName } = useTableDensity();
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
  const saveCurrentView = (customName?: string) => {
    const name = (customName ?? newSavedViewName).trim();
    if (!name) return;
    const next = [...savedViews.filter(view => view.name !== name), { name, ...currentView }];
    window.localStorage.setItem(savedViewsKey(selectedProject), JSON.stringify(next));
    setNewSavedViewName('');
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
  const { canEdit, canExport } = useWorkspaceAccess();
  const toolbarButtonClass = 'h-9 rounded-md gap-1.5 font-semibold';
  const formatLastRun = (dateStr: string | null) => {
    if (!dateStr) return 'Belum dites';
    return new Date(dateStr).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' });
  };
  const showingLabel = total !== testCases.length
    ? `Menampilkan ${testCases.length} dari ${total} data`
    : `Menampilkan ${testCases.length} data`;
  const shownOptionalColumnCount = useMemo(
    () => TESTCASE_COLUMN_OPTIONS.filter((column) => mountedColumns[column.key]).length,
    [mountedColumns]
  );
  const tableColSpan = 4 + shownOptionalColumnCount + 1;
  const isColumnVisible = (key: TestCaseColumnKey) => visibleColumns[key];
  const getColumnClass = useCallback((key: TestCaseColumnKey, baseClass = '') => {
    const option = TESTCASE_COLUMN_OPTIONS.find((column) => column.key === key);
    return cn(!visibleColumns[key] && 'hidden', visibleColumns[key] && option?.responsiveClass, baseClass);
  }, [visibleColumns]);
  const setColumnVisible = (key: TestCaseColumnKey, checked: boolean) => {
    setVisibleColumns((current) => ({ ...current, [key]: checked }));
  };
  const resetColumns = () => setVisibleColumns(DEFAULT_TESTCASE_COLUMNS);
  const handleLimitChange = (value: string) => {
    setLimit(Number(value));
    setPage(1);
  };

  const rowActions = useCommittedActions({
    resetFilters, toggleSelectAll, toggleSort, openViewDialog, openEditDialog,
    handleDuplicate, requestDelete, toggleSelect, handleLimitChange, setPage,
    onQuickStatusChange: (id: string, status: string) => onQuickStatusChange?.(id, status),
  });
  const tableBodyProps = {
    selectedProject, testCases, selectedIds, testRecordById, page, limit, total, totalPages, tableColSpan,
    isLoading, hasActiveFilters, getColumnClass, mountedColumns, showingLabel,
    ...rowActions, onQuickStatusChange: canEdit && onQuickStatusChange ? rowActions.onQuickStatusChange : undefined,
    getStatusColor, getStatusIcon, getStatusBadgeVariant,
    getPriorityColor, getTestTypeColor, rowClassName,
  };

  useEffect(() => {
    window.localStorage.setItem(TESTCASE_COLUMN_STORAGE_KEY, JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  const [showTableTools, setShowTableTools] = useState(false);
  const tableToolsId = useId();
  const dateFilter = <DateRangePicker
    from={filterCreatedFrom} to={filterCreatedTo}
    onFromChange={(value) => { setFilterCreatedFrom(value); resetPage(); }}
    onToChange={(value) => { setFilterCreatedTo(value); resetPage(); }}
    label="Tanggal dibuat"
  />;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="qa-data-workspace flex flex-1 flex-col min-w-0 gap-4"
    >
      <div className="qa-workspace-toolbar flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative w-full min-w-[200px] max-w-xs sm:w-64">
            <Search className={cn('absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground', isLoading && 'opacity-60')} />
            <Input
              data-search-input
              aria-label="Cari testcase berdasarkan ID, page, action, atau steps"
              placeholder="Cari ID, page, action, steps..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); resetPage(); }}
              className="h-9 rounded-md border-border/70 bg-background pl-8 pr-8 text-sm shadow-none placeholder:text-muted-foreground/60"
            />
            <Kbd size="sm" className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 sm:inline-flex">/</Kbd>
          </div>
          <TestCaseFilterPanel activeCount={activeFilterChips.filter(chip => chip.key !== 'search').length} canReset={hasActiveFilters} onReset={resetFilters} mobileDateFilter={dateFilter}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 [&_[data-slot=select-trigger]]:min-h-11 [&_input]:min-h-11 [&_input]:text-base sm:[&_input]:text-sm">
          <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); resetPage(); }}>
            <SelectTrigger aria-label="Status testcase" className="h-10 w-full"><SelectValue placeholder="Status" /></SelectTrigger>
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
            <SelectTrigger aria-label="Tipe testcase" className="h-10 w-full"><SelectValue placeholder="Test Type" /></SelectTrigger>
            <SelectContent className="bg-card border border-border/50 text-foreground rounded-xl shadow-lg">
              <SelectItem value="all" className="rounded-lg text-xs font-medium">All Types</SelectItem>
              <SelectItem value="Positive" className="rounded-lg text-xs font-medium">Positive</SelectItem>
              <SelectItem value="Negative" className="rounded-lg text-xs font-medium">Negative</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterPriority} onValueChange={(v) => { setFilterPriority(v); resetPage(); }}>
            <SelectTrigger aria-label="Prioritas testcase" className="h-10 w-full"><SelectValue placeholder="Priority" /></SelectTrigger>
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
              <SelectTrigger aria-label="Module testcase" className="h-10 w-full"><SelectValue placeholder="Module" /></SelectTrigger>
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
            <SelectTrigger aria-label="Sub Menu testcase" className="h-10 w-full">
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
            <SelectTrigger aria-label="Test Run testcase" className="h-10 w-full"><SelectValue placeholder="Test Run" /></SelectTrigger>
            <SelectContent className="bg-card border border-border/50 text-foreground rounded-xl shadow-lg">
              <SelectItem value="all" className="rounded-lg text-xs font-medium">All Test Runs</SelectItem>
              {testRunOptions.map(run => <SelectItem key={run.id} value={run.id} className="rounded-lg text-xs font-medium">{run.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterBug} onValueChange={(v) => { setFilterBug(v); resetPage(); }}>
            <SelectTrigger aria-label="Relasi Bug testcase" className="h-10 w-full"><SelectValue placeholder="Bug" /></SelectTrigger>
            <SelectContent className="bg-card border border-border/50 text-foreground rounded-xl shadow-lg">
              <SelectItem value="all" className="rounded-lg text-xs font-medium">All Bugs</SelectItem>
              <SelectItem value="yes" className="rounded-lg text-xs font-medium">Has Bug</SelectItem>
              <SelectItem value="no" className="rounded-lg text-xs font-medium">No Bug</SelectItem>
            </SelectContent>
          </Select>
          <Input value={filterTag} onChange={(event) => { setFilterTag(event.target.value); resetPage(); }} placeholder="Tag" aria-label="Filter tag" className="h-10" />
            </div>
        </TestCaseFilterPanel>
        <div className="hidden md:block">{dateFilter}</div>
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" className="h-9 w-auto gap-1.5 rounded-md border-border/70 bg-transparent px-3 text-xs font-medium">
                <Bookmark className="size-3.5" /> Views{savedViews.length ? ` (${savedViews.length})` : ''}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-72 rounded-xl bg-card p-2">
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  saveCurrentView();
                }}
                onKeyDown={(event) => event.stopPropagation()}
                className="flex items-center gap-1.5 pb-2"
              >
                <Input
                  value={newSavedViewName}
                  onChange={(event) => setNewSavedViewName(event.target.value)}
                  placeholder="Nama filter view..."
                  aria-label="Nama saved view baru"
                  className="h-8 text-xs"
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={!newSavedViewName.trim()}
                  className="h-8 shrink-0 px-2.5 text-xs"
                >
                  Simpan
                </Button>
              </form>
              <DropdownMenuSeparator />
              {savedViews.map(view => <div key={view.name} className="flex items-center gap-1 px-1"><DropdownMenuItem onClick={() => applySavedView(view)} className="min-w-0 flex-1 truncate text-xs">{view.name}</DropdownMenuItem><button type="button" aria-label={`Delete saved view ${view.name}`} onClick={() => deleteSavedView(view.name)} className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><X className="h-3.5 w-3.5" /></button></div>)}
              {!savedViews.length && <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Belum ada saved view.</DropdownMenuLabel>}
            </DropdownMenuContent>
        </DropdownMenu>
        <SimpleTooltip content="Urutkan berdasarkan aktivitas terakhir: baru dibuat atau diedit. Klik lagi untuk kembali ke urutan ID.">
        <Button
          type="button"
          variant={sortBy === 'updatedAt' && sortOrder === 'desc' ? 'secondary' : 'outline'}
          size="sm"
          aria-pressed={sortBy === 'updatedAt' && sortOrder === 'desc'}
          onClick={toggleNewestSort}
          className="h-9 gap-1.5 rounded-md border-border/70 bg-transparent px-3 text-xs font-medium"
        >
          <CalendarClock className="size-3.5" data-icon="inline-start" /> Terbaru
        </Button>
        </SimpleTooltip>
      </div>

      <div className="flex items-center gap-1.5">
        <DataTableDensityToggle value={density} onValueChange={setDensity} />
        <DropdownMenu>
          <SimpleTooltip content={canExport ? 'Atur kolom tabel' : 'Export tidak diizinkan oleh admin'}><span className="inline-flex">
          <DropdownMenuTrigger asChild>
            <Button disabled={!canExport} variant="outline" size="sm" className="h-9 rounded-md border-border/70 bg-transparent px-2.5 text-xs font-medium gap-1.5">
              <Settings2 className="w-3.5 h-3.5" /> Columns
            </Button>
          </DropdownMenuTrigger>
          </span></SimpleTooltip>
          <DropdownMenuContent align="end" className="w-52 bg-card border border-border/50 text-foreground rounded-2xl shadow-xl">
            <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-3 py-2">
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
        <MutationAction><Button onClick={openImportDialog} variant="outline" size="sm" className="h-9 rounded-md border-border/70 bg-transparent px-2.5 text-xs font-medium gap-1.5">
          <Upload className="w-3.5 h-3.5 text-muted-foreground" /> Import Excel
        </Button></MutationAction>
        <DropdownMenu>
          <SimpleTooltip content={canExport ? 'Export testcase' : 'Export tidak diizinkan oleh admin'}><span className="inline-flex">
          <DropdownMenuTrigger asChild>
            <Button disabled={!canExport} variant="outline" size="sm" className="h-9 rounded-md border-border/70 bg-transparent px-2.5 text-xs font-medium gap-1.5">
              <FileSpreadsheet className="w-3.5 h-3.5 text-muted-foreground" /> Export
            </Button>
          </DropdownMenuTrigger>
          </span></SimpleTooltip>
          <DropdownMenuContent className="bg-card border border-border/50 text-foreground rounded-2xl shadow-xl">
            <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => handleExportExcel('qa-report')} className="rounded-lg text-xs font-semibold mx-1 my-0.5">
              <FileSpreadsheet className="w-4 h-4 mr-2 text-primary" /> QA Report XLSX (Summary + Cases)
            </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
            <DropdownMenuLabel className="text-xs text-muted-foreground">Format legacy untuk import kembali</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => handleExportExcel('xlsx')} className="rounded-lg text-xs font-semibold mx-1 my-0.5">
              <FileDown className="w-4 h-4 mr-2 text-primary" /> Legacy XLSX (1 Sheet)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { if (!selectedProject) return; window.open(`/api/excel?projectId=${selectedProject}&format=xlsx&multiSheet=true`, '_blank'); }} className="rounded-lg text-xs font-semibold mx-1 my-0.5">
              <FileDown className="w-4 h-4 mr-2 text-primary" /> Legacy XLSX (Per Module)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExportExcel('csv')} className="rounded-lg text-xs font-semibold mx-1 my-0.5">
              <FileDown className="w-4 h-4 mr-2 text-primary" /> Export CSV
            </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <SimpleTooltip content="Refresh test cases (shortcut: R)">
        <Button aria-label="Refresh test cases" onClick={refreshList} variant="outline" size="sm" className="h-9 w-9 rounded-md border-border/70 bg-transparent p-0 text-muted-foreground hover:text-foreground">
          <RefreshCw className="w-3.5 h-3.5" />
        </Button>
        </SimpleTooltip>
        {aiEnabled && (
          <MutationAction><Button onClick={openAIDialog} size="sm" variant="outline" className="h-9 rounded-md gap-1.5 text-xs font-medium border-border/70 bg-transparent">
            <GenerateTestCaseIcon className="w-3.5 h-3.5 text-primary" /> Generate AI
          </Button></MutationAction>
        )}
        <MutationAction><SimpleTooltip content="Tambah testcase (shortcut: N)"><Button onClick={openCreateDialog} size="sm" variant="default" className="group h-9 rounded-md px-3 text-xs font-semibold shadow-none gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Add Test Case
          <Kbd size="sm" className="hidden border-primary-foreground/30 bg-primary-foreground/15 text-primary-foreground lg:inline-flex">N</Kbd>
        </Button></SimpleTooltip></MutationAction>
      </div>
      </div>

      <AnimatePresence initial={false}>
        {activeFilterChips.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 pt-1" aria-label="Active filters">
              <span className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Active</span>
              {activeFilterChips.map(chip => (
                <button key={chip.key} type="button" onClick={() => { chip.clear(); resetPage(); }} className="group inline-flex max-w-56 items-center gap-1.5 rounded-full border border-primary/20 bg-primary/7 px-2.5 py-1 text-xs font-semibold text-primary transition-colors duration-150 hover:border-primary/40 hover:bg-primary/12" aria-label={`Remove filter ${chip.label}`}>
                  <span className="truncate">{chip.label}</span><X className="h-3 w-3 opacity-60 group-hover:opacity-100" />
                </button>
              ))}
              <button type="button" onClick={resetFilters} className="text-xs font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">Clear all</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!canEdit && <p className="text-xs leading-5 text-muted-foreground">Mode baca saja. Perubahan memerlukan role QA atau lebih tinggi pada workspace ini.</p>}

      <AnimatePresence initial={false}>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 480, damping: 32 }}
            className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 flex items-center gap-3 rounded-xl border border-border/80 bg-card/95 px-4 py-2.5 shadow-2xl backdrop-blur-md max-w-[calc(100vw-2rem)] flex-wrap sm:flex-nowrap ring-1 ring-border/50"
          >
            <div className="flex items-center gap-2 pr-3 border-r border-border/70">
              <motion.span
                key={selectedIds.size}
                initial={{ scale: 0.78, opacity: 0.65 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 520, damping: 24 }}
                className="flex size-6 items-center justify-center rounded-md bg-primary/15 font-mono text-xs font-bold text-primary tabular-nums"
              >
                {selectedIds.size}
              </motion.span>
              <span className="text-xs font-semibold text-foreground whitespace-nowrap">
                skenario terpilih
              </span>
              <SimpleTooltip content="Batalkan semua pilihan"><button
                type="button"
                onClick={clearSelection}
                className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors ml-1"
                aria-label="Batalkan pilihan"
              >
                <X className="h-3.5 w-3.5" />
              </button></SimpleTooltip>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <MutationAction>
                <Button onClick={() => setShowBulkAction(true)} variant="outline" size="sm" className="h-8 rounded-lg text-xs gap-1.5 hover:bg-secondary/70">
                  <Settings2 className="h-3.5 w-3.5 text-primary" /> Ubah Status
                </Button>
              </MutationAction>
              <MutationAction>
                <Button onClick={() => setShowBulkExecution(true)} variant="outline" size="sm" className="h-8 rounded-lg text-xs gap-1.5 hover:bg-secondary/70">
                  <CalendarClock className="h-3.5 w-3.5 text-status-in-progress" /> Jalankan
                </Button>
              </MutationAction>
              <MutationAction>
                <Button onClick={() => setShowBulkAssign(true)} variant="outline" size="sm" className="h-8 rounded-lg text-xs gap-1.5 hover:bg-secondary/70">
                  <UserRound className="h-3.5 w-3.5" /> Tugaskan
                </Button>
              </MutationAction>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button disabled={!canExport} variant="outline" size="sm" className="h-8 rounded-lg text-xs gap-1.5 hover:bg-secondary/70">
                    <FileDown className="h-3.5 w-3.5" /> Export ({selectedIds.size})
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-xl bg-card border-border/70 shadow-xl text-xs">
                  <DropdownMenuGroup>
                    <DropdownMenuItem onClick={() => handleExportExcel('qa-report', [...selectedIds])}>
                      QA Report XLSX ({selectedIds.size} terpilih)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExportExcel('xlsx', [...selectedIds])}>
                      Standard XLSX ({selectedIds.size} terpilih)
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              <MutationAction>
                <Button onClick={() => setShowDeleteConfirm(true)} variant="destructive" size="sm" className="h-8 rounded-lg text-xs gap-1.5">
                  <Trash2 className="h-3.5 w-3.5" /> Hapus
                </Button>
              </MutationAction>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <TestCaseTableBody {...tableBodyProps} />

    </motion.div>
  );
}
