import { BUGFIX_STATUS } from '@/lib/domain/bugfix';
import { getStatusProgressFactor } from '@/lib/domain/progress';
import { TESTCASE_PRIORITIES, TESTCASE_STATUS, TEST_TYPES } from '@/lib/domain/testcase';

type ModuleRef = {
  id: string;
  name: string;
};

export type StatsTestCase = {
  id: string;
  testCaseId: string;
  page: string;
  subMenu: string | null;
  status: string;
  testType: string;
  priority: string;
  updatedAt: Date;
  moduleId: string | null;
  module: ModuleRef | null;
};

export type StatsModule = ModuleRef;
export type StatsInventoryCase = Pick<StatsTestCase, 'id' | 'page' | 'subMenu' | 'status' | 'moduleId' | 'module'>;

export type StatsBugFix = {
  id: string;
  sourceTestCaseId: string | null;
  testCaseId: string;
  page: string;
  subMenu: string | null;
  testAction: string;
  priority: string;
  status: string;
  reportedAt: Date | null;
  fixingAt: Date | null;
  readyAt: Date | null;
  fixedAt: Date | null;
  updatedAt: Date;
  moduleId: string | null;
  module: ModuleRef | null;
};

type StatusCounts = {
  doneCount: number;
  notDoneCount: number;
  inProgressCount: number;
  blockedCount: number;
  failedCount: number;
  readyToRetestCount: number;
  tbaCount: number;
};

export type MenuProgress = StatusCounts & {
  menuKey: string;
  page: string;
  subMenu: string;
  totalCases: number;
  weightPerCase: number;
  totalWeight: number;
  contributedWeight: number;
  progressPercent: number;
  moduleId: string | null;
  moduleName: string | null;
};

const roundTwo = (value: number) => Math.round(value * 100) / 100;

export function aggregateTestCaseStatusCounts(testCases: Array<{ status: string }>): StatusCounts {
  const counts: StatusCounts = {
    doneCount: 0,
    notDoneCount: 0,
    inProgressCount: 0,
    blockedCount: 0,
    failedCount: 0,
    readyToRetestCount: 0,
    tbaCount: 0,
  };

  for (const tc of testCases) {
    if (tc.status === TESTCASE_STATUS.DONE) counts.doneCount++;
    else if (tc.status === TESTCASE_STATUS.IN_PROGRESS) counts.inProgressCount++;
    else if (tc.status === TESTCASE_STATUS.BLOCKED) counts.blockedCount++;
    else if (tc.status === TESTCASE_STATUS.FAILED) counts.failedCount++;
    else if (tc.status === TESTCASE_STATUS.READY_TO_RETEST) counts.readyToRetestCount++;
    else if (tc.status === TESTCASE_STATUS.TBA) counts.tbaCount++;
    else counts.notDoneCount++;
  }

  return counts;
}

export function buildMenuWeightProgress(testCases: StatsInventoryCase[]) {
  const activeTestCases = testCases.filter(tc => tc.status !== TESTCASE_STATUS.TBA);
  const menuGroups: Record<string, StatsInventoryCase[]> = {};

  for (const tc of activeTestCases) {
    const menuKey = `${tc.page}|||${tc.subMenu || ''}`;
    if (!menuGroups[menuKey]) menuGroups[menuKey] = [];
    menuGroups[menuKey].push(tc);
  }

  const weightMap: Record<string, number> = {};
  for (const cases of Object.values(menuGroups)) {
    const weightPerCase = 100 / cases.length;
    for (const tc of cases) {
      weightMap[tc.id] = weightPerCase;
    }
  }

  const menuProgress: MenuProgress[] = [];
  for (const [menuKey, cases] of Object.entries(menuGroups)) {
    const [page, subMenu] = menuKey.split('|||');
    const weightPerCase = 100 / cases.length;
    let contributedWeight = 0;

    for (const tc of cases) {
      contributedWeight += weightPerCase * getStatusProgressFactor(tc.status);
    }

    const firstModule = cases.find(c => c.moduleId)?.module;
    menuProgress.push({
      menuKey,
      page,
      subMenu: subMenu || '',
      totalCases: cases.length,
      weightPerCase: roundTwo(weightPerCase),
      totalWeight: 100,
      contributedWeight: roundTwo(contributedWeight),
      progressPercent: roundTwo(contributedWeight),
      ...aggregateTestCaseStatusCounts(cases),
      moduleId: firstModule?.id || null,
      moduleName: firstModule?.name || null,
    });
  }

  return { activeTestCases, weightMap, menuProgress };
}

