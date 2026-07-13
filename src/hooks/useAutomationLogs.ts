'use client';

import { useEffect, useRef, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
  buildDevlogRelayUrl,
  DEVLOG_RELAY_URL,
  normalizeManualCaptureUrl,
} from '@/lib/client/api/devlog-client';
import {
  adaptAutomationEventToLogEntry,
  adaptLegacyLogToLogEntry,
  getAutomationEventTestCaseId,
  getAutomationLogDedupKeys,
  isAutomationEventEnvelope,
  isLegacyLogMessage,
} from '@/lib/client/automation/automation-event-client';
import type { AutomationLogEntry } from '@/lib/client/automation/automation-event-client';

export type DevLogTab = 'console' | 'network' | 'execution';
export type ManualCaptureBrowserMode = 'clean' | 'profiled';
export type ManualCaptureMode = 'frame' | 'video' | 'hybrid';
export type { AutomationLogEntry } from '@/lib/client/automation/automation-event-client';

export interface ManualRecordingFrame {
  file: string;
  relativeMs: number;
  capturedAtMs?: number;
  captureDurationMs?: number;
  reason?: string;
  timestamp: string;
  url: string;
}

export interface ManualRecordingVideo {
  file: string;
  url?: string;
  mimeType?: string;
  startedAtRelativeMs?: number;
  startedAt?: string;
  endedAt?: string | null;
  durationMs?: number;
  width?: number;
  height?: number;
  fps?: number;
  bitrateMbps?: number;
  sizeBytes?: number;
  status?: 'starting' | 'recording' | 'finalizing' | 'ready' | 'failed';
  processingPercent?: number;
}

export interface ManualRecordingMeta {
  recordingId?: string;
  runId?: string;
  mode?: ManualCaptureMode;
  sessionId: string;
  testCaseId: string;
  targetUrl?: string | null;
  startedAt: string;
  stoppedAt?: string | null;
  recordingStartedAt?: string;
  recordingEndedAt?: string | null;
  frameIntervalMs: number;
  keyframeIntervalMs?: number;
  status: 'recording' | 'stopped' | 'stopped_limit' | 'interrupted';
  video?: ManualRecordingVideo;
  warnings?: string[];
  frames: ManualRecordingFrame[];
}

const DEBUG_AUTOMATION_LOGS = false;

interface AutomationLogTestCase {
  id: string;
  stepLogs?: string | null;
}

interface UseAutomationLogsOptions<TTestCase extends AutomationLogTestCase> {
  viewTestCase: TTestCase | null;
  setViewTestCase: React.Dispatch<React.SetStateAction<TTestCase | null>>;
}

interface StartManualCaptureOptions {
  browserMode?: ManualCaptureBrowserMode;
  captureMode?: ManualCaptureMode;
}

import { filterConsoleLogs, filterNetworkLogs, getManualRecordingSessionId, isVideoProcessingStatus, parseJsonlLogs } from '@/hooks/automation-log-utils';


