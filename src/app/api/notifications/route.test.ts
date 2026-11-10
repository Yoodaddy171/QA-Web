import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { listNotifications } = vi.hoisted(() => ({ listNotifications: vi.fn() }));
vi.mock('@/lib/services/notification-service', () => ({ listNotifications }));
import { GET } from './route';

describe('notification list freshness', () => {
  beforeEach(() => vi.resetAllMocks());

  it('prevents caching recipient-specific unread state', async () => {
    const result = { notifications: [], unreadCount: 0, nextCursor: null };
    listNotifications.mockResolvedValue(result);
    const response = await GET(new NextRequest('http://localhost/api/notifications?projectId=project-1&limit=30'));
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await response.json()).toEqual(result);
    expect(listNotifications).toHaveBeenCalledWith(expect.objectContaining({ projectId: 'project-1', limit: 30 }));
  });
});
