import type { ImportPreview } from '@/components/ImportExcelDialog';

export type ExcelImportMode = 'preview' | 'import';

function buildExcelImportFormData(input: {
  file: File;
  projectId: string;
  createModules: boolean;
  mode: ExcelImportMode;
  mappings?: Record<string, Record<string, string>>;
}) {
  const formDataObj = new FormData();
  formDataObj.append('file', input.file);
  formDataObj.append('projectId', input.projectId);
  formDataObj.append('createModules', input.createModules ? 'true' : 'false');
  formDataObj.append('mode', input.mode);
  if (input.mappings) formDataObj.append('mapping', JSON.stringify(input.mappings));
  return formDataObj;
}

export async function previewExcelImport(input: {
  file: File;
  projectId: string;
  createModules: boolean;
  mappings?: Record<string, Record<string, string>>;
}) {
  const res = await fetch('/api/excel', {
    method: 'POST',
    body: buildExcelImportFormData({ ...input, mode: 'preview' }),
  });
  if (!res.ok) throw new Error('Format file tidak sesuai');
  return res.json() as Promise<ImportPreview>;
}

export async function importExcel(input: {
  file: File;
  projectId: string;
  createModules: boolean;
  mappings?: Record<string, Record<string, string>>;
}) {
  const res = await fetch('/api/excel', {
    method: 'POST',
    body: buildExcelImportFormData({ ...input, mode: 'import' }),
  });
  if (!res.ok) throw new Error('Format file tidak sesuai');
  return res.json() as Promise<{ imported: number; sheets: Array<{ sheet: string; imported: number; skipped: number }>; totalSheets: number; batchId: string }>;
}

export async function undoExcelImport(projectId: string, batchId: string) {
  const res = await fetch(`/api/excel?projectId=${encodeURIComponent(projectId)}&batchId=${encodeURIComponent(batchId)}`, { method: 'DELETE' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Undo import gagal');
  return data as { deleted: number; skipped: number };
}

export function openExcelExport(projectId: string, format = 'xlsx', testCaseIds?: string[]) {
  const params = new URLSearchParams({ projectId, format });
  if (testCaseIds?.length) params.set('ids', testCaseIds.join(','));
  window.open(`/api/excel?${params.toString()}`, '_blank');
}
