'use client';

import { Code2, Globe2, Loader2, Play, Square, UserRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { ManualCaptureBrowserMode, ManualCaptureMode } from '@/hooks/useAutomationLogs';

type ManualCaptureCommandProps = Record<string, any>;

export function ManualCaptureCommand(props: ManualCaptureCommandProps) {
  const {
    socketReady, manualCaptureSessionId, isManualCaptureActive, manualCaptureMode, setManualCaptureMode,
    isStartingManualCapture, manualCaptureBrowserMode, setManualCaptureBrowserMode,
    manualCaptureTargetUrl, setManualCaptureTargetUrl, isStoppingManualCapture, stopManualCapture,
    startManualCapture, captureScriptTag,
  } = props;

  return (
                          <div className="mb-4 rounded-2xl border border-border/60 bg-secondary/20 p-4 shadow-sm">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2.5">
                                  <div className="p-1.5 rounded-lg bg-teal-500/10">
                                    <Play className="h-4 w-4 text-teal-400" />
                                  </div>
                                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Manual Capture Command</p>
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "rounded-md text-[10px] font-bold uppercase tracking-wider shadow-none",
                                      socketReady
                                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400'
                                        : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400'
                                    )}
                                  >
                                    {socketReady ? 'Relay Live' : 'Relay Offline'}
                                  </Badge>
                                  {isManualCaptureActive && (
                                    <Badge className="rounded-md border border-teal-200 bg-teal-50 text-[10px] font-semibold uppercase tracking-tighter text-teal-700 shadow-none dark:border-teal-500/30 dark:bg-teal-500/20 dark:text-teal-400">
                                      {manualCaptureSessionId?.slice(0, 18)}
                                    </Badge>
                                  )}
                                </div>
                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                  <div className="grid w-full grid-cols-3 gap-1 rounded-xl border border-border/60 bg-background p-1 shadow-inner sm:w-auto dark:bg-muted/40">
                                    {([
                                      { value: 'frame', label: 'Frame' },
                                      { value: 'video', label: 'Video' },
                                      { value: 'hybrid', label: 'Hybrid' },
                                    ] as Array<{ value: ManualCaptureMode; label: string }>).map((option) => {
                                      const active = manualCaptureMode === option.value;
                                      return (
                                        <button
                                          key={option.value}
                                          type="button"
                                          disabled={isManualCaptureActive || isStartingManualCapture}
                                          onClick={() => setManualCaptureMode(option.value)}
                                          className={cn(
                                            "inline-flex h-8 min-w-0 items-center justify-center rounded-lg px-3 text-[9px] font-semibold uppercase tracking-wider transition-colors disabled:cursor-not-allowed disabled:opacity-60 sm:min-w-[76px]",
                                            active
                                              ? 'bg-indigo-600 text-white shadow-sm dark:bg-indigo-400 dark:text-slate-950'
                                              : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                                          )}
                                          title={option.value === 'hybrid' ? 'Video plus keyframe evidence' : option.value === 'video' ? 'Video review only' : 'Frame evidence only'}
                                        >
                                          {option.label}
                                        </button>
                                      );
                                    })}
                                  </div>
                                  <div className="grid w-full grid-cols-2 gap-1 rounded-xl border border-border/60 bg-background p-1 shadow-inner sm:w-auto dark:bg-muted/40">
                                    {([
                                      { value: 'clean', label: 'Kosong', icon: Globe2 },
                                      { value: 'profiled', label: 'Profiled', icon: UserRound },
                                    ] as const).map((option) => {
                                      const Icon = option.icon;
                                      const active = manualCaptureBrowserMode === option.value;
                                      return (
                                        <button
                                          key={option.value}
                                          type="button"
                                          disabled={isManualCaptureActive || isStartingManualCapture}
                                          onClick={() => setManualCaptureBrowserMode(option.value)}
                                          className={cn(
                                            "inline-flex h-8 min-w-0 items-center justify-center gap-1.5 rounded-lg px-3 text-[10px] font-semibold uppercase tracking-wider transition-colors disabled:cursor-not-allowed disabled:opacity-60 sm:min-w-[92px]",
                                            active
                                              ? 'bg-teal-600 text-white shadow-sm dark:bg-teal-500 dark:text-slate-950'
                                              : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                                          )}
                                          title={option.value === 'profiled' ? 'Pakai profile QA Desk yang menyimpan login dan cookies' : 'Pakai browser sementara yang bersih'}
                                        >
                                          <Icon className="h-3.5 w-3.5" />
                                          {option.label}
                                        </button>
                                      );
                                    })}
                                  </div>
                                  <Input
                                    value={manualCaptureTargetUrl}
                                    onChange={(event) => setManualCaptureTargetUrl(event.target.value)}
                                    placeholder="https://target-app.example/path"
                                    disabled={isManualCaptureActive}
                                    className="h-10 min-w-[260px] flex-1 rounded-xl border-border/60 bg-background text-[11px] text-foreground placeholder:text-muted-foreground focus:ring-teal-500/40 dark:bg-muted/50"
                                  />
                                  {isManualCaptureActive ? (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="h-10 min-w-[150px] shrink-0 gap-2 rounded-xl border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 font-semibold uppercase tracking-wider text-[10px] dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400 dark:hover:bg-rose-500/20"
                                      onClick={stopManualCapture}
                                      disabled={isStoppingManualCapture}
                                    >
                                      {isStoppingManualCapture ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />}
                                      Stop Capture
                                    </Button>
                                  ) : (
                                    <Button
                                      type="button"
                                      size="sm"
                                      className="h-10 min-w-[150px] shrink-0 gap-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold uppercase tracking-wider text-[10px] shadow-lg shadow-teal-900/40"
                                      onClick={() => startManualCapture({ browserMode: manualCaptureBrowserMode, captureMode: manualCaptureMode })}
                                      disabled={!manualCaptureTargetUrl.trim() || isStartingManualCapture}
                                    >
                                      {isStartingManualCapture ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                                      Start Capture
                                    </Button>
                                  )}
                                </div>
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-10 shrink-0 gap-2 rounded-xl border-border/60 bg-secondary/50 text-[10px] font-semibold uppercase tracking-wider text-foreground transition-colors hover:bg-secondary dark:text-slate-400 dark:hover:text-white"
                                onClick={() => navigator.clipboard.writeText(captureScriptTag)}
                              >
                                <Code2 className="h-4 w-4" />
                                Copy Script
                              </Button>
                            </div>
                          </div>
  );
}

