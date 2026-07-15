import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as XLSX from 'xlsx';
import { TESTCASE_ACTUAL_RESULT, TESTCASE_STATUS } from '@/lib/domain/testcase';

const dbMock = vi.hoisted(() => ({
  testCase: {
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  bugFix: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  module: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  activityHistory: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({ db: dbMock }));

function workbookFromRows(rows: unknown[][]) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), 'Import Sheet');
  return workbook;
}

describe('excel import service', async () => {
  const { buildImportPreview, importWorkbook } = await import('@/lib/services/excel-import-service');

  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.testCase.findMany.mockResolvedValue([]);
    dbMock.testCase.create.mockResolvedValue({ id: 'created-testcase-id' });
    dbMock.testCase.update.mockResolvedValue({});
    dbMock.bugFix.findFirst.mockResolvedValue(null);
    dbMock.bugFix.create.mockResolvedValue({});
    dbMock.module.findFirst.mockResolvedValue(null);
    dbMock.module.create.mockResolvedValue({ id: 'module-1' });
    dbMock.activityHistory.create.mockResolvedValue({ id: 'activity-1' });
    dbMock.activityHistory.findMany.mockResolvedValue([]);
  });

  it('returns the preview response shape and flags unknown uppercase statuses invalid', async () => {
    const workbook = workbookFromRows([
      ['ID', 'Page', 'Feature', 'Test', 'Expected Result', 'Status'],
      ['TC-001', 'Login', 'Auth', 'Valid login', 'Dashboard appears', 'needs qa'],
    ]);

    const preview = await buildImportPreview(workbook, 'project-1', true);

    expect(preview).toMatchObject({
      mode: 'preview',
      canImport: false,
      totalSheets: 1,
      totalRows: 1,
      importableRows: 1,
      warningCount: 0,
      errorCount: 1,
    });
    expect(preview.sheets[0]).toMatchObject({
      sheet: 'Import Sheet',
      moduleName: 'Import Sheet',
      headerRow: 1,
      totalRows: 1,
      importableRows: 1,
      skippedEstimate: 0,
      invalidStatusRows: [1],
    });
  });

  it('imports failed rows and creates bugfix data with the current response shape', async () => {
    const workbook = workbookFromRows([
      ['ID', 'Page', 'Feature', 'Test', 'Action', 'Steps', 'Expected Result', 'Actual Result', 'Status', 'Priority'],
      ['TC-002', '', 'Checkout', 'payment fails', 'Cart has item', 'Click Pay', 'Payment rejected', 'not as expected', '', 'High'],
    ]);

    const result = await importWorkbook(workbook, 'project-1', true);

    expect(result).toEqual({
      batchId: expect.any(String),
      imported: 1,
      sheets: [{ sheet: 'Import Sheet', imported: 1, skipped: 0, moduleId: 'module-1' }],
      totalSheets: 1,
    });
    expect(dbMock.testCase.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        testCaseId: 'TC-002',
        page: 'Import Sheet',
        testAction: '[Checkout] payment fails',
        steps: 'Prerequisite: Cart has item\n\nSteps:\nClick Pay',
        expectedResult: 'Payment rejected',
        actualResult: TESTCASE_ACTUAL_RESULT.NOT_AS_EXPECTED,
        status: TESTCASE_STATUS.FAILED,
        progress: 0,
        priority: 'High',
        projectId: 'project-1',
        moduleId: 'module-1',
      }),
    });
    expect(dbMock.bugFix.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sourceTestCaseId: 'created-testcase-id',
        testCaseId: 'TC-002',
        projectId: 'project-1',
        page: 'Import Sheet',
        actualResult: TESTCASE_ACTUAL_RESULT.NOT_AS_EXPECTED,
        priority: 'High',
        moduleId: 'module-1',
        status: 'SUDAH DILAPORKAN',
      }),
    });
  });
});
