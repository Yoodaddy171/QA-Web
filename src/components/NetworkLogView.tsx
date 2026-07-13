'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Filter, RefreshCw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type NetworkLogViewProps = Record<string, any>;

export function NetworkLogView(props: NetworkLogViewProps) {
  const {
    networkFilters, updateNetworkFilters, networkLogItems, networkHosts, networkMethods,
    setNetworkFilters, DEFAULT_NETWORK_FILTERS, networkCategoryCounts, hiddenNetworkCount,
    toggleNetworkFilter, groupedNetworkLogs, logEndRef, seekRecordingFromLog, expandedLogId,
    setExpandedLogId, getNetworkMethod, getNetworkCategoryClass, getNetworkStatusClass,
    getNetworkStatus, getNetworkDuration, formatRelativeTime, networkCodeWhitespaceClass,
    networkCodePanelClass, formatPrettyValue, getRequestPayload, getResponsePayload,
  } = props;
  return (
                                <div className="h-full flex flex-col">
                                  <div className="space-y-2 border-b border-border bg-muted/60 p-3 dark:border-border dark:bg-card">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <div className="relative min-w-[220px] flex-1">
                                        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                                        <Input
                                          value={networkFilters.search}
                                          onChange={(event) => updateNetworkFilters({ search: event.target.value })}
                                          placeholder="Search URL, host, method, status..."
                                          className="h-8 border-border bg-background pl-8 text-[11px] text-foreground placeholder:text-muted-foreground dark:border-border dark:bg-muted dark:text-slate-200 dark:placeholder:text-slate-600"
                                        />
                                      </div>
                                      <select
                                        value={networkFilters.host}
                                        onChange={(event) => updateNetworkFilters({ host: event.target.value })}
                                        className="h-8 min-w-[150px] rounded-md border border-border bg-background px-2 text-[11px] font-semibold text-foreground outline-none focus:border-indigo-500 dark:border-border dark:bg-muted dark:text-slate-300"
                                      >
                                        <option value="all">All hosts ({networkLogItems.length})</option>
                                        {networkHosts.map((host) => (
                                          <option key={host} value={host}>{host}</option>
                                        ))}
                                      </select>
                                      <select
                                        value={networkFilters.method}
                                        onChange={(event) => updateNetworkFilters({ method: event.target.value })}
                                        className="h-8 rounded-md border border-border bg-background px-2 text-[11px] font-semibold text-foreground outline-none focus:border-indigo-500 dark:border-border dark:bg-muted dark:text-slate-300"
                                      >
                                        <option value="all">All methods</option>
                                        {networkMethods.map((method) => (
                                          <option key={method} value={method}>{method}</option>
                                        ))}
                                      </select>
                                      <select
                                        value={networkFilters.status}
                                        onChange={(event) => updateNetworkFilters({ status: event.target.value })}
                                        className="h-8 rounded-md border border-border bg-background px-2 text-[11px] font-semibold text-foreground outline-none focus:border-indigo-500 dark:border-border dark:bg-muted dark:text-slate-300"
                                      >
                                        <option value="all">All status</option>
                                        <option value="2xx">2xx</option>
                                        <option value="3xx">3xx</option>
                                        <option value="4xx">4xx</option>
                                        <option value="5xx">5xx</option>
                                        <option value="unknown">Unknown</option>
                                      </select>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 gap-1.5 px-2 text-[10px] font-bold text-muted-foreground hover:bg-muted hover:text-foreground dark:text-slate-400 dark:hover:text-white"
                                        onClick={() => setNetworkFilters(DEFAULT_NETWORK_FILTERS)}
                                      >
                                        <Filter className="h-3.5 w-3.5" />
                                        Reset
                                      </Button>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 text-[10px]">
                                      {[
                                        { key: 'showPreflight' as const, label: `Preflight ${networkCategoryCounts.preflight}` },
                                        { key: 'showDocument' as const, label: `Document ${networkCategoryCounts.document}` },
                                        { key: 'showScript' as const, label: `Script ${networkCategoryCounts.script}` },
                                        { key: 'showImage' as const, label: `Image ${networkCategoryCounts.image}` },
                                        { key: 'showStatic' as const, label: `Static ${networkCategoryCounts.static}` },
                                        { key: 'showTelemetry' as const, label: `Telemetry ${networkCategoryCounts.telemetry}` },
                                        { key: 'showDataUrls' as const, label: `Data URL ${networkCategoryCounts.data}` },
                                        { key: 'showOther' as const, label: `Other ${networkCategoryCounts.other}` },
                                      ].map((filter) => (
                                        <Button
                                          key={filter.key}
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          className={cn(
                                            "h-7 rounded-full border px-3 text-[10px] font-bold",
                                            networkFilters[filter.key]
                                              ? 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-500/40 dark:bg-indigo-950/60 dark:text-indigo-200 dark:hover:bg-indigo-900/60'
                                              : 'border-border bg-muted text-muted-foreground hover:bg-secondary hover:text-foreground dark:text-slate-500'
                                          )}
                                          onClick={() => toggleNetworkFilter(filter.key)}
                                        >
                                          {filter.label}
                                        </Button>
                                      ))}
                                      <span className="ml-auto rounded-full border border-cyan-200 bg-cyan-50 px-2 py-1 font-bold text-cyan-700 dark:border-cyan-500/20 dark:bg-cyan-950/40 dark:text-cyan-300">
                                        API {networkCategoryCounts.business}
                                      </span>
                                      {hiddenNetworkCount > 0 && (
                                        <span className="rounded-full border border-border bg-muted px-2 py-1 font-bold text-muted-foreground">
                                          {hiddenNetworkCount} hidden
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-12 gap-2 p-2 bg-muted/70 border-b border-border text-[10px] font-bold text-muted-foreground uppercase tracking-tighter shrink-0 dark:bg-muted dark:border-border dark:text-slate-500">
                                    <div className="col-span-1">Method</div>
                                    <div className="col-span-1">Type</div>
                                    <div className="col-span-5">Name / URL</div>
                                    <div className="col-span-2 text-center">Status</div>
                                    <div className="col-span-2 text-right">Time</div>
                                    <div className="col-span-1"></div>
                                  </div>
                                  <div className="flex-1 overflow-y-auto divide-y divide-border">
                                    {groupedNetworkLogs.length === 0 ? (
                                      <div className="h-full flex flex-col items-center justify-center py-20 text-muted-foreground">
                                        <RefreshCw className="w-8 h-8 mb-3 opacity-20 animate-spin-slow" />
                                        <p className="font-bold tracking-wider text-[10px] uppercase">Waiting for Network Traffic...</p>
                                      </div>
                                    ) : (
                                      groupedNetworkLogs.map((group) => {
                                        const { log: net, meta, entries, count } = group;
                                        const logId = group.id;

                                        return (
                                          <div key={logId} className="group hover:bg-secondary/60 dark:hover:bg-white/5">
                                            <div
                                              className="grid grid-cols-12 gap-2 p-2 cursor-pointer items-center transition-colors"
                                              onClick={() => {
                                                seekRecordingFromLog(net);
                                                setExpandedLogId(expandedLogId === logId ? null : logId);
                                              }}
                                            >
                                              <div className="col-span-1 font-semibold text-indigo-700 truncate dark:text-indigo-400">{getNetworkMethod(net.network)}</div>
                                              <div className="col-span-1 truncate">
                                                <span className={`rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase ${getNetworkCategoryClass(meta.category)}`}>
                                                  {meta.label}
                                                </span>
                                              </div>
                                              <div className="col-span-5 min-w-0">
                                                <div className="truncate text-foreground dark:text-slate-300">{meta.pathname.split('/').pop() || meta.pathname || net.network.url}</div>
                                                <div className="truncate text-[9px] text-muted-foreground">{meta.host}</div>
                                              </div>
                                              <div className="col-span-2 text-center">
                                                <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-bold", getNetworkStatusClass(net.network))}>
                                                  {getNetworkStatus(net.network)}
                                                </span>
                                              </div>
                                              <div className="col-span-2 text-right text-muted-foreground">
                                                <span>{getNetworkDuration(net.network)}</span>
                                                {typeof net.relativeMs === 'number' && (
                                                  <span className="ml-2 text-indigo-700 dark:text-indigo-300">{formatRelativeTime(net.relativeMs)}</span>
                                                )}
                                              </div>
                                              <div className="col-span-1 flex items-center justify-end gap-1.5">
                                                {count > 1 && (
                                                  <span className="rounded-full border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[9px] font-semibold text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-950/60 dark:text-indigo-200">
                                                    x{count}
                                                  </span>
                                                )}
                                                <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform", expandedLogId === logId && "rotate-180")} />
                                              </div>
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
                                                  <div className="p-4 bg-muted/50 border-t border-border dark:bg-muted/50 dark:border-border">
                                                    {count > 1 && (
                                                      <div className="mb-3 rounded-lg border border-border bg-background p-3 dark:border-border dark:bg-card/70">
                                                        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Repeated {count} times</p>
                                                        <div className="max-h-48 space-y-1 overflow-y-auto pr-1">
                                                          {entries.map((entry, entryIndex) => (
                                                            <button
                                                              key={entry.log.id ?? `${logId}-repeat-${entryIndex}`}
                                                              type="button"
                                                              className="grid w-full grid-cols-[54px_72px_72px_1fr] gap-2 rounded-md border border-border bg-muted/40 px-2 py-1 text-left text-[10px] hover:bg-secondary"
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
                                                    <div className="mb-3 rounded-lg border border-border bg-background p-3 dark:border-border dark:bg-card/70">
                                                      <p className="mb-1 text-[10px] font-bold uppercase text-muted-foreground">Full URL</p>
                                                      <pre className={cn("overflow-auto rounded border border-border bg-muted/40 p-2 font-mono text-[10px] leading-relaxed text-foreground dark:text-slate-300", networkCodeWhitespaceClass)}>
                                                        {net.network.url}
                                                      </pre>
                                                    </div>
                                                    <div className="grid grid-cols-1 items-start gap-4 overflow-x-auto xl:grid-cols-3">
                                                      <div className="space-y-3">
                                                        <p className="text-[10px] font-bold text-muted-foreground uppercase">Headers</p>
                                                        <pre className={cn(networkCodePanelClass, networkCodeWhitespaceClass, "max-h-[320px] min-h-[180px] resize-y text-foreground dark:text-slate-400")}>
                                                          {formatPrettyValue(net.network.headers)}
                                                        </pre>
                                                      </div>
                                                      <div className="space-y-3">
                                                        <p className="text-[10px] font-bold text-muted-foreground uppercase">Request Payload</p>
                                                        <pre className={cn(networkCodePanelClass, networkCodeWhitespaceClass, "max-h-[420px] min-h-[180px] resize-y text-cyan-700 dark:text-cyan-300/90")}>
                                                          {formatPrettyValue(getRequestPayload(net.network.data))}
                                                        </pre>
                                                      </div>
                                                      <div className="space-y-3">
                                                        <p className="text-[10px] font-bold text-muted-foreground uppercase">Response</p>
                                                        <pre className={cn(networkCodePanelClass, networkCodeWhitespaceClass, "max-h-[420px] min-h-[180px] resize-y text-emerald-700 dark:text-emerald-500/80")}>
                                                          {formatPrettyValue(getResponsePayload(net.network.data))}
                                                        </pre>
                                                      </div>
                                                    </div>
                                                  </div>
                                                </motion.div>
                                              )}
                                            </AnimatePresence>
                                          </div>
                                        );
                                      })
                                    )}
                                    <div ref={logEndRef} className="h-4" />
                                  </div>
                                </div>
  );
}

