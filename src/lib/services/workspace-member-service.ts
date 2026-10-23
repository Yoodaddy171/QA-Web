import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { hashPassword, hasMinimumRole, isWorkspaceRole, normalizeEmail, validatePassword } from '@/lib/auth';
import { MutationError, nextMutationTime } from './mutation-error';

const memberSelect = {
  id: true, role: true, createdAt: true, updatedAt: true,
  user: { select: { id: true, name: true, email: true, disabledAt: true, updatedAt: true, isGuest: true, _count: { select: { memberships: true } } } },
} as const;
type Member = Prisma.WorkspaceMembershipGetPayload<{ select: typeof memberSelect }>;
type Tx = Prisma.TransactionClient;
const activeOwnerWhere = (workspaceId: string) => ({ workspaceId, role: 'OWNER', user: { disabledAt: null, isGuest: false } });

async function requireAdmin(tx: Tx, userId: string, workspaceId: string) {
  const actor = await tx.workspaceMembership.findUnique({ where: { workspaceId_userId: { workspaceId, userId } }, include: { user: true } });
  if (!actor || actor.user.disabledAt || actor.user.isGuest || !hasMinimumRole(actor.role, 'ADMIN')) throw new MutationError(403, 'Admin aktif pada workspace ini diperlukan.');
  return actor;
}

function memberView(member: Member, actorId: string, actorRole: string, owners: number) {
  const protectedOwner = member.role === 'OWNER' && !member.user.disabledAt && owners <= 1;
  const canEdit = member.role !== 'OWNER' || actorRole === 'OWNER';
  const { isGuest: _isGuest, _count, ...user } = member.user;
  void _isGuest;
  return { id: member.id, role: member.role, createdAt: member.createdAt, updatedAt: member.updatedAt, user,
    isSelf: member.user.id === actorId, sharedAccount: _count.memberships > 1,
    canEdit, canEditIdentity: canEdit && (_count.memberships <= 1 || member.user.id === actorId),
    canRemove: canEdit && !protectedOwner, protectedOwner,
  };
}

export async function listWorkspaceMembers(userId: string, workspaceId: string) {
  return db.$transaction(async tx => {
    const actor = await requireAdmin(tx, userId, workspaceId);
    const [members, owners] = await Promise.all([
      tx.workspaceMembership.findMany({ where: { workspaceId }, orderBy: [{ role: 'asc' }, { createdAt: 'asc' }], select: memberSelect }),
      tx.workspaceMembership.count({ where: activeOwnerWhere(workspaceId) }),
    ]);
    return { members: members.map(member => memberView(member, userId, actor.role, owners)), actorRole: actor.role, actorUserId: userId };
  });
}

async function audit(tx: Tx, workspaceId: string, actor: { userId: string; user: { name: string } }, member: Member, action: string, fields: string[], role: string) {
  const projects = await tx.project.findMany({ where: { workspaceId }, select: { id: true } });
  if (!projects.length) return;
  await tx.activityHistory.createMany({ data: projects.map(project => ({ projectId: project.id, entityType: 'WorkspaceMembership', entityId: member.id,
    action, actor: actor.user.name, actorUserId: actor.userId,
    beforeValue: { userId: member.user.id, role: member.role }, afterValue: { userId: member.user.id, role, fieldsChanged: fields },
  })) });
}

