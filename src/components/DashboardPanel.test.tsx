import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';
import { DashboardPanel, type DashboardStats } from './DashboardPanel';

const mockStats: DashboardStats = {
  totalTestCases: 100,
  doneCount: 75,
  notDoneCount: 15,
  inProgressCount: 5,
  blockedCount: 3,
  failedCount: 2,
  readyToRetestCount: 4,
  tbaCount: 1,
  bugFixTotal: 5,
  bugFixReported: 3,
  bugFixFixing: 1,
  bugFixReadyRetest: 1,
  bugFixFixed: 0,
  positiveCount: 80,
  negativeCount: 20,
  criticalCount: 1,
  highCount: 2,
  mediumCount: 10,
  lowCount: 87,
  overallProgress: 75,
  moduleData: [],
  pageGroups: [{ page: 'Login', _count: { id: 10 } }],
  weightMap: {},
  menuProgress: [],
  moduleProgress: [
    {
      id: 'mod-1',
      name: 'Auth Module',
      totalMenus: 1,
      totalCases: 20,
      totalDone: 15,
      avgProgress: 75,
      menus: [
        {
          page: 'Login',
          subMenu: 'Form',
          totalCases: 20,
          weightPerCase: 1,
          progressPercent: 75,
          doneCount: 15,
          inProgressCount: 2,
          notDoneCount: 2,
          blockedCount: 1,
          failedCount: 0,
          readyToRetestCount: 0,
          tbaCount: 0,
          activeCount: 2,
        },
      ],
    },
  ],
  ungroupedProgress: null,
  retestQueue: [
    {
      id: 'rq-1',
      testCaseId: 'TC-001',
      page: 'Login',
      subMenu: null,
      priority: 'High',
      moduleName: 'Auth Module',
      updatedAt: new Date().toISOString(),
      waitingDays: 3,
    },
  ],
  bugAging: [
    {
      id: 'bg-1',
      testCaseId: 'TC-002',
      page: 'Login',
      subMenu: null,
      testAction: 'Login gagal ketika email kosong',
      priority: 'Critical',
      status: 'REPORTED',
      moduleName: 'Auth Module',
      startedAt: new Date().toISOString(),
      ageDays: 8,
    },
  ],
  moduleRisks: [
    {
      moduleId: 'mod-1',
      moduleName: 'Auth Module',
      total: 20,
      failed: 2,
      readyToRetest: 1,
      inProgress: 2,
      blocked: 1,
      notDone: 2,
      riskScore: 65,
    },
  ],
  releaseReadiness: {
    recommendation: 'NOT READY',
    testRunId: 'tr-1',
    testRunName: 'Cycle 1 Release Candidate',
    testRunStatus: 'IN PROGRESS',
    totalCases: 50,
    completedCases: 35,
    passedCases: 30,
    progress: 70,
    failedCases: 3,
    blockedCases: 2,
    notRunCases: 15,
    criticalBugs: 1,
    openBugs: 3,
    reason: 'Terdapat 3 kasus gagal dan 1 bug kritis aktif',
  },
  recentActivities: [
    {
      id: 'act-1',
      entityType: 'TestCase',
      entityId: 'tc-1',
      entityLabel: 'TC-001',
      action: 'UPDATED',
      field: 'status',
      afterValue: 'FAILED',
      actor: 'Tester Bob',
      createdAt: new Date().toISOString(),
    },
  ],
};

describe('DashboardPanel', () => {
  it('renders empty state when stats is null', () => {
    const html = renderToStaticMarkup(
      <DashboardPanel
        stats={null}
        modules={[]}
        expandedModules={new Set()}
        setExpandedModules={vi.fn()}
        selectedModuleFilter="all"
        setSelectedModuleFilter={vi.fn()}
        onOpenDetail={vi.fn()}
      />
    );

    expect(html).toContain('Pilih project untuk melihat dashboard');
  });

  it('renders verdict headline, recommendation badge, and info hint', () => {
    const html = renderToStaticMarkup(
      <DashboardPanel
        stats={mockStats}
        modules={[]}
        expandedModules={new Set()}
        setExpandedModules={vi.fn()}
        selectedModuleFilter="all"
        setSelectedModuleFilter={vi.fn()}
        onOpenDetail={vi.fn()}
      />
    );

    expect(html).toContain('Release belum siap');
    expect(html).toContain('Release decision');
    expect(html).toContain('NOT READY');
    expect(html).toContain('Pass execution tidak otomatis menandai Bug terverifikasi');
    expect(html).toContain('75%');
  });

  it('renders operational action queues and risk modules', () => {
    const html = renderToStaticMarkup(
      <DashboardPanel
        stats={mockStats}
        modules={[]}
        expandedModules={new Set()}
        setExpandedModules={vi.fn()}
        selectedModuleFilter="all"
        setSelectedModuleFilter={vi.fn()}
        onOpenDetail={vi.fn()}
      />
    );

    expect(html).toContain('Yang Menahan Rilis');
    expect(html).toContain('TC-001');
    expect(html).toContain('waiting 3d');
    expect(html).toContain('Radar Risiko Modul');
    expect(html).toContain('Auth Module');
    expect(html).toContain('Distribusi Status Skenario');
    expect(html).toContain('Kasus per Tingkat Prioritas');
  });
});
