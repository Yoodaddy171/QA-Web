import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DEVTOOLS_CONSOLE_LEVELS,
  filterDevtoolsConsoleGroups,
  getDevtoolsConsoleSource,
} from './devtools-console';
import type { AutomationLogEntry } from './automation-event-client';

const entry = (level: string, log: string, url?: string): AutomationLogEntry => ({
  level,
  log,
  metadata: url ? { consoleDetails: { url, lineNumber: 4 } } : undefined,
});
const group = (...entries: AutomationLogEntry[]) => ({ log: entries[0], entries, count: entries.length });

describe('DevTools Console filters', () => {
  it('uses captured levels instead of guessing severity from the message', () => {
    const info = group(entry('INFO', 'An error is expected here'));
    const warning = group(entry('WARNING', 'Check this'));
    const error = group(entry('SEVERE', 'Unexpected response'));
    const verbose = group(entry('VERBOSE', 'Debug line'));
    const groups = [info, warning, error, verbose];

    expect(filterDevtoolsConsoleGroups(groups, '', DEFAULT_DEVTOOLS_CONSOLE_LEVELS)).toEqual([info, warning, error]);
    expect(filterDevtoolsConsoleGroups(groups, '', ['error'])).toEqual([error]);
    expect(filterDevtoolsConsoleGroups(groups, '', [])).toEqual([]);
  });

  it('combines regex, text, and script URL filters without matching unrelated URLs in log text', () => {
    const expected = group(entry('INFO', 'Request 422 failed', 'https://example.test/src/client.js'));
    const otherScript = group(entry('INFO', 'Request 422 failed', 'https://example.test/src/worker.js'));
    const legacy = group(entry('INFO', 'Request 422 failed at https://example.test/src/client.js'));
    const differentMessage = group(entry('INFO', 'Request 200 passed', 'https://example.test/src/client.js'));
    const groups = [expected, otherScript, legacy, differentMessage];

    expect(filterDevtoolsConsoleGroups(groups, '/^request \\d{3}/ failed url:CLIENT.js', ['info'])).toEqual([expected]);
    expect(filterDevtoolsConsoleGroups(groups, 'failed -url:worker.js', ['info'])).toEqual([expected, legacy]);
    expect(filterDevtoolsConsoleGroups(groups, 'worker.js:5', ['info'])).toEqual([otherScript]);
    expect(filterDevtoolsConsoleGroups(groups, '-/^request 422/', ['info'])).toEqual([differentMessage]);
  });

  it('keeps the count and representative of filtered repeated messages accurate', () => {
    const first = entry('INFO', 'Ready', 'https://example.test/a.js');
    const second = entry('INFO', 'Ready', 'https://example.test/b.js');
    expect(filterDevtoolsConsoleGroups([group(first, second)], 'url:b.js', ['info'])).toEqual([group(second)]);
    expect(getDevtoolsConsoleSource(second)).toMatchObject({ label: 'b.js:5' });
    expect(getDevtoolsConsoleSource(entry('INFO', 'Legacy log'))).toBeNull();
  });

  it('treats invalid regular expressions as text', () => {
    const literal = group(entry('INFO', 'Filter /[/ was rejected'));
    expect(filterDevtoolsConsoleGroups([literal], '/[/', ['info'])).toEqual([literal]);
  });
});
