import type { GroupedVideoEventMarker } from './video-event-sync';

export function recordingResumeMs(saved: { key: string; ms: number }, key: string, durationMs: number) {
  if (saved.key !== key || !Number.isFinite(saved.ms)) return 0;
  return Math.max(0, Math.min(saved.ms, durationMs > 0 ? durationMs : Number.POSITIVE_INFINITY));
}

export function fitRecordingVideo(width: number, height: number, availableWidth: number, availableHeight: number) {
  if (width <= 0 || height <= 0 || availableWidth <= 0 || availableHeight <= 0) return null;
  const scale = Math.min(1, availableWidth / width, availableHeight / height);
  return { width: width * scale, height: height * scale };
}

/** Merge only markers whose hit targets would collide; retain every original event. */
export function fitTimelineMarkers(markers: GroupedVideoEventMarker[], width: number, targetWidth = 44) {
  const track = Math.max(targetWidth, width - targetWidth);
  const result: GroupedVideoEventMarker[] = [];
  for (const marker of markers) {
    const previous = result[result.length - 1];
    if (previous && (marker.leftPercent - previous.leftPercent) / 100 * track < targetWidth) {
      previous.events = [...previous.events, ...marker.events];
      previous.count = previous.events.length;
    } else result.push({ ...marker, events: [...marker.events] });
  }
  return result;
}

