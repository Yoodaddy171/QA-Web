import { Check, CircleAlert, RefreshCw, X } from 'lucide-react';
import { TEST_EXECUTION_STATUS } from '@/lib/domain/test-run';

export type TestRunSummary = {
  total: number;
  completed: number;
  passed: number;
  failed: number;
  blocked: number;
  notRun: number;
};

export type TestRun = {
  id: string;
  name: string;
  description?: string | null;
  status: string;
  startDate?: string | null;
  endDate?: string | null;
  assignedTo?: string | null;
  progress: number;
  summary: TestRunSummary;
  _count?: { testCases: number; executions: number };
};

export type Evidence = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
};

export type Execution = {
  id: string;
  testRunId: string;
  testCaseId: string;
  tester?: string | null;
  status: string;
  actualResult?: string | null;
  notes?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  evidence?: Evidence[];
};

export type RunCase = {
  id: string;
  testCaseId: string;
  page: string;
  subMenu?: string | null;
  testAction: string;
  steps: string;
  expectedResult: string;
  module?: { id: string; name: string } | null;
  executions: Execution[];
};

export type TestRunDetail = TestRun & {
  testCases: RunCase[];
  casePage?: { hasMore: boolean; nextCursor?: string | null; startOffset?: number };
};

export type TestPlanOption = {
  id: string;
  name: string;
  status: string;
};

export type Activity = {
  id: string;
  action: string;
  field?: string | null;
  beforeValue?: unknown;
  afterValue?: unknown;
  actor?: string | null;
  createdAt: string;
};

export type AvailableCaseOption = {
  id: string;
  testCaseId: string;
  page: string;
  module?: { name: string } | null;
};

export type QueueStatusFilter = 'ALL' | 'FAILED' | 'BLOCKED' | 'PASSED' | 'NOT_RUN';

export const EXECUTION_ACTIONS = [
  { status: TEST_EXECUTION_STATUS.PASSED, label: 'Pass', shortcut: 'P', icon: Check, activeClass: 'bg-emerald-700 hover:bg-emerald-800 text-white border-transparent shadow-xs' },
  { status: TEST_EXECUTION_STATUS.FAILED, label: 'Fail', shortcut: 'F', icon: X, activeClass: 'bg-destructive hover:bg-destructive/90 text-destructive-foreground border-transparent shadow-xs' },
  { status: TEST_EXECUTION_STATUS.BLOCKED, label: 'Blocked', shortcut: 'B', icon: CircleAlert, activeClass: 'bg-amber-700 hover:bg-amber-800 text-white border-transparent shadow-xs' },
  { status: TEST_EXECUTION_STATUS.RETEST, label: 'Retest', shortcut: 'R', icon: RefreshCw, activeClass: 'bg-cyan-700 hover:bg-cyan-800 text-white border-transparent shadow-xs' },
];

export const RUN_CASES_PER_PAGE = 10;
export const MAX_EVIDENCE_FILE_SIZE = 25 * 1024 * 1024;
export const ALLOWED_EVIDENCE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
  'application/pdf',
]);

export function statusVariant(status: string): 'success' | 'failed' | 'blocked' | 'readyretest' | 'inprogress' | 'notdone' | 'outline' {
  if (status === TEST_EXECUTION_STATUS.PASSED || status === TEST_EXECUTION_STATUS.VERIFIED) return 'success';
  if (status === TEST_EXECUTION_STATUS.FAILED) return 'failed';
  if (status === TEST_EXECUTION_STATUS.BLOCKED) return 'blocked';
  if (status === TEST_EXECUTION_STATUS.RETEST) return 'readyretest';
  if (status === TEST_EXECUTION_STATUS.IN_PROGRESS) return 'inprogress';
  if (status === TEST_EXECUTION_STATUS.NOT_RUN) return 'notdone';
  return 'outline';
}

export function statusDotClass(status: string) {
  if (status === TEST_EXECUTION_STATUS.PASSED || status === TEST_EXECUTION_STATUS.VERIFIED) return 'bg-emerald-500';
  if (status === TEST_EXECUTION_STATUS.FAILED) return 'bg-rose-500';
  if (status === TEST_EXECUTION_STATUS.BLOCKED) return 'bg-amber-500';
  if (status === TEST_EXECUTION_STATUS.RETEST) return 'bg-cyan-500';
  if (status === TEST_EXECUTION_STATUS.IN_PROGRESS) return 'bg-sky-500';
  return 'bg-muted-foreground/40';
}

export function statusTextClass(status: string) {
  if (status === TEST_EXECUTION_STATUS.PASSED || status === TEST_EXECUTION_STATUS.VERIFIED) return 'text-status-passed';
  if (status === TEST_EXECUTION_STATUS.FAILED) return 'text-status-failed';
  if (status === TEST_EXECUTION_STATUS.BLOCKED) return 'text-status-blocked';
  if (status === TEST_EXECUTION_STATUS.RETEST) return 'text-status-retest';
  if (status === TEST_EXECUTION_STATUS.IN_PROGRESS) return 'text-status-in-progress';
  return 'text-muted-foreground';
}

export function lastCaseStorageKey(projectId: string, testRunId: string) {
  return `qaDesk.testRun.lastCase.v1.${projectId}.${testRunId}`;
}

export function notesStorageKey(projectId: string, testRunId: string, testCaseId: string) {
  return `qaDesk.testRun.notesDraft.v1.${projectId}.${testRunId}.${testCaseId}`;
}
