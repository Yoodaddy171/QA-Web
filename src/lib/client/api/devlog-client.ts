export const DEVLOG_RELAY_URL = 'http://127.0.0.1:3001';
export const DEVLOG_RELAY_TOKEN = process.env.NEXT_PUBLIC_QA_RELAY_TOKEN || '';

export function buildDevlogRelayUrl(path: string) {
  const url = new URL(path, `${DEVLOG_RELAY_URL}/`);
  if (DEVLOG_RELAY_TOKEN) url.searchParams.set('access_token', DEVLOG_RELAY_TOKEN);
  return url.toString();
}

export function buildDevlogRelayWebSocketUrl() {
  const url = new URL(DEVLOG_RELAY_URL.replace(/^http/, 'ws'));
  if (DEVLOG_RELAY_TOKEN) url.searchParams.set('access_token', DEVLOG_RELAY_TOKEN);
  return url.toString();
}

export function normalizeManualCaptureUrl(value: string) {
  const input = value.trim();
  const url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(input) ? input : `https://${input}`);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('URL target harus menggunakan http:// atau https://.');
  }
  return url.toString();
}
