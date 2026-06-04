import { describe, expect, it } from 'vitest';
import { BUGFIX_STATUS } from '@/lib/domain/bugfix';
import { TESTCASE_PRIORITIES, TESTCASE_STATUS, TEST_TYPES } from '@/lib/domain/testcase';
import {
  aggregateBugFixCounts,
  aggregateTestCaseStatusCounts,
  buildMenuWeightProgress,
  buildModuleProgress,
  calculateDashboardStats,
  type StatsBugFix,
  type StatsModule,
  type StatsTestCase,
} from '@/lib/services/stats-aggregation';

const moduleA = { id: 'module-a', name: 'Module A' };
const moduleB = { id: 'module-b', name: 'Module B' };
const baseDate = new Date('2026-06-01T00:00:00.000Z');

function testCase(overrides: Partial<StatsTestCase>): StatsTestCase {
  return {
    id: 'tc-id',
    testCaseId: 'TC-001',
    page: 'Login',
    subMenu: null,
    status: TESTCASE_STATUS.NOT_DONE,
    testType: TEST_TYPES[0],
    priority: TESTCASE_PRIORITIES[0],
    updatedAt: baseDate,
    moduleId: null,
    module: null,
    ...overrides,
  };
}

function bugFix(overrides: Partial<StatsBugFix>): StatsBugFix {
  return {
    id: 'bf-id',
    sourceTestCaseId: null,
    testCaseId: 'TC-001',
    page: 'Login',
    subMenu: null,
    testAction: 'Submit login',
    priority: TESTCASE_PRIORITIES[0],
    status: BUGFIX_STATUS.REPORTED,
    reportedAt: baseDate,
    fixingAt: null,
    readyAt: null,
    fixedAt: null,
    updatedAt: baseDate,
    moduleId: null,
    module: null,
    ...overrides,
  };
}

