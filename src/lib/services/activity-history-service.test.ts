import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbMock = vi.hoisted(() => ({
  activityHistory: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
}));
const actorMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/db', () => ({ db: dbMock }));
vi.mock('@/lib/request-actor', () => ({ getRequestActor: actorMock }));

describe('activity history service', () => {
  beforeEach(() => { vi.clearAllMocks(); actorMock.mockResolvedValue(null); });

  it('uses a system actor outside an authenticated request', async () => {
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
      data: expect.objectContaining({ actor: 'system', actorUserId: null, action: 'COMMENTED' }),
    });
  });

  it('uses the authenticated session as immutable audit actor', async () => {
    actorMock.mockResolvedValue({ userId: 'user-1', name: 'Sammy', email: 'sammy@example.com', workspaceId: 'workspace-1', role: 'OWNER' });
    dbMock.activityHistory.create.mockResolvedValue({ id: 'activity-2' });
    const { recordActivity } = await import('@/lib/services/activity-history-service');
    await recordActivity({ projectId: 'project-1', entityType: 'TestCase', entityId: 'case-1', action: 'UPDATED', actor: 'spoofed-client' });
    expect(dbMock.activityHistory.create).toHaveBeenCalledWith({ data: expect.objectContaining({ actor: 'Sammy', actorUserId: 'user-1' }) });
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
