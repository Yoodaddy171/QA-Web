import { describe, expect, it } from 'vitest';
import { clampRecordingSeek, recordingSeekDelta } from './recording-shortcuts';
const key = { key: 'ArrowRight', altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, isComposing: false };
describe('recording playback shortcuts', () => {
  it('seeks five seconds in either direction', () => {
    expect(recordingSeekDelta(key)).toBe(5000);
    expect(recordingSeekDelta({ ...key, key: 'ArrowLeft' })).toBe(-5000);
    expect(recordingSeekDelta({ ...key, key: 'Escape' })).toBe(0);
  });
  it('does not hijack editing, sliders, resizing, navigation, or modifier keys', () => {
    for (const tagName of ['INPUT', 'TEXTAREA', 'SELECT']) expect(recordingSeekDelta(key, { tagName })).toBe(0);
    for (const role of ['slider', 'separator', 'tab', 'combobox', 'menuitem']) expect(recordingSeekDelta(key, { role })).toBe(0);
    expect(recordingSeekDelta(key, { isContentEditable: true })).toBe(0);
    for (const flag of ['ctrlKey', 'metaKey', 'altKey', 'shiftKey', 'isComposing']) expect(recordingSeekDelta({ ...key, [flag]: true })).toBe(0);
  });
  it('clamps seeks to the actual video bounds', () => {
    expect(clampRecordingSeek(2000, -5000, 60000)).toBe(0);
    expect(clampRecordingSeek(58000, 5000, 60000)).toBe(60000);
    expect(clampRecordingSeek(10000, 5000, 60000)).toBe(15000);
    expect(clampRecordingSeek(NaN, 5000, 60000)).toBe(5000);
    expect(clampRecordingSeek(1000, 5000, NaN)).toBe(0);
  });
});
