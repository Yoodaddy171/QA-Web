import { describe, expect, it } from 'vitest';
import { contentTransition, UI_MOTION } from './ui-motion';

describe('shared motion contract', () => {
  it('keeps interaction feedback and content below 200ms', () => {
    expect(UI_MOTION.feedback).toBeLessThanOrEqual(0.14);
    expect(contentTransition(false).duration).toBe(0.18);
  });
  it('disables content movement duration with reduced motion', () => {
    expect(contentTransition(true).duration).toBe(0);
  });
});
