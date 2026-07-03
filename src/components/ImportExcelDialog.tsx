'use client';

import React from 'react';
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, Target, Upload, XCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

export interface ImportPreviewSheet {
  sheet: string;
  moduleName: string | null;
  headerRow: number | null;
  totalRows: number;
  importableRows: number;
  skippedEstimate: number;
  headers: string[];
  missingHeaders: string[];
  missingRequiredCounts: Record<string, number>;
  duplicateIdsInFile: string[];
  existingIds: string[];
  invalidStatusRows: number[];
  previewRows: Record<string, string>[];
}

export interface ImportPreview {
  mode: 'preview';
  canImport: boolean;
  totalSheets: number;
  totalRows: number;
  importableRows: number;
  warningCount: number;
  errorCount: number;
  sheets: ImportPreviewSheet[];
}

interface ImportExcelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  createModules: boolean;
  onCreateModulesChange: (value: boolean) => void;
  importing: boolean;
  previewing: boolean;
  selectedFileName: string;
  importPreview: ImportPreview | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onChooseFile: () => void;
  onConfirmImport: () => void;
  onClearPreview: () => void;
}

export function ImportExcelDialog({
  open,
  onOpenChange,
  createModules,
  onCreateModulesChange,
  importing,
  previewing,
  selectedFileName,
  importPreview,
  fileInputRef,
  onChooseFile,
  onConfirmImport,
  onClearPreview,
}: ImportExcelDialogProps) {
  const busy = importing || previewing;
  const hasPreview = Boolean(importPreview);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden border-border/60 bg-card text-foreground elevation-3 rounded-2xl sm:max-w-5xl p-0">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-primary via-indigo-500 to-cyan-500" />

        <DialogHeader className="px-6 py-5 border-b border-border/40 bg-gradient-to-r from-primary/5 via-indigo-500/5 to-cyan-500/5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/15 text-primary shadow-sm">
              <Upload className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold tracking-tight bg-gradient-to-r from-primary via-indigo-400 to-cyan-400 bg-clip-text text-transparent">Import Excel</DialogTitle>
              <DialogDescription className="text-muted-foreground text-[11px] font-medium leading-relaxed">Preview dan validasi data Excel Anda sebelum diintegrasikan ke database.</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-border/40 scrollbar-track-transparent">
          <div className="flex items-center gap-4 rounded-2xl border border-primary/20 bg-primary/5 p-4 shadow-inner group transition-all duration-300 hover:bg-primary/10">
            <Checkbox
              id="createModules"
              checked={createModules}
              disabled={busy || hasPreview}
              onCheckedChange={(checked) => onCreateModulesChange(checked === true)}
              className="h-5 w-5 rounded-md border-primary/30 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
            />
            <div className="flex-1">
              <Label htmlFor="createModules" className="cursor-pointer text-[10px] font-semibold uppercase tracking-[0.15em] text-primary">
                Auto-Generate Modules from Sheets
              </Label>
              <p className="mt-1 text-xs text-muted-foreground font-medium leading-relaxed">
                Setiap sheet di Excel (misal: Auth, POS, Dashboard) akan otomatis menjadi Module project.
              </p>
            </div>
          </div>

          {!hasPreview && (
            <div className="space-y-4 rounded-2xl border border-border/60 bg-secondary/20 p-5 shadow-inner">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Pemetaan Kolom yang Didukung</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
                {[
                  { label: 'ID / TC ID', desc: 'ID Test Case' },
                  { label: 'Page / Module', desc: 'Halaman Utama' },
                  { label: 'Sub Menu', desc: 'Bagian Fitur' },
                  { label: 'Feature', desc: 'Fitur Utama' },
                  { label: 'Action / Steps', desc: 'Langkah Test' },
                  { label: 'Expected Result', desc: 'Hasil Harapan' },
                  { label: 'Status', desc: 'Done/Failed' },
                  { label: 'Priority', desc: 'Urgency' },
                  { label: 'Bobot / Weight', desc: 'Complexity' },
                ].map((item) => (
                  <div key={item.label} className="flex flex-col gap-0.5">
                    <span className="text-[11px] font-bold text-foreground">{item.label}</span>
                    <span className="text-[10px] text-muted-foreground font-medium">{item.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedFileName && (
            <div className="flex items-center justify-between rounded-2xl border border-primary/30 bg-primary/5 px-5 py-4 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex min-w-0 items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground opacity-60">File Sumber</p>
                  <p className="truncate font-bold text-foreground text-sm">{selectedFileName}</p>
                </div>
              </div>
              {previewing && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
            </div>
          )}

          {importPreview && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="grid gap-4 sm:grid-cols-4">
                {[
                  { label: 'Sheets', value: importPreview.totalSheets, color: 'text-foreground' },
                  { label: 'Total Rows', value: importPreview.totalRows, color: 'text-foreground' },
                  { label: 'Ready to Import', value: importPreview.importableRows, color: 'text-emerald-600 dark:text-emerald-400' },
                  { label: 'Issues Found', value: importPreview.errorCount + importPreview.warningCount, color: importPreview.errorCount > 0 ? 'text-rose-500' : 'text-amber-500' },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-2xl border border-border/60 bg-secondary/30 p-4 shadow-sm hover:border-primary/30 transition-all">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 opacity-60">{stat.label}</p>
                    <p className={cn("text-2xl font-semibold tracking-tight", stat.color)}>{stat.value}</p>
                  </div>
                ))}
              </div>

              <div className={cn(
                "flex items-start gap-4 rounded-2xl border p-5 shadow-inner transition-all duration-300",
                importPreview.canImport
                  ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300'
                  : 'border-rose-500/20 bg-rose-500/5 text-rose-700 dark:text-rose-300'
              )}>
                {importPreview.canImport ? <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0" /> : <XCircle className="mt-0.5 h-6 w-6 shrink-0" />}
                <div className="min-w-0">
                  <p className="font-semibold uppercase tracking-wider text-[11px] mb-1">Hasil Validasi</p>
                  <p className="text-[13px] font-bold leading-relaxed">
                  {importPreview.canImport
                      ? 'File divalidasi aman. Skenario yang memiliki warning tetap dapat diimport dan diperbaiki kemudian.'
                      : 'Terdapat anomali data (duplicate ID atau kolom wajib kosong) yang harus diperbaiki di file Excel.'}
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                {importPreview.sheets.map((sheet, sIdx) => {
                  const warningItems = Object.entries(sheet.missingRequiredCounts)
                    .filter(([field, count]) => field !== 'ID' && count > 0)
                    .map(([field, count]) => `${field}: ${count} empty`);
                  const errorItems = [
                    ...sheet.missingHeaders.map((h) => `Header mapping '${h}' missing`),
                    ...(sheet.duplicateIdsInFile.length ? [`Duplicates in file: ${sheet.duplicateIdsInFile.slice(0, 3).join(', ')}...`] : []),
                    ...(sheet.existingIds.length ? [`Already in project: ${sheet.existingIds.slice(0, 3).join(', ')}...`] : []),
                    ...(sheet.invalidStatusRows.length ? [`Invalid status values found`] : []),
                    ...(sheet.missingRequiredCounts.ID ? [`Required ID missing: ${sheet.missingRequiredCounts.ID} rows`] : []),
                  ];

                  return (
                    <motion.div
                      key={sheet.sheet}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: sIdx * 0.1 }}
                      className="rounded-2xl border border-border/60 bg-card overflow-hidden shadow-md group"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/40 bg-secondary/40 px-5 py-4 group-hover:bg-secondary/60 transition-colors">
                        <div className="min-w-0">
                          <div className="flex items-center gap-3">
                            <p className="font-semibold text-foreground text-sm tracking-tight">{sheet.sheet}</p>
                            {sheet.moduleName && (
                              <Badge variant="outline" className="rounded-lg border-primary/20 bg-primary/10 text-primary text-[10px] font-semibold uppercase tracking-tighter">
                                Module: {sheet.moduleName}
                              </Badge>
                            )}
                          </div>
                          <p className="text-[10px] font-bold text-muted-foreground/60 mt-1 uppercase tracking-wider">
                            Header Row {sheet.headerRow ?? '?'} <span className="mx-2 opacity-30">|</span>
                            <span className="text-emerald-600 dark:text-emerald-400">{sheet.importableRows} / {sheet.totalRows} Ready</span>
                          </p>
                        </div>
                        <div className="shrink-0">
                          {errorItems.length > 0 ? (
                            <Badge className="bg-rose-500 text-white border-none rounded-lg px-3 py-1 font-semibold text-[10px] uppercase shadow-lg shadow-rose-500/20">{errorItems.length} Critical Issues</Badge>
                          ) : warningItems.length > 0 ? (
                            <Badge className="bg-amber-500 text-white border-none rounded-lg px-3 py-1 font-semibold text-[10px] uppercase shadow-lg shadow-amber-500/20">{warningItems.length} Warnings</Badge>
                          ) : (
                            <Badge className="bg-emerald-500 text-white border-none rounded-lg px-3 py-1 font-semibold text-[10px] uppercase shadow-lg shadow-emerald-500/20">Sheet Tervalidasi</Badge>
                          )}
                        </div>
                      </div>

                      {(errorItems.length > 0 || warningItems.length > 0) && (
                        <div className="space-y-2 border-b border-border/40 bg-secondary/10 p-5 shadow-inner">
                          {errorItems.map((item) => (
                            <div key={item} className="flex items-start gap-3 text-rose-600 dark:text-rose-400 font-bold text-[11px] leading-tight animate-in fade-in duration-300">
                              <XCircle className="h-4 w-4 shrink-0" />
                              <span>{item}</span>
                            </div>
                          ))}
                          {warningItems.map((item) => (
                            <div key={item} className="flex items-start gap-3 text-amber-600 dark:text-amber-400 font-bold text-[11px] leading-tight animate-in fade-in duration-300">
                              <AlertTriangle className="h-4 w-4 shrink-0" />
                              <span>{item}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader className="bg-secondary/20">
                            <TableRow className="border-border/40 hover:bg-transparent h-10">
                              {['ID', 'Page', 'Sub Menu', 'Feature', 'Status'].map((header) => (
                                <TableHead key={header} className="text-[9px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/60 px-5">{header}</TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {sheet.previewRows.map((row, index) => (
                              <TableRow key={`${sheet.sheet}-${index}`} className="border-b border-border/30 hover:bg-secondary/10 transition-colors h-12">
                                {['ID', 'Page', 'Sub Menu', 'Feature', 'Status'].map((header) => (
                                  <TableCell key={header} className="max-w-[200px] truncate text-foreground font-medium text-[11px] px-5 py-0">
                                    {row[header] || <span className="text-muted-foreground/30">—</span>}
                                  </TableCell>
                                ))}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}

          {!hasPreview && (
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 flex gap-4 items-start shadow-inner">
              <div className="mt-1 p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Target className="h-4 w-4" />
              </div>
              <p className="text-[11px] text-muted-foreground font-medium leading-relaxed">
                <strong className="text-amber-600 dark:text-amber-400 font-semibold uppercase tracking-tight mr-1.5">Auto-Detect:</strong> Header baris otomatis terdeteksi (Sheet dengan header di baris ke-2 atau ke-4 didukung). Pastikan ID unik untuk setiap test case.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 gap-3 border-t border-border/40 px-6 py-5 bg-secondary/10">
          <Button
            variant="outline"
            onClick={() => hasPreview ? onClearPreview() : onOpenChange(false)}
            disabled={busy}
            className="h-10 rounded-xl border-border/60 bg-card text-muted-foreground font-bold text-xs px-6 transition-all hover:bg-secondary"
          >
            {hasPreview ? 'Ganti File' : 'Batal'}
          </Button>
          <Button
            onClick={hasPreview ? onConfirmImport : onChooseFile}
            disabled={busy || (hasPreview && !importPreview?.canImport)}
            className={cn(
              "h-10 gap-2.5 rounded-xl text-white font-semibold text-xs px-8 shadow-lg transition-all duration-300 uppercase tracking-wider",
              hasPreview && !importPreview?.canImport
                ? "bg-muted text-muted-foreground"
                : "bg-gradient-to-r from-primary via-indigo-600 to-cyan-600 hover:from-primary/90 hover:via-indigo-600/90 hover:to-cyan-600/90 hover:shadow-primary/30"
            )}
          >
            {importing ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Mengimport...</>
            ) : previewing ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Membaca File...</>
            ) : hasPreview ? (
              <><CheckCircle2 className="w-4 h-4" /> Konfirmasi Import</>
            ) : (
              <><Upload className="w-4 h-4" /> Pilih File & Preview</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
