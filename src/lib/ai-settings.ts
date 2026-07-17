export const AI_SETTING_KEYS = [
  'AI_PROVIDER',
  'GROQ_API_KEY',
  'GEMINI_API_KEY',
  'OLLAMA_BASE_URL',
] as const;

export function maskSecret(value?: string) {
  return value ? `Configured (...${value.slice(-4)})` : 'Not configured';
}

export function isLocalHostname(hostname: string) {
  return ['localhost', '127.0.0.1', '::1'].includes(hostname);
}

export function normalizeLocalOllamaUrl(value?: string) {
  const input = String(value || '').trim();
  if (!input) return '';
  const url = new URL(input);
  if (!['http:', 'https:'].includes(url.protocol) || !isLocalHostname(url.hostname) || url.username || url.password) {
    throw new Error('OLLAMA_BASE_URL hanya boleh menunjuk ke localhost, 127.0.0.1, atau ::1 tanpa kredensial URL.');
  }
  url.hash = '';
  url.search = '';
  return url.toString().replace(/\/$/, '');
}
