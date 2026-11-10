import { describe, expect, it } from 'vitest';
import { renderHtml } from './evidence-renderer';
import type { EvidenceRecord } from './route';
const record: EvidenceRecord = { id: 'uuid-case', projectId: 'project', testCaseId: 'TC-001', page: 'Checkout', testType: 'Positive', testAction: 'Submit checkout', steps: 'Click submit', expectedResult: 'Order created', status: 'NOT DONE', actualResult: 'Not As Expected', createdAt: new Date('2026-10-26'), updatedAt: new Date('2026-10-26') };
const render = (overrides: Partial<EvidenceRecord> = {}) => renderHtml({ record: { ...record, ...overrides }, type: 'TestCase', logs: [], recording: null, frames: [], video: null });
describe('evidence report presentation', () => {
  it('does not classify NOT DONE or Not As Expected as passing', () => {
    expect(render()).toContain('class="status neutral">NOT DONE');
    expect(render()).toContain('class="status fail">Not As Expected');
    expect(render({ status: 'FAILED' })).toContain('class="status fail">FAILED');
    expect(render({ status: 'DONE', actualResult: 'As Expected' })).toContain('class="status pass">DONE');
    expect(render({ status: 'VERIFIED & FIXED' })).toContain('class="status pass">VERIFIED &amp; FIXED');
  });
  it('escapes stored text and script payloads, including log IDs', () => {
    const html = renderHtml({ record: { ...record, testAction: '<img src=x onerror=alert(1)>' }, type: 'TestCase', logs: [{ id: 'bad" onclick="alert(1)', tab: 'console', order: 0, message: '</script><script>alert(1)</script>' }], recording: null, frames: [], video: null });
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).not.toContain('</script><script>alert(1)</script>');
    expect(html).toContain('escapeHtmlClient(log.id)');
  });
  it('keeps a usable log viewer with no visual recording and includes print summaries', () => {
    const html = render();
    expect(html).toContain('id="logList"');
    expect(html).toContain('Rekaman visual belum tersedia.');
    expect(html).toContain('id="printReport"');
    expect(html).toContain('class="log-appendix"');
    expect(html).not.toContain('Log lengkap yang relevan');
    expect(html).toContain('video?.startedAtRelativeMs');
    expect(html).not.toContain('getTimelineBounds');
  });
  it('retains every provided log in the printable appendix', () => {
    const html = renderHtml({ record, type: 'TestCase', logs: Array.from({ length: 150 }, (_, i) => ({ id: `event-${i}`, tab: 'network' as const, order: i, relativeMs: i * 100, method: 'GET', status: 200, message: `request-${i}` })), recording: null, frames: [], video: null });
    expect(html).toContain('150 event disertakan');
    expect(html).toContain('<td>request-149</td>');
    expect(html.match(/<tr>/g)).toHaveLength(151);
  });
  it('keeps evidence first, labelled filters, selected-state semantics and a logs-only layout', () => {
    const html = renderHtml({ record, type: 'TestCase', logs: [{ id: 'network-event', tab: 'network', order: 0, message: 'Synthetic', status: 422 }], recording: null, frames: [], video: null });
    expect(html.indexOf('id="evidence"')).toBeLessThan(html.indexOf('id="scenario"'));
    expect(html).toContain('viewer viewer-logs-only');
    expect(html).toContain('id="resetNetworkFilters"');
    expect(html).toContain('aria-label="Sertakan kategori network"');
    expect(html).toContain('Fetch/XHR');
    expect(html).toContain('Request URL:');
    expect(html).toContain('Request Method:');
    expect(html).toContain('Status Code:');
    expect(html).toContain('Response Headers');
    expect(html).toContain('Request Headers');
    expect(html).toContain('id="detailContext"');
    expect(html).toContain("button.setAttribute('aria-pressed'");
    expect(html).toContain('scrollbar-gutter:stable');
    expect(html).not.toMatch(/<script[^>]+src=|<link[^>]+href=/);
  });
});
