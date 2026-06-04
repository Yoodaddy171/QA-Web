import type { ImportPreview } from '@/components/ImportExcelDialog';

export type ExcelImportMode = 'preview' | 'import';

function buildExcelImportFormData(input: {
  file: File;
  projectId: string;
  createModules: boolean;
  mode: ExcelImportMode;
}) {
  const formDataObj = new FormData();
  formDataObj.append('file', input.file);
  formDataObj.append('projectId', input.projectId);
  formDataObj.append('createModules', input.createModules ? 'true' : 'false');
  formDataObj.append('mode', input.mode);
  return formDataObj;
}

export async function previewExcelImport(input: {
  file: File;
  projectId: string;
  createModules: boolean;
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
}) {
  const res = await fetch('/api/excel', {
    method: 'POST',
    body: buildExcelImportFormData({ ...input, mode: 'import' }),
  });
  if (!res.ok) throw new Error('Format file tidak sesuai');
  return res.json();
}

export function openExcelExport(projectId: string, format = 'xlsx') {
  window.open(`/api/excel?projectId=${projectId}&format=${format}`, '_blank');
}
