'use client';

import { X, Wrench } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DevlogFullscreenDialog } from '@/components/DevlogFullscreenDialog';
import { cn } from '@/lib/utils';
import { ExecutionLogView } from '@/components/ExecutionLogView';
import { VirtualLogList } from '@/components/VirtualLogList';
import { useDevlogTabMemory } from '@/hooks/use-devlog-tab-memory';
import { useDevlogSearch } from '@/hooks/use-devlog-search';
import { DevlogFilterBar, DevlogSearchEmpty } from '@/components/DevlogSearchBar';
import { DevlogConsoleLevelIcon, DevlogEmptyState, DevlogTabs } from '@/components/DevlogPanelChrome';
import { DEVTOOLS_NETWORK_GRID, DevtoolsNetworkCells, DevtoolsNetworkColumns } from '@/components/DevtoolsNetworkFilters';
import { getDevtoolsConsoleLevel, getDevtoolsConsoleSource } from '@/lib/client/automation/devtools-console';
import { NetworkRequestDetails } from '@/components/NetworkRequestDetails';
import { recordingRunCaption } from '@/lib/client/automation/devlog-review';
import { RecordingEventNavigation } from '@/components/RecordingEventNavigation';
import { getExecutionInteraction, getExecutionLogText } from '@/components/TestCaseDetailDialog.helpers';

type SystemDevLogFullscreenProps = Record<string, any>;

