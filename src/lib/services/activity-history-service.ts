import { db } from '@/lib/db';
import type { Prisma } from '@prisma/client';

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
  return client.activityHistory.create({
    data: {
      projectId: input.projectId,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      field: input.field || null,
      beforeValue: input.beforeValue === undefined ? undefined : toJsonValue(input.beforeValue),
      afterValue: input.afterValue === undefined ? undefined : toJsonValue(input.afterValue),
      actor: input.actor || 'local-user',
    },
  });
}

export async function listEntityActivity(projectId: string, entityType: string, entityId: string, action?: string) {
  return db.activityHistory.findMany({
    where: { projectId, entityType, entityId, ...(action ? { action } : {}) },
    orderBy: { createdAt: 'desc' },
  });
}

function toJsonValue(value: unknown) {
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  return JSON.parse(JSON.stringify(value));
}
