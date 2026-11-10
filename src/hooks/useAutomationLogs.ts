'use client';

import { useEffect, useRef, useState } from 'react';
import { detailTestCaseId } from '@/lib/client/testcase-detail-identity';
import type { Dispatch, SetStateAction } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
  inferDevLogRunner,
  type AutomationRunner,
} from '@/lib/devlog-contract';
import { buildDevlogRelayUrl, buildDevlogRelayWebSocketUrl } from '@/lib/client/api/devlog-client';
import { CaptureLogBuffer, normalizeCaptureLog, parseCaptureLogs, type CaptureLogEntry } from '@/lib/client/automation/capture-log-buffer';
import { LatestRequest } from '@/lib/client/latest-request';

export type DevLogTab = 'console' | 'network' | 'execution';
export type ManualCaptureBrowserMode = 'clean' | 'profiled';
export type ManualCaptureMode = 'frame' | 'video' | 'hybrid';

export type AutomationLogEntry = CaptureLogEntry;

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
  durationMs?: number;
  width?: number;
  height?: number;
  fps?: number;
  bitrateMbps?: number;
  sizeBytes?: number;

  processingPercent?: number;

  status?:
    | 'starting'
    | 'recording'
    | 'finalizing'
    | 'ready'
    | 'failed';
}

export interface ManualRecordingMeta {
  mode?: ManualCaptureMode;
  sessionId: string;
  testCaseId: string;
  targetUrl?: string | null;
  startedAt: string;
  stoppedAt?: string | null;
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
  sourceTestCaseId?: string | null;
  stepLogs?: string | null;
}

interface UseAutomationLogsOptions<TTestCase extends AutomationLogTestCase> {
  enabled?: boolean;
  viewTestCase: TTestCase | null;
  setViewTestCase: Dispatch<SetStateAction<TTestCase | null>>;
}

interface StartManualCaptureOptions {
  browserMode?: ManualCaptureBrowserMode;
  captureMode?: ManualCaptureMode;
}

export const filterConsoleLogs = (logs: AutomationLogEntry[]) => logs.filter(log => log.isConsole);

export const filterNetworkLogs = (logs: AutomationLogEntry[]) => logs.filter(log => {
  if (!log.isNetwork) return false;
  const url = log.network?.url?.toLowerCase() || '';
  const isStaticAsset = url.endsWith('.js') ||
    url.endsWith('.css') ||
    url.endsWith('.png') ||
    url.endsWith('.jpg') ||
    url.endsWith('.jpeg') ||
    url.endsWith('.svg') ||
    url.endsWith('.gif') ||
    url.endsWith('.woff') ||
    url.endsWith('.woff2') ||
    url.includes('/assets/');

  return !isStaticAsset;
});

function parseJsonlLogs(text: string) {
  return parseCaptureLogs(text);
}

function getManualRecordingSessionId(logs: AutomationLogEntry[]) {
  return [...logs]
    .reverse()
    .find(log => (
      (log.runner === 'manual' || String(log.source || '').startsWith('manual-'))
      && log.sessionId
    ))
    ?.sessionId;
}

export function getAutomationRunnerFromLogs(logs: AutomationLogEntry[]): AutomationRunner | undefined {
  return [...logs]
    .reverse()
    .map(log => log.runner || inferDevLogRunner(log))
    .find((runner): runner is AutomationRunner => Boolean(runner));
}

