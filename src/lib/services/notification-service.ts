import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { getRequestActor } from '@/lib/request-actor';

export const LOCAL_RECIPIENT_KEY = 'local-user';

type NotificationClient = typeof db | Prisma.TransactionClient;

export type NotificationSeverity = 'info' | 'success' | 'warning' | 'critical';

export type CreateNotificationInput = {
  projectId: string;
  recipientKey?: string | null;
  type: string;
  severity?: NotificationSeverity;
  title: string;
  message: string;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
  dedupeKey?: string | null;
};

function jsonValue(value: Record<string, unknown> | null | undefined) {
  if (value === null) return Prisma.JsonNull;
  return value === undefined ? undefined : value as Prisma.InputJsonValue;
}

export async function createNotification(input: CreateNotificationInput, client: NotificationClient = db) {
  const requestActor = await getRequestActor();
  const recipientKey = requestActor?.userId || input.recipientKey?.trim() || LOCAL_RECIPIENT_KEY;
  const dedupeKey = input.dedupeKey?.trim() || null;
  const data = {
    projectId: input.projectId,
    recipientKey,
    type: input.type,
    severity: input.severity || 'info',
    title: input.title,
    message: input.message,
    entityType: input.entityType || null,
    entityId: input.entityId || null,
    metadata: jsonValue(input.metadata),
    dedupeKey,
  };

  if (!dedupeKey) return client.notification.create({ data });

  const existing = await client.notification.findUnique({
    where: { projectId_recipientKey_dedupeKey: { projectId: input.projectId, recipientKey, dedupeKey } },
  });
  if (existing) return existing;

  try {
    return await client.notification.create({ data });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return client.notification.findUniqueOrThrow({
        where: { projectId_recipientKey_dedupeKey: { projectId: input.projectId, recipientKey, dedupeKey } },
      });
    }
    throw error;
  }
}

export async function listNotifications(input: {
  projectId: string;
  recipientKey?: string | null;
  cursor?: string | null;
  limit?: number;
  unreadOnly?: boolean;
}) {
  const requestActor = await getRequestActor();
  const recipientKey = requestActor?.userId || input.recipientKey?.trim() || LOCAL_RECIPIENT_KEY;
  const limit = Math.max(1, Math.min(input.limit || 20, 50));
  const where = {
    projectId: input.projectId,
    recipientKey,
    ...(input.unreadOnly ? { readAt: null } : {}),
  };
  const [items, unreadCount] = await Promise.all([
    db.notification.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    }),
    db.notification.count({ where: { projectId: input.projectId, recipientKey, readAt: null } }),
  ]);
  const hasMore = items.length > limit;
  const notifications = hasMore ? items.slice(0, limit) : items;
  return {
    notifications,
    unreadCount,
    nextCursor: hasMore ? notifications.at(-1)?.id || null : null,
  };
}

export async function setNotificationReadState(input: {
  id: string;
  projectId: string;
  recipientKey?: string | null;
  read: boolean;
}) {
  const requestActor = await getRequestActor();
  const recipientKey = requestActor?.userId || input.recipientKey?.trim() || LOCAL_RECIPIENT_KEY;
  const existing = await db.notification.findFirst({
    where: { id: input.id, projectId: input.projectId, recipientKey },
    select: { id: true },
  });
  if (!existing) return null;
  return db.notification.update({ where: { id: existing.id }, data: { readAt: input.read ? new Date() : null } });
}

export async function markAllNotificationsRead(input: { projectId: string; recipientKey?: string | null }) {
  const requestActor = await getRequestActor();
  const recipientKey = requestActor?.userId || input.recipientKey?.trim() || LOCAL_RECIPIENT_KEY;
  return db.notification.updateMany({
    where: { projectId: input.projectId, recipientKey, readAt: null },
    data: { readAt: new Date() },
  });
}