describe('stats aggregation', () => {
  it('aggregates testcase statuses with legacy fallback for unknown statuses', () => {
    const counts = aggregateTestCaseStatusCounts([
      testCase({ id: '1', status: TESTCASE_STATUS.DONE }),
      testCase({ id: '2', status: TESTCASE_STATUS.IN_PROGRESS }),
      testCase({ id: '3', status: TESTCASE_STATUS.BLOCKED }),
      testCase({ id: '4', status: TESTCASE_STATUS.FAILED }),
      testCase({ id: '5', status: TESTCASE_STATUS.READY_TO_RETEST }),
      testCase({ id: '6', status: TESTCASE_STATUS.TBA }),
      testCase({ id: '7', status: 'UNKNOWN' }),
    ]);

    expect(counts).toEqual({
      doneCount: 1,
      notDoneCount: 1,
      inProgressCount: 1,
      blockedCount: 1,
      failedCount: 1,
      readyToRetestCount: 1,
      tbaCount: 1,
    });
  });

  it('calculates menu weights and progress while excluding TBA cases', () => {
    const { activeTestCases, weightMap, menuProgress } = buildMenuWeightProgress([
      testCase({ id: 'done', status: TESTCASE_STATUS.DONE, page: 'Login', subMenu: 'Auth', moduleId: moduleA.id, module: moduleA }),
      testCase({ id: 'ready', status: TESTCASE_STATUS.READY_TO_RETEST, page: 'Login', subMenu: 'Auth', moduleId: moduleA.id, module: moduleA }),
      testCase({ id: 'tba', status: TESTCASE_STATUS.TBA, page: 'Login', subMenu: 'Auth', moduleId: moduleA.id, module: moduleA }),
    ]);

    expect(activeTestCases).toHaveLength(2);
    expect(weightMap).toEqual({ done: 50, ready: 50 });
    expect(menuProgress).toEqual([
      expect.objectContaining({
        menuKey: 'Login|||Auth',
        totalCases: 2,
        weightPerCase: 50,
        contributedWeight: 75,
        progressPercent: 75,
        doneCount: 1,
        readyToRetestCount: 1,
        tbaCount: 0,
        moduleId: moduleA.id,
        moduleName: moduleA.name,
      }),
    ]);
  });

  it('builds module and ungrouped progress with the existing menu response shape', () => {
    const { menuProgress } = buildMenuWeightProgress([
      testCase({ id: 'done', status: TESTCASE_STATUS.DONE, page: 'Login', moduleId: moduleA.id, module: moduleA }),
      testCase({ id: 'blocked', status: TESTCASE_STATUS.BLOCKED, page: 'Checkout', moduleId: null, module: null }),
    ]);

    const { moduleProgress, ungroupedProgress } = buildModuleProgress([moduleA, moduleB], menuProgress);

    expect(moduleProgress).toEqual([
      {
        id: moduleA.id,
        name: moduleA.name,
        totalMenus: 1,
        totalCases: 1,
        totalDone: 1,
        avgProgress: 100,
        menus: [
          expect.objectContaining({
            page: 'Login',
            subMenu: '',
            totalCases: 1,
            progressPercent: 100,
            doneCount: 1,
          }),
        ],
      },
      {
        id: moduleB.id,
        name: moduleB.name,
        totalMenus: 0,
        totalCases: 0,
        totalDone: 0,
        avgProgress: 0,
        menus: [],
      },
    ]);
    expect(ungroupedProgress).toEqual(expect.objectContaining({
      id: null,
      name: 'Tanpa Module',
      totalMenus: 1,
      totalCases: 1,
      avgProgress: 0,
    }));
  });

  it('aggregates bugfix status counts', () => {
    expect(aggregateBugFixCounts([
      bugFix({ id: 'reported', status: BUGFIX_STATUS.REPORTED }),
      bugFix({ id: 'fixing', status: BUGFIX_STATUS.FIXING }),
      bugFix({ id: 'ready', status: BUGFIX_STATUS.READY_TO_RETEST }),
      bugFix({ id: 'fixed', status: BUGFIX_STATUS.VERIFIED_FIXED }),
    ])).toEqual({
      bugFixReported: 1,
      bugFixFixing: 1,
      bugFixReadyRetest: 1,
      bugFixFixed: 1,
    });
  });

  it('returns the dashboard stats response shape with queues, aging, and module risks', () => {
    const now = new Date('2026-06-04T00:00:00.000Z').getTime();
    const modules: StatsModule[] = [moduleA];
    const cases = [
      testCase({
        id: 'done',
        testCaseId: 'TC-DONE',
        status: TESTCASE_STATUS.DONE,
        page: 'Login',
        testType: TEST_TYPES[0],
        priority: TESTCASE_PRIORITIES[3],
        moduleId: moduleA.id,
        module: moduleA,
      }),
      testCase({
        id: 'failed',
        testCaseId: 'TC-FAILED',
        status: TESTCASE_STATUS.FAILED,
        page: 'Login',
        testType: TEST_TYPES[1],
        priority: TESTCASE_PRIORITIES[2],
        moduleId: moduleA.id,
        module: moduleA,
      }),
      testCase({
        id: 'ready',
        testCaseId: 'TC-READY',
        status: TESTCASE_STATUS.READY_TO_RETEST,
        page: 'Profile',
        priority: TESTCASE_PRIORITIES[1],
        updatedAt: new Date('2026-06-02T00:00:00.000Z'),
      }),
      testCase({
        id: 'tba',
        testCaseId: 'TC-TBA',
        status: TESTCASE_STATUS.TBA,
        page: 'Draft',
        priority: TESTCASE_PRIORITIES[0],
      }),
    ];
    const bugFixes = [
      bugFix({
        id: 'old-fixing',
        status: BUGFIX_STATUS.FIXING,
        fixingAt: new Date('2026-06-01T00:00:00.000Z'),
        moduleId: moduleA.id,
        module: moduleA,
      }),
      bugFix({
        id: 'fixed',
        status: BUGFIX_STATUS.VERIFIED_FIXED,
        fixedAt: new Date('2026-06-03T00:00:00.000Z'),
      }),
    ];

    const stats = calculateDashboardStats(cases, bugFixes, modules, now);

    expect(stats).toMatchObject({
      totalTestCases: 4,
      tbaCount: 1,
      activeCount: 3,
      doneCount: 1,
      failedCount: 1,
      readyToRetestCount: 1,
      bugFixTotal: 2,
      bugFixFixing: 1,
      bugFixFixed: 1,
      positiveCount: 3,
      negativeCount: 1,
      criticalCount: 1,
      highCount: 1,
      mediumCount: 1,
      lowCount: 1,
      overallProgress: 33,
    });
    expect(stats.pageGroups).toEqual([
      { page: 'Login', _count: { id: 2 } },
      { page: 'Profile', _count: { id: 1 } },
      { page: 'Draft', _count: { id: 1 } },
    ]);
    expect(stats.retestQueue).toEqual([
      expect.objectContaining({
        id: 'ready',
        waitingDays: 2,
        moduleName: null,
      }),
    ]);
    expect(stats.bugAging).toEqual([
      expect.objectContaining({
        id: 'old-fixing',
        ageDays: 3,
        moduleName: moduleA.name,
      }),
    ]);
    expect(stats.moduleRisks).toEqual([
      expect.objectContaining({
        moduleId: moduleA.id,
        failed: 1,
        riskScore: 5,
      }),
      expect.objectContaining({
        moduleId: null,
        readyToRetest: 1,
        riskScore: 3,
      }),
    ]);
  });
});
