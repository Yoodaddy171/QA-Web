import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SystemDevLogHeader } from './SystemDevLogHeader';

const props = { socketReady: false, activeDevLogTab: 'execution', groupedConsoleLogs: [], groupedNetworkLogs: [], loadedRunLabel: 'current', isLoadingHistory: false };
describe('script viewer isolation from manual capture actions', () => {
  it('does not expose destructive manual log actions or the wrong AI summary in script mode', () => {
    const markup = renderToStaticMarkup(<SystemDevLogHeader {...props} scriptMode />);
    for (const text of ['Execution', 'Console', 'Network', 'Playwright run', 'Fullscreen']) expect(markup).toContain(text);
    for (const text of ['AI Summary', 'Current', 'Previous', 'lucide-trash-2', 'Live Relay']) expect(markup).not.toContain(text);
  });
  it('preserves the incumbent manual toolbar', () => {
    const markup = renderToStaticMarkup(<SystemDevLogHeader {...props} />);
    for (const text of ['AI Summary', 'Current', 'Previous']) expect(markup).toContain(text);
  });
});
