export type ChatFrame = { left: number; top: number; width: number; height: number };
export type ChatViewport = { width: number; height: number; left?: number; top?: number };

export function clampChatFrame(frame: ChatFrame, viewport: ChatViewport): ChatFrame {
  const inset = Math.min(12, viewport.width / 4, viewport.height / 4);
  const maxWidth = Math.max(1, viewport.width - inset * 2);
  const maxHeight = Math.max(1, viewport.height - inset * 2);
  const width = Math.min(maxWidth, Math.max(Math.min(360, maxWidth), frame.width));
  const height = Math.min(maxHeight, Math.max(Math.min(420, maxHeight), frame.height));
  const left = (viewport.left || 0) + inset, top = (viewport.top || 0) + inset;
  return { width, height, left: Math.max(left, Math.min(frame.left, left + maxWidth - width)), top: Math.max(top, Math.min(frame.top, top + maxHeight - height)) };
}

export function getChatViewport(): ChatViewport {
  const viewport = window.visualViewport;
  return viewport ? { width: viewport.width, height: viewport.height, left: viewport.offsetLeft, top: viewport.offsetTop } : { width: window.innerWidth, height: window.innerHeight };
}

export function getDefaultChatFrame(): ChatFrame {
  const v = getChatViewport();
  return clampChatFrame({ width: 520, height: 640, left: (v.left || 0) + v.width - 540, top: (v.top || 0) + v.height - 660 }, v);
}
