import type { AutomationLogEntry } from './automation-event-client';

export const DEVTOOLS_CONSOLE_LEVELS = [
  { value: 'verbose', label: 'Verbose' },
  { value: 'info', label: 'Info' },
  { value: 'warning', label: 'Warnings' },
  { value: 'error', label: 'Errors' },
] as const;

export type DevtoolsConsoleLevel = (typeof DEVTOOLS_CONSOLE_LEVELS)[number]['value'];
export const DEFAULT_DEVTOOLS_CONSOLE_LEVELS: readonly DevtoolsConsoleLevel[] = ['info', 'warning', 'error'];

type ConsoleEntry = Pick<AutomationLogEntry, 'level' | 'log' | 'message' | 'metadata'>;

export function getDevtoolsConsoleLevel(log: ConsoleEntry): DevtoolsConsoleLevel {
  switch (log.level?.toLowerCase()) {
    case 'assert':
    case 'error':
    case 'severe':
      return 'error';
    case 'warn':
    case 'warning':
      return 'warning';
    case 'debug':
    case 'verbose':
      return 'verbose';
    default:
      return 'info';
  }
}

export function getDevtoolsConsoleSource(log: ConsoleEntry) {
  const details = log.metadata?.consoleDetails;
  if (!details || typeof details !== 'object' || !('url' in details) || typeof details.url !== 'string' || !details.url) return null;
  const { url } = details;
  const lineNumber = 'lineNumber' in details && typeof details.lineNumber === 'number' && details.lineNumber >= 0 ? details.lineNumber : undefined;
  const columnNumber = 'columnNumber' in details && typeof details.columnNumber === 'number' && details.columnNumber >= 0 ? details.columnNumber : undefined;
  const filename = url.split(/[?#]/, 1)[0].split('/').at(-1) || url;
  return { url, lineNumber, columnNumber, label: lineNumber === undefined ? filename : `${filename}:${lineNumber + 1}` };
}

export function getDevtoolsConsoleText(log: ConsoleEntry): string {
  const value = log.log ?? log.message ?? '';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

function parseConsoleFilter(query: string) {
  const tokens = query.matchAll(/(-?)(?:url:([^\s]*)|\/((?:\\.|[^/\\])+)\/(?=\s|$)|([^\s]+))/g);
  return Array.from(tokens, ([, sign, url, pattern, text]) => {
    const negative = sign === '-';
    if (url !== undefined) return { negative, url: url.toLowerCase() };
    if (pattern) {
      try {
        return { negative, regex: new RegExp(pattern, 'im') };
      } catch {
        return { negative, text: `/${pattern}/`.toLowerCase() };
      }
    }
    return { negative, text: text.toLowerCase() };
  });
}

export function filterDevtoolsConsoleGroups<T extends ConsoleEntry, G extends { log: T; entries: T[]; count: number }>(
  groups: G[], query: string, levels: readonly DevtoolsConsoleLevel[],
): G[] {
  const tokens = parseConsoleFilter(query);
  const levelMask = new Set(levels);
  return groups.flatMap(group => {
    const entries = group.entries.filter(log => {
      if (!levelMask.has(getDevtoolsConsoleLevel(log))) return false;
      if (!tokens.length) return true;

      const source = getDevtoolsConsoleSource(log);
      const message = getDevtoolsConsoleText(log);
      return tokens.every(token => {
        let matches: boolean;
        if (token.url !== undefined) {
          matches = !!source && source.url.toLowerCase().includes(token.url);
        } else if (token.regex) {
          matches = token.regex.test(message) || (!!source && token.regex.test(source.label));
        } else {
          matches = message.toLowerCase().includes(token.text) || (!!source && source.label.toLowerCase().includes(token.text));
        }
        return matches !== token.negative;
      });
    });

    if (!entries.length) return [];
    return [entries.length === group.entries.length ? group : { ...group, log: entries[0], entries, count: entries.length }];
  });
}
