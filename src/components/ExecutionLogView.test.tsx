import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ExecutionLogView } from './ExecutionLogView';

describe('Fullscreen execution selection', () => {
  const logs = [{ id: 'step-1', relativeMs: 1200, isExecution: true, eventType: 'step', log: 'Buka halaman pesanan' }];
  it('FS-05 exposes the selected event without changing the activity text', () => {
    const html = renderToStaticMarkup(<ExecutionLogView logs={logs} selectedLogId="step-1" onSelectLog={() => {}} />);
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('Buka halaman pesanan');
    expect(html).toContain('ring-inset');
  });
  it('FS-05 does not mark another event as selected', () => {
    const html = renderToStaticMarkup(<ExecutionLogView logs={logs} selectedLogId="other-step" onSelectLog={() => {}} />);
    expect(html).not.toContain('aria-pressed="true"');
  });
});
