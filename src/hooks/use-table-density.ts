'use client';

import { useEffect, useState } from 'react';

export type TableDensity = 'comfortable' | 'compact';

const STORAGE_KEY = 'qaDesk.tableDensity.v1';

export function getStoredTableDensity(storage: Pick<Storage, 'getItem'> | null = typeof window === 'undefined' ? null : window.localStorage): TableDensity {
  const value = storage?.getItem(STORAGE_KEY);
  return value === 'compact' ? 'compact' : 'comfortable';
}

export function useTableDensity() {
  const [density, setDensity] = useState<TableDensity>(() => getStoredTableDensity());

  const updateDensity = (next: TableDensity) => {
    setDensity(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    window.dispatchEvent(new CustomEvent('qa-desk:table-density', { detail: next }));
  };

  useEffect(() => {
    const sync = (event: Event) => setDensity((event as CustomEvent<TableDensity>).detail);
    window.addEventListener('qa-desk:table-density', sync);
    return () => window.removeEventListener('qa-desk:table-density', sync);
  }, []);

  return { density, setDensity: updateDensity, rowClassName: density === 'compact' ? 'h-11' : 'h-14' };
}
