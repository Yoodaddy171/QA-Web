import type { TestCase } from '@/components/TestCaseTable';
import { buildDevlogRelayUrl } from '@/lib/client/api/devlog-client';
import { getDevtoolsConsoleLevel, getDevtoolsConsoleSource } from '@/lib/client/automation/devtools-console';

export type DevLogTab = 'console' | 'network' | 'execution';
export type FullscreenLogFilter = 'all' | 'errors' | 'api';

export type SelectedFullscreenLog = {
  id: string;
  kind: 'network' | 'console' | 'execution';
  relativeMs?: number;
  text: string;
  detail: unknown;
} | null;

export interface LogEntry {
  id?: string;
  eventId?: string;
  runId?: string;
  sessionId?: string;
  mode?: 'manual' | 'katalon' | 'unknown';
  source?: string;
  timestamp?: string | number | Date;
  relativeMs?: number;
  level?: string;
  eventType?: string;
  log?: unknown;
  message?: unknown;
  isExecution?: boolean;
  isConsole?: boolean;
  isNetwork?: boolean;
  metadata?: Record<string, unknown>;
  network?: {
    event?: string;
    method?: string;
    url: string;
    status?: number;
    duration?: number;
    headers?: unknown;
    data?: unknown;
    success?: boolean;
  };
}

export interface ExecutionInteraction {
  type?: string;
  message?: string;
  target?: string;
  value?: unknown;
  url?: string;
}

export type NetworkCategory = 'business' | 'preflight' | 'document' | 'script' | 'image' | 'static' | 'telemetry' | 'data' | 'other';

export interface NetworkMeta {
  category: NetworkCategory;
  label: string;
  host: string;
  method: string;
  pathname: string;
  isError: boolean;
}

export interface ConsoleLogGroup {
  id: string;
  log: LogEntry;
  entries: LogEntry[];
  count: number;
}

export interface NetworkLogItem {
  log: LogEntry & { network: NonNullable<LogEntry['network']> };
  meta: NetworkMeta;
}

export interface NetworkLogGroup {
  id: string;
  log: LogEntry & { network: NonNullable<LogEntry['network']> };
  meta: NetworkMeta;
  entries: NetworkLogItem[];
  count: number;
}

export interface NetworkFilterState {
  search: string;
  host: string;
  method: string;
  status: string;
  showPreflight: boolean;
  showDocument: boolean;
  showScript: boolean;
  showImage: boolean;
  showStatic: boolean;
  showTelemetry: boolean;
  showDataUrls: boolean;
  showOther: boolean;
}

export const DEFAULT_NETWORK_FILTERS: NetworkFilterState = {
  search: '',
  host: 'all',
  method: 'all',
  status: 'all',
  showPreflight: false,
  showDocument: false,
  showScript: false,
  showImage: false,
  showStatic: false,
  showTelemetry: false,
  showDataUrls: false,
  showOther: false,
};

export const STATIC_EXTENSIONS = [
  '.css', '.woff', '.woff2', '.ttf', '.map',
];

export const DOCUMENT_EXTENSIONS = ['.html', '.htm'];
export const SCRIPT_EXTENSIONS = ['.js', '.mjs'];
export const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.svg', '.gif', '.webp', '.ico', '.avif'];

const HTTP_STATUS_TEXT: Record<number, string> = {
  200: 'OK',
  201: 'Created',
  202: 'Accepted',
  204: 'No Content',
  206: 'Partial Content',
  301: 'Moved Permanently',
  302: 'Found',
  304: 'Not Modified',
  307: 'Temporary Redirect',
  308: 'Permanent Redirect',
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  408: 'Request Timeout',
  409: 'Conflict',
  413: 'Payload Too Large',
  415: 'Unsupported Media Type',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
};

