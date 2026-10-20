import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import { writeFile } from 'node:fs/promises';
import { createQaReport, REPORT_HEADERS } from './excel-qa-report';
import { HEADERS, uniqueExcelSheetName, writeHeaderRow, writeTestCaseRows, type ExportTestCase } from './excel-export-service';
import { excelExportParams, isQaReportWorkbook } from './excel-export-contract';
import { getDefaultImportMapping, getDetectedHeaders, mapImportRow, parseSheetWithAutoHeader } from './excel-normalization';

const at = new Date('2026-10-19T04:30:00Z');
function tc(overrides: Partial<ExportTestCase> = {}): ExportTestCase {
  return { id: 'uuid-a', testCaseId: 'AUTH-001', projectId: 'p', moduleId: 'm', module: { name: 'Auth' },
    page: 'Login', subMenu: 'Session', testType: 'Negative', priority: 'High', testAction: '[Auth] Reject login',
    steps: 'Prerequisite: Logged out\n\nSteps:\nEnter invalid password\nClick Login',
    expectedResult: 'Show error\nStay on Login', actualResult: 'Not As Expected', remarks: 'Investigate', tags: 'auth, smoke',
    status: 'FAILED', progress: 50, calculatedWeight: 25, weight: null, createdAt: at, updatedAt: at,
    ...overrides } as ExportTestCase;
}
async function roundtrip(workbook: ExcelJS.Workbook) {
  const buffer = await workbook.xlsx.writeBuffer();
  const loaded = new ExcelJS.Workbook();
  await loaded.xlsx.load(buffer);
  return { loaded, parsed: XLSX.read(buffer, { type: 'buffer', cellDates: true }), buffer };
}

