import crypto from 'node:crypto';
import { db } from '@/lib/db';
import { hashSessionToken, hasMinimumRole, SESSION_TTL_MS } from '@/lib/auth';
import { isGuestPermission, permissionDependencies, type GuestPermission } from '@/lib/domain/guest-access';
import { MutationError } from './mutation-error';

const summary = { id: true, label: true, preset: true, permissions: true, expiresAt: true, maxUses: true, usedCount: true, revokedAt: true, lastUsedAt: true, createdAt: true,
  projects: { select: { project: { select: { id: true, name: true } } } } } as const;

async function requireAdmin(userId: string, workspaceId: string) {
  const membership = await db.workspaceMembership.findUnique({ where: { workspaceId_userId: { workspaceId, userId } }, include: { user: true } });
  if (!membership || membership.user.disabledAt || membership.user.isGuest || !hasMinimumRole(membership.role, 'ADMIN')) throw new MutationError(403, 'Admin permanen pada workspace ini diperlukan.');
  return membership.user;
}
export async function listGuestAccess(userId: string, workspaceId: string) {
  await requireAdmin(userId, workspaceId);
  return db.guestAccessGrant.findMany({ where: { workspaceId }, select: summary, orderBy: { createdAt: 'desc' }, take: 100 });
}
export async function createGuestAccess(userId: string, input: Record<string, unknown>) {
  const workspaceId = typeof input.workspaceId === 'string' ? input.workspaceId : '';
  const issuer = await requireAdmin(userId, workspaceId);
  const label = typeof input.label === 'string' ? input.label.trim() : '';
  const projectIds = Array.isArray(input.projectIds) ? [...new Set(input.projectIds.filter((id): id is string => typeof id === 'string' && Boolean(id)))] : [];
  const permissions = Array.isArray(input.permissions) ? [...new Set(input.permissions)] : [];
  const hours = Number(input.expiresInHours), maxUses = Number(input.maxUses);
  if (!label || label.length > 100 || !projectIds.length || projectIds.length > 50) throw new MutationError(400, 'Label dan minimal satu project wajib dipilih.');
  if (!permissions.length || !permissions.every(isGuestPermission)) throw new MutationError(400, 'Pilih minimal satu permission yang valid.');
  const selected = permissions as GuestPermission[];
  if (!selected.some(p => ['dashboard.view', 'cases.view', 'runs.view', 'bugs.view', 'reports.view', 'traceability.view'].includes(p))) throw new MutationError(400, 'Pilih minimal satu halaman yang boleh diakses.');
  if (selected.some(p => permissionDependencies(p).some(dependency => !selected.includes(dependency)))) throw new MutationError(400, 'Permission pendukung belum lengkap. Pilih preset atau lengkapi izin baca/execute.');
  if (!Number.isInteger(hours) || hours < 1 || hours > 720 || !Number.isInteger(maxUses) || maxUses < 1 || maxUses > 100) throw new MutationError(400, 'Masa aktif 1–720 jam dan batas penukaran 1–100 diperlukan.');
  const token = crypto.randomBytes(32).toString('base64url');
  return db.$transaction(async tx => {
    const projects = await tx.project.findMany({ where: { id: { in: projectIds }, workspaceId, deletionState: 'ACTIVE' }, select: { id: true } });
    if (projects.length !== projectIds.length) throw new MutationError(403, 'Semua project harus berada pada workspace aktif Anda.');
    // A non-login technical identity preserves audit/notification foreign keys without workspace membership.
    const identityId = crypto.randomUUID();
    const guest = await tx.user.create({ data: { id: identityId, name: `Guest: ${label} [${identityId.slice(0, 8)}]`, email: `${identityId}@guest.traceva.invalid`, passwordHash: '!', isGuest: true } });
    const grant = await tx.guestAccessGrant.create({ data: { workspaceId, creatorId: userId, guestUserId: guest.id, label,
      preset: input.preset === 'TESTER' ? 'TESTER' : input.preset === 'REVIEWER' ? 'REVIEWER' : 'CUSTOM', permissions: selected,
      tokenHash: hashSessionToken(token), expiresAt: new Date(Date.now() + hours * 3600000), maxUses,
      projects: { create: projectIds.map(projectId => ({ projectId })) } }, select: summary });
    await tx.activityHistory.createMany({ data: projectIds.map(projectId => ({ projectId, entityType: 'GuestAccessGrant', entityId: grant.id, action: 'CREATED', actor: issuer.name, actorUserId: userId, afterValue: { label, permissions: selected, expiresAt: grant.expiresAt.toISOString() } })) });
    return { grant, token };
  });
}
export async function revokeGuestAccess(userId: string, workspaceId: string, id: string) {
  const issuer = await requireAdmin(userId, workspaceId);
  return db.$transaction(async tx => {
    const current = await tx.guestAccessGrant.findFirst({ where: { id, workspaceId }, include: { projects: true } });
    if (!current) throw new MutationError(404, 'Akses tamu tidak ditemukan.');
    if (current.revokedAt) return { revoked: true };
    await tx.guestAccessGrant.update({ where: { id }, data: { revokedAt: new Date() } });
    await tx.session.deleteMany({ where: { userId: current.guestUserId } });
    await tx.activityHistory.createMany({ data: current.projects.map(({ projectId }) => ({ projectId, entityType: 'GuestAccessGrant', entityId: id, action: 'REVOKED', actor: issuer.name, actorUserId: userId })) });
    return { revoked: true };
  });
}
export async function redeemGuestAccess(raw: unknown) {
  const token = typeof raw === 'string' ? raw.trim() : '';
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new MutationError(401, 'Token tidak valid, kedaluwarsa, dicabut, atau batas penukaran tercapai.');
  const now = new Date();
  return db.$transaction(async tx => {
    const grant = await tx.guestAccessGrant.findUnique({ where: { tokenHash: hashSessionToken(token) }, include: { guestUser: true, projects: { include: { project: true } } } });
    if (!grant || grant.revokedAt || grant.expiresAt <= now || grant.usedCount >= grant.maxUses || grant.guestUser.disabledAt || !grant.guestUser.isGuest || !grant.projects.some(p => p.project.deletionState === 'ACTIVE')) throw new MutationError(401, 'Token tidak valid, kedaluwarsa, dicabut, atau batas penukaran tercapai.');
    // Conditional claim + session + audit commit together; no redeem slot is consumed on rollback.
    const claimed = await tx.guestAccessGrant.updateMany({ where: { id: grant.id, revokedAt: null, expiresAt: { gt: now }, usedCount: { lt: grant.maxUses } }, data: { usedCount: { increment: 1 }, lastUsedAt: now } });
    if (claimed.count !== 1) throw new MutationError(409, 'Token sudah digunakan. Minta token baru dari admin.');
    const sessionToken = crypto.randomBytes(32).toString('base64url');
    const expiresAt = new Date(Math.min(now.getTime() + SESSION_TTL_MS, grant.expiresAt.getTime()));
    await tx.session.create({ data: { userId: grant.guestUserId, tokenHash: hashSessionToken(sessionToken), expiresAt } });
    const activeProjects = grant.projects.filter(p => p.project.deletionState === 'ACTIVE' && p.project.workspaceId === grant.workspaceId);
    if (!activeProjects.length) throw new MutationError(401, 'Project pada akses tamu tidak lagi tersedia.');
    await tx.activityHistory.createMany({ data: activeProjects.map(({ projectId }) => ({ projectId, entityType: 'GuestAccessGrant', entityId: grant.id, action: 'REDEEMED', actor: grant.guestUser.name, actorUserId: grant.guestUserId })) });
    return { token: sessionToken, expiresAt, projectId: activeProjects[0].projectId };
  }, { isolationLevel: 'Serializable' });
}