export function buildModuleProgress(projectModules: StatsModule[], menuProgress: MenuProgress[]) {
  const moduleGroups: Record<string, MenuProgress[]> = {};
  const ungroupedMenus: MenuProgress[] = [];

  for (const mp of menuProgress) {
    if (mp.moduleId) {
      if (!moduleGroups[mp.moduleId]) moduleGroups[mp.moduleId] = [];
      moduleGroups[mp.moduleId].push(mp);
    } else {
      ungroupedMenus.push(mp);
    }
  }

  const moduleProgress = projectModules.map(mod => {
    const menus = moduleGroups[mod.id] || [];
    const totalMenus = menus.length;
    const avgProgress = totalMenus > 0
      ? menus.reduce((sum, m) => sum + m.progressPercent, 0) / totalMenus
      : 0;
    const totalCases = menus.reduce((sum, m) => sum + m.totalCases, 0);
    const totalDone = menus.reduce((sum, m) => sum + m.doneCount, 0);

    return {
      id: mod.id,
      name: mod.name,
      totalMenus,
      totalCases,
      totalDone,
      avgProgress: roundTwo(avgProgress),
      menus: menus.map(m => ({
        page: m.page,
        subMenu: m.subMenu,
        totalCases: m.totalCases,
        weightPerCase: m.weightPerCase,
        progressPercent: m.progressPercent,
        doneCount: m.doneCount,
        inProgressCount: m.inProgressCount,
        notDoneCount: m.notDoneCount,
        blockedCount: m.blockedCount,
        failedCount: m.failedCount,
        readyToRetestCount: m.readyToRetestCount,
      })),
    };
  });

  const ungroupedProgress = ungroupedMenus.length > 0
    ? {
        id: null,
        name: 'Tanpa Module',
        totalMenus: ungroupedMenus.length,
        totalCases: ungroupedMenus.reduce((sum, m) => sum + m.totalCases, 0),
        totalDone: ungroupedMenus.reduce((sum, m) => sum + m.doneCount, 0),
        avgProgress: roundTwo(
          ungroupedMenus.reduce((sum, m) => sum + m.progressPercent, 0) / ungroupedMenus.length
        ),
        menus: ungroupedMenus.map(m => ({
          page: m.page,
          subMenu: m.subMenu,
          totalCases: m.totalCases,
          weightPerCase: m.weightPerCase,
          progressPercent: m.progressPercent,
          doneCount: m.doneCount,
          inProgressCount: m.inProgressCount,
          notDoneCount: m.notDoneCount,
          blockedCount: m.blockedCount,
          failedCount: m.failedCount,
          readyToRetestCount: m.readyToRetestCount,
        })),
      }
    : null;

  return { moduleProgress, ungroupedProgress };
}

export function buildModuleData(projectModules: StatsModule[], testCases: StatsInventoryCase[]) {
  const groups = new Map<string | null, { total: number; done: number; notDone: number; inProgress: number; blocked: number }>();
  for (const tc of testCases) {
    const group = groups.get(tc.moduleId) || { total: 0, done: 0, notDone: 0, inProgress: 0, blocked: 0 };
    group.total++;
    if (tc.status === TESTCASE_STATUS.DONE) group.done++;
    else if (tc.status === TESTCASE_STATUS.NOT_DONE) group.notDone++;
    else if (tc.status === TESTCASE_STATUS.IN_PROGRESS) group.inProgress++;
    else if (tc.status === TESTCASE_STATUS.BLOCKED) group.blocked++;
    groups.set(tc.moduleId, group);
  }
  return projectModules.map((m) => {
    return {
      name: m.name,
      ...(groups.get(m.id) || { total: 0, done: 0, notDone: 0, inProgress: 0, blocked: 0 }),
    };
  });
}

