import { describe, expect, it } from 'vitest';
import {
  DEFAULT_VIDEO_EVENT_FILTERS,
  buildVideoEventMarkers,
  buildSyncedVideoEvents,
  classifyVideoEvent,
  filterVideoEventsByCategory,
  formatVideoOffset,
  formatVideoEventDetail,
  getEventMarkerPosition,
  getNearestVideoEvent,
  groupVideoEventMarkers,
  getVideoEventDedupKey,
  getVideoEventFilterKey,
  parseAutomationTimestamp,
} from './video-event-sync';

const recording = {
  recordingId: 'rec-1',
  runId: 'run-1',
  sessionId: 'manual-1',
  recordingStartedAt: '2026-06-05T00:00:00.000Z',
  video: {
    startedAt: '2026-06-05T00:00:02.000Z',
    startedAtRelativeMs: 2000,
    durationMs: 10000,
  },
};

describe('video event sync', () => {
  it('parses timezone-safe timestamps', () => {
    expect(parseAutomationTimestamp('2026-06-05T07:00:03+07:00')).toBe(Date.parse('2026-06-05T00:00:03.000Z'));
    expect(parseAutomationTimestamp('not-a-date')).toBeUndefined();
  });

  it('calculates offsets from absolute event timestamp and video start', () => {
    const [event] = buildSyncedVideoEvents([
      {
        eventId: 'event-1',
        eventType: 'console',
        timestamp: '2026-06-05T00:00:05.500Z',
        log: 'hello',
      },
    ], recording);

    expect(event.eventOffsetMs).toBe(3500);
    expect(event.clampedOffsetMs).toBe(3500);
    expect(event.isBeforeVideo).toBe(false);
    expect(event.isAfterVideo).toBe(false);
  });

  it('falls back to legacy relativeMs when absolute timestamp cannot be matched', () => {
    const [event] = buildSyncedVideoEvents([
      {
        eventId: 'event-legacy',
        eventType: 'network.response',
        relativeMs: 4200,
        network: { event: 'Response', url: 'https://example.test/api', status: 200 },
      },
    ], {
      video: { startedAtRelativeMs: 2000, durationMs: 10000 },
    });

    expect(event.eventOffsetMs).toBe(2200);
    expect(event.clampedOffsetMs).toBe(2200);
  });

  it('flags and clamps events before and after the video', () => {
    const events = buildSyncedVideoEvents([
      {
        eventId: 'before',
        eventType: 'console',
        timestamp: '2026-06-05T00:00:01.000Z',
        log: 'before',
      },
      {
        eventId: 'after',
        eventType: 'console',
        timestamp: '2026-06-05T00:00:20.000Z',
        log: 'after',
      },
    ], recording);

    expect(events.find(event => event.eventId === 'before')).toMatchObject({
      isBeforeVideo: true,
      clampedOffsetMs: 0,
    });
    expect(events.find(event => event.eventId === 'after')).toMatchObject({
      isAfterVideo: true,
      clampedOffsetMs: 10000,
    });
  });

  it('classifies network, console, warning, error, step, and evidence events', () => {
    expect(classifyVideoEvent({ eventType: 'network.request', network: { event: 'Request', url: '/api', method: 'POST' } })).toMatchObject({
      category: 'api.request',
      severity: 'info',
    });
    expect(classifyVideoEvent({ eventType: 'network.response', network: { event: 'Response', url: '/api', status: 500 } })).toMatchObject({
      category: 'api.response.failed',
      severity: 'error',
    });
    expect(classifyVideoEvent({ eventType: 'console', level: 'WARNING', log: 'careful' })).toMatchObject({
      category: 'console.warning',
      severity: 'warning',
    });
    expect(classifyVideoEvent({ eventType: 'console', level: 'SEVERE', log: 'boom' })).toMatchObject({
      category: 'console.error',
      severity: 'error',
    });
    expect(classifyVideoEvent({ eventType: 'error', log: 'Runtime exception' })).toMatchObject({
      category: 'javascript.error',
      severity: 'error',
    });
    expect(classifyVideoEvent({ eventType: 'step', log: 'Click submit' })).toMatchObject({
      category: 'step',
    });
    expect(classifyVideoEvent({ eventType: 'evidence', log: 'Screenshot attached' })).toMatchObject({
      category: 'evidence',
    });
  });

  it('dedupes by eventId and fallback fingerprint', () => {
    const events = buildSyncedVideoEvents([
      { eventId: 'same', eventType: 'console', timestamp: '2026-06-05T00:00:03.000Z', log: 'one' },
      { eventId: 'same', eventType: 'console', timestamp: '2026-06-05T00:00:04.000Z', log: 'two' },
      { source: 'manual-cdp', eventType: 'console', timestamp: '2026-06-05T00:00:05.100Z', log: 'same message' },
      { source: 'manual-cdp', eventType: 'console', timestamp: '2026-06-05T00:00:05.900Z', log: 'same message' },
    ], recording);

    expect(events).toHaveLength(2);
    expect(getVideoEventDedupKey({ eventId: 'same' })).toBe('event:same');
  });

  it('calculates marker positions from clamped event offset', () => {
    const events = buildSyncedVideoEvents([
      { eventId: 'quarter', eventType: 'console', timestamp: '2026-06-05T00:00:04.500Z', log: 'quarter' },
      { eventId: 'end', eventType: 'console', timestamp: '2026-06-05T00:00:12.000Z', log: 'end' },
    ], recording);
    const markers = buildVideoEventMarkers(events, 10000);

    expect(markers.map(marker => marker.leftPercent)).toEqual([25, 100]);
    expect(getEventMarkerPosition({ clampedOffsetMs: 5000 }, 10000)).toBe(50);
  });

  it('does not create marker positions when duration or offset is missing', () => {
    expect(getEventMarkerPosition({ clampedOffsetMs: 1000 }, undefined)).toBeUndefined();
    expect(getEventMarkerPosition({}, 1000)).toBeUndefined();
    expect(buildVideoEventMarkers([{ id: 'bad', category: 'unknown', severity: 'info', label: 'Bad', summary: 'bad', isBeforeVideo: false, isAfterVideo: false, originalEvent: {} }], 1000)).toEqual([]);
  });

  it('finds the nearest event inside the current event window only', () => {
    const events = buildSyncedVideoEvents([
      { eventId: 'near', eventType: 'console', timestamp: '2026-06-05T00:00:05.000Z', log: 'near' },
      { eventId: 'far', eventType: 'console', timestamp: '2026-06-05T00:00:09.000Z', log: 'far' },
    ], recording);

    expect(getNearestVideoEvent(events, 3100, 1500)?.eventId).toBe('near');
    expect(getNearestVideoEvent(events, 8500, 500)).toBeNull();
  });

  it('keeps before and after video events safe for marker rendering', () => {
    const events = buildSyncedVideoEvents([
      { eventId: 'before', eventType: 'warning', timestamp: '2026-06-05T00:00:01.000Z', log: 'before' },
      { eventId: 'after', eventType: 'error', timestamp: '2026-06-05T00:00:20.000Z', log: 'after' },
    ], recording);
    const markers = buildVideoEventMarkers(events, 10000);

    expect(markers.find(marker => marker.event.eventId === 'before')?.leftPercent).toBe(0);
    expect(markers.find(marker => marker.event.eventId === 'after')?.leftPercent).toBe(100);
  });

  it('formats video offsets for overlay display', () => {
    expect(formatVideoOffset(65000)).toBe('1:05');
    expect(formatVideoOffset(undefined)).toBe('-');
  });

  it('filters events by marker category groups', () => {
    const events = buildSyncedVideoEvents([
      { eventId: 'net', eventType: 'network.request', timestamp: '2026-06-05T00:00:03.000Z', network: { event: 'Request', url: '/api', method: 'GET' } },
      { eventId: 'console', eventType: 'console', timestamp: '2026-06-05T00:00:04.000Z', log: 'hello' },
      { eventId: 'error', eventType: 'error', timestamp: '2026-06-05T00:00:05.000Z', log: 'boom' },
      { eventId: 'warning', eventType: 'warning', timestamp: '2026-06-05T00:00:06.000Z', log: 'careful' },
      { eventId: 'step', eventType: 'step', timestamp: '2026-06-05T00:00:07.000Z', log: 'click' },
      { eventId: 'evidence', eventType: 'evidence', timestamp: '2026-06-05T00:00:08.000Z', log: 'shot' },
      { eventId: 'unknown', eventType: 'custom', timestamp: '2026-06-05T00:00:09.000Z', log: 'custom' },
    ], recording);

    expect(getVideoEventFilterKey(events[0])).toBe('network');
    expect(filterVideoEventsByCategory(events, { ...DEFAULT_VIDEO_EVENT_FILTERS, console: false }).map(event => event.eventId)).not.toContain('console');
    expect(filterVideoEventsByCategory(events, { network: false, console: false, errors: false, warnings: false, steps: false, evidence: false, unknown: false })).toHaveLength(0);
  });

  it('groups dense markers and exposes grouped counts', () => {
    const events = buildSyncedVideoEvents([
      { eventId: 'a', eventType: 'console', timestamp: '2026-06-05T00:00:03.000Z', log: 'a' },
      { eventId: 'b', eventType: 'console', timestamp: '2026-06-05T00:00:03.100Z', log: 'b' },
      { eventId: 'c', eventType: 'console', timestamp: '2026-06-05T00:00:09.000Z', log: 'c' },
    ], recording);
    const groups = groupVideoEventMarkers(buildVideoEventMarkers(events, 10000), 2.5);

    expect(groups).toHaveLength(2);
    expect(groups[0].count).toBe(2);
    expect(groups[0].events.map(event => event.eventId)).toEqual(['a', 'b']);
    expect(groups[1].count).toBe(1);
  });

  it('nearest event respects the filtered event set', () => {
    const events = buildSyncedVideoEvents([
      { eventId: 'console', eventType: 'console', timestamp: '2026-06-05T00:00:05.000Z', log: 'hello' },
      { eventId: 'step', eventType: 'step', timestamp: '2026-06-05T00:00:05.100Z', log: 'step' },
    ], recording);
    const filtered = filterVideoEventsByCategory(events, { console: false });

    expect(getNearestVideoEvent(filtered, 3050, 1500)?.eventId).toBe('step');
  });

  it('groups markers safely when invalid offsets were filtered out', () => {
    const groups = groupVideoEventMarkers(buildVideoEventMarkers([
      { id: 'bad', category: 'unknown', severity: 'info', label: 'Bad', summary: 'bad', isBeforeVideo: false, isAfterVideo: false, originalEvent: {} },
    ], 10000));

    expect(groups).toEqual([]);
  });

  it('formats selected event detail data for network and console events', () => {
    const [network, consoleEvent] = buildSyncedVideoEvents([
      { eventId: 'net', eventType: 'network.response', timestamp: '2026-06-05T00:00:04.000Z', network: { event: 'Response', method: 'POST', url: 'https://example.test/api', status: 201 } },
      { eventId: 'console', eventType: 'console', timestamp: '2026-06-05T00:00:05.000Z', log: 'done' },
    ], recording);

    expect(formatVideoEventDetail(network)).toMatchObject({
      category: 'api.response.success',
      severity: 'success',
      offset: '0:02',
      method: 'POST',
      url: 'https://example.test/api',
      responseStatus: '201',
    });
    expect(formatVideoEventDetail(consoleEvent)).toMatchObject({
      category: 'console.log',
      severity: 'info',
      summary: 'done',
    });
  });
});
