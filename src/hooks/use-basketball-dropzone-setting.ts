'use client';

import { useEffect, useState } from 'react';

export const BASKETBALL_DROPZONE_STORAGE_KEY = 'qaDesk.basketballDropzone.v1';
export const BASKETBALL_DROPZONE_EVENT = 'qa-desk:basketball-dropzone-setting';

export function getStoredBasketballDropzoneSetting(
  storage: Pick<Storage, 'getItem'> | null = typeof window === 'undefined' ? null : window.localStorage
): boolean {
  if (!storage) return true;
  const value = storage.getItem(BASKETBALL_DROPZONE_STORAGE_KEY);
  if (value === null) return true; // Default: ON (aktif)
  return value === 'true' || value === '1';
}

export function useBasketballDropzoneSetting() {
  const [isBasketballEnabled, setIsBasketballEnabled] = useState<boolean>(() =>
    getStoredBasketballDropzoneSetting()
  );

  const updateSetting = (next: boolean) => {
    setIsBasketballEnabled(next);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(BASKETBALL_DROPZONE_STORAGE_KEY, String(next));
        window.dispatchEvent(
          new CustomEvent<boolean>(BASKETBALL_DROPZONE_EVENT, { detail: next })
        );
      } catch {
        // Ignore storage write errors if disabled in browser
      }
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const syncHandler = (event: Event) => {
      const detail = (event as CustomEvent<boolean>).detail;
      if (typeof detail === 'boolean') {
        setIsBasketballEnabled(detail);
      }
    };

    const storageHandler = (event: StorageEvent) => {
      if (event.key === BASKETBALL_DROPZONE_STORAGE_KEY) {
        setIsBasketballEnabled(getStoredBasketballDropzoneSetting());
      }
    };

    window.addEventListener(BASKETBALL_DROPZONE_EVENT, syncHandler);
    window.addEventListener('storage', storageHandler);
    return () => {
      window.removeEventListener(BASKETBALL_DROPZONE_EVENT, syncHandler);
      window.removeEventListener('storage', storageHandler);
    };
  }, []);

  return {
    isBasketballEnabled,
    setIsBasketballEnabled: updateSetting,
  };
}
