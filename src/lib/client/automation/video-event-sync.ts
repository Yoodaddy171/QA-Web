import type { AutomationEventMode, AutomationEventType } from './automation-event-client';

export type VideoEventCategory =
  | 'api.request'
  | 'api.response.success'
  | 'api.response.failed'
  | 'console.log'
  | 'console.warning'
  | 'console.error'
  | 'javascript.error'
  | 'step'
  | 'screenshot'
  | 'evidence'
  | 'unknown';

export type VideoEventSeverity = 'info' | 'success' | 'warning' | 'error';

export interface VideoSyncRecording {
  recordingId?: string;
  runId?: string;
  sessionId?: string;
  startedAt?: string | number | Date;
  recordingStartedAt?: string | number | Date;
  stoppedAt?: string | number | Date | null;
  recordingEndedAt?: string | number | Date | null;
  video?: {
    startedAt?: string | number | Date | null;
    endedAt?: string | number | Date | null;
    startedAtRelativeMs?: number;
    durationMs?: number;
  };
}

export interface VideoSyncEvent {
  id?: string;
  eventId?: string;
  runId?: string;
  mode?: AutomationEventMode;
  source?: string;
  testCaseId?: string;
  timestamp?: string | number | Date;
  relativeMs?: number;
  level?: string;
  eventType?: AutomationEventType;
  status?: string;
  log?: unknown;
  message?: unknown;
  network?: {
    event?: string;
    method?: string;
    url?: string;
    status?: number;
    success?: boolean;
  };
}

export interface SyncedVideoEvent {
  id: string;
  eventId?: string;
  runId?: string;
  mode?: AutomationEventMode;
  source?: string;
  category: VideoEventCategory;
  severity: VideoEventSeverity;
  label: string;
  summary: string;
  eventTimestampMs?: number;
  eventOffsetMs?: number;
  clampedOffsetMs?: number;
  isBeforeVideo: boolean;
  isAfterVideo: boolean;
  originalEvent: VideoSyncEvent;
}

export interface VideoEventMarker {
  event: SyncedVideoEvent;
  leftPercent: number;
}

export function parseAutomationTimestamp(value: VideoSyncEvent['timestamp']) {
  if (value == null || value === '') return undefined;
  const timestampMs = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(timestampMs) ? timestampMs : undefined;
}

function getVideoStartedAtMs(recording: VideoSyncRecording | null | undefined) {
  return parseAutomationTimestamp(
    recording?.video?.startedAt
      ?? recording?.recordingStartedAt
      ?? recording?.startedAt
  );
}

function getVideoDurationMs(recording: VideoSyncRecording | null | undefined, measuredDurationMs?: number) {
  if (typeof measuredDurationMs === 'number' && Number.isFinite(measuredDurationMs) && measuredDurationMs > 0) {
    return measuredDurationMs;
  }
  const durationMs = Number(recording?.video?.durationMs || 0);
  return Number.isFinite(durationMs) && durationMs > 0 ? durationMs : undefined;
}

function getMessageText(event: VideoSyncEvent) {
  const value = event.log ?? event.message ?? event.network?.url ?? event.eventType ?? 'Automation event';
  return typeof value === 'string' ? value : JSON.stringify(value);
}

export function classifyVideoEvent(event: VideoSyncEvent): {
  category: VideoEventCategory;
  severity: VideoEventSeverity;
  label: string;
} {
  const eventType = String(event.eventType || '').toLowerCase();
  const level = String(event.level || event.status || '').toLowerCase();
  const message = getMessageText(event).toLowerCase();
  const networkEvent = String(event.network?.event || '').toLowerCase();
  const responseStatus = event.network?.status;

  if (eventType === 'network.request' || networkEvent.includes('request')) {
    return { category: 'api.request', severity: 'info', label: event.network?.method || 'REQ' };
  }
  if (eventType === 'network.response' || event.network) {
    const failed = responseStatus !== undefined
      ? responseStatus >= 400
      : event.network?.success === false;
    return {
      category: failed ? 'api.response.failed' : 'api.response.success',
      severity: failed ? 'error' : 'success',
      label: responseStatus ? String(responseStatus) : 'RES',
    };
  }
  if (eventType === 'error' || /exception|javascript error|runtime exception/.test(message)) {
    return { category: 'javascript.error', severity: 'error', label: 'JS Error' };
  }
  if (eventType === 'warning') {
    return { category: 'console.warning', severity: 'warning', label: 'Warning' };
  }
  if (eventType === 'console') {
    if (/severe|error/.test(level) || /error|exception|failed|failure/.test(message)) {
      return { category: 'console.error', severity: 'error', label: 'Console Error' };
    }
    if (/warn|warning/.test(level) || /warn|warning/.test(message)) {
      return { category: 'console.warning', severity: 'warning', label: 'Console Warning' };
    }
    return { category: 'console.log', severity: 'info', label: 'Console' };
  }
  if (eventType === 'step' || eventType === 'run.started' || eventType === 'run.finished') {
    return { category: 'step', severity: eventType === 'run.finished' ? 'success' : 'info', label: event.eventType || 'Step' };
  }
  if (eventType === 'screenshot') {
    return { category: 'screenshot', severity: 'info', label: 'Screenshot' };
  }
  if (eventType === 'evidence') {
    return { category: 'evidence', severity: 'info', label: 'Evidence' };
  }
  return { category: 'unknown', severity: 'info', label: event.eventType || 'Event' };
}

