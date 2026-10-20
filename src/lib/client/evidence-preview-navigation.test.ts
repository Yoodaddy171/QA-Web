import { describe, expect, it } from 'vitest';
import { evidenceArrowDirection } from './evidence-preview-navigation';

describe('evidence preview keyboard navigation', () => {
  it('maps only plain horizontal arrows', () => {
    expect(evidenceArrowDirection({ key: 'ArrowLeft' }, false)).toBe(-1);
    expect(evidenceArrowDirection({ key: 'ArrowRight' }, false)).toBe(1);
    for (const key of ['Escape', 'ArrowUp', 'ArrowDown', 'Tab']) expect(evidenceArrowDirection({ key }, false)).toBe(0);
  });
  it('does not steal editing/media shortcuts, modifiers or composing input', () => {
    expect(evidenceArrowDirection({ key: 'ArrowLeft' }, true)).toBe(0);
    for (const modifier of ['altKey', 'ctrlKey', 'metaKey', 'shiftKey', 'isComposing']) {
      expect(evidenceArrowDirection({ key: 'ArrowRight', [modifier]: true }, false)).toBe(0);
    }
  });
});
