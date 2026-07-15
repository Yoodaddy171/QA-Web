import { describe, expect, it } from 'vitest';
import { TESTCASE_STATUS } from '@/lib/domain/testcase';
import { formatExportRow, splitExportCases, type ExportTestCase } from '@/lib/services/excel-export-service';

function testCase(overrides: Partial<ExportTestCase>): ExportTestCase {
  return {
    id: 'id-1',
    testCaseId: 'TC-001',
    page: 'Login',
    subMenu: null,
    weight: null,
    testType: 'Positive',
    testAction: 'Open page',
    steps: 'Click button',
    stepLogs: null,
    expectedResult: 'Works',
    actualResult: null,
    status: TESTCASE_STATUS.NOT_DONE,
    progress: 0,
    remarks: null,
    tags: null,
    priority: 'Medium',
    projectId: 'project-1',
    moduleId: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    bugFixItems: [],
    ...overrides,
  } as ExportTestCase;
}

describe('excel export formatting', () => {
  it('splits feature/test and prerequisite/steps for exported rows', () => {
    const row = formatExportRow(testCase({
      testAction: '[Checkout] creates payment',
      steps: 'Prerequisite: Cart has item\n\nSteps:\nClick Pay',
      subMenu: 'Payment',
      weight: '50%',
      actualResult: 'As Expected',
      status: TESTCASE_STATUS.DONE,
      progress: 100,
      remarks: 'ok',
    }));

    expect(row).toEqual({
      ID: 'TC-001',
      Page: 'Login',
      'Sub Menu': 'Payment',
      Feature: 'Checkout',
      Bobot: '50%',
      Test: 'creates payment',
      Action: 'Cart has item',
      Step: 'Click Pay',
      'Expected Result': 'Works',
      'Actual Result': 'As Expected',
      Status: TESTCASE_STATUS.DONE,
      Progress: 100,
      'Remarks of Test': 'ok',
      Tags: '',
    });
  });

  it('splits non-negative and negative cases for whitebox/blackbox sections', () => {
    const positive = testCase({ id: 'positive', testCaseId: 'TC-001', testType: 'Positive' });
    const negative = testCase({ id: 'negative', testCaseId: 'TC-002', testType: 'Negative' });
    const { whiteboxCases, blackboxCases } = splitExportCases([positive, negative]);

    expect(whiteboxCases.map(item => item.testCaseId)).toEqual(['TC-001']);
    expect(blackboxCases.map(item => item.testCaseId)).toEqual(['TC-002']);
  });
});
