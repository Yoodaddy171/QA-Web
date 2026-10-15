export class MutationError extends Error {
  constructor(public readonly status: 400 | 404 | 409, message: string) { super(message); }
}

export function mutationFailure(error: unknown, context: string, fallback: string) {
  if (error instanceof MutationError) return { status: error.status, error: error.message };
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : 'UNKNOWN';
  // SQLite lock/transaction timeouts and PostgreSQL serialization/deadlock aborts
  // are safe failures: no automatic replay of a stale user decision.
  if (['P2034', 'P1008', 'P2028', 'P2025'].includes(code)) {
    console.warn(context, { code });
    return { status: 409, error: 'Data berubah atau sedang diproses. Muat ulang data sebelum mencoba lagi.' };
  }
  // Do not print SQL, record contents or Prisma's potentially sensitive message.
  console.error(context, { code });
  return { status: 500, error: fallback };
}

export function nextMutationTime(previous: Date) {
  // Millisecond timestamps must advance even for rapid same-millisecond writes.
  return new Date(Math.max(Date.now(), previous.getTime() + 1));
}