export const formatHttpStatus = (status?: number | string) => {
  if (status === undefined || status === null || status === '' || status === '-') return 'Pending';
  const numeric = typeof status === 'number' ? status : Number(status);
  if (Number.isFinite(numeric) && numeric > 0) {
    const label = HTTP_STATUS_TEXT[numeric];
    return label ? `${numeric} ${label}` : String(numeric);
  }
  return String(status);
};

export const networkCodePanelClass = "overflow-auto rounded border border-border bg-muted p-3 font-mono text-xs leading-relaxed [tab-size:2]";
export const networkFullscreenCodePanelClass = "min-h-[420px] min-w-[280px] max-h-[64vh] resize overflow-auto rounded-xl border border-border bg-background p-4 font-mono text-xs leading-relaxed shadow-sm [tab-size:2]";

export const formatPrettyValue = (value: unknown) => {
  if (value === undefined || value === null || value === '') return '-';

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return '-';

    try {
      return JSON.stringify(JSON.parse(trimmed), null, 2);
    } catch {
      return trimmed;
    }
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

export const escapeHtml = (value: string) => (
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
);

export const getManualFrameUrl = (frameUrl?: string) => (
  frameUrl ? buildDevlogRelayUrl(frameUrl) : ''
);

export const getManualVideoUrl = (videoUrl?: string) => (
  videoUrl?.startsWith('/api/automation/scripts?') ? videoUrl : videoUrl ? buildDevlogRelayUrl(videoUrl) : ''
);

export const blobToDataUrl = async (blob: Blob) => (
  await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  })
);

export const getImageDataUrl = async (url: string) => {
  try {
    const blob = await fetch(url).then((response) => response.blob());
    return await blobToDataUrl(blob);
  } catch {
    return '';
  }
};

export const asRecord = (value: unknown): Record<string, unknown> | null => (
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
);

export const getExecutionInteraction = (log: LogEntry): ExecutionInteraction | null => {
  const metadata = asRecord(log.metadata);
  const legacy = asRecord(metadata?.legacy);
  const raw = asRecord(metadata?.raw);
  const interaction = asRecord(metadata?.interaction)
    ?? asRecord(legacy?.interaction)
    ?? asRecord(raw?.interaction);
  return interaction as ExecutionInteraction | null;
};

export const getExecutionLogText = (log: LogEntry) => {
  const interaction = getExecutionInteraction(log);
  const value = interaction?.message ?? log.log ?? log.message ?? 'Execution event';
  return typeof value === 'string' ? value : formatPrettyValue(value);
};

export const isExecutionLog = (log: LogEntry) => (
  log.isExecution === true
  || log.eventType === 'step'
  || log.eventType === 'run.started'
  || log.eventType === 'run.finished'
);

export const getRequestHeaders = (data: unknown) => {
  const record = asRecord(data);
  if (!record) return null;
  return record.requestHeaders ?? null;
};

export const getRequestPayload = (data: unknown) => {
  const record = asRecord(data);
  if (!record) return null;
  return record.requestBody ?? record.payload ?? record.body ?? null;
};

export const getResponsePayload = (data: unknown) => {
  const record = asRecord(data);
  if (!record) return data;
  return record.responseBody ?? record.response ?? record.data ?? data;
};

const getHeaderContentType = (headers: unknown) => {
  const record = asRecord(headers);
  if (!record) return '';
  for (const [key, value] of Object.entries(record)) {
    if (key.toLowerCase() === 'content-type' && value != null) {
      return String(value).toLowerCase();
    }
  }
  return '';
};

export const getConsoleLogText = (log: LogEntry) => (
  typeof log.log === 'object' ? formatPrettyValue(log.log) : String(log.log ?? '')
);

export const parseNetworkUrl = (url: string) => {
  if (url.startsWith('data:')) {
    return { host: 'data:', pathname: 'data:', protocol: 'data:' };
  }

  if (url.startsWith('blob:')) {
    return { host: 'blob:', pathname: 'blob:', protocol: 'blob:' };
  }

  try {
    const parsed = new URL(url, 'http://local.invalid');
    return {
      host: parsed.hostname || 'local',
      pathname: parsed.pathname || '/',
      protocol: parsed.protocol,
    };
  } catch {
    return { host: 'unknown', pathname: url, protocol: '' };
  }
};

