'use client';
import { useSyncExternalStore } from 'react';
import { tableViewportBucket } from '@/lib/client/testcase-column-visibility';
const subscribe = (listener: () => void) => {
  window.addEventListener('resize', listener);
  return () => window.removeEventListener('resize', listener);
};
const snapshot = () => tableViewportBucket(window.innerWidth);
// SSR/hydration keeps existing CSS responsive rules; client then omits hidden
// control trees. One table-level subscription, never one listener per row.
const serverSnapshot = () => 4;
export function useTableViewport() { return useSyncExternalStore(subscribe, snapshot, serverSnapshot); }
