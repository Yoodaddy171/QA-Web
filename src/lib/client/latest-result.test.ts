import { describe, expect, it } from 'vitest';
import { isLatestResult } from './latest-result';

describe('latest Cases result guard', () => {
  it('accepts the current request only', () => {
    const signal = new AbortController().signal;
    expect(isLatestResult(signal, 2, 2, 'project-a', 'project-a')).toBe(true);
    expect(isLatestResult(signal, 1, 2, 'project-a', 'project-a')).toBe(false);
  });
  it('rejects canceled and cross-project results', () => {
    const controller = new AbortController();
    expect(isLatestResult(controller.signal, 1, 1, 'a', 'b')).toBe(false);
    controller.abort();
    expect(isLatestResult(controller.signal, 1, 1, 'a', 'a')).toBe(false);
  });
  it('rejects a parsed result invalidated by a newer mutation before commit', () => {
    const signal = new AbortController().signal;
    let current = 4;
    const commit = () => isLatestResult(signal, 4, current, 'a', 'a');
    expect(commit()).toBe(true);
    ++current;
    expect(commit()).toBe(false);
  });
});