export function useAutomationLogs<TTestCase extends AutomationLogTestCase>({
  enabled = true,
  viewTestCase,
  setViewTestCase,
}: UseAutomationLogsOptions<TTestCase>) {
  const { toast } = useToast();
  const testCaseId = detailTestCaseId(viewTestCase);
  const logEndRef = useRef<HTMLDivElement>(null);
  const currentViewIdRef = useRef<string | null>(null);
  const captureBuffer = useRef(new CaptureLogBuffer());
  const historyRequests = useRef(new LatestRequest());
  const recordingRequests = useRef(new LatestRequest());
  const runSelection = useRef<'current' | 'previous'>('current');
  const syncCurrentRef = useRef<(id: string) => Promise<void>>(async () => {});
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
  const currentAutomationRunner = getAutomationRunnerFromLogs(liveLogs);

  const loadLatestRecording = async (recordTestCaseId = testCaseId) => {
    if (!recordTestCaseId || currentViewIdRef.current !== recordTestCaseId) return null;
    const request = recordingRequests.current.begin();

    try {
      const response = await fetch(buildDevlogRelayUrl(`recordings/${encodeURIComponent(recordTestCaseId)}/latest`), { signal: request.signal, cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!request.current() || currentViewIdRef.current !== recordTestCaseId) return null;
      if (!response.ok || !data.recording) {
        setManualRecording(null);
        return null;
      }
      setManualRecording(data.recording);
      return data.recording as ManualRecordingMeta;
    } catch {
      if (request.current() && currentViewIdRef.current === recordTestCaseId) setManualRecording(null);
      return null;
    }
  };

  const loadRecordingForRun = async (testCaseId: string | undefined, logs: AutomationLogEntry[]) => {
    if (!testCaseId) return null;
    const sessionId = getManualRecordingSessionId(logs);
    if (!sessionId) return loadLatestRecording(testCaseId);

    const request = recordingRequests.current.begin();
    try {
      const response = await fetch(buildDevlogRelayUrl(`recordings/${encodeURIComponent(testCaseId)}/${encodeURIComponent(sessionId)}/metadata`), { signal: request.signal, cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!request.current() || currentViewIdRef.current !== testCaseId) return null;
      if (!response.ok || !data.recording) return loadLatestRecording(testCaseId);
      setManualRecording(data.recording);
      return data.recording as ManualRecordingMeta;
    } catch {
      return request.current() && currentViewIdRef.current === testCaseId ? loadLatestRecording(testCaseId) : null;
    }
  };

  const loadCurrentRun = async (recordTestCaseId = testCaseId) => {
    if (!recordTestCaseId || currentViewIdRef.current !== recordTestCaseId) return null;
    const request = historyRequests.current.begin();

    try {
      const response = await fetch(buildDevlogRelayUrl(`logs/${encodeURIComponent(recordTestCaseId)}?run=current`), { signal: request.signal, cache: 'no-store' });
      if (!response.ok) return null;

      const logs = parseJsonlLogs(await response.text());
      if (!request.current() || currentViewIdRef.current !== recordTestCaseId || runSelection.current !== 'current') return null;
      const visibleLogs = captureBuffer.current.reconcile(logs);
      setLiveLogs(visibleLogs);
      setLoadedRunLabel('current');
      return visibleLogs;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    syncCurrentRef.current = async (id) => {
      if (currentViewIdRef.current !== id || runSelection.current !== 'current') return;
      const logs = await loadCurrentRun(id);
      if (logs && currentViewIdRef.current === id && runSelection.current === 'current') await loadRecordingForRun(id, logs);
    };
  });

  useEffect(() => {
    currentViewIdRef.current = enabled ? testCaseId || null : null;
    historyRequests.current.cancel();
    recordingRequests.current.cancel();
    captureBuffer.current.reset();
    runSelection.current = 'current';

    if (!enabled || !testCaseId) return;
    const targetId = testCaseId;

    const timer = window.setTimeout(() => {
      setLiveLogs([]);
      setExpandedLogId(null);
      setAiSummary(null);
      setManualRecording(null);
      setActiveDevLogTab('execution');
      loadCurrentRun(targetId);
      loadLatestRecording(targetId);
    }, 0);

    return () => {
      window.clearTimeout(timer);
      historyRequests.current.cancel();
      recordingRequests.current.cancel();
      currentViewIdRef.current = null;
    };
  }, [enabled, testCaseId]);

  useEffect(() => {
    if (!enabled) return;
    let ws: WebSocket | null = null;
    let reconnectTimer: number | null = null;
    let flushTimer: number | null = null;
    let queuedTestCaseId: string | null = null;
    let executionLines: string[] = [];
    let closedByHook = false;

    const flushLogs = () => {
      flushTimer = null;
      const lines = executionLines;
      executionLines = [];
      const targetId = queuedTestCaseId;
      if (closedByHook || !targetId || currentViewIdRef.current !== targetId || runSelection.current !== 'current') return;
      setLiveLogs(captureBuffer.current.snapshot());
      setLoadedRunLabel('live');
      if (lines.length) setViewTestCase(previous => previous && detailTestCaseId(previous) === targetId
        ? { ...previous, stepLogs: `${previous.stepLogs || ''}${lines.join('\n')}\n` } : previous);
    };

    const handleMessage = (event: MessageEvent) => {
      try {
        const logEntry = normalizeCaptureLog(JSON.parse(event.data));
        if (!logEntry || currentViewIdRef.current !== logEntry.testCaseId || runSelection.current !== 'current') return;
        if (DEBUG_AUTOMATION_LOGS) {
          console.log(`[WS INCOMING] Type: ${logEntry.eventType}, TC: ${logEntry.testCaseId}`);
        }

        if (queuedTestCaseId !== logEntry.testCaseId) executionLines = [];
        queuedTestCaseId = logEntry.testCaseId!;
        if (logEntry.eventType === 'run.started') historyRequests.current.cancel();
        if (captureBuffer.current.append(logEntry)) {
          if (logEntry.isExecution) executionLines.push(typeof logEntry.log === 'string' ? logEntry.log : JSON.stringify(logEntry.log) ?? '');
          if (flushTimer === null) flushTimer = window.setTimeout(flushLogs, 100);
        }
        const logText = typeof logEntry.log === 'string' ? logEntry.log : '';
        if (logEntry.eventType === 'run.finished' || /Manual Capture Stopped/i.test(logText)) {
          if (flushTimer !== null) window.clearTimeout(flushTimer);
          flushLogs();
          setManualCaptureSessionId(null);
          void syncCurrentRef.current(logEntry.testCaseId!);
        }
      } catch (error) {
        console.error('[WS ERROR] Failed to process message:', error);
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
        // Relay mengautentikasi handshake WebSocket juga: tanpa access_token
        // upgrade-nya dibalas 401 dan relay terlihat "offline" di UI.
        ws = new WebSocket(buildDevlogRelayWebSocketUrl());
      } catch {
        setSocketReady(false);
        scheduleReconnect();
        return;
      }

      ws.onopen = () => {
        console.log('Connected to Log Relay');
        setSocketReady(true);
        const targetId = currentViewIdRef.current;
        if (targetId) void syncCurrentRef.current(targetId);
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
      if (flushTimer !== null) window.clearTimeout(flushTimer);
      ws?.close();
    };
  }, [enabled, setViewTestCase]);

  useEffect(() => {
    if (loadedRunLabel === 'live' && liveLogs.length > 0) {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [liveLogs, loadedRunLabel]);

  const loadCurrentLogRun = async () => {
    if (!testCaseId) return;
    if (runSelection.current === 'previous') captureBuffer.current.reset();
    runSelection.current = 'current';
    setIsLoadingHistory(true);
    try {
      const logs = await loadCurrentRun(testCaseId);
      await loadRecordingForRun(testCaseId, logs || []);
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
    if (!testCaseId) return;
    const targetId = testCaseId;
    const previousSelection = runSelection.current;
    runSelection.current = 'previous';
    const request = historyRequests.current.begin();

    setIsLoadingHistory(true);
    try {
      const response = await fetch(buildDevlogRelayUrl(`logs/${encodeURIComponent(targetId)}?run=previous`), { signal: request.signal, cache: 'no-store' });
      if (!response.ok) throw new Error('Riwayat run sebelumnya belum ada. Run terbaru sudah dimuat otomatis jika tersedia.');

      const logs = parseJsonlLogs(await response.text());
      if (!request.current() || currentViewIdRef.current !== targetId) return;

      captureBuffer.current.reset(logs);
      setLiveLogs(captureBuffer.current.snapshot());
      setLoadedRunLabel('previous');
      await loadRecordingForRun(targetId, logs);
      toast({
        title: 'History Run Sebelumnya Dimuat',
        description: `Berhasil memuat ${logs.length} entri log dari run sebelumnya.`,
      });
    } catch (error: any) {
      if (!request.current() || currentViewIdRef.current !== targetId) return;
      runSelection.current = previousSelection;
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
    const targetId = testCaseId;
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
    historyRequests.current.cancel();
    captureBuffer.current.reset();
    setLiveLogs([]);
    setViewTestCase(prev => prev ? { ...prev, stepLogs: '' } : null);
  };

  const buildManualCaptureUrl = (targetUrl: string, sessionId: string, testCaseId: string) => {
    const url = new URL(targetUrl);
    const relayUrl = 'http://127.0.0.1:3001';
    url.searchParams.set('qaCapture', '1');
    url.searchParams.set('qaTestCaseId', testCaseId);
    url.searchParams.set('qaSessionId', sessionId);
    url.searchParams.set('qaRelay', relayUrl);
    url.searchParams.set('qaScript', `${window.location.origin}/qa-capture.js`);
    return url.toString();
  };

  const startManualCapture = async (options: StartManualCaptureOptions = {}) => {
    if (!testCaseId) return;

    setIsStartingManualCapture(true);
    const sessionId = `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const browserMode: ManualCaptureBrowserMode = options.browserMode === 'profiled' ? 'profiled' : 'clean';

    try {
      const targetUrl = manualCaptureTargetUrl.trim();
      if (!targetUrl) throw new Error('Isi URL target terlebih dahulu.');

      const captureUrl = buildManualCaptureUrl(targetUrl, sessionId, testCaseId);
      runSelection.current = 'current';
      historyRequests.current.cancel();
      recordingRequests.current.cancel();
      captureBuffer.current.reset();
      setLiveLogs([]);
      const response = await fetch(buildDevlogRelayUrl('manual/start'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testCaseId,
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
      if (currentViewIdRef.current !== testCaseId) return;

      setAiSummary(null);
      setManualRecording(null);
      setActiveDevLogTab('console');
      setManualCaptureSessionId(sessionId);
      void syncCurrentRef.current(testCaseId);
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
    const targetId = testCaseId;

    setIsStoppingManualCapture(true);
    try {
      const response = await fetch(buildDevlogRelayUrl('manual/stop'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: manualCaptureSessionId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Gagal menghentikan manual capture.');
      if (currentViewIdRef.current !== targetId) return;

      setManualCaptureSessionId(null);
      runSelection.current = 'current';
      const [logs, recording] = await Promise.all([loadCurrentRun(targetId), loadLatestRecording(targetId)]);
      if (currentViewIdRef.current !== targetId) return;
      if (!logs) toast({ title: 'Rekaman tersimpan, DevLog belum tersinkron', description: 'Pilih Current untuk mencoba memuat ulang log tanpa refresh halaman.', variant: 'destructive' });
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
      if (['starting', 'recording', 'finalizing'].includes(video?.status || '')) {
        setIsProcessingManualRecording(true);
        const pollDelays = [800, 1800, 3200, 5200, 8000];
        pollDelays.forEach((delay, index) => {
          window.setTimeout(async () => {
            if (currentViewIdRef.current !== targetId) return;
            const latest = await loadLatestRecording(testCaseId);
            if (currentViewIdRef.current !== targetId) return;
            const status = latest?.video?.status;
            if (status === 'ready' || status === 'failed' || index === pollDelays.length - 1) {
              setIsProcessingManualRecording(false);
            }
          }, delay);
        });
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
    currentAutomationRunner,
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
