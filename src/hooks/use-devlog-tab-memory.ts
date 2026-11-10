'use client';

import { useLayoutEffect, useRef } from 'react';

type DevlogTab = 'execution' | 'console' | 'network';

export function useDevlogTabMemory<T>({ tab, selection, expanded, onTabChange, onSelectionChange, onExpandedChange }: {
  tab: DevlogTab;
  selection: T | null;
  expanded?: string | null;
  onTabChange: (tab: DevlogTab) => void;
  onSelectionChange: (selection: T | null) => void;
  onExpandedChange?: (expanded: string | null) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const saved = useRef<Partial<Record<DevlogTab, { selection: T | null; expanded: string | null; scrollTop: number }>>>({});
  useLayoutEffect(() => {
    if (listRef.current) listRef.current.scrollTop = saved.current[tab]?.scrollTop ?? 0;
  }, [tab]);
  useLayoutEffect(() => {
    saved.current[tab] = { selection, expanded: expanded ?? null, scrollTop: saved.current[tab]?.scrollTop ?? 0 };
  }, [tab, selection, expanded]);
  const rememberScroll = () => {
    saved.current[tab] = { selection, expanded: expanded ?? null, scrollTop: listRef.current?.scrollTop ?? 0 };
  };

  const changeTab = (next: DevlogTab) => {
    if (next === tab) return;
    saved.current[tab] = { selection, expanded: expanded ?? null, scrollTop: listRef.current?.scrollTop ?? 0 };
    const previous = saved.current[next];
    onSelectionChange(previous?.selection ?? null);
    onExpandedChange?.(previous?.expanded ?? null);
    onTabChange(next);
  };
  return { listRef, changeTab, rememberScroll };
}
