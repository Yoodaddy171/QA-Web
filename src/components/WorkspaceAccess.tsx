'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { roleAllows, workspaceRole, type UiMembership, type UiWorkspaceRole } from '@/lib/client/workspace-permissions';

const AccessContext = createContext({ role: null as UiWorkspaceRole | null, canEdit: false, canFinalize: false, canAdmin: false, canManageTeam: false, canCreateProject: false });

export function useWorkspacePermissions(workspaceId?: string) {
  const [memberships, setMemberships] = useState<UiMembership[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    const load = () => {
      void fetch('/api/auth/status', { cache: 'no-store', signal: controller.signal })
        .then(async response => response.ok ? response.json() : null)
        .then(data => { if (!controller.signal.aborted) setMemberships(data?.authenticated ? data.user?.memberships || [] : []); })
        .catch(() => { if (!controller.signal.aborted) setMemberships([]); });
    };
    load();
    window.addEventListener('focus', load);
    return () => { controller.abort(); window.removeEventListener('focus', load); };
  }, [workspaceId]);
  const role = workspaceRole(memberships, workspaceId);
  // Existing unscoped team endpoint resolves the first ADMIN+ membership.
  // Never expose that other workspace's administration under the selected one.
  const teamWorkspaceId = memberships.find(item => roleAllows(workspaceRole([item], item.workspace.id), 'ADMIN'))?.workspace.id;
  return { role, canEdit: roleAllows(role), canFinalize: roleAllows(role, 'QA_LEAD'), canAdmin: roleAllows(role, 'ADMIN'), canManageTeam: roleAllows(role, 'ADMIN') && teamWorkspaceId === workspaceId,
    // Preserve first-project onboarding without granting editing in an unknown workspace.
    canCreateProject: Boolean(teamWorkspaceId) && (!workspaceId || teamWorkspaceId === workspaceId) };
}

export function WorkspaceAccessProvider({ value, children }: { value: ReturnType<typeof useWorkspacePermissions>; children: ReactNode }) {
  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}

export const useWorkspaceAccess = () => useContext(AccessContext);

export function MutationAction({ children, minimum = 'QA' }: { children: ReactNode; minimum?: UiWorkspaceRole }) {
  const { role } = useWorkspaceAccess();
  return roleAllows(role, minimum) ? children : null;
}
