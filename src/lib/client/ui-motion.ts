/** Shared motion contract. Seconds for Motion, CSS variables use milliseconds. */
export const UI_MOTION = {
  feedback: 0.12,
  content: 0.18,
  overlay: 0.22,
  panel: 0.26,
  ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
};

export function contentTransition(reduced: boolean | null) {
  return { duration: reduced ? 0 : UI_MOTION.content, ease: UI_MOTION.ease };
}
