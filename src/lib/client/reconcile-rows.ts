function equalJsonValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const left = Object.keys(a), right = Object.keys(b);
  return left.length === right.length && left.every(key => Object.hasOwn(b, key) && equalJsonValue((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]));
}

// API rows are JSON values. Retain references only when every field agrees,
// including nested module/record metadata. The cache is bounded to one page.
export function reconcileRows<T extends { id: string }>(previous: T[], next: T[]): T[] {
  const byId = new Map(previous.map(row => [row.id, row]));
  const rows = next.map(row => { const old = byId.get(row.id); return old && equalJsonValue(old, row) ? old : row; });
  return rows.length === previous.length && rows.every((row, i) => row === previous[i]) ? previous : rows;
}
