import { NextRequest, NextResponse } from 'next/server';
import { getSessionByToken, hasMinimumRole, isAllowedRequestOrigin, SESSION_COOKIE, type WorkspaceRole } from '@/lib/auth';
import { db } from '@/lib/db';

const PUBLIC_PATHS = ['/login', '/api/auth/status', '/api/auth/login', '/api/auth/logout', '/api/auth/bootstrap'];
const PROJECT_SCOPED_API = ['/api/activity', '/api/ai', '/api/automation/', '/api/bugfix', '/api/evidence', '/api/excel', '/api/modules', '/api/notifications', '/api/project-knowledge', '/api/reports', '/api/requirements', '/api/stats', '/api/testcases', '/api/test-plans', '/api/test-runs', '/api/traceability'];

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });
}

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.includes(pathname);
}

async function readSmallJson(req: NextRequest) {
  if (!req.headers.get('content-type')?.includes('application/json')) return null;
  if (Number(req.headers.get('content-length') || 0) > 1_000_000) return null;
  return req.clone().json().catch(() => null) as Promise<Record<string, unknown> | null>;
}

async function entityProjectIds(pathname: string, req: NextRequest, body: Record<string, unknown> | null) {
  const ids = new Set<string>();
  const explicit = req.nextUrl.searchParams.get('projectId') || (typeof body?.projectId === 'string' ? body.projectId : '');
  if (explicit) ids.add(explicit);

  const segments = pathname.split('/').filter(Boolean);
  const entityId = segments[2] && !['read-all', 'next-id'].includes(segments[2]) ? segments[2] : '';
  if (pathname.startsWith('/api/reports/') && entityId) {
    const row = await db.report.findUnique({ where: { id: entityId }, select: { projectId: true } });
    if (row) ids.add(row.projectId);
  } else if (pathname.startsWith('/api/requirements/') && entityId) {
    const row = await db.requirement.findUnique({ where: { id: entityId }, select: { projectId: true } });
    if (row) ids.add(row.projectId);
  } else if (pathname.startsWith('/api/test-plans/') && entityId) {
    const row = await db.testPlan.findUnique({ where: { id: entityId }, select: { projectId: true } });
    if (row) ids.add(row.projectId);
  } else if (pathname.startsWith('/api/test-runs/') && entityId) {
    const row = await db.testRun.findUnique({ where: { id: entityId }, select: { projectId: true } });
    if (row) ids.add(row.projectId);
  } else if (pathname.startsWith('/api/notifications/') && entityId) {
    const row = await db.notification.findUnique({ where: { id: entityId }, select: { projectId: true } });
    if (row) ids.add(row.projectId);
  }

  if (pathname === '/api/projects') {
    const projectId = req.nextUrl.searchParams.get('id') || (typeof body?.id === 'string' ? body.id : '');
    if (projectId) ids.add(projectId);
  }

  const rawIds = [
    req.nextUrl.searchParams.get('id') || '',
    ...(req.nextUrl.searchParams.get('ids') || '').split(','),
    ...(Array.isArray(body?.ids) ? body.ids.filter((value): value is string => typeof value === 'string') : []),
    typeof body?.id === 'string' ? body.id : '',
  ].map(value => value.trim()).filter(Boolean);

  if (rawIds.length && pathname === '/api/testcases') {
    const rows = await db.testCase.findMany({ where: { id: { in: rawIds } }, select: { projectId: true }, distinct: ['projectId'] });
    rows.forEach(row => ids.add(row.projectId));
  } else if (rawIds.length && pathname === '/api/bugfix') {
    const rows = await db.bugFix.findMany({ where: { id: { in: rawIds } }, select: { projectId: true }, distinct: ['projectId'] });
    rows.forEach(row => ids.add(row.projectId));
  } else if (rawIds.length && pathname === '/api/modules') {
    const rows = await db.module.findMany({ where: { id: { in: rawIds } }, select: { projectId: true }, distinct: ['projectId'] });
    rows.forEach(row => ids.add(row.projectId));
  }

  if (pathname === '/api/evidence' && !explicit) {
    const requestedId = req.nextUrl.searchParams.get('testCaseId') || '';
    const [testCases, bugs] = await Promise.all([
      db.testCase.findMany({ where: { OR: [{ id: requestedId }, { testCaseId: requestedId }] }, select: { projectId: true } }),
      db.bugFix.findMany({ where: { OR: [{ id: requestedId }, { testCaseId: requestedId }, { sourceTestCaseId: requestedId }] }, select: { projectId: true } }),
    ]);
    [...testCases, ...bugs].forEach(row => ids.add(row.projectId));
  }
  return ids;
}

