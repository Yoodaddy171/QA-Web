import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { NetworkRequestDetails } from './NetworkRequestDetails';
import { DevlogSearchEmpty } from './DevlogSearchBar';
import { dedupeNetworkLogs, formatHttpStatus, getNetworkMeta } from './TestCaseDetailDialog.helpers';

describe('Request review surface', () => {
  it('FS-UP-03 keeps all request sections reachable and initially shows DevTools-style Headers', () => {
    const html = renderToStaticMarkup(
      <NetworkRequestDetails
        url="https://api.example.com/v1/orders"
        method="POST"
        status={201}
        duration="142ms"
        headers={{ 'content-type': 'application/json' }}
        requestHeaders={{ authorization: 'Bearer [REDACTED]' }}
        payload={{ order: 1 }}
        response={{ accepted: true }}
        wrap
        onWrapChange={() => {}}
        formatValue={value => JSON.stringify(value)}
      />
    );
    expect(html).toContain('role="tablist"');
    expect(html).toContain('Headers'); expect(html).toContain('Payload'); expect(html).toContain('Response');
    expect(html).toContain('General');
    expect(html).toContain('Request URL:');
    expect(html).toContain('https://api.example.com/v1/orders');
    expect(html).toContain('Request Method:');
    expect(html).toContain('POST');
    expect(html).toContain('Status Code:');
    expect(html).toContain('201 Created');
    expect(html).toContain('Response Headers');
    expect(html).toContain('application/json');
    expect(html).toContain('Request Headers');
    expect(html).toContain('Bearer [REDACTED]');
    expect(html).toContain('aria-label="Copy Headers"');
    expect(html).toContain('Preview');
    expect(html).toContain('Timing');
    expect(html).toContain('data-lenis-prevent');
  });
  it('classifies Fetch/XHR API traffic separately from static assets and deduplicates Request-only rows', () => {
    expect(getNetworkMeta({
      url: 'https://app.example.com/orders',
      method: 'GET',
      status: 200,
      data: { resourceType: 'fetch' },
    })).toMatchObject({ category: 'business', label: 'Fetch/XHR' });

    expect(getNetworkMeta({
      url: 'https://app.example.com/chunk-abc.js',
      method: 'GET',
      status: 200,
      data: { resourceType: 'script' },
    })).toMatchObject({ category: 'script', label: 'Script' });

    const deduped = dedupeNetworkLogs([
      { id: 'req-1', isNetwork: true, network: { event: 'Request', method: 'POST', url: 'https://api.example.com/login' } },
      { id: 'res-1', isNetwork: true, network: { event: 'Response', method: 'POST', url: 'https://api.example.com/login', status: 200 } },
    ]);
    expect(deduped).toHaveLength(1);
    expect(deduped[0].id).toBe('res-1');
    expect(formatHttpStatus(422)).toBe('422 Unprocessable Entity');
  });
  it('FS-UP-01 escapes user search text in its empty state and offers recovery', () => {
    const html = renderToStaticMarkup(<DevlogSearchEmpty query="<script>" onReset={() => {}} />);
    expect(html).toContain('&lt;script&gt;'); expect(html).toContain('Hapus pencarian');
  });
});
