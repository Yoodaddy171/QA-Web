'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, Bot, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ClipboardList, Clock, Code2, Copy, Edit3, Film, HelpCircle, History,
  FileDown, Filter, Globe2, Layers, Loader2, Maximize2, Minus, MonitorDot, Play, Plus, RefreshCw, Search, Sparkles, Square, Trash2, UserRound, Wrench, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { TestCase } from '@/components/TestCaseTable';
import type { ManualCaptureBrowserMode, ManualCaptureMode, ManualRecordingMeta } from '@/hooks/useAutomationLogs';
import {
  DEFAULT_VIDEO_EVENT_FILTERS,
  buildSyncedVideoEvents,
  buildVideoEventMarkers,
  filterVideoEventsByCategory,
  formatVideoEventDetail,
  getNearestVideoEvent,
  groupVideoEventMarkers,
  type SyncedVideoEvent,
  type VideoEventFilterKey,
} from '@/lib/client/automation/video-event-sync';
import { cn } from '@/lib/utils';

import {
  BulletTextView,
  DEFAULT_NETWORK_FILTERS,
  escapeHtml,
  formatDateTime,
  formatPrettyValue,
  getBugLifecycleItems,
  getConsoleLogText,
  getImageDataUrl,
  getLifecycleIndex,
  getManualFrameUrl,
  getManualVideoUrl,
  getNetworkCategoryClass,
  getNetworkMeta,
  getRequestPayload,
  getResponsePayload,
  getStatusBucket,
  groupConsoleLogs,
  groupNetworkLogs,
  networkCodePanelClass,
  networkFullscreenCodePanelClass,
  normalizedLogRelativeMs,
  type DevLogTab,
  type FullscreenLogFilter,
  type LogEntry,
  type NetworkCategory,
  type NetworkFilterState,
  type NetworkMeta,
  type SelectedFullscreenLog,
} from '@/components/TestCaseDetailDialog.helpers';


interface TestCaseDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  viewTestCase: TestCase | null;
  socketReady: boolean;
  liveLogs: LogEntry[];
  activeDevLogTab: DevLogTab;
  expandedLogId: string | null;
  isLoadingHistory: boolean;
  loadedRunLabel: 'current' | 'previous' | 'live';
  aiSummary: string | null;
  isSummarizing: boolean;
  manualCaptureTargetUrl: string;
  manualCaptureSessionId: string | null;
  manualRecording: ManualRecordingMeta | null;
  isManualCaptureActive: boolean;
  isStartingManualCapture: boolean;
  isStoppingManualCapture: boolean;
  isProcessingManualRecording?: boolean;
  logEndRef: React.RefObject<HTMLDivElement | null>;
  setManualCaptureTargetUrl: (url: string) => void;
  setActiveDevLogTab: (tab: DevLogTab) => void;
  setExpandedLogId: (id: string | null) => void;
  setAiSummary: (summary: string | null) => void;
  clearLogs: () => void;
  startManualCapture: (options?: { browserMode?: ManualCaptureBrowserMode; captureMode?: ManualCaptureMode }) => void;
  stopManualCapture: () => void;
  loadCurrentLogRun: () => void;
  generateAISummary: () => void;
  loadLogHistory: () => void;
  filterConsoleLogs: (logs: LogEntry[]) => LogEntry[];
  getStatusColor: (status: string) => string;
  getStatusIcon: (status: string) => React.ReactNode;
  getStatusBadgeVariant: (status: string) => 'success' | 'failed' | 'warning' | 'info' | 'notdone' | 'inprogress' | 'blocked' | 'readyretest' | 'verifiedfixed' | 'tba' | 'outline';
  getTestTypeColor: (type: string) => string;
  getPriorityColor: (priority: string) => string;
  onEdit: (testCase: TestCase) => void;
  onRefine?: (testCase: TestCase) => void;
  onCopyId: (id: string) => void;
  testCaseList?: TestCase[];
  onNavigate?: (testCase: TestCase) => void;
}