describe('QA Report workbook', () => {
  it('serializes real typed values, all text, UUIDs, navigation and a single flat table', async () => {
    const text = '=HYPERLINK("https://example.invalid","literal")\nSecond line';
    const workbook = createQaReport({ projectName: 'QA / Team', testCases: [tc({ testAction: text })], generatedAt: at });
    const { loaded, parsed } = await roundtrip(workbook);
    expect(loaded.worksheets.map(s => s.name)).toEqual(['Summary', 'Test Cases']);
    const sheet = loaded.getWorksheet('Test Cases')!;
    expect(sheet.getRow(1).values).toEqual([undefined, ...REPORT_HEADERS, 'Module group (internal)']);
    expect(sheet.getColumn(20).hidden).toBe(true);
    expect(sheet.getCell('T2').value).toBe(1);
    expect(sheet.getCell('A2').value).toBe('AUTH-001');
    expect(sheet.getCell('E2').value).toBe('Negative');
    expect(sheet.getCell('F2').value).toBe('High');
    expect(sheet.getCell('G2').value).toBe(text); // literal text, never a formula
    expect(sheet.getCell('H2').value).toBe('Logged out');
    expect(sheet.getCell('I2').value).toBe('Enter invalid password\nClick Login');
    expect(sheet.getCell('J2').alignment.wrapText).toBe(true);
    expect(sheet.getCell('M2').value).toBe(.5);
    expect(sheet.getCell('N2').value).toBe(.25);
    expect(sheet.getCell('M2').numFmt).toBe('0.00%');
    expect(sheet.getCell('Q2').value).toEqual(at);
    expect(sheet.getCell('S2').value).toBe('uuid-a');
    expect(sheet.views[0]).toMatchObject({ state: 'frozen', xSplit: 2, ySplit: 1 });
    expect(sheet.autoFilter).toBe('A1:T2');
    expect(sheet.rowCount).toBe(2);
    expect(isQaReportWorkbook(parsed)).toBe(true);
  });

  it('reconciles summary counts and non-TBA progress with the exported subset only', async () => {
    const inputs = [tc(), tc({ id: 'b', testCaseId: 'AUTH-003', status: 'DONE', progress: 100 }),
      tc({ id: 'c', status: 'TBA', progress: 0, calculatedWeight: null }),
      tc({ id: 'd', module: null, status: 'BLOCKED', progress: 0 })];
    const { loaded, parsed, buffer } = await roundtrip(createQaReport({ projectName: 'Sample', testCases: inputs, selectedOnly: true, generatedAt: at }));
    if (process.env.QA_REPORT_VISUAL_PATH) await writeFile(process.env.QA_REPORT_VISUAL_PATH, new Uint8Array(buffer));
    const summary = loaded.getWorksheet('Summary')!;
    expect(summary.getCell('B6').value).toContain('dipilih saja');
    expect(summary.getCell('B12').value).toMatchObject({ result: 1 });
    expect(summary.getCell('B19').value).toMatchObject({ result: 4, formula: expect.stringContaining('COUNTA') });
    expect(summary.getCell('B20').value).toMatchObject({ result: .5 });
    expect(summary.getCell('A24').value).toBe('Auth');
    expect(summary.getCell('B24').value).toMatchObject({ result: 3 });
    expect(summary.getCell('H24').value).toMatchObject({ result: .75 });
    expect(summary.getCell('A25').value).toBe('Ungrouped');
    // ExcelJS's reader omits cached zero results; independently verify the serialized cell.
    expect(parsed.Sheets.Summary.H25.v).toBe(0);
    expect(loaded.getWorksheet('Test Cases')!.getCell('N4').value).toBeNull();
  });

  it('handles empty and all-TBA exports without formula errors or fake completed progress', async () => {
    for (const inputs of [[], [tc({ status: 'TBA' })]]) {
      const { loaded, parsed } = await roundtrip(createQaReport({ projectName: 'Empty', testCases: inputs, generatedAt: at }));
      const summary = loaded.getWorksheet('Summary')!;
      expect(parsed.Sheets.Summary.B19.v).toBe(inputs.length);
      expect(summary.getCell('B20').value).toMatchObject({ result: '—' });
      expect(loaded.getWorksheet('Test Cases')!.rowCount).toBe(inputs.length + 1);
    }
  });

  it('escapes literal wildcard and quote characters in module formulas and keeps long steps', () => {
    const workbook = createQaReport({ projectName: 'Long project '.repeat(20), testCases: [tc({ module: { name: 'QA * ? ~ " A' }, steps: 'Step\n'.repeat(70) })] });
    expect(workbook.getWorksheet('Summary')!.getCell('A24').value).toBe('QA * ? ~ " A');
    expect(workbook.getWorksheet('Summary')!.getCell('B24').formula).toContain("$T$2:$T$2,1");
    expect(workbook.getWorksheet('Test Cases')!.getCell('I2').value).toBe('Step\n'.repeat(70));
    expect(workbook.getWorksheet('Test Cases')!.getRow(2).height).toBe(409);
  });

  it('keeps case-distinct module names separate in formulas and cached results', () => {
    const workbook = createQaReport({ projectName: 'Modules', testCases: [tc({ module: { name: 'API' } }), tc({ module: { name: 'api' }, status: 'DONE', progress: 100 })] });
    const sheet = workbook.getWorksheet('Summary')!;
    expect(sheet.getCell('A24').value).toBe('API');
    expect(sheet.getCell('A25').value).toBe('api');
    expect(sheet.getCell('B24').value).toMatchObject({ result: 1, formula: expect.stringContaining(',1)') });
    expect(sheet.getCell('B25').value).toMatchObject({ result: 1, formula: expect.stringContaining(',2)') });
    expect(workbook.getWorksheet('Test Cases')!.getCell('T2').value).toBe(1);
    expect(workbook.getWorksheet('Test Cases')!.getCell('T3').value).toBe(2);
    expect(sheet.getCell('H24').value).toMatchObject({ result: .5 });
    expect(sheet.getCell('H25').value).toMatchObject({ result: 1 });
  });

  it('preserves legacy headers and the existing import mapping rather than importing Summary rows', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Auth');
    writeHeaderRow(sheet, 1); writeTestCaseRows(sheet, [tc()], 2);
    const { parsed } = await roundtrip(workbook);
    expect(isQaReportWorkbook(parsed)).toBe(false);
    expect(getDetectedHeaders(parsed.Sheets.Auth)).toEqual(HEADERS);
    const rows = parseSheetWithAutoHeader(parsed.Sheets.Auth);
    expect(rows).toHaveLength(1);
    const mapped = mapImportRow(rows[0], 'Auth', 'new-project', 'new-module', getDefaultImportMapping(HEADERS));
    expect(mapped).toMatchObject({ testCaseId: 'AUTH-001', testAction: '[Auth] Reject login', status: 'FAILED', steps: tc().steps });
    // Legacy historically omits Type/Priority; the new report includes both but is intentionally not an import file.
  });

  it('keeps existing URLs legacy and explicitly scopes report requests including selection', () => {
    expect(excelExportParams('p').toString()).toBe('projectId=p&format=xlsx');
    expect(excelExportParams('p', 'csv').get('format')).toBe('csv');
    const params = excelExportParams('p', 'qa-report', ['uuid-a', 'uuid-b']);
    expect(Object.fromEntries(params)).toEqual({ projectId: 'p', format: 'xlsx', template: 'qa-report', ids: 'uuid-a,uuid-b' });
  });

  it('creates unique legal sheet names even after truncation and for reserved names', () => {
    const used = new Set<string>();
    const names = ['a'.repeat(40), 'a'.repeat(40), 'QA / Auth:*?[]', 'History', 'Ungrouped', 'ungrouped', "'", ''].map(name => uniqueExcelSheetName(name, used));
    expect(new Set(names.map(n => n.toLowerCase())).size).toBe(names.length);
    for (const name of names) { expect(name.length).toBeLessThanOrEqual(31); expect(name).not.toMatch(/[\\/*?:\[\]]/); expect(name).not.toBe('History'); }
    const workbook = new ExcelJS.Workbook(); names.forEach(name => workbook.addWorksheet(name));
    expect(workbook.worksheets.length).toBe(names.length);
  });
});