export function buildPageGroups(testCases: StatsInventoryCase[]) {
  const pageGroupMap: Record<string, number> = {};
  for (const tc of testCases) {
    pageGroupMap[tc.page] = (pageGroupMap[tc.page] || 0) + 1;
  }
  return Object.entries(pageGroupMap).map(([page, count]) => ({ page, _count: { id: count } }));
}

export function aggregateBugFixCounts(bugFixItems: Array<{ status: string }>) {
  return {
    bugFixReported: bugFixItems.filter(bf => bf.status === BUGFIX_STATUS.REPORTED).length,
    bugFixFixing: bugFixItems.filter(bf => bf.status === BUGFIX_STATUS.FIXING).length,
    bugFixReadyRetest: bugFixItems.filter(bf => bf.status === BUGFIX_STATUS.READY_TO_RETEST).length,
    bugFixFixed: bugFixItems.filter(bf => bf.status === BUGFIX_STATUS.VERIFIED_FIXED).length,
  };
}

const getAgeDays = (date: Date | null, now: number) => {
  if (!date) return 0;
  return Math.max(0, Math.floor((now - date.getTime()) / (1000 * 60 * 60 * 24)));
};

export function buildRetestQueue(testCases: StatsTestCase[], now: number) {
  return testCases
    .filter(tc => tc.status === TESTCASE_STATUS.READY_TO_RETEST)
    .sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime())
    .slice(0, 8)
    .map(tc => ({
      id: tc.id,
      testCaseId: tc.testCaseId,
      page: tc.page,
      subMenu: tc.subMenu,
      priority: tc.priority,
      moduleName: tc.module?.name || null,
      updatedAt: tc.updatedAt,
      waitingDays: getAgeDays(tc.updatedAt, now),
    }));
}

export function buildBugAging(bugFixItems: StatsBugFix[], now: number) {
  return bugFixItems
    .filter(bf => bf.status === BUGFIX_STATUS.REPORTED || bf.status === BUGFIX_STATUS.FIXING)
    .map(bf => ({
      id: bf.id,
      testCaseId: bf.testCaseId,
      page: bf.page,
      subMenu: bf.subMenu,
      testAction: bf.testAction,
      priority: bf.priority,
      status: bf.status,
      moduleName: bf.module?.name || null,
      startedAt: bf.fixingAt || bf.reportedAt || bf.updatedAt,
      ageDays: getAgeDays(bf.fixingAt || bf.reportedAt || bf.updatedAt, now),
    }))
    .sort((a, b) => b.ageDays - a.ageDays)
    .slice(0, 8);
}

export function buildModuleRisks(activeTestCases: StatsInventoryCase[]) {
  const moduleRiskMap = new Map<string, {
    moduleId: string | null;
    moduleName: string;
    total: number;
    failed: number;
    readyToRetest: number;
    inProgress: number;
    blocked: number;
    notDone: number;
    riskScore: number;
  }>();

  const getModuleRisk = (moduleId: string | null, moduleName: string) => {
    const key = moduleId || '__ungrouped__';
    if (!moduleRiskMap.has(key)) {
      moduleRiskMap.set(key, {
        moduleId,
        moduleName,
        total: 0,
        failed: 0,
        readyToRetest: 0,
        inProgress: 0,
        blocked: 0,
        notDone: 0,
        riskScore: 0,
      });
    }
    return moduleRiskMap.get(key)!;
  };

  for (const tc of activeTestCases) {
    const bucket = getModuleRisk(tc.moduleId, tc.module?.name || 'Tanpa Module');
    bucket.total++;
    if (tc.status === TESTCASE_STATUS.FAILED) bucket.failed++;
    else if (tc.status === TESTCASE_STATUS.READY_TO_RETEST) bucket.readyToRetest++;
    else if (tc.status === TESTCASE_STATUS.IN_PROGRESS) bucket.inProgress++;
    else if (tc.status === TESTCASE_STATUS.BLOCKED) bucket.blocked++;
    else if (tc.status === TESTCASE_STATUS.NOT_DONE) bucket.notDone++;
  }

  return Array.from(moduleRiskMap.values())
    .map(item => ({
      ...item,
      riskScore: item.failed * 5 + item.blocked * 4 + item.readyToRetest * 3 + item.inProgress * 2 + item.notDone,
    }))
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 6);
}

