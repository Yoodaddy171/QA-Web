// Suppress only color/shadow transitions during a theme palette replacement.
// Two frames commit the new palette before restoring normal hover transitions.
// Transform/opacity motion stays enabled, including reduced-motion overrides.
export function createThemeTransitionGuard(root: Pick<HTMLElement, 'dataset'>, frame: (callback: () => void) => number) {
  let generation = 0;
  return () => {
    const current = ++generation;
    root.dataset.themeChanging = '';
    frame(() => frame(() => {
      if (current === generation) delete root.dataset.themeChanging;
    }));
  };
}