export const getNetworkMeta = (network: NonNullable<LogEntry['network']>): NetworkMeta => {
  const url = network.url || '';
  const parsed = parseNetworkUrl(url);
  const method = (network.method || network.event || 'TRACE').toUpperCase();
  const dataRecord = asRecord(network.data);
  const resourceType = String(dataRecord?.resourceType || '').toLowerCase();
  const contentType = getHeaderContentType(network.headers);
  const pathname = parsed.pathname.toLowerCase();
  const hostLower = parsed.host.toLowerCase();
  const isError = typeof network.status === 'number' && network.status >= 400;
  const isTelemetry =
    pathname.includes('/cdn-cgi/') ||
    pathname.includes('/collect') ||
    pathname.includes('/analytics') ||
    pathname.includes('/telemetry') ||
    pathname.includes('/_next/webpack-hmr') ||
    pathname.includes('.hot-update.') ||
    hostLower.includes('google-analytics') ||
    hostLower.includes('googletagmanager') ||
    hostLower.includes('doubleclick') ||
    hostLower.includes('cloudflareinsights') ||
    hostLower.includes('hotjar') ||
    hostLower.includes('sentry');
  const isStaticAssetPath =
    STATIC_EXTENSIONS.some((extension) => pathname.endsWith(extension)) ||
    pathname.includes('/_next/static/') ||
    pathname.includes('/assets/') ||
    pathname.includes('/public/') ||
    pathname.includes('/media/') ||
    pathname.includes('/images/') ||
    pathname.includes('/fonts/') ||
    pathname.endsWith('/favicon.ico') ||
    pathname.endsWith('/manifest.json');
  const isJsonContent =
    contentType.includes('application/json') ||
    contentType.includes('application/problem+json') ||
    contentType.includes('application/vnd.api+json') ||
    contentType.includes('application/graphql');
  const isLikelyApi =
    resourceType === 'fetch' ||
    resourceType === 'xhr' ||
    isJsonContent ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/graphql') ||
    pathname.startsWith('/rest/') ||
    pathname.startsWith('/rpc/') ||
    /^\/v\d+\//.test(pathname) ||
    pathname.includes('/api/') ||
    pathname.includes('/ajax/') ||
    pathname.includes('/service/') ||
    pathname.includes('/oauth') ||
    pathname.includes('/auth') ||
    pathname.includes('/token') ||
    !['GET', 'HEAD', 'OPTIONS', 'TRACE'].includes(method);

  if (parsed.protocol === 'data:' || parsed.protocol === 'blob:') {
    return { category: 'data', label: 'Data URL', host: parsed.host, method, pathname: parsed.pathname, isError };
  }

  if (method === 'OPTIONS' || resourceType === 'preflight') {
    return { category: 'preflight', label: 'Preflight', host: parsed.host, method, pathname: parsed.pathname, isError };
  }

  if (isTelemetry) {
    return { category: 'telemetry', label: 'Telemetry', host: parsed.host, method, pathname: parsed.pathname, isError };
  }

  if (resourceType === 'document' || DOCUMENT_EXTENSIONS.some((extension) => pathname.endsWith(extension)) || contentType.includes('text/html')) {
    return { category: 'document', label: 'Document', host: parsed.host, method, pathname: parsed.pathname, isError };
  }

  if (resourceType === 'script' || SCRIPT_EXTENSIONS.some((extension) => pathname.endsWith(extension)) || contentType.includes('javascript')) {
    return { category: 'script', label: 'Script', host: parsed.host, method, pathname: parsed.pathname, isError };
  }

  if (resourceType === 'image' || IMAGE_EXTENSIONS.some((extension) => pathname.endsWith(extension)) || contentType.startsWith('image/')) {
    return { category: 'image', label: 'Image', host: parsed.host, method, pathname: parsed.pathname, isError };
  }

  if (resourceType === 'stylesheet' || resourceType === 'font' || resourceType === 'media' || contentType.includes('text/css') || contentType.startsWith('font/') || isStaticAssetPath) {
    return { category: 'static', label: 'Static', host: parsed.host, method, pathname: parsed.pathname, isError };
  }

  if (isLikelyApi) {
    return { category: 'business', label: 'Fetch/XHR', host: parsed.host, method, pathname: parsed.pathname, isError };
  }

  return { category: 'other', label: 'Other', host: parsed.host, method, pathname: parsed.pathname, isError };
};

