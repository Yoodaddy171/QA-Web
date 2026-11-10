import { describe, expect, it } from 'vitest';
import { EventBuffer } from './event-buffer';
describe('paged event accumulator', () => {
  it('retains every event in order without mutating prior published snapshots', () => {
    const buffer = new EventBuffer<number>(); buffer.append([1, 2]); const old = buffer.snapshot();
    for (let i = 3; i <= 20000; i++) buffer.append([i]);
    const all = buffer.snapshot(); expect(old).toEqual([1, 2]); expect(all).toHaveLength(20000); expect(all[19999]).toBe(20000); expect(buffer.snapshot()).toBe(all);
  });
  it('drops only the old selection when explicitly reset', () => { const buffer = new EventBuffer<number>(); buffer.append([1]); buffer.reset([2]); expect(buffer.snapshot()).toEqual([2]); });
});
