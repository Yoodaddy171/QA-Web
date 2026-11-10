'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Film, Loader2, Maximize2, Minus, Pause, Play, Plus, RotateCcw, RotateCw, Volume2, VolumeX } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { cn } from '@/lib/utils';
import { buildDevlogRelayUrl } from '@/lib/client/api/devlog-client';
import type { GroupedVideoEventMarker, SyncedVideoEvent } from '@/lib/client/automation/video-event-sync';
import { formatVideoOffset } from '@/lib/client/automation/video-event-sync';
import { fitRecordingVideo, fitTimelineMarkers } from '@/lib/client/automation/recording-review';
import { recordingRunCaption } from '@/lib/client/automation/devlog-review';
import { RecordingEventNavigation } from '@/components/RecordingEventNavigation';
import { useRecordingLayout } from '@/hooks/use-recording-layout';

type RecordingVideoPanelProps = Record<string, any>;

type TimelineEventMarkerProps = {
  marker: GroupedVideoEventMarker;
  selectedSyncedEventId?: string | null;
  currentSyncedVideoEvent?: SyncedVideoEvent | null;
  formatRelativeTime: (relativeMs?: number) => string;
  getSyncedMarkerClass: (event: SyncedVideoEvent) => string;
  getSyncedEventSeverityClass: (event: SyncedVideoEvent) => string;
  onSelectEvent: (event: SyncedVideoEvent) => void;
};

