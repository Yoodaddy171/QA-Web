import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table';

describe('8C1 shared table scroll owner', () => {
  it('keeps region accessibility and scrolling on the container, not the table', () => {
    const html = renderToStaticMarkup(<Table className="qa-data-table" containerClassName="overflow-auto max-h-96" containerProps={{role:'region',tabIndex:0,'aria-label':'Cases'}}><TableBody><TableRow><TableCell>AUTH-001</TableCell></TableRow></TableBody></Table>);
    expect(html).toMatch(/<div[^>]+role="region"[^>]+tabindex="0"[^>]+aria-label="Cases"/);
    expect(html).toContain('overflow-auto');
    expect(html).not.toContain('overflow-x-auto');
    expect(html).toMatch(/<table[^>]+qa-data-table/);
    expect(html).not.toMatch(/<table[^>]+role="region"/);
    expect(html).toContain('AUTH-001');
  });
  it('preserves the original container behavior for all unmodified consumers', () => {
    const html = renderToStaticMarkup(<Table aria-label="Other module" />);
    expect(html).toContain('overflow-x-auto');
    expect(html).toMatch(/<table[^>]+aria-label="Other module"/);
    expect(html).not.toContain('tabindex');
  });
});

describe('TABLE-TOOLTIP-01: shared table tooltip', () => {
  it('replaces native titles without changing table semantics or adding focus stops', () => {
    const html = renderToStaticMarkup(<Table><TableHeader><TableRow><TableHead title="Sort by page">Page</TableHead></TableRow></TableHeader><TableBody><TableRow><TableCell title="Full scenario" className="truncate">Scenario</TableCell></TableRow></TableBody></Table>);
    expect(html).not.toContain('title=');
    expect(html).not.toContain('tabindex');
    expect(html).not.toContain('<button');
    expect(html).toMatch(/<th[^>]*data-state="closed"/);
    expect(html).toMatch(/<td[^>]*data-state="closed"[^>]*>Scenario<\/td>/);
  });

  it('supports explicit tooltip content and a deliberate opt-out', () => {
    const html = renderToStaticMarkup(<Table><TableBody><TableRow><TableCell tooltip="Full value">Value</TableCell><TableCell tooltip={false} title="Not a tooltip">No tooltip</TableCell><TableCell colSpan={2}>Empty state</TableCell></TableRow></TableBody></Table>);
    expect(html.match(/data-state="closed"/g)).toHaveLength(1);
    expect(html).not.toContain('title=');
    expect(html).toContain('colSpan="2"');
    expect(html).toContain('Empty state');
  });
});
