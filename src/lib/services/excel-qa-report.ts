import ExcelJS from 'exceljs';
import { TESTCASE_STATUS, TESTCASE_STATUSES } from '@/lib/domain/testcase';
import type { ExportTestCase } from './excel-export-service';
import { QA_REPORT_MARKER } from './excel-export-contract';

const INK = 'FF18243B';
const INDIGO = 'FF4338CA';
const MUTED = 'FF526176';
const LINE = 'FFE2E8F0';
const STATUS_COLORS: Record<string, [string, string]> = {
  DONE: ['FFE8F5EC', 'FF166534'],
  FAILED: ['FFFDECEC', 'FF991B1B'],
  BLOCKED: ['FFFFF4DD', 'FF92400E'],
  'READY TO RETEST': ['FFEDE9FE', 'FF5B21B6'],
  'IN PROGRESS': ['FFE8F0FE', 'FF1E40AF'],
  'NOT DONE': ['FFF1F5F9', 'FF475569'],
  TBA: ['FFF1F5F9', 'FF475569'],
};

export const REPORT_HEADERS = ['ID', 'Module', 'Page', 'Sub Menu', 'Test Type', 'Priority', 'Test Action', 'Prerequisite', 'Steps', 'Expected Result', 'Actual Result', 'Status', 'Progress', 'Weight', 'Remarks', 'Tags', 'Updated At (UTC)', 'Created At (UTC)', 'UUID'];
const WIDTHS = [23, 26, 24, 24, 14, 13, 46, 35, 52, 52, 42, 23, 13, 13, 36, 24, 24, 24, 31];

type ReportOptions = { projectName: string; testCases: ExportTestCase[]; selectedOnly?: boolean; generatedAt?: Date };

function header(row: ExcelJS.Row) {
  row.height = 30;
  row.eachCell(cell => {
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INK } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = { right: { style: 'thin', color: { argb: 'FFFFFFFF' } } };
  });
}

function body(row: ExcelJS.Row, shaded = false) {
  row.eachCell({ includeEmpty: true }, cell => {
    cell.font = { name: 'Arial', size: 10, color: { argb: INK } };
    cell.alignment = { vertical: 'top', wrapText: true };
    if (shaded) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F9FC' } };
    cell.border = { bottom: { style: 'hair', color: { argb: LINE } } };
  });
}

function display(value: string | null | undefined) { return value || '—'; }
function moduleName(tc: ExportTestCase) { return tc.module?.name || 'Ungrouped'; }
function fraction(value: number) { return value / 100; }

function reportValues(tc: ExportTestCase): ExcelJS.CellValue[] {
  // Do not parse testAction into feature/test: multiline descriptions must survive.
  const match = (tc.steps || '').match(/^Prerequisite:\s*([\s\S]+?)(?:\n\nSteps:\n|\nSteps:\n)([\s\S]*)/);
  return [tc.testCaseId, moduleName(tc), display(tc.page), display(tc.subMenu), tc.testType, tc.priority,
    display(tc.testAction), display(match?.[1]), display(match ? match[2] : tc.steps),
    display(tc.expectedResult), display(tc.actualResult), tc.status, fraction(tc.progress),
    tc.calculatedWeight == null ? null : fraction(tc.calculatedWeight), display(tc.remarks), display(tc.tags),
    tc.updatedAt, tc.createdAt, tc.id];
}

