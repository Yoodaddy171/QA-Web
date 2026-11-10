'use client';

import { memo, useDeferredValue, useMemo, useState, type RefObject } from 'react';
import { ChevronDown } from 'lucide-react';
import { DevlogConsoleLevelIcon, DevlogEmptyState } from '@/components/DevlogPanelChrome';
import { DevtoolsConsoleFilters } from '@/components/DevtoolsConsoleFilters';
import { VirtualLogList } from '@/components/VirtualLogList';
import type { ConsoleLogGroup, LogEntry } from '@/components/TestCaseDetailDialog.helpers';
import {
  DEFAULT_DEVTOOLS_CONSOLE_LEVELS,
  filterDevtoolsConsoleGroups,
  getDevtoolsConsoleLevel,
  getDevtoolsConsoleSource,
  getDevtoolsConsoleText,
  type DevtoolsConsoleLevel,
} from '@/lib/client/automation/devtools-console';
import { cn } from '@/lib/utils';

type ConsoleLogViewProps = {
  groupedConsoleLogs: ConsoleLogGroup[];
  logEndRef?: RefObject<HTMLDivElement | null>;
  expandedLogId: string | null;
  setExpandedLogId: (id: string | null) => void;
  seekRecordingFromLog: (log: LogEntry) => void;
  formatRelativeTime: (relativeMs?: number) => string;
  getConsoleLogText: (log: LogEntry) => string;
  formatPrettyValue: (value: unknown) => string;
  query?: string;
  levels?: readonly DevtoolsConsoleLevel[];
  onQueryChange?: (value: string) => void;
  onLevelsChange?: (levels: DevtoolsConsoleLevel[]) => void;
};

const groupKey = (group: ConsoleLogGroup) => group.id;
const countMessages = (groups: ConsoleLogGroup[]) => groups.reduce((sum, group) => sum + group.count, 0);

export const ConsoleLogView = memo(function ConsoleLogView({
  groupedConsoleLogs, logEndRef, expandedLogId, setExpandedLogId,
  seekRecordingFromLog, formatRelativeTime, getConsoleLogText, formatPrettyValue,
  query, levels, onQueryChange, onLevelsChange,
}: ConsoleLogViewProps) {
  const [localQuery, setLocalQuery] = useState('');
  const [localLevels, setLocalLevels] = useState<readonly DevtoolsConsoleLevel[]>(DEFAULT_DEVTOOLS_CONSOLE_LEVELS);
  const filterQuery = query ?? localQuery;
  const filterLevels = levels ?? localLevels;
  const deferredQuery = useDeferredValue(filterQuery);
  const visibleGroups = useMemo(
    () => filterDevtoolsConsoleGroups(groupedConsoleLogs, deferredQuery, filterLevels),
    [groupedConsoleLogs, deferredQuery, filterLevels],
  );
  const hiddenCount = useMemo(
    () => countMessages(groupedConsoleLogs) - countMessages(visibleGroups),
    [groupedConsoleLogs, visibleGroups],
  );

  return (
    <div className="min-w-0">
      <div className="sticky top-0 z-10 bg-background">
        <DevtoolsConsoleFilters
          query={filterQuery}
          onQueryChange={onQueryChange ?? setLocalQuery}
          levels={filterLevels}
          onLevelsChange={onLevelsChange ?? setLocalLevels}
          hiddenCount={hiddenCount}
        />
      </div>
      {!visibleGroups.length ? (
        <DevlogEmptyState kind="console" title={hiddenCount ? 'No matching messages' : 'No messages recorded'}
          hint={hiddenCount ? 'Clear the filter or change the selected levels.' : undefined} />
      ) : (
        <VirtualLogList items={visibleGroups} itemKey={groupKey} activeId={expandedLogId} estimate={32}>{group => {
          const { log, entries, count, id } = group;
          const level = getDevtoolsConsoleLevel(log);
          const source = getDevtoolsConsoleSource(log);
          const isObject = typeof log.log === 'object';
          const fullMessage = getDevtoolsConsoleText(log);
          const message = isObject && fullMessage.length > 200 ? `${fullMessage.slice(0, 200)}…` : fullMessage;
          const canExpand = count > 1 || isObject;
          const expanded = canExpand && expandedLogId === id;

          return (
            <div className={cn(
              'border-b border-border',
              level === 'error' && 'bg-rose-50 dark:bg-rose-950/20',
              level === 'warning' && 'bg-amber-50 dark:bg-amber-950/20',
            )}>
              <button
                type="button"
                aria-expanded={canExpand ? expanded : undefined}
                className="flex w-full cursor-pointer items-start gap-2 px-2 py-1.5 text-left leading-5 hover:bg-foreground/5 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                onClick={() => {
                  seekRecordingFromLog(log);
                  if (canExpand) setExpandedLogId(expanded ? null : id);
                }}
              >
                <DevlogConsoleLevelIcon level={level} />
                {count > 1 && <span aria-label={`${count} occurrences`} className="shrink-0 rounded-full bg-muted px-1.5 tabular-nums text-muted-foreground">{count}</span>}
                {canExpand && <ChevronDown aria-hidden="true" className={cn('mt-0.5 size-3.5 shrink-0 -rotate-90 text-muted-foreground motion-safe:transition-transform motion-safe:duration-[var(--motion-fast)]', expanded && 'rotate-0')} />}
                <span className="min-w-0 flex-1 whitespace-pre-wrap break-words font-mono text-foreground">{message}</span>
                {(source || typeof log.relativeMs === 'number') && (
                  <span className="ml-auto flex max-w-[38%] shrink-0 flex-wrap items-baseline justify-end gap-x-2 text-muted-foreground">
                    {source && <span className="truncate" title={source.url}>{source.label}</span>}
                    {typeof log.relativeMs === 'number' && <span className="tabular-nums" title="Recording time">{formatRelativeTime(log.relativeMs)}</span>}
                  </span>
                )}
              </button>
              {expanded && (
                <div className="devlog-inline-detail-enter space-y-2 px-6 pb-2">
                  {count > 1 && (
                    <div className="max-h-44 space-y-1 overflow-y-auto">
                      {entries.map((entry, index) => (
                        <button
                          key={entry.id ?? `${id}-repeat-${index}`}
                          type="button"
                          className="grid w-full cursor-pointer grid-cols-[auto_1fr] gap-2 rounded px-1.5 py-1 text-left hover:bg-foreground/5 focus-visible:outline-2 focus-visible:outline-ring"
                          onClick={() => seekRecordingFromLog(entry)}
                        >
                          <span className="tabular-nums text-muted-foreground">{formatRelativeTime(entry.relativeMs)}</span>
                          <span className="truncate">{getConsoleLogText(entry)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {isObject && <pre className="overflow-x-auto whitespace-pre-wrap break-words text-foreground">{formatPrettyValue(log.log)}</pre>}
                </div>
              )}
            </div>
          );
        }}</VirtualLogList>
      )}
      <div ref={logEndRef} className="h-4" />
    </div>
  );
});
