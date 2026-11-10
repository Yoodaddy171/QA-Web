import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetSessionByToken, mockVerifyPassword, mockHashPassword, mockDb } = vi.hoisted(() => ({
  mockGetSessionByToken: vi.fn(),
  mockVerifyPassword: vi.fn(),
  mockHashPassword: vi.fn(),
  mockDb: {
    $transaction: vi.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    session: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    activityHistory: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    testExecution: {
      count: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth', () => ({
  SESSION_COOKIE: 'qa_session',
  getSessionByToken: mockGetSessionByToken,
  verifyPassword: mockVerifyPassword,
  hashPassword: mockHashPassword,
}));

vi.mock('@/lib/db', () => ({
  db: mockDb,
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

import { AccountMenu } from './AccountMenu';
import { UserProfilePanel } from './UserProfilePanel';
import { GET, PATCH } from '@/app/api/auth/profile/route';

describe('AccountMenu & UserProfilePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders AccountMenu user trigger button with accessible label and zero em dashes', () => {
    const html = renderToStaticMarkup(<AccountMenu onOpenProfile={vi.fn()} />);
    expect(html).toContain('aria-label="Menu akun"');
    expect(html).not.toContain('\u2014');
  });

  it('renders UserProfilePanel skeleton initial state without em dashes', () => {
    const html = renderToStaticMarkup(<UserProfilePanel />);
    expect(html).toContain('aria-label="Memuat profil pengguna"');
    expect(html).not.toContain('\u2014');
  });

  it('GET /api/auth/profile returns user profile, memberships, sessions, and QA stats', async () => {
    mockGetSessionByToken.mockResolvedValue({
      id: 'sess-current',
      userId: 'user-1',
      guest: null,
      user: { id: 'user-1', name: 'Sammy QA', email: 'sammy@traceva.local' },
    });

    mockDb.user.findUnique.mockResolvedValue({
      id: 'user-1',
      name: 'Sammy QA',
      email: 'sammy@traceva.local',
      isGuest: false,
      createdAt: new Date('2026-01-10T08:00:00.000Z'),
      updatedAt: new Date('2026-05-10T08:00:00.000Z'),
      memberships: [
        {
          id: 'mem-1',
          role: 'ADMIN',
          createdAt: new Date('2026-01-10T08:00:00.000Z'),
          workspace: {
            id: 'ws-1',
            name: 'Default Workspace',
            slug: 'default-workspace',
            _count: { projects: 3 },
          },
        },
      ],
    });

    mockDb.session.findMany.mockResolvedValue([
      {
        id: 'sess-current',
        createdAt: new Date('2026-11-10T07:00:00.000Z'),
        expiresAt: new Date('2026-11-24T07:00:00.000Z'),
        guestAccessId: null,
      },
    ]);

    mockDb.activityHistory.count.mockResolvedValueOnce(42).mockResolvedValueOnce(15);
    mockDb.activityHistory.findMany.mockResolvedValue([
      {
        id: 'act-1',
        entityType: 'TestCase',
        entityId: 'tc-1',
        action: 'UPDATED',
        field: 'status',
        afterValue: 'DONE',
        createdAt: new Date('2026-11-10T08:00:00.000Z'),
        projectId: 'proj-1',
      },
    ]);

    const req = new NextRequest('http://localhost/api/auth/profile', {
      headers: { cookie: 'qa_session=valid-token' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.profile.name).toBe('Sammy QA');
    expect(body.profile.memberships).toHaveLength(1);
    expect(body.profile.memberships[0].workspace.projectCount).toBe(3);
    expect(body.profile.sessions[0].isCurrent).toBe(true);
    expect(body.profile.stats).toEqual({
      totalActivities: 42,
      totalExecutions: 15,
      workspaceCount: 1,
      activeSessionCount: 1,
    });
  });

  it('PATCH /api/auth/profile updates display name when action is update-profile', async () => {
    mockGetSessionByToken.mockResolvedValue({
      id: 'sess-current',
      userId: 'user-1',
      guest: null,
      user: { id: 'user-1', name: 'Sammy QA', email: 'sammy@traceva.local', isGuest: false },
    });

    mockDb.user.update.mockResolvedValue({
      id: 'user-1',
      name: 'Sammy Architect',
      email: 'sammy@traceva.local',
      updatedAt: new Date('2026-11-10T09:00:00.000Z'),
    });

    const req = new NextRequest('http://localhost/api/auth/profile', {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        cookie: 'qa_session=valid-token',
      },
      body: JSON.stringify({ action: 'update-profile', name: 'Sammy Architect' }),
    });

    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.user.name).toBe('Sammy Architect');
    expect(mockDb.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-1' },
        data: { name: 'Sammy Architect' },
      })
    );
  });

  it('PATCH /api/auth/profile verifies currentPassword and hashes newPassword on change-password', async () => {
    mockGetSessionByToken.mockResolvedValue({
      id: 'sess-current',
      userId: 'user-1',
      guest: null,
      user: { id: 'user-1', name: 'Sammy QA', email: 'sammy@traceva.local', isGuest: false },
    });

    mockDb.user.findUnique.mockResolvedValue({
      id: 'user-1',
      passwordHash: 'old-hash',
    });
    mockVerifyPassword.mockReturnValue(true);
    mockHashPassword.mockReturnValue('new-hash-123');
    mockDb.user.update.mockResolvedValue({ id: 'user-1' });
    mockDb.session.deleteMany.mockResolvedValue({ count: 2 });

    const req = new NextRequest('http://localhost/api/auth/profile', {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        cookie: 'qa_session=valid-token',
      },
      body: JSON.stringify({
        action: 'change-password',
        currentPassword: 'oldPassword123!',
        newPassword: 'newSecurePassword123!',
      }),
    });

    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(mockVerifyPassword).toHaveBeenCalledWith('oldPassword123!', 'old-hash');
    expect(mockHashPassword).toHaveBeenCalledWith('newSecurePassword123!');
    expect(mockDb.session.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', id: { not: 'sess-current' } },
    });
  });
});
