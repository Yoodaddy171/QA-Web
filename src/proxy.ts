import { NextRequest, NextResponse } from 'next/server';
import { getSessionByToken, hasMinimumRole, isAllowedRequestOrigin, SESSION_COOKIE, type WorkspaceRole } from '@/lib/auth';
import { db } from '@/lib/db';
import { guestRoutePermission } from '@/lib/domain/guest-access';

const PUBLIC_PATHS = ['/login', '/api/auth/status', '/api/auth/login', '/api/auth/logout', '/api/auth/bootstrap', '/api/auth/guest'];
const PROJECT_SCOPED_API = ['/api/activity', '/api/ai', '/api/automation', '/api/bugfix', '/api/evidence', '/api/excel', '/api/modules', '/api/notifications', '/api/project-knowledge', '/api/reports', '/api/requirements', '/api/stats', '/api/testcases', '/api/test-plans', '/api/test-runs', '/api/traceability'];
class RequestGuardError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });
}

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.includes(pathname);
}

async function readSmallJson(req: NextRequest, pathname: string) {
  if (!req.body) return null;
  const contentType = req.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  // Multipart handlers validate their nested IDs; Excel also binds the form
  // project to the query project authorized here. Never skip a JSON handler's body.
  if (contentType === 'multipart/form-data' && (pathname === '/api/excel'
    || /^\/api\/test-runs\/[^/]+\/executions\/[^/]+\/evidence$/.test(pathname))) return null;
  if (contentType !== 'application/json') throw new RequestGuardError(415, 'Content-Type application/json diperlukan.');
  if (Number(req.headers.get('content-length') || 0) > 1_000_000) throw new RequestGuardError(413, 'Body JSON terlalu besar.');
  const reader = req.clone().body!.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    size += chunk.value.byteLength;
    if (size > 1_000_000) {
      void reader.cancel().catch(() => undefined);
      throw new RequestGuardError(413, 'Body JSON terlalu besar.');
    }
    chunks.push(chunk.value);
  }
  try {
    const body: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('object required');
    return body as Record<string, unknown>;
  } catch { throw new RequestGuardError(400, 'Body JSON tidak valid.'); }
}

