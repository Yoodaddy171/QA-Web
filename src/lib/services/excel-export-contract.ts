// Report workbooks are review snapshots, not import templates. Keep this marker
// independent of ExcelJS so import validation and the browser share the contract.
export const QA_REPORT_MARKER = 'Traceva QA Report v1';
const LEGACY_QA_REPORT_MARKER = 'QADesk QA Report v1';
export const QA_REPORT_IMPORT_ERROR = 'QA Report adalah laporan untuk review, bukan template import. Gunakan Export Legacy XLSX untuk import kembali.';

export function isQaReportWorkbook(workbook: { Sheets: Record<string, Record<string, unknown>> }) {
  return Object.values(workbook.Sheets).some(sheet => {
    const cell = sheet.A1 as { v?: unknown } | undefined;
    return cell?.v === QA_REPORT_MARKER || cell?.v === LEGACY_QA_REPORT_MARKER;
  });
}

export function excelExportParams(projectId: string, format = 'xlsx', ids?: string[]) {
  const params = new URLSearchParams({ projectId, format: format === 'qa-report' ? 'xlsx' : format });
  if (format === 'qa-report') params.set('template', 'qa-report');
  if (ids?.length) params.set('ids', ids.join(','));
  return params;
}
