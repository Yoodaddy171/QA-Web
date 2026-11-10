'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';

export function logWindow(offsets: number[], top: number, height: number, overscan = 400) {
  const find = (position: number) => {
    let low = 0, high = offsets.length - 1;
    while (low < high) { const mid = Math.floor((low + high + 1) / 2); if (offsets[mid] <= position) low = mid; else high = mid - 1; }
    return low;
  };
  return { start: Math.min(offsets.length - 1, find(Math.max(0, top - overscan))), end: Math.min(offsets.length - 1, find(top + height + overscan) + 1) };
}

/** Variable-height rows reuse the existing scroll host, including touchpad/wheel behavior. */
export function VirtualLogList<T>({ items, children, activeId, estimate = 64, itemKey }: {
  items: T[]; children: (item: T, index: number) => ReactNode; activeId?: string | null;
  estimate?: number; itemKey: (item: T, index: number) => string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLElement | null>(null);
  const pendingActive = useRef<{ id: string; until: number } | null>(null);
  const [heights, setHeights] = useState(new Map<string, number>());
  const [viewport, setViewport] = useState({ top: 0, height: 600 });
  const virtual = items.length > 80;
  const keys = useMemo(() => items.map(itemKey), [items, itemKey]);
  const offsets = useMemo(() => {
    const result = [0];
    for (const key of keys) result.push(result[result.length - 1] + (heights.get(key) || estimate));
    return result;
  }, [keys, estimate, heights]);
  useLayoutEffect(() => {
    if (!virtual || !ref.current) return;
    let parent = ref.current.parentElement;
    while (parent && !/(auto|scroll)/.test(getComputedStyle(parent).overflowY)) parent = parent.parentElement;
    const target = parent || document.documentElement;
    host.current = target;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!ref.current) return;
        const offset = ref.current.getBoundingClientRect().top - target.getBoundingClientRect().top + target.scrollTop;
        setViewport({ top: Math.max(0, target.scrollTop - offset), height: target.clientHeight || 600 });
      });
    };
    const observer = new ResizeObserver(update); observer.observe(target);
    const manualScroll = () => { pendingActive.current = null; };
    target.addEventListener('wheel', manualScroll, { passive: true });
    target.addEventListener('pointerdown', manualScroll);
    target.addEventListener('scroll', update, { passive: true }); update();
    return () => { observer.disconnect(); target.removeEventListener('scroll', update); target.removeEventListener('wheel', manualScroll); target.removeEventListener('pointerdown', manualScroll); cancelAnimationFrame(frame); host.current = null; };
  }, [virtual]);
  const { start, end } = virtual ? logWindow(offsets, viewport.top, viewport.height) : { start: 0, end: items.length };
  useLayoutEffect(() => {
    if (!virtual || !ref.current) return;
    const observer = new ResizeObserver(entries => {
      const measured = entries.map(entry => ({ key: (entry.target as HTMLElement).dataset.logKey!, height: entry.borderBoxSize[0]?.blockSize || entry.target.getBoundingClientRect().height }));
      setHeights(previous => {
        const changes = measured.filter(({ key, height }) => height > 0 && Math.abs((previous.get(key) || estimate) - height) > 1);
        if (!changes.length) return previous;
        const next = new Map(previous); for (const { key, height } of changes) next.set(key, height);
        return next;
      });
    });
    for (const child of ref.current.querySelectorAll('[data-log-key]')) observer.observe(child);
    return () => observer.disconnect();
  }, [virtual, start, end, keys, estimate]);
  const lastActive = useRef<string | null>(null);
  useEffect(() => {
    if (!virtual || !activeId || !host.current || !ref.current) return;
    if (activeId !== lastActive.current) { lastActive.current = activeId; pendingActive.current = { id: activeId, until: performance.now() + 400 }; }
    // An estimated jump may land before rows have measured. Correct it while
    // measurements settle, but never fight a user's wheel/scrollbar movement.
    if (pendingActive.current?.id !== activeId || performance.now() > pendingActive.current.until) return;
    const index = keys.indexOf(activeId);
    if (index < 0) return;
    const target = host.current;
    const offset = ref.current.getBoundingClientRect().top - target.getBoundingClientRect().top + target.scrollTop;
    target.scrollTop = offset + offsets[index];
  }, [activeId, keys, offsets, virtual]);
  return <div ref={ref} role="list" aria-label="Daftar event devlog" tabIndex={virtual ? 0 : undefined} className="min-w-0 focus-visible:outline-2 focus-visible:outline-ring" onKeyDown={event => {
    if (event.target !== event.currentTarget || !host.current) return;
    pendingActive.current = null;
    const delta = event.key === 'ArrowDown' ? estimate : event.key === 'ArrowUp' ? -estimate : event.key === 'PageDown' ? viewport.height : event.key === 'PageUp' ? -viewport.height : 0;
    if (delta) { event.preventDefault(); host.current.scrollTop += delta; }
  }}>
    {virtual && <div aria-hidden="true" style={{ height: offsets[start], overflowAnchor: 'none' }} />}
    {items.slice(start, end).map((item, local) => <div key={keys[start + local]} data-log-key={keys[start + local]} role="listitem" aria-setsize={items.length} aria-posinset={start + local + 1} className="flow-root">{children(item, start + local)}</div>)}
    {virtual && <div aria-hidden="true" style={{ height: offsets[items.length] - offsets[end], overflowAnchor: 'none' }} />}
  </div>;
}
