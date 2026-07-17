import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  project: { findUnique: vi.fn() },
  usage: { upsert: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
  audit: { create: vi.fn(), update: vi.fn() },
  transaction: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    project: mocks.project,
    aiUsageMonth: mocks.usage,
    aiRequestAudit: mocks.audit,
    $transaction: mocks.transaction,
  },
}));
vi.mock('@/lib/request-actor', () => ({
  getRequestActor: vi.fn(async () => ({ userId: 'user-1' })),
}));

import {
  beginGovernedAIRequest,
  buildDataPreview,
  completeGovernedAIRequest,
  estimateTokens,
  failGovernedAIRequest,
  scrubSensitiveText,
} from './ai-governance';

describe('AI governance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.project.findUnique.mockResolvedValue({ id: 'project-1', allowExternalAi: false, aiMonthlyTokenBudget: 10_000 });
    mocks.usage.upsert.mockResolvedValue({ id: 'usage-1' });
    mocks.usage.updateMany.mockResolvedValue({ count: 1 });
    mocks.usage.update.mockResolvedValue({});
    mocks.audit.create.mockResolvedValue({ id: 'audit-1' });
    mocks.audit.update.mockResolvedValue({});
    mocks.transaction.mockImplementation(async (operations: Promise<unknown>[]) => Promise.all(operations));
  });

  it('redacts credentials, email, bearer token, and payment numbers', () => {
    const result = scrubSensitiveText('email qa@example.com password=hunter2 Bearer abc.def_123456789 card 4111 1111 1111 1111');
    expect(result.text).not.toContain('qa@example.com');
    expect(result.text).not.toContain('hunter2');
    expect(result.text).not.toContain('abc.def_123456789');
    expect(result.text).not.toContain('4111 1111 1111 1111');
    expect(result.redactions).toBe(4);
  });

  it('builds a bounded preview and conservative token estimate', () => {
    expect(estimateTokens('12345')).toBe(2);
    const preview = buildDataPreview('system', `qa@example.com ${'x'.repeat(3000)}`);
    expect(preview.user.length).toBeLessThanOrEqual(2400);
    expect(preview.truncated).toBe(true);
    expect(preview.redactions).toBe(1);
    expect(preview.estimatedInputTokens).toBeGreaterThan(700);
  });

  it('reserves budget, records sanitized metadata, and reconciles successful usage', async () => {
    const state = await beginGovernedAIRequest(
      { projectId: 'project-1', operation: 'generate-testcases', promptVersion: 'v1', contextIds: ['tc-1'], dataCategories: ['testcase'] },
      'Do not expose qa@example.com',
      'password=secret-value',
      500,
    );
    expect(state.system).toContain('[REDACTED_EMAIL]');
    expect(state.user).toContain('[REDACTED_CREDENTIAL]');
    expect(mocks.usage.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'usage-1' }),
    }));
    expect(mocks.audit.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ promptVersion: 'v1', status: 'PENDING' }) }));

    await completeGovernedAIRequest(state, { provider: 'ollama', model: 'llama3.1', raw: '{"drafts":[]}' });
    expect(mocks.audit.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ provider: 'ollama', status: 'SUCCESS', outputHash: expect.stringMatching(/^[a-f0-9]{64}$/) }),
    }));
  });

  it('rejects requests that cannot reserve the monthly token budget', async () => {
    mocks.usage.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(beginGovernedAIRequest(
      { projectId: 'project-budget', operation: 'chat', promptVersion: 'v1' },
      'system',
      'user',
      500,
    )).rejects.toThrow('Budget token AI bulanan');
    expect(mocks.audit.create).not.toHaveBeenCalled();
  });

  it('releases reserved tokens and marks failed audits', async () => {
    const state = await beginGovernedAIRequest(
      { projectId: 'project-failure', operation: 'chat', promptVersion: 'v1' },
      'system',
      'user',
      500,
    );
    await failGovernedAIRequest(state, new TypeError('provider failed'));
    expect(mocks.usage.update).toHaveBeenCalledWith(expect.objectContaining({ data: { usedTokens: { decrement: state.reservation } } }));
    expect(mocks.audit.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'FAILED', errorCode: 'TypeError' } }));
  });
});
