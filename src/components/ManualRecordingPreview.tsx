'use client';

import { Film, Loader2, Maximize2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { buildDevlogRelayUrl } from '@/lib/client/api/devlog-client';

type ManualRecordingPreviewProps = Record<string, any>;

export function ManualRecordingPreview(props: ManualRecordingPreviewProps) {
  const {
    manualRecording, hasManualRecordingVideo, manualRecordingVideoUrl, recordingVideoKey, recordingVideoRef,
    handleRecordingVideoLoadedMetadata, selectedRecordingFrame, isVideoLoading, isVideoPlaybackReady,
    handleFullscreenVideoTimeUpdate, videoProcessingPercent, isVideoFinalizing, manualRecordingMode,
    manualRecordingFrames, manualRecordingVideoStatus, recordingDisplayMs, recordingSeekApprox,
    openRecordingFullscreen, manualRecordingTargetUrl, setRecordingSeekMs, setRecordingSeekApprox,
    formatRelativeTime,
  } = props;

  return (
                          (manualRecording?.frames?.length || hasManualRecordingVideo) ? (
                            <div className="mb-4 grid gap-4 rounded-2xl border border-border/60 bg-secondary/20 p-4 shadow-xl lg:grid-cols-[320px_1fr]">
                              <button
                                type="button"
                                aria-busy={isVideoLoading}
                                disabled={isVideoLoading}
                                className="group relative overflow-hidden rounded-xl border border-border/60 bg-background text-left shadow-2xl disabled:cursor-wait"
                                onClick={openRecordingFullscreen}
                              >
                                {hasManualRecordingVideo ? (
                                  <video
                                    key={recordingVideoKey}
                                    ref={recordingVideoRef}
                                    src={manualRecordingVideoUrl}
                                    controls={isVideoPlaybackReady}
                                    preload="metadata"
                                    onLoadedMetadata={handleRecordingVideoLoadedMetadata}
                                    onDurationChange={handleRecordingVideoLoadedMetadata}
                                    onTimeUpdate={handleFullscreenVideoTimeUpdate}
                                    className={cn(
                                      "aspect-video w-full bg-black object-contain transition-opacity",
                                      isVideoLoading ? "opacity-0" : "opacity-90 group-hover:opacity-100"
                                    )}
                                  />
                                ) : selectedRecordingFrame ? (
                                  <img
                                    src={buildDevlogRelayUrl(selectedRecordingFrame.url)}
                                    alt="Manual capture recording frame"
                                    className="aspect-video w-full bg-black object-contain opacity-80 group-hover:opacity-100 transition-opacity"
                                  />
                                ) : null}
                                {isVideoLoading ? (
                                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/85 text-white">
                                    <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
                                    <span className="text-[10px] font-semibold uppercase tracking-wider">
                                      Memproses video{videoProcessingPercent !== null && isVideoFinalizing ? ` — ${videoProcessingPercent}%` : ''}
                                    </span>
                                    {videoProcessingPercent !== null && isVideoFinalizing ? (
                                      <div className="h-1.5 w-44 overflow-hidden rounded-full bg-white/15">
                                        <div
                                          className="h-full rounded-full bg-cyan-400 transition-[width] duration-300 motion-reduce:transition-none"
                                          style={{ width: `${videoProcessingPercent}%` }}
                                        />
                                      </div>
                                    ) : (
                                      <span className="text-[10px] text-white/55">Menyiapkan durasi dan preview...</span>
                                    )}
                                  </div>
                                ) : (
                                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition duration-300 group-hover:bg-black/40 group-hover:opacity-100">
                                    <span className="inline-flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-teal-700 shadow-2xl dark:border-teal-500/20 dark:bg-teal-500/10 dark:text-teal-200">
                                      <Maximize2 className="h-4 w-4" />
                                      Fullscreen
                                    </span>
                                  </div>
                                )}
                              </button>
                              <div className="flex min-w-0 flex-col justify-between gap-4">
                                <div>
                                  <div className="flex flex-wrap items-center gap-2.5">
                                    <div className="p-1.5 rounded-lg bg-indigo-500/10">
                                      <Film className="h-4 w-4 text-indigo-400" />
                                    </div>
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground">Screen Analytics</p>
                                    <Badge variant="outline" className="rounded-md border-indigo-500/20 bg-indigo-500/10 text-[9px] font-semibold text-indigo-400 uppercase tracking-tighter">
                                      {manualRecordingMode}
                                    </Badge>
                                    <Badge variant="outline" className="rounded-md border-indigo-500/20 bg-indigo-500/10 text-[9px] font-semibold text-indigo-400 uppercase tracking-tighter">
                                      {manualRecordingMode === 'video' && manualRecordingFrames.length === 0 ? 'Video only' : `${manualRecordingFrames.length} keyframes`}
                                    </Badge>
                                    {manualRecordingVideoStatus && (
                                      <Badge variant="outline" className="rounded-md border-cyan-500/20 bg-cyan-500/10 text-[9px] font-semibold text-cyan-500 uppercase tracking-tighter">
                                        Video {manualRecordingVideoStatus}
                                      </Badge>
                                    )}
                                    {isVideoLoading && (
                                      <Badge variant="outline" className="rounded-md border-amber-500/20 bg-amber-500/10 text-[9px] font-semibold text-amber-600 uppercase tracking-tighter dark:text-amber-300">
                                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                        Processing
                                      </Badge>
                                    )}
                                    <Badge variant="outline" className="rounded-md border-border/60 bg-muted/50 text-[9px] font-semibold text-foreground uppercase tracking-tighter">
                                      {formatRelativeTime(recordingDisplayMs)}
                                    </Badge>
                                    {recordingSeekApprox && (
                                      <Badge variant="outline" className="rounded-md border-amber-500/20 bg-amber-500/10 text-[9px] font-semibold text-amber-600 uppercase tracking-tighter dark:text-amber-300">
                                        Approx
                                      </Badge>
                                    )}
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="ml-auto h-8 gap-2 rounded-lg border-border/60 bg-secondary/50 px-3 text-[9px] font-semibold uppercase tracking-wider text-foreground hover:bg-secondary dark:text-slate-400 dark:hover:text-white"
                                      disabled={isVideoLoading}
                                      onClick={openRecordingFullscreen}
                                    >
                                      {isVideoLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Maximize2 className="h-3.5 w-3.5" />}
                                      {isVideoLoading ? 'Processing' : 'Review'}
                                    </Button>
                                  </div>
                                  <p className="mt-3 truncate text-[11px] font-medium text-muted-foreground">
                                    {manualRecordingTargetUrl}
                                  </p>
                                  {isVideoLoading && (
                                    <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
                                      <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin" />
                                      <span>Video sedang diproses. Viewer akan refresh otomatis setelah file siap.</span>
                                    </div>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {manualRecordingFrames
                                    .filter((_, index) => index % Math.max(1, Math.floor(manualRecordingFrames.length / 12)) === 0)
                                    .slice(0, 12)
                                    .map((frame) => (
                                      <Button
                                        key={frame.file}
                                        type="button"
                                        variant={selectedRecordingFrame?.file === frame.file ? 'default' : 'outline'}
                                        size="sm"
                                        className={cn(
                                          "h-8 rounded-lg px-2.5 text-[10px] font-bold",
                                          selectedRecordingFrame?.file === frame.file
                                            ? 'bg-teal-600 text-white shadow-lg shadow-teal-900/40'
                                            : 'border-border/50 bg-secondary/30 text-muted-foreground hover:text-foreground dark:text-slate-500 dark:hover:text-slate-200'
                                        )}
                                        onClick={() => {
                                          setRecordingSeekMs(frame.relativeMs);
                                          setRecordingSeekApprox(false);
                                        }}
                                      >
                                        {formatRelativeTime(frame.relativeMs)}
                                      </Button>
                                    ))}
                                </div>
                                <p className="text-[10px] font-medium leading-relaxed text-muted-foreground border-l-2 border-teal-500/30 pl-3">
                                  Klik baris Console atau Network yang punya timestamp untuk membuka frame terdekat dari momen tersebut.
                                </p>
                              </div>
                            </div>
                          ) : null
  );
}
