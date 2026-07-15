import type React from 'react';

export interface Module { id: string; name: string; projectId: string; _count?: { testCases: number } }
export interface Project { id: string; name: string; description?: string; automationContext?: string; createdAt: string; _count?: { testCases: number; modules: number } }
export interface TestCase {
  id: string; sourceTestCaseId?: string; testCaseId: string; page: string; subMenu?: string | null; weight?: string | null; calculatedWeight?: number | null;
  testType: string; testAction: string; steps: string; expectedResult: string; actualResult?: string | null; stepLogs?: string | null; status: string; progress: number;
  remarks?: string | null; priority: string; projectId: string; moduleId?: string | null; project?: Project; module?: Module; reportedAt?: string | null;
  fixingAt?: string | null; readyAt?: string | null; fixedAt?: string | null; detailSource?: 'testcase' | 'bugfix'; createdAt: string; updatedAt: string;
}
export interface TestRecordSummary { hasAutomationRun: boolean; hasManualCapture: boolean; lastRunAt: string | null }

export interface TestCaseTableProps {
  selectedProject: string; modules: Module[]; hasUnassignedModule: boolean; testCases: TestCase[]; search: string; filterStatus: string; filterTestType: string; filterPriority: string; filterModule: string; filterSubMenu: string; filterTestRun: string; filterBug: string; filterTag: string; filterCreatedFrom: string; filterCreatedTo: string; testRunOptions: Array<{ id: string; name: string; status: string }>; subMenuOptions: string[]; selectedIds: Set<string>; page: number; limit: number; total: number; totalPages: number; testRecordById: Record<string, TestRecordSummary>; fileInputRef: React.RefObject<HTMLInputElement | null>; aiEnabled?: boolean;
  setSearch: (value: string) => void; setFilterStatus: (value: string) => void; setFilterTestType: (value: string) => void; setFilterPriority: (value: string) => void; setFilterModule: (value: string) => void; setFilterSubMenu: (value: string) => void; setFilterTestRun: (value: string) => void; setFilterBug: (value: string) => void; setFilterTag: (value: string) => void; setFilterCreatedFrom: (value: string) => void; setFilterCreatedTo: (value: string) => void; setPage: (value: number) => void; setLimit: (value: number) => void; setShowBulkAction: (value: boolean) => void; setShowBulkExecution: (value: boolean) => void; setShowBulkAssign: (value: boolean) => void; setShowDeleteConfirm: (value: boolean) => void;
  openCreateDialog: () => void; openAIDialog: () => void; openImportDialog: () => void; handleImportExcel: (event: React.ChangeEvent<HTMLInputElement>) => void; handleExportExcel: (format?: string, testCaseIds?: string[]) => void; refreshList: () => void; toggleSelectAll: () => void; toggleSelect: (id: string) => void; toggleSort: (field: string) => void;
  openViewDialog: (testCase: TestCase) => void; openEditDialog: (testCase: TestCase) => void; handleDuplicate: (testCase: TestCase) => void; requestDelete: (testCase: TestCase) => void;
  getStatusColor: (status: string) => string; getStatusIcon: (status: string) => React.ReactNode; getStatusBadgeVariant: (status: string) => 'success' | 'failed' | 'warning' | 'info' | 'notdone' | 'inprogress' | 'blocked' | 'readyretest' | 'verifiedfixed' | 'tba' | 'outline'; getPriorityColor: (priority: string) => string; getTestTypeColor: (type: string) => string; isLoading?: boolean; onQuickStatusChange?: (testCaseId: string, newStatus: string) => void;
}