/** Numeric results are cached for non-calculating readers; Excel recalculates formulas on open. */
export function createQaReport({ projectName, testCases, selectedOnly = false, generatedAt = new Date() }: ReportOptions) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'QADesk';
  workbook.created = generatedAt;
  workbook.modified = generatedAt;
  workbook.calcProperties.fullCalcOnLoad = true;
  const groups = new Map<string, ExportTestCase[]>();
  for (const tc of testCases) { const name = moduleName(tc); if (!groups.has(name)) groups.set(name, []); groups.get(name)!.push(tc); }
  const groupKeys = new Map([...groups.keys()].map((name, index) => [name, index + 1]));
  const summary = workbook.addWorksheet('Summary', { views: [{ showGridLines: false }], properties: { tabColor: { argb: INDIGO } } });
  const cases = workbook.addWorksheet('Test Cases', { views: [{ state: 'frozen', xSplit: 2, ySplit: 1, showGridLines: false, zoomScale: 85 }] });
  REPORT_HEADERS.forEach((_, i) => { cases.getColumn(i + 1).width = WIDTHS[i]; });
  header(cases.addRow([...REPORT_HEADERS, 'Module group (internal)']));
  // Numeric join keys keep case-distinct names and literal wildcard characters
  // reliable across Excel and non-Excel readers. They move with sorted rows.
  cases.getColumn(20).hidden = true;
  for (const [i, tc] of testCases.entries()) {
    const row = cases.addRow([...reportValues(tc), groupKeys.get(moduleName(tc))!]);
    body(row, i % 2 === 1);
    // Estimate wrapped lines without capping long text into an unreadable fixed height.
    const lines = row.values instanceof Array ? Math.max(...row.values.slice(1).map((value, j) => {
      if (typeof value !== 'string') return 1;
      return value.split('\n').reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / Math.max(8, WIDTHS[j] - 3))), 0);
    })) : 1;
    row.height = Math.min(409, Math.max(36, lines * 14 + 10));
    row.getCell(1).font = { name: 'Arial', size: 10, bold: true, color: { argb: INK } };
    for (const col of [13, 14]) { row.getCell(col).numFmt = '0.00%'; row.getCell(col).alignment = { horizontal: 'right', vertical: 'top' }; }
    for (const col of [17, 18]) row.getCell(col).numFmt = 'dd mmm yyyy hh:mm';
  }
  cases.autoFilter = { from: 'A1', to: `T${Math.max(1, cases.rowCount)}` };
  if (testCases.length) {
    for (const [status, [fill, color]] of Object.entries(STATUS_COLORS)) {
      cases.addConditionalFormatting({ ref: `L2:L${cases.rowCount}`, rules: [{
        type: 'expression', formulae: [`L2="${status}"`], priority: 1,
        style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } }, font: { bold: true, color: { argb: color } } },
      }] });
    }
  }
  cases.pageSetup = { orientation: 'landscape', paperSize: 9, scale: 85, fitToPage: false, printTitlesRow: '1:1', printTitlesColumn: 'A:B' };
  cases.headerFooter.oddFooter = 'QADesk | &P / &N';

  [32, 18, 18, 18, 18, 18, 18, 18].forEach((width, i) => { summary.getColumn(i + 1).width = width; });
  summary.getCell('A1').value = QA_REPORT_MARKER;
  summary.getRow(1).hidden = true;
  summary.mergeCells('A3:H3');
  summary.getCell('A3').value = `QA Report — ${projectName}`;
  summary.getCell('A3').font = { name: 'Arial', size: 16, bold: true, color: { argb: INK } };
  summary.getCell('A3').alignment = { wrapText: true, vertical: 'middle' };
  summary.getRow(3).height = Math.max(30, Math.ceil(projectName.length / 100) * 22);
  summary.getCell('A5').value = 'Waktu export (UTC)';
  summary.getCell('B5').value = generatedAt;
  summary.getCell('B5').numFmt = 'dd mmm yyyy hh:mm';
  summary.mergeCells('B5:D5');
  summary.getCell('A6').value = 'Cakupan';
  summary.mergeCells('B6:H6');
  summary.getCell('B6').value = selectedOnly ? 'Testcase yang dipilih saja (bukan seluruh project)' : 'Seluruh testcase dalam project';
  summary.mergeCells('A7:H7');
  summary.getCell('A7').value = 'Snapshot status testcase saat export, bukan hasil satu test run atau keputusan release readiness.';
  summary.mergeCells('A8:H8');
  summary.getCell('A8').value = 'Untuk import kembali gunakan Legacy XLSX. Weight mengikuti bobot kelompok di project; jumlahnya tidak harus 100%.';
  summary.getRow(8).height = 30;
  summary.mergeCells('A9:H9');
  summary.getCell('A9').value = 'Progress = rata-rata progress testcase non-TBA. — berarti belum ada testcase yang memenuhi perhitungan.';
  for (const n of [5, 6, 7, 8, 9]) {
    summary.getRow(n).eachCell(cell => { cell.font = { name: 'Arial', size: 10, color: { argb: MUTED } }; cell.alignment = { vertical: 'middle', wrapText: true }; });
    if (n !== 8) summary.getRow(n).height = 24;
  }

  const end = Math.max(2, cases.rowCount);
  const range = (col: string) => `'Test Cases'!$${col}$2:$${col}$${end}`;
  const count = (status: string) => testCases.filter(tc => tc.status === status).length;
  const eligible = testCases.filter(tc => tc.status !== TESTCASE_STATUS.TBA);
  const avg = (values: ExportTestCase[]) => values.length ? values.reduce((sum, tc) => sum + fraction(tc.progress), 0) / values.length : '—';
  const formula = (expression: string, result: number | string): ExcelJS.CellFormulaValue => ({ formula: expression, result });
  summary.getRow(11).values = ['Status', 'Jumlah', 'Proporsi'];
  header(summary.getRow(11));
  const statuses = [...TESTCASE_STATUSES, ...new Set(testCases.map(tc => tc.status).filter(s => !TESTCASE_STATUSES.includes(s as typeof TESTCASE_STATUSES[number])))];
  statuses.forEach((status, i) => {
    const row = summary.getRow(12 + i);
    row.values = [status === TESTCASE_STATUS.DONE ? 'DONE (Passed)' : status,
      formula(`COUNTIF(${range('L')},"${status.replaceAll('"', '""')}")`, count(status)),
      formula(`IFERROR(B${12 + i}/COUNTA(${range('A')}),0)`, testCases.length ? count(status) / testCases.length : 0)];
    body(row, i % 2 === 1); row.height = 25; row.getCell(3).numFmt = '0.0%';
  });
  const totalRow = 12 + statuses.length;
  summary.getRow(totalRow).values = ['Total testcase', formula(`COUNTA(${range('A')})`, testCases.length)];
  body(summary.getRow(totalRow)); summary.getRow(totalRow).font = { name: 'Arial', size: 10, bold: true, color: { argb: INK } };
  summary.getRow(totalRow).height = 26;
  summary.getRow(totalRow + 1).values = ['Progress (non-TBA)', formula(`IFERROR(AVERAGEIF(${range('L')},"<>TBA",${range('M')}),"—")`, avg(eligible))];
  body(summary.getRow(totalRow + 1)); summary.getRow(totalRow + 1).getCell(2).numFmt = '0.0%'; summary.getRow(totalRow + 1).height = 26;

  const moduleRow = totalRow + 4;
  summary.getRow(moduleRow).values = ['Module', 'Total', 'Done', 'Failed', 'Blocked', 'Retest', 'TBA', 'Progress'];
  header(summary.getRow(moduleRow));
  let next = moduleRow + 1;
  for (const [name, group] of groups) {
    const row = summary.getRow(next++);
    const key = groupKeys.get(name)!;
    row.values = [name, formula(`COUNTIF(${range('T')},${key})`, group.length),
      ...[TESTCASE_STATUS.DONE, TESTCASE_STATUS.FAILED, TESTCASE_STATUS.BLOCKED, TESTCASE_STATUS.READY_TO_RETEST, TESTCASE_STATUS.TBA].map(status => formula(`COUNTIFS(${range('T')},${key},${range('L')},"${status}")`, group.filter(tc => tc.status === status).length)),
      formula(`IFERROR(AVERAGEIFS(${range('M')},${range('T')},${key},${range('L')},"<>TBA"),"—")`, avg(group.filter(tc => tc.status !== TESTCASE_STATUS.TBA)))];
    body(row, next % 2 === 0); row.height = Math.max(28, Math.ceil(name.length / 29) * 14 + 8); row.getCell(8).numFmt = '0.0%';
  }
  if (!testCases.length) {
    summary.mergeCells(next, 1, next, 8);
    summary.getCell(next, 1).value = 'Belum ada testcase dalam cakupan export ini.';
    body(summary.getRow(next)); summary.getRow(next).height = 30;
  }
  summary.pageSetup = { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, printArea: `A3:H${next}` };
  summary.headerFooter.oddFooter = 'QADesk | &P / &N';
  return workbook;
}
