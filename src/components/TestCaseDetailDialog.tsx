'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MutationAction } from '@/components/WorkspaceAccess';
import { useCommittedActions } from '@/hooks/use-committed-actions';
import { createPortal } from 'react-dom';
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
import { useWorkspaceAccess } from '@/components/WorkspaceAccess';
import type { GuestPermission } from '@/lib/domain/guest-access';
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
import { PlaywrightScriptPanel, scriptArtifactUrl, type ScriptRun } from '@/components/PlaywrightScriptPanel';
import type { AutomationLogEntry } from '@/hooks/useAutomationLogs';

import {
  DEFAULT_NETWORK_FILTERS,
  escapeHtml,
  formatDateTime,
  formatPrettyValue,
  getBugLifecycleItems,
  getConsoleLogText,
  getImageDataUrl,
  isExecutionLog,
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

const EMPTY_LOGS: LogEntry[] = [];
const formatRelativeTime = (relativeMs?: number) => {
    if (typeof relativeMs !== 'number') return '-';
    const safeMs = Math.max(0, Math.round(relativeMs));
    const totalSeconds = Math.floor(safeMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
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
    if (typeof network.status !== 'number') return 'bg-muted text-muted-foreground dark:bg-slate-800 dark:text-muted-foreground';
    return network.status < 400
      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-status-passed'
      : 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-status-failed';
  };
const getNetworkDuration = (network: NonNullable<LogEntry['network']>) => (
    typeof network.duration === 'number' ? `${network.duration}ms` : '-'
  );

export function TestCaseDetailDialog({
  open,
  onOpenChange,
  viewTestCase,
  socketReady,
  liveLogs: captureLiveLogs,
  activeDevLogTab,
  expandedLogId,
  isLoadingHistory,
  loadedRunLabel,
  aiSummary,
  isSummarizing,
  manualCaptureTargetUrl,
  manualCaptureSessionId,
  manualRecording: captureRecording,
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
  const { guest, canAdmin } = useWorkspaceAccess();
  const [scriptSelection, setScriptSelection] = useState<{ testCaseId: string; runId: string; artifactId?: string; logs: AutomationLogEntry[]; recording: ManualRecordingMeta | null } | null>(null);
  const [scriptDraftState, setScriptDraftState] = useState<{ testCaseId: string; dirty: boolean } | null>(null);
  const hasUnsavedScript = scriptDraftState?.testCaseId === viewTestCase?.id && scriptDraftState?.dirty;
  const setHasUnsavedScript = useCallback((dirty: boolean) => setScriptDraftState({ testCaseId: viewTestCase?.id || '', dirty }), [viewTestCase?.id]);
  const selectedScript = scriptSelection?.testCaseId === viewTestCase?.id ? scriptSelection : null;
  const liveLogs: LogEntry[] = selectedScript?.logs || captureLiveLogs;
  const manualRecording = selectedScript ? selectedScript.recording : captureRecording;
  const inspectScriptRun = (run: ScriptRun, logs: AutomationLogEntry[], artifactId?: string, activate = false) => {
    if (!viewTestCase) return;
    setScriptSelection(previous => {
      if (!activate && (previous?.runId !== run.runId || previous.testCaseId !== viewTestCase.id)) return previous;
      const selectedId = artifactId || (previous?.runId === run.runId ? previous.artifactId : undefined);
      const video = run.artifacts.find(item => item.id === selectedId && item.kind === 'video') || run.artifacts.find(item => item.kind === 'video');
      const videoStart = video?.startedAtRelativeMs ?? logs.find(item => item.event === 'video.started')?.relativeMs;
      return { testCaseId: viewTestCase.id, runId: run.runId, artifactId: video?.id, logs,
        recording: video ? { mode: 'video', sessionId: run.runId, testCaseId: viewTestCase.id, targetUrl: 'Playwright script', startedAt: run.startedAt || run.createdAt,
          stoppedAt: run.endedAt, frameIntervalMs: 0, status: 'stopped', frames: [], video: { file: video.name, url: scriptArtifactUrl(viewTestCase.projectId, viewTestCase.id, run.runId, video.id), mimeType: 'video/webm', status: 'ready', startedAtRelativeMs: videoStart || 0, durationMs: run.durationMs, sizeBytes: video.size } } : null };
    });
  };
  useEffect(() => {
    if (!hasUnsavedScript) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasUnsavedScript]);
  const canInspect = (tab: string) => {
    if (!guest || tab === 'details' || tab === 'steps' || tab === 'lifecycle') return true;
    const permissions: Record<string, GuestPermission[]> = { traceability: ['traceability.view'], execution: ['traceability.view', 'runs.view'], evidence: ['traceability.view', 'evidence.view'], bugs: ['traceability.view', 'bugs.view'], history: ['history.view'], comments: ['history.view'] };
    return Boolean(permissions[tab]?.every(permission => guest.permissions.includes(permission)));
  };
  const inspectorSurface = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const [contentReady, setContentReady] = useState(false);
  const [previousOpen, setPreviousOpen] = useState(open);
  if (previousOpen !== open) {
    setPreviousOpen(open);
    setContentReady(false);
  }
  useEffect(() => {
    if (!open) return;
    let canceled = false;
    const frame = requestAnimationFrame(() => {
      // Wait for the real shell animation, not a guessed loading timeout.
      // No animations (including reduced motion) means content is ready now.
      const animations = inspectorSurface.current?.getAnimations().filter(animation => animation.playState === 'running') || [];
      void Promise.allSettled(animations.map(animation => animation.finished)).then(() => {
        if (!canceled) setContentReady(true);
      });
    });
    return () => { canceled = true; cancelAnimationFrame(frame); };
  }, [open]);
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
  // Live capture continues in the hook. Transform its buffered data only when
  // the Automation UI is visible; overview/history do not need recording work.
  const visibleLogs = open && contentReady && activeMainTab === 'logs' ? liveLogs : EMPTY_LOGS;
  const consoleLogs = useMemo(() => filterConsoleLogs(visibleLogs), [filterConsoleLogs, visibleLogs]);
  const groupedConsoleLogs = useMemo(() => groupConsoleLogs(consoleLogs), [consoleLogs]);
  const executionLogs = useMemo(() => visibleLogs.filter(isExecutionLog), [visibleLogs]);
  const navigationIndex = useMemo(() => {
    if (!testCaseList?.length || !viewTestCase) return -1;
    return testCaseList.findIndex(tc => tc.id === viewTestCase.id);
  }, [testCaseList, viewTestCase]);
  const rawNetworkLogs = useMemo(() => (
    visibleLogs.filter((log) => log.isNetwork || Boolean(log.network))
  ), [visibleLogs]);
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
  const selectedSystemExecutionLog = useMemo(() => (
    selectedSystemDevLogId
      ? executionLogs.find((log, index) => `system-execution-${log.eventId || log.id || index}` === selectedSystemDevLogId) ?? null
      : null
  ), [executionLogs, selectedSystemDevLogId]);
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
    const values = visibleLogs
      .map((log) => normalizedLogRelativeMs(log.relativeMs))
      .filter((value): value is number => typeof value === 'number');
    if (!values.length) return { min: 0, max: 0 };
    return {
      min: Math.max(0, Math.min(...values) - 10000),
      max: Math.max(...values),
    };
  }, [visibleLogs]);
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
    buildSyncedVideoEvents(visibleLogs, manualRecording, {
      measuredDurationMs: recordingVideoDurationMs?.key === recordingVideoKey ? recordingVideoDurationMs.durationMs : undefined,
    })
      .filter((event) => typeof event.clampedOffsetMs === 'number')
      .slice(0, 80)
  ), [visibleLogs, manualRecording, recordingVideoDurationMs, recordingVideoKey]);
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
      const durationMs = Math.round(durationSeconds * 1000);
      setRecordingVideoDurationMs(current => current?.key === recordingVideoKey && current.durationMs === durationMs
        ? current : { key: recordingVideoKey, durationMs });
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

  const enterBrowserFullscreen = () => {
    if (typeof document === 'undefined' || document.fullscreenElement || typeof document.documentElement.requestFullscreen !== 'function') return;
    void document.documentElement.requestFullscreen().catch(() => undefined);
  };

  const exitBrowserFullscreen = () => {
    if (typeof document === 'undefined' || !document.fullscreenElement || typeof document.exitFullscreen !== 'function') return;
    void document.exitFullscreen().catch(() => undefined);
  };

  const openRecordingFullscreen = () => {
    if (isVideoLoading) return;
    enterBrowserFullscreen();
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
    exitBrowserFullscreen();
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
    window.location.href = `/api/evidence?testCaseId=${encodeURIComponent(viewTestCase.id)}&projectId=${encodeURIComponent(viewTestCase.projectId)}&download=1`;
  };
  const seekRecordingFromSyncedEvent = (event: SyncedVideoEvent) => {
    if (typeof event.clampedOffsetMs !== 'number') return;
    setSelectedSyncedEventId(event.id);
    setRecordingSeekMs(event.clampedOffsetMs);
    setRecordingSeekApprox(event.isBeforeVideo || event.isAfterVideo);
    if (manualRecording?.video && hasManualRecordingVideo) {
      const durationSeconds = getRecordingVideoDurationMs() / 1000;
      const targetSeconds = Math.max(0, Math.min(durationSeconds || Number.POSITIVE_INFINITY, event.clampedOffsetMs / 1000));
      for (const player of [recordingVideoRef.current, fullscreenRecordingVideoRef.current]) {
        if (!player) continue;
        try {
          player.currentTime = targetSeconds;
        } catch {}
      }
    }

    const sourceLog = event.originalEvent as unknown as LogEntry;
    const matchesSourceLog = (candidate: LogEntry) => (
      candidate === sourceLog
      || Boolean(sourceLog.eventId && candidate.eventId === sourceLog.eventId)
      || Boolean(sourceLog.id && candidate.id === sourceLog.id)
    );

    if (sourceLog.network || event.category.startsWith('api.')) {
      if (!sourceLog.network) return;
      const matchingGroup = fullscreenNetworkGroups.find((group) => (
        group.entries.some((entry) => matchesSourceLog(entry.log))
      ));
      const logId = matchingGroup ? `fullscreen-${matchingGroup.id}` : `fullscreen-event-${event.id}`;
      setActiveDevLogTab('network');
      selectFullscreenNetworkLog(
        sourceLog as LogEntry & { network: NonNullable<LogEntry['network']> },
        getNetworkMeta(sourceLog.network),
        logId
      );
      window.setTimeout(() => {
        fullscreenNetworkRowRefs.current.get(logId)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }, 0);
      return;
    }

    if (event.category.startsWith('console.') || event.category === 'javascript.error' || sourceLog.isConsole) {
      const matchingGroup = fullscreenConsoleGroups.find((group) => (
        group.entries.some(matchesSourceLog)
      ));
      const logId = matchingGroup ? `fullscreen-${matchingGroup.id}` : `fullscreen-event-${event.id}`;
      setActiveDevLogTab('console');
      selectFullscreenConsoleLog(sourceLog, logId);
      return;
    }

    setActiveDevLogTab('execution');
    setSelectedFullscreenLog({
      id: `fullscreen-execution-${event.id}`,
      kind: 'execution',
      relativeMs: event.clampedOffsetMs,
      text: event.summary,
      detail: {
        category: event.category,
        severity: event.severity,
        label: event.label,
        timestamp: event.eventTimestampMs ? new Date(event.eventTimestampMs).toISOString() : '-',
        offset: formatRelativeTime(event.clampedOffsetMs),
        message: event.summary,
        metadata: sourceLog.metadata,
      },
    });
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

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!isRecordingFullscreen || document.fullscreenElement) return;
      clearRecordingFullscreenTimer();
      setIsRecordingFullscreen(false);
      setIsRecordingFullscreenExpanded(false);
      setIsRecordingFullscreenContentVisible(false);
      setIsClosingRecordingFullscreen(false);
      setSyncedNetworkLogIds([]);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [isRecordingFullscreen]);

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
    socketReady: !selectedScript && socketReady, scriptMode: Boolean(selectedScript), openSystemDevLogFullscreen, isSummarizing, generateAISummary,
    activeDevLogTab, setActiveDevLogTab, groupedConsoleLogs, groupedNetworkLogs,
    loadedRunLabel, loadCurrentLogRun, isLoadingHistory, loadLogHistory, clearLogs,
  };

  const logActions = useCommittedActions({ seekRecordingFromLog, updateNetworkFilters, toggleNetworkFilter });

  const systemDevLogFullscreenProps = {
    isSystemDevLogFullscreen, activeDevLogTab, fullscreenNetworkGroups, fullscreenConsoleGroups, executionLogs, viewTestCase, evidenceLogs: liveLogs,
    setActiveDevLogTab, setSelectedSystemDevLogId, selectedSystemDevLogId, setIsSystemDevLogFullscreen,
    fullscreenLogFilter, setFullscreenLogFilter, networkCodeWrap, setNetworkCodeWrap, closeSystemDevLogFullscreen,
    selectedSystemNetworkGroup, selectedSystemConsoleGroup, selectedSystemExecutionLog, formatRelativeTime, getNetworkMethod,
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
    isClosingRecordingFullscreen, activeDevLogTab, setActiveDevLogTab, fullscreenLogFilter, evidenceLogs: liveLogs,
    setFullscreenLogFilter, selectedFullscreenLog, setSelectedFullscreenLog, networkCodeWrap,
    setNetworkCodeWrap, copyFullscreenEvidence, copiedEvidence, fullscreenNetworkGroups,
    fullscreenConsoleGroups, executionLogs, getNetworkMethod, getNetworkCategoryClass, getNetworkStatusClass,
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
      if (!nextOpen && (hasUnsavedComment || hasUnsavedScript) && !window.confirm('Ada draft yang belum disimpan ke server. Tetap tutup detail? Draft script disimpan lokal jika penyimpanan browser tersedia.')) return;
      onOpenChange(nextOpen);
    }}>
      <DialogContent
        ref={inspectorSurface}
        onEscapeKeyDown={(event) => {
          if (isSystemDevLogFullscreen) { event.preventDefault(); closeSystemDevLogFullscreen(); }
          else if (isRecordingFullscreen) { event.preventDefault(); closeRecordingFullscreen(); }
        }}
        overlayClassName="qa-inspector-overlay bg-black/35"
        onOpenAutoFocus={() => {
          const focused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
          const labels = [`Actions for ${viewTestCase?.testCaseId}`, `View bug ${viewTestCase?.testCaseId}`, `View run ${viewTestCase?.testCaseId}`];
          returnFocus.current = focused && focused !== document.body && focused.getAttribute('role') !== 'menuitem'
            ? focused
            : Array.from(document.querySelectorAll<HTMLElement>('button[aria-label]')).find(element => labels.includes(element.getAttribute('aria-label') || '')) || null;
        }}
        onCloseAutoFocus={event => {
          event.preventDefault();
          // Do not steal focus from a form opened by Edit/Refine.
          if (!document.querySelector('[role="dialog"][data-state="open"]') && returnFocus.current?.isConnected) returnFocus.current.focus();
        }}
        className={cn(
          "signal-surface test-case-detail-dialog inset-y-0 !top-0 !left-auto !right-0 h-dvh max-h-dvh w-full max-w-none sm:max-w-none !translate-none flex flex-col gap-0 overflow-hidden rounded-none border-y-0 border-r-0 border-l border-border/60 bg-card p-0 text-foreground shadow-2xl data-[state=open]:slide-in-from-right-full data-[state=closed]:slide-out-to-right-full data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-100 lg:w-[72vw] lg:min-w-[760px] lg:max-w-[1100px]",
          isSystemDevLogFullscreen
            ? "w-full max-w-none rounded-none border-0 lg:w-full lg:min-w-0 lg:max-w-none"
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
          onCopyId={onCopyId}
          getStatusIcon={getStatusIcon}
          getStatusBadgeVariant={getStatusBadgeVariant}
        />

        {viewTestCase && (
          <div className="min-h-0 flex-1 overflow-hidden outline-none">
            <div className="flex h-full min-h-0 flex-col p-4 pt-3 sm:p-6 sm:pt-4">
              <Tabs value={canInspect(activeMainTab) ? activeMainTab : 'details'} onValueChange={setActiveMainTab} className="min-h-0 w-full flex-1 gap-0">
                <div className="sticky top-0 z-10 mb-4 w-full shrink-0 overflow-x-auto rounded-xl bg-card pb-1 scrollbar-thin scrollbar-thumb-border/40 scrollbar-track-transparent">
                  <TabsList aria-label="Bagian detail testcase" className="qa-inspector-tabs flex h-auto w-max min-w-full justify-start gap-1 border border-border bg-muted p-1">
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
                  <TabsTrigger disabled={!canInspect('traceability')} value="traceability" className="min-w-max flex-none gap-2">
                    <Link2 className="w-4 h-4" /> Traceability
                  </TabsTrigger>
                  <TabsTrigger disabled={!canInspect('execution')} value="execution" className="min-w-max flex-none gap-2">
                    <PlayCircle className="w-4 h-4" /> Execution
                  </TabsTrigger>
                  <TabsTrigger disabled={!canInspect('evidence')} value="evidence" className="min-w-max flex-none gap-2">
                    <Paperclip className="w-4 h-4" /> Evidence
                  </TabsTrigger>
                  <TabsTrigger disabled={!canInspect('bugs')} value="bugs" className="min-w-max flex-none gap-2"><Bug className="w-4 h-4" /> Bugs</TabsTrigger>
                  <TabsTrigger disabled={!canInspect('history')} value="history" className="min-w-max flex-none gap-2"><History className="w-4 h-4" /> History</TabsTrigger>
                  <TabsTrigger disabled={!canInspect('comments')} value="comments" className="min-w-max flex-none gap-2">
                    <MessageSquare className="w-4 h-4" /> Comments
                  </TabsTrigger>
                  {!guest && <TabsTrigger value="logs" className="min-w-max flex-none gap-2">
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
                  </TabsTrigger>}
                </TabsList>
                </div>
                <p className="py-2 text-xs leading-5 text-muted-foreground">Geser tab untuk melihat bagian lainnya, atau gunakan tombol panah saat tab terfokus.</p>

                <div className="min-h-0 flex-1 overflow-y-auto pr-1 outline-none scrollbar-thin scrollbar-thumb-border/40 scrollbar-track-transparent">
                  {!contentReady && <div className="space-y-4 py-1" role="status" aria-label="Memuat detail testcase"><div className="h-24 rounded-xl bg-secondary/40" /><div className="h-40 rounded-xl bg-secondary/40" /></div>}
                  {contentReady && <>
                  {/* Radix owns tab unmounting. An outer exit wait can deadlock
                      when Radix removes the nested motion node before its exit completes. */}
                  {activeMainTab === 'details' && (
                    <TestCaseDetailsTab
                      viewTestCase={viewTestCase}
                      onCopyId={onCopyId}
                      getTestTypeColor={getTestTypeColor}
                      getPriorityColor={getPriorityColor}
                    />
                  )}
                  {activeMainTab === 'steps' && (
                    <TabsContent value="steps" className="mt-0 outline-none">
                    <motion.div key="steps" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }} className="grid gap-4 md:grid-cols-2">
                      <section className="rounded-xl border border-border/70 bg-secondary/20 p-5"><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Test steps</p><pre className="mt-4 whitespace-pre-wrap font-sans text-sm leading-7 text-foreground">{viewTestCase.steps || '—'}</pre></section>
                      <section className="rounded-xl border border-border/70 bg-secondary/20 p-5"><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Expected result</p><p className="mt-4 text-sm leading-7 text-foreground">{viewTestCase.expectedResult || '—'}</p></section>
                    </motion.div>
                    </TabsContent>
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
                  {canInspect('traceability') && activeMainTab === 'traceability' && (
                    <TestCaseTraceabilityTab projectId={viewTestCase.projectId} testCaseId={viewTestCase.id} />
                  )}
                  {canInspect('execution') && activeMainTab === 'execution' && (
                    <TestCaseExecutionTab projectId={viewTestCase.projectId} testCaseId={viewTestCase.id} />
                  )}
                  {canInspect('evidence') && activeMainTab === 'evidence' && (
                    <TestCaseEvidenceTab projectId={viewTestCase.projectId} testCaseId={viewTestCase.id} />
                  )}
                  {canInspect('bugs') && activeMainTab === 'bugs' && (
                    <TestCaseBugsTab projectId={viewTestCase.projectId} testCaseId={viewTestCase.id} />
                  )}
                  {canInspect('history') && activeMainTab === 'history' && (
                    <TestCaseHistoryTab projectId={viewTestCase.projectId} testCaseId={viewTestCase.id} />
                  )}
                  {canInspect('comments') && activeMainTab === 'comments' && (
                    <TestCaseCommentsTab key={viewTestCase.id} projectId={viewTestCase.projectId} testCaseId={viewTestCase.id} onDirtyChange={setHasUnsavedComment} />
                  )}
                  {!guest && activeMainTab === 'logs' && (
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
                          {canAdmin && <PlaywrightScriptPanel key={viewTestCase.id} projectId={viewTestCase.projectId} testCaseId={viewTestCase.id} onInspect={inspectScriptRun} onDirtyChange={setHasUnsavedScript} />}
                          {selectedScript && <div className="mb-4 flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-lg bg-muted px-4 py-3 text-sm"><p>Viewer: hasil script Playwright · {selectedScript.logs.length} event</p><Button type="button" variant="outline" size="sm" onClick={() => setScriptSelection(null)}>Kembali ke capture manual</Button></div>}
                          {!selectedScript && <><DevLogGuide expandedGuide={expandedGuide} setExpandedGuide={setExpandedGuide} />


                          <div className="hidden shrink-0 mt-4 items-start gap-4 rounded-2xl border border-primary/20 bg-primary/5 p-4 shadow-sm" aria-hidden="true">
                            <div className="mt-0.5 rounded-xl border border-primary/20 bg-background/80 p-2 text-primary shadow-sm">
                              <Sparkles className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs text-foreground font-semibold leading-relaxed">
                                <span className="text-primary font-semibold uppercase tracking-tight mr-1.5">DevTools:</span>
                                Tab **Console** memantau eksekusi runtime browser, sementara **Network** melacak pertukaran data API. Gunakan detail payload untuk validasi integrasi yang mendalam.
                              </p>
                            </div>
                          </div>
                            <div className="rounded-xl border border-border bg-card dark:border-border dark:bg-card overflow-hidden">
                              <button
                                type="button"
                                onClick={() => setExpandedGuide(expandedGuide === 'manual' ? null : 'manual')}
                                className="w-full flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-2.5 text-xs font-bold text-foreground uppercase tracking-wider dark:text-foreground hover:bg-secondary/20 transition-colors"
                              >
                                <span>Manual Capture</span>
                                <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform duration-300", expandedGuide === 'manual' && "rotate-180")} />
                              </button>
                              <AnimatePresence>
                                {expandedGuide === 'manual' && (
                                  <motion.div
                                    initial={false}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.18 }}
                                    className="overflow-hidden"
                                  >
                                    <div className="border-t border-border px-4 pb-4 pt-3 text-xs leading-relaxed text-muted-foreground font-medium dark:border-border/50 dark:text-muted-foreground">
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

                          <MutationAction><ManualCaptureCommand {...manualCaptureCommandProps} /></MutationAction>
                          </>}

                          <ManualRecordingPreview {...manualRecordingPreviewProps} />{/*
                                      Memproses video{videoProcessingPercent !== null && isVideoFinalizing ? ` — ${videoProcessingPercent}%` : ''}

                          */}
                          <SystemDevLogHeader {...systemDevLogHeaderProps} />

                          <div className="flex h-[min(680px,calc(100dvh-8rem))] min-h-[360px] max-h-[680px] min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-300 bg-white font-mono text-[11.5px] shadow-xl dark:border-border dark:bg-background dark:shadow-2xl">
                            {aiSummary && !selectedScript && (
                              <div className="border-b border-indigo-100 bg-indigo-50 p-4 animate-in fade-in slide-in-from-top-2 duration-500 dark:border-indigo-900/50 dark:bg-indigo-950/30">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2 text-indigo-700 font-bold text-xs uppercase tracking-wider dark:text-status-in-progress">
                                    <Sparkles className="w-3.5 h-3.5" />
                                    AI Result Summary
                                  </div>
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-indigo-700/60 hover:text-indigo-700 dark:text-status-in-progress/50 dark:hover:text-status-in-progress" onClick={() => setAiSummary(null)}>
                                    <X className="w-3 h-3" />
                                  </Button>
                                </div>
                                <div className="text-foreground leading-relaxed whitespace-pre-wrap text-xs prose prose-sm max-w-none dark:prose-invert dark:text-foreground">
                                  {aiSummary}
                                </div>
                              </div>
                            )}
                            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent dark:scrollbar-thumb-slate-700">
                              {activeDevLogTab === 'execution' ? (
                                <ExecutionLogView
                                  stepLogs={viewTestCase.stepLogs}
                                  logs={executionLogs}
                                  evidenceLogs={liveLogs}
                                  logEndRef={logEndRef}
                                  formatRelativeTime={formatRelativeTime}
                                  onSelectLog={logActions.seekRecordingFromLog}
                                />
                              ) : activeDevLogTab === 'console' ? (
                                <ConsoleLogView
                                  groupedConsoleLogs={groupedConsoleLogs}
                                  logEndRef={logEndRef}
                                  expandedLogId={expandedLogId}
                                  setExpandedLogId={setExpandedLogId}
                                  seekRecordingFromLog={logActions.seekRecordingFromLog}
                                  formatRelativeTime={formatRelativeTime}
                                  getConsoleLogText={getConsoleLogText}
                                  formatPrettyValue={formatPrettyValue}
                                />
                              ) : (
                                <NetworkLogView
                                  networkFilters={networkFilters}
                                  updateNetworkFilters={logActions.updateNetworkFilters}
                                  networkLogItems={networkLogItems}
                                  networkHosts={networkHosts}
                                  networkMethods={networkMethods}
                                  setNetworkFilters={setNetworkFilters}
                                  DEFAULT_NETWORK_FILTERS={DEFAULT_NETWORK_FILTERS}
                                  networkCategoryCounts={networkCategoryCounts}
                                  hiddenNetworkCount={hiddenNetworkCount}
                                  toggleNetworkFilter={logActions.toggleNetworkFilter}
                                  groupedNetworkLogs={groupedNetworkLogs}
                                  logEndRef={logEndRef}
                                  seekRecordingFromLog={logActions.seekRecordingFromLog}
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
                              <div className="flex items-center gap-4 text-xs text-muted-foreground font-bold uppercase tracking-wider">
                                <div className="flex items-center gap-1.5">
                                  <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                  {okLogCount} OK
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                                  {errorLogCount} ERRORS
                                </div>
                              </div>
                              <p className="text-xs text-muted-foreground italic">Auto-scrolling enabled</p>
                            </div>
                          </div>

                          <div className="shrink-0 mt-4 flex items-start gap-3 rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-4 shadow-inner">
                            <div className="mt-0.5 rounded-full border border-indigo-200 bg-indigo-50 p-1 text-indigo-700 shadow-sm dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-status-in-progress">
                              <HelpCircle className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground font-medium leading-relaxed">
                                <span className="font-bold text-indigo-700 dark:text-status-in-progress">DevTools Mode:</span> Tab **Console** menampilkan log browser (JS errors/logs). Tab **Network** menampilkan *XHR/Fetch* traffic. Klik pada baris log untuk melihat detail payload dan headers.
                              </p>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    </TabsContent>
                  )}
                  </>}
                </div>
              </Tabs>
            </div>
          </div>
        )}

        <SystemDevLogFullscreen {...systemDevLogFullscreenProps} />
          {/*
                      {viewTestCase?.testCaseId || '-'} · {viewTestCase?.testAction || 'Execution telemetry'}
        */}
        {isRecordingFullscreen && (manualRecording?.frames?.length || hasManualRecordingVideo) && typeof document !== 'undefined' && createPortal(
          <div
            className={cn(
              "pointer-events-auto fixed inset-0 z-[80] flex h-[100dvh] w-[100vw] items-stretch justify-stretch overflow-hidden bg-black text-foreground transition-opacity duration-200",
              isClosingRecordingFullscreen ? 'opacity-0' : 'opacity-100'
            )}
          >
            <div
              className={cn(
                "relative flex h-full w-full overflow-hidden border-0 bg-background shadow-2xl transition duration-200 ease-out",
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
                  aria-label="Close recording fullscreen"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}

              {!isRecordingFullscreenContentVisible ? (
                <div className="flex h-full w-full bg-background" />
              ) : (
                <ResizablePanelGroup direction="horizontal" className="h-full min-h-0 w-full overflow-hidden">
                  <RecordingVideoPanel {...recordingVideoPanelProps} />
                  <ResizableHandle withHandle />
            <RecordingEvidencePanel {...recordingEvidencePanelProps} />{/*
                              {selectedFullscreenLog.kind} · {formatRelativeTime(selectedFullscreenLog.relativeMs)}
                */}
                </ResizablePanelGroup>
              )}
            </div>
          </div>,
          document.body
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
