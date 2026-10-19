import { describe, expect, it } from 'vitest';
import { roleAllows, workspaceRole, type UiWorkspaceRole } from './workspace-permissions';

describe('P71-ROLE: workspace-scoped UI affordances', () => {
  it.each([
    ['VIEWER', false, false, false], ['QA', true, false, false],
    ['QA_LEAD', true, true, false], ['ADMIN', true, true, true], ['OWNER', true, true, true],
  ] as const)('%s retains its backend permission tier', (role, edit, finalize, admin) => {
    expect(roleAllows(role)).toBe(edit);
    expect(roleAllows(role, 'QA_LEAD')).toBe(finalize);
    expect(roleAllows(role, 'ADMIN')).toBe(admin);
  });
  it('never borrows ADMIN in A for VIEWER in B', () => {
    const memberships = [{ role: 'ADMIN', workspace: { id: 'A' } }, { role: 'VIEWER', workspace: { id: 'B' } }];
    expect(roleAllows(workspaceRole(memberships, 'A'))).toBe(true);
    expect(roleAllows(workspaceRole(memberships, 'B'))).toBe(false);
    expect(workspaceRole(memberships, 'missing')).toBeNull();
    expect(workspaceRole(memberships, undefined)).toBeNull();
  });
  it('fails closed while unknown, unauthenticated, or given an invalid role', () => {
    expect(workspaceRole([], 'A')).toBeNull();
    expect(workspaceRole([{ role: 'SUPERUSER', workspace: { id: 'A' } }], 'A')).toBeNull();
    for (const role of ['VIEWER', 'QA', 'QA_LEAD', 'ADMIN', 'OWNER'] as UiWorkspaceRole[]) expect(roleAllows(null, role)).toBe(false);
  });
});
