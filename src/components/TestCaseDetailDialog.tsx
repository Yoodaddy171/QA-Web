'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MutationAction } from '@/components/WorkspaceAccess';
import { useCommittedActions } from '@/hooks/use-committed-actions';
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
  getVideoEventOffsetMs,
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
import { TestCaseAutomationTab } from '@/components/TestCaseAutomationTab';
import { ManualCaptureCommand } from '@/components/ManualCaptureCommand';
import { ManualRecordingPreview } from '@/components/ManualRecordingPreview';
import { SystemDevLogHeader } from '@/components/SystemDevLogHeader';
import { ExecutionLogView } from '@/components/ExecutionLogView';
import { ConsoleLogView } from '@/components/ConsoleLogView';
import { NetworkLogView } from '@/components/NetworkLogView';
import { SystemDevLogFullscreen } from '@/components/SystemDevLogFullscreen';
import { DevlogFullscreenDialog } from '@/components/DevlogFullscreenDialog';
import { SyncedVideoEventsPanel } from '@/components/SyncedVideoEventsPanel';
import { RecordingVideoPanel } from '@/components/RecordingVideoPanel';
import { RecordingEvidencePanel } from '@/components/RecordingEvidencePanel';
import { DevLogGuide } from '@/components/DevLogGuide';
import { PlaywrightScriptPanel, scriptArtifactUrl, type ScriptRun } from '@/components/PlaywrightScriptPanel';
import type { AutomationLogEntry } from '@/hooks/useAutomationLogs';
import { clampRecordingSeek, recordingSeekDelta } from '@/lib/client/automation/recording-shortcuts';
import { recordingResumeMs } from '@/lib/client/automation/recording-review';
import { createDevtoolsNetworkPredicate, DEFAULT_DEVTOOLS_NETWORK_FILTERS, type DevtoolsNetworkFilterState } from '@/lib/client/automation/devtools-network';
import { DEFAULT_DEVTOOLS_CONSOLE_LEVELS, type DevtoolsConsoleLevel } from '@/lib/client/automation/devtools-console';
import { useRecordingLayout } from '@/hooks/use-recording-layout';
import { detailTab, detailTestCaseId, isBugDetail } from '@/lib/client/testcase-detail-identity';

