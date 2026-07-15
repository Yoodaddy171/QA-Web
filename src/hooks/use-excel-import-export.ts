import { useRef, useState } from 'react';
import type { ImportPreview } from '@/components/ImportExcelDialog';
import { useToast } from '@/hooks/use-toast';
import { importExcel, openExcelExport, previewExcelImport, undoExcelImport } from '@/lib/client/api/excel-client';

export function useExcelImportExport(selectedProject: string, onImportSuccess: () => void) {
  const { toast } = useToast();
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importCreateModules, setImportCreateModules] = useState(true);
  const [importing, setImporting] = useState(false);
  const [previewingImport, setPreviewingImport] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importMappings, setImportMappings] = useState<Record<string, Record<string, string>>>({});
  const [selectedImportFile, setSelectedImportFile] = useState<File | null>(null);
  const [lastImportBatchId, setLastImportBatchId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetImportPreview = () => {
    setImportPreview(null);
    setImportMappings({});
    setSelectedImportFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const notifyProjectRequired = () => {
    toast({
      title: 'Project belum dipilih',
      description: 'Buat atau pilih project terlebih dahulu sebelum import Excel.',
      variant: 'destructive',
    });
  };

  const openImportDialog = () => {
    if (!selectedProject) {
      notifyProjectRequired();
      return;
    }
    setShowImportDialog(true);
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!selectedProject) {
      resetImportPreview();
      notifyProjectRequired();
      return;
    }

    setPreviewingImport(true);
    setImportPreview(null);
    setSelectedImportFile(file);
    try {
      const data = await previewExcelImport({
        file,
        projectId: selectedProject,
        createModules: importCreateModules,
      });
      setImportPreview(data);
      setImportMappings(Object.fromEntries(data.sheets.map((sheet) => [sheet.sheet, sheet.mapping])));
      toast({
        title: data.canImport ? 'Preview Siap' : 'Preview Perlu Dicek',
        description: `${data.importableRows}/${data.totalRows} row siap import dari ${data.totalSheets} sheet`,
        variant: data.canImport ? undefined : 'destructive',
      });
    } catch {
      resetImportPreview();
      toast({ title: 'Preview Gagal', description: 'Terjadi kesalahan saat membaca file', variant: 'destructive' });
    }
    setPreviewingImport(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleConfirmImportExcel = async () => {
    if (!selectedImportFile) return;
    if (!selectedProject) {
      notifyProjectRequired();
      return;
    }

    setImporting(true);
    try {
      const data = await importExcel({
        file: selectedImportFile,
        projectId: selectedProject,
        createModules: importCreateModules,
        mappings: importMappings,
      });
      const sheetInfo = data.sheets?.map((s: { sheet: string; imported: number; skipped: number }) =>
        `${s.sheet}: ${s.imported} TC${s.skipped > 0 ? ` (${s.skipped} skipped)` : ''}`
      ).join('\n');
      toast({
        title: 'Import Berhasil',
        description: `${data.imported} test case dari ${data.totalSheets} sheet berhasil diimport${sheetInfo ? '\n' + sheetInfo : ''}`,
      });
      setLastImportBatchId(data.batchId);
      onImportSuccess();
      resetImportPreview();
    } catch {
      toast({ title: 'Import Gagal', description: 'Terjadi kesalahan saat import', variant: 'destructive' });
    }
    setImporting(false);
  };

  const handleExportExcel = (format: string = 'xlsx', testCaseIds?: string[]) => {
    if (!selectedProject) {
      notifyProjectRequired();
      return;
    }
    openExcelExport(selectedProject, format, testCaseIds);
  };

  const handleUndoImport = async () => {
    if (!selectedProject || !lastImportBatchId) return;
    try {
      const result = await undoExcelImport(selectedProject, lastImportBatchId);
      toast({ variant: 'success', title: 'Import dibatalkan', description: `${result.deleted} testcase dihapus${result.skipped ? `, ${result.skipped} dilewati karena sudah memiliki relasi.` : '.'}` });
      setLastImportBatchId(null);
      onImportSuccess();
      setShowImportDialog(false);
    } catch (error) {
      toast({ title: 'Undo import gagal', description: error instanceof Error ? error.message : 'Terjadi kesalahan.', variant: 'destructive' });
    }
  };

  return {
    showImportDialog,
    setShowImportDialog,
    importCreateModules,
    setImportCreateModules,
    importing,
    previewingImport,
    importPreview,
    importMappings,
    setImportMappings,
    setImportPreview,
    selectedImportFile,
    lastImportBatchId,
    fileInputRef,
    resetImportPreview,
    openImportDialog,
    handleImportExcel,
    handleConfirmImportExcel,
    handleUndoImport,
    handleExportExcel,
  };
}
