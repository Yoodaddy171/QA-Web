import type { SyncedVideoEvent } from './video-event-sync';

export function logSearchText(log: Record<string, any>): string {
  const fields = [log.log, log.message, log.eventType, log.level, log.network?.url, log.network?.method, log.network?.status,
    log.metadata?.interaction, log.metadata?.legacy?.interaction, log.metadata?.raw?.interaction];
  return fields.map(value => {
    if (value == null) return '';
    if (typeof value === 'object') { try { return JSON.stringify(value); } catch { return ''; } }
    return String(value);
  }).join(' ').trim().toLocaleLowerCase();
}

export function adjacentReviewEvent(events: SyncedVideoEvent[], selectedId: string | null | undefined, currentMs: number, direction: -1 | 1, errorsOnly = false) {
  const selected = events.findIndex(event => event.id === selectedId);
  const anchored = selected >= 0 && Math.abs((events[selected].clampedOffsetMs ?? -Infinity) - currentMs) < 50;
  if (direction === 1) {
    return events.find((event, index) => (anchored ? index > selected : (event.clampedOffsetMs ?? -Infinity) >= currentMs) && (!errorsOnly || event.severity === 'error')) ?? null;
  }
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i];
    if ((anchored ? i < selected : (event.clampedOffsetMs ?? Infinity) <= currentMs) && (!errorsOnly || event.severity === 'error')) return event;
  }
  return null;
}

export function recordingRunCaption(label?: string, startedAt?: string | null) {
  const name = ({ live: 'Capture aktif', current: 'Capture terakhir', previous: 'Capture sebelumnya' } as Record<string, string>)[label || ''] || label || 'Rekaman pengujian';
  const date = startedAt ? new Date(startedAt) : null;
  return date && Number.isFinite(date.getTime()) ? `${name} · ${new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(date)}` : name;
}

export function parseRecordingLayout(raw: string | null, fallback: number[]): number[] {
  try {
    const value = JSON.parse(raw || 'null');
    if (value?.version !== 1 || !Array.isArray(value.sizes) || value.sizes.length !== fallback.length) return fallback;
    const sizes: number[] = value.sizes;
    if (sizes.some(size => !Number.isFinite(size) || size < 12 || size > 88) || Math.abs(sizes.reduce((a, b) => a + b, 0) - 100) > .1) return fallback;
    return sizes;
  } catch { return fallback; }
}

export function minimumEvidencePane(width: number) {
  const available = Number.isFinite(width) && width > 0 ? width : 1024;
  return Math.min(72, Math.max(26, 420 / available * 100));
}