export const getNetworkRequestKey = (log: LogEntry) => {
  const requestId = asRecord(log.network?.data)?.requestId;
  return typeof requestId === 'string' && requestId
    ? JSON.stringify([log.sessionId ?? log.runId, log.source, requestId])
    : undefined;
};

export const dedupeNetworkLogs = (logs: LogEntry[]) => {
  const rows: LogEntry[] = [];
  const requestIndexes = new Map<string, number>();
  const legacyPending = new Map<string, { indexes: number[]; consumed: number }>();
  for (const log of logs) {
    if (!log.network) continue;
    const pending = (log.network.event === 'Request' || log.eventType === 'network.request') && log.network.status == null;
    const key = getNetworkRequestKey(log);
    if (key) {
      const previous = requestIndexes.get(key);
      if (previous === undefined) {
        requestIndexes.set(key, rows.length);
        rows.push(log);
      } else if (!pending) {
        rows[previous] = log;
      }
      continue;
    }

    // Older recordings have no request ID. A response can consume only one earlier matching request.
    const legacyKey = JSON.stringify([log.sessionId ?? log.runId, log.source, log.network.method?.toUpperCase(), log.network.url]);
    const queue = legacyPending.get(legacyKey);
    if (!pending && queue && queue.consumed < queue.indexes.length) {
      rows[queue.indexes[queue.consumed++]] = log;
    } else {
      if (pending) {
        const waiting = queue ?? { indexes: [], consumed: 0 };
        waiting.indexes.push(rows.length);
        if (!queue) legacyPending.set(legacyKey, waiting);
      }
      rows.push(log);
    }
  }
  return rows;
};

export const getConsoleLogSignature = (log: LogEntry) => {
  const source = getDevtoolsConsoleSource(log);
  return JSON.stringify([getDevtoolsConsoleLevel(log), getConsoleLogText(log), source?.url, source?.lineNumber, source?.columnNumber]);
};

export const getNetworkLogSignature = (item: NetworkLogItem) => [
  item.meta.method,
  item.log.network.url,
  item.log.network.status ?? 'unknown',
  item.meta.category,
].join('|');

export const groupConsoleLogs = (logs: LogEntry[]): ConsoleLogGroup[] => {
  const groups: ConsoleLogGroup[] = [];

  logs.forEach((log, index) => {
    const signature = getConsoleLogSignature(log);
    const previous = groups[groups.length - 1];
    if (previous && getConsoleLogSignature(previous.log) === signature) {
      previous.entries.push(log);
      previous.count += 1;
      return;
    }

    groups.push({
      id: log.id ?? `console-group-${index}`,
      log,
      entries: [log],
      count: 1,
    });
  });

  return groups;
};

export const groupNetworkLogs = (items: NetworkLogItem[]): NetworkLogGroup[] => {
  const groups: NetworkLogGroup[] = [];

  items.forEach((item, index) => {
    const signature = getNetworkLogSignature(item);
    const previous = groups[groups.length - 1];
    if (previous && getNetworkLogSignature(previous.entries[0]) === signature) {
      previous.entries.push(item);
      previous.count += 1;
      return;
    }

    groups.push({
      id: item.log.id ?? `network-group-${index}`,
      log: item.log,
      meta: item.meta,
      entries: [item],
      count: 1,
    });
  });

  return groups;
};

