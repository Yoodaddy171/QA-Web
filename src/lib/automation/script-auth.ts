import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionByToken, hasMinimumRole, isAllowedRequestOrigin, SESSION_COOKIE } from '@/lib/auth';
import { MutationError } from '@/lib/services/mutation-error';
import { runnerRoot } from '@/lib/automation/script-store.mjs';

export async function authorizeScriptRequest(req: NextRequest) {
  const session = await getSessionByToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) throw new MutationError(401, 'Silakan masuk kembali.');
  if (session.guest || session.user.isGuest) throw new MutationError(403, 'Akses tamu tidak dapat menjalankan atau membaca script.');
  const projectId = req.nextUrl.searchParams.get('projectId') || '';
  const testCaseId = req.nextUrl.searchParams.get('testCaseId') || '';
  if (!projectId || !testCaseId) throw new MutationError(400, 'Project dan testcase wajib diisi.');
  const project = await db.project.findFirst({ where: { id: projectId, deletionState: 'ACTIVE' }, select: { workspaceId: true } });
  const member = session.user.memberships.find(item => item.workspaceId === project?.workspaceId);
  if (!project || !member || !hasMinimumRole(member.role, 'ADMIN')) throw new MutationError(403, 'Hanya owner/admin project ini yang dapat mengelola script.');
  const testCase = await db.testCase.findFirst({ where: { id: testCaseId, projectId }, select: { id: true } });
  if (!testCase) throw new MutationError(404, 'Testcase tidak ditemukan dalam project ini.');
  if (!['GET', 'HEAD'].includes(req.method) && !isAllowedRequestOrigin(req.nextUrl, req.headers.get('origin'), req.headers.get('host'))) throw new MutationError(403, 'Origin request tidak diizinkan.');
  return { projectId, testCaseId, root: runnerRoot(), actor: session.user.name };
}
