import { getProgressFromStatus } from '@/lib/domain/progress';
import { TESTCASE_ACTUAL_RESULT, TESTCASE_STATUS } from '@/lib/domain/testcase';
import * as XLSX from 'xlsx';

export const HEADER_KEYWORDS = ['ID', 'Page', 'Sub Menu', 'Feature', 'Test', 'Action', 'Step', 'Expected Result', 'Actual Result', 'Status', 'Remarks'];
export const REQUIRED_IMPORT_FIELDS = ['ID', 'Page', 'Feature', 'Test', 'Expected Result', 'Status'];
export const VALID_IMPORT_STATUSES = new Set<string>([
  TESTCASE_STATUS.NOT_DONE,
  TESTCASE_STATUS.IN_PROGRESS,
  TESTCASE_STATUS.DONE,
  TESTCASE_STATUS.FAILED,
  TESTCASE_STATUS.READY_TO_RETEST,
  TESTCASE_STATUS.BLOCKED,
  TESTCASE_STATUS.TBA,
]);
export const PREVIEW_HEADERS = ['ID', 'Page', 'Sub Menu', 'Feature', 'Test', 'Expected Result', 'Actual Result', 'Status'];
export type ImportColumnMapping = Record<string, string>;

const IMPORT_FIELD_ALIASES: Record<string, string[]> = {
  ID: ['ID', 'Test Case ID', 'testCaseId'],
  Page: ['Page', 'page'],
  'Sub Menu': ['Sub Menu', 'subMenu', 'Submenu'],
  Feature: ['Feature', 'feature'],
  Test: ['Test', 'Test Action', 'testAction'],
  Action: ['Action', 'Prerequisite', 'action'],
  Steps: ['Steps', 'Step', 'steps'],
  'Expected Result': ['Expected Result', 'expectedResult'],
  'Actual Result': ['Actual Result', 'actualResult'],
  Status: ['Status', 'status'],
  Priority: ['Priority', 'priority'],
  Weight: ['Weight', 'Bobot', 'weight'],
  'Test Type': ['Test Type', 'Type', 'testType'],
  Remarks: ['Remarks of Test', 'Remarks', 'remarks', 'Catatan'],
  Tags: ['Tags', 'Tag', 'tags', 'tag'],
};

export function getDefaultImportMapping(headers: string[]): ImportColumnMapping {
  return Object.fromEntries(Object.entries(IMPORT_FIELD_ALIASES).map(([field, aliases]) => {
    const header = headers.find((candidate) => aliases.some((alias) => candidate.toLowerCase() === alias.toLowerCase()));
    return [field, header || ''];
  }));
}

export function applyImportMapping(row: Record<string, unknown>, mapping?: ImportColumnMapping) {
  if (!mapping) return row;
  return Object.fromEntries(Object.entries(mapping).map(([field, source]) => [field, source ? row[source] : '']));
}

export function detectHeaderRowIndex(sheet: XLSX.WorkSheet): number {
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
  for (let r = range.s.r; r <= Math.min(range.s.r + 10, range.e.r); r++) {
    let matchCount = 0;
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      if (cell && cell.v !== undefined) {
        const val = String(cell.v).trim();
        if (HEADER_KEYWORDS.some(kw => val.toLowerCase().includes(kw.toLowerCase()))) {
          matchCount++;
        }
      }
    }
    if (matchCount >= 3) return r;
  }
  return 0;
}

export function parseSheetWithAutoHeader(sheet: XLSX.WorkSheet): Record<string, unknown>[] {
  const headerRow = detectHeaderRowIndex(sheet);
  const rawData: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  if (rawData.length <= headerRow) return [];

  const headers = rawData[headerRow].map((h: unknown) => String(h || '').trim());
  const rows: Record<string, unknown>[] = [];

  for (let i = headerRow + 1; i < rawData.length; i++) {
    const rowObj: Record<string, unknown> = {};
    let hasData = false;
    for (let j = 0; j < headers.length; j++) {
      const val = rawData[i]?.[j];
      rowObj[headers[j]] = val !== undefined ? val : '';
      if (val !== undefined && val !== '' && val !== null) hasData = true;
    }
    if (hasData) rows.push(rowObj);
  }

  return rows;
}

export function getColValue(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
      return String(row[key]);
    }
  }
  return '';
}

export function getDetectedHeaders(sheet: XLSX.WorkSheet): string[] {
  const headerRow = detectHeaderRowIndex(sheet);
  const rawData: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  return (rawData[headerRow] || []).map((h: unknown) => String(h || '').trim()).filter(Boolean);
}

export function normalizeImportStatus(statusRaw: string, actualResultRaw: string): string {
  let status: string = TESTCASE_STATUS.NOT_DONE;
  if (statusRaw) {
    const lower = statusRaw.toLowerCase().trim();
    if (lower === 'done' || lower === 'pass' || lower === 'passed' || lower === 'âœ“') {
      status = TESTCASE_STATUS.DONE;
    } else if (lower === 'in progress' || lower === 'in-progress' || lower === 'wip') {
      status = TESTCASE_STATUS.IN_PROGRESS;
    } else if (lower === 'blocked') {
      status = TESTCASE_STATUS.BLOCKED;
    } else if (lower === 'failed' || lower === 'fail' || lower === 'âœ—') {
      status = TESTCASE_STATUS.FAILED;
    } else if (lower === 'ready to retest') {
      status = TESTCASE_STATUS.READY_TO_RETEST;
    } else if (lower === 'tba' || lower === 'to be announced' || lower === 'tbd' || lower === 'to be determined') {
      status = TESTCASE_STATUS.TBA;
    } else if (lower === 'not done' || lower === 'not done yet' || lower === 'todo') {
      status = TESTCASE_STATUS.NOT_DONE;
    } else {
      status = statusRaw.toUpperCase().trim();
    }
  }

  const actualLower = actualResultRaw.toLowerCase().trim();
  if ((actualLower === 'not as expected' || actualLower === 'fail' || actualLower === 'failed' || actualLower === 'âœ—') && status === TESTCASE_STATUS.NOT_DONE) {
    return TESTCASE_STATUS.FAILED;
  }
  if ((actualLower === 'as expected' || actualLower === 'pass' || actualLower === 'passed' || actualLower === 'âœ“') && status === TESTCASE_STATUS.NOT_DONE) {
    return TESTCASE_STATUS.DONE;
  }
  return status;
}

