import { useRef, useState } from 'react';
import type { ImportPreview } from '@/components/ImportExcelDialog';
import { useToast } from '@/hooks/use-toast';
import { importExcel, openExcelExport, previewExcelImport } from '@/lib/client/api/excel-client';

export function useExcelImportExport(selectedProject: string, onImportSuccess: () => void) {
  const { toast } = useToast();
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importCreateModules, setImportCreateModules] = useState(true);
  const [importing, setImporting] = useState(false);
  const [previewingImport, setPreviewingImport] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [selectedImportFile, setSelectedImportFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetImportPreview = () => {
    setImportPreview(null);
    setSelectedImportFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedProject) return;

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
    if (!selectedImportFile || !selectedProject) return;

    setImporting(true);
    try {
      const data = await importExcel({
        file: selectedImportFile,
        projectId: selectedProject,
        createModules: importCreateModules,
      });
      const sheetInfo = data.sheets?.map((s: { sheet: string; imported: number; skipped: number }) =>
        `${s.sheet}: ${s.imported} TC${s.skipped > 0 ? ` (${s.skipped} skipped)` : ''}`
      ).join('\n');
      toast({
        title: 'Import Berhasil',
        description: `${data.imported} test case dari ${data.totalSheets} sheet berhasil diimport${sheetInfo ? '\n' + sheetInfo : ''}`,
      });
      onImportSuccess();
      setShowImportDialog(false);
      resetImportPreview();
    } catch {
      toast({ title: 'Import Gagal', description: 'Terjadi kesalahan saat import', variant: 'destructive' });
    }
    setImporting(false);
  };

  const handleExportExcel = (format: string = 'xlsx') => {
    if (!selectedProject) return;
    openExcelExport(selectedProject, format);
  };

  return {
    showImportDialog,
    setShowImportDialog,
    importCreateModules,
    setImportCreateModules,
    importing,
    previewingImport,
    importPreview,
    selectedImportFile,
    fileInputRef,
    resetImportPreview,
    handleImportExcel,
    handleConfirmImportExcel,
    handleExportExcel,
  };
}
