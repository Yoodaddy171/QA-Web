import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TestCaseStatusCell } from './TestCaseStatusCell';

describe('dormant testcase status selector', () => {
  it('preserves its accessible trigger without mounting a Radix option collection', () => {
    const html = renderToStaticMarkup(createElement(TestCaseStatusCell, {
      id:'case-id', displayId:'CASE-001', status:'READY TO RETEST',
      onChange:()=>{}, celebrate:()=>{}, color:()=>'', icon:()=>null,
    }));
    expect(html).toContain('role="combobox"');
    expect(html).toContain('aria-label="Status for CASE-001"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-controls="status-options-case-id"');
    expect(html).toContain('READY TO RETEST');
    expect(html).not.toContain('role="option"');
    expect(html).not.toContain('<select');
  });
});