export function TestCaseDetailDialog({
  open,
  onOpenChange,
  viewTestCase,
  socketReady,
  liveLogs,
  activeDevLogTab,
  expandedLogId,
  isLoadingHistory,
  loadedRunLabel,
  aiSummary,
  isSummarizing,
  manualCaptureTargetUrl,
  manualCaptureSessionId,
  manualRecording,
  isManualCaptureActive,
  isStartingManualCapture,
  isStoppingManualCapture,
  isProcessingManualRecording = false,
  logEndRef,
  setManualCaptureTargetUrl,
  setActiveDevLogTab,
  setExpandedLogId,
  setAiSummary,
  clearLogs,
  startManualCapture,
  stopManualCapture,
  loadCurrentLogRun,
  generateAISummary,
  loadLogHistory,
  filterConsoleLogs,
  getStatusColor,
  getStatusIcon,
  getStatusBadgeVariant,
  getTestTypeColor,
  getPriorityColor,
  onEdit,
  onRefine,
  onCopyId,
  testCaseList,
  onNavigate,
}: TestCaseDetailDialogProps) {
  const [activeMainTab, setActiveMainTab] = useState('details');
  const [expandedGuide, setExpandedGuide] = useState<'automation' | 'manual' | null>(null);
  const [manualCaptureBrowserMode, setManualCaptureBrowserMode] = useState<ManualCaptureBrowserMode>('clean');
  const [manualCaptureMode, setManualCaptureMode] = useState<ManualCaptureMode>('frame');
  const [recordingSeekMs, setRecordingSeekMs] = useState(0);
  const [recordingVideoDurationMs, setRecordingVideoDurationMs] = useState<{ key: string; durationMs: number } | null>(null);
  const [recordingSeekApprox, setRecordingSeekApprox] = useState(false);
  const [recordingZoom, setRecordingZoom] = useState(1);
  const [isRecordingFullscreen, setIsRecordingFullscreen] = useState(false);
  const [isRecordingFullscreenExpanded, setIsRecordingFullscreenExpanded] = useState(false);
  const [isRecordingFullscreenContentVisible, setIsRecordingFullscreenContentVisible] = useState(false);
  const [isClosingRecordingFullscreen, setIsClosingRecordingFullscreen] = useState(false);
  const [isSystemDevLogFullscreen, setIsSystemDevLogFullscreen] = useState(false);
  const [selectedSystemDevLogId, setSelectedSystemDevLogId] = useState<string | null>(null);
  const [networkCodeWrap, setNetworkCodeWrap] = useState(true);
  const [networkFilters, setNetworkFilters] = useState<NetworkFilterState>(DEFAULT_NETWORK_FILTERS);
  const [fullscreenLogFilter, setFullscreenLogFilter] = useState<FullscreenLogFilter>('all');
  const [selectedFullscreenLog, setSelectedFullscreenLog] = useState<SelectedFullscreenLog>(null);
  const [selectedSyncedEventId, setSelectedSyncedEventId] = useState<string | null>(null);
  const [syncedEventFilters, setSyncedEventFilters] = useState(DEFAULT_VIDEO_EVENT_FILTERS);
  const [syncedNetworkLogIds, setSyncedNetworkLogIds] = useState<string[]>([]);
  const [copiedEvidence, setCopiedEvidence] = useState(false);
  const recordingViewportRef = useRef<HTMLDivElement>(null);
  const recordingVideoRef = useRef<HTMLVideoElement>(null);
  const fullscreenRecordingVideoRef = useRef<HTMLVideoElement>(null);
  const fullscreenNetworkRowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const fullscreenTimelineRef = useRef<HTMLDivElement>(null);
  const recordingPanRef = useRef({ active: false, startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0 });
  const recordingFullscreenTimerRef = useRef<number | null>(null);
  const consoleLogs = useMemo(() => filterConsoleLogs(liveLogs), [filterConsoleLogs, liveLogs]);
  const groupedConsoleLogs = useMemo(() => groupConsoleLogs(consoleLogs), [consoleLogs]);
  const navigationIndex = useMemo(() => {
    if (!testCaseList?.length || !viewTestCase) return -1;
    return testCaseList.findIndex(tc => tc.id === viewTestCase.id);
  }, [testCaseList, viewTestCase]);
  const rawNetworkLogs = useMemo(() => (
    liveLogs.filter((log) => log.isNetwork || Boolean(log.network))
  ), [liveLogs]);
  const networkLogItems = useMemo(() => (
    rawNetworkLogs
      .filter((log): log is LogEntry & { network: NonNullable<LogEntry['network']> } => Boolean(log.network))
      .map((log) => ({ log, meta: getNetworkMeta(log.network) }))
  ), [rawNetworkLogs]);
  const networkHosts = useMemo(() => (
    Array.from(new Set(networkLogItems.map((item) => item.meta.host))).filter(Boolean).sort()
  ), [networkLogItems]);
  const networkMethods = useMemo(() => (
    Array.from(new Set(networkLogItems.map((item) => item.meta.method))).filter(Boolean).sort()
  ), [networkLogItems]);
  const networkCategoryCounts = useMemo(() => (
    networkLogItems.reduce<Record<NetworkCategory, number>>((counts, item) => {
      counts[item.meta.category] += 1;
      return counts;
    }, { business: 0, preflight: 0, document: 0, script: 0, image: 0, static: 0, telemetry: 0, data: 0, other: 0 })
  ), [networkLogItems]);
  const networkLogs = useMemo(() => {
    const query = networkFilters.search.trim().toLowerCase();

    return networkLogItems.filter(({ log, meta }) => {
      const statusBucket = getStatusBucket(log.network.status);
      const categoryVisible = meta.isError ||
        meta.category === 'business' ||
        (meta.category === 'preflight' && networkFilters.showPreflight) ||
        (meta.category === 'document' && networkFilters.showDocument) ||
        (meta.category === 'script' && networkFilters.showScript) ||
        (meta.category === 'image' && networkFilters.showImage) ||
        (meta.category === 'static' && networkFilters.showStatic) ||
        (meta.category === 'telemetry' && networkFilters.showTelemetry) ||
        (meta.category === 'data' && networkFilters.showDataUrls) ||
        (meta.category === 'other' && networkFilters.showOther);

      if (!categoryVisible) return false;
      if (networkFilters.host !== 'all' && meta.host !== networkFilters.host) return false;
      if (networkFilters.method !== 'all' && meta.method !== networkFilters.method) return false;
      if (networkFilters.status !== 'all' && statusBucket !== networkFilters.status) return false;
      if (!query) return true;

      return log.network.url.toLowerCase().includes(query) ||
        meta.host.toLowerCase().includes(query) ||
        meta.method.toLowerCase().includes(query) ||
        String(log.network.status ?? '').includes(query);
    });
  }, [networkFilters, networkLogItems]);
  const fullscreenNetworkLogs = useMemo(() => (
    networkLogs.filter(({ log, meta }) => {
      if (fullscreenLogFilter === 'errors') {
        return meta.isError || log.network.success === false;
      }
      if (fullscreenLogFilter === 'api') {
        return meta.category === 'business';
      }
      return true;
    })
  ), [fullscreenLogFilter, networkLogs]);
  const groupedNetworkLogs = useMemo(() => groupNetworkLogs(networkLogs), [networkLogs]);
  const fullscreenNetworkGroups = useMemo(() => groupNetworkLogs(fullscreenNetworkLogs), [fullscreenNetworkLogs]);
  const fullscreenConsoleLogs = useMemo(() => (
    consoleLogs.filter((log) => {
      if (fullscreenLogFilter === 'errors') {
        const text = String(log.log ?? '').toLowerCase();
        return log.level === 'SEVERE' || /error|failed|failure|exception|timeout|warn|warning/.test(text);
      }
      return true;
    })
  ), [consoleLogs, fullscreenLogFilter]);
  const fullscreenConsoleGroups = useMemo(() => groupConsoleLogs(fullscreenConsoleLogs), [fullscreenConsoleLogs]);
  const selectedSystemNetworkGroup = useMemo(() => (
    selectedSystemDevLogId
      ? fullscreenNetworkGroups.find((group) => `system-network-${group.id}` === selectedSystemDevLogId) ?? null
      : null
  ), [fullscreenNetworkGroups, selectedSystemDevLogId]);
  const selectedSystemConsoleGroup = useMemo(() => (
    selectedSystemDevLogId
      ? fullscreenConsoleGroups.find((group) => `system-console-${group.id}` === selectedSystemDevLogId) ?? null
      : null
  ), [fullscreenConsoleGroups, selectedSystemDevLogId]);
  const networkCodeWhitespaceClass = networkCodeWrap ? 'whitespace-pre-wrap break-words' : 'whitespace-pre';
  const hiddenNetworkCount = Math.max(0, networkLogItems.length - networkLogs.length);
  const isBugFixDetail = viewTestCase?.detailSource === 'bugfix' || Boolean(viewTestCase?.sourceTestCaseId && viewTestCase?.reportedAt);
  const lifecycleItems = useMemo(
    () => viewTestCase ? getBugLifecycleItems(viewTestCase) : [],
    [viewTestCase]
  );
  const lifecycleIndex = viewTestCase ? getLifecycleIndex(viewTestCase.status) : 0;
  const okLogCount = useMemo(
    () => liveLogs.filter((log) => !log.network && log.level !== 'SEVERE').length,
    [liveLogs]
  );
  const errorLogCount = useMemo(
    () => liveLogs.filter((log) => log.level === 'SEVERE').length,
    [liveLogs]
  );
  const captureScriptUrl = typeof window !== 'undefined' ? `${window.location.origin}/qa-capture.js` : '/qa-capture.js';
  const captureScriptTag = `<script defer src="${captureScriptUrl}"></script>`;
  const selectedRecordingFrame = useMemo(() => {
    if (!manualRecording?.frames?.length) return null;
    return manualRecording.frames.reduce((closest, frame) => (
      Math.abs(frame.relativeMs - recordingSeekMs) < Math.abs(closest.relativeMs - recordingSeekMs) ? frame : closest
    ), manualRecording.frames[0]);
  }, [manualRecording, recordingSeekMs]);
  const manualRecordingVideoUrl = getManualVideoUrl(manualRecording?.video?.url);
  const hasManualRecordingVideo = Boolean(manualRecordingVideoUrl && manualRecording?.video?.status !== 'failed');
  const manualRecordingFrames = manualRecording?.frames ?? [];
  const manualRecordingMode = manualRecording?.mode || 'frame';
  const manualRecordingTargetUrl = manualRecording?.targetUrl || 'Manual capture target';
  const manualRecordingVideoStatus = manualRecording?.video?.status;
  const isVideoFinalizing = isProcessingManualRecording || ['starting', 'recording', 'finalizing'].includes(manualRecordingVideoStatus || '');
  const recordingVideoKey = `${manualRecording?.sessionId ?? 'none'}:${manualRecording?.video?.url ?? 'none'}`;
  const recordingTimelineBounds = useMemo(() => {
    const values = liveLogs
      .map((log) => normalizedLogRelativeMs(log.relativeMs))
      .filter((value): value is number => typeof value === 'number');
    if (!values.length) return { min: 0, max: 0 };
    return {
      min: Math.max(0, Math.min(...values) - 10000),
      max: Math.max(...values),
    };
  }, [liveLogs]);
  const getRecordingVideoDurationMs = () => {
    if (recordingVideoDurationMs?.key === recordingVideoKey && recordingVideoDurationMs.durationMs > 0) {
      return recordingVideoDurationMs.durationMs;
    }
    if (typeof manualRecording?.video?.durationMs === 'number' && manualRecording.video.durationMs > 0) return manualRecording.video.durationMs;
    return 0;
  };
  const syncedVideoEvents = useMemo(() => (
    buildSyncedVideoEvents(liveLogs, manualRecording, {
      measuredDurationMs: recordingVideoDurationMs?.key === recordingVideoKey ? recordingVideoDurationMs.durationMs : undefined,
    })
      .filter((event) => typeof event.clampedOffsetMs === 'number')
      .slice(0, 80)
  ), [liveLogs, manualRecording, recordingVideoDurationMs, recordingVideoKey]);
  const filteredSyncedVideoEvents = useMemo(() => (
    filterVideoEventsByCategory(syncedVideoEvents, syncedEventFilters)
  ), [syncedEventFilters, syncedVideoEvents]);
  const recordingVideoDurationForMarkersMs = getRecordingVideoDurationMs();
  const groupedSyncedVideoMarkers = useMemo(() => (
    groupVideoEventMarkers(buildVideoEventMarkers(filteredSyncedVideoEvents, recordingVideoDurationForMarkersMs))
  ), [filteredSyncedVideoEvents, recordingVideoDurationForMarkersMs]);
  const getLogVideoMs = (log: Pick<LogEntry, 'relativeMs'>) => {
    const relativeMs = normalizedLogRelativeMs(log.relativeMs);
    const durationMs = getRecordingVideoDurationMs();
    if (typeof relativeMs !== 'number') return undefined;
    if (!manualRecording?.video || !hasManualRecordingVideo) return relativeMs;
    const span = Math.max(1, recordingTimelineBounds.max - recordingTimelineBounds.min);
    const mapped = Math.max(0, relativeMs - recordingTimelineBounds.min) * durationMs / span;
    return durationMs > 0 ? Math.min(durationMs, mapped) : mapped;
  };
  const getVideoRelativeMs = (relativeMs: number) => {
    if (!manualRecording?.video || !hasManualRecordingVideo) return relativeMs;
    const durationMs = getRecordingVideoDurationMs();
    return durationMs > 0 ? Math.max(0, Math.min(durationMs, relativeMs)) : Math.max(0, relativeMs);
  };
  const recordingDisplayMs = getVideoRelativeMs(recordingSeekMs);
  const currentSyncedVideoEvent = useMemo(() => (
    getNearestVideoEvent(filteredSyncedVideoEvents, recordingDisplayMs, 1500)
  ), [filteredSyncedVideoEvents, recordingDisplayMs]);
  const selectedSyncedVideoEvent = useMemo(() => (
    selectedSyncedEventId
      ? syncedVideoEvents.find((event) => event.id === selectedSyncedEventId) ?? null
      : null
  ), [selectedSyncedEventId, syncedVideoEvents]);
  const selectedSyncedVideoEventDetail = useMemo(() => (
    selectedSyncedVideoEvent ? formatVideoEventDetail(selectedSyncedVideoEvent) : null
  ), [selectedSyncedVideoEvent]);
  const syncedNetworkLogIdSet = useMemo(() => new Set(syncedNetworkLogIds), [syncedNetworkLogIds]);

  const formatRelativeTime = (relativeMs?: number) => {
    if (typeof relativeMs !== 'number') return '-';
    const safeMs = Math.max(0, Math.round(relativeMs));
    const totalSeconds = Math.floor(safeMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  };
  const formatLogRecordingTime = (log: Pick<LogEntry, 'relativeMs'>) => (
    formatRelativeTime(hasManualRecordingVideo ? getLogVideoMs(log) : normalizedLogRelativeMs(log.relativeMs))
  );
  const handleRecordingVideoLoadedMetadata = (event: React.SyntheticEvent<HTMLVideoElement>) => {
    const durationSeconds = event.currentTarget.duration;
    if (Number.isFinite(durationSeconds) && durationSeconds > 0) {
      setRecordingVideoDurationMs({
        key: recordingVideoKey,
        durationMs: Math.round(durationSeconds * 1000),
      });
    }
  };

  const seekRecordingFromLog = (log: LogEntry) => {
    if (typeof log.relativeMs !== 'number') return;
    const targetMs = hasManualRecordingVideo ? getLogVideoMs(log) : log.relativeMs;
    if (typeof targetMs !== 'number') return;
    setRecordingSeekMs(targetMs);
    setRecordingSeekApprox(false);
    if (!manualRecording?.video || !hasManualRecordingVideo) return;
    const durationSeconds = getRecordingVideoDurationMs() / 1000;
    const targetSeconds = Math.max(0, Math.min(durationSeconds || Number.POSITIVE_INFINITY, targetMs / 1000));
    for (const player of [recordingVideoRef.current, fullscreenRecordingVideoRef.current]) {
      if (!player) continue;
      try {
        player.currentTime = targetSeconds;
      } catch {}
    }
  };

  const handleFullscreenVideoTimeUpdate = (event: React.SyntheticEvent<HTMLVideoElement>) => {
    if (!manualRecording?.video || !hasManualRecordingVideo) return;
    const currentVideoMs = event.currentTarget.currentTime * 1000;
    const matchingIds = fullscreenNetworkGroups
      .filter((group) => group.entries.some((entry) => (
        Math.abs((getLogVideoMs(entry.log) ?? Number.POSITIVE_INFINITY) - currentVideoMs) <= 650
      )))
      .map((group) => `fullscreen-${group.id}`);
    const previousKey = syncedNetworkLogIds.join('|');
    const nextKey = matchingIds.join('|');
    setRecordingSeekMs(currentVideoMs);
    setRecordingSeekApprox(false);
    if (previousKey === nextKey) return;
    setSyncedNetworkLogIds(matchingIds);
    if (activeDevLogTab === 'network' && matchingIds[0]) {
      window.setTimeout(() => {
        fullscreenNetworkRowRefs.current.get(matchingIds[0])?.scrollIntoView({
          block: 'nearest',
          behavior: 'smooth',
        });
      }, 0);
    }
  };

  const selectFullscreenNetworkLog = (
    net: LogEntry & { network: NonNullable<LogEntry['network']> },
    meta: NetworkMeta,
    logId: string
  ) => {
    seekRecordingFromLog(net);
    setSelectedFullscreenLog({
      id: logId,
      kind: 'network',
      relativeMs: getLogVideoMs(net) ?? net.relativeMs,
      text: `${getNetworkMethod(net.network)} ${getNetworkStatus(net.network)} ${net.network.url}`,
      detail: {
        category: meta.label,
        host: meta.host,
        method: getNetworkMethod(net.network),
        status: getNetworkStatus(net.network),
        url: net.network.url,
        duration: getNetworkDuration(net.network),
        headers: net.network.headers,
        request: getRequestPayload(net.network.data),
        response: getResponsePayload(net.network.data),
      },
    });
  };

  const selectFullscreenConsoleLog = (log: LogEntry, logId: string) => {
    seekRecordingFromLog(log);
    setSelectedFullscreenLog({
      id: logId,
      kind: 'console',
      relativeMs: getLogVideoMs(log) ?? log.relativeMs,
      text: String(typeof log.log === 'object' ? JSON.stringify(log.log) : log.log ?? ''),
      detail: log.log,
    });
  };

  const getNetworkMethod = (network: NonNullable<LogEntry['network']>) => (
    network.method || network.event || 'TRACE'
  );

  const getNetworkStatus = (network: NonNullable<LogEntry['network']>) => {
    if (typeof network.status === 'number') return String(network.status);
    if (network.event === 'Request') return 'REQ';
    if (network.event === 'Response') return 'RES';
    return '-';
  };

  const getNetworkStatusClass = (network: NonNullable<LogEntry['network']>) => {
    if (typeof network.status !== 'number') return 'bg-muted text-muted-foreground dark:bg-slate-800 dark:text-slate-400';
    return network.status < 400
      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
      : 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-400';
  };

  const getSyncedEventSeverityClass = (event: SyncedVideoEvent) => {
    if (event.severity === 'error') return 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-950/30 dark:text-rose-200';
    if (event.severity === 'warning') return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-200';
    if (event.severity === 'success') return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-950/30 dark:text-emerald-200';
    return 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-950/30 dark:text-indigo-200';
  };

  const getSyncedMarkerClass = (event: SyncedVideoEvent) => {
    if (event.severity === 'error') return 'border-rose-200 bg-rose-500 shadow-rose-500/40';
    if (event.severity === 'warning') return 'border-amber-200 bg-amber-400 shadow-amber-400/40';
    if (event.severity === 'success') return 'border-emerald-200 bg-emerald-500 shadow-emerald-500/40';
    if (event.category === 'step') return 'border-violet-200 bg-violet-500 shadow-violet-500/40';
    if (event.category === 'screenshot' || event.category === 'evidence') return 'border-cyan-200 bg-cyan-500 shadow-cyan-500/40';
    return 'border-indigo-200 bg-indigo-500 shadow-indigo-500/40';
  };

  const getNetworkDuration = (network: NonNullable<LogEntry['network']>) => (
    typeof network.duration === 'number' ? `${network.duration}ms` : '-'
  );

  const updateNetworkFilters = (nextFilters: Partial<NetworkFilterState>) => {
    setNetworkFilters((current) => ({ ...current, ...nextFilters }));
  };

  const toggleNetworkFilter = (key: keyof Pick<NetworkFilterState, 'showPreflight' | 'showDocument' | 'showScript' | 'showImage' | 'showStatic' | 'showTelemetry' | 'showDataUrls' | 'showOther'>) => {
    setNetworkFilters((current) => ({ ...current, [key]: !current[key] }));
  };

  const toggleSyncedEventFilter = (key: VideoEventFilterKey) => {
    setSyncedEventFilters((current) => ({ ...current, [key]: !current[key] }));
  };

  const updateRecordingZoom = (delta: number) => {
    setRecordingZoom((current) => Math.min(3, Math.max(0.5, Number((current + delta).toFixed(2)))));
  };

  const scrollFullscreenTimeline = (direction: 'left' | 'right') => {
    fullscreenTimelineRef.current?.scrollBy({
      left: direction === 'left' ? -260 : 260,
      behavior: 'smooth',
    });
  };

  const startRecordingPan = (event: React.PointerEvent<HTMLDivElement>) => {
    if (recordingZoom <= 1 || !recordingViewportRef.current) return;
    recordingPanRef.current = {
      active: true,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: recordingViewportRef.current.scrollLeft,
      scrollTop: recordingViewportRef.current.scrollTop,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const moveRecordingPan = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!recordingPanRef.current.active || !recordingViewportRef.current) return;
    event.preventDefault();
    recordingViewportRef.current.scrollLeft = recordingPanRef.current.scrollLeft - (event.clientX - recordingPanRef.current.startX);
    recordingViewportRef.current.scrollTop = recordingPanRef.current.scrollTop - (event.clientY - recordingPanRef.current.startY);
  };

  const stopRecordingPan = () => {
    recordingPanRef.current.active = false;
  };

  const handleTimelineWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (!event.shiftKey) return;
    event.preventDefault();
    fullscreenTimelineRef.current?.scrollBy({
      left: event.deltaY || event.deltaX,
      behavior: 'auto',
    });
  };

  const clearRecordingFullscreenTimer = () => {
    if (recordingFullscreenTimerRef.current === null) return;
    window.clearTimeout(recordingFullscreenTimerRef.current);
    recordingFullscreenTimerRef.current = null;
  };

  const openRecordingFullscreen = () => {
    clearRecordingFullscreenTimer();
    setRecordingZoom(1);
    setFullscreenLogFilter('all');
    setSelectedFullscreenLog(null);
    setSelectedSyncedEventId(null);
    setSyncedEventFilters(DEFAULT_VIDEO_EVENT_FILTERS);
    setSyncedNetworkLogIds([]);
    setCopiedEvidence(false);
    setIsClosingRecordingFullscreen(false);
    setIsRecordingFullscreenExpanded(false);
    setIsRecordingFullscreenContentVisible(false);
    setIsRecordingFullscreen(true);

    window.requestAnimationFrame(() => {
      setIsRecordingFullscreenExpanded(true);
      recordingFullscreenTimerRef.current = window.setTimeout(() => {
        setIsRecordingFullscreenContentVisible(true);
        recordingFullscreenTimerRef.current = null;
      }, 220);
    });
  };

  const openSystemDevLogFullscreen = () => {
    setFullscreenLogFilter('all');
    setSelectedSystemDevLogId(null);
    if (activeDevLogTab === 'execution') setActiveDevLogTab('network');
    setIsSystemDevLogFullscreen(true);
  };

  const closeSystemDevLogFullscreen = () => {
    setIsSystemDevLogFullscreen(false);
    setSelectedSystemDevLogId(null);
  };

  const copyFullscreenEvidence = async () => {
    const screenshotUrl = selectedRecordingFrame ? getManualFrameUrl(selectedRecordingFrame.url) : '';
    const screenshotDataUrl = screenshotUrl ? await getImageDataUrl(screenshotUrl) : '';
    const evidenceText = [
      `Test Case: ${viewTestCase?.testCaseId || '-'}`,
      `Action: ${viewTestCase?.testAction || '-'}`,
      `Status: ${viewTestCase?.status || '-'}`,
      `Frame: ${formatRelativeTime(recordingSeekMs)}`,
      `Target: ${manualRecording?.targetUrl || '-'}`,
      selectedRecordingFrame ? `Screenshot: ${selectedRecordingFrame.file}` : '',
      screenshotUrl ? `Screenshot URL: ${screenshotUrl}` : '',
      selectedFullscreenLog ? `Selected ${selectedFullscreenLog.kind}: ${selectedFullscreenLog.text}` : 'Selected log: -',
      selectedFullscreenLog ? `Detail:\n${formatPrettyValue(selectedFullscreenLog.detail)}` : '',
    ].filter(Boolean).join('\n');

    const evidenceHtml = [
      '<section style="font-family: Inter, Arial, sans-serif; line-height: 1.45;">',
      `<p><strong>Test Case:</strong> ${escapeHtml(viewTestCase?.testCaseId || '-')}</p>`,
      `<p><strong>Action:</strong> ${escapeHtml(viewTestCase?.testAction || '-')}</p>`,
      `<p><strong>Status:</strong> ${escapeHtml(viewTestCase?.status || '-')}</p>`,
      `<p><strong>Frame:</strong> ${escapeHtml(formatRelativeTime(recordingSeekMs))}</p>`,
      `<p><strong>Target:</strong> ${escapeHtml(manualRecording?.targetUrl || '-')}</p>`,
      screenshotUrl
        ? `<p><strong>Screenshot:</strong> ${escapeHtml(selectedRecordingFrame?.file || '-')}</p><p><img src="${escapeHtml(screenshotDataUrl || screenshotUrl)}" alt="QA evidence screenshot" style="max-width: 100%; border: 1px solid #d1d5db; border-radius: 8px;" /></p>`
        : '',
      `<p><strong>Selected ${escapeHtml(selectedFullscreenLog?.kind || 'log')}:</strong> ${escapeHtml(selectedFullscreenLog?.text || '-')}</p>`,
      selectedFullscreenLog ? `<pre style="white-space: pre-wrap; background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px;">${escapeHtml(formatPrettyValue(selectedFullscreenLog.detail))}</pre>` : '',
      '</section>',
    ].filter(Boolean).join('');

    try {
      if (navigator.clipboard.write && typeof ClipboardItem !== 'undefined') {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/plain': new Blob([evidenceText], { type: 'text/plain' }),
            'text/html': new Blob([evidenceHtml], { type: 'text/html' }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(evidenceText);
      }
    } catch {
      await navigator.clipboard.writeText(evidenceText);
    }

    setCopiedEvidence(true);
    window.setTimeout(() => setCopiedEvidence(false), 1600);
  };

  const closeRecordingFullscreen = () => {
    clearRecordingFullscreenTimer();
    setIsRecordingFullscreenContentVisible(false);

    window.requestAnimationFrame(() => {
      recordingFullscreenTimerRef.current = window.setTimeout(() => {
        setIsRecordingFullscreenExpanded(false);
        setIsClosingRecordingFullscreen(true);

        recordingFullscreenTimerRef.current = window.setTimeout(() => {
          setIsRecordingFullscreen(false);
          setIsRecordingFullscreenExpanded(false);
          setIsRecordingFullscreenContentVisible(false);
          setIsClosingRecordingFullscreen(false);
          setSyncedNetworkLogIds([]);
          recordingFullscreenTimerRef.current = null;
        }, 220);
      }, 40);
    });
  };

  const openEvidenceReport = () => {
    if (!viewTestCase) return;
    window.location.href = `/api/evidence?testCaseId=${encodeURIComponent(viewTestCase.id)}&download=1`;
  };
  const seekRecordingFromSyncedEvent = (event: SyncedVideoEvent) => {
    if (typeof event.clampedOffsetMs !== 'number') return;
    setSelectedSyncedEventId(event.id);
    setRecordingSeekMs(event.clampedOffsetMs);
    setRecordingSeekApprox(event.isBeforeVideo || event.isAfterVideo);
    if (!manualRecording?.video || !hasManualRecordingVideo) return;
    const durationSeconds = getRecordingVideoDurationMs() / 1000;
    const targetSeconds = Math.max(0, Math.min(durationSeconds || Number.POSITIVE_INFINITY, event.clampedOffsetMs / 1000));
    for (const player of [recordingVideoRef.current, fullscreenRecordingVideoRef.current]) {
      if (!player) continue;
      try {
        player.currentTime = targetSeconds;
      } catch {}
    }
  };

  useEffect(() => {
    const viewport = recordingViewportRef.current;
    if (!isRecordingFullscreen || !viewport) return undefined;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      setRecordingZoom((current) => (
        Math.min(3, Math.max(0.5, Number((current + (event.deltaY > 0 ? -0.1 : 0.1)).toFixed(2))))
      ));
    };

    viewport.addEventListener('wheel', handleWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', handleWheel);
  }, [isRecordingFullscreen]);

  useEffect(() => () => clearRecordingFullscreenTimer(), []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-h-[90vh] flex flex-col p-0 overflow-hidden bg-card text-foreground border-border/60 elevation-3",
          isSystemDevLogFullscreen
            ? "h-screen max-h-screen w-screen max-w-none translate-x-[-50%] translate-y-[-50%] rounded-none border-0 sm:max-w-none"
            : isRecordingFullscreen
              ? "w-[96vw] sm:max-w-[96vw]"
              : "sm:max-w-4xl rounded-2xl"
        )}
      >
        <DialogHeader className="p-4 pb-2 sm:p-6 sm:pb-2 shrink-0 border-b border-border/30">
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="flex min-w-0 flex-wrap items-center gap-2 text-base font-bold tracking-tight sm:text-xl">
              <ClipboardList className="w-5 h-5 shrink-0 text-primary" />
              <span className="whitespace-nowrap text-foreground">Detail Test Case</span>
              {viewTestCase && (
                <Badge variant={getStatusBadgeVariant(viewTestCase.status)} className={cn("gap-1 sm:ml-2")}>
                  {getStatusIcon(viewTestCase.status)} {viewTestCase.status}
                </Badge>
              )}
            </DialogTitle>
            {testCaseList && testCaseList.length > 1 && navigationIndex >= 0 && onNavigate && viewTestCase && (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 rounded-xl p-0 text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                  disabled={navigationIndex <= 0}
                  onClick={() => {
                    if (navigationIndex > 0) onNavigate(testCaseList[navigationIndex - 1]);
                  }}
                  aria-label="Previous test case"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-[11px] text-muted-foreground font-medium min-w-[40px] text-center">
                  {navigationIndex + 1}/{testCaseList.length}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 rounded-xl p-0 text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                  disabled={navigationIndex >= testCaseList.length - 1}
                  onClick={() => {
                    if (navigationIndex < testCaseList.length - 1) onNavigate(testCaseList[navigationIndex + 1]);
                  }}
                  aria-label="Next test case"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
          <DialogDescription className="sr-only">
            Detail test case dan DevLog untuk hasil eksekusi automation maupun manual capture.
          </DialogDescription>
        </DialogHeader>

        {viewTestCase && (
          <div className="flex-1 overflow-y-auto outline-none scrollbar-thin scrollbar-thumb-border/40 scrollbar-track-transparent">
            <div className="p-6 pt-4">
              <Tabs value={activeMainTab} onValueChange={setActiveMainTab} className="w-full">
                <TabsList className={cn("grid w-full mb-6 border border-border/60 bg-secondary/50 p-1 rounded-xl", isBugFixDetail ? 'grid-cols-3' : 'grid-cols-2')}>
                  <TabsTrigger value="details" className="gap-2">
                    <ClipboardList className="w-4 h-4" /> Informasi Utama
                  </TabsTrigger>
                  {isBugFixDetail && (
                    <TabsTrigger value="lifecycle" className="gap-2">
                      <History className="w-4 h-4" /> Lifecycle
                    </TabsTrigger>
                  )}
                  <TabsTrigger value="logs" className="gap-2">
                    <div className="relative">
                      <Wrench className="w-4 h-4" />
                      {socketReady && (
                        <span className="absolute -top-1 -right-1 flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                      )}
                    </div>
                    DevLog
                  </TabsTrigger>
                </TabsList>

                <AnimatePresence mode="wait">
                  {activeMainTab === 'details' && (
                    <TabsContent value="details" className="space-y-6 mt-0 outline-none">
                      <motion.div
                        key="details"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                      >
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-4">
                            <div className="rounded-xl border border-border/60 bg-secondary/30 p-4">
                              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Identification</p>
                              <div className="space-y-3">
                                <div>
                                  <p className="text-xs text-muted-foreground mb-1">Test Case ID (Display)</p>
                                  <p className="font-mono text-base font-bold text-foreground">{viewTestCase.testCaseId}</p>
                                </div>
                                <div>
                                  <div className="flex items-center gap-2 mb-1">
                                    <p className="text-xs text-muted-foreground">Internal Database ID (UUID)</p>
                                    <Badge variant="secondary" className="h-3.5 border-0 bg-indigo-50 px-1 text-[9px] text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">Required for Logs</Badge>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <p className="flex-1 truncate rounded border border-border/60 bg-muted/30 px-2 py-1 font-mono text-[11px] text-muted-foreground shadow-inner">
                                      {viewTestCase.id}
                                    </p>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-7 w-7 border-border/60 bg-secondary/50 p-0 text-muted-foreground hover:bg-indigo-50 hover:text-indigo-700 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-300"
                                      onClick={() => onCopyId(viewTestCase.id)}
                                    >
                                      <Copy className="w-3 h-3" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="rounded-xl border border-border/60 bg-secondary/30 p-4">
                              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Classification</p>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <p className="text-xs text-muted-foreground mb-1">Page / Menu</p>
                                  <p className="font-bold text-foreground">{viewTestCase.page}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground mb-1">Sub Menu</p>
                                  <p className="text-sm font-medium">{viewTestCase.subMenu || '-'}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground mb-1">Tipe Test</p>
                                  <Badge variant="outline" className={getTestTypeColor(viewTestCase.testType)}>{viewTestCase.testType}</Badge>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground mb-1">Prioritas</p>
                                  <Badge className={getPriorityColor(viewTestCase.priority)}>{viewTestCase.priority}</Badge>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div className="rounded-xl border border-border/60 bg-secondary/30 p-4">
                              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Project Tracking</p>
                              <div className="space-y-4">
                                <div>
                                  <p className="text-xs text-muted-foreground mb-1">Module</p>
                                  <div className="flex items-center gap-2">
                                    <Layers className="w-3.5 h-3.5 text-muted-foreground" />
                                    <span className="font-semibold text-foreground">{viewTestCase.module?.name || 'Tanpa Module'}</span>
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <p className="text-xs text-muted-foreground mb-1">Bobot Transaksi</p>
                                    <Badge variant="secondary" className="border-indigo-200 bg-indigo-50 font-mono text-indigo-700 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-300">
                                      {viewTestCase.calculatedWeight != null ? `${viewTestCase.calculatedWeight.toFixed(2)}%` : (viewTestCase.weight || '-')}
                                    </Badge>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground mb-1">Progress</p>
                                    <div className="flex items-center gap-2 mt-1">
                                      <Progress value={viewTestCase.progress} className="h-2 flex-1" />
                                      <span className="text-xs font-bold text-foreground">{viewTestCase.progress}%</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="rounded-xl border border-border/60 bg-secondary/30 p-4">
                              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Test Status</p>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <p className="text-xs text-muted-foreground mb-1">Actual Result</p>
                                  <Badge className={cn(viewTestCase.actualResult === 'As Expected' ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300' : viewTestCase.actualResult === 'Not As Expected' ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300' : 'border-border bg-muted text-muted-foreground dark:border-slate-500/20 dark:bg-slate-500/10 dark:text-slate-300')}>
                                    {viewTestCase.actualResult || 'BELUM DI-TEST'}
                                  </Badge>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground mb-1">Terakhir Diupdate</p>
                                  <p className="text-[10px] font-medium text-muted-foreground">
                                    {new Date(viewTestCase.updatedAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <Separator className="my-6" />

                        <div className="grid grid-cols-1 gap-6">
                          <div className="space-y-2">
                            <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Test Action</Label>
                            <div className="rounded-xl border border-border/60 bg-secondary/30 p-4 text-sm italic leading-relaxed text-muted-foreground">
                              "{viewTestCase.testAction}"
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                              <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Test Steps</Label>
                              <BulletTextView
                                value={viewTestCase.steps}
                                className="min-h-[120px] whitespace-pre-wrap rounded-xl border border-border/60 bg-secondary/30 p-4 text-sm font-medium leading-relaxed text-foreground shadow-inner"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Expected Result</Label>
                              <BulletTextView
                                value={viewTestCase.expectedResult}
                                className="min-h-[120px] rounded-xl border border-emerald-500/15 bg-emerald-500/10 p-4 text-sm font-semibold leading-relaxed text-foreground shadow-inner"
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Remarks / Catatan</Label>
                            <div className="min-h-[72px] whitespace-pre-wrap rounded-xl border border-amber-500/15 bg-amber-500/10 p-4 text-sm italic text-foreground shadow-inner">
                              {viewTestCase.remarks?.trim() || '-'}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    </TabsContent>
                  )}

                  {isBugFixDetail && activeMainTab === 'lifecycle' && (
                    <TabsContent value="lifecycle" className="space-y-6 mt-0 outline-none">
                      <motion.div
                        key="lifecycle"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                      >
                        <div className="rounded-xl border border-border/60 bg-secondary/30 p-5">
                          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Bug Lifecycle</p>
                              <h3 className="mt-1 text-lg font-bold text-foreground">{viewTestCase.testCaseId}</h3>
                              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                                Perjalanan bug dari laporan awal sampai verified fixed. Status maksimal dari halaman BugFix adalah Ready to Retest; Verified & Fixed terjadi setelah retest berhasil dari halaman Test Case.
                              </p>
                            </div>
                            <Badge variant={getStatusBadgeVariant(viewTestCase.status)} className={cn("gap-1")}>
                              {getStatusIcon(viewTestCase.status)} {viewTestCase.status}
                            </Badge>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-4">
                            {lifecycleItems.map((item, index) => {
                              const isDone = index <= lifecycleIndex && Boolean(item.date);
                              const isCurrent = index === lifecycleIndex && viewTestCase.status !== 'VERIFIED & FIXED';

                              return (
                                <div
                                  key={item.key}
                                  className={cn(
                                    "rounded-md border p-3",
                                    isDone
                                      ? 'border-emerald-500/20 bg-emerald-500/10'
                                      : isCurrent
                                        ? 'border-cyan-500/20 bg-cyan-500/10'
                                        : 'border-border/50 bg-secondary/20'
                                  )}
                                >
                                  <div className="mb-2 flex items-center gap-2">
                                    <div className={cn(
                                      "flex h-7 w-7 items-center justify-center rounded-full",
                                      isDone
                                        ? 'bg-emerald-600 text-white'
                                        : isCurrent
                                          ? 'bg-cyan-600 text-white'
                                          : 'bg-muted text-muted-foreground dark:bg-slate-700 dark:text-slate-400'
                                    )}>
                                      {isDone ? <CheckCircle2 className="h-4 w-4" /> : isCurrent ? <Clock className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                                    </div>
                                    <p className="text-sm font-bold text-foreground">{item.label}</p>
                                  </div>
                                  <p className="min-h-[36px] text-xs leading-relaxed text-muted-foreground">{item.description}</p>
                                  <p className="mt-3 text-xs font-semibold text-foreground">{formatDateTime(item.date)}</p>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <div className="rounded-xl border border-border/60 bg-secondary/30 p-4">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Bug Source</p>
                            <div className="mt-3 space-y-3 text-sm">
                              <div>
                                <p className="text-xs text-muted-foreground">Original Test Case ID</p>
                                <p className="font-mono font-bold text-foreground">{viewTestCase.sourceTestCaseId || viewTestCase.id}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Actual Result</p>
                                <p className="font-semibold text-red-700 dark:text-red-300">{viewTestCase.actualResult || 'Not As Expected'}</p>
                              </div>
                            </div>
                          </div>

                          <div className="rounded-xl border border-border/60 bg-secondary/30 p-4">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Status Timing</p>
                            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-xs text-muted-foreground">Reported</p>
                                <p className="font-medium text-foreground">{formatDateTime(viewTestCase.reportedAt || viewTestCase.createdAt)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Updated</p>
                                <p className="font-medium text-foreground">{formatDateTime(viewTestCase.updatedAt)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Ready Retest</p>
                                <p className="font-medium text-foreground">{formatDateTime(viewTestCase.readyAt)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Fixed</p>
                                <p className="font-medium text-foreground">{formatDateTime(viewTestCase.fixedAt)}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    </TabsContent>
                  )}

                  {activeMainTab === 'logs' && (
                    <TabsContent value="logs" className="space-y-4 mt-0 outline-none h-full flex flex-col">
                      <motion.div
                        key="logs"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="h-full flex flex-col"
                      >
                        <div className="flex flex-col flex-1 min-h-0">
                          <div className="mb-4 space-y-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 shadow-sm">
                            <div className="flex flex-wrap items-center gap-2.5">
                              <div className="p-1.5 rounded-lg bg-primary/10">
                                <MonitorDot className="h-4 w-4 text-primary" />
                              </div>
                              <p className="text-xs font-semibold uppercase tracking-wider text-primary dark:text-cyan-400">Panduan DevLog</p>
                              <Badge variant="outline" className="rounded-md border-primary/20 bg-primary/10 text-[10px] font-bold text-primary uppercase tracking-tighter dark:bg-black/40 dark:text-cyan-300">
                                Automation & Manual Capture
                              </Badge>
                            </div>

                            <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm">
                              <button
                                type="button"
                                onClick={() => setExpandedGuide(expandedGuide === 'automation' ? null : 'automation')}
                                className="w-full flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-2.5 text-[11px] font-semibold text-foreground uppercase tracking-wider hover:bg-secondary/40 transition-colors"
                              >
                                <span>Automation Capture Instructions</span>
                                <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform duration-300", expandedGuide === 'automation' && "rotate-180")} />
                              </button>
                              <AnimatePresence>
                                {expandedGuide === 'automation' && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                                    className="overflow-hidden"
                                  >
                                    <div className="border-t border-border/40 px-4 pb-4 pt-3 text-[11px] leading-relaxed text-muted-foreground font-medium bg-secondary/10">
                                      <ol className="ml-4 list-decimal space-y-2">
                                        <li>Jalankan relay dengan <span className="font-mono text-[11px] text-primary bg-primary/10 px-1 rounded">node mini-services/ws-server.js</span>.</li>
                                        <li>Salin UUID test case dari tab Informasi Utama, bukan display ID seperti E-124.</li>
                                        <li>Tempel UUID ke kolom **Test Case ID** pada browser Automation Capture.</li>
                                        <li>Aktifkan **Event Sync** agar log browser masuk ke aplikasi ini secara real-time.</li>
                                      </ol>
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          </div>

                          <div className="!hidden flex-1 flex-col overflow-hidden rounded-2xl border border-border/60 bg-secondary/20 shadow-inner" aria-hidden="true">
                            <div className="flex h-11 shrink-0 items-center justify-between border-b border-border/40 bg-secondary/40 px-4">
                              <div className="flex rounded-lg bg-background/50 p-1 border border-border/40">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className={cn(
                                    "h-7 px-3 text-[10px] font-bold uppercase tracking-wider",
                                    activeDevLogTab === 'console'
                                      ? 'bg-primary text-white shadow-sm'
                                      : 'text-muted-foreground hover:bg-secondary/80 hover:text-foreground'
                                  )}
                                  onClick={() => setActiveDevLogTab('console')}
                                >
                                  Console
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className={cn(
                                    "h-7 px-3 text-[10px] font-bold uppercase tracking-wider",
                                    activeDevLogTab === 'network'
                                      ? 'bg-primary text-white shadow-sm'
                                      : 'text-muted-foreground hover:bg-secondary/80 hover:text-foreground'
                                  )}
                                  onClick={() => setActiveDevLogTab('network')}
                                >
                                  Network
                                </Button>
                              </div>
                              <div className="flex items-center gap-2">
                                {activeDevLogTab === 'network' && (
                                  <Badge variant="outline" className="h-6 border-indigo-200 bg-indigo-50 text-[10px] font-bold text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-950/60 dark:text-indigo-300">
                                    {networkLogItems.length} Requests
                                  </Badge>
                                )}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 gap-1.5 rounded-xl border-border/60 bg-background/80 text-[10px] font-bold text-muted-foreground hover:text-foreground shadow-sm"
                                  onClick={openSystemDevLogFullscreen}
                                >
                                  <Maximize2 className="h-3.5 w-3.5" />
                                  Fullscreen
                                </Button>
                              </div>
                            </div>

                            <div className="min-h-0 flex-1 overflow-hidden bg-background/40">
                              {activeDevLogTab === 'console' ? (
                                <div className="h-full overflow-y-auto p-3 scrollbar-thin scrollbar-thumb-border/40 scrollbar-track-transparent">
                                  {groupedConsoleLogs.length === 0 ? (
                                    <div className="flex h-full flex-col items-center justify-center py-20 text-muted-foreground">
                                      <Bot className="mb-4 h-10 w-10 opacity-20" />
                                      <p className="text-[11px] font-semibold uppercase tracking-wider">Waiting for Browser Logs...</p>
                                      <p className="mt-2 text-[10px] font-medium opacity-60">Pastikan Automation Capture sudah terhubung.</p>
                                    </div>
                                  ) : (
                                    groupedConsoleLogs.map((group) => {
                                      const { log, entries, count } = group;
                                      const logId = group.id;
                                      const isError = entries.some((entry) => entry.level === 'SEVERE' || entry.log?.toString().toLowerCase().includes('error'));
                                      const isWarning = entries.some((entry) => entry.level === 'WARNING' || entry.log?.toString().toLowerCase().includes('warn'));
                                      const canExpand = typeof log.log === 'object' || count > 1;

                                      return (
                                        <div
                                          key={logId}
                                          className={cn(
                                            "mb-1.5 rounded-xl border border-border/40 bg-card/60 transition-all duration-200",
                                            isError ? 'border-red-200 bg-red-50/50 dark:border-red-500/20 dark:bg-red-950/20' : isWarning ? 'border-amber-200 bg-amber-50/50 dark:border-amber-500/20 dark:bg-amber-950/20' : 'hover:border-border hover:bg-card'
                                          )}
                                        >
                                          <div
                                            className={cn(
                                              "flex w-full cursor-pointer items-start gap-3 p-2.5 text-left text-[11px] font-medium leading-relaxed",
                                              !canExpand && "cursor-default"
                                            )}
                                            onClick={() => {
                                              if (canExpand) {
                                                setExpandedLogId(expandedLogId === logId ? null : logId);
                                              }
                                              seekRecordingFromLog(log);
                                            }}
                                          >
                                            <span className="text-muted-foreground text-[10px] min-w-[64px] font-bold opacity-60">
                                              {log.timestamp ? new Date(log.timestamp).toLocaleTimeString('id-ID', { hour12: false }) : '-'}
                                            </span>
                                            {typeof log.relativeMs === 'number' && (
                                              <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[9px] font-semibold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                                                {formatRelativeTime(log.relativeMs)}
                                              </span>
                                            )}
                                            <div className="flex-1 break-all">
                                              <span className={cn(isError ? 'text-rose-700 dark:text-rose-400 font-bold' : isWarning ? 'text-amber-700 dark:text-amber-400 font-bold' : 'text-foreground/90')}>
                                                {getConsoleLogText(log)}
                                              </span>
                                            </div>
                                            {count > 1 && (
                                              <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-950/60 dark:text-indigo-200">
                                                x{count}
                                              </span>
                                            )}
                                            {canExpand && (
                                              <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform shrink-0 mt-0.5", expandedLogId === logId && "rotate-180")} />
                                            )}
                                          </div>
                                          <AnimatePresence>
                                            {expandedLogId === logId && canExpand && (
                                              <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.2 }}
                                                className="overflow-hidden"
                                              >
                                                <div className="space-y-3 px-10 pb-4">
                                                  {count > 1 && (
                                                    <div className="rounded-xl border border-border/60 bg-background/50 p-2.5 shadow-inner">
                                                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground opacity-60">Repeated {count} times</p>
                                                      <div className="max-h-48 space-y-1 overflow-y-auto pr-1 scrollbar-thin">
                                                        {entries.map((entry, entryIndex) => (
                                                          <button
                                                            key={entry.id ?? `${logId}-repeat-${entryIndex}`}
                                                            type="button"
                                                            className="grid w-full grid-cols-[48px_72px_1fr] gap-3 rounded-lg border border-border/40 bg-secondary/20 px-3 py-1.5 text-left text-[10px] hover:bg-secondary/40 transition-colors"
                                                            onClick={() => seekRecordingFromLog(entry)}
                                                          >
                                                            <span className="font-semibold text-muted-foreground opacity-40">#{entryIndex + 1}</span>
                                                            <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{formatRelativeTime(entry.relativeMs)}</span>
                                                            <span className="truncate text-foreground font-medium">{getConsoleLogText(entry)}</span>
                                                          </button>
                                                        ))}
                                                      </div>
                                                    </div>
                                                  )}
                                                  <div className="bg-secondary/30 rounded-xl p-4 border border-border/40 shadow-inner">
                                                    <pre className="text-foreground/80 text-[11px] whitespace-pre-wrap overflow-x-auto font-mono leading-relaxed">
                                                      {formatPrettyValue(log.log)}
                                                    </pre>
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
                              ) : (
                                <div className="h-full flex flex-col">
                                  <div className="space-y-2.5 border-b border-border/40 bg-secondary/40 p-3 shadow-sm">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <div className="relative min-w-[240px] flex-1">
                                        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                                        <Input
                                          value={networkFilters.search}
                                          onChange={(event) => updateNetworkFilters({ search: event.target.value })}
                                          placeholder="Search URL, method, status..."
                                          className="h-9 border-border/60 bg-background/80 pl-9 text-[11px] font-medium text-foreground placeholder:text-muted-foreground/50 rounded-xl focus-visible:ring-primary/20 transition-all duration-200"
                                        />
                                      </div>
                                      <select
                                        value={networkFilters.host}
                                        onChange={(event) => updateNetworkFilters({ host: event.target.value })}
                                        className="h-9 min-w-[160px] rounded-xl border border-border/60 bg-background/80 px-3 text-[11px] font-bold text-foreground outline-none focus:ring-2 focus:ring-primary/10 transition-all duration-200"
                                      >
                                        <option value="all">All hosts ({networkLogItems.length})</option>
                                        {networkHosts.map((host) => (
                                          <option key={host} value={host}>{host}</option>
                                        ))}
                                      </select>
                                      <select
                                        value={networkFilters.method}
                                        onChange={(event) => updateNetworkFilters({ method: event.target.value })}
                                        className="h-9 rounded-xl border border-border/60 bg-background/80 px-3 text-[11px] font-bold text-foreground outline-none focus:ring-2 focus:ring-primary/10 transition-all duration-200"
                                      >
                                        <option value="all">Methods</option>
                                        {networkMethods.map((method) => (
                                          <option key={method} value={method}>{method}</option>
                                        ))}
                                      </select>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-9 gap-1.5 px-3 rounded-xl border-border/60 bg-background/80 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground shadow-sm"
                                        onClick={() => setNetworkFilters(DEFAULT_NETWORK_FILTERS)}
                                      >
                                        <RefreshCw className="h-3.5 w-3.5" />
                                        Reset
                                      </Button>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                                      {[
                                        { key: 'showPreflight' as const, label: `Preflight ${networkCategoryCounts.preflight}` },
                                        { key: 'showDocument' as const, label: `Docs ${networkCategoryCounts.document}` },
                                        { key: 'showScript' as const, label: `JS ${networkCategoryCounts.script}` },
                                        { key: 'showImage' as const, label: `Img ${networkCategoryCounts.image}` },
                                        { key: 'showStatic' as const, label: `Static ${networkCategoryCounts.static}` },
                                        { key: 'showTelemetry' as const, label: `Log ${networkCategoryCounts.telemetry}` },
                                        { key: 'showOther' as const, label: `Other ${networkCategoryCounts.other}` },
                                      ].map((filter) => (
                                        <Button
                                          key={filter.key}
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          className={cn(
                                            "h-7 rounded-lg border px-3 text-[10px] font-bold transition-all duration-200",
                                            networkFilters[filter.key]
                                              ? 'border-primary/40 bg-primary/10 text-primary shadow-sm'
                                              : 'border-border/40 bg-secondary/30 text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                                          )}
                                          onClick={() => toggleNetworkFilter(filter.key)}
                                        >
                                          {filter.label}
                                        </Button>
                                      ))}
                                      <span className="ml-auto rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-tighter text-primary">
                                        API {networkCategoryCounts.business}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-12 gap-2 p-2.5 bg-secondary/40 border-b border-border/40 text-[9px] font-semibold text-muted-foreground uppercase tracking-wider shrink-0">
                                    <div className="col-span-1">Method</div>
                                    <div className="col-span-1">Type</div>
                                    <div className="col-span-5 pl-1">Name / Path</div>
                                    <div className="col-span-2 text-center">Status</div>
                                    <div className="col-span-2 text-right">Time</div>
                                    <div className="col-span-1"></div>
                                  </div>

                                  <div className="flex-1 overflow-y-auto divide-y divide-border/30 scrollbar-thin scrollbar-thumb-border/40 scrollbar-track-transparent">
                                    {groupedNetworkLogs.length === 0 ? (
                                      <div className="h-full flex flex-col items-center justify-center py-24 text-muted-foreground">
                                        <RefreshCw className="w-10 h-10 mb-4 opacity-10 animate-spin" />
                                        <p className="font-semibold tracking-[0.2em] text-[10px] uppercase opacity-40">Listening for traffic...</p>
                                      </div>
                                    ) : (
                                      groupedNetworkLogs.map((group) => {
                                        const { log: net, meta, entries, count } = group;
                                        const logId = group.id;

                                        return (
                                          <div key={logId} className="group hover:bg-secondary/20 transition-colors">
                                            <div
                                              className="grid grid-cols-12 gap-2 p-2.5 cursor-pointer items-center text-[11px]"
                                              onClick={() => {
                                                seekRecordingFromLog(net);
                                                setExpandedLogId(expandedLogId === logId ? null : logId);
                                              }}
                                            >
                                              <div className="col-span-1 font-semibold text-primary truncate">{getNetworkMethod(net.network)}</div>
                                              <div className="col-span-1 truncate">
                                                <span className={`rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase ${getNetworkCategoryClass(meta.category)}`}>
                                                  {meta.label}
                                                </span>
                                              </div>
                                              <div className="col-span-5 min-w-0 pl-1">
                                                <div className="truncate font-semibold text-foreground">{meta.pathname.split('/').pop() || meta.pathname || net.network.url}</div>
                                                <div className="truncate text-[9px] text-muted-foreground font-medium opacity-60">{meta.host}</div>
                                              </div>
                                              <div className="col-span-2 text-center">
                                                <span className={cn("px-2 py-0.5 rounded-lg text-[10px] font-semibold", getNetworkStatusClass(net.network))}>
                                                  {getNetworkStatus(net.network)}
                                                </span>
                                              </div>
                                              <div className="col-span-2 text-right">
                                                <div className="font-bold text-muted-foreground">{getNetworkDuration(net.network)}</div>
                                                {typeof net.relativeMs === 'number' && (
                                                  <div className="text-[9px] font-semibold text-primary uppercase tracking-tighter">{formatRelativeTime(net.relativeMs)}</div>
                                                )}
                                              </div>
                                              <div className="col-span-1 flex items-center justify-end gap-1.5">
                                                {count > 1 && (
                                                  <span className="rounded-full border border-primary/20 bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold text-primary">
                                                    {count}
                                                  </span>
                                                )}
                                                <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground/40 transition-transform group-hover:text-muted-foreground", expandedLogId === logId && "rotate-180")} />
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
                                                  <div className="p-5 bg-secondary/10 border-t border-border/30 space-y-4">
                                                    {count > 1 && (
                                                      <div className="rounded-xl border border-border/40 bg-background/60 p-3 shadow-inner">
                                                        <p className="mb-2.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground opacity-50">Repeated Request History ({count})</p>
                                                        <div className="max-h-48 space-y-1.5 overflow-y-auto pr-1 scrollbar-thin">
                                                          {entries.map((entry, entryIndex) => (
                                                            <button
                                                              key={entry.log.id ?? `${logId}-repeat-${entryIndex}`}
                                                              type="button"
                                                              className="grid w-full grid-cols-[40px_72px_64px_1fr] gap-3 rounded-lg border border-border/40 bg-secondary/30 px-3 py-2 text-left text-[10px] hover:bg-secondary/50 transition-colors"
                                                              onClick={() => seekRecordingFromLog(entry.log)}
                                                            >
                                                              <span className="font-semibold text-muted-foreground opacity-30">#{entryIndex + 1}</span>
                                                              <span className="font-mono font-bold text-primary">{formatRelativeTime(entry.log.relativeMs)}</span>
                                                              <span className={cn("rounded-md px-1.5 py-0.5 text-center font-semibold", getNetworkStatusClass(entry.log.network))}>
                                                                {getNetworkStatus(entry.log.network)}
                                                              </span>
                                                              <span className="truncate text-foreground font-medium">{getNetworkDuration(entry.log.network)}</span>
                                                            </button>
                                                          ))}
                                                        </div>
                                                      </div>
                                                    )}

                                                    <div className="rounded-xl border border-border/40 bg-background/60 p-4 shadow-inner space-y-4">
                                                      <div>
                                                        <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground opacity-50">Full Destination URL</p>
                                                        <pre className="overflow-auto rounded-lg border border-border/30 bg-secondary/20 p-2.5 font-mono text-[10px] leading-relaxed text-foreground/80 break-all whitespace-pre-wrap">
                                                          {net.network.url}
                                                        </pre>
                                                      </div>

                                                      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
                                                        <div className="space-y-2">
                                                          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground opacity-50">Request Headers</p>
                                                          <pre className={cn(networkCodePanelClass, "h-[240px] border-border/30 bg-secondary/20 text-foreground/70")}>
                                                            {formatPrettyValue(net.network.headers)}
                                                          </pre>
                                                        </div>
                                                        <div className="space-y-2">
                                                          <p className="text-[9px] font-semibold uppercase tracking-wider text-primary/60 opacity-80">Request Body</p>
                                                          <pre className={cn(networkCodePanelClass, "h-[240px] border-primary/20 bg-primary/5 text-primary/80")}>
                                                            {formatPrettyValue(getRequestPayload(net.network.data))}
                                                          </pre>
                                                        </div>
                                                        <div className="space-y-2">
                                                          <p className="text-[9px] font-semibold uppercase tracking-wider text-emerald-600/60 opacity-80">Response Body</p>
                                                          <pre className={cn(networkCodePanelClass, "h-[240px] border-emerald-500/20 bg-emerald-500/5 text-emerald-600/80 font-semibold")}>
                                                            {formatPrettyValue(getResponsePayload(net.network.data))}
                                                          </pre>
                                                        </div>
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
                              )}
                            </div>
                            <div className="bg-secondary/60 px-4 py-2 border-t border-border/40 flex items-center justify-between shrink-0 shadow-inner">
                              <div className="flex items-center gap-5 text-[9px] font-semibold uppercase tracking-[0.15em]">
                                <div className="flex items-center gap-2">
                                  <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                                  <span className="text-emerald-700 dark:text-emerald-400">{okLogCount} Succesful</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="h-2 w-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]"></div>
                                  <span className="text-rose-700 dark:text-rose-400">{errorLogCount} Critical Errors</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 text-[9px] font-bold text-muted-foreground/60 uppercase tracking-tighter italic">
                                <RefreshCw className="h-3 w-3 animate-spin-slow" />
                                Live Telemetry Stream
                              </div>
                            </div>
                          </div>

                          <div className="hidden shrink-0 mt-4 items-start gap-4 rounded-2xl border border-primary/20 bg-primary/5 p-4 shadow-sm" aria-hidden="true">
                            <div className="mt-0.5 rounded-xl border border-primary/20 bg-background/80 p-2 text-primary shadow-sm">
                              <Sparkles className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[11px] text-foreground font-semibold leading-relaxed">
                                <span className="text-primary font-semibold uppercase tracking-tight mr-1.5">DevTools:</span>
                                Tab **Console** memantau eksekusi runtime browser, sementara **Network** melacak pertukaran data API. Gunakan detail payload untuk validasi integrasi yang mendalam.
                              </p>
                            </div>
                          </div>
                            <div className="rounded-xl border border-border bg-card dark:border-border dark:bg-card overflow-hidden">
                              <button
                                type="button"
                                onClick={() => setExpandedGuide(expandedGuide === 'manual' ? null : 'manual')}
                                className="w-full flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-2.5 text-[11px] font-bold text-foreground uppercase tracking-wider dark:text-slate-300 hover:bg-secondary/20 transition-colors"
                              >
                                <span>Manual Capture</span>
                                <ChevronDown className={cn("h-4 w-4 text-slate-500 transition-transform duration-300", expandedGuide === 'manual' && "rotate-180")} />
                              </button>
                              <AnimatePresence>
                                {expandedGuide === 'manual' && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                                    className="overflow-hidden"
                                  >
                                    <div className="border-t border-border px-4 pb-4 pt-3 text-[11px] leading-relaxed text-muted-foreground font-medium dark:border-border/50 dark:text-muted-foreground">
                                      <ol className="ml-4 list-decimal space-y-2">
                                        <li>Masukkan URL website yang ingin dites pada input Manual Capture.</li>
                                        <li>Pilih Browser Kosong untuk sesi bersih, atau Profiled Browser untuk memakai ulang login/cookies profile QA Desk.</li>
                                        <li>Klik Start. QA Desk akan membuka browser capture dan mulai merekam telemetry.</li>
                                        <li>Lakukan testing manual di browser yang terbuka.</li>
                                        <li>Klik Stop dari QA Desk setelah selesai untuk menyimpan hasil run.</li>
                                      </ol>
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>

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

                          {(manualRecording?.frames?.length || hasManualRecordingVideo) ? (
                            <div className="mb-4 grid gap-4 rounded-2xl border border-border/60 bg-secondary/20 p-4 shadow-xl lg:grid-cols-[320px_1fr]">
                              <button
                                type="button"
                                className="group relative overflow-hidden rounded-xl border border-border/60 bg-background text-left shadow-2xl"
                                onClick={openRecordingFullscreen}
                              >
                                {hasManualRecordingVideo ? (
                                  <video
                                    ref={recordingVideoRef}
                                    src={manualRecordingVideoUrl}
                                    controls
                                    preload="metadata"
                                    onLoadedMetadata={handleRecordingVideoLoadedMetadata}
                                    onTimeUpdate={handleFullscreenVideoTimeUpdate}
                                    className="aspect-video w-full bg-black object-contain opacity-90 group-hover:opacity-100 transition-opacity"
                                  />
                                ) : selectedRecordingFrame ? (
                                  <img
                                    src={`http://127.0.0.1:3001${selectedRecordingFrame.url}`}
                                    alt="Manual capture recording frame"
                                    className="aspect-video w-full bg-black object-contain opacity-80 group-hover:opacity-100 transition-opacity"
                                  />
                                ) : null}
                                <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition duration-300 group-hover:bg-black/40 group-hover:opacity-100">
                                  <span className="inline-flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-teal-700 shadow-2xl dark:border-teal-500/20 dark:bg-teal-500/10 dark:text-teal-200">
                                    <Maximize2 className="h-4 w-4" />
                                    Fullscreen
                                  </span>
                                </div>
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
                                    {isVideoFinalizing && (
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
                                      onClick={openRecordingFullscreen}
                                    >
                                      <Maximize2 className="h-3.5 w-3.5" />
                                      Review
                                    </Button>
                                  </div>
                                  <p className="mt-3 truncate text-[11px] font-medium text-muted-foreground">
                                    {manualRecordingTargetUrl}
                                  </p>
                                  {isVideoFinalizing && (
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
                          ) : null}

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

                          <div className="flex-1 min-h-0 bg-white rounded-2xl border border-slate-300 shadow-xl overflow-hidden flex flex-col font-mono text-[11.5px] dark:bg-background dark:border-border dark:shadow-2xl">
                            {aiSummary && (
                              <div className="border-b border-indigo-100 bg-indigo-50 p-4 animate-in fade-in slide-in-from-top-2 duration-500 dark:border-indigo-900/50 dark:bg-indigo-950/30">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2 text-indigo-700 font-bold text-[10px] uppercase tracking-wider dark:text-indigo-400">
                                    <Sparkles className="w-3.5 h-3.5" />
                                    AI Result Summary
                                  </div>
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-indigo-700/60 hover:text-indigo-700 dark:text-indigo-400/50 dark:hover:text-indigo-400" onClick={() => setAiSummary(null)}>
                                    <X className="w-3 h-3" />
                                  </Button>
                                </div>
                                <div className="text-foreground leading-relaxed whitespace-pre-wrap text-[11px] prose prose-sm max-w-none dark:prose-invert dark:text-slate-300">
                                  {aiSummary}
                                </div>
                              </div>
                            )}
                            <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent dark:scrollbar-thumb-slate-700">
                              {activeDevLogTab === 'execution' ? (
                                <div className="p-5 space-y-0.5">
                                  {viewTestCase.stepLogs ? (
                                    viewTestCase.stepLogs.split('\n').map((line, index) => {
                                      if (!line.trim()) return null;
                                      const isError = line.toLowerCase().includes('error') || line.toLowerCase().includes('fail');
                                      const isWarning = line.toLowerCase().includes('warn');
                                      const isInfo = line.toLowerCase().includes('info') || line.toLowerCase().includes('step');

                                      return (
                                        <div key={`${index}-${line}`} className="flex gap-4 rounded px-2 py-0.5 transition-colors hover:bg-secondary/60 dark:hover:bg-white/5 group">
                                          <span className="min-w-[24px] select-none text-right font-bold text-muted-foreground opacity-60 group-hover:opacity-100">{index + 1}</span>
                                          <span className={cn(isError ? 'text-rose-700 font-bold dark:text-rose-400' : isWarning ? 'text-amber-700 dark:text-amber-400' : isInfo ? 'text-cyan-700 dark:text-cyan-400' : 'text-emerald-700 dark:text-emerald-400/90')}>
                                            {line}
                                          </span>
                                        </div>
                                      );
                                    })
                                  ) : (
                                    <div className="h-full flex flex-col items-center justify-center py-20 text-muted-foreground">
                                      <Clock className="w-8 h-8 mb-3 opacity-20" />
                                      <p className="font-bold tracking-wider text-[10px] uppercase">Awaiting Execution Trace...</p>
                                    </div>
                                  )}
                                  <div ref={logEndRef} className="h-8" />
                                </div>
                              ) : activeDevLogTab === 'console' ? (
                                <div className="divide-y divide-border">
                                  {groupedConsoleLogs.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center py-20 text-muted-foreground">
                                      <Clock className="w-8 h-8 mb-3 opacity-20" />
                                      <p className="font-bold tracking-wider text-[10px] uppercase">Awaiting Console Output...</p>
                                    </div>
                                  ) : (
                                    groupedConsoleLogs.map((group) => {
                                      const { log, entries, count } = group;
                                      const logId = group.id;
                                      const isError = entries.some((entry) => entry.level === 'SEVERE' || entry.log?.toString().toLowerCase().includes('error'));
                                      const isWarning = entries.some((entry) => entry.level === 'WARNING' || entry.log?.toString().toLowerCase().includes('warn'));
                                      const canExpand = count > 1 || typeof log.log === 'object';

                                      return (
                                        <div key={logId} className={cn("group", isError ? 'bg-rose-50 dark:bg-rose-950/20' : isWarning ? 'bg-amber-50 dark:bg-amber-950/20' : 'hover:bg-secondary/60 dark:hover:bg-white/5')}>
                                          <div
                                            className="flex items-start gap-3 p-2 cursor-pointer transition-colors"
                                            onClick={() => {
                                              seekRecordingFromLog(log);
                                              setExpandedLogId(expandedLogId === logId ? null : logId);
                                            }}
                                          >
                                            <span className="text-muted-foreground text-[10px] min-w-[60px] pt-0.5">
                                              {log.timestamp ? new Date(log.timestamp).toLocaleTimeString('id-ID', { hour12: false }) : '-'}
                                            </span>
                                            {typeof log.relativeMs === 'number' && (
                                              <span className="mt-0.5 rounded bg-indigo-50 px-1.5 py-0.5 text-[9px] font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                                                {formatRelativeTime(log.relativeMs)}
                                              </span>
                                            )}
                                            <div className="flex-1 break-all">
                                              <span className={cn(isError ? 'text-rose-700 dark:text-rose-400' : isWarning ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400/90')}>
                                                {typeof log.log === 'object' ? `${JSON.stringify(log.log).substring(0, 200)}...` : String(log.log ?? '')}
                                              </span>
                                            </div>
                                            {count > 1 && (
                                              <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-950/60 dark:text-indigo-200">
                                                x{count}
                                              </span>
                                            )}
                                            {canExpand && (
                                              <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform", expandedLogId === logId && "rotate-180")} />
                                            )}
                                          </div>
                                          <AnimatePresence>
                                            {expandedLogId === logId && canExpand && (
                                              <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.2 }}
                                                className="overflow-hidden"
                                              >
                                                <div className="space-y-3 px-10 pb-3">
                                                  {count > 1 && (
                                                    <div className="rounded-lg border border-border bg-background p-2 dark:bg-card/70">
                                                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Repeated {count} times</p>
                                                      <div className="max-h-44 space-y-1 overflow-y-auto pr-1">
                                                        {entries.map((entry, entryIndex) => (
                                                          <button
                                                            key={entry.id ?? `${logId}-repeat-${entryIndex}`}
                                                            type="button"
                                                            className="grid w-full grid-cols-[54px_70px_1fr] gap-2 rounded-md border border-border bg-muted/40 px-2 py-1 text-left text-[10px] hover:bg-secondary"
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
                                                  <div className="bg-muted rounded-lg p-3 border border-border shadow-inner">
                                                    <pre className="text-emerald-700 whitespace-pre-wrap overflow-x-auto dark:text-emerald-500/80">
                                                      {formatPrettyValue(log.log)}
                                                    </pre>
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
                              ) : (
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
                              )}
                            </div>
                            <div className="bg-muted/80 p-2 border-t border-border flex items-center justify-between shrink-0">
                              <div className="flex items-center gap-4 text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                                <div className="flex items-center gap-1.5">
                                  <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                  {okLogCount} OK
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                                  {errorLogCount} ERRORS
                                </div>
                              </div>
                              <p className="text-[10px] text-muted-foreground italic">Auto-scrolling enabled</p>
                            </div>
                          </div>

                          <div className="shrink-0 mt-4 flex items-start gap-3 rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-4 shadow-inner">
                            <div className="mt-0.5 rounded-full border border-indigo-200 bg-indigo-50 p-1 text-indigo-700 shadow-sm dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-300">
                              <HelpCircle className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <p className="text-[11px] text-muted-foreground font-medium leading-relaxed">
                                <span className="font-bold text-indigo-700 dark:text-indigo-300">DevTools Mode:</span> Tab **Console** menampilkan log browser (JS errors/logs). Tab **Network** menampilkan *XHR/Fetch* traffic. Klik pada baris log untuk melihat detail payload dan headers.
                              </p>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    </TabsContent>
                  )}
                </AnimatePresence>
              </Tabs>
            </div>
          </div>
        )}

        {isSystemDevLogFullscreen && (
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
                      {viewTestCase?.testCaseId || '-'} · {viewTestCase?.testAction || 'Execution telemetry'}
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
        )}

        {isRecordingFullscreen && (manualRecording?.frames?.length || hasManualRecordingVideo) && (
          <div
            className={cn(
              "fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4 text-foreground transition-opacity duration-200",
              isClosingRecordingFullscreen ? 'opacity-0' : 'opacity-100'
            )}
          >
            <div
              className={cn(
                "relative flex h-full w-full max-w-[96vw] overflow-hidden rounded-2xl border border-border bg-background shadow-2xl transition-all duration-200 ease-out",
                isRecordingFullscreenExpanded && !isClosingRecordingFullscreen ? 'scale-100 opacity-100' : 'scale-95 opacity-95'
              )}
            >
              {isRecordingFullscreenContentVisible && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-4 top-4 z-[90] h-10 w-10 rounded-full border border-border/70 bg-background/90 p-0 text-foreground shadow-xl backdrop-blur transition hover:bg-secondary"
                  onClick={closeRecordingFullscreen}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}

              {!isRecordingFullscreenContentVisible ? (
                <div className="flex h-full w-full bg-background" />
              ) : (
                <ResizablePanelGroup direction="horizontal" className="h-full w-full">
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
            <ResizableHandle withHandle />
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

              {hasManualRecordingVideo && (
                <div className="shrink-0 border-b border-border bg-background px-3 py-2">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground">Synced Events</p>
                    <span className="text-[10px] font-bold text-muted-foreground">{filteredSyncedVideoEvents.length}/{syncedVideoEvents.length} events</span>
                  </div>
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {[
                      { key: 'network' as const, label: 'Network' },
                      { key: 'console' as const, label: 'Console' },
                      { key: 'errors' as const, label: 'Errors' },
                      { key: 'warnings' as const, label: 'Warnings' },
                      { key: 'steps' as const, label: 'Steps' },
                      { key: 'evidence' as const, label: 'Evidence' },
                      { key: 'unknown' as const, label: 'Unknown' },
                    ].map((item) => (
                      <Button
                        key={item.key}
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "h-6 rounded-md border px-2 text-[9px] font-semibold uppercase tracking-wider",
                          syncedEventFilters[item.key]
                            ? "border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-200"
                            : "border-border bg-muted text-muted-foreground hover:bg-secondary"
                        )}
                        onClick={() => toggleSyncedEventFilter(item.key)}
                      >
                        {item.label}
                      </Button>
                    ))}
                  </div>
                  {syncedVideoEvents.length === 0 ? (
                    <p className="rounded-md border border-dashed border-border bg-muted/40 px-3 py-2 text-[10px] font-semibold text-muted-foreground">
                      Belum ada event dengan timestamp yang bisa disinkronkan ke video.
                    </p>
                  ) : filteredSyncedVideoEvents.length === 0 ? (
                    <p className="rounded-md border border-dashed border-border bg-muted/40 px-3 py-2 text-[10px] font-semibold text-muted-foreground">
                      Tidak ada synced event yang cocok dengan filter aktif.
                    </p>
                  ) : (
                    <div className="flex max-h-32 gap-2 overflow-x-auto pb-1">
                      {filteredSyncedVideoEvents.slice(0, 24).map((event) => (
                        <button
                          key={event.id}
                          type="button"
                          className={cn(
                            "min-w-[180px] rounded-lg border px-2 py-1.5 text-left shadow-sm transition hover:scale-[1.01]",
                            getSyncedEventSeverityClass(event),
                            selectedSyncedEventId === event.id && "ring-2 ring-indigo-300 ring-offset-1 ring-offset-background"
                          )}
                          onClick={() => seekRecordingFromSyncedEvent(event)}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-[9px] font-semibold uppercase tracking-wider">{event.label}</span>
                            <span className="font-mono text-[10px] font-semibold">{formatRelativeTime(event.clampedOffsetMs)}</span>
                          </div>
                          <p className="mt-1 line-clamp-2 text-[10px] font-semibold">{event.summary}</p>
                          {(event.isBeforeVideo || event.isAfterVideo) && (
                            <p className="mt-1 text-[9px] font-semibold uppercase tracking-wider opacity-80">
                              {event.isBeforeVideo ? 'Before video' : 'After video'}
                            </p>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                  {selectedSyncedVideoEventDetail && (
                    <div className={cn("mt-2 rounded-lg border p-2 text-[10px]", getSyncedEventSeverityClass(selectedSyncedVideoEvent!))}>
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className="font-semibold uppercase tracking-wider">{selectedSyncedVideoEventDetail.category}</span>
                        <span className="rounded border border-current/20 px-1.5 py-0.5 font-semibold uppercase tracking-wider">{selectedSyncedVideoEventDetail.severity}</span>
                        <span className="font-mono font-semibold">{selectedSyncedVideoEventDetail.offset}</span>
                        <span className="truncate font-mono opacity-75">{selectedSyncedVideoEventDetail.timestamp}</span>
                      </div>
                      {(selectedSyncedVideoEventDetail.method || selectedSyncedVideoEventDetail.url || selectedSyncedVideoEventDetail.responseStatus) && (
                        <div className="mb-1 grid grid-cols-[64px_1fr_48px] gap-2 rounded border border-current/15 bg-background/40 p-1.5">
                          <span className="truncate font-semibold">{selectedSyncedVideoEventDetail.method || '-'}</span>
                          <span className="truncate">{selectedSyncedVideoEventDetail.url || '-'}</span>
                          <span className="text-right font-semibold">{selectedSyncedVideoEventDetail.responseStatus || '-'}</span>
                        </div>
                      )}
                      <p className="line-clamp-3 font-semibold">{selectedSyncedVideoEventDetail.summary}</p>
                    </div>
                  )}
                </div>
              )}

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
                </ResizablePanelGroup>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="p-6 pt-4 border-t shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="h-10 border-border/60 px-6 font-bold">
            Tutup
          </Button>
          {viewTestCase && !isBugFixDetail && onRefine && (
            <Button
              variant="outline"
              onClick={() => onRefine(viewTestCase)}
              className="h-10 px-6 font-bold gap-2 border-violet-200 text-violet-700 hover:bg-violet-50 dark:border-violet-500/30 dark:text-violet-300 dark:hover:bg-violet-500/10"
            >
              <Sparkles className="w-4 h-4" /> Refine AI
            </Button>
          )}
          {viewTestCase && (
            <Button
              variant="outline"
              onClick={openEvidenceReport}
              className="h-10 px-6 font-bold gap-2 border-sky-200 text-sky-700 hover:bg-sky-50 dark:border-sky-500/30 dark:text-sky-300 dark:hover:bg-sky-500/10"
            >
              <FileDown className="w-4 h-4" /> Evidence Report
            </Button>
          )}
          {viewTestCase && (
            <Button
              onClick={() => { onOpenChange(false); onEdit(viewTestCase); }}
              className="h-10 px-6 font-bold gap-2 bg-indigo-600 text-white shadow-sm shadow-indigo-500/20 hover:bg-indigo-700 dark:bg-indigo-500 dark:text-white dark:shadow-none dark:hover:bg-indigo-400"
            >
              <Edit3 className="w-4 h-4" /> Edit Test Case
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
