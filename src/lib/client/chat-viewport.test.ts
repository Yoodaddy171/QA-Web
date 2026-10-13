import { describe, expect, it } from 'vitest';
import { clampChatFrame } from './chat-viewport';
describe('Copilot usable viewport', () => {
  for (const width of [320, 360, 390, 768, 1440]) it(`fits ${width}px after resize or drag`, () => {
    const f = clampChatFrame({ left: -200, top: 1000, width: 900, height: 900 }, { width, height: 700 });
    expect(f.left).toBeGreaterThanOrEqual(12); expect(f.top).toBeGreaterThanOrEqual(12);
    expect(f.left + f.width).toBeLessThanOrEqual(width - 12); expect(f.top + f.height).toBeLessThanOrEqual(688);
  });
  it('fits a panned viewport reduced by the virtual keyboard', () => {
    const f = clampChatFrame({ left: 0, top: 0, width: 520, height: 640 }, { width: 320, height: 280, top: 120, left: 5 });
    expect(f).toEqual({ left: 17, top: 132, width: 296, height: 256 });
  });
});
