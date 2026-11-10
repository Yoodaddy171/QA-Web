'use client';

import { useEffect, useRef, useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { asRecord, formatHttpStatus } from '@/components/TestCaseDetailDialog.helpers';
import { formatNetworkTime, getDevtoolsNetworkDisplayUrl, getDevtoolsNetworkInitiator, networkRecord, type DevtoolsNetworkRequest } from '@/lib/client/automation/devtools-network';
import { copyText } from '@/lib/client/copy-text';
import { cn } from '@/lib/utils';

function toHeaderEntries(value: unknown): Array<[string, string]> {
  const record = asRecord(value);
  if (!record) return [];
  return Object.entries(record)
    .filter(([, val]) => val !== undefined && val !== null && val !== '')
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, val]) => [key, typeof val === 'string' ? val : JSON.stringify(val)]);
}

const timingPhases = [
  ['Proxy negotiation', 'proxyStart', 'proxyEnd'],
  ['DNS Lookup', 'dnsStart', 'dnsEnd'],
  ['Initial connection', 'connectStart', 'connectEnd'],
  ['SSL', 'sslStart', 'sslEnd'],
  ['Request sent', 'sendStart', 'sendEnd'],
  ['Waiting for server response', 'sendEnd', 'receiveHeadersStart'],
] as const;

function getTimingRows(value: unknown) {
  const timing = networkRecord(value);
  if (!timing) return [];
  return timingPhases.flatMap(([label, start, end]) => {
    const first = timing[start];
    const last = timing[end];
    return typeof first === 'number' && typeof last === 'number' && first >= 0 && last >= first
      ? [[label, formatNetworkTime(last - first)] as const]
      : [];
  });
}

function getQueryParameters(url?: string) {
  if (!url) return [];
  try {
    return Array.from(new URL(url).searchParams);
  } catch { return []; }
}

function getJsonPreview(value: unknown) {
  if (typeof value !== 'string') return value ?? undefined;
  try { return JSON.parse(value) as unknown; } catch { return undefined; }
}

function getStatusDotClass(status?: number | string) {
  const num = typeof status === 'number' ? status : Number(status);
  if (!Number.isFinite(num) || num <= 0) return 'bg-amber-500';
  if (num >= 400) return 'bg-rose-500';
  return 'bg-emerald-500';
}