import {
  BulletTextView,
  dedupeNetworkLogs,
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
  getNetworkRequestKey,
  getRequestHeaders,
  getRequestPayload,
  getResponsePayload,
  groupConsoleLogs,
  networkCodePanelClass,
  networkFullscreenCodePanelClass,
  normalizedLogRelativeMs,
  type DevLogTab,
  type LogEntry,
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
  onClone?: (testCase: TestCase) => void;
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
  onClone,
  onRefine,
  onCopyId,
  testCaseList,
  onNavigate,
}: TestCaseDetailDialogProps) {
  const [requestedMainTab, setActiveMainTab] = useState('details');
  const isBugFixDetail = isBugDetail(viewTestCase);
  const sourceTestCaseId = detailTestCaseId(viewTestCase);
  const activeMainTab = detailTab(requestedMainTab, isBugFixDetail);
  const automationScrollRef = useRef<HTMLDivElement>(null);
  const [automationModeState, setAutomationModeState] = useState<{ testCaseId: string; mode: 'results' | 'script' | 'capture' } | null>(null);
  const automationMode = automationModeState && automationModeState.testCaseId === sourceTestCaseId ? automationModeState.mode : 'results';
  const showAutomationMode = (mode: 'results' | 'script' | 'capture') => {
    setAutomationModeState({ testCaseId: sourceTestCaseId, mode });
    automationScrollRef.current?.scrollTo({ top: 0 });
  };
  const { guest, canAdmin } = useWorkspaceAccess();
  const [scriptSelection, setScriptSelection] = useState<{ testCaseId: string; runId: string; startedAt?: string; artifactId?: string; logs: AutomationLogEntry[]; recording: ManualRecordingMeta | null } | null>(null);
  const [scriptDraftState, setScriptDraftState] = useState<{ testCaseId: string; dirty: boolean } | null>(null);
  const hasUnsavedScript = scriptDraftState?.testCaseId === sourceTestCaseId && scriptDraftState?.dirty;
  const setHasUnsavedScript = useCallback((dirty: boolean) => setScriptDraftState({ testCaseId: sourceTestCaseId, dirty }), [sourceTestCaseId]);
  const selectedScript = scriptSelection?.testCaseId === sourceTestCaseId ? scriptSelection : null;
  const liveLogs: LogEntry[] = selectedScript?.logs || captureLiveLogs;
  const manualRecording = selectedScript ? selectedScript.recording : captureRecording;
  const inspectScriptRun = (run: ScriptRun, logs: AutomationLogEntry[], artifactId?: string, activate = false) => {
    if (!viewTestCase) return;
    setScriptSelection(previous => {
      if (!activate && (previous?.runId !== run.runId || previous.testCaseId !== sourceTestCaseId)) return previous;
      const selectedId = artifactId || (previous?.runId === run.runId ? previous.artifactId : undefined);
      const video = run.artifacts.find(item => item.id === selectedId && item.kind === 'video') || run.artifacts.find(item => item.kind === 'video');
      const videoStart = video?.startedAtRelativeMs ?? logs.find(item => item.event === 'video.started')?.relativeMs;
      return { testCaseId: sourceTestCaseId, runId: run.runId, startedAt: run.startedAt || run.createdAt, artifactId: video?.id, logs,
        recording: video ? { mode: 'video', sessionId: run.runId, testCaseId: sourceTestCaseId, targetUrl: 'Playwright script', startedAt: run.startedAt || run.createdAt,
          stoppedAt: run.endedAt, frameIntervalMs: 0, status: 'stopped', frames: [], video: { file: video.name, url: scriptArtifactUrl(viewTestCase.projectId, sourceTestCaseId, run.runId, video.id), mimeType: 'video/webm', status: 'ready', startedAtRelativeMs: videoStart || 0, durationMs: run.durationMs, sizeBytes: video.size } } : null };
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
    if (open) setAutomationModeState(null);
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
  const horizontalLayout = useRecordingLayout('horizontal', [58, 42]);
  const [manualCaptureBrowserMode, setManualCaptureBrowserMode] = useState<ManualCaptureBrowserMode>('clean');
  const [manualCaptureMode, setManualCaptureMode] = useState<ManualCaptureMode>('frame');
  const [recordingSeekMs, setRecordingSeekMs] = useState(0);
  const [recordingVideoDurationMs, setRecordingVideoDurationMs] = useState<{ key: string; durationMs: number } | null>(null);
  const [recordingSeekApprox, setRecordingSeekApprox] = useState(false);
  const [recordingZoom, setRecordingZoom] = useState(1);
  const [isRecordingFullscreen, setIsRecordingFullscreen] = useState(false);
  const [isSystemDevLogFullscreen, setIsSystemDevLogFullscreen] = useState(false);
  const [selectedSystemDevLogId, setSelectedSystemDevLogId] = useState<string | null>(null);
  const [networkCodeWrap, setNetworkCodeWrap] = useState(true);
  const [networkFilters, setNetworkFilters] = useState<DevtoolsNetworkFilterState>(DEFAULT_DEVTOOLS_NETWORK_FILTERS);
  const [consoleQuery, setConsoleQuery] = useState('');
  const [consoleLevels, setConsoleLevels] = useState<DevtoolsConsoleLevel[]>(() => [...DEFAULT_DEVTOOLS_CONSOLE_LEVELS]);
  const [selectedFullscreenLog, setSelectedFullscreenLog] = useState<SelectedFullscreenLog>(null);
  const [selectedSyncedEventId, setSelectedSyncedEventId] = useState<string | null>(null);
  const [syncedEventFilters, setSyncedEventFilters] = useState(DEFAULT_VIDEO_EVENT_FILTERS);
  const [syncedNetworkLogIds, setSyncedNetworkLogIds] = useState<string[]>([]);
  const [isFollowingRecording, setIsFollowingRecording] = useState(true);
  const followRecordingRef = useRef(true);
  const pauseRecordingFollow = () => { followRecordingRef.current = false; setIsFollowingRecording(false); };
  const resumeRecordingFollow = () => {
    followRecordingRef.current = true;
    setIsFollowingRecording(true);
    const row = fullscreenNetworkRowRefs.current.get(syncedNetworkLogIds[0]);
    row?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
  };
  const [copiedEvidence, setCopiedEvidence] = useState(false);
  const [hasUnsavedComment, setHasUnsavedComment] = useState(false);
  const recordingViewportRef = useRef<HTMLDivElement>(null);
  const recordingVideoRef = useRef<HTMLVideoElement>(null);
  const fullscreenRecordingVideoRef = useRef<HTMLVideoElement>(null);
  const fullscreenNetworkRowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const fullscreenTimelineRef = useRef<HTMLDivElement>(null);
  const recordingPanRef = useRef({ active: false, startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0 });
  const recordingFullscreenWanted = useRef(false);
  const ownsBrowserFullscreen = useRef(false);
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

  useEffect(() => {
    if (!open || !testCaseList?.length || !onNavigate) return;
    const handleKeyNav = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable ||
          target.closest('[role="dialog"]') !== inspectorSurface.current?.closest('[role="dialog"]'))
      ) {
        return;
      }
      if (event.key === '[' && navigationIndex > 0) {
        event.preventDefault();
        onNavigate(testCaseList[navigationIndex - 1]);
      } else if (event.key === ']' && navigationIndex >= 0 && navigationIndex < testCaseList.length - 1) {
        event.preventDefault();
        onNavigate(testCaseList[navigationIndex + 1]);
      }
    };
    window.addEventListener('keydown', handleKeyNav);
    return () => window.removeEventListener('keydown', handleKeyNav);
  }, [open, testCaseList, navigationIndex, onNavigate]);
  const rawNetworkLogs = useMemo(() => (
    dedupeNetworkLogs(visibleLogs.filter((log) => log.isNetwork || Boolean(log.network)))
  ), [visibleLogs]);
  const networkLogItems = useMemo(() => (
    rawNetworkLogs
      .filter((log): log is LogEntry & { network: NonNullable<LogEntry['network']> } => Boolean(log.network))
      .map((log) => ({ log, meta: getNetworkMeta(log.network) }))
  ), [rawNetworkLogs]);
  const fullscreenNetworkGroups = useMemo(() => networkLogItems.map((item, index) => ({
    ...item,
    id: getNetworkRequestKey(item.log) ?? item.log.id ?? `network-request-${index}`,
    entries: [item],
    count: 1,
  })), [networkLogItems]);
  const groupedNetworkLogs = useMemo(() => {
    const matches = createDevtoolsNetworkPredicate(networkFilters);
    return fullscreenNetworkGroups.filter(({ log }) => matches(log.network));
  }, [fullscreenNetworkGroups, networkFilters]);
  const fullscreenConsoleGroups = groupedConsoleLogs;
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
  const lifecycleItems = useMemo(
    () => viewTestCase ? getBugLifecycleItems(viewTestCase) : [],
    [viewTestCase]
  );
  const lifecycleIndex = viewTestCase ? getLifecycleIndex(viewTestCase.status) : 0;
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
  const playbackPosition = useRef({ key: '', ms: 0 });
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
  ), [visibleLogs, manualRecording, recordingVideoDurationMs, recordingVideoKey]);
  const filteredSyncedVideoEvents = useMemo(() => (
    filterVideoEventsByCategory(syncedVideoEvents, syncedEventFilters)
  ), [syncedEventFilters, syncedVideoEvents]);
  const systemReviewEvents = useMemo(() => {
    const sources = new Set<LogEntry>([...executionLogs, ...fullscreenNetworkGroups.flatMap(group => group.entries.map(entry => entry.log)), ...fullscreenConsoleGroups.flatMap(group => group.entries)]);
    return filteredSyncedVideoEvents.filter(event => sources.has(event.originalEvent as LogEntry));
  }, [executionLogs, fullscreenNetworkGroups, fullscreenConsoleGroups, filteredSyncedVideoEvents]);
  const recordingVideoDurationForMarkersMs = getRecordingVideoDurationMs();
  const eventTimelineWidth = Math.max(600, Math.min(60000, recordingVideoDurationForMarkersMs / 1000 * 24));
  const groupedSyncedVideoMarkers = useMemo(() => (
    groupVideoEventMarkers(buildVideoEventMarkers(filteredSyncedVideoEvents, recordingVideoDurationForMarkersMs), 2400 / eventTimelineWidth)
  ), [filteredSyncedVideoEvents, recordingVideoDurationForMarkersMs, eventTimelineWidth]);
  const getLogVideoMs = (log: Pick<LogEntry, 'relativeMs' | 'timestamp'>) => {
    const relativeMs = normalizedLogRelativeMs(log.relativeMs);
    const durationMs = getRecordingVideoDurationMs();
    if (!manualRecording?.video || !hasManualRecordingVideo) return relativeMs;
    const offset = getVideoEventOffsetMs(log, manualRecording);
    if (offset === undefined) return undefined;
    return Math.max(0, Math.min(durationMs || Number.POSITIVE_INFINITY, offset));
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

  const formatLogRecordingTime = (log: Pick<LogEntry, 'relativeMs' | 'timestamp'>) => (
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
      if (video === fullscreenRecordingVideoRef.current || !isRecordingFullscreen) {
        const resumeMs = recordingResumeMs(playbackPosition.current, recordingVideoKey, durationMs);
        video.currentTime = resumeMs / 1000;
        playbackPosition.current = { key: recordingVideoKey, ms: resumeMs };
        setRecordingSeekMs(resumeMs);
      }
    }
  };

  const seekRecordingFromLog = (log: LogEntry) => {
    const targetMs = hasManualRecordingVideo ? getLogVideoMs(log) : log.relativeMs;
    if (typeof targetMs !== 'number') return;
    setRecordingSeekMs(targetMs);
    playbackPosition.current = { key: recordingVideoKey, ms: targetMs };
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
    if (isRecordingFullscreen && event.currentTarget !== fullscreenRecordingVideoRef.current) return;
    const currentVideoMs = event.currentTarget.currentTime * 1000;
    playbackPosition.current = { key: recordingVideoKey, ms: currentVideoMs };
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
    if (followRecordingRef.current && activeDevLogTab === 'network' && matchingIds[0]) {
      window.setTimeout(() => {
        if (!followRecordingRef.current) return;
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
        requestHeaders: getRequestHeaders(net.network.data),
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
    if ((event.target as HTMLElement).closest('video, button, input')) return;
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

  const exitBrowserFullscreen = () => {
    if (!ownsBrowserFullscreen.current || !document.fullscreenElement || typeof document.exitFullscreen !== 'function') return;
    ownsBrowserFullscreen.current = false;
    void document.exitFullscreen().catch(() => undefined);
  };

  const enterBrowserFullscreen = () => {
    if (document.fullscreenElement || typeof document.documentElement.requestFullscreen !== 'function') return;
    ownsBrowserFullscreen.current = true;
    void document.documentElement.requestFullscreen().then(() => {
      if (!recordingFullscreenWanted.current) exitBrowserFullscreen();
    }, () => { ownsBrowserFullscreen.current = false; });
  };

  const openRecordingFullscreen = () => {
    if (isVideoLoading || recordingFullscreenWanted.current) return;
    horizontalLayout.restoreLayout();
    followRecordingRef.current = true;
    setIsFollowingRecording(true);
    const inlinePlayer = recordingVideoRef.current;
    const positionMs = inlinePlayer && Number.isFinite(inlinePlayer.currentTime) ? inlinePlayer.currentTime * 1000 : recordingResumeMs(playbackPosition.current, recordingVideoKey, getRecordingVideoDurationMs());
    playbackPosition.current = { key: recordingVideoKey, ms: positionMs };
    setRecordingSeekMs(positionMs);
    inlinePlayer?.pause();
    setRecordingZoom(1);
    setSelectedFullscreenLog(null);
    setSelectedSyncedEventId(null);
    setSyncedEventFilters(DEFAULT_VIDEO_EVENT_FILTERS);
    setSyncedNetworkLogIds([]);
    setCopiedEvidence(false);
    recordingFullscreenWanted.current = true;
    setIsRecordingFullscreen(true);
    enterBrowserFullscreen();
  };

  const openSystemDevLogFullscreen = () => {
    setSelectedSystemDevLogId(null);
    setIsSystemDevLogFullscreen(true);
  };

  const closeSystemDevLogFullscreen = () => {
    setIsSystemDevLogFullscreen(false);
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

  const closeRecordingFullscreen = useCallback(() => {
    if (!recordingFullscreenWanted.current) return;
    recordingFullscreenWanted.current = false;
    const player = fullscreenRecordingVideoRef.current;
    if (player && Number.isFinite(player.currentTime)) {
      playbackPosition.current = { key: recordingVideoKey, ms: player.currentTime * 1000 };
      setRecordingSeekMs(player.currentTime * 1000);
      if (recordingVideoRef.current) recordingVideoRef.current.currentTime = player.currentTime;
      player.pause();
    }
    setIsRecordingFullscreen(false);
  }, [recordingVideoKey]);

  const openEvidenceReport = () => {
    if (!viewTestCase) return;
    const params = new URLSearchParams({ testCaseId: sourceTestCaseId, projectId: viewTestCase.projectId, download: '1' });
    if (selectedScript) { params.set('source', 'studio'); params.set('runId', selectedScript.runId); if (selectedScript.artifactId) params.set('artifactId', selectedScript.artifactId); }
    window.location.href = `/api/evidence?${params}`;
  };
  const seekRecordingFromSyncedEvent = (event: SyncedVideoEvent) => {
    if (typeof event.clampedOffsetMs !== 'number') return;
    setSelectedSyncedEventId(event.id);
    setRecordingSeekMs(event.clampedOffsetMs);
    playbackPosition.current = { key: recordingVideoKey, ms: event.clampedOffsetMs };
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
      setSelectedSystemDevLogId(matchingGroup ? `system-network-${matchingGroup.id}` : null);
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
      setSelectedSystemDevLogId(matchingGroup ? `system-console-${matchingGroup.id}` : null);
      setActiveDevLogTab('console');
      selectFullscreenConsoleLog(sourceLog, logId);
      return;
    }

    setActiveDevLogTab('execution');
    const executionIndex = executionLogs.findIndex(matchesSourceLog);
    setSelectedSystemDevLogId(executionIndex >= 0 ? `system-execution-${sourceLog.eventId || sourceLog.id || executionIndex}` : null);
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
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      setRecordingZoom((current) => (
        Math.min(3, Math.max(0.5, Number((current + (event.deltaY > 0 ? -0.1 : 0.1)).toFixed(2))))
      ));
    };

    viewport.addEventListener('wheel', handleWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', handleWheel);
  }, [isRecordingFullscreen]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (document.fullscreenElement) return;
      ownsBrowserFullscreen.current = false;
      closeRecordingFullscreen();
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [closeRecordingFullscreen]);

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
    activeDevLogTab, setActiveDevLogTab, groupedConsoleLogs, groupedNetworkLogs: fullscreenNetworkGroups,
    loadedRunLabel, loadCurrentLogRun, isLoadingHistory, loadLogHistory, clearLogs,
  };

  const logActions = useCommittedActions({ seekRecordingFromLog });
  const devtoolsFilters = { networkFilters, setNetworkFilters, consoleQuery, setConsoleQuery, consoleLevels, setConsoleLevels };

  const systemDevLogFullscreenProps = {
    runLabel: selectedScript ? `Playwright · ${selectedScript.runId.slice(0, 8)}` : loadedRunLabel,
    runStartedAt: selectedScript?.startedAt || manualRecording?.startedAt,
    navigationEvents: hasManualRecordingVideo ? systemReviewEvents : [], selectedSyncedEventId, recordingDisplayMs, seekRecordingFromSyncedEvent,
    recordingVideoKey,
    isSystemDevLogFullscreen, activeDevLogTab, fullscreenNetworkGroups, fullscreenConsoleGroups, executionLogs, viewTestCase, evidenceLogs: liveLogs,
    setActiveDevLogTab, setSelectedSystemDevLogId, selectedSystemDevLogId, setIsSystemDevLogFullscreen,
    devtoolsFilters, networkCodeWrap, setNetworkCodeWrap, closeSystemDevLogFullscreen,
    selectedSystemNetworkGroup, selectedSystemConsoleGroup, selectedSystemExecutionLog, formatRelativeTime, getNetworkMethod,
    getNetworkCategoryClass, getNetworkStatusClass, getNetworkStatus, getNetworkDuration,
    networkCodePanelClass, networkFullscreenCodePanelClass, networkCodeWhitespaceClass, formatPrettyValue,
    getRequestHeaders, getRequestPayload, getResponsePayload, seekRecordingFromLog, getConsoleLogText,
  };

  const recordingActions = useCommittedActions({ seekBy: (deltaMs: number) => {
    const durationMs = getRecordingVideoDurationMs();
    if (!hasManualRecordingVideo || durationMs <= 0) return;
    const player = fullscreenRecordingVideoRef.current || recordingVideoRef.current;
    const currentMs = player && Number.isFinite(player.currentTime) ? player.currentTime * 1000 : recordingSeekMs;
    const targetMs = clampRecordingSeek(currentMs, deltaMs, durationMs);
    setRecordingSeekMs(targetMs);
    playbackPosition.current = { key: recordingVideoKey, ms: targetMs };
    setRecordingSeekApprox(false);
    setSelectedSyncedEventId(null);
    for (const video of [recordingVideoRef.current, fullscreenRecordingVideoRef.current]) {
      if (video) { try { video.currentTime = targetMs / 1000; } catch {} }
    }
  } });
  useEffect(() => {
    if (!isRecordingFullscreen || !hasManualRecordingVideo) return;
    const handleKey = (event: KeyboardEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.closest('[contenteditable]:not([contenteditable="false"]), [data-radix-popper-content-wrapper], [role="alertdialog"], [data-slot="toggle-group"], [data-network-detail]')) return;
      const delta = recordingSeekDelta(event, { tagName: target?.tagName, isContentEditable: target?.isContentEditable, role: target?.getAttribute('role') || '' });
      if (!delta) return;
      event.preventDefault(); event.stopPropagation();
      recordingActions.seekBy(delta);
    };
    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, [isRecordingFullscreen, hasManualRecordingVideo, recordingActions]);

  const recordingVideoPanelProps = {
    recordingPaneSize: horizontalLayout.sizes[0], layoutStorageError: horizontalLayout.storageError,
    navigationEvents: hasManualRecordingVideo ? filteredSyncedVideoEvents : [], runStartedAt: selectedScript?.startedAt || manualRecording?.startedAt,
    viewTestCase, runLabel: selectedScript?.runId ? `Playwright · ${selectedScript.runId.slice(0, 8)}` : loadedRunLabel,
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
    seekRecordingBy: recordingActions.seekBy, eventTimelineWidth,
  };

  const recordingEvidencePanelProps = {
    evidencePaneSize: horizontalLayout.sizes[1],
    isFollowingRecording, pauseRecordingFollow, resumeRecordingFollow,
    recordingVideoKey,
    activeDevLogTab, setActiveDevLogTab, devtoolsFilters, evidenceLogs: liveLogs,
    selectedFullscreenLog, setSelectedFullscreenLog, networkCodeWrap,
    setNetworkCodeWrap, copyFullscreenEvidence, copiedEvidence, fullscreenNetworkGroups,
    fullscreenConsoleGroups, executionLogs, getNetworkMethod, getNetworkCategoryClass, getNetworkStatusClass,
    getNetworkStatus, getNetworkDuration, formatLogRecordingTime, formatRelativeTime,
    selectFullscreenNetworkLog, selectFullscreenConsoleLog, networkCodeWhitespaceClass,
    networkFullscreenCodePanelClass, networkCodePanelClass, formatPrettyValue, getRequestHeaders, getRequestPayload,
    getResponsePayload, selectedSyncedVideoEventDetail, selectedSyncedVideoEvent,
    getSyncedEventSeverityClass, filteredSyncedVideoEvents, syncedVideoEvents, syncedEventFilters,
    toggleSyncedEventFilter, selectedSyncedEventId, seekRecordingFromSyncedEvent,
    seekRecordingFromLog, getConsoleLogText, groupedSyncedVideoMarkers, setSelectedSyncedEventId,
    currentSyncedVideoEvent, getSyncedMarkerClass, scrollFullscreenTimeline, fullscreenTimelineRef,
    handleTimelineWheel, selectedRecordingFrame, manualRecording,
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
          if (event.target instanceof HTMLElement && event.target.hasAttribute('data-devlog-filter')) {
            event.preventDefault();
            return;
          }
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
          "signal-surface test-case-detail-dialog inset-y-0 !top-0 !left-auto !right-0 h-dvh max-h-dvh w-full max-w-none sm:max-w-none !translate-none flex flex-col gap-0 overflow-hidden rounded-none border-y-0 border-r-0 border-l border-border/60 bg-card p-0 text-foreground shadow-2xl data-[state=open]:slide-in-from-right-full data-[state=closed]:slide-out-to-right-full data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-100 lg:w-[68vw] lg:min-w-[720px] lg:max-w-[1040px]",
          isSystemDevLogFullscreen
            ? "w-full max-w-none rounded-none border-0 lg:w-full lg:min-w-0 lg:max-w-none"
            : isRecordingFullscreen
              ? "w-[96vw] sm:max-w-[96vw]"
              : "rounded-none border-l border-border"
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
                <div className="sticky top-0 z-10 mb-5 w-full shrink-0 overflow-x-auto border-b border-border bg-card scrollbar-none">
                  <TabsList aria-label="Bagian detail testcase" className="qa-inspector-tabs flex h-10 w-max min-w-full items-center justify-start gap-1 rounded-none border-0 bg-transparent p-0">
                  <TabsTrigger value="details" className="relative h-10 min-w-max flex-none gap-1.5 rounded-none border-0 border-b-2 border-transparent bg-transparent px-3 text-xs font-medium text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:font-semibold data-[state=active]:shadow-none">
                    <ClipboardList className="w-4 h-4" /> Overview
                  </TabsTrigger>
                  <TabsTrigger value="steps" className="relative h-10 min-w-max flex-none gap-1.5 rounded-none border-0 border-b-2 border-transparent bg-transparent px-3 text-xs font-medium text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:font-semibold data-[state=active]:shadow-none">
                    <ListChecks className="w-4 h-4" /> Steps
                  </TabsTrigger>
                  {isBugFixDetail && (
                    <TabsTrigger value="lifecycle" className="relative h-10 min-w-max flex-none gap-1.5 rounded-none border-0 border-b-2 border-transparent bg-transparent px-3 text-xs font-medium text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:font-semibold data-[state=active]:shadow-none">
                      <History className="w-4 h-4" /> Lifecycle
                    </TabsTrigger>
                  )}
                  <TabsTrigger disabled={!canInspect('traceability')} value="traceability" className="relative h-10 min-w-max flex-none gap-1.5 rounded-none border-0 border-b-2 border-transparent bg-transparent px-3 text-xs font-medium text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:font-semibold data-[state=active]:shadow-none">
                    <Link2 className="w-4 h-4" /> Traceability
                  </TabsTrigger>
                  <TabsTrigger disabled={!canInspect('execution')} value="execution" className="relative h-10 min-w-max flex-none gap-1.5 rounded-none border-0 border-b-2 border-transparent bg-transparent px-3 text-xs font-medium text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:font-semibold data-[state=active]:shadow-none">
                    <PlayCircle className="w-4 h-4" /> Execution
                  </TabsTrigger>
                  <TabsTrigger disabled={!canInspect('evidence')} value="evidence" className="relative h-10 min-w-max flex-none gap-1.5 rounded-none border-0 border-b-2 border-transparent bg-transparent px-3 text-xs font-medium text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:font-semibold data-[state=active]:shadow-none">
                    <Paperclip className="w-4 h-4" /> Evidence
                  </TabsTrigger>
                  <TabsTrigger disabled={!canInspect('bugs')} value="bugs" className="relative h-10 min-w-max flex-none gap-1.5 rounded-none border-0 border-b-2 border-transparent bg-transparent px-3 text-xs font-medium text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:font-semibold data-[state=active]:shadow-none"><Bug className="w-4 h-4" /> Bugs</TabsTrigger>
                  <TabsTrigger disabled={!canInspect('history')} value="history" className="relative h-10 min-w-max flex-none gap-1.5 rounded-none border-0 border-b-2 border-transparent bg-transparent px-3 text-xs font-medium text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:font-semibold data-[state=active]:shadow-none"><History className="w-4 h-4" /> History</TabsTrigger>
                  <TabsTrigger disabled={!canInspect('comments')} value="comments" className="relative h-10 min-w-max flex-none gap-1.5 rounded-none border-0 border-b-2 border-transparent bg-transparent px-3 text-xs font-medium text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:font-semibold data-[state=active]:shadow-none">
                    <MessageSquare className="w-4 h-4" /> Comments
                  </TabsTrigger>
                  {!guest && <TabsTrigger value="logs" className="relative h-10 min-w-max flex-none gap-1.5 rounded-none border-0 border-b-2 border-transparent bg-transparent px-3 text-xs font-medium text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:font-semibold data-[state=active]:shadow-none">
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

                <div ref={automationScrollRef} className="min-h-0 flex-1 overflow-y-auto pr-1 outline-none scrollbar-thin scrollbar-thumb-border/40 scrollbar-track-transparent">
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
                      <motion.div key="steps" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }}>
                        <div className="rounded-lg border border-border bg-card divide-y divide-border md:grid md:grid-cols-2 md:divide-x md:divide-y-0">
                          <section className="p-4 sm:p-5">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Test steps</h4>
                            <div className="mt-3">
                              <BulletTextView value={viewTestCase.steps || '-'} className="break-words whitespace-pre-wrap text-sm leading-6 text-foreground" />
                            </div>
                          </section>
                          <section className="p-4 sm:p-5">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Expected result</h4>
                            <div className="mt-3">
                              <BulletTextView value={viewTestCase.expectedResult || '-'} className="break-words whitespace-pre-wrap text-sm leading-6 text-foreground" />
                            </div>
                          </section>
                        </div>
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
                    <TestCaseTraceabilityTab key={sourceTestCaseId} projectId={viewTestCase.projectId} testCaseId={sourceTestCaseId} />
                  )}
                  {canInspect('execution') && activeMainTab === 'execution' && (
                    <TestCaseExecutionTab key={sourceTestCaseId} projectId={viewTestCase.projectId} testCaseId={sourceTestCaseId} />
                  )}
                  {canInspect('evidence') && activeMainTab === 'evidence' && (
                    <TestCaseEvidenceTab key={sourceTestCaseId} projectId={viewTestCase.projectId} testCaseId={sourceTestCaseId} />
                  )}
                  {canInspect('bugs') && activeMainTab === 'bugs' && (
                    <TestCaseBugsTab key={sourceTestCaseId} projectId={viewTestCase.projectId} testCaseId={sourceTestCaseId} />
                  )}
                  {canInspect('history') && activeMainTab === 'history' && (
                    <TestCaseHistoryTab key={sourceTestCaseId} projectId={viewTestCase.projectId} testCaseId={sourceTestCaseId} />
                  )}
                  {canInspect('comments') && activeMainTab === 'comments' && (
                    <TestCaseCommentsTab key={sourceTestCaseId} projectId={viewTestCase.projectId} testCaseId={sourceTestCaseId} onDirtyChange={setHasUnsavedComment} />
                  )}
                  {!guest && activeMainTab === 'logs' && (
                    <TestCaseAutomationTab
                      viewTestCase={viewTestCase}
                      sourceTestCaseId={sourceTestCaseId}
                      canAdmin={canAdmin}
                      automationMode={automationMode}
                      showAutomationMode={showAutomationMode}
                      selectedScript={selectedScript}
                      setScriptSelection={() => setScriptSelection(null)}
                      isManualCaptureActive={isManualCaptureActive}
                      captureStartedAt={captureRecording?.startedAt || captureLiveLogs[0]?.timestamp}
                      inspectScriptRun={inspectScriptRun}
                      setHasUnsavedScript={setHasUnsavedScript}
                      onScriptRunsDeleted={ids =>
                        setScriptSelection(previous => (previous && ids.includes(previous.runId) ? null : previous))
                      }
                      expandedGuide={expandedGuide}
                      setExpandedGuide={setExpandedGuide}
                      manualCaptureCommandProps={manualCaptureCommandProps}
                      manualRecordingPreviewProps={manualRecordingPreviewProps}
                      systemDevLogHeaderProps={systemDevLogHeaderProps}
                      aiSummary={aiSummary}
                      setAiSummary={setAiSummary}
                      activeDevLogTab={activeDevLogTab}
                      executionLogs={executionLogs}
                      liveLogs={liveLogs}
                      logEndRef={logEndRef}
                      formatRelativeTime={formatRelativeTime}
                      seekRecordingFromLog={logActions.seekRecordingFromLog}
                      groupedConsoleLogs={groupedConsoleLogs}
                      consoleQuery={consoleQuery}
                      consoleLevels={consoleLevels}
                      setConsoleQuery={setConsoleQuery}
                      setConsoleLevels={setConsoleLevels}
                      expandedLogId={expandedLogId}
                      setExpandedLogId={setExpandedLogId}
                      getConsoleLogText={getConsoleLogText}
                      formatPrettyValue={formatPrettyValue}
                      networkFilters={networkFilters}
                      setNetworkFilters={setNetworkFilters}
                      fullscreenNetworkCount={fullscreenNetworkGroups.length}
                      groupedNetworkLogs={groupedNetworkLogs}
                      networkCodeWrap={networkCodeWrap}
                      setNetworkCodeWrap={setNetworkCodeWrap}
                    />
                  )}
                  </>}
                </div>
              </Tabs>
            </div>
          </div>
        )}

        <SystemDevLogFullscreen key={recordingVideoKey} {...systemDevLogFullscreenProps} />
          {/*
                      {viewTestCase?.testCaseId || '-'} · {viewTestCase?.testAction || 'Execution telemetry'}
        */}
        {Boolean(manualRecording?.frames?.length || hasManualRecordingVideo) && (
          <DevlogFullscreenDialog
            open={isRecordingFullscreen}
            onClose={closeRecordingFullscreen}
            onAfterClose={() => { if (!recordingFullscreenWanted.current || !open) exitBrowserFullscreen(); }}
            title="Review rekaman pengujian"
            description="Video dan aktivitas tersinkron. Gunakan panah kiri atau kanan untuk mundur atau maju lima detik."
          >
            <div className="relative flex h-full min-h-0 w-full overflow-hidden bg-background">
              <Button type="button" variant="outline" size="icon" className="absolute right-4 top-4 z-[90] size-9 bg-background"
                onClick={closeRecordingFullscreen} aria-label="Close recording fullscreen" title="Close recording fullscreen">
                <X aria-hidden="true" />
              </Button>
              <ResizablePanelGroup direction="horizontal" onLayout={horizontalLayout.saveLayout} className="h-full min-h-0 w-full overflow-hidden">
                <RecordingVideoPanel {...recordingVideoPanelProps} />
                <ResizableHandle withHandle />
                <RecordingEvidencePanel key={recordingVideoKey} {...recordingEvidencePanelProps} />
              </ResizablePanelGroup>
            </div>
          </DevlogFullscreenDialog>
        )}

        <TestCaseDetailDialogFooter
          viewTestCase={viewTestCase}
          isBugFixDetail={isBugFixDetail}
          onOpenChange={onOpenChange}
          onEdit={onEdit}
          onClone={onClone}
          onRefine={onRefine}
          openEvidenceReport={openEvidenceReport}
        />
      </DialogContent>
    </Dialog>
  );
}
