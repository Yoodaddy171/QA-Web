export const DEVLOG_RELAY_URL = 'http://127.0.0.1:3001';

export function buildDevlogRelayUrl(path: string) {
  return `${DEVLOG_RELAY_URL}${path}`;
}

export function normalizeManualCaptureUrl(value: string) {
  const input = value.trim();
  const url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(input) ? input : `https://${input}`);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('URL target harus menggunakan http:// atau https://.');
  }
  return url.toString();
}
