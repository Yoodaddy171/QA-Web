export interface Project {
  id: string;
  name: string;
  description?: string;
  automationContext?: string;
  createdAt: string;
  _count?: { testCases: number; modules: number };
}

export interface Module {
  id: string;
  name: string;
  projectId: string;
  _count?: { testCases: number };
}

export interface TestCase {
  id: string;
  testCaseId: string;
  page: string;
  subMenu?: string | null;
  weight?: string | null;
  calculatedWeight?: number | null;
  testType: string;
  testAction: string;
  steps: string;
  expectedResult: string;
  actualResult?: string | null;
  stepLogs?: string | null;
  status: string;
  progress: number;
  remarks?: string | null;
  priority: string;
  projectId: string;
  moduleId?: string | null;
  project?: Project;
  module?: Module;
  createdAt: string;
  updatedAt: string;
}

export interface MenuProgressItem {
  page: string;
  subMenu: string;
  totalCases: number;
  weightPerCase: number;
  progressPercent: number;
  doneCount: number;
  inProgressCount: number;
  notDoneCount: number;
  blockedCount: number;
  failedCount: number;
  readyToRetestCount: number;
  tbaCount: number;
  activeCount: number;
}

export interface ModuleProgressItem {
  id: string;
  name: string;
  totalMenus: number;
  totalCases: number;
  totalDone: number;
  avgProgress: number;
  menus: MenuProgressItem[];
}

export interface UngroupedProgressItem {
  id: null;
  name: string;
  totalMenus: number;
  totalCases: number;
  totalDone: number;
  avgProgress: number;
  menus: MenuProgressItem[];
}

export interface Stats {
  totalTestCases: number;
  doneCount: number;
  notDoneCount: number;
  inProgressCount: number;
  blockedCount: number;
  failedCount: number;
  readyToRetestCount: number;
  tbaCount: number;
  bugFixTotal: number;
  bugFixReported: number;
  bugFixFixing: number;
  bugFixReadyRetest: number;
  bugFixFixed: number;
  positiveCount: number;
  negativeCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  overallProgress: number;
  moduleData: { name: string; total: number; done: number; notDone: number; inProgress: number; blocked: number }[];
  pageGroups: { page: string; _count: { id: number } }[];
  weightMap: Record<string, number>;
  menuProgress: {
    menuKey: string;
    page: string;
    subMenu: string;
    totalCases: number;
    weightPerCase: number;
    totalWeight: number;
    contributedWeight: number;
    progressPercent: number;
    doneCount: number;
    inProgressCount: number;
    notDoneCount: number;
    blockedCount: number;
    failedCount: number;
    readyToRetestCount: number;
    tbaCount: number;
    moduleId: string | null;
    moduleName: string | null;
  }[];
  moduleProgress: ModuleProgressItem[];
  ungroupedProgress: UngroupedProgressItem | null;
  retestQueue?: {
    id: string;
    testCaseId: string;
    page: string;
    subMenu: string | null;
    priority: string;
    moduleName: string | null;
    updatedAt: string;
    waitingDays: number;
  }[];
  bugAging?: {
    id: string;
    testCaseId: string;
    page: string;
    subMenu: string | null;
    testAction: string;
    priority: string;
    status: string;
    moduleName: string | null;
    startedAt: string;
    ageDays: number;
  }[];
  moduleRisks?: {
    moduleId: string | null;
    moduleName: string;
    total: number;
    failed: number;
    readyToRetest: number;
    inProgress: number;
    blocked: number;
    notDone: number;
    riskScore: number;
  }[];
}