export function normalizeActualResult(actualResultRaw: string): string | null {
  if (!actualResultRaw) return null;

  const lower = actualResultRaw.toLowerCase().trim();
  if (lower === 'as expected' || lower === 'pass' || lower === 'passed' || lower === 'âœ“') {
    return TESTCASE_ACTUAL_RESULT.AS_EXPECTED;
  }
  if (lower === 'not as expected' || lower === 'fail' || lower === 'failed' || lower === 'âœ—') {
    return TESTCASE_ACTUAL_RESULT.NOT_AS_EXPECTED;
  }
  return actualResultRaw;
}

export function buildPreviewRow(row: Record<string, unknown>) {
  return Object.fromEntries(PREVIEW_HEADERS.map((header) => {
    const value = header === 'ID'
      ? getColValue(row, 'ID', 'Test Case ID', 'testCaseId')
      : header === 'Sub Menu'
        ? getColValue(row, 'Sub Menu', 'subMenu', 'Submenu')
        : header === 'Test'
          ? getColValue(row, 'Test', 'Test Action', 'testAction')
          : getColValue(row, header, header.replace(/\s+/g, '').replace(/^./, (c) => c.toLowerCase()));
    return [header, value];
  }));
}

export function mapImportRow(row: Record<string, unknown>, sheetName: string, projectId: string, moduleId: string | null, mapping?: ImportColumnMapping) {
  const mapped = applyImportMapping(row, mapping);
  const testCaseId = getColValue(mapped, 'ID', 'Test Case ID', 'testCaseId');
  const page = getColValue(mapped, 'Page', 'page');
  const subMenu = getColValue(mapped, 'Sub Menu', 'subMenu', 'Submenu') || null;
  const feature = getColValue(mapped, 'Feature', 'feature');
  const testDescription = getColValue(mapped, 'Test', 'Test Action', 'testAction');
  const action = getColValue(mapped, 'Action', 'Prerequisite', 'action', 'testAction');
  const steps = getColValue(mapped, 'Steps', 'Step', 'steps');
  const testAction = buildTestAction(feature, testDescription, action);
  const finalSteps = buildFinalSteps(action, steps, testDescription, feature);
  const expectedResult = getColValue(mapped, 'Expected Result', 'expectedResult');
  const actualResult = normalizeActualResult(getColValue(mapped, 'Actual Result', 'actualResult'));
  const status = normalizeImportStatus(getColValue(mapped, 'Status', 'status'), getColValue(mapped, 'Actual Result', 'actualResult'));
  const priority = normalizePriority(getColValue(mapped, 'Priority', 'priority'));
  const testType = normalizeTestType(getColValue(mapped, 'Test Type', 'Type', 'testType'));

  return {
    testCaseId,
    page: page || sheetName,
    subMenu,
    weight: getColValue(mapped, 'Weight', 'Bobot', 'weight') || null,
    testType,
    testAction,
    steps: finalSteps,
    expectedResult,
    actualResult,
    status,
    progress: getProgressFromStatus(status),
    remarks: getColValue(mapped, 'Remarks of Test', 'Remarks', 'remarks', 'Catatan') || null,
    tags: normalizeTags(getColValue(mapped, 'Tags', 'Tag', 'tags', 'tag')),
    priority,
    projectId,
    moduleId: moduleId || null,
  };
}

function buildTestAction(feature: string, testDescription: string, action: string) {
  if (feature && testDescription) return `[${feature}] ${testDescription}`;
  if (testDescription) return testDescription;
  if (feature) return feature;
  if (action) return action;
  return '';
}

function buildFinalSteps(action: string, steps: string, testDescription: string, feature: string) {
  if (action && steps) return `Prerequisite: ${action}\n\nSteps:\n${steps}`;
  if (steps) return steps;
  if (action) return action;
  if (testDescription) return testDescription;
  if (feature) return feature;
  return '';
}

function normalizePriority(priorityRaw: string) {
  let priority = 'Medium';
  if (priorityRaw) {
    const p = priorityRaw.toLowerCase().trim();
    if (['critical', 'high', 'medium', 'low'].includes(p)) {
      priority = p.charAt(0).toUpperCase() + p.slice(1);
    }
  }
  return priority;
}

function normalizeTestType(testTypeRaw: string) {
  let testType = 'Positive';
  if (testTypeRaw) {
    const t = testTypeRaw.toLowerCase().trim();
    if (t === 'negative') testType = 'Negative';
  }
  return testType;
}

function normalizeTags(value: string) {
  return [...new Set(value.split(',').map(item => item.trim().toLowerCase()).filter(Boolean))].join(', ') || null;
}
