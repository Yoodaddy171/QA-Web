export function recordingSeekDelta(event: Pick<KeyboardEvent, 'key' | 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'isComposing'>, target: { tagName?: string; isContentEditable?: boolean; role?: string } = {}) {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.isComposing) return 0;
  if (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/i.test(target.tagName || '') || ['slider', 'spinbutton', 'combobox', 'listbox', 'menu', 'menuitem', 'tab', 'separator'].includes(target.role || '')) return 0;
  return event.key === 'ArrowRight' ? 5000 : event.key === 'ArrowLeft' ? -5000 : 0;
}

export function clampRecordingSeek(currentMs: number, deltaMs: number, durationMs: number) {
  return Math.max(0, Math.min(Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 0, (Number.isFinite(currentMs) ? currentMs : 0) + deltaMs));
}
