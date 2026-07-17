'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, Bot, Bug, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ClipboardList, Clock, Code2, Copy, Edit3, Film, HelpCircle, History,
  FileDown, Filter, Globe2, Layers, Link2, ListChecks, Loader2, Maximize2, MessageSquare, Minus, MonitorDot, Paperclip, Play, PlayCircle, Plus, RefreshCw, Search, Sparkles, Square, Trash2, UserRound, Wrench, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
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
import { TestCaseDetailDialogFooter } from '@/components/TestCaseDetailDialogFooter';
import { TestCaseDetailDialogHeader } from '@/components/TestCaseDetailDialogHeader';
import { TestCaseDetailsTab } from '@/components/TestCaseDetailsTab';
import { TestCaseLifecycleTab } from '@/components/TestCaseLifecycleTab';
import { TestCaseTraceabilityTab } from '@/components/TestCaseTraceabilityTab';
import { TestCaseCommentsTab } from '@/components/TestCaseCommentsTab';
import { TestCaseEvidenceTab } from '@/components/TestCaseEvidenceTab';
import { TestCaseBugsTab } from '@/components/TestCaseBugsTab';
import { TestCaseHistoryTab } from '@/components/TestCaseHistoryTab';
import { TestCaseExecutionTab } from '@/components/TestCaseExecutionTab';
import { ManualCaptureCommand } from '@/components/ManualCaptureCommand';
import { ManualRecordingPreview } from '@/components/ManualRecordingPreview';
import { SystemDevLogHeader } from '@/components/SystemDevLogHeader';
import { ExecutionLogView } from '@/components/ExecutionLogView';
import { ConsoleLogView } from '@/components/ConsoleLogView';
import { NetworkLogView } from '@/components/NetworkLogView';
import { SystemDevLogFullscreen } from '@/components/SystemDevLogFullscreen';
import { SyncedVideoEventsPanel } from '@/components/SyncedVideoEventsPanel';
import { RecordingVideoPanel } from '@/components/RecordingVideoPanel';
import { RecordingEvidencePanel } from '@/components/RecordingEvidencePanel';
import { DevLogGuide } from '@/components/DevLogGuide';