export async function updateWorkspaceMember(userId: string, workspaceId: string, input: Record<string, unknown>) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new MutationError(400, 'Body akun tidak valid.');
  const id = typeof input.membershipId === 'string' ? input.membershipId.trim() : '';
  if (!id) throw new MutationError(400, 'Membership wajib diisi.');
  const fields = ['name', 'email', 'password', 'role'].filter(field => Object.hasOwn(input, field));
  if (!fields.length) throw new MutationError(400, 'Tidak ada perubahan akun yang dikirim.');
  if (fields.some(field => typeof input[field] !== 'string')) throw new MutationError(400, 'Data akun tidak valid.');
  const name = typeof input.name === 'string' ? input.name.trim() : undefined;
  const email = typeof input.email === 'string' ? normalizeEmail(input.email) : undefined;
  const password = typeof input.password === 'string' ? input.password : '';
  if (name !== undefined && (!name || name.length > 100)) throw new MutationError(400, 'Nama wajib diisi, maksimal 100 karakter.');
  if (email !== undefined && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw new MutationError(400, 'Email tidak valid.');
  if (input.role !== undefined && !isWorkspaceRole(input.role)) throw new MutationError(400, 'Role tidak valid.');
  if (password) { try { validatePassword(password); } catch (error) { throw new MutationError(400, error instanceof Error ? error.message : 'Password tidak valid.'); } }

  return db.$transaction(async tx => {
    const actor = await requireAdmin(tx, userId, workspaceId);
    const current = await tx.workspaceMembership.findFirst({ where: { id, workspaceId }, select: memberSelect });
    if (!current || current.user.isGuest) throw new MutationError(404, 'Member tidak ditemukan.');
    const role = typeof input.role === 'string' ? input.role : current.role;
    if ((current.role === 'OWNER' || role === 'OWNER') && actor.role !== 'OWNER') throw new MutationError(403, 'Hanya owner yang dapat mengedit akun atau role owner.');
    if ((input.expectedUpdatedAt !== undefined && input.expectedUpdatedAt !== current.updatedAt.toISOString())
      || (input.expectedUserUpdatedAt !== undefined && input.expectedUserUpdatedAt !== current.user.updatedAt.toISOString())) throw new MutationError(409, 'Akun telah berubah. Muat ulang team sebelum mengedit lagi.');
    const nameChanged = name !== undefined && name !== current.user.name;
    const emailChanged = email !== undefined && email !== current.user.email;
    const identityChanged = nameChanged || emailChanged || Boolean(password);
    if (identityChanged && current.user._count.memberships > 1 && current.user.id !== userId) throw new MutationError(409, 'Akun ini dipakai di workspace lain. Admin workspace hanya dapat mengubah role lokalnya; pemilik akun perlu mengubah identitas sendiri.');
    if (current.role === 'OWNER' && role !== 'OWNER' && !current.user.disabledAt) {
      if (await tx.workspaceMembership.count({ where: activeOwnerWhere(workspaceId) }) <= 1) throw new MutationError(409, 'Workspace harus memiliki minimal satu owner aktif.');
    }
    const changedFields = [...(nameChanged ? ['name'] : []), ...(emailChanged ? ['email'] : []), ...(password ? ['password'] : []), ...(role !== current.role ? ['role'] : [])];
    if (identityChanged) await tx.user.update({ where: { id: current.user.id }, data: {
      ...(nameChanged ? { name } : {}), ...(emailChanged ? { email } : {}), ...(password ? { passwordHash: await hashPassword(password) } : {}),
      updatedAt: nextMutationTime(current.user.updatedAt),
    } });
    const member = await tx.workspaceMembership.update({ where: { id }, data: { role, updatedAt: nextMutationTime(current.updatedAt) }, select: memberSelect });
    if (emailChanged || password) await tx.session.deleteMany({ where: { userId: current.user.id } });
    if (changedFields.length) await audit(tx, workspaceId, actor, current, 'UPDATED', changedFields, role);
    const owners = await tx.workspaceMembership.count({ where: activeOwnerWhere(workspaceId) });
    return { member: memberView(member, userId, actor.role, owners), sessionRevoked: current.user.id === userId && (emailChanged || Boolean(password)), refreshRequired: current.user.id === userId && changedFields.length > 0 };
  }, { isolationLevel: 'Serializable' });
}

export async function removeWorkspaceMember(userId: string, workspaceId: string, id: string) {
  if (!id) throw new MutationError(400, 'membershipId wajib diisi.');
  return db.$transaction(async tx => {
    const actor = await requireAdmin(tx, userId, workspaceId);
    const current = await tx.workspaceMembership.findFirst({ where: { id, workspaceId }, select: memberSelect });
    if (!current || current.user.isGuest) throw new MutationError(404, 'Member tidak ditemukan.');
    if (current.role === 'OWNER') {
      if (actor.role !== 'OWNER') throw new MutationError(403, 'Hanya owner yang dapat menghapus owner.');
      if (!current.user.disabledAt && await tx.workspaceMembership.count({ where: activeOwnerWhere(workspaceId) }) <= 1) throw new MutationError(409, 'Workspace harus memiliki minimal satu owner aktif.');
    }
    await tx.workspaceMembership.delete({ where: { id } });
    const remaining = await tx.workspaceMembership.count({ where: { userId: current.user.id } });
    if (!remaining) await tx.user.update({ where: { id: current.user.id }, data: { disabledAt: new Date() } });
    await tx.session.deleteMany({ where: { userId: current.user.id } });
    await audit(tx, workspaceId, actor, current, 'REMOVED', ['membership', ...(!remaining ? ['disabledAt'] : [])], current.role);
    return { deleted: 1, accountDisabled: !remaining, removedSelf: current.user.id === userId };
  }, { isolationLevel: 'Serializable' });
}
