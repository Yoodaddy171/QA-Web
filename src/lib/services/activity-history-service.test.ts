import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbMock = vi.hoisted(() => ({
  activityHistory: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({ db: dbMock }));

describe('activity history service', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses local-user when an action does not provide an actor', async () => {
    dbMock.activityHistory.create.mockResolvedValue({ id: 'activity-1' });
    const { recordActivity } = await import('@/lib/services/activity-history-service');

    await recordActivity({
      projectId: 'project-1',
      entityType: 'TestCase',
      entityId: 'case-1',
      action: 'COMMENTED',
      afterValue: { comment: 'Needs review' },
    });

    expect(dbMock.activityHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ actor: 'local-user', action: 'COMMENTED' }),
    });
  });

  it('supports action-filtered immutable activity reads', async () => {
    dbMock.activityHistory.findMany.mockResolvedValue([]);
    const { listEntityActivity } = await import('@/lib/services/activity-history-service');

    await listEntityActivity('project-1', 'TestCase', 'case-1', 'COMMENTED');

    expect(dbMock.activityHistory.findMany).toHaveBeenCalledWith({
      where: { projectId: 'project-1', entityType: 'TestCase', entityId: 'case-1', action: 'COMMENTED' },
      orderBy: { createdAt: 'desc' },
    });
  });
});
