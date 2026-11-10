import { describe, expect, it } from 'vitest';
import { latestScriptResult } from './latest-result';

describe('latest automation result', () => {
  const old = { id: 'old', createdAt: '2026-10-25T10:00:00Z' };
  const recent = { id: 'recent', createdAt: '2026-10-26T10:00:00Z' };
  it('selects the newest script regardless of list order', () => {
    expect(latestScriptResult([recent, old])).toBe(recent);
  });
  it('keeps a newer capture instead of replacing it with script history', () => {
    expect(latestScriptResult([old], recent.createdAt)).toBeNull();
    expect(latestScriptResult([recent], old.createdAt)).toBe(recent);
  });
  it('keeps capture on equal timestamps and tolerates absent or invalid data', () => {
    expect(latestScriptResult([recent], recent.createdAt)).toBeNull();
    expect(latestScriptResult([])).toBeNull();
    expect(latestScriptResult([{ createdAt: 'invalid' }])).toBeNull();
    expect(latestScriptResult([recent], 'invalid')).toBe(recent);
  });
});