function requiredRole(pathname: string, method: string): WorkspaceRole {
  if (pathname.startsWith('/api/workspaces')) return 'ADMIN';
  if (pathname === '/api/ai/governance' && method === 'PATCH') return 'ADMIN';
  if (method === 'GET' || method === 'HEAD') return 'VIEWER';
  if (pathname === '/api/projects' || pathname.startsWith('/api/workspaces') || pathname.startsWith('/api/settings/')) return 'ADMIN';
  if (pathname.includes('/finalize')) return 'QA_LEAD';
  return 'QA';
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isPublicPath(pathname)) return NextResponse.next();

  const session = await getSessionByToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    if (pathname.startsWith('/api/')) return jsonError('Authentication required.', 401);
    const login = new URL('/login', req.url);
    login.searchParams.set('next', `${pathname}${req.nextUrl.search}`);
    return NextResponse.redirect(login);
  }

  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !isAllowedRequestOrigin(req.nextUrl, req.headers.get('origin'))) {
    return jsonError('Origin request tidak diizinkan.', 403);
  }

  const body = ['GET', 'HEAD'].includes(req.method) ? null : await readSmallJson(req);
  const projectIds = pathname.startsWith('/api/') ? await entityProjectIds(pathname, req, body) : new Set<string>();
  const memberships = new Map(session.user.memberships.map(item => [item.workspaceId, item]));
  const projects = projectIds.size
    ? await db.project.findMany({ where: { id: { in: [...projectIds] }, deletionState: 'ACTIVE' }, select: { id: true, workspaceId: true } })
    : [];
  if (projectIds.size && projects.length !== projectIds.size) return jsonError('Project tidak ditemukan.', 404);

  const minimumRole = requiredRole(pathname, req.method);
  const projectMemberships = projects.map(project => memberships.get(project.workspaceId)).filter(Boolean);
  if (projects.length && (projectMemberships.length !== projects.length || projectMemberships.some(item => !hasMinimumRole(item!.role, minimumRole)))) {
    return jsonError('Anda tidak memiliki akses yang diperlukan untuk project ini.', 403);
  }

  const scopedWithoutProject = PROJECT_SCOPED_API.some(prefix => pathname === prefix || pathname.startsWith(prefix));
  if (pathname.startsWith('/api/') && scopedWithoutProject && !projectIds.size) return jsonError('Project scope wajib diisi.', 400);

  const selectedMembership = projectMemberships[0] || session.user.memberships.find(item => hasMinimumRole(item.role, minimumRole));
  if (!selectedMembership || !hasMinimumRole(selectedMembership.role, minimumRole)) return jsonError('Workspace role tidak mencukupi.', 403);

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-qa-user-id', session.user.id);
  requestHeaders.set('x-qa-user-email', session.user.email);
  requestHeaders.set('x-qa-user-name', encodeURIComponent(session.user.name));
  requestHeaders.set('x-qa-workspace-id', selectedMembership.workspaceId);
  requestHeaders.set('x-qa-role', selectedMembership.role);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logo.svg|.*\\.(?:png|jpg|jpeg|gif|webp|svg|css|js|woff2?)$).*)'],
};
