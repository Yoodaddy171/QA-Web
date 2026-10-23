import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => Object.fromEntries([
  'testCase', 'module', 'bugFix', 'testRun', 'activityHistory', 'testExecution',
  'guestAccessGrant', 'workspaceMembership', 'requirement', 'testPlan',
].map(name => [name, { findMany: vi.fn() }])));
vi.mock('@/lib/db', () => ({ db }));
import { getProjectStats } from './stats-service';

beforeEach(() => {
  vi.clearAllMocks();
  for (const model of Object.values(db)) model.findMany.mockResolvedValue([]);
});

describe('recent activity entity labels', () => {
  it('resolves only recent project-scoped identities without fetching credentials', async () => {
    const types = ['TestExecution', 'GuestAccessGrant', 'WorkspaceMembership', 'Requirement', 'TestPlan', 'TestRun'];
    db.activityHistory.findMany.mockResolvedValue(types.map(entityType => ({ id: entityType, entityType, entityId: `id-${entityType}` })));
    db.testExecution.findMany.mockResolvedValue([{ id: 'id-TestExecution', testCase: { testCaseId: 'AUTH-001' }, testRun: { name: 'Smoke Test' } }]);
    db.guestAccessGrant.findMany.mockResolvedValue([{ id: 'id-GuestAccessGrant', label: 'Review di HP' }]);
    db.workspaceMembership.findMany.mockResolvedValue([{ id: 'id-WorkspaceMembership', user: { name: 'Tester A' } }]);
    db.requirement.findMany.mockResolvedValue([{ id: 'id-Requirement', title: 'Login' }]);
    db.testPlan.findMany.mockResolvedValue([{ id: 'id-TestPlan', name: 'Regression' }]);
    db.testRun.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: 'id-TestRun', name: 'Archived run' }]);
    const result = await getProjectStats('project-a');
    expect(result.recentActivities.map(item => item.entityLabel)).toEqual(['AUTH-001 · Smoke Test', 'Review di HP', 'Tester A', 'Login', 'Regression', 'Archived run']);
    expect(db.testExecution.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { in: ['id-TestExecution'] }, testRun: { projectId: 'project-a' }, testCase: { projectId: 'project-a' } } }));
    expect(db.guestAccessGrant.findMany).toHaveBeenCalledWith({ where: { id: { in: ['id-GuestAccessGrant'] }, projects: { some: { projectId: 'project-a' } } }, select: { id: true, label: true } });
    expect(db.workspaceMembership.findMany).toHaveBeenCalledWith({ where: { id: { in: ['id-WorkspaceMembership'] }, workspace: { projects: { some: { id: 'project-a' } } } }, select: { id: true, user: { select: { name: true } } } });
    expect(db.requirement.findMany).toHaveBeenCalledWith({ where: { id: { in: ['id-Requirement'] }, projectId: 'project-a' }, select: { id: true, title: true } });
    expect(db.testPlan.findMany).toHaveBeenCalledWith({ where: { id: { in: ['id-TestPlan'] }, projectId: 'project-a' }, select: { id: true, name: true } });
  });

  it('does not query unrelated inventories for an empty feed', async () => {
    expect((await getProjectStats('project-a')).recentActivities).toEqual([]);
    for (const name of ['testExecution', 'guestAccessGrant', 'workspaceMembership', 'requirement', 'testPlan']) expect(db[name].findMany).not.toHaveBeenCalled();
  });

  it('preserves unresolved and deleted audit events without manufacturing identities', async () => {
    const item = { id: 'a', entityType: 'TestCase', entityId: 'deleted', action: 'DELETED', beforeValue: { testCaseId: 'AUTH-009' } };
    db.activityHistory.findMany.mockResolvedValue([item]);
    expect((await getProjectStats('project-a')).recentActivities).toEqual([{ ...item, entityLabel: null }]);
    expect(db.activityHistory.findMany).toHaveBeenCalledWith(expect.objectContaining({ select: expect.objectContaining({ beforeValue: true }) }));
  });
});
