export type IntegrationEntityRef = { id: string; url?: string; provider?: string };

export type IssueDraft = {
  projectId: string;
  testCaseId: string;
  title: string;
  description: string;
  priority?: string;
  evidenceUrls?: string[];
};

export type NotificationMessage = {
  projectId: string;
  title: string;
  body: string;
  links?: string[];
};

export type SourceControlQuery = { projectId: string; from?: Date; to?: Date; ref?: string };
export type CiResultQuery = { projectId: string; runId?: string; ref?: string };

export interface IssueTrackerProvider {
  readonly kind: 'issue-tracker';
  readonly providerName: string;
  createIssue(input: IssueDraft): Promise<IntegrationEntityRef>;
  getIssue(id: string): Promise<IntegrationEntityRef | null>;
  addComment(id: string, body: string): Promise<void>;
}

export interface NotificationProvider {
  readonly kind: 'notification';
  readonly providerName: string;
  notify(message: NotificationMessage): Promise<void>;
}

export interface SourceControlProvider {
  readonly kind: 'source-control';
  readonly providerName: string;
  listChanges(query: SourceControlQuery): Promise<Array<{ id: string; message: string; url?: string; author?: string; createdAt: Date }>>;
}

export interface CiResultProvider {
  readonly kind: 'ci';
  readonly providerName: string;
  getResult(query: CiResultQuery): Promise<{ status: 'QUEUED' | 'RUNNING' | 'PASSED' | 'FAILED' | 'CANCELLED'; url?: string; completedAt?: Date } | null>;
}

export type IntegrationProviders = {
  issueTracker?: IssueTrackerProvider;
  notification?: NotificationProvider;
  sourceControl?: SourceControlProvider;
  ci?: CiResultProvider;
};

export function createIntegrationProviders(overrides: IntegrationProviders = {}): IntegrationProviders {
  return { ...overrides };
}
