import { db } from '@/lib/db';
import { BUGFIX_STATUS } from '@/lib/domain/bugfix';
import { TESTCASE_ACTUAL_RESULT, TESTCASE_STATUS } from '@/lib/domain/testcase';
import {
  buildPreviewRow,
  detectHeaderRowIndex,
  getColValue,
  getDetectedHeaders,
  mapImportRow,
  normalizeImportStatus,
  parseSheetWithAutoHeader,
  REQUIRED_IMPORT_FIELDS,
  VALID_IMPORT_STATUSES,
} from '@/lib/services/excel-normalization';
import * as XLSX from 'xlsx';

export async function buildImportPreview(workbook: XLSX.WorkBook, projectId: string, createModules: boolean) {
  const idCounts = new Map<string, number>();
  const parsedSheets = workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const headerRow = sheet && sheet['!ref'] ? detectHeaderRowIndex(sheet) + 1 : null;
    const headers = sheet && sheet['!ref'] ? getDetectedHeaders(sheet) : [];
    const rows = sheet && sheet['!ref'] ? parseSheetWithAutoHeader(sheet) : [];
    rows.forEach((row) => {
      const id = getColValue(row, 'ID', 'Test Case ID', 'testCaseId');
      if (id) idCounts.set(id, (idCounts.get(id) || 0) + 1);
    });
    return { sheetName, headerRow, headers, rows };
  });

  const allIds = [...idCounts.keys()];
  const existingCases = allIds.length > 0
    ? await db.testCase.findMany({
      where: { projectId, testCaseId: { in: allIds } },
      select: { testCaseId: true },
    })
    : [];
  const existingIdSet = new Set(existingCases.map((tc) => tc.testCaseId));

  let totalRows = 0;
  let importableRows = 0;
  let warningCount = 0;
  let errorCount = 0;

  const sheets = parsedSheets.map(({ sheetName, headerRow, headers, rows }) => {
    const missingHeaders = REQUIRED_IMPORT_FIELDS.filter((field) => {
      if (field === 'ID') return !headers.some((h) => ['ID', 'Test Case ID', 'testCaseId'].includes(h));
      if (field === 'Test') return !headers.some((h) => ['Test', 'Test Action', 'testAction'].includes(h));
      return !headers.includes(field);
    });

    const missingRequiredCounts = Object.fromEntries(REQUIRED_IMPORT_FIELDS.map((field) => [field, 0]));
    const invalidStatusRows: number[] = [];
    const duplicateIdsInFile: string[] = [];
    const existingIds: string[] = [];

    rows.forEach((row, index) => {
      const id = getColValue(row, 'ID', 'Test Case ID', 'testCaseId');
      const page = getColValue(row, 'Page', 'page');
      const feature = getColValue(row, 'Feature', 'feature');
      const test = getColValue(row, 'Test', 'Test Action', 'testAction');
      const expectedResult = getColValue(row, 'Expected Result', 'expectedResult');
      const statusRaw = getColValue(row, 'Status', 'status');
      const actualResultRaw = getColValue(row, 'Actual Result', 'actualResult');
      const status = normalizeImportStatus(statusRaw, actualResultRaw);

      if (!id) missingRequiredCounts.ID++;
      if (!page) missingRequiredCounts.Page++;
      if (!feature) missingRequiredCounts.Feature++;
      if (!test && !feature) missingRequiredCounts.Test++;
      if (!expectedResult) missingRequiredCounts['Expected Result']++;
      if (!statusRaw) missingRequiredCounts.Status++;
      if (statusRaw && !VALID_IMPORT_STATUSES.has(status)) invalidStatusRows.push(index + 1);
      if (id && (idCounts.get(id) || 0) > 1 && !duplicateIdsInFile.includes(id)) duplicateIdsInFile.push(id);
      if (id && existingIdSet.has(id) && !existingIds.includes(id)) existingIds.push(id);
    });

    const sheetErrors = missingHeaders.length
      + missingRequiredCounts.ID
      + invalidStatusRows.length
      + duplicateIdsInFile.length
      + existingIds.length;
    const sheetWarnings = missingRequiredCounts.Page
      + missingRequiredCounts.Feature
      + missingRequiredCounts.Test
      + missingRequiredCounts['Expected Result']
      + missingRequiredCounts.Status;

    totalRows += rows.length;
    errorCount += sheetErrors;
    warningCount += sheetWarnings;
    importableRows += rows.filter((row) => {
      const id = getColValue(row, 'ID', 'Test Case ID', 'testCaseId');
      return Boolean(id) && (idCounts.get(id) || 0) === 1 && !existingIdSet.has(id);
    }).length;

    const importableSheetRows = rows.filter((row) => {
      const id = getColValue(row, 'ID', 'Test Case ID', 'testCaseId');
      return Boolean(id) && (idCounts.get(id) || 0) === 1 && !existingIdSet.has(id);
    }).length;

    return {
      sheet: sheetName,
      moduleName: createModules ? sheetName : null,
      headerRow,
      totalRows: rows.length,
      importableRows: importableSheetRows,
      skippedEstimate: rows.length - importableSheetRows,
      headers,
      missingHeaders,
      missingRequiredCounts,
      duplicateIdsInFile,
      existingIds,
      invalidStatusRows,
      previewRows: rows.slice(0, 5).map(buildPreviewRow),
    };
  });

  return {
    mode: 'preview',
    canImport: errorCount === 0 && totalRows > 0,
    totalSheets: workbook.SheetNames.length,
    totalRows,
    importableRows,
    warningCount,
    errorCount,
    sheets,
  };
}