export function getVideoEventDedupKey(event: VideoSyncEvent) {
  if (event.eventId) return `event:${event.eventId}`;
  const timestamp = parseAutomationTimestamp(event.timestamp);
  const timestampBucket = timestamp === undefined ? '' : String(Math.floor(timestamp / 1000));
  return [
    'fingerprint',
    timestampBucket,
    event.source || '',
    event.eventType || '',
    getMessageText(event),
  ].join('|');
}

export function buildSyncedVideoEvents(
  events: VideoSyncEvent[],
  recording: VideoSyncRecording | null | undefined,
  options: { measuredDurationMs?: number } = {}
) {
  const videoStartedAtMs = getVideoStartedAtMs(recording);
  const videoDurationMs = getVideoDurationMs(recording, options.measuredDurationMs);
  const videoStartedAtRelativeMs = Number(recording?.video?.startedAtRelativeMs || 0);
  const seen = new Set<string>();

  return events.reduce<SyncedVideoEvent[]>((items, event, index) => {
    const key = getVideoEventDedupKey(event);
    if (seen.has(key)) return items;
    seen.add(key);

    const eventTimestampMs = parseAutomationTimestamp(event.timestamp);
    const relativeMs = typeof event.relativeMs === 'number' && Number.isFinite(event.relativeMs)
      ? event.relativeMs
      : undefined;
    const eventOffsetMs = eventTimestampMs !== undefined && videoStartedAtMs !== undefined
      ? eventTimestampMs - videoStartedAtMs
      : relativeMs !== undefined
        ? relativeMs - videoStartedAtRelativeMs
        : undefined;
    const isBeforeVideo = typeof eventOffsetMs === 'number' && eventOffsetMs < 0;
    const isAfterVideo = typeof eventOffsetMs === 'number' && videoDurationMs !== undefined && eventOffsetMs > videoDurationMs;
    const clampedOffsetMs = typeof eventOffsetMs === 'number'
      ? Math.max(0, Math.min(videoDurationMs ?? Number.POSITIVE_INFINITY, eventOffsetMs))
      : undefined;
    const classification = classifyVideoEvent(event);

    items.push({
      id: event.eventId || event.id || `${classification.category}-${index}`,
      eventId: event.eventId,
      runId: event.runId,
      mode: event.mode,
      source: event.source,
      ...classification,
      summary: getMessageText(event),
      eventTimestampMs,
      eventOffsetMs,
      clampedOffsetMs,
      isBeforeVideo,
      isAfterVideo,
      originalEvent: event,
    });
    return items;
  }, []).sort((a, b) => (a.clampedOffsetMs ?? Number.POSITIVE_INFINITY) - (b.clampedOffsetMs ?? Number.POSITIVE_INFINITY));
}

export function getEventMarkerPosition(event: Pick<SyncedVideoEvent, 'clampedOffsetMs'>, videoDurationMs?: number) {
  if (
    typeof event.clampedOffsetMs !== 'number'
    || !Number.isFinite(event.clampedOffsetMs)
    || typeof videoDurationMs !== 'number'
    || !Number.isFinite(videoDurationMs)
    || videoDurationMs <= 0
  ) {
    return undefined;
  }

  return Math.max(0, Math.min(100, (event.clampedOffsetMs / videoDurationMs) * 100));
}

export function buildVideoEventMarkers(events: SyncedVideoEvent[], videoDurationMs?: number): VideoEventMarker[] {
  return events.flatMap((event) => {
    const leftPercent = getEventMarkerPosition(event, videoDurationMs);
    return typeof leftPercent === 'number' ? [{ event, leftPercent }] : [];
  });
}

export function getNearestVideoEvent(events: SyncedVideoEvent[], currentOffsetMs: number, windowMs = 1500) {
  if (!Number.isFinite(currentOffsetMs) || !Number.isFinite(windowMs) || windowMs < 0) return null;

  let nearest: SyncedVideoEvent | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const event of events) {
    if (typeof event.clampedOffsetMs !== 'number' || !Number.isFinite(event.clampedOffsetMs)) continue;
    const distance = Math.abs(event.clampedOffsetMs - currentOffsetMs);
    if (distance <= windowMs && distance < nearestDistance) {
      nearest = event;
      nearestDistance = distance;
    }
  }

  return nearest;
}

export function formatVideoOffset(offsetMs?: number) {
  if (typeof offsetMs !== 'number' || !Number.isFinite(offsetMs)) return '-';
  const safeMs = Math.max(0, Math.round(offsetMs));
  const totalSeconds = Math.floor(safeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