export function useAutomationLogs<TTestCase extends AutomationLogTestCase>({
  viewTestCase,
  setViewTestCase,
}: UseAutomationLogsOptions<TTestCase>) {
  const { toast } = useToast();
  const logEndRef = useRef<HTMLDivElement>(null);
  const currentViewIdRef = useRef<string | null>(null);
  const eventCursorRef = useRef('0');
  const persistedRunIdRef = useRef<string | null>(null);
  const seenLogKeysRef = useRef<Set<string>>(new Set());
  const seenLogKeyOrderRef = useRef<string[]>([]);
  const [socketReady, setSocketReady] = useState(false);
  const [liveLogs, setLiveLogs] = useState<AutomationLogEntry[]>([]);
  const [activeDevLogTab, setActiveDevLogTab] = useState<DevLogTab>('execution');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [loadedRunLabel, setLoadedRunLabel] = useState<'current' | 'previous' | 'live'>('live');
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [manualCaptureTargetUrl, setManualCaptureTargetUrl] = useState('');
  const [manualCaptureSessionId, setManualCaptureSessionId] = useState<string | null>(null);
  const [manualRecording, setManualRecording] = useState<ManualRecordingMeta | null>(null);
  const [isStartingManualCapture, setIsStartingManualCapture] = useState(false);
  const [isStoppingManualCapture, setIsStoppingManualCapture] = useState(false);
  const [isProcessingManualRecording, setIsProcessingManualRecording] = useState(false);

  const isManualCaptureActive = !!manualCaptureSessionId;

  const loadLatestRecording = async (testCaseId = viewTestCase?.id) => {
    if (!testCaseId) return null;

    try {
      const response = await fetch(buildDevlogRelayUrl(`/recordings/${encodeURIComponent(testCaseId)}/latest`));
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.recording) {
        setManualRecording(null);
        return null;
      }
      const recording = data.recording as ManualRecordingMeta;
      setManualRecording(recording);
      setIsProcessingManualRecording(isVideoProcessingStatus(recording.video?.status));
      return recording;
    } catch {
      setManualRecording(null);
      return null;
    }
  };

  const loadRecordingForRun = async (testCaseId: string | undefined, logs: AutomationLogEntry[]) => {
    if (!testCaseId) return null;
    const sessionId = getManualRecordingSessionId(logs);
    if (!sessionId) return loadLatestRecording(testCaseId);

    try {
      const response = await fetch(buildDevlogRelayUrl(`/recordings/${encodeURIComponent(testCaseId)}/${encodeURIComponent(sessionId)}/metadata`));
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.recording) return loadLatestRecording(testCaseId);
      setManualRecording(data.recording);
      return data.recording as ManualRecordingMeta;
    } catch {
      return loadLatestRecording(testCaseId);
    }
  };

  const loadCurrentRun = async (testCaseId = viewTestCase?.id) => {
    if (!testCaseId) return null;

    try {
      const response = await fetch(buildDevlogRelayUrl(`/logs/${encodeURIComponent(testCaseId)}?run=current`));
      if (!response.ok) return null;

      const logs = parseJsonlLogs(await response.text());
      const visibleLogs = logs.length > 500 ? logs.slice(logs.length - 500) : logs;
      setLiveLogs(visibleLogs);
      setLoadedRunLabel('current');
      return visibleLogs;
    } catch {
      return null;
    }
  };

  const applyAutomationMessage = (message: unknown) => {
    if (
      typeof message === 'object'
      && message !== null
      && 'type' in message
      && message.type === 'recording.updated'
      && 'testCaseId' in message
      && message.testCaseId === currentViewIdRef.current
      && 'recording' in message
    ) {
      const recording = message.recording as ManualRecordingMeta;
      setManualRecording(recording);
      if (!isVideoProcessingStatus(recording.video?.status)) {
        setIsProcessingManualRecording(false);
        setManualCaptureSessionId(null);
      }
      return;
    }

    const testCaseId = getAutomationEventTestCaseId(message);
    if (!testCaseId || (!isAutomationEventEnvelope(message) && !isLegacyLogMessage(message))) return;
    const isNormalizedEnvelope = isAutomationEventEnvelope(message);
    const logEntry = isNormalizedEnvelope
      ? adaptAutomationEventToLogEntry(message)
      : adaptLegacyLogToLogEntry(message);
    const logText = typeof logEntry.log === 'string' ? logEntry.log : JSON.stringify(logEntry.log);
    if (/Manual Capture Stopped/i.test(logText)) setManualCaptureSessionId(null);
    if (currentViewIdRef.current !== testCaseId) return;
    if (
      isNormalizedEnvelope
      && message.persistedRunId
      && logEntry.eventType === 'run.started'
      && persistedRunIdRef.current
      && persistedRunIdRef.current !== message.persistedRunId
    ) {
      seenLogKeysRef.current.clear();
      seenLogKeyOrderRef.current = [];
      eventCursorRef.current = '0';
      setLiveLogs([]);
    }
    if (isNormalizedEnvelope && message.persistedRunId) {
      persistedRunIdRef.current = message.persistedRunId;
    }

    const dedupKeys = getAutomationLogDedupKeys(logEntry);
    if (dedupKeys.some(key => seenLogKeysRef.current.has(key))) {
      if (isNormalizedEnvelope && message.cursor) eventCursorRef.current = message.cursor;
      return;
    }
    const keysToRemember = isNormalizedEnvelope && logEntry.eventId
      ? dedupKeys.filter(key => key.startsWith('event:'))
      : dedupKeys;
    keysToRemember.forEach(key => {
      seenLogKeysRef.current.add(key);
      seenLogKeyOrderRef.current.push(key);
    });
    while (seenLogKeyOrderRef.current.length > 2000) {
      const oldestKey = seenLogKeyOrderRef.current.shift();
      if (oldestKey) seenLogKeysRef.current.delete(oldestKey);
    }
    if (isNormalizedEnvelope && message.cursor) eventCursorRef.current = message.cursor;

    setLiveLogs(prev => {
      const next = [...prev, logEntry];
      return next.length > 500 ? next.slice(next.length - 500) : next;
    });
    setLoadedRunLabel('live');
    if (logEntry.isExecution) {
      setViewTestCase(prev => prev?.id === testCaseId
        ? { ...prev, stepLogs: `${prev.stepLogs || ''}${logText}\n` }
        : prev);
    }
  };

  const loadPersistedEvents = async (
    testCaseId: string,
    after = '0',
    runId = persistedRunIdRef.current,
    replace = false
  ): Promise<AutomationLogEntry[] | null> => {
    try {
      const runParam = runId ? `&runId=${encodeURIComponent(runId)}` : '';
      const response = await fetch(buildDevlogRelayUrl(
        `/events/${encodeURIComponent(testCaseId)}?after=${encodeURIComponent(after)}&limit=500${runParam}`
      ));
      if (!response.ok) return null;
      const data = await response.json();
      if (!Array.isArray(data.events)) return null;
      if (replace) {
        seenLogKeysRef.current.clear();
        seenLogKeyOrderRef.current = [];
        eventCursorRef.current = '0';
        setLiveLogs([]);
      }
      data.events.forEach(applyAutomationMessage);
      if (data.cursor) eventCursorRef.current = data.cursor;
      return data.events.map((event: unknown) => (
        isAutomationEventEnvelope(event) ? adaptAutomationEventToLogEntry(event) : adaptLegacyLogToLogEntry(event as AutomationLogEntry)
      ));
    } catch {
      return null;
    }
  };

  const loadPersistedRun = async (testCaseId: string, position: 0 | 1) => {
    try {
      const response = await fetch(buildDevlogRelayUrl(`/runs/${encodeURIComponent(testCaseId)}?limit=2`));
      if (!response.ok) return null;
      const data = await response.json();
      const run = Array.isArray(data.runs) ? data.runs[position] : null;
      if (!run?.id) return null;
      persistedRunIdRef.current = run.id;
      const logs = await loadPersistedEvents(testCaseId, '0', run.id, true);
      if (!logs) return null;
      setLoadedRunLabel(position === 0 ? 'current' : 'previous');
      await loadRecordingForRun(testCaseId, logs);
      return logs;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    currentViewIdRef.current = viewTestCase?.id || null;

    if (!viewTestCase?.id) return;
    const targetId = viewTestCase.id;

    const timer = window.setTimeout(() => {
      seenLogKeysRef.current.clear();
      seenLogKeyOrderRef.current = [];
      eventCursorRef.current = '0';
      persistedRunIdRef.current = null;
      setLiveLogs([]);
      setExpandedLogId(null);
      setAiSummary(null);
      setManualRecording(null);
      setActiveDevLogTab('execution');
      void loadPersistedRun(targetId, 0).then(logs => {
        if (!logs) void loadCurrentRun(targetId);
      });
      loadLatestRecording(targetId);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [viewTestCase?.id]);

  useEffect(() => {
    const testCaseId = viewTestCase?.id;
    if (!testCaseId || !isVideoProcessingStatus(manualRecording?.video?.status)) return;
    const timer = window.setInterval(() => {
      void loadLatestRecording(testCaseId);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [viewTestCase?.id, manualRecording?.video?.status]);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: number | null = null;
    let closedByHook = false;

    const handleMessage = (event: MessageEvent) => {
      try {
        const message: unknown = JSON.parse(event.data);
        if (DEBUG_AUTOMATION_LOGS) {
          const type = typeof message === 'object' && message && 'type' in message ? message.type : 'unknown';
          console.log(`[WS INCOMING] Type: ${String(type)}`);
        }
        applyAutomationMessage(message);
      } catch (error) {
        console.error('[WS ERROR] Failed to process message:', error, event.data);
      }
    };

    const scheduleReconnect = () => {
      if (closedByHook || reconnectTimer !== null) return;
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, 2500);
    };

    const connect = () => {
      if (closedByHook) return;

      try {
        ws = new WebSocket(DEVLOG_RELAY_URL.replace(/^http/, 'ws'));
      } catch {
        setSocketReady(false);
        scheduleReconnect();
        return;
      }

      ws.onopen = () => {
        console.log('Connected to Log Relay');
        setSocketReady(true);
        const testCaseId = currentViewIdRef.current;
        if (testCaseId) {
          void loadPersistedEvents(testCaseId, eventCursorRef.current)
            .then(logs => {
              if (!logs) void loadCurrentRun(testCaseId);
            });
        }
      };

      ws.onclose = () => {
        setSocketReady(false);
        scheduleReconnect();
      };

      ws.onerror = () => {
        setSocketReady(false);
      };

      ws.onmessage = handleMessage;
    };

    connect();

    return () => {
      closedByHook = true;
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [setViewTestCase]);

  useEffect(() => {
    if (liveLogs.length > 0) {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [liveLogs]);

  const loadCurrentLogRun = async () => {
    if (!viewTestCase?.id) return;
    setIsLoadingHistory(true);
    try {
      const logs = await loadPersistedRun(viewTestCase.id, 0)
        || await loadCurrentRun(viewTestCase.id);
      await loadRecordingForRun(viewTestCase.id, logs || []);
      if (!logs) throw new Error('Run terbaru belum ditemukan.');
      toast({
        title: 'Current Run Dimuat',
        description: `Berhasil memuat ${logs.length} entri log dari run terbaru.`,
      });
    } catch (error: any) {
      toast({
        title: 'Gagal memuat current run',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const loadLogHistory = async () => {
    if (!viewTestCase?.id) return;
    const targetId = viewTestCase.id;

    setIsLoadingHistory(true);
    try {
      const persistedLogs = await loadPersistedRun(targetId, 1);
      if (persistedLogs) {
        toast({
          title: 'History Run Sebelumnya Dimuat',
          description: `Berhasil memuat ${persistedLogs.length} entri log dari PostgreSQL.`,
        });
        return;
      }
      const response = await fetch(buildDevlogRelayUrl(`/logs/${encodeURIComponent(viewTestCase.id)}?run=previous`));
      if (!response.ok) throw new Error('Riwayat run sebelumnya belum ada. Run terbaru sudah dimuat otomatis jika tersedia.');

      const logs = parseJsonlLogs(await response.text());

      setLiveLogs(logs.length > 500 ? logs.slice(logs.length - 500) : logs);
      setLoadedRunLabel('previous');
      await loadRecordingForRun(targetId, logs);
      toast({
        title: 'History Run Sebelumnya Dimuat',
        description: `Berhasil memuat ${logs.length} entri log dari run sebelumnya.`,
      });
    } catch (error: any) {
      toast({
        title: 'Gagal memuat riwayat',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const generateAISummary = async () => {
    const targetId = viewTestCase?.id;
    if (!targetId) return;

    setIsSummarizing(true);
    setAiSummary(null);
    try {
      const response = await fetch('/api/ai/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testCaseId: targetId.trim() }),
      });
      const data = await response.json();

      if (data.summary) {
        setAiSummary(data.summary);
      } else {
        throw new Error(data.error || 'Gagal generate summary');
      }
    } catch (error: any) {
      toast({
        title: 'Gagal Generate Summary',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSummarizing(false);
    }
  };

  const clearLogs = () => {
    seenLogKeysRef.current.clear();
    seenLogKeyOrderRef.current = [];
    eventCursorRef.current = '0';
    persistedRunIdRef.current = null;
    setLiveLogs([]);
    setViewTestCase(prev => prev ? { ...prev, stepLogs: '' } : null);
  };

  const buildManualCaptureUrl = (targetUrl: string, sessionId: string, testCaseId: string) => {
    const url = new URL(targetUrl);
    const relayUrl = DEVLOG_RELAY_URL;
    url.searchParams.set('qaCapture', '1');
    url.searchParams.set('qaTestCaseId', testCaseId);
    url.searchParams.set('qaSessionId', sessionId);
    url.searchParams.set('qaRelay', relayUrl);
    url.searchParams.set('qaScript', `${window.location.origin}/qa-capture.js`);
    return url.toString();
  };

  const startManualCapture = async (options: StartManualCaptureOptions = {}) => {
    if (!viewTestCase?.id) return;

    setIsStartingManualCapture(true);
    const sessionId = `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const browserMode: ManualCaptureBrowserMode = options.browserMode === 'profiled' ? 'profiled' : 'clean';

    try {
      const inputUrl = manualCaptureTargetUrl.trim();
      if (!inputUrl) throw new Error('Isi URL target terlebih dahulu.');
      const targetUrl = normalizeManualCaptureUrl(inputUrl);

      const captureUrl = buildManualCaptureUrl(targetUrl, sessionId, viewTestCase.id);
      const response = await fetch(buildDevlogRelayUrl('/manual/start'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testCaseId: viewTestCase.id,
          sessionId,
          targetUrl,
          captureUrl,
          launchBrowser: true,
          browserMode,
          captureMode: options.captureMode || 'frame',
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Relay manual capture tidak siap.');

      setLiveLogs([]);
      setAiSummary(null);
      setManualRecording(null);
      setActiveDevLogTab('console');
      setManualCaptureSessionId(sessionId);
      toast({
        title: 'Manual capture dimulai',
        description: data.mode === 'cdp'
          ? browserMode === 'profiled'
            ? 'Profiled browser sudah dibuka. Login dan cookies dari profile QA Desk akan dipakai ulang.'
            : 'Browser kosong sudah dibuka. Lakukan test manual di window tersebut.'
          : 'Tab target sudah dibuka. Pastikan target app memuat qa-capture.js.',
      });
    } catch (error: any) {
      toast({
        title: 'Gagal memulai manual capture',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsStartingManualCapture(false);
    }
  };

  const stopManualCapture = async () => {
    if (!manualCaptureSessionId) return;

    setIsStoppingManualCapture(true);
    try {
      const response = await fetch(buildDevlogRelayUrl('/manual/stop'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: manualCaptureSessionId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Gagal menghentikan manual capture.');

      setManualCaptureSessionId(null);
      const recording = await loadLatestRecording(viewTestCase?.id);
      const frameCount = data.cleanup?.recording?.frameCount;
      const video = data.cleanup?.recording?.video || recording?.video;
      const videoSizeMb = typeof video?.sizeBytes === 'number' ? `${(video.sizeBytes / 1024 / 1024).toFixed(1)} MB` : '';
      const videoDuration = typeof video?.durationMs === 'number' ? `${Math.round(video.durationMs / 1000)}s` : '';
      const videoText = video?.status
        ? ` Video ${video.status}${videoDuration ? `, ${videoDuration}` : ''}${videoSizeMb ? `, ${videoSizeMb}` : ''}.`
        : '';
      toast({
        title: 'Manual capture dihentikan',
        description: typeof frameCount === 'number'
          ? `Browser ditutup dan ${frameCount} frame/keyframe tersimpan.${videoText}`
          : 'Browser ditutup dan log berikutnya dari session ini akan ditolak relay.',
      });
      if (isVideoProcessingStatus(video?.status)) {
        setIsProcessingManualRecording(true);
      }
    } catch (error: any) {
      toast({
        title: 'Gagal stop manual capture',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsStoppingManualCapture(false);
    }
  };

  return {
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
    isProcessingManualRecording,
    logEndRef,
    setManualCaptureTargetUrl,
    setActiveDevLogTab,
    setExpandedLogId,
    setAiSummary,
    clearLogs,
    startManualCapture,
    stopManualCapture,
    loadCurrentLogRun,
    loadLatestRecording,
    generateAISummary,
    loadLogHistory,
    filterConsoleLogs,
    filterNetworkLogs,
  };
}
