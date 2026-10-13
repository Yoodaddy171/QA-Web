import { describe, expect, it } from 'vitest';
import { createThemeTransitionGuard } from './theme-transition';

describe('theme palette transition guard', () => {
  it('restores normal interaction transitions after palette commit', () => {
    const root = { dataset: {} as Record<string, string> };
    const frames: Array<() => void> = [];
    const apply = createThemeTransitionGuard(root, cb => frames.push(cb));
    apply();
    expect(root.dataset.themeChanging).toBe('');
    frames.shift()!();
    expect(root.dataset.themeChanging).toBe('');
    frames.shift()!();
    expect(root.dataset.themeChanging).toBeUndefined();
  });
  it('does not let an older palette change restore transitions early', () => {
    const root = { dataset: {} as Record<string, string> };
    const frames: Array<() => void> = [];
    const apply = createThemeTransitionGuard(root, cb => frames.push(cb));
    apply(); frames.shift()!(); apply();
    frames.shift()!();
    expect(root.dataset.themeChanging).toBe('');
    frames.shift()!(); frames.shift()!();
    expect(root.dataset.themeChanging).toBeUndefined();
  });
});
