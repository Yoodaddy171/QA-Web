'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { parseRecordingLayout } from '@/lib/client/automation/devlog-review';

export function useRecordingLayout(name: 'horizontal' | 'vertical', fallback: number[]) {
  const key = `traceva:recording-layout:v1:${name}`;
  const [initial] = useState(() => {
    if (typeof window === 'undefined') return { sizes: fallback, error: false };
    try { return { sizes: parseRecordingLayout(window.localStorage.getItem(key), fallback), error: false }; }
    catch { return { sizes: fallback, error: true }; }
  });
  const [storageError, setStorageError] = useState(initial.error);
  const [sizes, setSizes] = useState(initial.sizes);
  const latestSizes = useRef(initial.sizes);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<string | null>(null);
  const saveLayout = useCallback((sizes: number[]) => {
    latestSizes.current = sizes;
    pending.current = JSON.stringify({ version: 1, sizes });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      try { window.localStorage.setItem(key, pending.current!); pending.current = null; setStorageError(false); }
      catch { setStorageError(true); }
    }, 180);
  }, [key]);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
    if (pending.current) { try { window.localStorage.setItem(key, pending.current); } catch { /* The mounted UI already exposes storage failures. */ } }
  }, [key]);
  const restoreLayout = useCallback(() => setSizes(latestSizes.current), []);
  return { sizes, saveLayout, restoreLayout, storageError };
}
