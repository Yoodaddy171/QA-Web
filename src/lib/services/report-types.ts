export type ReportType = 'TEST_STATUS_REPORT' | 'TEST_PLANNING_DOCUMENT';
export type ReportStatus = 'DRAFT' | 'FINAL';

export interface ReportMetadata {
  documentInformation?: string;
  approval?: { approvedBy: string; signature?: string; date?: string }[];
  revisionLog?: { date: string; version: string; changes: string; author?: string }[];
  references?: { type: 'External' | 'Internal'; title: string }[];
  glossary?: { term: string; definition: string }[];
  appendix?: { documentName: string; description: string; location: string }[];
}

export interface ReportSections {
  scope?: string;
  progressNarrative?: string;
  blockingFactors?: string;
  newRisks?: string;
  plannedTesting?: string;
  testItems?: string;
  softwareRiskIssues?: string;
  featuresToBeTested?: string;
  approachStrategy?: string;
  passFailCriteria?: string;
  suspensionCriteria?: string;
  testDeliverables?: string;
  remainingTestTasks?: string;
  environmentalNeeds?: string;
  responsibilities?: string;
  schedule?: string;
  planningRisks?: string;
}

export interface ReportMetrics {
  totalPlanned: number;
  totalExecuted: number;
  totalPassed: number;
  totalFailed: number;
  totalPending: number;
  passRate: number;
  failRate: number;
  executionRate: number;
  byModule: ModuleMetrics[];
  byPriority: PriorityMetrics[];
  byStatus: StatusMetrics[];
  bugSummary: BugSummary;
  appendix: { documentName: string; description: string; location: string }[];
}

export interface ModuleMetrics {
  moduleName: string;
  totalPlanned: number;
  totalExecuted: number;
  totalPassed: number;
  totalFailed: number;
  totalPending: number;
  passRate: number;
}

export interface PriorityMetrics {
  priority: string;
  totalPlanned: number;
  totalExecuted: number;
  totalPassed: number;
  totalFailed: number;
  passRate: number;
}

export interface StatusMetrics {
  status: string;
  count: number;
  percentage: number;
}

export interface BugSummary {
  total: number;
  reported: number;
  fixing: number;
  readyToRetest: number;
  fixed: number;
  byModule: { moduleName: string; total: number }[];
}

export interface ReportData {
  id: string;
  projectId: string;
  projectName: string;
  reportType: ReportType;
  status: ReportStatus;
  documentId?: string;
  version: string;
  author?: string;
  approvedBy?: string;
  dateOfIssue?: Date;
  documentStatus?: string;
  reportingPeriodStart: Date;
  reportingPeriodEnd: Date;
  metadata: ReportMetadata;
  sections: ReportSections;
  metrics: ReportMetrics;
  generatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateReportInput {
  projectId: string;
  reportType: ReportType;
  documentId?: string;
  version: string;
  author?: string;
  approvedBy?: string;
  dateOfIssue?: Date;
  documentStatus?: string;
  reportingPeriodStart: Date;
  reportingPeriodEnd: Date;
  metadata?: ReportMetadata;
  sections?: ReportSections;
}

export type UpdateReportInput = Partial<Omit<CreateReportInput, 'projectId' | 'reportType'>>;