async function entityProjectIds(pathname: string, req: NextRequest, body: Record<string, unknown> | null) {
  const ids = new Set<string>();
  const explicit = [...req.nextUrl.searchParams.getAll('projectId'), typeof body?.projectId === 'string' ? body.projectId : ''].filter(Boolean);
  explicit.forEach(id => ids.add(id));

  // Decode each resource segment without turning an encoded slash inside an ID
  // into a route separator. Next supplies that entire decoded ID to the handler.
  const segments = pathname.split('/').filter(Boolean).map(segment => decodeURIComponent(segment));
  // Only notifications/read-all is a collection action here. Those words are
  // valid custom IDs on other dynamic resources and still require ownership.
  const entityId = segments[2] && !(segments[1] === 'notifications' && segments[2] === 'read-all') ? segments[2] : '';
  if (pathname.startsWith('/api/reports/') && entityId) {
    const row = await db.report.findUnique({ where: { id: entityId }, select: { projectId: true } });
    if (!row) throw new RequestGuardError(404, 'Report tidak ditemukan.');
    ids.add(row.projectId);
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

  if (pathname === '/api/evidence' && !explicit.length) {
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
  if (pathname === '/api/automation/scripts') return 'ADMIN';
  if (pathname.startsWith('/api/workspaces')) return 'ADMIN';
  if (pathname === '/api/ai/governance' && method === 'PATCH') return 'ADMIN';
  if (method === 'GET' || method === 'HEAD') return 'VIEWER';
  if (pathname === '/api/projects' || pathname.startsWith('/api/workspaces') || pathname.startsWith('/api/settings/')) return 'ADMIN';
  if (pathname.includes('/finalize')) return 'QA_LEAD';
  return 'QA';
}

export async function proxy(req: NextRequest) {
  try { return await authorizeRequest(req); }
  catch (error) {
    if (error instanceof RequestGuardError) return jsonError(error.message, error.status);
    console.error('Authorization check failed', { name: error instanceof Error ? error.name : 'unknown' });
    return jsonError('Pemeriksaan akses gagal.', 500);
  }
}

async function authorizeRequest(req: NextRequest) {
  let pathname: string;
  try { pathname = req.nextUrl.pathname.split('/').map(segment => encodeURIComponent(decodeURIComponent(segment))).join('/'); }
  catch { throw new RequestGuardError(400, 'Path tidak valid.'); }
  if (isPublicPath(pathname)) return NextResponse.next();

  const session = await getSessionByToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    if (pathname.startsWith('/api/')) return jsonError('Authentication required.', 401);
    const login = new URL('/login', req.url);
    login.searchParams.set('next', `${pathname}${req.nextUrl.search}`);
    return NextResponse.redirect(login);
  }

  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !isAllowedRequestOrigin(req.nextUrl, req.headers.get('origin'), req.headers.get('host'))) {
    return jsonError('Origin request tidak diizinkan.', 403);
  }

  const body = ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? null : await readSmallJson(req, pathname);
  if (['GET', 'HEAD'].includes(req.method) && ['/api/testcases', '/api/bugfix', '/api/modules'].includes(pathname)
    && !req.nextUrl.searchParams.get('projectId')) return jsonError('Project scope wajib diisi.', 400);
  const projectIds = pathname.startsWith('/api/') ? await entityProjectIds(pathname, req, body) : new Set<string>();
  if (session.guest) {
    const guest = session.guest;
    if (pathname.startsWith('/api/')) {
      const permission = guestRoutePermission(pathname, req.method);
      if (!permission || (permission !== 'common' && !guest.permissions.includes(permission))) return jsonError('Akses tamu tidak memiliki izin untuk tindakan ini.', 403);
      if (pathname !== '/api/projects' && !projectIds.size) return jsonError('Project scope wajib diisi.', 400);
      if ([...projectIds].some(id => !guest.projectIds.includes(id))) return jsonError('Project di luar cakupan akses tamu.', 403);
      if (permission === 'evidence.upload' || permission === 'bugs.create') {
        const executionId = decodeURIComponent(pathname.split('/')[5] || '');
        const owned = await db.activityHistory.findFirst({ where: { entityType: 'TestExecution', entityId: executionId, action: 'CREATED', actorUserId: session.user.id, projectId: { in: guest.projectIds } }, select: { id: true } });
        if (!owned) return jsonError('Tamu hanya dapat menambah evidence atau melaporkan bug dari execution sendiri.', 403);
      }
    } else {
      const segments = pathname.split('/').filter(Boolean);
      if (segments[0] === 'projects' && !guest.projectIds.includes(decodeURIComponent(segments[1] || ''))) return jsonError('Project di luar cakupan akses tamu.', 403);
    }
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('x-qa-user-id', session.user.id);
    requestHeaders.set('x-qa-user-email', session.user.email);
    requestHeaders.set('x-qa-user-name', encodeURIComponent(session.user.name));
    requestHeaders.set('x-qa-workspace-id', guest.workspaceId);
    requestHeaders.set('x-qa-role', 'VIEWER');
    requestHeaders.set('x-qa-guest-access', encodeURIComponent(JSON.stringify(guest)));
    return NextResponse.next({ request: { headers: requestHeaders } });
  }
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

  const scopedWithoutProject = PROJECT_SCOPED_API.some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`));
  if (pathname.startsWith('/api/') && scopedWithoutProject && !projectIds.size) return jsonError('Project scope wajib diisi.', 400);

  const selectedMembership = projectMemberships[0] || session.user.memberships.find(item => hasMinimumRole(item.role, minimumRole));
  if (!selectedMembership || !hasMinimumRole(selectedMembership.role, minimumRole)) return jsonError('Workspace role tidak mencukupi.', 403);

  const requestHeaders = new Headers(req.headers);
  requestHeaders.delete('x-qa-guest-access');
  requestHeaders.set('x-qa-user-id', session.user.id);
  requestHeaders.set('x-qa-user-email', session.user.email);
  requestHeaders.set('x-qa-user-name', encodeURIComponent(session.user.name));
  requestHeaders.set('x-qa-workspace-id', selectedMembership.workspaceId);
  requestHeaders.set('x-qa-role', selectedMembership.role);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ['/api/:path*', '/((?!_next/static|_next/image|favicon.ico|logo.svg|.*\\.(?:png|jpg|jpeg|gif|webp|svg|css|js|woff2?)$).*)'],
};
