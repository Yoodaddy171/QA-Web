import {
  DEVLOG_SCHEMA_VERSION,
  type DevLogCategory,
  type DevLogEvent,
  type DevLogLevel,
  type DevLogNetworkData,
} from '../../src/lib/devlog-contract';

const DEFAULT_RELAY_URL = 'http://127.0.0.1:3001/log';
const MAX_TEXT_LENGTH = Number(process.env.QA_DEVLOG_MAX_TEXT_LENGTH || '4000');
const REQUEST_TIMEOUT_MS = Number(process.env.QA_DEVLOG_TIMEOUT_MS || '1500');

const sensitiveKeyPattern =
  /authorization|cookie|token|password|secret|apikey|api-key|access_token|refresh_token|pin/i;

function truncateText(value: string, maxLength = MAX_TEXT_LENGTH) {
  if (!Number.isFinite(maxLength) || maxLength <= 0 || value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}... [truncated]`;
}

function redactDeep(value: unknown, depth = 0): unknown {
  if (depth > 8) return '[MAX_DEPTH]';

  if (Array.isArray(value)) {
    return value.slice(0, 50).map(item => redactDeep(item, depth + 1));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .slice(0, 100)
      .map(([key, item]) => [
        key,
        sensitiveKeyPattern.test(key) ? '[REDACTED]' : redactDeep(item, depth + 1),
      ]),
  );
}

export function redactHeaders(headers: Record<string, string> | undefined) {
  if (!headers) return {};

  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [
      key,
      sensitiveKeyPattern.test(key) ? '[REDACTED]' : truncateText(String(value)),
    ]),
  );
}

export function sanitizeBody(value: unknown): unknown {
  if (value === undefined || value === null) return value;

  if (typeof value !== 'string') {
    return redactDeep(value);
  }

  const text = value.trim();
  if (!text) return text;

  try {
    return truncateText(JSON.stringify(redactDeep(JSON.parse(text))));
  } catch {
    // Not JSON.
  }

  try {
    const params = new URLSearchParams(text);
    if ([...params.keys()].length > 0 && text.includes('=')) {
      for (const key of [...params.keys()]) {
        if (sensitiveKeyPattern.test(key)) {
          params.set(key, '[REDACTED]');
        }
      }
      return truncateText(params.toString());
    }
  } catch {
    // Not URL encoded.
  }

  return truncateText(
    text
      .replace(
        /("?(?:password|pin|token|access_token|refresh_token|secret)"?\s*[:=]\s*)("[^"]*"|[^,&}\s]+)/gi,
        '$1"[REDACTED]"',
      )
      .replace(
        /((?:password|pin|token|access_token|refresh_token|secret)=)[^&\s]+/gi,
        '$1[REDACTED]',
      ),
  );
}

export interface SendDevLogInput {
  category: DevLogCategory;
  event?: string;
  testCaseId: string;
  sessionId: string;
  relativeMs?: number;
  level?: DevLogLevel | string;
  console?: boolean;
  log?: unknown;
  network?: DevLogNetworkData;
}

function getRelayUrl() {
  return process.env.QA_DEVLOG_URL || DEFAULT_RELAY_URL;
}

// The relay authorizes every request, including /log. Without this header the
// POST is rejected with 401 and silently dropped by the catch below, which
// looks exactly like "no DevLog was produced".
function getAuthHeaders(): Record<string, string> {
  const token = process.env.QA_RELAY_TOKEN || process.env.NEXT_PUBLIC_QA_RELAY_TOKEN;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function sendDevLog(input: SendDevLogInput): Promise<boolean> {
  const payload: DevLogEvent = {
    schemaVersion: DEVLOG_SCHEMA_VERSION,
    type: 'log',
    runner: 'playwright',
    source: 'playwright',
    timestamp: new Date().toISOString(),
    ...input,
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(getRelayUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    return response.ok;
  } catch {
    // DevLog is an observability sink. A relay outage must not fail the actual test.
    return false;
  } finally {
    clearTimeout(timer);
  }
}
