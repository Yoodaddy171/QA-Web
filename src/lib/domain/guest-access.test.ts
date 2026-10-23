import { describe, expect, it } from 'vitest';
import { GUEST_PERMISSIONS, GUEST_PRESETS, guestRoutePermission, guestTabPermission, permissionDependencies, isGuestPermission } from './guest-access';

describe('guest explicit permission policy', () => {
  it.each(Object.entries(GUEST_PRESETS))('%s preset has complete dependencies and only known permissions', (_, permissions) => {
    expect(permissions.every(isGuestPermission)).toBe(true);
    for (const permission of permissions) expect(permissionDependencies(permission).every(dep => permissions.includes(dep))).toBe(true);
  });
  it.each(['/api/settings/ai', '/api/ai/chat', '/api/workspaces/members', '/api/evidence', '/api/relay/logs', '/api/new-unknown-route', '/api/automation/history'])('denies %s by default', route => {
    expect(guestRoutePermission(route, 'GET')).toBeNull(); expect(guestRoutePermission(route, 'POST')).toBeNull();
  });
  it('separates execution from administration, overwrite, bulk execution and deletion', () => {
    expect(guestRoutePermission('/api/test-runs/run/executions', 'POST')).toBe('execution.run');
    expect(guestRoutePermission('/api/test-runs/run/cases', 'GET')).toBe('runs.view');
    expect(guestRoutePermission('/api/test-runs/run/executions', 'PUT')).toBeNull();
    expect(guestRoutePermission('/api/test-runs/run/executions/bulk', 'POST')).toBeNull();
    expect(guestRoutePermission('/api/test-runs/run/executions/ex/evidence', 'DELETE')).toBeNull();
    expect(guestRoutePermission('/api/test-runs', 'POST')).toBeNull();
  });
  it('requires a separate export permission, while preview already discloses file bytes', () => {
    expect(guestRoutePermission('/api/excel', 'GET')).toBe('data.export');
    expect(guestRoutePermission('/api/reports/report/export/docx', 'GET')).toBe('reports.export');
    expect(guestRoutePermission('/api/test-runs/run/executions/ex/evidence/file', 'GET')).toBe('evidence.view');
    expect(GUEST_PRESETS.REVIEWER).not.toContain('data.export');
  });
  it('never offers an admin or raw-capture navigation tab', () => {
    expect(guestTabPermission('settings')).toBeNull(); expect(guestTabPermission('automated')).toBeNull();
    expect(guestTabPermission('testRuns')).toBe('runs.view');
    expect(Object.keys(GUEST_PERMISSIONS)).toHaveLength(13);
  });
});
