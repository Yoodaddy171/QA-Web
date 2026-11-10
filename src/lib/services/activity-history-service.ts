import { db } from '@/lib/db';
import type { Prisma } from '@prisma/client';
import { getRequestActor } from '@/lib/request-actor';

export async function recordActivity(input: {
  projectId: string;
  entityType: string;
  entityId: string;
  action: string;
  field?: string | null;
  beforeValue?: unknown;
  afterValue?: unknown;
  actor?: string | null;
}, client: typeof db | Prisma.TransactionClient = db) {
  const requestActor = await getRequestActor();
  return client.activityHistory.create({
    data: {
      projectId: input.projectId,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      field: input.field || null,
      beforeValue: input.beforeValue === undefined ? undefined : toJsonValue(input.beforeValue),
      afterValue: input.afterValue === undefined ? undefined : toJsonValue(input.afterValue),
      actor: requestActor?.name || input.actor || 'system',
      actorUserId: requestActor?.userId || null,
    },
  });
}

export async function listEntityActivity(projectId: string, entityType: string, entityId: string, action?: string) {
  return db.activityHistory.findMany({
    where: { projectId, entityType, entityId, ...(action ? { action } : {}) },
    orderBy: { createdAt: 'desc' },
  });
}

export async function listProjectActivity(input: {
  projectId: string;
  entityType?: string;
  action?: string;
  actor?: string;
  search?: string;
  limit?: number;
}) {
  const limit = Math.min(200, Math.max(1, input.limit || 80));
  const where: Prisma.ActivityHistoryWhereInput = {
    projectId: input.projectId,
    ...(input.entityType && input.entityType !== 'all' ? { entityType: input.entityType } : {}),
    ...(input.action && input.action !== 'all' ? { action: input.action } : {}),
    ...(input.actor && input.actor !== 'all' ? { actor: input.actor } : {}),
    ...(input.search
      ? {
          OR: [
            { entityId: { contains: input.search } },
            { entityType: { contains: input.search } },
            { action: { contains: input.search } },
            { field: { contains: input.search } },
            { actor: { contains: input.search } },
          ],
        }
      : {}),
  };

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [activities, totalCount, todayCount, allProjectRows] = await Promise.all([
    db.activityHistory.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
    db.activityHistory.count({ where: { projectId: input.projectId } }),
    db.activityHistory.count({
      where: { projectId: input.projectId, createdAt: { gte: todayStart } },
    }),
    db.activityHistory.findMany({
      where: { projectId: input.projectId },
      select: { actor: true, entityType: true },
      take: 500,
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const actors = Array.from(
    new Set(allProjectRows.map((r) => r.actor).filter((v): v is string => Boolean(v)))
  );
  const entityBreakdown: Record<string, number> = {};
  for (const row of allProjectRows) {
    entityBreakdown[row.entityType] = (entityBreakdown[row.entityType] || 0) + 1;
  }

  return {
    activities,
    summary: {
      totalCount,
      todayCount,
      actors,
      entityBreakdown,
    },
  };
}

function toJsonValue(value: unknown) {
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  return JSON.parse(JSON.stringify(value));
}