function TimelineEventMarker({
  marker,
  selectedSyncedEventId,
  currentSyncedVideoEvent,
  formatRelativeTime,
  getSyncedMarkerClass,
  getSyncedEventSeverityClass,
  onSelectEvent,
}: TimelineEventMarkerProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [portalContainer, setPortalContainer] = useState<HTMLElement>();
  const primaryEvent = marker.events[0];
  const firstTime = formatVideoOffset(primaryEvent.clampedOffsetMs, true);
  const lastTime = formatVideoOffset(marker.events[marker.events.length - 1].clampedOffsetMs, true);
  const timeRange = firstTime === lastTime ? firstTime : `${firstTime} – ${lastTime}`;
  const selected = marker.events.some((event) => (
    selectedSyncedEventId === event.id || currentSyncedVideoEvent?.id === event.id
  ));
  const markerButton = (
    <button
      ref={triggerRef}
      type="button"
      aria-label={marker.count > 1 ? `${marker.count} aktivitas pada ${timeRange}` : `${primaryEvent.label} pada ${firstTime}`}
      aria-pressed={marker.count === 1 ? selected : undefined}
      className={cn(
        "absolute top-1/2 flex size-7 -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
      )}
      style={{ left: `${marker.leftPercent}%` }}
      onClick={marker.count === 1 ? () => onSelectEvent(primaryEvent) : undefined}
    >
      <span className={cn(
        "flex h-4 min-w-4 items-center justify-center rounded-full border-2 px-0.5 text-[10px] font-semibold text-white shadow-lg",
        getSyncedMarkerClass(primaryEvent),
        selected && "ring-2 ring-white ring-offset-2 ring-offset-background"
      )}>{marker.count > 1 ? marker.count : ''}</span>
    </button>
  );

  const tooltip = `${marker.count} aktivitas · ${timeRange}`;
  if (marker.count === 1) {
    return <SimpleTooltip content={tooltip} contentClassName="z-[120]">{markerButton}</SimpleTooltip>;
  }

  return (
    <Popover open={open} onOpenChange={(next) => {
      if (next) {
        // Keep wheel events inside the owning modal's scroll-lock boundary.
        setPortalContainer(triggerRef.current?.closest<HTMLElement>('[data-slot="dialog-content"]') ?? undefined);
      }
      setOpen(next);
    }}>
      <SimpleTooltip content={tooltip} contentClassName="z-[120]">
        <PopoverTrigger asChild>{markerButton}</PopoverTrigger>
      </SimpleTooltip>
      <PopoverContent
        portalContainer={portalContainer}
        data-lenis-prevent
        side="top"
        align="center"
        sideOffset={10}
        className="z-[120] w-[min(380px,calc(100vw-32px))] rounded-xl border-border bg-background p-3 shadow-2xl"
      >
        <div className="mb-2 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-foreground">Aktivitas berdekatan</p>
            <p className="mt-0.5 font-mono text-xs text-muted-foreground">{timeRange}</p>
          </div>
          <Badge variant="outline" className="rounded-md text-xs font-semibold">{marker.count} events</Badge>
        </div>
        <div data-lenis-prevent className="max-h-64 touch-pan-y space-y-1.5 overflow-y-auto overscroll-contain pr-1 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
          {marker.events.map((event, index) => (
            <button
              key={event.id}
              type="button"
              aria-pressed={selectedSyncedEventId === event.id}
              className={cn(
                "grid w-full grid-cols-[28px_minmax(0,1fr)_auto] items-start gap-2 rounded-lg border px-2.5 py-2 text-left transition hover:translate-x-0.5",
                getSyncedEventSeverityClass(event),
                selectedSyncedEventId === event.id && "ring-2 ring-indigo-300 ring-offset-1 ring-offset-background"
              )}
              onClick={() => {
                setOpen(false);
                onSelectEvent(event);
              }}
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-md border border-current/20 bg-background/50 text-xs font-bold">
                {index + 1}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-xs font-semibold uppercase tracking-wider">{event.label}</span>
                <span className="mt-0.5 block line-clamp-2 text-xs font-semibold leading-snug">{event.summary}</span>
                {(event.isBeforeVideo || event.isAfterVideo) && <span className="mt-1 block text-xs">{event.isBeforeVideo ? 'Sebelum video dimulai' : 'Setelah video berakhir'}</span>}
              </span>
              <span className="font-mono text-xs font-semibold">{formatVideoOffset(event.clampedOffsetMs, true)}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function RecordingVideoPanel(props: RecordingVideoPanelProps) {
  const verticalLayout = useRecordingLayout('vertical', [82, 18]);
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
    setRecordingSeekMs, seekRecordingBy, eventTimelineWidth,
  } = props;
  const timelineTrack = useRef<HTMLDivElement>(null);
  const [trackWidth, setTrackWidth] = useState(0);
  const [videoSize, setVideoSize] = useState<{ width: number; height: number } | null>(null);
  useEffect(() => {
    const viewport = recordingViewportRef.current;
    const video = fullscreenRecordingVideoRef.current;
    const track = timelineTrack.current;
    if (!viewport || !track) return;
    const measure = () => {
      setTrackWidth(track.clientWidth);
      if (video) setVideoSize(fitRecordingVideo(video.videoWidth, video.videoHeight, viewport.clientWidth - 32, viewport.clientHeight - 32));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    observer.observe(track);
    video?.addEventListener('loadedmetadata', measure);
    return () => { observer.disconnect(); video?.removeEventListener('loadedmetadata', measure); };
  }, [recordingVideoKey, hasManualRecordingVideo, recordingViewportRef, fullscreenRecordingVideoRef]);
  const visibleMarkers = useMemo(() => fitTimelineMarkers(groupedSyncedVideoMarkers, Math.max(eventTimelineWidth || 600, trackWidth) - 24, 28), [groupedSyncedVideoMarkers, eventTimelineWidth, trackWidth]);
  return (
            <ResizablePanel defaultSize={props.recordingPaneSize ?? 58} minSize={28} maxSize={74} className="min-w-0">
            <div className="flex h-full min-w-0 flex-col">
              <div className="flex min-h-20 shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-background px-5 py-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Film className="h-4 w-4 text-indigo-600 dark:text-indigo-300" />
                    <p className="truncate text-xs font-semibold uppercase tracking-wider text-foreground">Screen Record Review{props.viewTestCase?.testCaseId ? ` · ${props.viewTestCase.testCaseId}` : ''}</p>
                    <Badge variant="outline" className="rounded-md border-indigo-200 bg-indigo-50 text-xs font-bold text-indigo-700 dark:border-indigo-400/30 dark:bg-indigo-950 dark:text-indigo-200">
                      {formatRelativeTime(recordingDisplayMs)}
                    </Badge>
                    {recordingSeekApprox && (
                      <Badge variant="outline" className="rounded-md border-amber-200 bg-amber-50 text-xs font-bold text-amber-700 dark:border-amber-400/30 dark:bg-amber-950 dark:text-amber-200">
                        Approx
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground" title={props.runLabel}>{recordingRunCaption(props.runLabel, props.runStartedAt)}</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground" title={manualRecordingTargetUrl}>{manualRecordingTargetUrl}</p>
                </div>
                <div className="mr-12 flex shrink-0 items-center justify-end gap-1 rounded-md bg-muted p-1">
                  {hasManualRecordingVideo && <>
                    <Button type="button" variant="ghost" size="sm" aria-label="Mundur 5 detik" aria-keyshortcuts="ArrowLeft" title="Panah kiri: mundur 5 detik" onClick={() => seekRecordingBy(-5000)}><RotateCcw className="size-3.5" />5 dtk</Button>
                    <Button type="button" variant="ghost" size="sm" aria-label="Maju 5 detik" aria-keyshortcuts="ArrowRight" title="Panah kanan: maju 5 detik" onClick={() => seekRecordingBy(5000)}><RotateCw className="size-3.5" />5 dtk</Button>
                  </>}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground hover:bg-secondary hover:text-foreground"
                    aria-label="Perkecil rekaman"
                    title="Perkecil rekaman"
                    onClick={() => updateRecordingZoom(-0.1)}
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </Button>
                  <span className="min-w-[42px] text-center text-xs font-bold text-muted-foreground">
                    {Math.round(recordingZoom * 100)}%
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground hover:bg-secondary hover:text-foreground"
                    aria-label="Perbesar rekaman"
                    title="Perbesar rekaman"
                    onClick={() => updateRecordingZoom(0.1)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {props.navigationEvents?.length > 0 && <div className="w-full"><RecordingEventNavigation events={props.navigationEvents} selectedId={selectedSyncedEventId} currentMs={recordingDisplayMs} onSelect={seekRecordingFromSyncedEvent} /></div>}
                {(props.layoutStorageError || verticalLayout.storageError) && <p role="status" className="w-full text-xs text-muted-foreground">Ukuran panel tidak dapat disimpan di browser ini. Viewer tetap dapat digunakan.</p>}
              </div>

              <ResizablePanelGroup direction="vertical" onLayout={verticalLayout.saveLayout} className="min-h-0 flex-1">
              <ResizablePanel defaultSize={verticalLayout.sizes[0]} minSize={35} className="min-h-[220px]">
              <div
                ref={recordingViewportRef}
                className={cn(
                  "relative flex h-full min-h-0 overflow-auto bg-background p-4",
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
                    className="m-auto shrink-0 max-h-full max-w-full rounded-lg bg-black shadow-2xl"
                    style={videoSize ? { width: videoSize.width * recordingZoom, height: videoSize.height * recordingZoom, maxWidth: 'none', maxHeight: 'none' } : undefined}
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
                      src={buildDevlogRelayUrl(selectedRecordingFrame.url)}
                      alt="Manual capture fullscreen frame"
                      draggable={false}
                      className="select-none object-contain shadow-2xl "
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
                      <Badge variant="outline" className="rounded-md border-white/20 bg-white/10 text-xs font-semibold text-white">
                        {formatRelativeTime(recordingDisplayMs)}
                      </Badge>
                      {currentSyncedVideoEvent && (
                        <Badge variant="outline" className={cn("rounded-md text-xs font-semibold uppercase tracking-wider", getSyncedEventSeverityClass(currentSyncedVideoEvent))}>
                          {currentSyncedVideoEvent.severity}
                        </Badge>
                      )}
                    </div>
                    {currentSyncedVideoEvent && (
                      <div className="mt-2 min-w-0">
                        <p className="truncate text-xs font-semibold uppercase tracking-wider text-white/70">
                          {currentSyncedVideoEvent.label} / {currentSyncedVideoEvent.category}
                        </p>
                        <p className="mt-1 line-clamp-2 text-xs font-semibold leading-snug text-white">
                          {currentSyncedVideoEvent.summary}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
              </ResizablePanel>
              <ResizableHandle withHandle />

              <ResizablePanel defaultSize={verticalLayout.sizes[1]} minSize={12} maxSize={45} className="min-h-[86px]">
              <div className="h-full overflow-hidden border-t border-border bg-background p-3">
                <div className="mb-2 flex items-center justify-between gap-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <span>Timeline</span>
                  <div className="flex items-center gap-2">
                    <span>{manualRecordingMode === 'video' && manualRecordingFrames.length === 0 ? 'Video only' : `${manualRecordingFrames.length} keyframes`}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 rounded-md border border-border bg-muted p-0 text-muted-foreground hover:bg-secondary hover:text-foreground"
                      aria-label="Geser keyframe ke kiri"
                      disabled={manualRecordingFrames.length === 0}
                      onClick={() => scrollFullscreenTimeline('left')}
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 rounded-md border border-border bg-muted p-0 text-muted-foreground hover:bg-secondary hover:text-foreground"
                      aria-label="Geser keyframe ke kanan"
                      disabled={manualRecordingFrames.length === 0}
                      onClick={() => scrollFullscreenTimeline('right')}
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {hasManualRecordingVideo && (
                  <div className="mb-3 rounded-lg border border-border bg-muted/40 p-2">
                    <div className="mb-1 flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      <span>Aktivitas pada video</span>
                      <span>{visibleMarkers.reduce((total, group) => total + group.count, 0)} event · {visibleMarkers.length} titik</span>
                    </div>
                    <div className="overflow-x-auto pb-1" aria-label="Timeline aktivitas" tabIndex={0}>
                    <div ref={timelineTrack} className="relative h-8 rounded-md border border-border bg-background" style={{ width: eventTimelineWidth, minWidth: '100%' }}>
                      <div className="absolute left-2 right-2 top-1/2 h-1 -translate-y-1/2 rounded-full bg-muted" />
                      <div className="absolute inset-x-4 inset-y-0">{visibleMarkers.map((marker) => (
                        <TimelineEventMarker
                          key={`marker-${marker.id}`}
                          marker={marker}
                          selectedSyncedEventId={selectedSyncedEventId}
                          currentSyncedVideoEvent={currentSyncedVideoEvent}
                          formatRelativeTime={formatRelativeTime}
                          getSyncedMarkerClass={getSyncedMarkerClass}
                          getSyncedEventSeverityClass={getSyncedEventSeverityClass}
                          onSelectEvent={seekRecordingFromSyncedEvent}
                        />
                      ))}</div>
                    </div>
                    </div>
                    <p className="mt-1 text-[10px] font-normal normal-case text-muted-foreground">Geser timeline untuk melihat seluruh rekaman. Titik bernomor berisi beberapa aktivitas berdekatan.</p>
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
                          "h-8 shrink-0 rounded-md px-2 text-xs font-bold",
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