export function SystemDevLogFullscreen(props: SystemDevLogFullscreenProps) {
  const {
    isSystemDevLogFullscreen, activeDevLogTab, fullscreenNetworkGroups: allNetworkGroups, fullscreenConsoleGroups: allConsoleGroups, viewTestCase,
    setActiveDevLogTab, setSelectedSystemDevLogId, selectedSystemDevLogId, setIsSystemDevLogFullscreen,
    networkCodeWrap, setNetworkCodeWrap, closeSystemDevLogFullscreen,
    selectedFullscreenLog, setSelectedFullscreenLog, filteredFullscreenLogs,
    selectedSystemNetworkGroup, selectedSystemConsoleGroup, selectedSystemExecutionLog, executionLogs: allExecutionLogs, formatRelativeTime,
    getNetworkMethod, getNetworkCategoryClass, getNetworkStatusClass, getNetworkStatus,
    getNetworkDuration, networkCodePanelClass, networkCodeWhitespaceClass, formatPrettyValue,
    getRequestHeaders, getRequestPayload, getResponsePayload, networkFullscreenCodePanelClass, seekRecordingFromLog, getConsoleLogText,
  } = props;
  const search = useDevlogSearch({ executionLogs: allExecutionLogs, networkGroups: allNetworkGroups, consoleGroups: allConsoleGroups,
    tab: activeDevLogTab, filters: props.devtoolsFilters });
  const { execution: executionLogs, network: fullscreenNetworkGroups, console: fullscreenConsoleGroups } = search;
  const { listRef, changeTab, rememberScroll } = useDevlogTabMemory({
    tab: activeDevLogTab, selection: selectedSystemDevLogId,
    onTabChange: setActiveDevLogTab, onSelectionChange: setSelectedSystemDevLogId,
  });
  return (
    <DevlogFullscreenDialog open={isSystemDevLogFullscreen} onClose={closeSystemDevLogFullscreen}
      title="System DevLog Fullscreen" description={`Tinjau aktivitas, console, dan network testcase ${viewTestCase?.testCaseId || ''}.`}>
            <div className="flex h-dvh w-full overflow-hidden bg-background">
              <div className="flex min-w-0 flex-1 flex-col">
                <header className="shrink-0 space-y-3 border-b border-border bg-card px-3 py-3 sm:px-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-2.5">
                      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-200">
                        <Wrench className="size-4" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-base font-semibold leading-tight">Devlog</p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground" title={viewTestCase?.testAction}>
                          {viewTestCase?.testCaseId || 'Test case'}{viewTestCase?.testAction ? ` · ${viewTestCase.testAction}` : ''}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{recordingRunCaption(props.runLabel, props.runStartedAt)}</p>
                      </div>
                    </div>
                    <Button type="button" variant="outline" size="icon" className="size-9 shrink-0" onClick={closeSystemDevLogFullscreen}
                      aria-label="Close fullscreen DevLog" title="Close fullscreen DevLog">
                      <X aria-hidden="true" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <DevlogTabs active={activeDevLogTab} onChange={changeTab} className="w-full sm:w-auto"
                      counts={{ execution: allExecutionLogs.length, console: allConsoleGroups.length, network: allNetworkGroups.length }} />
                    {activeDevLogTab === 'console' && <Button type="button" variant="outline" size="sm" aria-pressed={networkCodeWrap}
                      onClick={() => setNetworkCodeWrap((current: boolean) => !current)}>Wrap {networkCodeWrap ? 'On' : 'Off'}</Button>}
                  </div>
                </header>

                <DevlogFilterBar tab={activeDevLogTab} search={search} />
                {props.navigationEvents?.length > 0 && <div className="shrink-0 border-b border-border px-3 py-1"><RecordingEventNavigation events={props.navigationEvents} selectedId={props.selectedSyncedEventId} currentMs={props.recordingDisplayMs} onSelect={props.seekRecordingFromSyncedEvent} /></div>}

                <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-2 bg-background lg:grid-cols-[minmax(290px,36%)_1fr] lg:grid-rows-1">
                  <div key={activeDevLogTab} ref={listRef} onScroll={rememberScroll} data-lenis-prevent className={cn(
                    'devlog-view-enter min-h-0 overflow-y-auto overscroll-contain border-border lg:border-r',
                    activeDevLogTab !== 'network' && 'px-2 py-2 sm:px-3',
                  )}>
                    {activeDevLogTab === 'execution' && search.query.trim() && !search.pending && search.count === 0 ? <DevlogSearchEmpty query={search.query} onReset={() => search.setQuery('')} /> : activeDevLogTab === 'execution' ? (
                    <ExecutionLogView
                        evidenceLogs={props.evidenceLogs}
                        logs={executionLogs}
                        compact
                        selectedLogId={selectedSystemExecutionLog?.eventId || selectedSystemExecutionLog?.id}
                        formatRelativeTime={formatRelativeTime}
                        onSelectLog={(log) => {
                          const index = allExecutionLogs.indexOf(log);
                          setSelectedSystemDevLogId(`system-execution-${log.eventId || log.id || index}`);
                          seekRecordingFromLog(log);
                        }}
                      />
                    ) : activeDevLogTab === 'network' ? (
                      <div className="@container">
                        {fullscreenNetworkGroups.length === 0 ? (
                          <DevlogEmptyState kind="network" title={search.networkTotal ? 'No matching requests' : 'No requests recorded'}
                            hint={search.networkTotal ? 'Clear the filter or choose All to see more requests.' : undefined} />
                        ) : <><div className="sticky top-0 z-10"><DevtoolsNetworkColumns /></div><VirtualLogList items={fullscreenNetworkGroups} itemKey={(group: any) => group.id}>{(group: any) => {
                          const { log: net } = group;
                          const logId = `system-network-${group.id}`;
                          const active = selectedSystemDevLogId === logId;

                          return (
                            <div
                              key={logId}
                              role="button"
                              aria-pressed={active}
                              tabIndex={0}
                              className={cn(
                                DEVTOOLS_NETWORK_GRID,
                                "min-h-9 cursor-pointer border-b border-border py-1.5 text-left hover:bg-teal-50 dark:hover:bg-teal-950/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                                active && "bg-teal-100 dark:bg-teal-950"
                              )}
                              onClick={() => {
                                setSelectedSystemDevLogId(logId);
                                seekRecordingFromLog(net);
                              }}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                  event.preventDefault();
                                  setSelectedSystemDevLogId(logId);
                                  seekRecordingFromLog(net);
                                }
                              }}
                            >
                              <DevtoolsNetworkCells network={net.network} />
                            </div>
                          );
                        }}</VirtualLogList></>}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {fullscreenConsoleGroups.length === 0 ? (
                          <DevlogEmptyState kind="console" title={search.consoleHidden ? 'No matching messages' : 'No messages recorded'}
                            hint={search.consoleHidden ? 'Clear the filter or change the selected levels.' : undefined} />
                        ) : <VirtualLogList items={fullscreenConsoleGroups} itemKey={(group: any) => group.id}>{(group: any) => {
                          const { log, entries, count } = group;
                          const logId = `system-console-${group.id}`;
                          const active = selectedSystemDevLogId === logId;
                          const level = getDevtoolsConsoleLevel(log);
                          const isError = level === 'error';
                          const isWarning = level === 'warning';
                          const source = getDevtoolsConsoleSource(log);

                          return (
                            <div
                              key={logId}
                              role="button"
                              aria-pressed={active}
                              tabIndex={0}
                              className={cn(
                                "grid min-h-9 cursor-pointer grid-cols-[1rem_3.25rem_minmax(0,1fr)_auto] items-start gap-2 border-b border-border px-2 py-2 text-left hover:bg-sky-50/60 dark:hover:bg-sky-950/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                                isError ? 'bg-rose-50 dark:bg-rose-950/20' : isWarning ? 'bg-amber-50 dark:bg-amber-950/20' : '',
                                active && 'bg-sky-100 dark:bg-sky-950'
                              )}
                              onClick={() => {
                                setSelectedSystemDevLogId(logId);
                                seekRecordingFromLog(log);
                              }}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                  event.preventDefault();
                                  setSelectedSystemDevLogId(logId);
                                  seekRecordingFromLog(log);
                                }
                              }}
                            >
                              <DevlogConsoleLevelIcon level={level} />
                              <span className="text-xs tabular-nums text-muted-foreground">{formatRelativeTime(log.relativeMs)}</span>
                              <span className="min-w-0 break-words font-mono text-xs leading-relaxed text-foreground">
                                {getConsoleLogText(log)}
                                {source && <span className="block truncate text-muted-foreground" title={source.url}>{source.label}</span>}
                              </span>
                              <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                                {count > 1 && (
                                  <span className="rounded-full border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-xs font-semibold text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-950/60 dark:text-indigo-200">
                                    x{count}
                                  </span>
                                )}
                              </span>
                            </div>
                          );
                        }}</VirtualLogList>}
                      </div>
                    )}
                  </div>

                  <div data-lenis-prevent className="min-h-0 overflow-y-auto overscroll-contain border-t border-border bg-muted/25 p-3 sm:p-4 lg:border-t-0">
                    {activeDevLogTab === 'execution' ? (
                      selectedSystemExecutionLog ? (
                        <div key={selectedSystemDevLogId} className="devlog-detail-enter space-y-4">
                          <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4 shadow-sm dark:border-indigo-500/20 dark:bg-indigo-950/20">
                            <div className="mb-3 flex flex-wrap items-center gap-2">
                              <Badge className="rounded-md border border-indigo-200 bg-indigo-50 text-xs font-semibold uppercase tracking-wider text-indigo-700 shadow-none dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-200">
                                {getExecutionInteraction(selectedSystemExecutionLog)?.type || selectedSystemExecutionLog.eventType || 'step'}
                              </Badge>
                              <span className="font-mono text-xs font-semibold text-muted-foreground">
                                {formatRelativeTime(selectedSystemExecutionLog.relativeMs)}
                              </span>
                            </div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Interaction</p>
                            <p className="mt-2 text-sm font-semibold leading-relaxed text-foreground">
                              {getExecutionLogText(selectedSystemExecutionLog)}
                            </p>
                          </div>
                          <div className="rounded-xl border border-border bg-background p-4 shadow-sm">
                            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Structured detail</p>
                            <pre className="max-h-[62vh] overflow-auto whitespace-pre-wrap break-words rounded-xl border border-border bg-muted p-4 text-xs leading-relaxed text-foreground">
                              {formatPrettyValue(getExecutionInteraction(selectedSystemExecutionLog) || selectedSystemExecutionLog.metadata || selectedSystemExecutionLog.log)}
                            </pre>
                          </div>
                        </div>
                      ) : (
                        <DevlogEmptyState kind="execution" title="Select a step to view its details" />
                      )
                    ) : activeDevLogTab === 'network' ? (
                      selectedSystemNetworkGroup ? (
                        <div key={selectedSystemDevLogId} className="devlog-detail-enter space-y-4">
                          <div className="rounded-xl border border-border bg-background p-4 shadow-sm">
                            <div className="mb-3 flex flex-wrap items-center gap-2">
                              <Badge className="rounded-md border border-cyan-200 bg-cyan-50 text-xs font-semibold uppercase tracking-wider text-cyan-700 shadow-none dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-200">
                                {selectedSystemNetworkGroup.meta.label}
                              </Badge>
                              <Badge variant="outline" className="rounded-md text-xs font-semibold uppercase tracking-wider">
                                {getNetworkMethod(selectedSystemNetworkGroup.log.network)}
                              </Badge>
                              <span className={cn("rounded px-2 py-1 text-xs font-semibold", getNetworkStatusClass(selectedSystemNetworkGroup.log.network))}>
                                {getNetworkStatus(selectedSystemNetworkGroup.log.network)}
                              </span>
                              {selectedSystemNetworkGroup.count > 1 && (
                                <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs font-semibold uppercase tracking-wider text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-950/60 dark:text-indigo-200">
                                  Repeated x{selectedSystemNetworkGroup.count}
                                </span>
                              )}
                            </div>
                          </div>

                          {selectedSystemNetworkGroup.count > 1 && (
                            <div className="rounded-xl border border-border bg-background p-4 shadow-sm">
                              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Repeated Calls</p>
                              <div className="max-h-52 space-y-1 overflow-y-auto pr-1">
                                {selectedSystemNetworkGroup.entries.map((entry, entryIndex) => (
                                  <button
                                    key={entry.log.id ?? `system-repeat-${entryIndex}`}
                                    type="button"
                                    className="grid w-full grid-cols-[54px_80px_90px_1fr] gap-2 rounded-md border border-border bg-muted/40 px-2 py-1.5 text-left text-xs hover:bg-secondary"
                                    onClick={() => seekRecordingFromLog(entry.log)}
                                  >
                                    <span className="font-semibold text-muted-foreground">#{entryIndex + 1}</span>
                                    <span className="font-mono text-indigo-700 dark:text-status-in-progress">{formatRelativeTime(entry.log.relativeMs)}</span>
                                    <span className={cn("rounded px-1.5 py-0.5 text-center font-bold", getNetworkStatusClass(entry.log.network))}>
                                      {getNetworkStatus(entry.log.network)}
                                    </span>
                                    <span className="truncate text-foreground">{getNetworkDuration(entry.log.network)}</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          <NetworkRequestDetails
                            key={selectedSystemNetworkGroup.id}
                            network={selectedSystemNetworkGroup.log.network}
                            url={selectedSystemNetworkGroup.log.network.url}
                            method={getNetworkMethod(selectedSystemNetworkGroup.log.network)}
                            status={getNetworkStatus(selectedSystemNetworkGroup.log.network)}
                            duration={getNetworkDuration(selectedSystemNetworkGroup.log.network)}
                            headers={selectedSystemNetworkGroup.log.network.headers}
                            requestHeaders={getRequestHeaders ? getRequestHeaders(selectedSystemNetworkGroup.log.network.data) : undefined}
                            payload={getRequestPayload(selectedSystemNetworkGroup.log.network.data)}
                            response={getResponsePayload(selectedSystemNetworkGroup.log.network.data)}
                            wrap={networkCodeWrap}
                            onWrapChange={setNetworkCodeWrap}
                            formatValue={formatPrettyValue}
                          />
                        </div>
                      ) : (
                        <DevlogEmptyState kind="network" title="Select a request to view its details" />
                      )
                    ) : (
                      selectedSystemConsoleGroup ? (
                        <div key={selectedSystemDevLogId} className="devlog-detail-enter space-y-4">
                          <div className="rounded-xl border border-border bg-background p-4 shadow-sm">
                            <div className="mb-3 flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className="rounded-md text-xs font-semibold uppercase tracking-wider">
                                {getDevtoolsConsoleLevel(selectedSystemConsoleGroup.log)}
                              </Badge>
                              {selectedSystemConsoleGroup.count > 1 && (
                                <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs font-semibold uppercase tracking-wider text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-950/60 dark:text-indigo-200">
                                  Repeated x{selectedSystemConsoleGroup.count}
                                </span>
                              )}
                            </div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Message</p>
                            <pre className={cn('mt-2 max-h-[62vh] overflow-auto rounded-md border border-border bg-muted p-3 text-xs leading-relaxed text-foreground', networkCodeWhitespaceClass)}>
                              {formatPrettyValue(selectedSystemConsoleGroup.log.log)}
                            </pre>
                          </div>
                          {selectedSystemConsoleGroup.count > 1 && (
                            <div className="rounded-xl border border-border bg-background p-4 shadow-sm">
                              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Repeated Logs</p>
                              <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
                                {selectedSystemConsoleGroup.entries.map((entry, entryIndex) => (
                                  <button
                                    key={entry.id ?? `system-console-repeat-${entryIndex}`}
                                    type="button"
                                    className="grid w-full grid-cols-[54px_80px_1fr] gap-2 rounded-md border border-border bg-muted/40 px-2 py-1.5 text-left text-xs hover:bg-secondary"
                                    onClick={() => seekRecordingFromLog(entry)}
                                  >
                                    <span className="font-semibold text-muted-foreground">#{entryIndex + 1}</span>
                                    <span className="font-mono text-indigo-700 dark:text-status-in-progress">{formatRelativeTime(entry.relativeMs)}</span>
                                    <span className="truncate text-foreground">{getConsoleLogText(entry)}</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <DevlogEmptyState kind="console" title="Select a message to view its details" />
                      )
                    )}
                  </div>
                </div>
              </div>
            </div>
    </DevlogFullscreenDialog>
  );
}
