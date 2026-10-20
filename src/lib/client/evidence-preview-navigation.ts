export function evidenceArrowDirection(event: {
  key: string; altKey?: boolean; ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean; isComposing?: boolean;
}, interactiveTarget: boolean): -1 | 0 | 1 {
  if (interactiveTarget || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.isComposing) return 0;
  return event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0;
}