export const getNetworkCategoryClass = (category: NetworkCategory) => {
  switch (category) {
    case 'business': return 'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-500/30 dark:bg-cyan-950/60 dark:text-status-retest';
    case 'preflight': return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-950/60 dark:text-status-blocked';
    case 'document': return 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-950/60 dark:text-blue-300';
    case 'script': return 'border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-500/30 dark:bg-yellow-950/60 dark:text-yellow-300';
    case 'image': return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-950/60 dark:text-status-passed';
    case 'static': return 'border-border bg-muted text-muted-foreground dark:border-slate-600 dark:text-muted-foreground';
    case 'telemetry': return 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-950/60 dark:text-bug-fixing';
    case 'data': return 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 dark:border-fuchsia-500/30 dark:bg-fuchsia-950/60 dark:text-fuchsia-300';
    default: return 'border-border bg-muted text-muted-foreground dark:border-slate-500/30 dark:bg-slate-800 dark:text-foreground';
  }
};

export const getStatusBucket = (status?: number) => {
  if (typeof status !== 'number') return 'unknown';
  if (status >= 500) return '5xx';
  if (status >= 400) return '4xx';
  if (status >= 300) return '3xx';
  if (status >= 200) return '2xx';
  return 'other';
};

export const normalizedLogRelativeMs = (relativeMs?: number) => (
  typeof relativeMs === 'number' && Number.isFinite(relativeMs) && relativeMs >= 0 && relativeMs <= 12 * 60 * 60 * 1000
    ? relativeMs
    : undefined
);

export const formatDateTime = (dateStr?: string | null) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
};

export const splitBulletText = (value?: string | null) => {
  const text = String(value || '').trim();
  if (!text) return [];

  const lineItems = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lineItems.length > 1 && lineItems.every((line) => /^[-•]\s+/.test(line))) {
    return lineItems.map((line) => line.replace(/^[-•]\s+/, '').trim()).filter(Boolean);
  }

  if (/^[-•]\s+/.test(text) || /\s[-•]\s+/.test(text)) {
    return text
      .replace(/^[-•]\s+/, '')
      .split(/\s[-•]\s+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [text];
};

export function BulletTextView({
  value,
  className,
}: {
  value?: string | null;
  className: string;
}) {
  const items = splitBulletText(value);

  return (
    <div className={className}>
      {items.length === 0 ? (
        <span>-</span>
      ) : items.length === 1 ? (
        <p>{items[0]}</p>
      ) : (
        <ul className="list-disc space-y-2 pl-5">
          {items.map((item, index) => (
            <li key={`${item}-${index}`}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export const getBugLifecycleItems = (testCase: TestCase) => [
  {
    key: 'reported',
    label: 'Dilaporkan',
    description: 'Bug tercatat dari testcase yang gagal.',
    date: testCase.reportedAt || testCase.createdAt,
    status: 'SUDAH DILAPORKAN',
  },
  {
    key: 'fixing',
    label: 'Sedang Di Fix',
    description: 'Bug mulai masuk proses perbaikan.',
    date: testCase.fixingAt,
    status: 'SEDANG DI FIX',
  },
  {
    key: 'ready',
    label: 'Ready to Retest',
    description: 'Bug dikembalikan ke QA untuk retest.',
    date: testCase.readyAt,
    status: 'READY TO RETEST',
  },
  {
    key: 'fixed',
    label: 'Verified & Fixed',
    description: 'Retest berhasil dari halaman Test Case.',
    date: testCase.fixedAt,
    status: 'VERIFIED & FIXED',
  },
];

export const getLifecycleIndex = (status: string) => {
  switch (status) {
    case 'SUDAH DILAPORKAN': return 0;
    case 'SEDANG DI FIX': return 1;
    case 'READY TO RETEST': return 2;
    case 'VERIFIED & FIXED': return 3;
    default: return 0;
  }
};
