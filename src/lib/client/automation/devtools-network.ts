import type { AutomationLogEntry } from './automation-event-client';

export type DevtoolsNetworkRequest = NonNullable<AutomationLogEntry['network']>;

export const DEVTOOLS_NETWORK_TYPES = [
  'Fetch/XHR', 'Doc', 'CSS', 'JS', 'Font', 'Img', 'Media', 'Manifest', 'Socket', 'Wasm', 'Other',
] as const;

export type DevtoolsNetworkType = typeof DEVTOOLS_NETWORK_TYPES[number];

export interface DevtoolsNetworkFilterState {
  query: string;
  types: DevtoolsNetworkType[];
  invert: boolean;
  hideDataUrls: boolean;
  hideExtensionUrls: boolean;
}

export const DEFAULT_DEVTOOLS_NETWORK_FILTERS: DevtoolsNetworkFilterState = {
  query: '',
  types: [],
  invert: false,
  hideDataUrls: false,
  hideExtensionUrls: false,
};

const RESOURCE_GROUPS: Record<string, DevtoolsNetworkType> = {
  fetch: 'Fetch/XHR', xhr: 'Fetch/XHR',
  document: 'Doc', stylesheet: 'CSS', script: 'JS', font: 'Font',
  image: 'Img', media: 'Media', manifest: 'Manifest', wasm: 'Wasm',
  websocket: 'Socket', webtransport: 'Socket', directsocket: 'Socket',
};

export function networkRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function parseUrl(value: string) {
  try { return new URL(value); } catch { return undefined; }
}

function getResponseHeaders(network: DevtoolsNetworkRequest) {
  const data = networkRecord(network.data);
  return networkRecord(data?.responseHeaders) ?? (network.event === 'Request' ? undefined : networkRecord(network.headers));
}

function getRequestHeaders(network: DevtoolsNetworkRequest) {
  return networkRecord(networkRecord(network.data)?.requestHeaders) ?? (network.event === 'Request' ? networkRecord(network.headers) : undefined);
}

function getMimeType(network: DevtoolsNetworkRequest) {
  const mime = networkRecord(network.data)?.mimeType;
  const contentType = Object.entries(getResponseHeaders(network) ?? {})
    .find(([key]) => key.toLowerCase() === 'content-type')?.[1];
  return String(mime || contentType || '').split(';')[0].trim().toLowerCase();
}

export function getDevtoolsNetworkType(network: DevtoolsNetworkRequest) {
  const resource = networkRecord(network.data)?.resourceType;
  return typeof resource === 'string' && resource ? resource.toLowerCase() : undefined;
}

export function getDevtoolsNetworkDisplayType(network: DevtoolsNetworkRequest) {
  const type = getDevtoolsNetworkType(network);
  if (type === 'image' || type === 'other') return getMimeType(network).replace(/^(application|image)\//, '') || type;
  return type;
}

function isLegacyApiRequest(network: DevtoolsNetworkRequest, mimeType: string) {
  if (network.method?.toUpperCase() === 'OPTIONS') return false;
  const url = parseUrl(network.url);
  if (!url || (url.protocol !== 'http:' && url.protocol !== 'https:')) return false;

  const headers = getRequestHeaders(network);
  const header = (name: string) => String(Object.entries(headers ?? {})
    .find(([key]) => key.toLowerCase() === name)?.[1] ?? '').trim().toLowerCase();
  const destination = header('sec-fetch-dest');
  const mode = header('sec-fetch-mode');
  if ((destination && destination !== 'empty') || mode === 'navigate' || mode === 'websocket') return false;
  if (header('x-requested-with') === 'xmlhttprequest') return true;

  const apiPath = /\/(?:api|graphql|rest|rpc|ajax)(?:\/|$)/i.test(url.pathname);
  const json = mimeType === 'application/json' || mimeType.endsWith('+json') || mimeType === 'application/graphql';
  if (json && mimeType !== 'application/manifest+json') {
    return apiPath || !/\.(?:json|webmanifest)$/i.test(url.pathname);
  }
  return apiPath && (!mimeType || mimeType === 'text/plain');
}

function getTypeGroup(network: DevtoolsNetworkRequest): DevtoolsNetworkType {
  const type = getDevtoolsNetworkType(network);
  if (!type || type === 'other') {
    const mimeType = getMimeType(network);
    if (mimeType === 'application/wasm') return 'Wasm';
    if (!type && isLegacyApiRequest(network, mimeType)) return 'Fetch/XHR';
  }
  return type && Object.hasOwn(RESOURCE_GROUPS, type) ? RESOURCE_GROUPS[type] : 'Other';
}

export function getDevtoolsNetworkDisplayUrl(value: string) {
  const url = parseUrl(value);
  if (!url) return value;
  let changed = false;
  for (const [key, parameter] of Array.from(url.searchParams)) {
    if (!/authorization|cookie|token|password|secret|api[_-]?key|pin/i.test(key) || parameter === '[REDACTED]') continue;
    url.searchParams.set(key, '[REDACTED]');
    changed = true;
  }
  if (url.username || url.password) {
    url.username = '';
    url.password = '';
    changed = true;
  }
  return changed ? url.href : value;
}

export function getDevtoolsNetworkName(network: DevtoolsNetworkRequest) {
  if (network.url.startsWith('data:')) return `${network.url.split(',', 1)[0].slice(0, 48)},…`;
  const url = parseUrl(getDevtoolsNetworkDisplayUrl(network.url));
  if (!url) return network.url || '—';
  const basename = url.pathname.slice(url.pathname.lastIndexOf('/') + 1);
  return `${basename || (url.pathname === '/' ? url.host : url.pathname)}${url.search}`;
}

export function getDevtoolsNetworkInitiator(network: DevtoolsNetworkRequest) {
  return networkRecord(networkRecord(network.data)?.initiator);
}

export function formatNetworkSize(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return '—';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} MB`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)} kB`;
  return `${value} B`;
}

