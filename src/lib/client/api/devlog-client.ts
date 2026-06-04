export const DEVLOG_RELAY_URL = 'http://127.0.0.1:3001';

export function buildDevlogRelayUrl(path: string) {
  return `${DEVLOG_RELAY_URL}${path}`;
}
