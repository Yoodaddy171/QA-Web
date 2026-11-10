import { describe, expect, it } from 'vitest';
import { fitRecordingVideo, fitTimelineMarkers, recordingResumeMs } from './recording-review';
import type { GroupedVideoEventMarker, SyncedVideoEvent } from './video-event-sync';

describe('FULLSCREEN-REVIEW regressions', () => {
  it('FS-03 fits video without upscaling the original baseline or changing its aspect ratio', () => {
    expect(fitRecordingVideo(960, 540, 800, 600)).toEqual({ width: 800, height: 450 });
    expect(fitRecordingVideo(960, 540, 1920, 1080)).toEqual({ width: 960, height: 540 });
    expect(fitRecordingVideo(960, 540, 600, 225)).toEqual({ width: 400, height: 225 });
    expect(fitRecordingVideo(0, 0, 800, 600)).toBeNull();
  });
  it('FS-02 restores playback only for the same video and clamps to actual duration', () => {
    expect(recordingResumeMs({ key: 'run-a', ms: 55000 }, 'run-a', 100000)).toBe(55000);
    expect(recordingResumeMs({ key: 'run-a', ms: 55000 }, 'run-b', 100000)).toBe(0);
    expect(recordingResumeMs({ key: 'run-a', ms: 55000 }, 'run-a', 30000)).toBe(30000);
    expect(recordingResumeMs({ key: 'run-a', ms: -1 }, 'run-a', 30000)).toBe(0);
    expect(recordingResumeMs({ key: 'run-a', ms: NaN }, 'run-a', 30000)).toBe(0);
  });
  it('FS-04 merges colliding timeline hit targets without losing or mutating events', () => {
    const markers: GroupedVideoEventMarker[] = [0, 1, 2, 55, 99].map((leftPercent, index) => ({ id: String(index), leftPercent, count: 1, events: [{ id: `event-${index}` } as SyncedVideoEvent] }));
    const fitted = fitTimelineMarkers(markers, 600, 48);
    expect(fitted).toHaveLength(3);
    expect(fitted.flatMap(group => group.events.map(event => event.id))).toEqual(markers.flatMap(group => group.events.map(event => event.id)));
    expect(markers[0].count).toBe(1);
    expect(fitted[0].count).toBe(3);
    for (let i = 1; i < fitted.length; i++) expect((fitted[i].leftPercent - fitted[i - 1].leftPercent) / 100 * (600 - 48)).toBeGreaterThanOrEqual(48);
  });
  it('FS-04 handles empty and narrow timelines without dropping evidence', () => {
    expect(fitTimelineMarkers([], 0)).toEqual([]);
    const groups = [0, 1, 90].map((leftPercent, i) => ({ id: String(i), leftPercent, count: 1, events: [{ id: String(i) } as SyncedVideoEvent] }));
    expect(fitTimelineMarkers(groups, 44).flatMap(group => group.events)).toHaveLength(3);
  });
});