export async function importWorkbook(workbook: XLSX.WorkBook, projectId: string, createModules: boolean) {
  let totalImported = 0;
  const sheetResults: { sheet: string; imported: number; skipped: number; moduleId?: string }[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet || !sheet['!ref']) {
      sheetResults.push({ sheet: sheetName, imported: 0, skipped: 0 });
      continue;
    }

    const rows = parseSheetWithAutoHeader(sheet);

    if (rows.length === 0) {
      sheetResults.push({ sheet: sheetName, imported: 0, skipped: 0 });
      continue;
    }

    const moduleId = await resolveImportModule(projectId, sheetName, createModules);
    let imported = 0;
    let skipped = 0;

    for (const row of rows) {
      const mappedRow = mapImportRow(row, sheetName, projectId, moduleId);
      if (!mappedRow.testCaseId) {
        skipped++;
        continue;
      }

      try {
        const tc = await db.testCase.create({ data: mappedRow });

        if (mappedRow.status === TESTCASE_STATUS.FAILED) {
          const existingBugFix = await db.bugFix.findFirst({
            where: { sourceTestCaseId: tc.id },
          });
          if (!existingBugFix) {
            await db.bugFix.create({
              data: {
                sourceTestCaseId: tc.id,
                testCaseId: mappedRow.testCaseId,
                projectId,
                page: mappedRow.page,
                subMenu: mappedRow.subMenu,
                testType: mappedRow.testType,
                testAction: mappedRow.testAction,
                steps: mappedRow.steps,
                expectedResult: mappedRow.expectedResult,
                actualResult: TESTCASE_ACTUAL_RESULT.NOT_AS_EXPECTED,
                priority: mappedRow.priority,
                moduleId: mappedRow.moduleId,
                status: BUGFIX_STATUS.REPORTED,
                reportedAt: new Date(),
              },
            });
          }
        }

        imported++;
      } catch (err) {
        console.error(`Failed to import row with ID ${mappedRow.testCaseId}:`, err);
        skipped++;
      }
    }

    totalImported += imported;
    sheetResults.push({ sheet: sheetName, imported, skipped, moduleId: moduleId || undefined });
  }

  await recalculateImportedWeights(projectId);

  return {
    imported: totalImported,
    sheets: sheetResults,
    totalSheets: workbook.SheetNames.length,
  };
}

async function resolveImportModule(projectId: string, sheetName: string, createModules: boolean) {
  if (!createModules) return null;

  const existing = await db.module.findFirst({
    where: { projectId, name: sheetName },
  });
  if (existing) return existing.id;

  const newModule = await db.module.create({
    data: { name: sheetName, projectId },
  });
  return newModule.id;
}

async function recalculateImportedWeights(projectId: string) {
  const allNewCases = await db.testCase.findMany({
    where: { projectId },
    select: { id: true, page: true, subMenu: true },
  });
  const menuGroups = new Map<string, string[]>();
  for (const tc of allNewCases) {
    const key = `${tc.page}|||${tc.subMenu || ''}`;
    if (!menuGroups.has(key)) menuGroups.set(key, []);
    menuGroups.get(key)!.push(tc.id);
  }
  for (const [, ids] of menuGroups) {
    if (ids.length === 0) continue;
    const weightPerCase = `${(100 / ids.length).toFixed(2)}%`;
    await Promise.all(ids.map(id =>
      db.testCase.update({ where: { id }, data: { weight: weightPerCase } })
    ));
  }
}
