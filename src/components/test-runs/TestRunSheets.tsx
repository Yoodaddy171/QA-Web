'use client';

import React from 'react';
import { ChevronLeft, ChevronRight, Plus, SlidersHorizontal } from 'lucide-react';
import { MutationAction } from '@/components/WorkspaceAccess';
import { Button } from '@/components/ui/button';
import { DateRangePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { TEST_RUN_STATUS } from '@/lib/domain/test-run';
import {
  type AvailableCaseOption,
  RUN_CASES_PER_PAGE,
  type TestPlanOption,
  type TestRunDetail,
} from './types';

interface TestRunSheetsProps {
  projectId: string;
  canEdit: boolean;
  isSaving: boolean;
  showCreateRun: boolean;
  onShowCreateRunChange: (open: boolean) => void;
  manageRunOpen: boolean;
  onManageRunOpenChange: (open: boolean) => void;
  selectedRun: TestRunDetail | null;
  runName: string;
  onRunNameChange: (value: string) => void;
  runDescription: string;
  onRunDescriptionChange: (value: string) => void;
  runAssignee: string;
  onRunAssigneeChange: (value: string) => void;
  runStartDate: string;
  onRunStartDateChange: (value: string) => void;
  runEndDate: string;
  onRunEndDateChange: (value: string) => void;
  runTestPlanId: string;
  onRunTestPlanIdChange: (value: string) => void;
  testPlans: TestPlanOption[];
  onCreateRun: () => void;
  onUpdateRunStatus: (status: string) => void;
  onUpdateRunDetails: () => void;
  pickerOpen: boolean;
  onTogglePicker: () => void;
  pickerSearch: string;
  onPickerSearchChange: (value: string) => void;
  pickerLoading: boolean;
  selectableCases: AvailableCaseOption[];
  selectedCaseIds: Set<string>;
  onToggleSelectableCase: (caseId: string, checked: boolean) => void;
  pickerPage: number;
  pickerPages: number;
  onPickerPageChange: (page: number) => void;
  onAddCases: () => void;
  casePage: number;
  onCasePageChange: (page: number) => void;
  onRemoveCaseFromRun: (testCaseId: string) => Promise<void>;
}

export function TestRunSheets({
  canEdit,
  isSaving,
  showCreateRun,
  onShowCreateRunChange,
  manageRunOpen,
  onManageRunOpenChange,
  selectedRun,
  runName,
  onRunNameChange,
  runDescription,
  onRunDescriptionChange,
  runAssignee,
  onRunAssigneeChange,
  runStartDate,
  onRunStartDateChange,
  runEndDate,
  onRunEndDateChange,
  runTestPlanId,
  onRunTestPlanIdChange,
  testPlans,
  onCreateRun,
  onUpdateRunStatus,
  onUpdateRunDetails,
  pickerOpen,
  onTogglePicker,
  pickerSearch,
  onPickerSearchChange,
  pickerLoading,
  selectableCases,
  selectedCaseIds,
  onToggleSelectableCase,
  pickerPage,
  pickerPages,
  onPickerPageChange,
  onAddCases,
  casePage,
  onCasePageChange,
  onRemoveCaseFromRun,
}: TestRunSheetsProps) {
  return (
    <>
      {/* ==================== 3. SHEET: CYCLE BARU ==================== */}
      <Sheet open={showCreateRun} onOpenChange={onShowCreateRunChange}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto p-0">
          <SheetHeader className="border-b border-border/40 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                <Plus className="h-5 w-5" />
              </div>
              <div>
                <SheetTitle className="text-base font-semibold text-foreground tracking-tight">Test Cycle Baru</SheetTitle>
                <SheetDescription className="text-xs text-muted-foreground mt-0.5">Buat cycle pengujian baru untuk project ini.</SheetDescription>
              </div>
            </div>
          </SheetHeader>
          <div className="p-5 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-run-name">Nama cycle <span className="text-destructive">*</span></Label>
              <Input
                id="new-run-name"
                value={runName}
                onChange={event => onRunNameChange(event.target.value)}
                placeholder="Regression Release 1.2"
                className="h-10 rounded-xl border-border/60 bg-secondary/30 text-sm font-medium"
              />
              {!runName.trim() && <p className="text-xs text-muted-foreground">Nama cycle wajib diisi.</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-run-description">Deskripsi</Label>
              <Textarea
                id="new-run-description"
                value={runDescription}
                onChange={event => onRunDescriptionChange(event.target.value)}
                placeholder="Tujuan dan ruang lingkup cycle"
                className="min-h-20 rounded-xl border-border/60 bg-secondary/30 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-run-assignee">Tester / assignee</Label>
              <Input
                id="new-run-assignee"
                value={runAssignee}
                onChange={event => onRunAssigneeChange(event.target.value)}
                placeholder="Nama tester (opsional)"
                className="h-10 rounded-xl border-border/60 bg-secondary/30 text-sm font-medium"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Periode cycle</Label>
              <DateRangePicker
                from={runStartDate}
                to={runEndDate}
                onFromChange={onRunStartDateChange}
                onToChange={onRunEndDateChange}
                label="Pilih periode cycle"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Test Plan</Label>
              <Select value={runTestPlanId || 'none'} onValueChange={value => onRunTestPlanIdChange(value === 'none' ? '' : value)}>
                <SelectTrigger className="h-10 rounded-xl border-border/60 bg-secondary/30 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-xl shadow-lg border-border/60 bg-card">
                  <SelectItem value="none">Tanpa Test Plan</SelectItem>
                  {testPlans.map(plan => <SelectItem key={plan.id} value={plan.id}>{plan.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full mt-2 h-10 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-medium text-xs shadow-sm"
              onClick={onCreateRun}
              disabled={isSaving || !runName.trim()}
            >
              <Plus className="h-4 w-4 mr-1.5" />Buat Test Cycle
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ==================== 4. SHEET: KELOLA CYCLE ==================== */}
      <Sheet open={manageRunOpen} onOpenChange={onManageRunOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto p-0">
          <SheetHeader className="border-b border-border/40 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                <SlidersHorizontal className="h-5 w-5" />
              </div>
              <div>
                <SheetTitle className="text-base font-semibold text-foreground tracking-tight">Kelola Test Cycle</SheetTitle>
                <SheetDescription className="text-xs text-muted-foreground mt-0.5">
                  {selectedRun ? `${selectedRun.name} · ${selectedRun.summary.total} testcase` : 'Tambahkan atau kurangi test case dalam cycle ini.'}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>
          {selectedRun && (
            <div className="p-5 space-y-6">
              {/* Metadata & Status */}
              <div className="space-y-4 rounded-xl border border-border bg-card p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Detail & Status</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="manage-run-name">Nama cycle <span className="text-destructive">*</span></Label>
                    <Input id="manage-run-name" value={runName} onChange={e => onRunNameChange(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Status cycle</Label>
                    <Select value={selectedRun.status} onValueChange={onUpdateRunStatus} disabled={!canEdit || isSaving}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={TEST_RUN_STATUS.DRAFT}>Draft</SelectItem>
                        <SelectItem value={TEST_RUN_STATUS.READY}>Ready</SelectItem>
                        <SelectItem value={TEST_RUN_STATUS.IN_PROGRESS}>In Progress</SelectItem>
                        <SelectItem value={TEST_RUN_STATUS.COMPLETED}>Completed</SelectItem>
                        <SelectItem value={TEST_RUN_STATUS.ARCHIVED}>Archived</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="manage-run-assignee">Assignee</Label>
                    <Input id="manage-run-assignee" value={runAssignee} onChange={e => onRunAssigneeChange(e.target.value)} placeholder="Tester / assignee" />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="manage-run-desc">Deskripsi</Label>
                    <Textarea id="manage-run-desc" value={runDescription} onChange={e => onRunDescriptionChange(e.target.value)} className="min-h-16" />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Periode cycle</Label>
                    <DateRangePicker from={runStartDate} to={runEndDate} onFromChange={onRunStartDateChange} onToChange={onRunEndDateChange} label="Pilih periode cycle" />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Test Plan</Label>
                    <Select value={runTestPlanId || 'none'} onValueChange={v => onRunTestPlanIdChange(v === 'none' ? '' : v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Tanpa Test Plan</SelectItem>
                        {testPlans.map(plan => <SelectItem key={plan.id} value={plan.id}>{plan.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button onClick={onUpdateRunDetails} disabled={isSaving || !runName.trim()} className="w-full">
                  Simpan detail
                </Button>
              </div>

              {/* Testcase Management */}
              <div className="space-y-4 rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Testcase dalam Run</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{selectedRun.testCases.length} testcase terdaftar</p>
                  </div>
                  <MutationAction>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onTogglePicker}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      {pickerOpen ? 'Tutup picker' : 'Tambah testcase'}
                    </Button>
                  </MutationAction>
                </div>

                {pickerOpen && (
                  <div className="space-y-3 rounded-lg border border-border bg-secondary/20 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold">Pilih testcase untuk ditambahkan</span>
                      <Button size="sm" onClick={onAddCases} disabled={isSaving || selectedCaseIds.size === 0} className="h-8 text-xs">
                        Tambahkan pilihan ({selectedCaseIds.size})
                      </Button>
                    </div>
                    <Input
                      aria-label="Cari testcase untuk Test Run"
                      placeholder="Cari ID, halaman, atau aksi..."
                      value={pickerSearch}
                      onChange={e => onPickerSearchChange(e.target.value)}
                      className="h-8 text-xs bg-background"
                    />
                    {pickerLoading && <p role="status" className="text-xs text-muted-foreground">Memuat pilihan...</p>}
                    <div className="max-h-48 space-y-1 overflow-auto">
                      {selectableCases.map(testCase => (
                        <label key={testCase.id} className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-xs hover:bg-secondary/60">
                          <input
                            type="checkbox"
                            checked={selectedCaseIds.has(testCase.id)}
                            onChange={e => onToggleSelectableCase(testCase.id, e.target.checked)}
                            className="rounded border-border"
                          />
                          <span className="font-mono font-semibold text-primary">{testCase.testCaseId}</span>
                          <span className="text-muted-foreground truncate">{testCase.page}</span>
                        </label>
                      ))}
                      {!selectableCases.length && !pickerLoading && (
                        <p className="text-xs text-muted-foreground py-2 text-center">Semua testcase yang sesuai sudah dimasukkan.</p>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/50 text-xs text-muted-foreground">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        disabled={pickerLoading || pickerPage <= 1}
                        onClick={() => onPickerPageChange(pickerPage - 1)}
                      >
                        Sebelumnya
                      </Button>
                      <span>Halaman {pickerPage} dari {pickerPages}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        disabled={pickerLoading || pickerPage >= pickerPages}
                        onClick={() => onPickerPageChange(pickerPage + 1)}
                      >
                        Berikutnya
                      </Button>
                    </div>
                  </div>
                )}

                {selectedRun.testCases.length > 0 ? (() => {
                  const totalCasePages = Math.max(1, Math.ceil(selectedRun.testCases.length / RUN_CASES_PER_PAGE));
                  const page = Math.min(casePage, totalCasePages - 1);
                  const pageStart = page * RUN_CASES_PER_PAGE;
                  const pageCases = selectedRun.testCases.slice(pageStart, pageStart + RUN_CASES_PER_PAGE);
                  return (
                    <div className="space-y-1.5">
                      {pageCases.map(testCase => {
                        const index = selectedRun.testCases.findIndex(item => item.id === testCase.id);
                        return (
                          <div key={testCase.id} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-secondary/15 px-3 py-2 text-xs">
                            <div className="min-w-0 flex-1 truncate">
                              <span className="mr-2 font-mono text-muted-foreground">{index + 1}.</span>
                              <span className="font-mono font-semibold text-primary mr-2">{testCase.testCaseId}</span>
                              <span className="text-muted-foreground">{testCase.page}</span>
                            </div>
                            <MutationAction>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                                disabled={isSaving}
                                onClick={() => void onRemoveCaseFromRun(testCase.id)}
                                aria-label={`Hapus ${testCase.testCaseId} dari Test Run`}
                              >
                                Hapus
                              </Button>
                            </MutationAction>
                          </div>
                        );
                      })}
                      {totalCasePages > 1 && (
                        <div className="flex items-center justify-between gap-2 pt-2 text-xs text-muted-foreground">
                          <Button variant="outline" size="sm" className="h-7 px-2" disabled={page === 0} onClick={() => onCasePageChange(page - 1)}>
                            <ChevronLeft className="h-3.5 w-3.5 mr-1" />Sebelumnya
                          </Button>
                          <span>{pageStart + 1}-{pageStart + pageCases.length} dari {selectedRun.testCases.length}</span>
                          <Button variant="outline" size="sm" className="h-7 px-2" disabled={page >= totalCasePages - 1} onClick={() => onCasePageChange(page + 1)}>
                            Berikutnya<ChevronRight className="h-3.5 w-3.5 ml-1" />
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })() : (
                  <p className="text-xs text-muted-foreground">Belum ada testcase di Test Run ini.</p>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
