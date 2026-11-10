import { describe, expect, it } from 'vitest';
import {
  createDevtoolsNetworkPredicate, DEFAULT_DEVTOOLS_NETWORK_FILTERS, getDevtoolsNetworkDisplayUrl, getDevtoolsNetworkType,
  type DevtoolsNetworkFilterState, type DevtoolsNetworkRequest,
} from './devtools-network';

const failedOrder: DevtoolsNetworkRequest = {
  url: 'https://api.example.test/orders?include=items',
  method: 'POST', status: 422, headers: { 'Content-Type': 'application/json; charset=utf-8' },
  data: { resourceType: 'xhr', transferSize: 2_000 },
};

function filter(overrides: Partial<DevtoolsNetworkFilterState>) {
  return createDevtoolsNetworkPredicate({ ...DEFAULT_DEVTOOLS_NETWORK_FILTERS, ...overrides });
}

describe('DevTools Network filtering', () => {
  it('combines matching properties with AND using only recorded values', () => {
    const matches = filter({ query: 'method:POST status-code:422 domain:*.example.test mime-type:application/json has-response-header:content-type scheme:https larger-than:1K' });
    expect(matches(failedOrder)).toBe(true);
    expect(matches({ ...failedOrder, status: 200 })).toBe(false);
    expect(matches({ ...failedOrder, url: 'https://api.example.test.invalid/orders' })).toBe(false);
    expect(matches({ ...failedOrder, data: {} })).toBe(false);
    expect(filter({ query: 'larger-than:2K' })(failedOrder)).toBe(true);
    expect(filter({ query: 'has-response-header:content-type' })({ ...failedOrder, event: 'Request' })).toBe(false);
  });

  it('supports URL substrings, regular expressions, negative terms and inversion', () => {
    expect(filter({ query: 'ORDERS -status-code:200' })(failedOrder)).toBe(true);
    expect(filter({ query: '/orders\\?include=/' })(failedOrder)).toBe(true);
    expect(filter({ query: '/^api\\.example\\.test/' })(failedOrder)).toBe(true);
    expect(filter({ query: 'url:include=items -orders' })(failedOrder)).toBe(false);
    expect(filter({ query: 'method:POST status-code:422', invert: true })(failedOrder)).toBe(false);
    expect(filter({ query: 'method:GET status-code:422', invert: true })(failedOrder)).toBe(false);
    expect(filter({ query: '-method:POST status-code:200', invert: true })(failedOrder)).toBe(true);
    expect(filter({ query: 'status-code:200', invert: true })(failedOrder)).toBe(true);
    expect(filter({ query: '/[/' })(failedOrder)).toBe(false);
  });

  it('filters actual resource types and handles legacy requests without assigning fake types', () => {
    const stylesheet: DevtoolsNetworkRequest = { url: 'https://cdn.example.test/app', data: { resourceType: 'StyleSheet' } };
    const legacy: DevtoolsNetworkRequest = { url: 'https://example.test/unknown', status: 200 };
    const matchTyped = filter({ types: ['CSS', 'Fetch/XHR'] });
    expect(matchTyped(stylesheet)).toBe(true);
    expect(matchTyped(failedOrder)).toBe(true);
    expect(matchTyped(legacy)).toBe(false);
    expect(filter({ types: ['Other'] })(legacy)).toBe(true);
    expect(getDevtoolsNetworkType(legacy)).toBeUndefined();
    expect(filter({ hideDataUrls: true, hideExtensionUrls: true })({ url: 'data:text/plain,fixture' })).toBe(false);
    expect(filter({ hideDataUrls: true, hideExtensionUrls: true })({ url: 'chrome-extension://fixture/script.js' })).toBe(false);
    expect(filter({})(legacy)).toBe(true);
  });

  it('includes legacy API responses in Fetch/XHR without fabricating a browser resource type', () => {
    const legacy = { ...failedOrder, data: { responseBody: '{"error":"fixture"}' } };
    const fetch = filter({ types: ['Fetch/XHR'] });
    expect(fetch(legacy)).toBe(true);
    expect(getDevtoolsNetworkType(legacy)).toBeUndefined();
    expect(filter({ query: 'resource-type:fetch' })(legacy)).toBe(false);
    expect(filter({ types: ['Other'] })(legacy)).toBe(false);
    expect(fetch({ url: 'https://example.test/api/orders', method: 'GET' })).toBe(true);
    expect(fetch({ ...legacy, data: { resourceType: 'Document' } })).toBe(false);
    expect(fetch({ ...legacy, data: { resourceType: 'Other' } })).toBe(false);
    expect(fetch({ ...legacy, method: 'OPTIONS' })).toBe(false);
    expect(fetch({ ...legacy, url: 'https://example.test/assets/config.json' })).toBe(false);
    expect(fetch({ ...legacy, headers: { 'Content-Type': 'application/manifest+json' } })).toBe(false);
    expect(fetch({ ...legacy, data: { requestHeaders: { 'Sec-Fetch-Dest': 'document' } } })).toBe(false);
  });

  it('hides known sensitive query values when displaying a legacy URL', () => {
    const url = new URL(getDevtoolsNetworkDisplayUrl('https://api.example.test/orders?token=fixture-secret&state=active'));
    expect(url.searchParams.get('token')).toBe('[REDACTED]');
    expect(url.searchParams.get('state')).toBe('active');
  });
});
