import type { db } from '@/lib/db';
import { TEST_TYPES } from '@/lib/domain/testcase';
import ExcelJS from 'exceljs';

export type ExportTestCase = Awaited<ReturnType<typeof db.testCase.findMany>>[number] & {
  module?: { name: string } | null;
  calculatedWeight?: number | null;
};

export const HEADERS = ['ID', 'Page', 'Sub Menu', 'Feature', 'Bobot', 'Test', 'Action', 'Step', 'Expected Result', 'Actual Result', 'Status', 'Progress', 'Remarks of Test', 'Tags'];
export const COL_WIDTHS = [5.5, 5.75, 17.5, 42.63, 13, 54.13, 57, 62, 87.63, 38.13, 13, 13, 13, 24];

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFD9EAD3' },
};

const HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  size: 12,
};

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin' },
  bottom: { style: 'thin' },
  left: { style: 'thin' },
  right: { style: 'thin' },
};

export function setStandardColumnWidths(ws: ExcelJS.Worksheet) {
  for (let i = 0; i < HEADERS.length; i++) {
    ws.getColumn(i + 1).width = COL_WIDTHS[i];
  }
}

export function writeHeaderRow(ws: ExcelJS.Worksheet, rowNumber: number) {
  const headerRow = ws.getRow(rowNumber);
  HEADERS.forEach((h, idx) => {
    headerRow.getCell(idx + 1).value = h;
  });
  styleHeaderRow(headerRow);
  return headerRow;
}

export function styleHeaderRow(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.font = HEADER_FONT;
    cell.fill = HEADER_FILL;
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = THIN_BORDER;
  });
  row.height = 25;
}

export function styleDataRow(row: ExcelJS.Row) {
  row.eachCell((cell, colNumber) => {
    const shouldWrap = [7, 8, 10].includes(colNumber);
    cell.alignment = {
      vertical: 'top',
      wrapText: shouldWrap,
    };
    if ([5, 11, 12, 13].includes(colNumber)) {
      cell.font = { size: 10 };
    }
  });
}

export function writeTestCaseRows(ws: ExcelJS.Worksheet, testCases: ExportTestCase[], startRow: number): number {
  let currentRow = startRow;

  for (const tc of testCases) {
    const row = ws.getRow(currentRow);
    const formatted = formatExportRow(tc);

    row.getCell(1).value = formatted.ID;
    row.getCell(2).value = formatted.Page;
    row.getCell(3).value = formatted['Sub Menu'];
    row.getCell(4).value = formatted.Feature;
    row.getCell(5).value = formatted.Bobot;
    row.getCell(6).value = formatted.Test;
    row.getCell(7).value = formatted.Action;
    row.getCell(8).value = formatted.Step;
    row.getCell(9).value = formatted['Expected Result'];
    row.getCell(10).value = formatted['Actual Result'];
    row.getCell(11).value = formatted.Status;
    row.getCell(12).value = formatted.Progress;
    row.getCell(13).value = formatted['Remarks of Test'];
    row.getCell(14).value = formatted.Tags;

    styleDataRow(row);
    currentRow++;
  }

  return currentRow;
}

export function formatExportRow(tc: ExportTestCase) {
  const { feature, testDesc } = splitFeatureAndTest(tc.testAction || '');
  const { action, steps } = splitActionAndSteps(tc.steps || '');

  return {
    ID: tc.testCaseId,
    Page: tc.page,
    'Sub Menu': tc.subMenu || '',
    Feature: feature,
    Bobot: tc.calculatedWeight == null ? '' : `${tc.calculatedWeight.toFixed(2)}%`,
    Test: testDesc,
    Action: action,
    Step: steps,
    'Expected Result': tc.expectedResult || '',
    'Actual Result': tc.actualResult || '',
    Status: tc.status,
    Progress: tc.progress,
    'Remarks of Test': tc.remarks || '',
    Tags: tc.tags || '',
  };
}

export function splitExportCases(testCases: ExportTestCase[]) {
  return {
    whiteboxCases: testCases.filter(tc => tc.testType !== TEST_TYPES[1]),
    blackboxCases: testCases.filter(tc => tc.testType === TEST_TYPES[1]),
  };
}

function splitFeatureAndTest(testAction: string) {
  let feature = '';
  let testDesc = testAction;
  const featureMatch = testAction.match(/^\[(.+?)\]\s*(.*)/);
  if (featureMatch) {
    feature = featureMatch[1];
    testDesc = featureMatch[2] || testAction;
  }
  return { feature, testDesc };
}

function splitActionAndSteps(rawSteps: string) {
  let action = '';
  let steps = rawSteps;
  const actionMatch = rawSteps.match(/^Prerequisite:\s*([\s\S]+?)(?:\n\nSteps:\n|\nSteps:\n)([\s\S]*)/);
  if (actionMatch) {
    action = actionMatch[1];
    steps = actionMatch[2] || rawSteps;
  }
  return { action, steps };
}
