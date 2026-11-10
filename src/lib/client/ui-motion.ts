/** Shared motion contract. Seconds for Motion, CSS variables use milliseconds. */
export const UI_MOTION = {
  feedback: 0.12,
  content: 0.18,
  overlay: 0.22,
  panel: 0.26,
  staggerFast: 0.035,
  ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
  springSnappy: { type: 'spring' as const, stiffness: 480, damping: 32 },
  springLayout: { type: 'spring' as const, stiffness: 380, damping: 30 },
  springPop: { type: 'spring' as const, stiffness: 440, damping: 22 },
};

export function contentTransition(reduced: boolean | null) {
  return { duration: reduced ? 0 : UI_MOTION.content, ease: UI_MOTION.ease };
}

export function springTransition(
  reduced: boolean | null,
  preset: 'springSnappy' | 'springLayout' | 'springPop' = 'springSnappy'
) {
  if (reduced) {
    return { duration: 0 };
  }
  return UI_MOTION[preset];
}

export function directionalSlideVariants(reduced: boolean | null) {
  if (reduced) {
    return {
      enter: { opacity: 1, x: 0 },
      center: { opacity: 1, x: 0 },
      exit: { opacity: 0, x: 0 },
    };
  }
  return {
    enter: (direction: number) => ({
      opacity: 0,
      x: direction >= 0 ? 18 : -18,
    }),
    center: {
      opacity: 1,
      x: 0,
    },
    exit: (direction: number) => ({
      opacity: 0,
      x: direction >= 0 ? -18 : 18,
    }),
  };
}