export function formatNetworkTime(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return '—';
  return value >= 1_000 ? `${(value / 1_000).toFixed(2)} s` : `${Number(value.toFixed(2))} ms`;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function wildcard(value: string) {
  return new RegExp(`^${value.split('*').map(escapeRegex).join('.*')}$`, 'i');
}

type RequestPredicate = (network: DevtoolsNetworkRequest) => boolean;

function hostAndPath(url: string) {
  return url.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
}

function propertyPredicate(key: string, rawValue: string): RequestPredicate | undefined {
  const value = rawValue.replace(/^"(.*)"$/, '$1').toLowerCase();
  switch (key.toLowerCase()) {
    case 'method': return network => network.method?.toLowerCase() === value;
    case 'status-code': return network => typeof network.status === 'number' && String(network.status) === value;
    case 'domain': {
      const match = wildcard(value);
      return network => match.test(parseUrl(network.url)?.hostname ?? '');
    }
    case 'scheme': return network => parseUrl(network.url)?.protocol === `${value}:`;
    case 'url': return network => network.url.toLowerCase().includes(value);
    case 'mime-type': return network => getMimeType(network) === value;
    case 'has-response-header': return network => Object.keys(getResponseHeaders(network) ?? {}).some(header => header.toLowerCase() === value);
    case 'has-request-header': return network => Object.keys(getRequestHeaders(network) ?? {}).some(header => header.toLowerCase() === value);
    case 'resource-type': return network => getDevtoolsNetworkType(network) === value;
    case 'larger-than': {
      const amount = /^(\d+(?:\.\d+)?)([km])?$/.exec(value);
      if (!amount) return undefined;
      const size = Number(amount[1]) * (amount[2] === 'k' ? 1_000 : amount[2] === 'm' ? 1_000_000 : 1);
      return network => {
        const transferred = networkRecord(network.data)?.transferSize;
        return typeof transferred === 'number' && transferred >= size;
      };
    }
    default: return undefined;
  }
}

function compileQuery(query: string, invert: boolean) {
  const tokens = query.match(/-?\/(?:\\.|[^/\\])*\/[i]*|-?[^\s"]*"[^"]*"|\S+/g) ?? [];
  return tokens.map((token): RequestPredicate => {
    const negate = token.startsWith('-') && token.length > 1;
    const term = negate ? token.slice(1) : token;
    const regex = /^\/(.+)\/(i?)$/.exec(term);
    let matches: RequestPredicate | undefined;
    if (regex) {
      try {
        const expression = new RegExp(regex[1], regex[2]);
        matches = network => expression.test(hostAndPath(network.url));
      } catch { /* Invalid regex remains a literal text filter. */ }
    }
    const property = /^([a-z-]+):(.+)$/i.exec(term);
    if (!matches && property) matches = propertyPredicate(property[1], property[2]);
    if (!matches) {
      const text = term.replace(/^"(.*)"$/, '$1').toLowerCase();
      matches = text.includes('://')
        ? network => network.url.toLowerCase().includes(text)
        : network => hostAndPath(network.url).toLowerCase().includes(text);
    }
    const predicate = matches;
    return negate !== invert ? network => !predicate(network) : predicate;
  });
}

export function createDevtoolsNetworkPredicate(filters: DevtoolsNetworkFilterState): RequestPredicate {
  const predicates = compileQuery(filters.query, filters.invert);
  return network => {
    if (filters.hideDataUrls && network.url.startsWith('data:')) return false;
    if (filters.hideExtensionUrls && network.url.startsWith('chrome-extension:')) return false;
    if (filters.types.length && !filters.types.includes(getTypeGroup(network))) return false;
    return predicates.every(predicate => predicate(network));
  };
}
