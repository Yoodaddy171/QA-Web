import { db } from '@/lib/db';
import { BUGFIX_STATUS } from '@/lib/domain/bugfix';
import { TESTCASE_ACTUAL_RESULT, TESTCASE_STATUS } from '@/lib/domain/testcase';
import {
  buildPreviewRow,
  detectHeaderRowIndex,
  getColValue,
  getDetectedHeaders,
  getDefaultImportMapping,
  applyImportMapping,
  type ImportColumnMapping,
  mapImportRow,
  normalizeImportStatus,
  parseSheetWithAutoHeader,
  REQUIRED_IMPORT_FIELDS,
  VALID_IMPORT_STATUSES,
} from '@/lib/services/excel-normalization';
import * as XLSX from 'xlsx';
import { randomUUID } from 'node:crypto';
import { recordActivity } from '@/lib/services/activity-history-service';

export async function buildImportPreview(workbook: XLSX.WorkBook, projectId: string, createModules: boolean, mappings?: Record<string, ImportColumnMapping>) {
  const idCounts = new Map<string, number>();
  const parsedSheets = workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const headerRow = sheet && sheet['!ref'] ? detectHeaderRowIndex(sheet) + 1 : null;
    const headers = sheet && sheet['!ref'] ? getDetectedHeaders(sheet) : [];
    const rows = sheet && sheet['!ref'] ? parseSheetWithAutoHeader(sheet) : [];
    const mapping = mappings?.[sheetName] || getDefaultImportMapping(headers);
    rows.forEach((row) => {
      const id = getColValue(applyImportMapping(row, mapping), 'ID');
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
    const mapping = mappings?.[sheetName] || getDefaultImportMapping(headers);
    const missingHeaders = REQUIRED_IMPORT_FIELDS.filter((field) => !mapping[field]);

    const missingRequiredCounts = Object.fromEntries(REQUIRED_IMPORT_FIELDS.map((field) => [field, 0]));
    const invalidStatusRows: number[] = [];
    const duplicateIdsInFile: string[] = [];
    const existingIds: string[] = [];

    rows.forEach((row, index) => {
      const mapped = applyImportMapping(row, mapping);
      const id = getColValue(mapped, 'ID');
      const page = getColValue(mapped, 'Page');
      const feature = getColValue(mapped, 'Feature');
      const test = getColValue(mapped, 'Test');
      const expectedResult = getColValue(mapped, 'Expected Result');
      const statusRaw = getColValue(mapped, 'Status');
      const actualResultRaw = getColValue(mapped, 'Actual Result');
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
      const id = getColValue(applyImportMapping(row, mapping), 'ID');
      return Boolean(id) && (idCounts.get(id) || 0) === 1 && !existingIdSet.has(id);
    }).length;

    const importableSheetRows = rows.filter((row) => {
      const id = getColValue(applyImportMapping(row, mapping), 'ID');
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
      mapping,
      previewRows: rows.slice(0, 5).map((row) => buildPreviewRow(applyImportMapping(row, mapping))),
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

export async function importWorkbook(workbook: XLSX.WorkBook, projectId: string, createModules: boolean, batchId = randomUUID(), mappings?: Record<string, ImportColumnMapping>) {
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
      const mappedRow = mapImportRow(row, sheetName, projectId, moduleId, mappings?.[sheetName]);
      if (!mappedRow.testCaseId) {
        skipped++;
        continue;
      }

      try {
        const tc = await db.testCase.create({ data: mappedRow });
        await recordActivity({ projectId, entityType: 'TestCase', entityId: tc.id, action: 'IMPORTED', afterValue: { batchId, testCaseId: tc.id } });

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


  return {
    imported: totalImported,
    batchId,
    sheets: sheetResults,
    totalSheets: workbook.SheetNames.length,
  };
}

export async function undoImportBatch(projectId: string, batchId: string) {
  const activities = await db.activityHistory.findMany({ where: { projectId, entityType: 'TestCase', action: 'IMPORTED' }, select: { entityId: true, afterValue: true } });
  const importedIds = activities.filter(item => Boolean(item.afterValue && typeof item.afterValue === 'object' && 'batchId' in item.afterValue && item.afterValue.batchId === batchId)).map(item => item.entityId);
  if (!importedIds.length) return { deleted: 0, skipped: 0 };
  const cases = await db.testCase.findMany({ where: { projectId, id: { in: importedIds } }, select: { id: true, _count: { select: { testRunCases: true, testExecutions: true, requirementLinks: true, bugFixItems: true } } } });
  const safeIds = cases.filter(item => Object.values(item._count).every(count => count === 0)).map(item => item.id);
  const skipped = cases.length - safeIds.length;
  if (safeIds.length) await db.testCase.deleteMany({ where: { projectId, id: { in: safeIds } } });
  return { deleted: safeIds.length, skipped };
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
