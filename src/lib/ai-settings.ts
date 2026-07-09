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

export function updateEnvText(source: string, updates: Record<string, string>) {
  const remaining = new Map(Object.entries(updates));
  const lines = source.split(/\r?\n/).map(line => {
    const key = line.match(/^([A-Z][A-Z0-9_]*)=/)?.[1];
    if (!key || !remaining.has(key)) return line;
    const value = remaining.get(key) ?? '';
    remaining.delete(key);
    return `${key}=${JSON.stringify(value)}`;
  });
  while (lines.at(-1) === '') lines.pop();
  for (const [key, value] of remaining) lines.push(`${key}=${JSON.stringify(value)}`);
  return `${lines.join('\n')}\n`;
}
