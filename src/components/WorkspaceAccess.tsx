'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { roleAllows, workspaceRole, type UiMembership, type UiWorkspaceRole } from '@/lib/client/workspace-permissions';
import { guestCan, type GuestAccess, type GuestPermission } from '@/lib/domain/guest-access';

const AccessContext = createContext({ role: null as UiWorkspaceRole | null, guest: null as GuestAccess | null, actorName: '', ready: false, canEdit: false, canExecute: false, canViewEvidence: false, canUploadEvidence: false, canCreateBug: false, canExport: false, canExportReports: false, canFinalize: false, canAdmin: false, canManageTeam: false, canCreateProject: false });

export function useWorkspacePermissions(workspaceId?: string) {
  const [memberships, setMemberships] = useState<UiMembership[]>([]);
  const [guest, setGuest] = useState<GuestAccess | null>(null);
  const [actorName, setActorName] = useState('');
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    const load = () => {
      void fetch('/api/auth/status', { cache: 'no-store', signal: controller.signal })
        .then(async response => response.ok ? response.json() : null)
        .then(data => {
          if (controller.signal.aborted) return;
          setMemberships(data?.authenticated ? data.user?.memberships || [] : []);
          setGuest(data?.authenticated ? data.user?.guest || null : null);
          setActorName(data?.user?.name || '');
          setReady(true);
          if (data && !data.authenticated) window.location.replace('/login');
        })
        .catch(() => { if (!controller.signal.aborted) setMemberships([]); });
    };
    load();
    window.addEventListener('focus', load);
    return () => { controller.abort(); window.removeEventListener('focus', load); };
  }, [workspaceId]);
  useEffect(() => {
    if (!guest) return;
    const timer = window.setTimeout(() => window.location.replace('/login'), Math.min(2147483647, Math.max(0, new Date(guest.expiresAt).getTime() - Date.now())));
    // Revalidate revocation while the guest stays on an otherwise idle screen.
    const interval = window.setInterval(() => {
      void fetch('/api/auth/status', { cache: 'no-store' }).then(r => r.json()).then(data => { if (!data.authenticated) window.location.replace('/login'); }).catch(() => undefined);
    }, 30000);
    return () => { window.clearTimeout(timer); window.clearInterval(interval); };
  }, [guest]);
  const role = workspaceRole(memberships, workspaceId);
  // Existing unscoped team endpoint resolves the first ADMIN+ membership.
  // Never expose that other workspace's administration under the selected one.
  const teamWorkspaceId = memberships.find(item => roleAllows(workspaceRole([item], item.workspace.id), 'ADMIN'))?.workspace.id;
  const canEdit = !guest && roleAllows(role);
  return { role, guest, actorName, ready, canEdit, canExecute: canEdit || guestCan(guest, 'execution.run'), canViewEvidence: !guest || guestCan(guest, 'evidence.view'), canUploadEvidence: canEdit || guestCan(guest, 'evidence.upload'), canCreateBug: canEdit || guestCan(guest, 'bugs.create'), canExport: !guest || guestCan(guest, 'data.export'), canExportReports: !guest || guestCan(guest, 'reports.export'), canFinalize: !guest && roleAllows(role, 'QA_LEAD'), canAdmin: !guest && roleAllows(role, 'ADMIN'), canManageTeam: !guest && roleAllows(role, 'ADMIN') && teamWorkspaceId === workspaceId,
    // Preserve first-project onboarding without granting editing in an unknown workspace.
    canCreateProject: !guest && Boolean(teamWorkspaceId) && (!workspaceId || teamWorkspaceId === workspaceId) };
}

export function WorkspaceAccessProvider({ value, children }: { value: ReturnType<typeof useWorkspacePermissions>; children: ReactNode }) {
  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}

export const useWorkspaceAccess = () => useContext(AccessContext);

export function MutationAction({ children, minimum = 'QA', guestPermission }: { children: ReactNode; minimum?: UiWorkspaceRole; guestPermission?: GuestPermission }) {
  const { role, guest } = useWorkspaceAccess();
  return (guest ? Boolean(guestPermission && guestCan(guest, guestPermission)) : roleAllows(role, minimum)) ? children : null;
}
