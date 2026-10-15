import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { BugFixStatusCell } from './BugFixStatusCell';

describe('dormant Bugs status trigger', () => {
  it.each(['SUDAH DILAPORKAN', 'SEDANG DI FIX', 'READY TO RETEST'])('has honest button/popup semantics for %s', status => {
    const onChange = vi.fn();
    const html = renderToStaticMarkup(createElement(BugFixStatusCell, {
      id: 'bug-a', displayId: 'QA-001', status, color: 'qa-status', onChange,
    }));
    expect(html).toContain('<button');
    expect(html).toContain('aria-haspopup="listbox"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-label="Status for bug QA-001"');
    expect(html).not.toContain('role="combobox"');
    expect(html).not.toContain('aria-controls=');
    expect(html).toContain(status === 'SUDAH DILAPORKAN' ? 'DILAPORKAN' : status);
    expect(onChange).not.toHaveBeenCalled();
  });
});
