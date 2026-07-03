// Pure helpers, types, and constants for TestCaseDetailDialog.
// Extracted verbatim from the dialog component; no behavior changes.
import type { TestCase } from '@/components/TestCaseTable';

export type DevLogTab = 'console' | 'network' | 'execution';
export type FullscreenLogFilter = 'all' | 'errors' | 'api';

export type SelectedFullscreenLog = {
  id: string;
  kind: 'network' | 'console';
  relativeMs?: number;
  text: string;
  detail: unknown;
} | null;

export interface LogEntry {
  id?: string;
  eventId?: string;
  runId?: string;
  mode?: 'manual' | 'katalon' | 'unknown';
  source?: string;
  timestamp?: string | number | Date;
  relativeMs?: number;
  level?: string;
  eventType?: string;
  log?: unknown;
  message?: unknown;
  isConsole?: boolean;
  isNetwork?: boolean;
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
  '.css', '.woff', '.woff2', '.ttf', '.map', '.json',
];

export const DOCUMENT_EXTENSIONS = ['.html', '.htm'];
export const SCRIPT_EXTENSIONS = ['.js', '.mjs'];
export const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.svg', '.gif', '.webp', '.ico', '.avif'];

export const networkCodePanelClass = "overflow-auto rounded border border-border bg-muted p-3 font-mono text-[10px] leading-relaxed [tab-size:2]";
export const networkFullscreenCodePanelClass = "min-h-[420px] min-w-[280px] max-h-[64vh] resize overflow-auto rounded-xl border border-border bg-background p-4 font-mono text-[11px] leading-relaxed shadow-sm [tab-size:2]";

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
  frameUrl ? `http://127.0.0.1:3001${frameUrl}` : ''
);

export const getManualVideoUrl = (videoUrl?: string) => (
  videoUrl ? `http://127.0.0.1:3001${videoUrl}` : ''
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
  const resourceType = (network.method || '').toLowerCase();
  const pathname = parsed.pathname.toLowerCase();
  const isError = typeof network.status === 'number' && network.status >= 400;
  const isLikelyApi =
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

  if (resourceType === 'document' || DOCUMENT_EXTENSIONS.some((extension) => pathname.endsWith(extension))) {
    return { category: 'document', label: 'Document', host: parsed.host, method, pathname: parsed.pathname, isError };
  }

  if (resourceType === 'script' || SCRIPT_EXTENSIONS.some((extension) => pathname.endsWith(extension))) {
    return { category: 'script', label: 'Script', host: parsed.host, method, pathname: parsed.pathname, isError };
  }

  if (resourceType === 'image' || IMAGE_EXTENSIONS.some((extension) => pathname.endsWith(extension))) {
    return { category: 'image', label: 'Image', host: parsed.host, method, pathname: parsed.pathname, isError };
  }

  if (pathname.includes('/cdn-cgi/rum') || pathname.includes('/collect') || pathname.includes('/analytics')) {
    return { category: 'telemetry', label: 'Telemetry', host: parsed.host, method, pathname: parsed.pathname, isError };
  }

  if (isLikelyApi) {
    return { category: 'business', label: 'API', host: parsed.host, method, pathname: parsed.pathname, isError };
  }

  const isStatic = STATIC_EXTENSIONS.some((extension) => pathname.endsWith(extension)) ||
    pathname.includes('/_next/') ||
    pathname.includes('/assets/') ||
    pathname.includes('/public/') ||
    pathname.includes('/media/') ||
    pathname.includes('/images/');

  if (isStatic) {
    return { category: 'static', label: 'Static', host: parsed.host, method, pathname: parsed.pathname, isError };
  }

  return { category: 'other', label: 'Other', host: parsed.host, method, pathname: parsed.pathname, isError };
};

export const getConsoleLogSignature = (log: LogEntry) => [
  log.level || 'INFO',
  getConsoleLogText(log),
].join('|');

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
    case 'business': return 'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-500/30 dark:bg-cyan-950/60 dark:text-cyan-300';
    case 'preflight': return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-950/60 dark:text-amber-300';
    case 'document': return 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-950/60 dark:text-blue-300';
    case 'script': return 'border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-500/30 dark:bg-yellow-950/60 dark:text-yellow-300';
    case 'image': return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-950/60 dark:text-emerald-300';
    case 'static': return 'border-border bg-muted text-muted-foreground dark:border-slate-600 dark:text-slate-400';
    case 'telemetry': return 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-950/60 dark:text-violet-300';
    case 'data': return 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 dark:border-fuchsia-500/30 dark:bg-fuchsia-950/60 dark:text-fuchsia-300';
    default: return 'border-border bg-muted text-muted-foreground dark:border-slate-500/30 dark:bg-slate-800 dark:text-slate-300';
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
