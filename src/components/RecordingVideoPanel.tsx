'use client';

import { ChevronLeft, ChevronRight, Film, Loader2, Maximize2, Minus, Pause, Play, Plus, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { cn } from '@/lib/utils';

type RecordingVideoPanelProps = Record<string, any>;

export function RecordingVideoPanel(props: RecordingVideoPanelProps) {
  const {
    recordingDisplayMs, recordingSeekApprox, manualRecordingTargetUrl, isVideoLoading,
    hasManualRecordingVideo, manualRecordingVideoUrl, recordingVideoKey, recordingVideoRef,
    isVideoPlaybackReady, handleRecordingVideoLoadedMetadata, handleFullscreenVideoTimeUpdate,
    videoProcessingPercent, isVideoFinalizing, manualRecordingFrames, selectedRecordingFrame,
    openRecordingFullscreen, setRecordingSeekApprox, formatRelativeTime,
    updateRecordingZoom, recordingZoom, recordingViewportRef, startRecordingPan, moveRecordingPan,
    stopRecordingPan, fullscreenRecordingVideoRef, currentSyncedVideoEvent, getSyncedEventSeverityClass,
    manualRecordingMode, scrollFullscreenTimeline, groupedSyncedVideoMarkers, selectedSyncedEventId,
    getSyncedMarkerClass, seekRecordingFromSyncedEvent, fullscreenTimelineRef, handleTimelineWheel,
    setRecordingSeekMs,
  } = props;
  return (
            <ResizablePanel defaultSize={58} minSize={28} maxSize={74} className="min-w-0">
            <div className="flex h-full min-w-0 flex-col">
              <div className="flex min-h-20 shrink-0 items-center justify-between gap-4 border-b border-border bg-background px-5 py-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Film className="h-4 w-4 text-indigo-600 dark:text-indigo-300" />
                    <p className="whitespace-nowrap text-xs font-semibold uppercase tracking-wider text-foreground">Screen Record Review</p>
                    <Badge variant="outline" className="rounded-md border-indigo-200 bg-indigo-50 text-[10px] font-bold text-indigo-700 dark:border-indigo-400/30 dark:bg-indigo-950 dark:text-indigo-200">
                      {formatRelativeTime(recordingDisplayMs)}
                    </Badge>
                    {recordingSeekApprox && (
                      <Badge variant="outline" className="rounded-md border-amber-200 bg-amber-50 text-[10px] font-bold text-amber-700 dark:border-amber-400/30 dark:bg-amber-950 dark:text-amber-200">
                        Approx
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 truncate text-[11px] text-muted-foreground">{manualRecordingTargetUrl}</p>
                </div>
                <div className="mr-12 flex items-center gap-1 rounded-md bg-muted p-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground hover:bg-secondary hover:text-foreground"
                    onClick={() => updateRecordingZoom(-0.1)}
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </Button>
                  <span className="min-w-[42px] text-center text-[10px] font-bold text-muted-foreground">
                    {Math.round(recordingZoom * 100)}%
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground hover:bg-secondary hover:text-foreground"
                    onClick={() => updateRecordingZoom(0.1)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <ResizablePanelGroup direction="vertical" className="min-h-0 flex-1">
              <ResizablePanel defaultSize={82} minSize={35} className="min-h-[220px]">
              <div
                ref={recordingViewportRef}
                className={cn(
                  "relative flex h-full min-h-0 overflow-auto bg-slate-950 p-4",
                  recordingZoom > 1 ? 'cursor-grab active:cursor-grabbing' : 'items-center justify-center'
                )}
                onPointerDown={startRecordingPan}
                onPointerMove={moveRecordingPan}
                onPointerUp={stopRecordingPan}
                onPointerCancel={stopRecordingPan}
                onPointerLeave={stopRecordingPan}
              >
                {hasManualRecordingVideo ? (
                  <video
                    key={`${recordingVideoKey}:fullscreen`}
                    ref={fullscreenRecordingVideoRef}
                    src={manualRecordingVideoUrl}
                    controls
                    preload="metadata"
                    onLoadedMetadata={handleRecordingVideoLoadedMetadata}
                    onTimeUpdate={handleFullscreenVideoTimeUpdate}
                    className="m-auto max-h-full max-w-full rounded-lg bg-black shadow-2xl"
                  />
                ) : selectedRecordingFrame ? (
                  <div
                    className="m-auto flex shrink-0 items-center justify-center"
                    style={{
                      width: recordingZoom <= 1 ? '100%' : `${recordingZoom * 100}%`,
                      minHeight: recordingZoom <= 1 ? '100%' : `${recordingZoom * 100}%`,
                    }}
                  >
                    <img
                      src={`http://127.0.0.1:3001${selectedRecordingFrame.url}`}
                      alt="Manual capture fullscreen frame"
                      draggable={false}
                      className="select-none object-contain shadow-2xl transition-[width,height] duration-150"
                      style={{
                        maxWidth: recordingZoom <= 1 ? '100%' : 'none',
                        maxHeight: recordingZoom <= 1 ? '100%' : 'none',
                        width: recordingZoom <= 1 ? 'auto' : '100%',
                        height: 'auto',
                      }}
                    />
                  </div>
                ) : null}
                {hasManualRecordingVideo && (
                  <div className="pointer-events-none absolute left-5 top-5 max-w-[360px] rounded-xl border border-white/15 bg-black/70 p-3 text-white shadow-2xl backdrop-blur">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="rounded-md border-white/20 bg-white/10 text-[10px] font-semibold text-white">
                        {formatRelativeTime(recordingDisplayMs)}
                      </Badge>
                      {currentSyncedVideoEvent && (
                        <Badge variant="outline" className={cn("rounded-md text-[9px] font-semibold uppercase tracking-wider", getSyncedEventSeverityClass(currentSyncedVideoEvent))}>
                          {currentSyncedVideoEvent.severity}
                        </Badge>
                      )}
                    </div>
                    {currentSyncedVideoEvent && (
                      <div className="mt-2 min-w-0">
                        <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-white/70">
                          {currentSyncedVideoEvent.label} / {currentSyncedVideoEvent.category}
                        </p>
                        <p className="mt-1 line-clamp-2 text-[11px] font-semibold leading-snug text-white">
                          {currentSyncedVideoEvent.summary}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
              </ResizablePanel>
              <ResizableHandle withHandle />

              <ResizablePanel defaultSize={18} minSize={12} maxSize={45} className="min-h-[86px]">
              <div className="h-full overflow-hidden border-t border-border bg-background p-3">
                <div className="mb-2 flex items-center justify-between gap-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  <span>Timeline</span>
                  <div className="flex items-center gap-2">
                    <span>{manualRecordingMode === 'video' && manualRecordingFrames.length === 0 ? 'Video only' : `${manualRecordingFrames.length} keyframes`}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 rounded-md border border-border bg-muted p-0 text-muted-foreground hover:bg-secondary hover:text-foreground"
                      onClick={() => scrollFullscreenTimeline('left')}
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 rounded-md border border-border bg-muted p-0 text-muted-foreground hover:bg-secondary hover:text-foreground"
                      onClick={() => scrollFullscreenTimeline('right')}
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {hasManualRecordingVideo && (
                  <div className="mb-3 rounded-lg border border-border bg-muted/40 p-2">
                    <div className="mb-1 flex items-center justify-between gap-2 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                      <span>Event Markers</span>
                      <span>{groupedSyncedVideoMarkers.length} groups</span>
                    </div>
                    <div className="relative h-8 rounded-md border border-border bg-background">
                      <div className="absolute left-2 right-2 top-1/2 h-1 -translate-y-1/2 rounded-full bg-muted" />
                      {groupedSyncedVideoMarkers.map((marker) => {
                        const primaryEvent = marker.events[0];
                        const selected = marker.events.some((event) => (
                          selectedSyncedEventId === event.id || currentSyncedVideoEvent?.id === event.id
                        ));
                        return (
                          <button
                            key={`marker-${marker.id}`}
                            type="button"
                            title={marker.count > 1 ? `${marker.count} events near ${primaryEvent.label}` : `${primaryEvent.label} - ${primaryEvent.summary}`}
                            className={cn(
                              "absolute top-1/2 flex h-4 min-w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 px-1 text-[8px] font-semibold text-white shadow-lg transition hover:scale-125",
                              getSyncedMarkerClass(primaryEvent),
                              selected && "ring-2 ring-white ring-offset-2 ring-offset-background"
                            )}
                            style={{ left: `${marker.leftPercent}%` }}
                            onClick={() => seekRecordingFromSyncedEvent(primaryEvent)}
                          >
                            {marker.count > 1 ? marker.count : ''}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div
                  ref={fullscreenTimelineRef}
                  className="flex gap-1.5 overflow-x-auto pb-1"
                  onWheel={handleTimelineWheel}
                >
                  {manualRecordingFrames
                    .filter((_, index) => index % Math.max(1, Math.floor(manualRecordingFrames.length / 28)) === 0)
                    .slice(0, 28)
                    .map((frame) => (
                      <Button
                        key={`fullscreen-${frame.file}`}
                        type="button"
                        variant={selectedRecordingFrame?.file === frame.file ? 'default' : 'ghost'}
                        size="sm"
                        className={cn(
                          "h-8 shrink-0 rounded-md px-2 text-[10px] font-bold",
                          selectedRecordingFrame?.file === frame.file
                            ? 'bg-indigo-500 text-white hover:bg-indigo-500'
                            : 'border border-border bg-muted text-muted-foreground hover:bg-secondary hover:text-foreground'
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
              </div>
              </ResizablePanel>
              </ResizablePanelGroup>
            </div>
            </ResizablePanel>
  );
}
