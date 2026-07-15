'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Clock, Copy, Filter, Layers, RefreshCw, Search, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ResizablePanel } from '@/components/ui/resizable';
import { cn } from '@/lib/utils';
import type { FullscreenLogFilter } from '@/components/TestCaseDetailDialog.helpers';
import { SyncedVideoEventsPanel } from '@/components/SyncedVideoEventsPanel';

type RecordingEvidencePanelProps = Record<string, any>;

export function RecordingEvidencePanel(props: RecordingEvidencePanelProps) {
  const {
    isClosingRecordingFullscreen, activeDevLogTab, setActiveDevLogTab, fullscreenLogFilter,
    setFullscreenLogFilter, selectedFullscreenLog, setSelectedFullscreenLog, networkCodeWrap,
    setNetworkCodeWrap, copyFullscreenEvidence, copiedEvidence, fullscreenNetworkGroups,
    fullscreenConsoleGroups, getNetworkMethod, getNetworkCategoryClass, getNetworkStatusClass,
    getNetworkStatus, getNetworkDuration, formatLogRecordingTime, formatRelativeTime, selectFullscreenNetworkLog,
    selectFullscreenConsoleLog, networkCodeWhitespaceClass, networkFullscreenCodePanelClass,
    networkCodePanelClass, formatPrettyValue, getRequestPayload, getResponsePayload,
    selectedSyncedVideoEventDetail, selectedSyncedVideoEvent, getSyncedEventSeverityClass,
    filteredSyncedVideoEvents, syncedVideoEvents, syncedEventFilters, toggleSyncedEventFilter,
    selectedSyncedEventId, seekRecordingFromSyncedEvent, seekRecordingFromLog, getConsoleLogText,
    groupedSyncedVideoMarkers, setSelectedSyncedEventId, currentSyncedVideoEvent,
    syncedVideoEvents: syncedEvents, getSyncedMarkerClass, scrollFullscreenTimeline,
    fullscreenTimelineRef, handleTimelineWheel, isRecordingFullscreenExpanded,
    selectedRecordingFrame, manualRecording, hasManualRecordingVideo, syncedNetworkLogIdSet,
    fullscreenNetworkRowRefs, setExpandedLogId, expandedLogId,
  } = props;
  return (
            <ResizablePanel defaultSize={42} minSize={26} className={cn("min-w-[420px] border-l border-border bg-background transition duration-200", isClosingRecordingFullscreen ? 'translate-x-4' : 'translate-x-0')}>
            <div className="flex h-full min-w-0 flex-col">
              <div className="flex min-h-[116px] shrink-0 flex-col justify-end gap-3 border-b border-border px-4 pb-3 pt-4 pr-16">
                <div className="flex items-end justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wider text-foreground">DevTools</p>
                    <p className="mt-0.5 truncate text-[10px] text-muted-foreground">Klik log untuk loncat ke timestamp record.</p>
                  </div>
                  <div className="flex shrink-0 rounded-md bg-muted p-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "h-7 px-2 text-[10px] font-bold",
                        activeDevLogTab === 'console'
                          ? 'bg-teal-100 text-teal-800 hover:bg-teal-100 dark:bg-teal-500/15 dark:text-teal-100 dark:hover:bg-teal-500/20'
                          : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                      )}
                      onClick={() => setActiveDevLogTab('console')}
                    >
                      CONSOLE
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "h-7 px-2 text-[10px] font-bold",
                        activeDevLogTab === 'network'
                          ? 'bg-teal-100 text-teal-800 hover:bg-teal-100 dark:bg-teal-500/15 dark:text-teal-100 dark:hover:bg-teal-500/20'
                          : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                      )}
                      onClick={() => setActiveDevLogTab('network')}
                    >
                      NETWORK
                    </Button>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex rounded-md bg-muted p-1">
                    {[
                      { value: 'all', label: 'All' },
                      { value: 'errors', label: 'Errors' },
                      { value: 'api', label: 'API' },
                    ].map((item) => (
                      <Button
                        key={item.value}
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "h-7 px-2 text-[10px] font-bold",
                          fullscreenLogFilter === item.value
                            ? 'bg-indigo-100 text-indigo-800 hover:bg-indigo-100 dark:bg-indigo-500/20 dark:text-indigo-100 dark:hover:bg-indigo-500/25'
                            : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                        )}
                        onClick={() => setFullscreenLogFilter(item.value as FullscreenLogFilter)}
                      >
                        {item.label}
                      </Button>
                    ))}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1.5 rounded-md border border-border bg-muted px-2 text-[10px] font-bold text-foreground hover:bg-secondary"
                    onClick={copyFullscreenEvidence}
                  >
                    <Copy className="h-3.5 w-3.5" />
                    {copiedEvidence ? 'Copied' : 'Copy Evidence'}
                  </Button>
                </div>
              </div>

              <AnimatePresence>
                {selectedFullscreenLog && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="shrink-0 overflow-hidden border-b border-border bg-background"
                  >
                    <div className="m-3 space-y-3 rounded-lg border border-indigo-200 bg-indigo-50/60 p-3 shadow-sm dark:border-indigo-500/20 dark:bg-indigo-950/20">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="rounded-md border-indigo-200 bg-indigo-50 text-[9px] font-semibold uppercase tracking-wider text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-200">
                              Selected Evidence
                            </Badge>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                              {selectedFullscreenLog.kind} · {formatRelativeTime(selectedFullscreenLog.relativeMs)}
                            </span>
                          </div>
                          <p className="mt-2 line-clamp-2 break-all text-[11px] font-semibold text-foreground">
                            {selectedFullscreenLog.text || '-'}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 shrink-0 rounded-md p-0 text-muted-foreground hover:bg-secondary hover:text-foreground"
                          onClick={() => setSelectedFullscreenLog(null)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[10px]">
                        <div className="rounded-md border border-border bg-background p-2">
                          <p className="font-semibold uppercase tracking-wider text-muted-foreground">Frame</p>
                          <p className="mt-1 truncate font-mono text-foreground">{selectedRecordingFrame?.file || '-'}</p>
                        </div>
                        <div className="rounded-md border border-border bg-background p-2">
                          <p className="font-semibold uppercase tracking-wider text-muted-foreground">Target</p>
                          <p className="mt-1 truncate text-foreground">{manualRecording?.targetUrl || '-'}</p>
                        </div>
                      </div>
                      {selectedFullscreenLog.kind === 'network' && (
                        <div className="space-y-3 rounded-lg border border-border bg-background p-3">
                          <div>
                            <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Full URL</p>
                            <pre className={cn("mt-1 max-h-24 overflow-auto rounded-md border border-border bg-muted p-2 font-mono text-[10px] leading-relaxed text-foreground", networkCodeWhitespaceClass)}>
                              {formatPrettyValue((selectedFullscreenLog.detail as Record<string, unknown>)?.url || '-')}
                            </pre>
                          </div>
                          <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
                            <div className="min-w-0 space-y-1">
                              <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Headers</p>
                              <pre className={cn("max-h-56 resize-y overflow-auto rounded-md border border-border bg-muted p-2 font-mono text-[10px] leading-relaxed text-foreground", networkCodeWhitespaceClass)}>
                                {formatPrettyValue((selectedFullscreenLog.detail as Record<string, unknown>)?.headers)}
                              </pre>
                            </div>
                            <div className="min-w-0 space-y-1">
                              <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Payload</p>
                              <pre className={cn("max-h-56 resize-y overflow-auto rounded-md border border-border bg-muted p-2 font-mono text-[10px] leading-relaxed text-cyan-700 dark:text-cyan-200", networkCodeWhitespaceClass)}>
                                {formatPrettyValue((selectedFullscreenLog.detail as Record<string, unknown>)?.request)}
                              </pre>
                            </div>
                            <div className="min-w-0 space-y-1">
                              <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Response</p>
                              <pre className={cn("max-h-56 resize-y overflow-auto rounded-md border border-border bg-muted p-2 font-mono text-[10px] leading-relaxed text-emerald-700 dark:text-emerald-200", networkCodeWhitespaceClass)}>
                                {formatPrettyValue((selectedFullscreenLog.detail as Record<string, unknown>)?.response)}
                              </pre>
                            </div>
                          </div>
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5 rounded-md border-border bg-background px-2 text-[10px] font-semibold uppercase tracking-wider text-foreground hover:bg-secondary"
                          onClick={copyFullscreenEvidence}
                        >
                          <Copy className="h-3.5 w-3.5" />
                          {copiedEvidence ? 'Copied' : 'Copy Selected'}
                        </Button>
                        <span className="text-[10px] font-medium text-muted-foreground">
                          Klik log lain untuk mengganti evidence.
                        </span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <SyncedVideoEventsPanel
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
              />

              <div className="min-h-0 flex-1 overflow-y-auto bg-muted/25">
                {activeDevLogTab === 'network' ? (
                  <div className="space-y-2 p-3">
                    {fullscreenNetworkGroups.length === 0 ? (
                      <div className="flex h-full flex-col items-center justify-center py-20 text-muted-foreground">
                        <RefreshCw className="mb-3 h-8 w-8 opacity-20" />
                        <p className="text-[10px] font-bold uppercase tracking-wider">No Network Rows</p>
                      </div>
                    ) : (
                      fullscreenNetworkGroups.map((group) => {
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
                              "overflow-hidden rounded-lg border border-border bg-background shadow-sm transition hover:border-indigo-200 hover:bg-secondary/50 dark:hover:border-indigo-500/30 dark:hover:bg-white/5",
                              isSyncedWithVideo && "border-teal-300 bg-teal-50 shadow-[0_0_0_1px_rgba(20,184,166,0.25),0_0_24px_rgba(20,184,166,0.28)] dark:border-teal-400/50 dark:bg-teal-950/30 dark:shadow-[0_0_0_1px_rgba(45,212,191,0.2),0_0_28px_rgba(45,212,191,0.2)]",
                              selectedFullscreenLog?.id === logId && selectedFullscreenLog.kind === 'network' && "border-indigo-300 bg-indigo-50 dark:border-indigo-500/40 dark:bg-indigo-950/30"
                            )}
                          >
                            <div
                              role="button"
                              tabIndex={0}
                              className="grid w-full cursor-pointer grid-cols-12 items-center gap-2 p-2 text-left"
                              onClick={() => {
                                setExpandedLogId(expandedLogId === logId ? null : logId);
                              }}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                  event.preventDefault();
                                  setExpandedLogId(expandedLogId === logId ? null : logId);
                                }
                              }}
                            >
                              <span className="col-span-2 truncate font-semibold text-indigo-700 dark:text-indigo-300">{getNetworkMethod(net.network)}</span>
                              <span className="col-span-2 truncate">
                                <span className={`rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase ${getNetworkCategoryClass(meta.category)}`}>
                                  {meta.label}
                                </span>
                              </span>
                              <span className="col-span-4 min-w-0">
                                <span className="block truncate text-[11px] text-foreground dark:text-slate-300">{meta.pathname.split('/').pop() || meta.pathname || net.network.url}</span>
                                <span className="block truncate text-[9px] text-muted-foreground">{meta.host}</span>
                              </span>
                              <span className="col-span-2 text-center">
                                <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold", getNetworkStatusClass(net.network))}>
                                  {getNetworkStatus(net.network)}
                                </span>
                              </span>
                              <span className="col-span-2 flex items-center justify-end gap-2 text-right text-[10px] font-bold text-muted-foreground">
                                <span>{formatLogRecordingTime(net)}</span>
                                {isSyncedWithVideo && (
                                  <span className="rounded-full border border-teal-200 bg-teal-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-teal-700 dark:border-teal-400/30 dark:bg-teal-500/15 dark:text-teal-200">
                                    Now
                                  </span>
                                )}
                                {count > 1 && (
                                  <span className="rounded-full border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[9px] font-semibold text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-950/60 dark:text-indigo-200">
                                    x{count}
                                  </span>
                                )}
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 rounded-md border border-border bg-muted px-1.5 text-[9px] font-semibold uppercase tracking-wider text-foreground hover:bg-indigo-50 hover:text-indigo-700 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-200"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    selectFullscreenNetworkLog(net, meta, logId);
                                  }}
                                >
                                  Use
                                </Button>
                              </span>
                            </div>
                            <AnimatePresence>
                              {expandedLogId === logId && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="overflow-hidden"
                                >
                                  <div className="space-y-2 border-t border-border bg-muted/60 p-3">
                                    {count > 1 && (
                                      <div className="rounded border border-border bg-background p-2">
                                        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Repeated {count} times</p>
                                        <div className="max-h-32 space-y-1 overflow-y-auto">
                                          {entries.map((entry, entryIndex) => (
                                            <button
                                              key={entry.log.id ?? `${logId}-repeat-${entryIndex}`}
                                              type="button"
                                              className="grid w-full grid-cols-[42px_64px_1fr] gap-2 rounded border border-border bg-muted/40 px-2 py-1 text-left text-[10px] hover:bg-secondary"
                                              onClick={() => seekRecordingFromLog(entry.log)}
                                            >
                                              <span className="font-semibold text-muted-foreground">#{entryIndex + 1}</span>
                                              <span className="font-mono text-indigo-700 dark:text-indigo-300">{formatLogRecordingTime(entry.log)}</span>
                                              <span className="truncate text-foreground">{getNetworkDuration(entry.log.network)}</span>
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    <pre className={cn("max-h-24 overflow-auto rounded border border-border bg-background p-2 font-mono text-[10px] text-foreground dark:text-slate-300", networkCodeWhitespaceClass)}>{net.network.url}</pre>
                                    <pre className={cn("max-h-44 resize-y overflow-auto rounded border border-border bg-background p-2 font-mono text-[10px] text-foreground", networkCodeWhitespaceClass)}>{formatPrettyValue(getResponsePayload(net.network.data))}</pre>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })
                    )}
                  </div>
                ) : (
                  <div className="space-y-2 p-3">
                    {fullscreenConsoleGroups.length === 0 ? (
                      <div className="flex h-full flex-col items-center justify-center py-20 text-muted-foreground">
                        <Clock className="mb-3 h-8 w-8 opacity-20" />
                        <p className="text-[10px] font-bold uppercase tracking-wider">No Console Rows</p>
                      </div>
                    ) : (
                      fullscreenConsoleGroups.map((group) => {
                        const { log, entries, count } = group;
                        const logId = `fullscreen-${group.id}`;
                        const isError = entries.some((entry) => entry.level === 'SEVERE' || entry.log?.toString().toLowerCase().includes('error'));
                        const isWarning = entries.some((entry) => entry.level === 'WARNING' || entry.log?.toString().toLowerCase().includes('warn'));

                        return (
                          <div
                            key={logId}
                            role="button"
                            tabIndex={0}
                            className={cn(
                              "grid w-full cursor-pointer grid-cols-12 gap-2 rounded-lg border border-border bg-background p-2 text-left shadow-sm transition hover:border-indigo-200 hover:bg-secondary/50 dark:hover:border-indigo-500/30 dark:hover:bg-white/5",
                              isError ? 'bg-rose-50 dark:bg-rose-950/20' : isWarning ? 'bg-amber-50 dark:bg-amber-950/20' : '',
                              selectedFullscreenLog?.id === logId && selectedFullscreenLog.kind === 'console' && 'border-indigo-300 bg-indigo-50 dark:border-indigo-500/40 dark:bg-indigo-950/30'
                            )}
                            onClick={() => selectFullscreenConsoleLog(log, logId)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                selectFullscreenConsoleLog(log, logId);
                              }
                            }}
                          >
                            <span className="col-span-2 text-[10px] font-bold text-muted-foreground">{formatLogRecordingTime(log)}</span>
                            <span className={cn("col-span-8 break-all text-[11px]", isError ? 'text-rose-700 dark:text-rose-300' : isWarning ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300/90')}>
                              {typeof log.log === 'object' ? `${JSON.stringify(log.log).substring(0, 240)}...` : String(log.log ?? '')}
                            </span>
                            <span className="col-span-2 flex items-center justify-end gap-2 text-right text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                              {count > 1 && (
                                <span className="rounded-full border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[9px] font-semibold text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-950/60 dark:text-indigo-200">
                                  x{count}
                                </span>
                              )}
                              Use
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </div>
            </ResizablePanel>
  );
}
