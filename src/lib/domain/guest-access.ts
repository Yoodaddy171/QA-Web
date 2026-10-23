export const GUEST_PERMISSIONS = {
  'dashboard.view': 'Melihat dashboard',
  'cases.view': 'Melihat testcase',
  'bugs.view': 'Melihat bug',
  'runs.view': 'Melihat Test Cycle dan hasil execution',
  'traceability.view': 'Melihat traceability',
  'reports.view': 'Melihat report',
  'history.view': 'Melihat history aktivitas project',
  'execution.run': 'Menjalankan testcase dalam cycle yang sudah ada',
  'evidence.view': 'Melihat file evidence execution',
  'evidence.upload': 'Menambah evidence ke execution sendiri',
  'bugs.create': 'Melaporkan bug dari execution FAILED sendiri',
  'data.export': 'Export testcase (Excel/CSV)',
  'reports.export': 'Mengunduh report',
} as const;
export type GuestPermission = keyof typeof GUEST_PERMISSIONS;
export const GUEST_PRESETS: Record<'REVIEWER' | 'TESTER', GuestPermission[]> = {
  REVIEWER: ['dashboard.view', 'cases.view', 'bugs.view', 'runs.view', 'traceability.view', 'reports.view', 'history.view'],
  TESTER: ['dashboard.view', 'cases.view', 'bugs.view', 'runs.view', 'traceability.view', 'history.view', 'execution.run', 'evidence.view', 'evidence.upload', 'bugs.create'],
};
export interface GuestAccess {
  id: string; workspaceId: string; projectIds: string[]; permissions: GuestPermission[]; expiresAt: string;
}
export function isGuestPermission(value: unknown): value is GuestPermission {
  return typeof value === 'string' && Object.hasOwn(GUEST_PERMISSIONS, value);
}
export function permissionDependencies(permission: GuestPermission): GuestPermission[] {
  if (permission === 'execution.run') return ['cases.view', 'runs.view'];
  if (permission === 'evidence.view') return ['runs.view'];
  if (permission === 'evidence.upload') return ['execution.run', 'evidence.view', 'cases.view', 'runs.view'];
  if (permission === 'bugs.create') return ['execution.run', 'bugs.view', 'cases.view', 'runs.view'];
  if (permission === 'data.export') return ['cases.view'];
  if (permission === 'reports.export') return ['reports.view'];
  return [];
}
export function guestCan(access: GuestAccess | null | undefined, permission: GuestPermission) {
  return Boolean(access?.permissions.includes(permission));
}
// Explicit allowlist: unknown routes, raw Devlog, AI, administration and destructive operations fail closed.
export function guestRoutePermission(pathname: string, method: string): GuestPermission | 'common' | null {
  const read = method === 'GET' || method === 'HEAD';
  if (pathname === '/api/projects' && read) return 'common';
  if (/^\/api\/notifications(?:\/[^/]+)?$/.test(pathname) && (read || method === 'PATCH')) return 'common';
  if (read && pathname === '/api/stats') return 'dashboard.view';
  if (read && (pathname === '/api/testcases' || pathname === '/api/modules')) return 'cases.view';
  if (read && pathname === '/api/bugfix') return 'bugs.view';
  if (read && (pathname === '/api/traceability' || /^\/api\/(requirements|test-plans)(\/[^/]+)?$/.test(pathname))) return 'traceability.view';
  if (read && pathname === '/api/activity') return 'history.view';
  if (read && pathname === '/api/excel') return 'data.export';
  if (read && /^\/api\/reports\/[^/]+\/export\/docx$/.test(pathname)) return 'reports.export';
  if (read && /^\/api\/reports(?:\/[^/]+(?:\/versions)?)?$/.test(pathname)) return 'reports.view';
  if (/^\/api\/test-runs\/[^/]+\/executions\/[^/]+\/evidence(?:\/[^/]+)?$/.test(pathname)) {
    return read ? 'evidence.view' : method === 'POST' && pathname.endsWith('/evidence') ? 'evidence.upload' : null;
  }
  if (method === 'POST' && /^\/api\/test-runs\/[^/]+\/executions\/[^/]+\/bug$/.test(pathname)) return 'bugs.create';
  if (method === 'POST' && /^\/api\/test-runs\/[^/]+\/executions$/.test(pathname)) return 'execution.run';
  if (read && /^\/api\/test-runs(?:\/[^/]+(?:\/(?:executions|cases))?)?$/.test(pathname)) return 'runs.view';
  return null;
}

export function guestTabPermission(tab: string): GuestPermission | null {
  return ({ dashboard: 'dashboard.view', testcases: 'cases.view', bugfix: 'bugs.view', testRuns: 'runs.view', traceability: 'traceability.view', reports: 'reports.view' } as Record<string, GuestPermission>)[tab] || null;
}
