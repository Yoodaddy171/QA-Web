'use client';

import { useEffect, useRef, useState } from 'react';
import { Copy, Link2, Pause, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ResizablePanel } from '@/components/ui/resizable';
import { cn } from '@/lib/utils';
import { SyncedVideoEventsPanel } from '@/components/SyncedVideoEventsPanel';
import { ExecutionLogView } from '@/components/ExecutionLogView';
import { VirtualLogList } from '@/components/VirtualLogList';
import { useDevlogTabMemory } from '@/hooks/use-devlog-tab-memory';
import { useDevlogSearch } from '@/hooks/use-devlog-search';
import { DevlogFilterBar, DevlogSearchEmpty } from '@/components/DevlogSearchBar';
import { DevlogConsoleLevelIcon, DevlogEmptyState, DevlogTabs } from '@/components/DevlogPanelChrome';
import { DEVTOOLS_NETWORK_GRID, DevtoolsNetworkCells, DevtoolsNetworkColumns } from '@/components/DevtoolsNetworkFilters';
import { getDevtoolsConsoleLevel, getDevtoolsConsoleSource } from '@/lib/client/automation/devtools-console';
import { NetworkRequestDetails } from '@/components/NetworkRequestDetails';
import { minimumEvidencePane } from '@/lib/client/automation/devlog-review';

type RecordingEvidencePanelProps = Record<string, any>;

