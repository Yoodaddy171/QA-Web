import { describe, expect, it } from 'vitest';
import { logWindow } from './VirtualLogList';
describe('virtual log viewport', () => {
  const offsets = Array.from({ length: 10001 }, (_, i) => i * 64);
  it('bounds DOM rows independently from the 10000 retained events', () => { const range = logWindow(offsets, 100000, 600); expect(range.end - range.start).toBeLessThan(25); expect(range.start).toBeGreaterThan(1000); });
  it('covers first and last rows, including empty data', () => {
    expect(logWindow(offsets, 0, 600).start).toBe(0); expect(logWindow(offsets, 640000, 600).end).toBe(10000); expect(logWindow([0], 0, 600)).toEqual({ start: 0, end: 0 });
  });
});
