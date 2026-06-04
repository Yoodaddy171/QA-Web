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
import { cn } from '@/lib/utils';

const MotionTableRow = motion(TableRow);

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

export interface TestCase {
  id: string;
  sourceTestCaseId?: string;
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
  reportedAt?: string | null;
  fixingAt?: string | null;
  readyAt?: string | null;
  fixedAt?: string | null;
  detailSource?: 'testcase' | 'bugfix';
  createdAt: string;
  updatedAt: string;
}

export interface TestRecordSummary {
  hasAutomationRun: boolean;
  hasManualCapture: boolean;
  lastRunAt: string | null;
}

interface TestCaseTableProps {
  selectedProject: string;
  modules: Module[];
  hasUnassignedModule: boolean;
  testCases: TestCase[];
  search: string;
  filterStatus: string;
  filterTestType: string;
  filterPriority: string;
  filterModule: string;
  filterSubMenu: string;
  subMenuOptions: string[];
  selectedIds: Set<string>;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  testRecordById: Record<string, TestRecordSummary>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  aiEnabled?: boolean;
  setSearch: (value: string) => void;
  setFilterStatus: (value: string) => void;
  setFilterTestType: (value: string) => void;
  setFilterPriority: (value: string) => void;
  setFilterModule: (value: string) => void;
  setFilterSubMenu: (value: string) => void;
  setPage: (value: number) => void;
  setShowBulkAction: (value: boolean) => void;
  setShowDeleteConfirm: (value: boolean) => void;
  openCreateDialog: () => void;
  openAIDialog: () => void;
  openImportDialog: () => void;
  handleImportExcel: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleExportExcel: (format?: string) => void;
  refreshList: () => void;
  toggleSelectAll: () => void;
  toggleSelect: (id: string) => void;
  toggleSort: (field: string) => void;
  openViewDialog: (testCase: TestCase) => void;
  openEditDialog: (testCase: TestCase) => void;
  handleDuplicate: (testCase: TestCase) => void;
  requestDelete: (testCase: TestCase) => void;
  getStatusColor: (status: string) => string;
  getStatusIcon: (status: string) => React.ReactNode;
  getStatusBadgeVariant: (status: string) => 'success' | 'failed' | 'warning' | 'info' | 'notdone' | 'inprogress' | 'blocked' | 'readyretest' | 'verifiedfixed' | 'tba' | 'outline';
  getPriorityColor: (priority: string) => string;
  getTestTypeColor: (type: string) => string;
  isLoading?: boolean;
  onQuickStatusChange?: (testCaseId: string, newStatus: string) => void;
}

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
    ? `Showing ${testCases.length} of ${total} data`
    : `Showing ${testCases.length} data`;
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

  useEffect(() => {
    window.localStorage.setItem(TESTCASE_COLUMN_STORAGE_KEY, JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="min-w-0 space-y-4"
    >      <div className="rounded-lg border border-white/5 bg-secondary/50 p-3 shadow-xl backdrop-blur-sm">
        <div className="flex min-w-0 flex-col gap-3 lg:flex-row">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            data-search-input
            placeholder="Cari test case... (ID, Page, Action, Steps)  [/]"
            value={search}
            onChange={(e) => { setSearch(e.target.value); resetPage(); }}
            className="h-9 rounded-md border-border/60 bg-secondary/50 text-foreground placeholder:text-muted-foreground pl-9 shadow-inner focus-visible:ring-teal-500/50"
          />
        </div>
        <div className="grid min-w-0 grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); resetPage(); }}>
            <SelectTrigger className={`h-9 w-full border-border/60 bg-secondary/50 text-foreground rounded-md text-sm shadow-sm sm:w-[145px]`}><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent className="bg-card elevation-3 border-border/60 text-foreground">
              <SelectItem value="all">Semua Status</SelectItem>
              <SelectItem value="DONE">Done</SelectItem>
              <SelectItem value="NOT DONE">Not Done</SelectItem>
              <SelectItem value="IN PROGRESS">In Progress</SelectItem>
              <SelectItem value="BLOCKED">Blocked</SelectItem>
              <SelectItem value="FAILED">Failed</SelectItem>
              <SelectItem value="READY TO RETEST">Ready to Retest</SelectItem>
              <SelectItem value="TBA">TBA (To Be Announced)</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterTestType} onValueChange={(v) => { setFilterTestType(v); resetPage(); }}>
            <SelectTrigger className={`h-9 w-full border-border/60 bg-secondary/50 text-foreground rounded-md text-sm shadow-sm sm:w-[135px]`}><SelectValue placeholder="Tipe Test" /></SelectTrigger>
            <SelectContent className="bg-card elevation-3 border-border/60 text-foreground">
              <SelectItem value="all">Semua Tipe</SelectItem>
              <SelectItem value="Positive">Positive</SelectItem>
              <SelectItem value="Negative">Negative</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterPriority} onValueChange={(v) => { setFilterPriority(v); resetPage(); }}>
            <SelectTrigger className={`h-9 w-full border-border/60 bg-secondary/50 text-foreground rounded-md text-sm shadow-sm sm:w-[145px]`}><SelectValue placeholder="Prioritas" /></SelectTrigger>
            <SelectContent className="bg-card elevation-3 border-border/60 text-foreground">
              <SelectItem value="all">Semua Prioritas</SelectItem>
              <SelectItem value="Critical">Critical</SelectItem>
              <SelectItem value="High">High</SelectItem>
              <SelectItem value="Medium">Medium</SelectItem>
              <SelectItem value="Low">Low</SelectItem>
            </SelectContent>
          </Select>
          {(modules.length > 0 || hasUnassignedModule || filterModule === 'unassigned') && (
            <Select value={filterModule} onValueChange={(v) => { setFilterModule(v); resetPage(); }}>
              <SelectTrigger className={`h-9 w-full border-border/60 bg-secondary/50 text-foreground rounded-md text-sm shadow-sm sm:w-[165px]`}><SelectValue placeholder="Module" /></SelectTrigger>
              <SelectContent className="bg-card elevation-3 border-border/60 text-foreground">
                <SelectItem value="all">Semua Module</SelectItem>
                {modules.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                ))}
                {(hasUnassignedModule || filterModule === 'unassigned') && (
                  <SelectItem value="unassigned">Tanpa Module</SelectItem>
                )}
              </SelectContent>
            </Select>
          )}
          <Select value={filterSubMenu} onValueChange={(v) => { setFilterSubMenu(v); resetPage(); }}>
            <SelectTrigger className="h-9 w-full rounded-md border-border/60 bg-secondary/50 text-sm text-foreground shadow-sm sm:w-[165px]">
              <SelectValue placeholder="Sub Menu" />
            </SelectTrigger>
            <SelectContent className="bg-card elevation-3 border-border/60 text-foreground">
              <SelectItem value="all">Semua Sub Menu</SelectItem>
              {subMenuOptions.map((subMenu) => (
                <SelectItem key={subMenu || '__empty__'} value={subMenu || '__empty__'}>
                  {subMenu || 'Tanpa Sub Menu'}
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
            className="h-9 rounded-md gap-1.5 border-border/60 bg-secondary/50 text-sm font-semibold text-foreground shadow-sm disabled:opacity-40"
          >
            <X className="h-4 w-4" />
            Reset
          </Button>
        </div>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-2 rounded-lg border border-white/5 bg-secondary/50 p-2 shadow-xl backdrop-blur-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="grid min-w-0 grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <Button onClick={openCreateDialog} size="sm" variant="majestic" className={toolbarButtonClass}>
            <Plus className="w-4 h-4" /> Tambah Test Case
          </Button>
          {aiEnabled && (
            <Button onClick={openAIDialog} size="sm" className={`${toolbarButtonClass} bg-teal-500/10 text-teal-400 border border-teal-500/20 hover:bg-teal-500/20`}>
              <Sparkles className="w-4 h-4" /> Generate AI
            </Button>
          )}
          {selectedIds.size > 0 && (
            <>
              <Button onClick={() => setShowBulkAction(true)} variant="outline" size="sm" className="h-9 rounded-md gap-1.5 font-bold border-border/60 bg-secondary/50 text-foreground">
                <Settings2 className="w-4 h-4" /> Update Status ({selectedIds.size})
              </Button>
              <Button onClick={() => setShowDeleteConfirm(true)} variant="destructive" size="sm" className="h-9 rounded-md gap-1.5 font-bold shadow-lg shadow-red-900/20">
                <Trash2 className="w-4 h-4" /> Hapus ({selectedIds.size})
              </Button>
            </>
          )}
        </div>
        <div className="grid min-w-0 grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center lg:justify-end">
          <Badge variant="outline" className="col-span-2 h-9 justify-center rounded-md border-border/60 bg-muted px-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground sm:col-span-1">
            {showingLabel}
          </Badge>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 rounded-md gap-1.5 font-bold border-border/60 bg-secondary/50 text-foreground">
                <Settings2 className="w-4 h-4" /> Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 bg-card elevation-3 border-border/60 text-foreground">
              <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Table Columns
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {TESTCASE_COLUMN_OPTIONS.map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.key}
                  checked={visibleColumns[column.key]}
                  onCheckedChange={(checked) => setColumnVisible(column.key, Boolean(checked))}
                  className="text-xs font-semibold"
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
          <Button onClick={openImportDialog} variant="outline" size="sm" className="h-9 rounded-md gap-1.5 font-bold border-border/60 bg-secondary/50 text-foreground">
            <Upload className="w-4 h-4" /> Import Excel
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 rounded-md gap-1.5 font-bold border-border/60 bg-secondary/50 text-foreground">
                <FileSpreadsheet className="w-4 h-4" /> Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-card elevation-3 border-border/60 text-foreground">
              <DropdownMenuItem onClick={() => handleExportExcel('xlsx')}>
                <FileDown className="w-4 h-4 mr-2" /> Export XLSX (1 Sheet)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { if (!selectedProject) return; window.open(`/api/excel?projectId=${selectedProject}&format=xlsx&multiSheet=true`, '_blank'); }}>
                <FileDown className="w-4 h-4 mr-2" /> Export XLSX (Per Module)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExportExcel('csv')}>
                <FileDown className="w-4 h-4 mr-2" /> Export CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={refreshList} variant="ghost" size="sm" className="h-9 w-9 rounded-md border border-white/5 p-0 text-muted-foreground hover:text-foreground hover:bg-secondary/50">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="relative rounded-xl border border-border/60 bg-card elevation-1">
      {isLoading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/50 backdrop-blur-[1px]">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />  
        </div>
      )}
      <Table className="w-full table-auto">
        <TableHeader className="sticky top-0 z-10">
          <TableRow className="border-white/5 bg-white/[0.03] hover:bg-white/[0.03]">
            <TableHead className="w-10 pl-4">
              <Checkbox
                checked={testCases.length > 0 && selectedIds.size === testCases.length}
                onCheckedChange={toggleSelectAll}
                className="border-white/20 data-[state=checked]:bg-teal-500 data-[state=checked]:border-teal-500"
              />
            </TableHead>
            <TableHead className="w-10 text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground">No</TableHead>
            <TableHead className="w-[80px] cursor-pointer select-none text-[10px] font-black uppercase tracking-widest text-muted-foreground" onClick={() => toggleSort('testCaseId')}>
              <div className="flex items-center gap-1">ID <ArrowUpDown className="w-3 h-3" /></div>
            </TableHead>
            <TableHead className="w-[110px] cursor-pointer select-none text-[10px] font-black uppercase tracking-widest text-muted-foreground" onClick={() => toggleSort('page')}>
              <div className="flex items-center gap-1">Page <ArrowUpDown className="w-3 h-3" /></div>
            </TableHead>
            <TableHead className={getColumnClass('subMenu', 'w-[100px] text-[10px] font-black uppercase tracking-widest text-muted-foreground')}>Sub Menu</TableHead>
            <TableHead className={getColumnClass('weight', 'w-[68px] text-[10px] font-black uppercase tracking-widest text-muted-foreground')}>Bobot</TableHead>
            <TableHead className={getColumnClass('type', 'w-[80px] text-[10px] font-black uppercase tracking-widest text-muted-foreground')}>Tipe</TableHead>
            <TableHead className={getColumnClass('priority', 'w-[84px] text-[10px] font-black uppercase tracking-widest text-muted-foreground')}>Prioritas</TableHead>
            <TableHead className={getColumnClass('action', 'text-[10px] font-black uppercase tracking-widest text-muted-foreground')}>Test Action</TableHead>
            <TableHead className={getColumnClass('status', 'w-[140px] text-[10px] font-black uppercase tracking-widest text-muted-foreground')}>Status</TableHead>
            <TableHead className={getColumnClass('result', 'w-[120px] text-[10px] font-black uppercase tracking-widest text-muted-foreground')}>Hasil</TableHead>
            <TableHead className={getColumnClass('record', 'w-[140px] text-[10px] font-black uppercase tracking-widest text-muted-foreground')}>Test Record</TableHead>
            <TableHead className={getColumnClass('progress', 'w-[88px] text-[10px] font-black uppercase tracking-widest text-muted-foreground')}>Progress</TableHead>
            <TableHead className="w-[52px] text-[10px] font-black uppercase tracking-widest text-muted-foreground">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
              {testCases.length === 0 ? (
                <TableRow className="border-white/5">
                  <TableCell colSpan={tableColSpan} className="h-44 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <FileSpreadsheet className="h-9 w-9 opacity-20" />
                      <p className="text-sm font-bold uppercase tracking-tight">
                        {selectedProject ? 'Empty Test Vault' : 'Selection Required'}
                      </p>
                      <p className="max-w-md text-[11px] font-medium opacity-60">
                        {selectedProject ? 'Click Add Test Case or import Excel to populate your testing matrix.' : 'Select a project from the top console to view data.'}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                testCases.map((tc, index) => {
                  const record = testRecordById[tc.id];

                  return (
                  <MotionTableRow 
                    key={tc.id} 
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(index * 0.015, 0.4), duration: 0.2 }}
                    className="group border-white/5 hover:bg-white/[0.02] transition-colors"
                  >
                    <TableCell className="pl-4">
                      <Checkbox
                        checked={selectedIds.has(tc.id)}
                        onCheckedChange={() => toggleSelect(tc.id)}
                        className="border-white/20 data-[state=checked]:bg-teal-500 data-[state=checked]:border-teal-500"
                      />
                    </TableCell>
                    <TableCell className="text-center font-mono text-xs font-bold text-muted-foreground">
                      {(page - 1) * limit + index + 1}
                    </TableCell>
                    <TableCell className="font-mono text-sm font-black text-foreground whitespace-nowrap">{tc.testCaseId}</TableCell>
                    <TableCell className="max-w-[110px] truncate text-sm font-bold text-foreground" title={tc.page}>{tc.page}</TableCell>
                    <TableCell className={getColumnClass('subMenu', 'text-muted-foreground text-[13px] font-medium max-w-[100px] truncate')} title={tc.subMenu || ''}>{tc.subMenu || '-'}</TableCell>
                    <TableCell className={getColumnClass('weight')}>
                      {tc.calculatedWeight != null ? (
                        <Badge variant="outline" className="rounded-md border-border/60 bg-secondary/50 text-[10px] font-mono text-muted-foreground">
                          {tc.calculatedWeight.toFixed(2)}%
                        </Badge>
                      ) : (
                        <span className="text-xs font-semibold text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className={getColumnClass('type')}>
                      <Badge variant="outline" className={`rounded-md text-[10px] font-bold border-white/5 bg-secondary/50 ${tc.testType === 'Negative' ? 'text-rose-400' : 'text-sky-400'}`}>
                        {tc.testType}
                      </Badge>
                    </TableCell>
                    <TableCell className={getColumnClass('priority')}>
                      <Badge variant={tc.priority === 'Critical' ? 'failed' : tc.priority === 'High' ? 'warning' : 'outline'} className={`rounded-md text-[10px] font-bold ${tc.priority === 'Medium' ? 'text-amber-400/70 border-amber-400/20' : tc.priority === 'Low' ? 'text-emerald-400/70 border-emerald-400/20' : ''}`}>
                        {tc.priority}
                      </Badge>
                    </TableCell>
                    <TableCell className={getColumnClass('action', 'max-w-[180px]')}>
                      <p className="truncate text-sm text-muted-foreground group-hover:text-foreground transition-colors">{tc.testAction}</p>
                    </TableCell>
                    <TableCell className={getColumnClass('status')}>
                      {onQuickStatusChange ? (
                        <Select value={tc.status} onValueChange={(val) => onQuickStatusChange(tc.id, val)}>
                          <SelectTrigger className={cn("h-7 w-[130px] rounded-lg text-[10px] font-bold shadow-none gap-1 px-2", getStatusColor(tc.status))}>
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
                      ) : (
                        <Badge variant={getStatusBadgeVariant(tc.status)} className="gap-1 text-[10px] font-black">
                          {getStatusIcon(tc.status)} {tc.status}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className={getColumnClass('result', 'px-3')}>
                      {tc.actualResult ? (
                        <Badge variant={tc.actualResult === 'As Expected' ? 'success' : tc.actualResult === 'Not As Expected' ? 'failed' : 'outline'} className="text-[10px] font-black">
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
                              <Badge className="rounded-md bg-indigo-500/10 text-[9px] font-black text-indigo-400 border-indigo-500/20 shadow-none uppercase">
                                Auto
                              </Badge>
                            )}
                            {record.hasManualCapture && (
                              <Badge className="rounded-md bg-teal-500/10 text-[9px] font-black text-teal-400 border-teal-500/20 shadow-none uppercase">
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
                        <Badge variant="outline" className="rounded-md border-border/60 bg-secondary/50 text-[9px] font-black text-muted-foreground uppercase">
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
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 w-7 rounded-md p-0 text-muted-foreground hover:text-foreground hover:bg-secondary">
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
                  </MotionTableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
      </div>
      {totalPages > 1 && (
        <div className="flex flex-col gap-3 rounded-lg border border-white/5 bg-secondary/50 px-3 py-2 shadow-xl backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            Vault Page {page} of {totalPages} <span className="mx-2 opacity-20">|</span> {total} Total Units
          </p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)} className="h-8 border-border/60 bg-secondary/50 text-muted-foreground">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
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
                  className={`w-8 h-8 p-0 text-[11px] font-bold ${page === pageNum ? 'bg-teal-600 text-foreground border-teal-500 shadow-[0_0_10px_rgba(13,148,136,0.3)]' : 'border-border/60 bg-secondary/50 text-muted-foreground'}`}
                  onClick={() => setPage(pageNum)}
                >
                  {pageNum}
                </Button>
              );
            })}
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="h-8 border-border/60 bg-secondary/50 text-muted-foreground">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