export function RecordingEvidencePanel(props: RecordingEvidencePanelProps) {
  const {
    activeDevLogTab, setActiveDevLogTab,
    selectedFullscreenLog, setSelectedFullscreenLog, networkCodeWrap,
    setNetworkCodeWrap, copyFullscreenEvidence, copiedEvidence, fullscreenNetworkGroups: allNetworkGroups,
    fullscreenConsoleGroups: allConsoleGroups, executionLogs: allExecutionLogs, getNetworkMethod, getNetworkCategoryClass, getNetworkStatusClass,
    getNetworkStatus, getNetworkDuration, formatLogRecordingTime, formatRelativeTime, selectFullscreenNetworkLog,
    selectFullscreenConsoleLog, networkCodeWhitespaceClass, networkFullscreenCodePanelClass,
    networkCodePanelClass, formatPrettyValue, getRequestHeaders, getRequestPayload, getResponsePayload,
    selectedSyncedVideoEventDetail, selectedSyncedVideoEvent, getSyncedEventSeverityClass,
    filteredSyncedVideoEvents, syncedVideoEvents, syncedEventFilters, toggleSyncedEventFilter,
    selectedSyncedEventId, seekRecordingFromSyncedEvent, seekRecordingFromLog, getConsoleLogText,
    groupedSyncedVideoMarkers, setSelectedSyncedEventId, currentSyncedVideoEvent,
    syncedVideoEvents: syncedEvents, getSyncedMarkerClass, scrollFullscreenTimeline,
    fullscreenTimelineRef, handleTimelineWheel,
    selectedRecordingFrame, manualRecording, hasManualRecordingVideo, syncedNetworkLogIdSet,
    fullscreenNetworkRowRefs, setExpandedLogId, expandedLogId,
  } = props;
  const search = useDevlogSearch({ executionLogs: allExecutionLogs, networkGroups: allNetworkGroups, consoleGroups: allConsoleGroups, tab: activeDevLogTab, onSearch: props.pauseRecordingFollow, filters: props.devtoolsFilters });
  const { execution: executionLogs, network: fullscreenNetworkGroups, console: fullscreenConsoleGroups } = search;
  const [selectedExecutionId, setSelectedExecutionId] = useState<string | null>(null);
  const [showSyncedWithDetail, setShowSyncedWithDetail] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [minimumSize, setMinimumSize] = useState(() => minimumEvidencePane(typeof window === 'undefined' ? 1440 : window.innerWidth));
  useEffect(() => {
    const group = contentRef.current?.closest('[data-slot="resizable-panel-group"]');
    if (!group) return;
    const observer = new ResizeObserver(() => setMinimumSize(minimumEvidencePane(group.clientWidth)));
    observer.observe(group);
    return () => observer.disconnect();
  }, []);
  const { listRef, changeTab, rememberScroll } = useDevlogTabMemory({
    tab: activeDevLogTab, selection: selectedFullscreenLog, expanded: expandedLogId,
    onTabChange: setActiveDevLogTab, onSelectionChange: setSelectedFullscreenLog, onExpandedChange: setExpandedLogId,
  });

  const toggleNetworkRow = (net: any, logId: string) => {
    seekRecordingFromLog(net);
    setSelectedFullscreenLog(null);
    setExpandedLogId((current: string | null) => current === logId ? null : logId);
  };

  return (
            <ResizablePanel defaultSize={props.evidencePaneSize ?? 42} minSize={minimumSize} className="min-h-0 min-w-0 overflow-hidden border-l border-border bg-background">
            <div ref={contentRef} className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden"
              onWheelCapture={() => props.pauseRecordingFollow?.()}
              onTouchStart={() => props.pauseRecordingFollow?.()}
              onPointerDownCapture={event => { const target = event.target as HTMLElement; if (target.scrollHeight > target.clientHeight && /auto|scroll/.test(getComputedStyle(target).overflowY)) props.pauseRecordingFollow?.(); }}
              onKeyDownCapture={event => { if (['PageDown', 'PageUp', 'Home', 'End', 'ArrowDown', 'ArrowUp'].includes(event.key) && !(event.target as HTMLElement).closest('input, [role="tab"]')) props.pauseRecordingFollow?.(); }}>
              <header className="shrink-0 space-y-2.5 border-b border-border bg-card px-3 py-3 sm:px-4">
                <div className="flex flex-wrap items-start justify-between gap-2 pr-10 md:pr-12">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">Devlog rekaman</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Pilih log untuk lompat ke waktunya di video.</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" className="h-8 shrink-0 gap-1.5 px-2"
                    onClick={copyFullscreenEvidence}>
                    <Copy aria-hidden="true" />
                    {copiedEvidence ? 'Copied' : 'Copy Evidence'}
                  </Button>
                </div>
                <DevlogTabs active={activeDevLogTab} onChange={changeTab} />
              </header>

              <DevlogFilterBar tab={activeDevLogTab} search={search} />
              {hasManualRecordingVideo && <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-card px-3 py-1">
                <span className={cn('flex items-center gap-1.5 text-xs font-medium', props.isFollowingRecording
                  ? 'text-teal-800 dark:text-teal-200' : 'text-muted-foreground')}>
                  {props.isFollowingRecording ? <Link2 className="size-3.5" aria-hidden="true" /> : <Pause className="size-3.5" aria-hidden="true" />}
                  {props.isFollowingRecording ? 'Mengikuti video' : 'Jelajah manual'}
                </span>
                <Button type="button" variant={props.isFollowingRecording ? 'secondary' : 'outline'} size="sm" aria-pressed={Boolean(props.isFollowingRecording)}
                  onClick={() => { if (props.isFollowingRecording) props.pauseRecordingFollow?.(); else { search.setQuery(''); props.resumeRecordingFollow?.(); } }}>
                  {props.isFollowingRecording ? 'Jeda mengikuti' : 'Ikuti video'}
                </Button>
              </div>}

                {selectedFullscreenLog && (
                  <div
                    key={selectedFullscreenLog.id}
                    className="devlog-inline-detail-enter max-h-[min(36%,300px)] shrink-0 touch-pan-y overflow-x-hidden overflow-y-auto overscroll-contain border-b border-border bg-background scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
                    data-lenis-prevent
                  >
                    <div className="m-3 space-y-3 rounded-lg border border-indigo-200 bg-indigo-50/60 p-3 shadow-sm dark:border-indigo-500/20 dark:bg-indigo-950/20">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="rounded-md border-indigo-200 bg-indigo-50 text-xs font-semibold uppercase tracking-wider text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-200">
                              Selected Evidence
                            </Badge>
                            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                              {selectedFullscreenLog.kind} · {formatRelativeTime(selectedFullscreenLog.relativeMs)}
                            </span>
                          </div>
                          <p className="mt-2 line-clamp-2 break-all text-xs font-semibold text-foreground">
                            {selectedFullscreenLog.text || '-'}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 shrink-0 rounded-md p-0 text-muted-foreground hover:bg-secondary hover:text-foreground"
                          aria-label="Tutup detail evidence"
                          onClick={() => setSelectedFullscreenLog(null)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      {selectedRecordingFrame?.file && <p className="truncate text-xs text-muted-foreground">Frame: {selectedRecordingFrame.file}</p>}
                      {selectedFullscreenLog.kind === 'network' && (
                        <div className="space-y-3 rounded-lg border border-border bg-background p-3">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Full URL</p>
                            <pre className={cn("mt-1 max-h-24 overflow-auto rounded-md border border-border bg-muted p-2 font-mono text-xs leading-relaxed text-foreground", networkCodeWhitespaceClass)}>
                              {formatPrettyValue((selectedFullscreenLog.detail as Record<string, unknown>)?.url || '-')}
                            </pre>
                          </div>
                          <NetworkRequestDetails
                            key={selectedFullscreenLog.id}
                            network={allNetworkGroups.find((group: { id: string }) => `fullscreen-${group.id}` === selectedFullscreenLog.id)?.log.network}
                            url={String((selectedFullscreenLog.detail as Record<string, unknown>)?.url || '')}
                            method={String((selectedFullscreenLog.detail as Record<string, unknown>)?.method || 'GET')}
                            status={(selectedFullscreenLog.detail as Record<string, unknown>)?.status as string | number | undefined}
                            duration={String((selectedFullscreenLog.detail as Record<string, unknown>)?.duration || '-')}
                            headers={selectedFullscreenLog.detail?.headers}
                            requestHeaders={selectedFullscreenLog.detail?.requestHeaders}
                            payload={selectedFullscreenLog.detail?.request}
                            response={selectedFullscreenLog.detail?.response}
                            wrap={networkCodeWrap}
                            onWrapChange={setNetworkCodeWrap}
                            formatValue={formatPrettyValue}
                          />
                        </div>
                      )}
                      {selectedFullscreenLog.kind !== 'network' && (
                        <div className="rounded-lg border border-border bg-background p-3">
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            {selectedFullscreenLog.kind === 'execution' ? 'Execution detail' : 'Console detail'}
                          </p>
                          <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-muted p-2 font-mono text-xs leading-relaxed text-foreground">
                            {formatPrettyValue(selectedFullscreenLog.detail)}
                          </pre>
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5 rounded-md border-border bg-background px-2 text-xs font-semibold uppercase tracking-wider text-foreground hover:bg-secondary"
                          onClick={copyFullscreenEvidence}
                        >
                          <Copy className="h-3.5 w-3.5" />
                          {copiedEvidence ? 'Copied' : 'Copy Selected'}
                        </Button>
                        <span className="text-xs font-medium text-muted-foreground">
                          Klik log lain untuk mengganti evidence.
                        </span>
                      </div>
                    </div>
                  </div>
                )}

              {(activeDevLogTab !== 'execution' || selectedFullscreenLog) && hasManualRecordingVideo && <Button type="button" variant="ghost" size="sm" className="shrink-0 justify-start rounded-none border-b border-border" aria-expanded={showSyncedWithDetail} onClick={() => setShowSyncedWithDetail(value => !value)}>
                {showSyncedWithDetail ? 'Sembunyikan' : 'Tampilkan'} Synced Events ({filteredSyncedVideoEvents.length})
              </Button>}
              {((activeDevLogTab === 'execution' && !selectedFullscreenLog) || showSyncedWithDetail) && <SyncedVideoEventsPanel
                hasManualRecordingVideo={hasManualRecordingVideo}
                filteredSyncedVideoEvents={filteredSyncedVideoEvents}
                syncedVideoEvents={syncedVideoEvents}
                syncedEventFilters={syncedEventFilters}
                toggleSyncedEventFilter={toggleSyncedEventFilter}
                getSyncedEventSeverityClass={getSyncedEventSeverityClass}
                selectedSyncedEventId={selectedSyncedEventId}
                seekRecordingFromSyncedEvent={seekRecordingFromSyncedEvent}
                formatRelativeTime={formatRelativeTime}
                selectedSyncedVideoEventDetail={selectedSyncedVideoEventDetail}
                selectedSyncedVideoEvent={selectedSyncedVideoEvent}
              />}

              <div key={activeDevLogTab} className="devlog-view-enter min-h-0 flex flex-1 flex-col overflow-hidden bg-muted/25">
                {activeDevLogTab === 'execution' && search.query.trim() && !search.pending && search.count === 0 ? <DevlogSearchEmpty query={search.query} onReset={() => search.setQuery('')} /> : activeDevLogTab === 'execution' ? (
                  <div
                    ref={listRef}
                    onScroll={rememberScroll}
                    className="min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
                    data-lenis-prevent
                  >
                    <ExecutionLogView
                      evidenceLogs={props.evidenceLogs}
                      logs={executionLogs}
                      compact
                      formatLogTime={formatLogRecordingTime}
                      selectedLogId={selectedFullscreenLog?.kind === 'execution' ? selectedSyncedVideoEvent?.originalEvent?.eventId || selectedSyncedVideoEvent?.originalEvent?.id || selectedExecutionId : selectedExecutionId}
                      onSelectLog={(log) => {
                        setSelectedExecutionId(log.eventId || log.id || null);
                        seekRecordingFromLog(log);
                      }}
                    />
                  </div>
                ) : activeDevLogTab === 'network' ? (
                  <div className="@container flex min-h-0 flex-1 flex-col">
                    {fullscreenNetworkGroups.length > 0 && (
                      <div className="shrink-0 overflow-y-hidden [scrollbar-gutter:stable] scrollbar-thin">
                        <DevtoolsNetworkColumns />
                      </div>
                    )}
                    <div
                      ref={listRef}
                      onScroll={rememberScroll}
                      className="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-gutter:stable] scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
                      data-lenis-prevent
                    >
                    {fullscreenNetworkGroups.length === 0 ? (
                      <DevlogEmptyState kind="network" title={search.networkTotal ? 'No matching requests' : 'No requests recorded'} hint={search.networkTotal ? 'Clear the filter or choose All to see more requests.' : undefined} />
                    ) : (
                      <VirtualLogList items={fullscreenNetworkGroups} itemKey={(group: any) => `fullscreen-${group.id}`} activeId={props.isFollowingRecording ? [...syncedNetworkLogIdSet][0] as string | undefined : selectedFullscreenLog?.kind === 'network' ? selectedFullscreenLog.id : undefined}>{(group: any) => {
                        const { log: net, meta, entries, count } = group;
                        const logId = `fullscreen-${group.id}`;
                        const isSyncedWithVideo = syncedNetworkLogIdSet.has(logId);

                        return (
                          <div
                            key={logId}
                            ref={(node) => {
                              if (node) fullscreenNetworkRowRefs.current.set(logId, node);
                              else fullscreenNetworkRowRefs.current.delete(logId);
                            }}
                            className={cn(
                              "overflow-hidden border-b border-border bg-background",
                              isSyncedWithVideo && "bg-teal-50 dark:bg-teal-950/40",
                              selectedFullscreenLog?.id === logId && selectedFullscreenLog.kind === 'network' && "bg-teal-100 dark:bg-teal-950"
                            )}
                          >
                            <div
                              role="button"
                              aria-expanded={expandedLogId === logId}
                              tabIndex={0}
                              className={cn(DEVTOOLS_NETWORK_GRID, "w-full cursor-pointer min-h-9 py-1.5 text-left hover:bg-teal-50/70 dark:hover:bg-teal-950/50 focus-visible:outline-2 focus-visible:outline-ring")}
                              onClick={() => toggleNetworkRow(net, logId)}
                              onKeyDown={(event) => {
                                if (event.target !== event.currentTarget) return;
                                if (event.key === 'Enter' || event.key === ' ') {
                                  event.preventDefault();
                                  toggleNetworkRow(net, logId);
                                }
                              }}
                            >
                              <DevtoolsNetworkCells network={net.network} />
                            </div>
                              {expandedLogId === logId && (
                                <div className="devlog-inline-detail-enter overflow-hidden">
                                  <div className="space-y-2 border-t border-border bg-muted/60 p-3">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <span className="text-xs tabular-nums text-muted-foreground">{formatLogRecordingTime(net)}</span>
                                      <Button type="button" variant="outline" size="sm" onClick={() => selectFullscreenNetworkLog(net, meta, logId)}>Use as evidence</Button>
                                    </div>
                                    {count > 1 && (
                                      <div className="rounded border border-border bg-background p-2">
                                        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Repeated {count} times</p>
                                        <div className="max-h-32 space-y-1 overflow-y-auto">
                                          {entries.map((entry, entryIndex) => (
                                            <button
                                              key={entry.log.id ?? `${logId}-repeat-${entryIndex}`}
                                              type="button"
                                              className="grid w-full grid-cols-[42px_64px_1fr] gap-2 rounded border border-border bg-muted/40 px-2 py-1 text-left text-xs hover:bg-secondary"
                                              onClick={() => seekRecordingFromLog(entry.log)}
                                            >
                                              <span className="font-semibold text-muted-foreground">#{entryIndex + 1}</span>
                                              <span className="font-mono text-indigo-700 dark:text-status-in-progress">{formatLogRecordingTime(entry.log)}</span>
                                              <span className="truncate text-foreground">{getNetworkDuration(entry.log.network)}</span>
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    <NetworkRequestDetails
                                      network={net.network}
                                      url={net.network.url}
                                      method={getNetworkMethod(net.network)}
                                      status={getNetworkStatus(net.network)}
                                      duration={getNetworkDuration(net.network)}
                                      headers={net.network.headers}
                                      requestHeaders={getRequestHeaders ? getRequestHeaders(net.network.data) : undefined}
                                      payload={getRequestPayload(net.network.data)}
                                      response={getResponsePayload(net.network.data)}
                                      wrap={networkCodeWrap}
                                      onWrapChange={setNetworkCodeWrap}
                                      formatValue={formatPrettyValue}
                                    />
                                  </div>
                                </div>
                              )}
                          </div>
                        );
                      }}</VirtualLogList>
                    )}
                    </div>
                  </div>
                ) : (
                  <div
                    ref={listRef}
                    onScroll={rememberScroll}
                    className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain p-3 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
                    data-lenis-prevent
                  >
                    {fullscreenConsoleGroups.length === 0 ? (
                      <DevlogEmptyState kind="console" title={search.consoleHidden ? 'No matching messages' : 'No messages recorded'} hint={search.consoleHidden ? 'Clear the filter or change the selected levels.' : undefined} />
                    ) : (
                      <VirtualLogList items={fullscreenConsoleGroups} itemKey={(group: any) => group.id}>{(group: any) => {
                        const { log, entries, count } = group;
                        const logId = `fullscreen-${group.id}`;
                        const level = getDevtoolsConsoleLevel(log);
                        const isError = level === 'error';
                        const isWarning = level === 'warning';
                        const source = getDevtoolsConsoleSource(log);

                        return (
                          <div
                            key={logId}
                            role="button"
                            aria-pressed={selectedFullscreenLog?.id === logId && selectedFullscreenLog.kind === 'console'}
                            tabIndex={0}
                            className={cn(
                              "grid min-h-9 w-full cursor-pointer grid-cols-[1rem_3.25rem_minmax(0,1fr)_auto] items-start gap-2 border-b border-border px-2 py-2 text-left hover:bg-sky-50/60 dark:hover:bg-sky-950/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                              isError ? 'bg-rose-50 dark:bg-rose-950/20' : isWarning ? 'bg-amber-50 dark:bg-amber-950/20' : '',
                              selectedFullscreenLog?.id === logId && selectedFullscreenLog.kind === 'console' && 'bg-sky-100 dark:bg-sky-950'
                            )}
                            onClick={() => selectFullscreenConsoleLog(log, logId)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                selectFullscreenConsoleLog(log, logId);
                              }
                            }}
                          >
                            <DevlogConsoleLevelIcon level={level} />
                            <span className="text-xs tabular-nums text-muted-foreground">{formatLogRecordingTime(log)}</span>
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
                      }}</VirtualLogList>
                    )}
                  </div>
                )}
              </div>
            </div>
            </ResizablePanel>
  );
}