export function NetworkRequestDetails({
  headers,
  payload,
  response,
  wrap,
  onWrapChange,
  formatValue,
  url,
  method,
  status,
  duration,
  requestHeaders,
  network,
}: {
  headers: unknown;
  payload: unknown;
  response: unknown;
  wrap: boolean;
  onWrapChange: (value: boolean) => void;
  formatValue: (value: any) => string;
  url?: string;
  method?: string;
  status?: number | string;
  duration?: string;
  requestHeaders?: unknown;
  network?: DevtoolsNetworkRequest;
}) {
  const [part, setPart] = useState('headers');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyVersion = useRef(0);
  useEffect(() => () => { copyVersion.current++; if (timer.current) clearTimeout(timer.current); }, []);

  const metadata = networkRecord(network?.data);
  const capturedResponseHeaders = metadata?.responseHeaders ?? (network?.event === 'Request' ? undefined : headers);
  const responseHeaderEntries = toHeaderEntries(capturedResponseHeaders);
  const requestHeaderEntries = toHeaderEntries(requestHeaders ?? (network?.event === 'Request' ? headers : undefined));
  const capturedStatus = network ? network.status : status;
  const statusText = typeof metadata?.failureText === 'string'
    ? metadata.failureText
    : typeof capturedStatus === 'number' && capturedStatus > 0 && typeof metadata?.statusText === 'string' && metadata.statusText
      ? `${capturedStatus} ${metadata.statusText}`
      : capturedStatus ? formatHttpStatus(capturedStatus) : '—';
  const methodText = (network ? network.method : method)?.toUpperCase() || '—';
  const urlText = getDevtoolsNetworkDisplayUrl(network?.url || url || '—');
  const totalTime = network ? formatNetworkTime(network.duration) : duration;
  const remoteAddress = typeof metadata?.remoteAddress === 'string' ? metadata.remoteAddress : undefined;
  const protocol = typeof metadata?.protocol === 'string' ? metadata.protocol : undefined;
  const queryParameters = getQueryParameters(urlText);
  const preview = getJsonPreview(response);
  const initiator = network ? getDevtoolsNetworkInitiator(network) : undefined;
  const initiatorRows = Object.entries(initiator ?? {})
    .filter(([, value]) => typeof value === 'string' || typeof value === 'number')
    .map(([key, value]) => [key, key === 'url' && typeof value === 'string' ? getDevtoolsNetworkDisplayUrl(value) : value]);
  const timingRows = getTimingRows(metadata?.timing);

  const formatHeadersCopyText = () => {
    const lines: string[] = [
      'General',
      `  Request URL: ${urlText}`,
      `  Request Method: ${methodText}`,
      `  Status Code: ${statusText}`,
    ];
    if (remoteAddress) lines.push(`  Remote Address: ${remoteAddress}`);
    if (protocol) lines.push(`  Protocol: ${protocol}`);
    lines.push('', 'Response Headers');
    if (responseHeaderEntries.length > 0) {
      responseHeaderEntries.forEach(([k, v]) => lines.push(`  ${k}: ${v}`));
    } else {
      lines.push(`  ${capturedResponseHeaders === undefined ? 'Response headers were not recorded.' : formatValue(capturedResponseHeaders)}`);
    }
    if (requestHeaderEntries.length > 0) {
      lines.push('', 'Request Headers');
      requestHeaderEntries.forEach(([k, v]) => lines.push(`  ${k}: ${v}`));
    }
    return lines.join('\n');
  };

  const queryText = queryParameters.map(([key, value]) => `${key}: ${value}`).join('\n');
  const payloadText = [queryText ? `Query String Parameters\n${queryText}` : '', payload != null ? `Request Payload\n${formatValue(payload)}` : ''].filter(Boolean).join('\n\n');
  const parts: { id: string; label: string; text?: string }[] = [
    { id: 'headers', label: 'Headers' },
    { id: 'payload', label: 'Payload', text: payloadText },
    ...(preview === undefined ? [] : [{ id: 'preview', label: 'Preview', text: formatValue(preview) }]),
    { id: 'response', label: 'Response', text: response != null ? formatValue(response) : '' },
    ...(initiatorRows.length ? [{ id: 'initiator', label: 'Initiator', text: initiatorRows.map(([key, value]) => `${key}: ${value}`).join('\n') }] : []),
    ...(totalTime && totalTime !== '-' && totalTime !== '—' || timingRows.length ? [{
      id: 'timing', label: 'Timing',
      text: [...timingRows.map(([label, value]) => `${label}: ${value}`), ...(totalTime && totalTime !== '-' && totalTime !== '—' ? [`Total: ${totalTime}`] : [])].join('\n'),
    }] : []),
  ];
  const current = parts.find(item => item.id === part) ?? parts[0];
  const copy = async () => {
    const version = ++copyVersion.current;
    try {
      const textToCopy = current.id === 'headers'
        ? formatHeadersCopyText()
        : current.text || '';
      await copyText(textToCopy);
      if (version !== copyVersion.current) return;
      setCopied(true); setError('');
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1800);
    } catch { if (version === copyVersion.current) setError('Could not copy. Select and copy the text manually.'); }
  };
  return <Tabs value={current.id} onValueChange={value => { copyVersion.current++; setPart(value); setCopied(false); setError(''); }} data-network-detail className="min-w-0">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <TabsList aria-label="Request details" className="h-auto flex-wrap justify-start">
        {parts.map(item => <TabsTrigger key={item.id} value={item.id}
          className="data-[state=active]:bg-teal-100 data-[state=active]:text-teal-900 dark:data-[state=active]:bg-teal-950 dark:data-[state=active]:text-teal-200">
          {item.label}
        </TabsTrigger>)}
      </TabsList>
      <div className="flex items-center gap-1">
        <Button type="button" variant="ghost" size="sm" aria-pressed={wrap} onClick={() => onWrapChange(!wrap)}>Word wrap</Button>
        <Button type="button" variant="outline" size="sm" aria-label={`Copy ${current.label}`} onClick={copy} disabled={current.id !== 'headers' && !current.text}>{copied ? <Check /> : <Copy />}{copied ? 'Copied' : 'Copy'}</Button>
      </div>
    </div>
    <TabsContent value="headers">
      <div
        tabIndex={0}
        aria-label="Request headers and response headers"
        data-lenis-prevent
        className={cn(
          'min-h-24 max-h-[34vh] resize-y divide-y divide-border overflow-auto overscroll-contain rounded-lg border border-border bg-muted/60 font-mono text-xs leading-relaxed text-foreground focus-visible:outline-2 focus-visible:outline-ring',
          wrap ? ' break-words' : 'whitespace-pre'
        )}
      >
        <details open className="group/sec p-2.5">
          <summary className="cursor-pointer select-none font-sans text-[11px] font-bold uppercase tracking-wider text-foreground">
            General
          </summary>
          <dl className="mt-2 space-y-1.5 pl-3">
            <div className="grid grid-cols-[130px_1fr] gap-2">
              <dt className="text-muted-foreground">Request URL:</dt>
              <dd className="break-all font-semibold text-foreground">{urlText}</dd>
            </div>
            <div className="grid grid-cols-[130px_1fr] gap-2">
              <dt className="text-muted-foreground">Request Method:</dt>
              <dd className="font-semibold text-indigo-700 dark:text-indigo-300">{methodText}</dd>
            </div>
            <div className="grid grid-cols-[130px_1fr] gap-2">
              <dt className="text-muted-foreground">Status Code:</dt>
              <dd className="flex items-center gap-1.5 font-semibold text-foreground">
                <span className={cn('inline-block h-2 w-2 shrink-0 rounded-full', getStatusDotClass(capturedStatus))} aria-hidden="true" />
                <span>{statusText}</span>
              </dd>
            </div>
            {remoteAddress && (
              <div className="grid grid-cols-[130px_1fr] gap-2">
                <dt className="text-muted-foreground">Remote Address:</dt>
                <dd className="break-all text-foreground">{remoteAddress}</dd>
              </div>
            )}
            {protocol && (
              <div className="grid grid-cols-[130px_1fr] gap-2">
                <dt className="text-muted-foreground">Protocol:</dt>
                <dd className="text-foreground">{protocol}</dd>
              </div>
            )}
          </dl>
        </details>

        <details open className="group/sec p-2.5">
          <summary className="cursor-pointer select-none font-sans text-[11px] font-bold uppercase tracking-wider text-foreground">
            Response Headers {responseHeaderEntries.length > 0 ? `(${responseHeaderEntries.length})` : ''}
          </summary>
          {responseHeaderEntries.length > 0 ? (
            <dl className="mt-2 space-y-1 pl-3">
              {responseHeaderEntries.map(([key, val]) => (
                <div key={key} className="grid grid-cols-[minmax(120px,180px)_1fr] gap-2">
                  <dt className="truncate text-muted-foreground" title={key}>{key}:</dt>
                  <dd className="break-all text-foreground">{val}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <pre className={cn('mt-2 pl-3 text-muted-foreground', wrap ? 'whitespace-pre-wrap break-words' : 'whitespace-pre')}>
              {capturedResponseHeaders === undefined ? 'Response headers were not recorded.' : formatValue(capturedResponseHeaders)}
            </pre>
          )}
        </details>

        <details open={requestHeaderEntries.length > 0} className="group/sec p-2.5">
          <summary className="cursor-pointer select-none font-sans text-[11px] font-bold uppercase tracking-wider text-foreground">
            Request Headers {requestHeaderEntries.length > 0 ? `(${requestHeaderEntries.length})` : ''}
          </summary>
          {requestHeaderEntries.length > 0 ? (
            <dl className="mt-2 space-y-1 pl-3">
              {requestHeaderEntries.map(([key, val]) => (
                <div key={key} className="grid grid-cols-[minmax(120px,180px)_1fr] gap-2">
                  <dt className="truncate text-muted-foreground" title={key}>{key}:</dt>
                  <dd className="break-all text-foreground">{val}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-2 pl-3 text-muted-foreground">Request headers were not recorded.</p>
          )}
        </details>
      </div>
    </TabsContent>
    {parts.filter(item => item.id !== 'headers').map(item => <TabsContent key={item.id} value={item.id}>
      <pre tabIndex={0} aria-label={item.label} data-lenis-prevent className={cn('min-h-24 max-h-[24vh] resize-y overflow-auto overscroll-contain rounded-lg border border-border bg-muted p-3 font-mono text-xs leading-relaxed text-foreground focus-visible:outline-2 focus-visible:outline-ring', wrap ? 'whitespace-pre-wrap break-words' : 'whitespace-pre')}>
        {item.text || (item.id === 'payload' ? 'No request payload was recorded.' : 'Response data was not recorded.')}
        {item.id === 'timing' && timingRows.length === 0 && '\nTiming breakdown was not recorded.'}
      </pre>
    </TabsContent>)}
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    <span role="status" className="sr-only">{copied ? `${current.label} copied` : ''}</span>
  </Tabs>;
}
