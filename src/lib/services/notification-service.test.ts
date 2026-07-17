import { beforeEach, describe, expect, it, vi } from 'vitest';

const notificationMock = {
  findUnique: vi.fn(),
  findUniqueOrThrow: vi.fn(),
  create: vi.fn(),
  findMany: vi.fn(),
  count: vi.fn(),
  findFirst: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
};
const actorMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/db', () => ({ db: { notification: notificationMock } }));
vi.mock('@/lib/request-actor', () => ({ getRequestActor: actorMock }));

describe('notification service', () => {
  beforeEach(() => { vi.clearAllMocks(); actorMock.mockResolvedValue(null); });

  it('uses local-user and returns an existing deduplicated event', async () => {
    notificationMock.findUnique.mockResolvedValue({ id: 'notification-1' });
    const { createNotification } = await import('@/lib/services/notification-service');
    const result = await createNotification({ projectId: 'project-1', type: 'TESTCASE_FAILED', title: 'Failed', message: 'Needs attention', dedupeKey: 'failed:execution-1' });
    expect(result).toEqual({ id: 'notification-1' });
    expect(notificationMock.findUnique).toHaveBeenCalledWith({ where: { projectId_recipientKey_dedupeKey: { projectId: 'project-1', recipientKey: 'local-user', dedupeKey: 'failed:execution-1' } } });
    expect(notificationMock.create).not.toHaveBeenCalled();
  });

  it('isolates list and unread count by project and recipient', async () => {
    notificationMock.findMany.mockResolvedValue([{ id: 'notification-2' }]);
    notificationMock.count.mockResolvedValue(1);
    const { listNotifications } = await import('@/lib/services/notification-service');
    const result = await listNotifications({ projectId: 'project-1', recipientKey: 'qa-user', unreadOnly: true });
    expect(result.unreadCount).toBe(1);
    expect(notificationMock.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { projectId: 'project-1', recipientKey: 'qa-user', readAt: null } }));
  });

  it('marks only a matching recipient notification as read', async () => {
    notificationMock.findFirst.mockResolvedValue({ id: 'notification-3' });
    notificationMock.update.mockResolvedValue({ id: 'notification-3', readAt: new Date() });
    const { setNotificationReadState } = await import('@/lib/services/notification-service');
    await setNotificationReadState({ id: 'notification-3', projectId: 'project-1', recipientKey: 'qa-user', read: true });
    expect(notificationMock.findFirst).toHaveBeenCalledWith({ where: { id: 'notification-3', projectId: 'project-1', recipientKey: 'qa-user' }, select: { id: true } });
    expect(notificationMock.update).toHaveBeenCalledWith({ where: { id: 'notification-3' }, data: { readAt: expect.any(Date) } });
  });

  it('ignores a spoofed recipient when an authenticated actor exists', async () => {
    actorMock.mockResolvedValue({ userId: 'session-user', name: 'Session User', email: 'user@example.com', workspaceId: 'workspace-1', role: 'QA' });
    notificationMock.findMany.mockResolvedValue([]);
    notificationMock.count.mockResolvedValue(0);
    const { listNotifications } = await import('@/lib/services/notification-service');
    await listNotifications({ projectId: 'project-1', recipientKey: 'other-user' });
    expect(notificationMock.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { projectId: 'project-1', recipientKey: 'session-user' } }));
  });
});
