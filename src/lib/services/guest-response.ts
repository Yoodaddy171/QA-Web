import { getRequestActor } from '@/lib/request-actor';

/** Strip internal capture logs and physical paths, including nested relation snapshots. */
export async function guestSafeResponse<T>(value: T): Promise<T> {
  const actor = await getRequestActor();
  if (!actor?.guest) return value;
  const canViewEvidence = actor.guest.permissions.includes('evidence.view');
  function clean(item: unknown): unknown {
    if (item === null || typeof item !== 'object' || item instanceof Date) return item;
    if (Array.isArray(item)) return item.map(clean);
    if ('field' in item && item.field === 'stepLogs') return { ...item, beforeValue: null, afterValue: null };
    return Object.fromEntries(Object.entries(item).filter(([key]) => !['stepLogs', 'storagePath', 'automationContext', 'tokenHash', 'passwordHash'].includes(key)).map(([key, nested]) => [key, key === 'evidence' && !canViewEvidence ? [] : clean(nested)]));
  }
  return clean(value) as T;
}
