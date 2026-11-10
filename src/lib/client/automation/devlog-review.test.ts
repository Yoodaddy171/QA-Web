import { describe, expect, it } from 'vitest';
import { adjacentReviewEvent, logSearchText, minimumEvidencePane, parseRecordingLayout, recordingRunCaption } from './devlog-review';
import type { SyncedVideoEvent } from './video-event-sync';

const event = (id: string, time: number, severity = 'info') => ({ id, clampedOffsetMs: time, severity } as SyncedVideoEvent);

describe('Fullscreen review upgrades', () => {
  it('FS-UP-01 indexes URLs, HTTP status, structured console and legacy interaction text', () => {
    expect(logSearchText({ network: { url: 'https://test.invalid/orders', method: 'POST', status: 422 } })).toContain('orders post 422');
    expect(logSearchText({ log: { message: 'Permission denied' } })).toContain('permission denied');
    expect(logSearchText({ metadata: { legacy: { interaction: { message: 'Menekan Simpan' } } } })).toContain('menekan simpan');
    expect(logSearchText({})).toBe('');
  });
  it('FS-UP-04 visits every event at a shared timestamp without jumping to a later cluster', () => {
    const events = [event('a', 2000), event('b', 2000, 'error'), event('c', 2000), event('d', 5000, 'error')];
    expect(adjacentReviewEvent(events, 'a', 2000, 1)?.id).toBe('b');
    expect(adjacentReviewEvent(events, 'c', 2000, -1)?.id).toBe('b');
    expect(adjacentReviewEvent(events, 'b', 2000, 1, true)?.id).toBe('d');
  });
  it('FS-UP-04 includes events at video start and skips them only after explicit selection', () => {
    const events = [event('before-video', 0), event('start', 0), event('later', 1000)];
    expect(adjacentReviewEvent(events, null, 0, 1)?.id).toBe('before-video');
    expect(adjacentReviewEvent(events, 'before-video', 0, 1)?.id).toBe('start');
    expect(adjacentReviewEvent(events, 'start', 0, 1)?.id).toBe('later');
  });
  it('FS-UP-04 follows the actual playback position after a manual seek and stops at boundaries', () => {
    const events = [event('a', 1000), event('b', 5000), event('c', 9000, 'error')];
    expect(adjacentReviewEvent(events, 'a', 6000, 1)?.id).toBe('c');
    expect(adjacentReviewEvent(events, 'a', 6000, -1)?.id).toBe('b');
    expect(adjacentReviewEvent(events, 'c', 9000, 1)).toBeNull();
    expect(adjacentReviewEvent(events, null, 0, -1)).toBeNull();
    expect(adjacentReviewEvent([], null, 0, 1, true)).toBeNull();
  });
  it('FS-UP-05 labels historical runs and omits invalid dates', () => {
    expect(recordingRunCaption('previous', 'invalid')).toBe('Capture sebelumnya');
    expect(recordingRunCaption('Playwright · run-123', '2026-11-04T09:00:00Z')).toMatch(/Playwright · run-123.*2026/);
  });
  it('FS-UP-06 restores only valid versioned percentages without modifying defaults', () => {
    const defaults = [58, 42];
    expect(parseRecordingLayout('{"version":1,"sizes":[65,35]}', defaults)).toEqual([65, 35]);
    for (const raw of [null, 'bad', '{"version":0,"sizes":[65,35]}', '{"version":1,"sizes":[90,10]}', '{"version":1,"sizes":[60,60]}', '{"version":1,"sizes":["60",40]}']) expect(parseRecordingLayout(raw, defaults)).toBe(defaults);
    expect(defaults).toEqual([58, 42]);
  });
  it('FS-UP-06 keeps DevTools usable when restoring a wide-screen layout on a laptop', () => {
    expect(minimumEvidencePane(1920)).toBe(26);
    expect(minimumEvidencePane(1024) / 100 * 1024).toBeCloseTo(420);
    expect(minimumEvidencePane(1440) / 100 * 1440).toBeCloseTo(420);
    expect(minimumEvidencePane(390)).toBe(72);
    expect(Number.isFinite(minimumEvidencePane(NaN))).toBe(true);
  });
});
