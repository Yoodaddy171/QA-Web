'use client';

import { useMemo } from 'react';
import { ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { adjacentReviewEvent } from '@/lib/client/automation/devlog-review';
import type { SyncedVideoEvent } from '@/lib/client/automation/video-event-sync';

export function RecordingEventNavigation({ events, selectedId, currentMs, onSelect }: {
  events: SyncedVideoEvent[]; selectedId?: string | null; currentMs: number; onSelect: (event: SyncedVideoEvent) => void;
}) {
  const ordered = useMemo(() => events.filter(event => Number.isFinite(event.clampedOffsetMs)).toSorted((a, b) => a.clampedOffsetMs! - b.clampedOffsetMs!), [events]);
  const previous = adjacentReviewEvent(ordered, selectedId, currentMs, -1);
  const next = adjacentReviewEvent(ordered, selectedId, currentMs, 1);
  const error = adjacentReviewEvent(ordered, selectedId, currentMs, 1, true);
  return <nav aria-label="Navigasi event rekaman" className="flex flex-wrap items-center gap-1">
    <Button type="button" variant="ghost" size="sm" disabled={!previous} onClick={() => previous && onSelect(previous)} title="Event sebelumnya pada rekaman"><ChevronLeft />Event sebelumnya</Button>
    <Button type="button" variant="ghost" size="sm" disabled={!next} onClick={() => next && onSelect(next)} title="Event berikutnya pada rekaman">Event berikutnya<ChevronRight /></Button>
    <Button type="button" variant="outline" size="sm" disabled={!error} onClick={() => error && onSelect(error)} title={error ? 'Lompat ke error berikutnya pada rekaman' : 'Tidak ada error berikutnya pada data termuat'}><AlertCircle />Error berikutnya</Button>
  </nav>;
}
