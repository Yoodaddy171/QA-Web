import { describe, expect, it } from 'vitest';
import { TESTCASE_ACTUAL_RESULT, TESTCASE_STATUS } from '@/lib/domain/testcase';
import {
  mapImportRow,
  getDefaultImportMapping,
  normalizeActualResult,
  normalizeImportStatus,
  VALID_IMPORT_STATUSES,
} from '@/lib/services/excel-normalization';

const MOJIBAKE_CHECK = String.fromCodePoint(0xe2, 0x153, 0x201c);
const MOJIBAKE_CROSS = String.fromCodePoint(0xe2, 0x153, 0x2014);

describe('excel normalization', () => {
  it('normalizes known status aliases', () => {
    expect(normalizeImportStatus('done', '')).toBe(TESTCASE_STATUS.DONE);
    expect(normalizeImportStatus('pass', '')).toBe(TESTCASE_STATUS.DONE);
    expect(normalizeImportStatus('in-progress', '')).toBe(TESTCASE_STATUS.IN_PROGRESS);
    expect(normalizeImportStatus('wip', '')).toBe(TESTCASE_STATUS.IN_PROGRESS);
    expect(normalizeImportStatus('blocked', '')).toBe(TESTCASE_STATUS.BLOCKED);
    expect(normalizeImportStatus('fail', '')).toBe(TESTCASE_STATUS.FAILED);
    expect(normalizeImportStatus('ready to retest', '')).toBe(TESTCASE_STATUS.READY_TO_RETEST);
    expect(normalizeImportStatus('to be determined', '')).toBe(TESTCASE_STATUS.TBA);
    expect(normalizeImportStatus('todo', '')).toBe(TESTCASE_STATUS.NOT_DONE);
  });

  it('keeps unknown statuses as uppercase so preview can flag them invalid', () => {
    const status = normalizeImportStatus('needs qa', '');

    expect(status).toBe('NEEDS QA');
    expect(VALID_IMPORT_STATUSES.has(status)).toBe(false);
  });

  it('derives status from actual result only when status is not done', () => {
    expect(normalizeImportStatus('', 'not as expected')).toBe(TESTCASE_STATUS.FAILED);
    expect(normalizeImportStatus('', 'as expected')).toBe(TESTCASE_STATUS.DONE);
    expect(normalizeImportStatus('blocked', 'as expected')).toBe(TESTCASE_STATUS.BLOCKED);
  });

  it('normalizes actual result values', () => {
    expect(normalizeActualResult('pass')).toBe(TESTCASE_ACTUAL_RESULT.AS_EXPECTED);
    expect(normalizeActualResult('failed')).toBe(TESTCASE_ACTUAL_RESULT.NOT_AS_EXPECTED);
    expect(normalizeActualResult('Needs manual review')).toBe('Needs manual review');
    expect(normalizeActualResult('')).toBeNull();
  });

  it('preserves current mojibake checkmark and cross behavior', () => {
    expect(normalizeImportStatus(MOJIBAKE_CHECK, '')).toBe(TESTCASE_STATUS.DONE);
    expect(normalizeImportStatus(MOJIBAKE_CROSS, '')).toBe(TESTCASE_STATUS.FAILED);
    expect(normalizeActualResult(MOJIBAKE_CHECK)).toBe(TESTCASE_ACTUAL_RESULT.AS_EXPECTED);
    expect(normalizeActualResult(MOJIBAKE_CROSS)).toBe(TESTCASE_ACTUAL_RESULT.NOT_AS_EXPECTED);
  });

  it('maps import rows with page fallback, feature/action composition, and progress', () => {
    const mapped = mapImportRow({
      ID: 'TC-001',
      Feature: 'Login',
      Test: 'valid credential',
      Action: 'User exists',
      Steps: 'Submit form',
      'Expected Result': 'Dashboard appears',
      'Actual Result': 'as expected',
      Status: '',
      Priority: 'high',
      'Test Type': 'negative',
      Bobot: '25%',
      Remarks: 'Imported',
    }, 'Auth Sheet', 'project-1', 'module-1');

    expect(mapped).toMatchObject({
      testCaseId: 'TC-001',
      page: 'Auth Sheet',
      testAction: '[Login] valid credential',
      steps: 'Prerequisite: User exists\n\nSteps:\nSubmit form',
      expectedResult: 'Dashboard appears',
      actualResult: TESTCASE_ACTUAL_RESULT.AS_EXPECTED,
      status: TESTCASE_STATUS.DONE,
      progress: 100,
      priority: 'High',
      testType: 'Negative',
      weight: '25%',
      remarks: 'Imported',
      projectId: 'project-1',
      moduleId: 'module-1',
    });
  });

  it('supports explicit column mappings from a non-standard worksheet', () => {
    const mapping = getDefaultImportMapping(['Case', 'Screen', 'Capability', 'Scenario', 'Expected', 'Outcome']);
    const mapped = mapImportRow({
      Case: 'TC-009',
      Screen: 'Checkout',
      Capability: 'Payment',
      Scenario: 'valid card',
      Expected: 'Order is created',
      Outcome: 'pass',
    }, 'Custom Sheet', 'project-1', 'module-1', {
      ...mapping,
      ID: 'Case',
      Page: 'Screen',
      Feature: 'Capability',
      Test: 'Scenario',
      'Expected Result': 'Expected',
      Status: 'Outcome',
    });

    expect(mapped).toMatchObject({
      testCaseId: 'TC-009',
      page: 'Checkout',
      testAction: '[Payment] valid card',
      expectedResult: 'Order is created',
      status: TESTCASE_STATUS.DONE,
    });
  });
});
