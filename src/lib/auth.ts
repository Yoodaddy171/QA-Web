import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { db } from '@/lib/db';

const scrypt = promisify(crypto.scrypt);

export const SESSION_COOKIE = 'qa_session';
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const WORKSPACE_ROLES = ['VIEWER', 'QA', 'QA_LEAD', 'ADMIN', 'OWNER'] as const;
export type WorkspaceRole = typeof WORKSPACE_ROLES[number];

const ROLE_RANK: Record<WorkspaceRole, number> = { VIEWER: 0, QA: 1, QA_LEAD: 2, ADMIN: 3, OWNER: 4 };

export function normalizeEmail(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

export function isWorkspaceRole(value: unknown): value is WorkspaceRole {
  return WORKSPACE_ROLES.includes(value as WorkspaceRole);
}

export function hasMinimumRole(role: string, minimum: WorkspaceRole) {
  return isWorkspaceRole(role) && ROLE_RANK[role] >= ROLE_RANK[minimum];
}

export function validatePassword(password: string) {
  if (password.length < 12) throw new Error('Password minimal 12 karakter.');
  if (password.length > 200) throw new Error('Password terlalu panjang.');
}

export async function hashPassword(password: string) {
  validatePassword(password);
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = await scrypt(password, salt, 64) as Buffer;
  return `scrypt$${salt}$${derived.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [algorithm, salt, expectedHex] = stored.split('$');
  if (algorithm !== 'scrypt' || !salt || !expectedHex) return false;
  const expected = Buffer.from(expectedHex, 'hex');
  const actual = await scrypt(password, salt, expected.length) as Buffer;
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

export function hashSessionToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function createSession(userId: string) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.session.create({ data: { userId, tokenHash: hashSessionToken(token), expiresAt } });
  return { token, expiresAt };
}

export async function revokeSession(token?: string | null) {
  if (!token) return;
  await db.session.deleteMany({ where: { tokenHash: hashSessionToken(token) } });
}

export async function getSessionByToken(token?: string | null) {
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: {
      user: {
        include: {
          memberships: { include: { workspace: { select: { id: true, name: true, slug: true } } } },
        },
      },
    },
  });
  if (!session || session.expiresAt <= new Date() || session.user.disabledAt) {
    if (session) await db.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  if (Date.now() - session.lastSeenAt.getTime() > 5 * 60 * 1000) {
    void db.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } }).catch(() => undefined);
  }
  return session;
}

export function sessionCookieOptions(expiresAt?: Date) {
  const secure = process.env.QA_COOKIE_SECURE === '1' || /^https:\/\//i.test(process.env.APP_URL || '');
  return {
    httpOnly: true,
    sameSite: 'strict' as const,
    secure,
    path: '/',
    ...(expiresAt ? { expires: expiresAt } : { maxAge: 0 }),
  };
}

export function safeEqualText(actual: string, expected: string) {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

export function isAllowedRequestOrigin(requestUrl: URL, origin: string | null) {
  if (!origin) return false;
  const configured = [process.env.APP_URL, ...(process.env.QA_ALLOWED_ORIGINS || '').split(',')]
    .map(value => String(value || '').trim().replace(/\/$/, ''))
    .filter(Boolean);
  const allowed = new Set([requestUrl.origin, ...configured]);
  return allowed.has(origin.replace(/\/$/, ''));
}
