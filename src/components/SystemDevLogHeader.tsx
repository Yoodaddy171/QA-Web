'use client';

import { History, Loader2, Maximize2, Sparkles, Trash2, Wrench, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

type SystemDevLogHeaderProps = Record<string, any>;

export function SystemDevLogHeader(props: SystemDevLogHeaderProps) {
  const { socketReady, openSystemDevLogFullscreen, isSummarizing, generateAISummary, activeDevLogTab, setActiveDevLogTab, groupedConsoleLogs, groupedNetworkLogs, loadedRunLabel, loadCurrentLogRun, isLoadingHistory, loadLogHistory, clearLogs } = props;
  return (
                          <div className="flex flex-wrap items-center justify-between gap-4 mb-4 shrink-0">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white shadow-xl border border-border dark:bg-muted dark:border-white/5 dark:shadow-2xl">
                                <Wrench className="w-5 h-5 text-teal-400" />
                              </div>
                              <div>
                                <h4 className="text-sm font-semibold text-foreground leading-tight uppercase tracking-tight dark:text-foreground">System DevLog</h4>
                                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Execution Telemetry</p>
                              </div>
                              {socketReady && (
                                <div className="flex items-center gap-2 ml-4 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 shadow-sm">
                                  <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                  </span>
                                  <span className="text-[10px] font-semibold text-emerald-700 uppercase tracking-tighter dark:text-emerald-400">Live Relay</span>
                                </div>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 bg-muted/70 p-1 rounded-xl border border-border dark:bg-secondary/50 dark:border-border/60">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 rounded-lg px-2.5 text-[10px] font-semibold uppercase tracking-wider gap-2 text-muted-foreground hover:bg-secondary hover:text-foreground dark:text-slate-500 dark:hover:text-slate-300"
                                onClick={openSystemDevLogFullscreen}
                              >
                                <Maximize2 className="h-3.5 w-3.5" />
                                Fullscreen
                              </Button>
                              <Separator orientation="vertical" className="h-5 mx-0.5 bg-border" />
                              <Button
                                variant="ghost"
                                size="sm"
                                className={cn(
                                  "h-8 px-2.5 text-[10px] font-semibold uppercase tracking-wider gap-2 rounded-lg",
                                  isSummarizing && "animate-pulse",
                                  "border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 dark:border-violet-500/30 dark:bg-gradient-to-r dark:from-violet-600/20 dark:to-indigo-600/20 dark:text-violet-300 dark:hover:from-violet-600/30 dark:hover:to-indigo-600/30"
                                )}
                                onClick={generateAISummary}
                                disabled={isSummarizing}
                              >
                                <Sparkles className={cn("w-3.5 h-3.5", isSummarizing && "animate-spin")} />
                                AI Summary
                              </Button>
                              <Separator orientation="vertical" className="h-5 mx-0.5 bg-border" />
                              <Button
                                variant={activeDevLogTab === 'execution' ? 'default' : 'ghost'}
                                size="sm"
                                className={cn(
                                  "h-8 rounded-lg px-2.5 text-[10px] font-semibold uppercase tracking-wider",
                                  activeDevLogTab === 'execution' ? 'bg-teal-50 text-teal-700 shadow-sm hover:bg-teal-100 dark:bg-teal-500/15 dark:text-teal-200 dark:shadow-xl dark:hover:bg-teal-500/20' : 'text-muted-foreground hover:bg-secondary hover:text-foreground dark:text-slate-500 dark:hover:text-slate-300'
                                )}
                                onClick={() => setActiveDevLogTab('execution')}
                              >
                                Execution
                              </Button>
                              <Button
                                variant={activeDevLogTab === 'console' ? 'default' : 'ghost'}
                                size="sm"
                                className={cn(
                                  "h-8 rounded-lg px-2.5 text-[10px] font-semibold uppercase tracking-wider",
                                  activeDevLogTab === 'console' ? 'bg-teal-50 text-teal-700 shadow-sm hover:bg-teal-100 dark:bg-teal-500/15 dark:text-teal-200 dark:shadow-xl dark:hover:bg-teal-500/20' : 'text-muted-foreground hover:bg-secondary hover:text-foreground dark:text-slate-500 dark:hover:text-slate-300'
                                )}
                                onClick={() => setActiveDevLogTab('console')}
                              >
                                Console ({groupedConsoleLogs.length})
                              </Button>
                              <Button
                                variant={activeDevLogTab === 'network' ? 'default' : 'ghost'}
                                size="sm"
                                className={cn(
                                  "h-8 rounded-lg px-2.5 text-[10px] font-semibold uppercase tracking-wider",
                                  activeDevLogTab === 'network' ? 'bg-teal-50 text-teal-700 shadow-sm hover:bg-teal-100 dark:bg-teal-500/15 dark:text-teal-200 dark:shadow-xl dark:hover:bg-teal-500/20' : 'text-muted-foreground hover:bg-secondary hover:text-foreground dark:text-slate-500 dark:hover:text-slate-300'
                                )}
                                onClick={() => setActiveDevLogTab('network')}
                              >
                                Network ({groupedNetworkLogs.length})
                              </Button>
                              <Separator orientation="vertical" className="h-5 mx-0.5 bg-border" />
                              <Button
                                variant={loadedRunLabel === 'current' || loadedRunLabel === 'live' ? 'default' : 'ghost'}
                                size="sm"
                                className={cn(
                                  "h-8 px-2.5 text-[9px] font-semibold uppercase tracking-wider rounded-lg",
                                  (loadedRunLabel === 'current' || loadedRunLabel === 'live') ? 'bg-teal-600 text-white shadow-lg hover:bg-teal-500' : 'text-muted-foreground hover:bg-teal-50 hover:text-teal-700 dark:text-slate-500 dark:hover:bg-teal-500/10 dark:hover:text-teal-400'
                                )}
                                onClick={loadCurrentLogRun}
                                disabled={isLoadingHistory}
                              >
                                Current
                              </Button>
                              <Button
                                variant={loadedRunLabel === 'previous' ? 'default' : 'ghost'}
                                size="sm"
                                className={cn(
                                  "h-8 px-2.5 text-[9px] font-semibold uppercase tracking-wider rounded-lg gap-1.5",
                                  loadedRunLabel === 'previous' ? 'bg-indigo-600 text-white shadow-lg hover:bg-indigo-500' : 'text-muted-foreground hover:bg-indigo-50 hover:text-indigo-700 dark:text-slate-500 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-400'
                                )}
                                onClick={loadLogHistory}
                                disabled={isLoadingHistory}
                              >
                                {isLoadingHistory ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <History className="w-3.5 h-3.5" />
                                )}
                                Previous
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:bg-rose-50 hover:text-rose-700 dark:text-slate-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
                                onClick={clearLogs}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
  );
}

