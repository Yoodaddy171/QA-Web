export type UiWorkspaceRole = 'VIEWER' | 'QA' | 'QA_LEAD' | 'ADMIN' | 'OWNER';
export interface UiMembership { role: string; workspace: { id: string; name?: string } }
const rank: Record<UiWorkspaceRole, number> = { VIEWER: 0, QA: 1, QA_LEAD: 2, ADMIN: 3, OWNER: 4 };

// UI affordances only. The server remains the authorization boundary.
export function workspaceRole(memberships: UiMembership[], workspaceId?: string): UiWorkspaceRole | null {
  const role = memberships.find(item => item.workspace.id === workspaceId)?.role;
  return role && Object.hasOwn(rank, role) ? role as UiWorkspaceRole : null;
}
export function roleAllows(role: UiWorkspaceRole | null, minimum: UiWorkspaceRole = 'QA') {
  return role !== null && rank[role] >= rank[minimum];
}
