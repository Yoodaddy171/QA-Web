import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Table, TableBody, TableCell, TableRow } from './table';

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
