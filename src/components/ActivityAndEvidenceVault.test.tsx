import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockDb, mockGuestSafeResponse } = vi.hoisted(() => ({
  mockDb: {
    activityHistory: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    testExecutionEvidence: {
      findMany: vi.fn(),
    },
    testRun: {
      findMany: vi.fn(),
    },
    module: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
  mockGuestSafeResponse: vi.fn(async (data: unknown) => data),
}));

vi.mock('@/lib/db', () => ({
  db: mockDb,
}));

vi.mock('@/lib/services/guest-response', () => ({
  guestSafeResponse: mockGuestSafeResponse,
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

import { ActivityNotificationPanel } from './ActivityNotificationPanel';
import { EvidenceVaultPanel } from './EvidenceVaultPanel';
import { StorageMaintenanceCard } from './StorageMaintenanceCard';
import { GET as getActivity } from '@/app/api/activity/route';
import { GET as getEvidenceGallery } from '@/app/api/evidence/gallery/route';
import { PUT as putModule } from '@/app/api/modules/route';

describe('ActivityNotificationPanel & EvidenceVaultPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders ActivityNotificationPanel header, KPIs, and tabs without em dashes', () => {
    const html = renderToStaticMarkup(<ActivityNotificationPanel projectId="proj-1" />);
    expect(html).toContain('Notification &amp; Activity Center');
    expect(html).toContain('Inbox Notifikasi');
    expect(html).toContain('Audit Trail Project');
    expect(html).not.toContain('\u2014');
  });

  it('renders EvidenceVaultPanel header, KPIs, and filter bar without em dashes', () => {
    const html = renderToStaticMarkup(<EvidenceVaultPanel projectId="proj-1" />);
    expect(html).toContain('Evidence Vault &amp; Media Gallery');
    expect(html).toContain('Total File Bukti');
    expect(html).toContain('Bukti Skenario FAILED');
    expect(html).not.toContain('\u2014');
  });

  it('GET /api/activity returns project-wide audit log and summary when entityId is omitted', async () => {
    mockDb.activityHistory.findMany
      .mockResolvedValueOnce([
        {
          id: 'act-1',
          projectId: 'proj-1',
          entityType: 'TestCase',
          entityId: 'tc-1',
          action: 'UPDATED',
          field: 'status',
          beforeValue: 'NOT DONE',
          afterValue: 'DONE',
          actor: 'Sammy QA',
          createdAt: new Date('2026-11-10T09:00:00.000Z'),
        },
      ])
      .mockResolvedValueOnce([
        { actor: 'Sammy QA', entityType: 'TestCase' },
        { actor: 'Sammy QA', entityType: 'BugFix' },
      ]);
    mockDb.activityHistory.count.mockResolvedValueOnce(12).mockResolvedValueOnce(4);

    const req = new NextRequest('http://localhost/api/activity?projectId=proj-1&limit=50');
    const res = await getActivity(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.activities).toHaveLength(1);
    expect(body.summary.totalCount).toBe(12);
    expect(body.summary.todayCount).toBe(4);
    expect(body.summary.actors).toContain('Sammy QA');
  });

  it('GET /api/evidence/gallery returns evidence items and storage summary', async () => {
    mockDb.testExecutionEvidence.findMany
      .mockResolvedValueOnce([
        {
          id: 'ev-1',
          fileName: 'login-error.png',
          mimeType: 'image/png',
          sizeBytes: 24576,
          createdAt: new Date('2026-11-10T09:00:00.000Z'),
          updatedAt: new Date('2026-11-10T09:00:00.000Z'),
          execution: {
            id: 'exec-1',
            status: 'FAILED',
            tester: 'Sammy QA',
            actualResult: 'Button disabled',
            notes: 'Perlu dicek ulang',
            createdAt: new Date('2026-11-10T09:00:00.000Z'),
            testCase: {
              id: 'tc-uuid-1',
              testCaseId: 'TC-AUTH-01',
              page: 'Login',
              testAction: 'Submit form',
              priority: 'High',
            },
            testRun: {
              id: 'run-1',
              name: 'Cycle 1 RC',
              status: 'IN PROGRESS',
            },
          },
        },
      ])
      .mockResolvedValueOnce([
        {
          mimeType: 'image/png',
          sizeBytes: 24576,
          execution: { status: 'FAILED' },
        },
      ]);
    mockDb.testRun.findMany.mockResolvedValue([
      { id: 'run-1', name: 'Cycle 1 RC', status: 'IN PROGRESS' },
    ]);

    const req = new NextRequest('http://localhost/api/evidence/gallery?projectId=proj-1');
    const res = await getEvidenceGallery(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].testCase.testCaseId).toBe('TC-AUTH-01');
    expect(body.summary).toEqual({
      totalFiles: 1,
      totalBytes: 24576,
      imageCount: 1,
      videoCount: 0,
      failedEvidenceCount: 1,
      runs: [{ id: 'run-1', name: 'Cycle 1 RC', status: 'IN PROGRESS' }],
    });
  });

  it('renders StorageMaintenanceCard header, SHA-256 button, and backup button without em dashes', () => {
    const html = renderToStaticMarkup(<StorageMaintenanceCard projectId="proj-1" />);
    expect(html).toContain('Storage Integrity &amp; Database Backup');
    expect(html).toContain('Verifikasi Checksum SHA-256');
    expect(html).toContain('Buat Snapshot Backup');
    expect(html).not.toContain('\u2014');
  });

  it('PUT /api/modules updates a module name cleanly', async () => {
    mockDb.module.findUnique.mockResolvedValue({ id: 'mod-1' });
    mockDb.module.update.mockResolvedValue({
      id: 'mod-1',
      name: 'Payment & Settlement',
      projectId: 'proj-1',
      _count: { testCases: 14 },
    });

    const req = new NextRequest('http://localhost/api/modules', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'mod-1', name: '  Payment & Settlement  ' }),
    });
    const res = await putModule(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe('Payment & Settlement');
    expect(mockDb.module.update).toHaveBeenCalledWith({
      where: { id: 'mod-1' },
      data: { name: 'Payment & Settlement' },
      include: { _count: { select: { testCases: true } } },
    });
  });
});
