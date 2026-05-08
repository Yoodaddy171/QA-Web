'use client';

import React from 'react';
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, Upload, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

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
      <DialogContent className="max-h-[90vh] overflow-hidden border-border bg-card text-foreground elevation-3 rounded-2xl sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <span className="rounded-xl bg-primary/15 p-1.5 text-primary">
              <Upload className="w-5 h-5" />
            </span>
            Import Excel
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Preview file terlebih dahulu sebelum data masuk database.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 space-y-4 overflow-y-auto py-2 pr-1">
          <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-secondary/30 p-3">
            <Checkbox
              id="createModules"
              checked={createModules}
              disabled={busy || hasPreview}
              onCheckedChange={(checked) => onCreateModulesChange(checked === true)}
              className="border-border data-[state=checked]:border-primary data-[state=checked]:bg-primary"
            />
            <div className="flex-1">
              <Label htmlFor="createModules" className="cursor-pointer text-sm font-medium text-foreground">
                Buat Module dari nama Sheet
              </Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Setiap sheet di Excel akan menjadi Module tersendiri (misal: Kiosk, KDS, POS)
              </p>
            </div>
          </div>

          {!hasPreview && (
            <div className="space-y-3 rounded-xl border border-border/60 bg-secondary/20 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Format Kolom yang Didukung</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                <span>ID / Test Case ID</span>
                <span className="text-foreground">Test Case ID (wajib)</span>
                <span>Page</span>
                <span className="text-foreground">Halaman/Modul</span>
                <span>Sub Menu</span>
                <span className="text-foreground">Sub-menu/Bagian</span>
                <span>Feature</span>
                <span className="text-foreground">Fitur yang ditest</span>
                <span>Test</span>
                <span className="text-foreground">Deskripsi test</span>
                <span>Action</span>
                <span className="text-foreground">Prasyarat/Aksi</span>
                <span>Step / Steps</span>
                <span className="text-foreground">Langkah test</span>
                <span>Expected Result</span>
                <span className="text-foreground">Hasil yang diharapkan</span>
                <span>Actual Result</span>
                <span className="text-foreground">As Expected / Not As Expected</span>
                <span>Status</span>
                <span className="text-foreground">Done / Not Done / Failed</span>
                <span>Priority</span>
                <span className="text-foreground">Critical / High / Medium / Low</span>
                <span>Remarks of Test</span>
                <span className="text-foreground">Catatan tambahan</span>
                <span>Bobot / Weight</span>
                <span className="text-foreground">Bobot test case</span>
              </div>
            </div>
          )}

          {selectedFileName && (
            <div className="flex items-center justify-between rounded-xl border border-border/60 bg-secondary/30 px-4 py-3 text-sm">
              <div className="flex min-w-0 items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span className="truncate font-semibold text-foreground">{selectedFileName}</span>
              </div>
              {previewing && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
            </div>
          )}

          {importPreview && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-4">
                <div className="rounded-xl border border-border/60 bg-secondary/30 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Sheet</p>
                  <p className="text-2xl font-bold text-foreground">{importPreview.totalSheets}</p>
                </div>
                <div className="rounded-xl border border-border/60 bg-secondary/30 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Total Row</p>
                  <p className="text-2xl font-bold text-foreground">{importPreview.totalRows}</p>
                </div>
                <div className="rounded-xl border border-border/60 bg-secondary/30 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Siap Import</p>
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{importPreview.importableRows}</p>
                </div>
                <div className="rounded-xl border border-border/60 bg-secondary/30 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Issue</p>
                  <p className={`text-2xl font-bold ${importPreview.errorCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>
                    {importPreview.errorCount + importPreview.warningCount}
                  </p>
                </div>
              </div>

              <div className={`flex items-start gap-3 rounded-xl border p-4 text-sm ${
                importPreview.canImport 
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/5 dark:text-emerald-300' 
                  : 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/5 dark:text-red-300'
              }`}>
                {importPreview.canImport ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" /> : <XCircle className="mt-0.5 h-5 w-5 shrink-0" />}
                <p className="font-medium leading-relaxed">
                  {importPreview.canImport
                    ? 'File aman untuk diimport. Warning masih bisa kamu revisi setelah data masuk.'
                    : 'Ada error yang perlu dibereskan sebelum import, seperti duplicate ID, ID kosong, atau TC ID sudah ada di project.'}
                </p>
              </div>

              <ScrollArea className="h-[420px] rounded-xl border border-border/60 bg-secondary/10">
                <div className="space-y-6 p-4">
                  {importPreview.sheets.map((sheet) => {
                    const warningItems = Object.entries(sheet.missingRequiredCounts)
                      .filter(([field, count]) => field !== 'ID' && count > 0)
                      .map(([field, count]) => `${field}: ${count} kosong`);
                    const errorItems = [
                      ...sheet.missingHeaders.map((h) => `Header ${h} tidak ditemukan`),
                      ...(sheet.duplicateIdsInFile.length ? [`Duplicate di file: ${sheet.duplicateIdsInFile.slice(0, 5).join(', ')}${sheet.duplicateIdsInFile.length > 5 ? '...' : ''}`] : []),
                      ...(sheet.existingIds.length ? [`Sudah ada di project: ${sheet.existingIds.slice(0, 5).join(', ')}${sheet.existingIds.length > 5 ? '...' : ''}`] : []),
                      ...(sheet.invalidStatusRows.length ? [`Status invalid di ${sheet.invalidStatusRows.length} row`] : []),
                      ...(sheet.missingRequiredCounts.ID ? [`ID kosong: ${sheet.missingRequiredCounts.ID}`] : []),
                    ];

                    return (
                      <div key={sheet.sheet} className="rounded-xl border border-border/60 overflow-hidden">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 bg-secondary/30 p-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-foreground">{sheet.sheet}</p>
                              {sheet.moduleName && <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary text-[10px]">Module: {sheet.moduleName}</Badge>}
                            </div>
                            <p className="text-[10px] font-medium text-muted-foreground mt-1">
                              Header row {sheet.headerRow ?? '-'} · <span className="text-emerald-600 dark:text-emerald-400">{sheet.importableRows}/{sheet.totalRows}</span> row siap import
                            </p>
                          </div>
                          {errorItems.length > 0 ? (
                            <Badge variant="failed">{errorItems.length} error</Badge>
                          ) : warningItems.length > 0 ? (
                            <Badge variant="warning">{warningItems.length} warning</Badge>
                          ) : (
                            <Badge variant="success">OK</Badge>
                          )}
                        </div>

                        {(errorItems.length > 0 || warningItems.length > 0) && (
                          <div className="space-y-1.5 border-b border-border/50 bg-muted/30 p-4 text-[11px]">
                            {errorItems.map((item) => (
                              <div key={item} className="flex items-start gap-2 text-red-600 dark:text-red-400 font-medium">
                                <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                <span>{item}</span>
                              </div>
                            ))}
                            {warningItems.map((item) => (
                              <div key={item} className="flex items-start gap-2 text-amber-600 dark:text-amber-400 font-medium">
                                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                <span>{item}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        <Table>
                          <TableHeader className="bg-secondary/30">
                            <TableRow className="border-border/50 hover:bg-transparent">
                              {['ID', 'Page', 'Sub Menu', 'Feature', 'Status'].map((header) => (
                                <TableHead key={header} className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground h-10">{header}</TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {sheet.previewRows.map((row, index) => (
                              <TableRow key={`${sheet.sheet}-${index}`} className="border-border/30 hover:bg-secondary/20">
                                {['ID', 'Page', 'Sub Menu', 'Feature', 'Status'].map((header) => (
                                  <TableCell key={header} className="max-w-[220px] truncate text-muted-foreground text-xs py-3">
                                    {row[header] || <span className="text-muted-foreground/50">-</span>}
                                  </TableCell>
                                ))}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          )}

          {!hasPreview && (
            <p className="text-[11px] font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 p-3 rounded-xl">
              <span className="font-semibold">Auto-detect:</span> Header baris otomatis terdeteksi. Sheet dengan header di baris ke-2 atau ke-4 juga didukung.
            </p>
          )}
        </div>
        <DialogFooter className="gap-2 border-t border-border/50 pt-4">
          <Button variant="outline" onClick={() => hasPreview ? onClearPreview() : onOpenChange(false)} disabled={busy} className="rounded-xl">
            {hasPreview ? 'Ganti File' : 'Batal'}
          </Button>
          <Button
            onClick={hasPreview ? onConfirmImport : onChooseFile}
            disabled={busy || (hasPreview && !importPreview?.canImport)}
            className="gap-1.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 elevation-1"
          >
            {importing ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Mengimport...</>
            ) : previewing ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Membaca File...</>
            ) : hasPreview ? (
              <><Upload className="w-4 h-4" /> Konfirmasi Import</>
            ) : (
              <><Upload className="w-4 h-4" /> Pilih File & Preview</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