import {
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
  const [hasUnsavedComment, setHasUnsavedComment] = useState(false);
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
  const videoProcessingPercent = typeof manualRecording?.video?.processingPercent === 'number'
    ? Math.max(0, Math.min(100, manualRecording.video.processingPercent))
    : null;
  const recordingVideoKey = `${manualRecording?.sessionId ?? 'none'}:${manualRecording?.video?.url ?? 'none'}:${manualRecordingVideoStatus ?? 'none'}`;
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
  const measuredRecordingVideoDurationMs = recordingVideoDurationMs?.key === recordingVideoKey
    ? recordingVideoDurationMs.durationMs
    : 0;
  const isVideoPlaybackReady = hasManualRecordingVideo
    && !isVideoFinalizing
    && measuredRecordingVideoDurationMs > 0;
  const isVideoLoading = hasManualRecordingVideo && !isVideoPlaybackReady;
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
    const video = event.currentTarget;
    const seekableDuration = video.seekable.length > 0
      ? video.seekable.end(video.seekable.length - 1)
      : 0;
    const durationSeconds = Number.isFinite(video.duration) && video.duration > 0
      ? video.duration
      : seekableDuration;
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
    if (isVideoLoading) return;
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

  const manualCaptureCommandProps = {
    socketReady, manualCaptureSessionId, isManualCaptureActive, manualCaptureMode, setManualCaptureMode,
    isStartingManualCapture, manualCaptureBrowserMode, setManualCaptureBrowserMode,
    manualCaptureTargetUrl, setManualCaptureTargetUrl, isStoppingManualCapture, stopManualCapture,
    startManualCapture, captureScriptTag,
  };

  const manualRecordingPreviewProps = {
    manualRecording, hasManualRecordingVideo, manualRecordingVideoUrl, recordingVideoKey, recordingVideoRef,
    handleRecordingVideoLoadedMetadata, selectedRecordingFrame, isVideoLoading, isVideoPlaybackReady,
    handleFullscreenVideoTimeUpdate, videoProcessingPercent, isVideoFinalizing, manualRecordingMode,
    manualRecordingFrames, manualRecordingVideoStatus, recordingDisplayMs, recordingSeekApprox,
    openRecordingFullscreen, manualRecordingTargetUrl, setRecordingSeekMs, setRecordingSeekApprox,
    formatRelativeTime,
  };

  const systemDevLogHeaderProps = {
    socketReady, openSystemDevLogFullscreen, isSummarizing, generateAISummary,
    activeDevLogTab, setActiveDevLogTab, groupedConsoleLogs, groupedNetworkLogs,
    loadedRunLabel, loadCurrentLogRun, isLoadingHistory, loadLogHistory, clearLogs,
  };

  const systemDevLogFullscreenProps = {
    isSystemDevLogFullscreen, activeDevLogTab, fullscreenNetworkGroups, fullscreenConsoleGroups, viewTestCase,
    setActiveDevLogTab, setSelectedSystemDevLogId, selectedSystemDevLogId, setIsSystemDevLogFullscreen,
    fullscreenLogFilter, setFullscreenLogFilter, networkCodeWrap, setNetworkCodeWrap, closeSystemDevLogFullscreen,
    selectedSystemNetworkGroup, selectedSystemConsoleGroup, formatRelativeTime, getNetworkMethod,
    getNetworkCategoryClass, getNetworkStatusClass, getNetworkStatus, getNetworkDuration,
    networkCodePanelClass, networkFullscreenCodePanelClass, networkCodeWhitespaceClass, formatPrettyValue,
    getRequestPayload, getResponsePayload, seekRecordingFromLog, getConsoleLogText,
  };

  const recordingVideoPanelProps = {
    recordingDisplayMs, recordingSeekApprox, manualRecordingTargetUrl, isVideoLoading,
    hasManualRecordingVideo, manualRecordingVideoUrl, recordingVideoKey, recordingVideoRef,
    isVideoPlaybackReady, handleRecordingVideoLoadedMetadata, handleFullscreenVideoTimeUpdate,
    videoProcessingPercent, isVideoFinalizing, manualRecordingFrames, selectedRecordingFrame,
    recordingSeekMs, openRecordingFullscreen, setRecordingSeekApprox, formatRelativeTime,
    updateRecordingZoom, recordingZoom, recordingViewportRef, startRecordingPan, moveRecordingPan,
    stopRecordingPan, fullscreenRecordingVideoRef, currentSyncedVideoEvent, getSyncedEventSeverityClass,
    manualRecordingMode, scrollFullscreenTimeline, groupedSyncedVideoMarkers, selectedSyncedEventId,
    getSyncedMarkerClass, seekRecordingFromSyncedEvent, fullscreenTimelineRef, handleTimelineWheel,
    setRecordingSeekMs,
  };

  const recordingEvidencePanelProps = {
    isClosingRecordingFullscreen, activeDevLogTab, setActiveDevLogTab, fullscreenLogFilter,
    setFullscreenLogFilter, selectedFullscreenLog, setSelectedFullscreenLog, networkCodeWrap,
    setNetworkCodeWrap, copyFullscreenEvidence, copiedEvidence, fullscreenNetworkGroups,
    fullscreenConsoleGroups, getNetworkMethod, getNetworkCategoryClass, getNetworkStatusClass,
    getNetworkStatus, getNetworkDuration, formatLogRecordingTime, formatRelativeTime,
    selectFullscreenNetworkLog, selectFullscreenConsoleLog, networkCodeWhitespaceClass,
    networkFullscreenCodePanelClass, networkCodePanelClass, formatPrettyValue, getRequestPayload,
    getResponsePayload, selectedSyncedVideoEventDetail, selectedSyncedVideoEvent,
    getSyncedEventSeverityClass, filteredSyncedVideoEvents, syncedVideoEvents, syncedEventFilters,
    toggleSyncedEventFilter, selectedSyncedEventId, seekRecordingFromSyncedEvent,
    seekRecordingFromLog, getConsoleLogText, groupedSyncedVideoMarkers, setSelectedSyncedEventId,
    currentSyncedVideoEvent, getSyncedMarkerClass, scrollFullscreenTimeline, fullscreenTimelineRef,
    handleTimelineWheel, isRecordingFullscreenExpanded, selectedRecordingFrame, manualRecording,
    hasManualRecordingVideo, syncedNetworkLogIdSet, fullscreenNetworkRowRefs, setExpandedLogId,
    expandedLogId,
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (!nextOpen && hasUnsavedComment && !window.confirm('Komentar belum disimpan. Tutup detail dan buang draft?')) return;
      onOpenChange(nextOpen);
    }}>
      <DialogContent
        overlayClassName="bg-black/25 backdrop-blur-[2px]"
        className={cn(
          "signal-surface test-case-detail-dialog inset-y-0 !left-auto !right-0 h-dvh max-h-dvh w-screen !max-w-none !translate-x-0 translate-y-0 flex flex-col gap-0 overflow-hidden rounded-none border-y-0 border-r-0 border-l border-border/60 bg-card p-0 text-foreground shadow-2xl data-[state=open]:slide-in-from-right-full data-[state=closed]:slide-out-to-right-full lg:w-[72vw] lg:min-w-[760px] lg:max-w-[1100px]",
          isSystemDevLogFullscreen
            ? "left-[50%] right-auto top-[50%] h-screen max-h-screen w-screen max-w-none translate-x-[-50%] translate-y-[-50%] rounded-none border-0 sm:top-[50%] sm:max-h-screen sm:max-w-none"
            : isRecordingFullscreen
              ? "w-[96vw] sm:max-w-[96vw]"
              : "rounded-2xl"
        )}
      >
        <TestCaseDetailDialogHeader
          viewTestCase={viewTestCase}
          testCaseList={testCaseList}
          navigationIndex={navigationIndex}
          onNavigate={onNavigate}
          getStatusIcon={getStatusIcon}
          getStatusBadgeVariant={getStatusBadgeVariant}
        />

        {viewTestCase && (
          <div className="min-h-0 flex-1 overflow-hidden outline-none">
            <div className="flex h-full min-h-0 flex-col p-4 pt-3 sm:p-6 sm:pt-4">
              <Tabs value={activeMainTab} onValueChange={setActiveMainTab} className="min-h-0 w-full flex-1 gap-0">
                <div className="sticky top-0 z-10 mb-4 w-full shrink-0 overflow-x-auto rounded-xl bg-card pb-1 scrollbar-thin scrollbar-thumb-border/40 scrollbar-track-transparent">
                  <TabsList className="flex h-auto w-max min-w-full justify-start gap-1 rounded-xl border border-border/60 bg-secondary/50 p-1">
                  <TabsTrigger value="details" className="min-w-max flex-none gap-2">
                    <ClipboardList className="w-4 h-4" /> Overview
                  </TabsTrigger>
                  <TabsTrigger value="steps" className="min-w-max flex-none gap-2">
                    <ListChecks className="w-4 h-4" /> Steps
                  </TabsTrigger>
                  {isBugFixDetail && (
                    <TabsTrigger value="lifecycle" className="min-w-max flex-none gap-2">
                      <History className="w-4 h-4" /> Lifecycle
                    </TabsTrigger>
                  )}
                  <TabsTrigger value="traceability" className="min-w-max flex-none gap-2">
                    <Link2 className="w-4 h-4" /> Traceability
                  </TabsTrigger>
                  <TabsTrigger value="execution" className="min-w-max flex-none gap-2">
                    <PlayCircle className="w-4 h-4" /> Execution
                  </TabsTrigger>
                  <TabsTrigger value="evidence" className="min-w-max flex-none gap-2">
                    <Paperclip className="w-4 h-4" /> Evidence
                  </TabsTrigger>
                  <TabsTrigger value="bugs" className="min-w-max flex-none gap-2"><Bug className="w-4 h-4" /> Bugs</TabsTrigger>
                  <TabsTrigger value="history" className="min-w-max flex-none gap-2"><History className="w-4 h-4" /> History</TabsTrigger>
                  <TabsTrigger value="comments" className="min-w-max flex-none gap-2">
                    <MessageSquare className="w-4 h-4" /> Comments
                  </TabsTrigger>
                  <TabsTrigger value="logs" className="min-w-max flex-none gap-2">
                    <div className="relative">
                      <Wrench className="w-4 h-4" />
                      {socketReady && (
                        <span className="absolute -top-1 -right-1 flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                      )}
                    </div>
                    Automation
                  </TabsTrigger>
                </TabsList>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto pr-1 outline-none scrollbar-thin scrollbar-thumb-border/40 scrollbar-track-transparent">
                  <AnimatePresence mode="wait">
                  {activeMainTab === 'details' && (
                    <TestCaseDetailsTab
                      viewTestCase={viewTestCase}
                      onCopyId={onCopyId}
                      getTestTypeColor={getTestTypeColor}
                      getPriorityColor={getPriorityColor}
                    />
                  )}
                  {activeMainTab === 'steps' && (
                    <motion.div key="steps" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }} className="grid gap-4 md:grid-cols-2">
                      <section className="rounded-xl border border-border/70 bg-secondary/20 p-5"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Test steps</p><pre className="mt-4 whitespace-pre-wrap font-sans text-sm leading-7 text-foreground">{viewTestCase.steps || '—'}</pre></section>
                      <section className="rounded-xl border border-border/70 bg-secondary/20 p-5"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Expected result</p><p className="mt-4 text-sm leading-7 text-foreground">{viewTestCase.expectedResult || '—'}</p></section>
                    </motion.div>
                  )}
                  {isBugFixDetail && activeMainTab === 'lifecycle' && (
                    <TestCaseLifecycleTab
                      viewTestCase={viewTestCase}
                      lifecycleItems={lifecycleItems}
                      lifecycleIndex={lifecycleIndex}
                      getStatusIcon={getStatusIcon}
                      getStatusBadgeVariant={getStatusBadgeVariant}
                      formatDateTime={formatDateTime}
                    />
                  )}
                  {activeMainTab === 'traceability' && (
                    <TestCaseTraceabilityTab projectId={viewTestCase.projectId} testCaseId={viewTestCase.id} />
                  )}
                  {activeMainTab === 'execution' && (
                    <TestCaseExecutionTab projectId={viewTestCase.projectId} testCaseId={viewTestCase.id} />
                  )}
                  {activeMainTab === 'evidence' && (
                    <TestCaseEvidenceTab projectId={viewTestCase.projectId} testCaseId={viewTestCase.id} />
                  )}
                  {activeMainTab === 'bugs' && (
                    <TestCaseBugsTab projectId={viewTestCase.projectId} testCaseId={viewTestCase.id} />
                  )}
                  {activeMainTab === 'history' && (
                    <TestCaseHistoryTab projectId={viewTestCase.projectId} testCaseId={viewTestCase.id} />
                  )}
                  {activeMainTab === 'comments' && (
                    <TestCaseCommentsTab key={viewTestCase.id} projectId={viewTestCase.projectId} testCaseId={viewTestCase.id} onDirtyChange={setHasUnsavedComment} />
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
                          <DevLogGuide expandedGuide={expandedGuide} setExpandedGuide={setExpandedGuide} />

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
                                            "mb-1.5 rounded-xl border border-border/40 bg-card/60 transition duration-200",
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
                                          className="h-9 border-border/60 bg-background/80 pl-9 text-[11px] font-medium text-foreground placeholder:text-muted-foreground/50 rounded-xl focus-visible:ring-primary/20 transition duration-200"
                                        />
                                      </div>
                                      <select
                                        value={networkFilters.host}
                                        onChange={(event) => updateNetworkFilters({ host: event.target.value })}
                                        className="h-9 min-w-[160px] rounded-xl border border-border/60 bg-background/80 px-3 text-[11px] font-bold text-foreground outline-none focus:ring-2 focus:ring-primary/10 transition duration-200"
                                      >
                                        <option value="all">All hosts ({networkLogItems.length})</option>
                                        {networkHosts.map((host) => (
                                          <option key={host} value={host}>{host}</option>
                                        ))}
                                      </select>
                                      <select
                                        value={networkFilters.method}
                                        onChange={(event) => updateNetworkFilters({ method: event.target.value })}
                                        className="h-9 rounded-xl border border-border/60 bg-background/80 px-3 text-[11px] font-bold text-foreground outline-none focus:ring-2 focus:ring-primary/10 transition duration-200"
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
                                            "h-7 rounded-lg border px-3 text-[10px] font-bold transition duration-200",
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

                          <ManualCaptureCommand {...manualCaptureCommandProps} />

                          <ManualRecordingPreview {...manualRecordingPreviewProps} />{/*
                                      Memproses video{videoProcessingPercent !== null && isVideoFinalizing ? ` — ${videoProcessingPercent}%` : ''}

                          */}
                          <SystemDevLogHeader {...systemDevLogHeaderProps} />

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
                                <ExecutionLogView stepLogs={viewTestCase.stepLogs} logEndRef={logEndRef} />
                              ) : activeDevLogTab === 'console' ? (
                                <ConsoleLogView
                                  groupedConsoleLogs={groupedConsoleLogs}
                                  logEndRef={logEndRef}
                                  expandedLogId={expandedLogId}
                                  setExpandedLogId={setExpandedLogId}
                                  seekRecordingFromLog={seekRecordingFromLog}
                                  formatRelativeTime={formatRelativeTime}
                                  getConsoleLogText={getConsoleLogText}
                                  formatPrettyValue={formatPrettyValue}
                                />
                              ) : (
                                <NetworkLogView
                                  networkFilters={networkFilters}
                                  updateNetworkFilters={updateNetworkFilters}
                                  networkLogItems={networkLogItems}
                                  networkHosts={networkHosts}
                                  networkMethods={networkMethods}
                                  setNetworkFilters={setNetworkFilters}
                                  DEFAULT_NETWORK_FILTERS={DEFAULT_NETWORK_FILTERS}
                                  networkCategoryCounts={networkCategoryCounts}
                                  hiddenNetworkCount={hiddenNetworkCount}
                                  toggleNetworkFilter={toggleNetworkFilter}
                                  groupedNetworkLogs={groupedNetworkLogs}
                                  logEndRef={logEndRef}
                                  seekRecordingFromLog={seekRecordingFromLog}
                                  expandedLogId={expandedLogId}
                                  setExpandedLogId={setExpandedLogId}
                                  getNetworkMethod={getNetworkMethod}
                                  getNetworkCategoryClass={getNetworkCategoryClass}
                                  getNetworkStatusClass={getNetworkStatusClass}
                                  getNetworkStatus={getNetworkStatus}
                                  getNetworkDuration={getNetworkDuration}
                                  formatRelativeTime={formatRelativeTime}
                                  networkCodeWhitespaceClass={networkCodeWhitespaceClass}
                                  networkCodePanelClass={networkCodePanelClass}
                                  formatPrettyValue={formatPrettyValue}
                                  getRequestPayload={getRequestPayload}
                                  getResponsePayload={getResponsePayload}
                                />
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
                </div>
              </Tabs>
            </div>
          </div>
        )}

        <SystemDevLogFullscreen {...systemDevLogFullscreenProps} />
          {/*
                      {viewTestCase?.testCaseId || '-'} · {viewTestCase?.testAction || 'Execution telemetry'}
        */}
        {isRecordingFullscreen && (manualRecording?.frames?.length || hasManualRecordingVideo) && (
          <div
            className={cn(
              "fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4 text-foreground transition-opacity duration-200",
              isClosingRecordingFullscreen ? 'opacity-0' : 'opacity-100'
            )}
          >
            <div
              className={cn(
                "relative flex h-full w-full max-w-[96vw] overflow-hidden rounded-2xl border border-border bg-background shadow-2xl transition duration-200 ease-out",
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
                  <RecordingVideoPanel {...recordingVideoPanelProps} />
                  <ResizableHandle withHandle />
            <RecordingEvidencePanel {...recordingEvidencePanelProps} />{/*
                              {selectedFullscreenLog.kind} · {formatRelativeTime(selectedFullscreenLog.relativeMs)}
                */}
                </ResizablePanelGroup>
              )}
            </div>
          </div>
        )}

        <TestCaseDetailDialogFooter
          viewTestCase={viewTestCase}
          isBugFixDetail={isBugFixDetail}
          onOpenChange={onOpenChange}
          onEdit={onEdit}
          onRefine={onRefine}
          openEvidenceReport={openEvidenceReport}
        />
      </DialogContent>
    </Dialog>
  );
}