export function calculateDashboardStats(
  allTestCases: StatsTestCase[],
  bugFixItems: StatsBugFix[],
  projectModules: StatsModule[],
  now = Date.now()
) {
  const groups = new Map<string, { status: string; testType: string; priority: string; _count: { _all: number } }>();
  for (const item of allTestCases) {
    const key = JSON.stringify([item.status, item.testType, item.priority]);
    const row = groups.get(key) || { status: item.status, testType: item.testType, priority: item.priority, _count: { _all: 0 } };
    row._count._all++; groups.set(key, row);
  }
  return {
    ...calculateDashboardInventory(allTestCases, projectModules, [...groups.values()], {
      bugFixTotal: bugFixItems.length, ...aggregateBugFixCounts(bugFixItems),
    }),
    retestQueue: buildRetestQueue(allTestCases, now),
    bugAging: buildBugAging(bugFixItems, now),
  };
}

export function calculateDashboardInventory(
  allTestCases: StatsInventoryCase[], projectModules: StatsModule[],
  groups: Array<{ status: string; testType: string; priority: string; _count: { _all: number } }>,
  bugs: { bugFixTotal: number; bugFixReported: number; bugFixFixing: number; bugFixReadyRetest: number; bugFixFixed: number },
) {
  const activeCounts = aggregateTestCaseStatusCounts([]);
  const totals = { totalTestCases: 0, tbaCount: 0, positiveCount: 0, negativeCount: 0, criticalCount: 0, highCount: 0, mediumCount: 0, lowCount: 0 };
  for (const row of groups) {
    const count = row._count._all;
    totals.totalTestCases += count;
    if (row.status === TESTCASE_STATUS.TBA) totals.tbaCount += count;
    else {
      const single = aggregateTestCaseStatusCounts([{ status: row.status }]);
      for (const key of Object.keys(activeCounts) as Array<keyof StatusCounts>) activeCounts[key] += single[key] * count;
    }
    if (row.testType === TEST_TYPES[0]) totals.positiveCount += count;
    if (row.testType === TEST_TYPES[1]) totals.negativeCount += count;
    if (row.priority === TESTCASE_PRIORITIES[3]) totals.criticalCount += count;
    if (row.priority === TESTCASE_PRIORITIES[2]) totals.highCount += count;
    if (row.priority === TESTCASE_PRIORITIES[1]) totals.mediumCount += count;
    if (row.priority === TESTCASE_PRIORITIES[0]) totals.lowCount += count;
  }
  const { activeTestCases, weightMap, menuProgress } = buildMenuWeightProgress(allTestCases);
  const activeCount = activeTestCases.length;
  const { moduleProgress, ungroupedProgress } = buildModuleProgress(projectModules, menuProgress);
  const overallProgress = activeCount > 0 ? Math.round((activeCounts.doneCount / activeCount) * 100) : 0;

  return {
    ...totals,
    activeCount,
    ...activeCounts,
    tbaCount: totals.tbaCount,
    ...bugs,
    overallProgress,
    moduleData: buildModuleData(projectModules, allTestCases),
    pageGroups: buildPageGroups(allTestCases),
    weightMap,
    menuProgress,
    moduleProgress,
    ungroupedProgress,
    moduleRisks: buildModuleRisks(activeTestCases),
  };
}
