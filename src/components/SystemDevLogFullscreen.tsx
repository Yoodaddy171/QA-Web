'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Clock, Filter, Layers, RefreshCw, Search, X, Wrench } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { FullscreenLogFilter } from '@/components/TestCaseDetailDialog.helpers';

type SystemDevLogFullscreenProps = Record<string, any>;

export function SystemDevLogFullscreen(props: SystemDevLogFullscreenProps) {
  const {
    isSystemDevLogFullscreen, activeDevLogTab, fullscreenNetworkGroups, fullscreenConsoleGroups, viewTestCase,
    setActiveDevLogTab, setSelectedSystemDevLogId, selectedSystemDevLogId, setIsSystemDevLogFullscreen,
    fullscreenLogFilter, setFullscreenLogFilter, fullscreenLogSearch, setFullscreenLogSearch,
    networkCodeWrap, setNetworkCodeWrap, closeSystemDevLogFullscreen,
    selectedFullscreenLog, setSelectedFullscreenLog, filteredFullscreenLogs,
    selectedSystemNetworkGroup, selectedSystemConsoleGroup, formatRelativeTime,
    getNetworkMethod, getNetworkCategoryClass, getNetworkStatusClass, getNetworkStatus,
    getNetworkDuration, networkCodePanelClass, networkCodeWhitespaceClass, formatPrettyValue,
    getRequestPayload, getResponsePayload, networkFullscreenCodePanelClass, seekRecordingFromLog, getConsoleLogText,
  } = props;
  return isSystemDevLogFullscreen ? (
          <div className="fixed inset-0 z-[78] flex items-stretch justify-stretch bg-background text-foreground">
            <div className="flex h-screen w-screen overflow-hidden bg-background">
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex min-h-20 shrink-0 items-center justify-between gap-4 border-b border-border bg-background px-5 py-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Wrench className="h-4 w-4 text-teal-500" />
                      <p className="text-xs font-semibold uppercase tracking-wider text-foreground">System DevLog Fullscreen</p>
                      <Badge variant="outline" className="rounded-md border-teal-200 bg-teal-50 text-[10px] font-semibold uppercase tracking-wider text-teal-700 dark:border-teal-500/30 dark:bg-teal-500/10 dark:text-teal-200">
                        {activeDevLogTab === 'network' ? `${fullscreenNetworkGroups.length} network` : `${fullscreenConsoleGroups.length} console`}
                      </Badge>
                    </div>
                    <p className="mt-1 truncate text-[11px] font-medium text-muted-foreground">
                      {viewTestCase?.testCaseId || '-'} Â· {viewTestCase?.testAction || 'Execution telemetry'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 pr-12">
                    <div className="flex rounded-md bg-muted p-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "h-8 px-3 text-[10px] font-semibold uppercase tracking-wider",
                          activeDevLogTab === 'console'
                            ? 'bg-teal-100 text-teal-800 hover:bg-teal-100 dark:bg-teal-500/15 dark:text-teal-100'
                            : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                        )}
                        onClick={() => {
                          setActiveDevLogTab('console');
                          setSelectedSystemDevLogId(null);
                        }}
                      >
                        Console
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "h-8 px-3 text-[10px] font-semibold uppercase tracking-wider",
                          activeDevLogTab === 'network'
                            ? 'bg-teal-100 text-teal-800 hover:bg-teal-100 dark:bg-teal-500/15 dark:text-teal-100'
                            : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                        )}
                        onClick={() => {
                          setActiveDevLogTab('network');
                          setSelectedSystemDevLogId(null);
                        }}
                      >
                        Network
                      </Button>
                    </div>
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
                            "h-8 px-3 text-[10px] font-semibold uppercase tracking-wider",
                            fullscreenLogFilter === item.value
                              ? 'bg-indigo-100 text-indigo-800 hover:bg-indigo-100 dark:bg-indigo-500/20 dark:text-indigo-100'
                              : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                          )}
                          onClick={() => {
                            setFullscreenLogFilter(item.value as FullscreenLogFilter);
                            setSelectedSystemDevLogId(null);
                          }}
                        >
                          {item.label}
                        </Button>
                      ))}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "h-8 rounded-md border px-3 text-[10px] font-semibold uppercase tracking-wider",
                        networkCodeWrap
                          ? 'border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100 dark:border-teal-500/30 dark:bg-teal-500/10 dark:text-teal-200'
                          : 'border-border bg-muted text-muted-foreground hover:bg-secondary hover:text-foreground'
                      )}
                      onClick={() => setNetworkCodeWrap((current) => !current)}
                    >
                      Wrap {networkCodeWrap ? 'On' : 'Off'}
                    </Button>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-5 top-5 z-[90] h-10 w-10 rounded-full border border-border/70 bg-background/90 p-0 text-foreground shadow-xl backdrop-blur transition hover:bg-secondary"
                    onClick={closeSystemDevLogFullscreen}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid min-h-0 flex-1 grid-cols-[minmax(380px,34%)_1fr] bg-muted/25">
                  <div className="min-h-0 overflow-y-auto border-r border-border p-3">
                    {activeDevLogTab === 'network' ? (
                      <div className="space-y-2">
                        {fullscreenNetworkGroups.length === 0 ? (
                          <div className="flex h-full min-h-[420px] flex-col items-center justify-center text-muted-foreground">
                            <RefreshCw className="mb-3 h-8 w-8 opacity-20" />
                            <p className="text-[10px] font-bold uppercase tracking-wider">No Network Rows</p>
                          </div>
                        ) : fullscreenNetworkGroups.map((group) => {
                          const { log: net, meta, count } = group;
                          const logId = `system-network-${group.id}`;
                          const active = selectedSystemDevLogId === logId;

                          return (
                            <div
                              key={logId}
                              role="button"
                              tabIndex={0}
                              className={cn(
                                "grid cursor-pointer grid-cols-12 items-center gap-2 rounded-lg border border-border bg-background p-3 text-left shadow-sm transition hover:border-indigo-200 hover:bg-secondary/50 dark:hover:border-indigo-500/30 dark:hover:bg-white/5",
                                active && "border-indigo-300 bg-indigo-50 dark:border-indigo-500/40 dark:bg-indigo-950/30"
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
                              <span className="col-span-2 truncate font-semibold text-indigo-700 dark:text-indigo-300">{getNetworkMethod(net.network)}</span>
                              <span className="col-span-2 truncate">
                                <span className={`rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase ${getNetworkCategoryClass(meta.category)}`}>
                                  {meta.label}
                                </span>
                              </span>
                              <span className="col-span-5 min-w-0">
                                <span className="block truncate text-[11px] font-bold text-foreground">{meta.pathname.split('/').pop() || meta.pathname || net.network.url}</span>
                                <span className="block truncate text-[9px] text-muted-foreground">{meta.host}</span>
                              </span>
                              <span className="col-span-1 text-center">
                                <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold", getNetworkStatusClass(net.network))}>
                                  {getNetworkStatus(net.network)}
                                </span>
                              </span>
                              <span className="col-span-2 flex items-center justify-end gap-2 text-[10px] font-bold text-muted-foreground">
                                <span>{formatRelativeTime(net.relativeMs)}</span>
                                {count > 1 && (
                                  <span className="rounded-full border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[9px] font-semibold text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-950/60 dark:text-indigo-200">
                                    x{count}
                                  </span>
                                )}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {fullscreenConsoleGroups.length === 0 ? (
                          <div className="flex h-full min-h-[420px] flex-col items-center justify-center text-muted-foreground">
                            <Clock className="mb-3 h-8 w-8 opacity-20" />
                            <p className="text-[10px] font-bold uppercase tracking-wider">No Console Rows</p>
                          </div>
                        ) : fullscreenConsoleGroups.map((group) => {
                          const { log, entries, count } = group;
                          const logId = `system-console-${group.id}`;
                          const active = selectedSystemDevLogId === logId;
                          const isError = entries.some((entry) => entry.level === 'SEVERE' || entry.log?.toString().toLowerCase().includes('error'));
                          const isWarning = entries.some((entry) => entry.level === 'WARNING' || entry.log?.toString().toLowerCase().includes('warn'));

                          return (
                            <div
                              key={logId}
                              role="button"
                              tabIndex={0}
                              className={cn(
                                "grid cursor-pointer grid-cols-12 gap-2 rounded-lg border border-border bg-background p-3 text-left shadow-sm transition hover:border-indigo-200 hover:bg-secondary/50 dark:hover:border-indigo-500/30 dark:hover:bg-white/5",
                                isError ? 'bg-rose-50 dark:bg-rose-950/20' : isWarning ? 'bg-amber-50 dark:bg-amber-950/20' : '',
                                active && 'border-indigo-300 bg-indigo-50 dark:border-indigo-500/40 dark:bg-indigo-950/30'
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
                              <span className="col-span-2 text-[10px] font-bold text-muted-foreground">{formatRelativeTime(log.relativeMs)}</span>
                              <span className={cn("col-span-8 break-all text-[11px]", isError ? 'text-rose-700 dark:text-rose-300' : isWarning ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300/90')}>
                                {typeof log.log === 'object' ? `${JSON.stringify(log.log).substring(0, 220)}...` : String(log.log ?? '')}
                              </span>
                              <span className="col-span-2 flex items-start justify-end gap-2 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                                {count > 1 && (
                                  <span className="rounded-full border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[9px] font-semibold text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-950/60 dark:text-indigo-200">
                                    x{count}
                                  </span>
                                )}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="min-h-0 overflow-y-auto p-4">
                    {activeDevLogTab === 'network' ? (
                      selectedSystemNetworkGroup ? (
                        <div className="space-y-4">
                          <div className="rounded-xl border border-border bg-background p-4 shadow-sm">
                            <div className="mb-3 flex flex-wrap items-center gap-2">
                              <Badge className="rounded-md border border-cyan-200 bg-cyan-50 text-[10px] font-semibold uppercase tracking-wider text-cyan-700 shadow-none dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-200">
                                {selectedSystemNetworkGroup.meta.label}
                              </Badge>
                              <Badge variant="outline" className="rounded-md text-[10px] font-semibold uppercase tracking-wider">
                                {getNetworkMethod(selectedSystemNetworkGroup.log.network)}
                              </Badge>
                              <span className={cn("rounded px-2 py-1 text-[10px] font-semibold", getNetworkStatusClass(selectedSystemNetworkGroup.log.network))}>
                                {getNetworkStatus(selectedSystemNetworkGroup.log.network)}
                              </span>
                              {selectedSystemNetworkGroup.count > 1 && (
                                <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-950/60 dark:text-indigo-200">
                                  Repeated x{selectedSystemNetworkGroup.count}
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Full URL</p>
                            <pre className={cn("mt-2 overflow-auto rounded-lg border border-border bg-muted p-3 font-mono text-[11px] leading-relaxed text-foreground", networkCodeWhitespaceClass)}>
                              {selectedSystemNetworkGroup.log.network.url}
                            </pre>
                          </div>

                          {selectedSystemNetworkGroup.count > 1 && (
                            <div className="rounded-xl border border-border bg-background p-4 shadow-sm">
                              <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Repeated Calls</p>
                              <div className="max-h-52 space-y-1 overflow-y-auto pr-1">
                                {selectedSystemNetworkGroup.entries.map((entry, entryIndex) => (
                                  <button
                                    key={entry.log.id ?? `system-repeat-${entryIndex}`}
                                    type="button"
                                    className="grid w-full grid-cols-[54px_80px_90px_1fr] gap-2 rounded-md border border-border bg-muted/40 px-2 py-1.5 text-left text-[10px] hover:bg-secondary"
                                    onClick={() => seekRecordingFromLog(entry.log)}
                                  >
                                    <span className="font-semibold text-muted-foreground">#{entryIndex + 1}</span>
                                    <span className="font-mono text-indigo-700 dark:text-indigo-300">{formatRelativeTime(entry.log.relativeMs)}</span>
                                    <span className={cn("rounded px-1.5 py-0.5 text-center font-bold", getNetworkStatusClass(entry.log.network))}>
                                      {getNetworkStatus(entry.log.network)}
                                    </span>
                                    <span className="truncate text-foreground">{getNetworkDuration(entry.log.network)}</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="grid grid-cols-1 items-start gap-4 overflow-x-auto xl:grid-cols-3">
                            <div className="space-y-2">
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Headers</p>
                              <pre className={cn(networkFullscreenCodePanelClass, networkCodeWhitespaceClass, "text-foreground")}>
                                {formatPrettyValue(selectedSystemNetworkGroup.log.network.headers)}
                              </pre>
                            </div>
                            <div className="space-y-2">
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Payload</p>
                              <pre className={cn(networkFullscreenCodePanelClass, networkCodeWhitespaceClass, "text-cyan-700 dark:text-cyan-200")}>
                                {formatPrettyValue(getRequestPayload(selectedSystemNetworkGroup.log.network.data))}
                              </pre>
                            </div>
                            <div className="space-y-2">
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Response</p>
                              <pre className={cn(networkFullscreenCodePanelClass, networkCodeWhitespaceClass, "text-emerald-700 dark:text-emerald-200")}>
                                {formatPrettyValue(getResponsePayload(selectedSystemNetworkGroup.log.network.data))}
                              </pre>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex h-full min-h-[520px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-background text-muted-foreground">
                          <Layers className="mb-3 h-8 w-8 opacity-30" />
                          <p className="text-[10px] font-semibold uppercase tracking-wider">Pilih network row untuk membuka drawer detail</p>
                        </div>
                      )
                    ) : (
                      selectedSystemConsoleGroup ? (
                        <div className="space-y-4">
                          <div className="rounded-xl border border-border bg-background p-4 shadow-sm">
                            <div className="mb-3 flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className="rounded-md text-[10px] font-semibold uppercase tracking-wider">
                                {selectedSystemConsoleGroup.log.level || 'INFO'}
                              </Badge>
                              {selectedSystemConsoleGroup.count > 1 && (
                                <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-950/60 dark:text-indigo-200">
                                  Repeated x{selectedSystemConsoleGroup.count}
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Message</p>
                            <pre className="mt-2 min-h-[260px] max-h-[62vh] overflow-auto whitespace-pre-wrap break-words rounded-xl border border-border bg-muted p-4 text-[11px] leading-relaxed text-foreground">
                              {formatPrettyValue(selectedSystemConsoleGroup.log.log)}
                            </pre>
                          </div>
                          {selectedSystemConsoleGroup.count > 1 && (
                            <div className="rounded-xl border border-border bg-background p-4 shadow-sm">
                              <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Repeated Logs</p>
                              <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
                                {selectedSystemConsoleGroup.entries.map((entry, entryIndex) => (
                                  <button
                                    key={entry.id ?? `system-console-repeat-${entryIndex}`}
                                    type="button"
                                    className="grid w-full grid-cols-[54px_80px_1fr] gap-2 rounded-md border border-border bg-muted/40 px-2 py-1.5 text-left text-[10px] hover:bg-secondary"
                                    onClick={() => seekRecordingFromLog(entry)}
                                  >
                                    <span className="font-semibold text-muted-foreground">#{entryIndex + 1}</span>
                                    <span className="font-mono text-indigo-700 dark:text-indigo-300">{formatRelativeTime(entry.relativeMs)}</span>
                                    <span className="truncate text-foreground">{getConsoleLogText(entry)}</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex h-full min-h-[520px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-background text-muted-foreground">
                          <Clock className="mb-3 h-8 w-8 opacity-30" />
                          <p className="text-[10px] font-semibold uppercase tracking-wider">Pilih console row untuk membuka drawer detail</p>
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
  ) : null;
}
