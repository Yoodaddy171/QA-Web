import { describe, expect, it } from 'vitest';
import { createIntegrationProviders, type IssueTrackerProvider } from './providers';

describe('integration provider contracts', () => {
  it('keeps provider selection optional and vendor-neutral', async () => {
    const fakeProvider: IssueTrackerProvider = {
      kind: 'issue-tracker',
      providerName: 'fake',
      async createIssue(input) { return { id: input.testCaseId, provider: 'fake' }; },
      async getIssue(id) { return { id, provider: 'fake' }; },
      async addComment() {},
    };
    const providers = createIntegrationProviders({ issueTracker: fakeProvider });

    expect(providers.notification).toBeUndefined();
    await expect(providers.issueTracker?.createIssue({ projectId: 'p1', testCaseId: 'tc1', title: 'Bug', description: 'Failure' })).resolves.toEqual({ id: 'tc1', provider: 'fake' });
  });
});
