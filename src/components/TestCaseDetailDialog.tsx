'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ClipboardList, Clock, Code2, Copy, Edit3, Film, HelpCircle, History,
  FileDown, Filter, Layers, Loader2, Maximize2, Minus, Play, Plus, RefreshCw, Search, Sparkles, Square, Trash2, Wrench, X
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { TestCase } from '@/components/TestCaseTable';
import type { ManualRecordingMeta } from '@/hooks/useAutomationLogs';

type DevLogTab = 'console' | 'network' | 'execution';

interface LogEntry {
  id?: string;
  timestamp?: string | number | Date;
  relativeMs?: number;
  level?: string;
  log?: unknown;
  isConsole?: boolean;
  isNetwork?: boolean;
  network?: {
    event?: string;
    method?: string;
    url: string;
    status?: number;
    duration?: number;
    headers?: unknown;
    data?: unknown;
    success?: boolean;
  };
}

type NetworkCategory = 'business' | 'preflight' | 'static' | 'telemetry' | 'data' | 'other';

interface NetworkMeta {
  category: NetworkCategory;
  label: string;
  host: string;
  method: string;
  pathname: string;
  isError: boolean;
}

interface NetworkFilterState {
  search: string;
  host: string;
  method: string;
  status: string;
  showPreflight: boolean;
  showStatic: boolean;
  showTelemetry: boolean;
  showDataUrls: boolean;
  showOther: boolean;
}

const DEFAULT_NETWORK_FILTERS: NetworkFilterState = {
  search: '',
  host: 'all',
  method: 'all',
  status: 'all',
  showPreflight: false,
  showStatic: false,
  showTelemetry: false,
  showDataUrls: false,
  showOther: false,
};

const STATIC_EXTENSIONS = [
  '.js', '.css', '.png', '.jpg', '.jpeg', '.svg', '.gif', '.webp', '.ico',
  '.woff', '.woff2', '.ttf', '.map', '.json',
];

const formatPrettyValue = (value: unknown) => {
  if (value === undefined || value === null || value === '') return '-';

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return '-';

    try {
      return JSON.stringify(JSON.parse(trimmed), null, 2);
    } catch {
      return trimmed;
    }
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const asRecord = (value: unknown): Record<string, unknown> | null => (
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
);

const getRequestPayload = (data: unknown) => {
  const record = asRecord(data);
  if (!record) return null;
  return record.requestBody ?? record.payload ?? record.body ?? null;
};

const getResponsePayload = (data: unknown) => {
  const record = asRecord(data);
  if (!record) return data;
  return record.responseBody ?? record.response ?? record.data ?? data;
};

const parseNetworkUrl = (url: string) => {
  if (url.startsWith('data:')) {
    return { host: 'data:', pathname: 'data:', protocol: 'data:' };
  }

  if (url.startsWith('blob:')) {
    return { host: 'blob:', pathname: 'blob:', protocol: 'blob:' };
  }

  try {
    const parsed = new URL(url, 'http://local.invalid');
    return {
      host: parsed.hostname || 'local',
      pathname: parsed.pathname || '/',
      protocol: parsed.protocol,
    };
  } catch {
    return { host: 'unknown', pathname: url, protocol: '' };
  }
};

const getNetworkMeta = (network: NonNullable<LogEntry['network']>): NetworkMeta => {
  const url = network.url || '';
  const parsed = parseNetworkUrl(url);
  const method = (network.method || network.event || 'TRACE').toUpperCase();
  const pathname = parsed.pathname.toLowerCase();
  const isError = typeof network.status === 'number' && network.status >= 400;

  if (parsed.protocol === 'data:' || parsed.protocol === 'blob:') {
    return { category: 'data', label: 'Data URL', host: parsed.host, method, pathname: parsed.pathname, isError };
  }

  if (method === 'OPTIONS') {
    return { category: 'preflight', label: 'Preflight', host: parsed.host, method, pathname: parsed.pathname, isError };
  }

  if (pathname.includes('/cdn-cgi/rum') || pathname.includes('/collect') || pathname.includes('/analytics')) {
    return { category: 'telemetry', label: 'Telemetry', host: parsed.host, method, pathname: parsed.pathname, isError };
  }

  const isStatic = STATIC_EXTENSIONS.some((extension) => pathname.endsWith(extension)) ||
    pathname.includes('/_next/') ||
    pathname.includes('/assets/') ||
    pathname.includes('/public/') ||
    pathname.includes('/media/') ||
    pathname.includes('/images/');

  if (isStatic) {
    return { category: 'static', label: 'Static', host: parsed.host, method, pathname: parsed.pathname, isError };
  }

  if (pathname.startsWith('/api/')) {
    return { category: 'business', label: 'API', host: parsed.host, method, pathname: parsed.pathname, isError };
  }

  return { category: 'other', label: 'Other', host: parsed.host, method, pathname: parsed.pathname, isError };
};

const getNetworkCategoryClass = (category: NetworkCategory) => {
  switch (category) {
    case 'business': return 'border-cyan-500/30 bg-cyan-950/60 text-cyan-300';
    case 'preflight': return 'border-amber-500/30 bg-amber-950/60 text-amber-300';
    case 'static': return 'border-slate-600 bg-muted text-slate-400';
    case 'telemetry': return 'border-violet-500/30 bg-violet-950/60 text-violet-300';
    case 'data': return 'border-fuchsia-500/30 bg-fuchsia-950/60 text-fuchsia-300';
    default: return 'border-slate-500/30 bg-slate-800 text-slate-300';
  }
};

const getStatusBucket = (status?: number) => {
  if (typeof status !== 'number') return 'unknown';
  if (status >= 500) return '5xx';
  if (status >= 400) return '4xx';
  if (status >= 300) return '3xx';
  if (status >= 200) return '2xx';
  return 'other';
};

const formatDateTime = (dateStr?: string | null) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
};

const splitBulletText = (value?: string | null) => {
  const text = String(value || '').trim();
  if (!text) return [];

  const lineItems = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lineItems.length > 1 && lineItems.every((line) => /^[-•]\s+/.test(line))) {
    return lineItems.map((line) => line.replace(/^[-•]\s+/, '').trim()).filter(Boolean);
  }

  if (/^[-•]\s+/.test(text) || /\s[-•]\s+/.test(text)) {
    return text
      .replace(/^[-•]\s+/, '')
      .split(/\s[-•]\s+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [text];
};

function BulletTextView({
  value,
  className,
}: {
  value?: string | null;
  className: string;
}) {
  const items = splitBulletText(value);

  return (
    <div className={className}>
      {items.length === 0 ? (
        <span>-</span>
      ) : items.length === 1 ? (
        <p>{items[0]}</p>
      ) : (
        <ul className="list-disc space-y-2 pl-5">
          {items.map((item, index) => (
            <li key={`${item}-${index}`}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

const getBugLifecycleItems = (testCase: TestCase) => [
  {
    key: 'reported',
    label: 'Dilaporkan',
    description: 'Bug tercatat dari testcase yang gagal.',
    date: testCase.reportedAt || testCase.createdAt,
    status: 'SUDAH DILAPORKAN',
  },
  {
    key: 'fixing',
    label: 'Sedang Di Fix',
    description: 'Bug mulai masuk proses perbaikan.',
    date: testCase.fixingAt,
    status: 'SEDANG DI FIX',
  },
  {
    key: 'ready',
    label: 'Ready to Retest',
    description: 'Bug dikembalikan ke QA untuk retest.',
    date: testCase.readyAt,
    status: 'READY TO RETEST',
  },
  {
    key: 'fixed',
    label: 'Verified & Fixed',
    description: 'Retest berhasil dari halaman Test Case.',
    date: testCase.fixedAt,
    status: 'VERIFIED & FIXED',
  },
];

const getLifecycleIndex = (status: string) => {
  switch (status) {
    case 'SUDAH DILAPORKAN': return 0;
    case 'SEDANG DI FIX': return 1;
    case 'READY TO RETEST': return 2;
    case 'VERIFIED & FIXED': return 3;
    default: return 0;
  }
};

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
  logEndRef: React.RefObject<HTMLDivElement | null>;
  setManualCaptureTargetUrl: (url: string) => void;
  setActiveDevLogTab: (tab: DevLogTab) => void;
  setExpandedLogId: (id: string | null) => void;
  setAiSummary: (summary: string | null) => void;
  clearLogs: () => void;
  startManualCapture: () => void;
  stopManualCapture: () => void;
  loadCurrentLogRun: () => void;
  generateAISummary: () => void;
  loadLogHistory: () => void;
  filterConsoleLogs: (logs: LogEntry[]) => LogEntry[];
  getStatusColor: (status: string) => string;
  getStatusIcon: (status: string) => React.ReactNode;
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
  getTestTypeColor,
  getPriorityColor,
  onEdit,
  onRefine,
  onCopyId,
  testCaseList,
  onNavigate,
}: TestCaseDetailDialogProps) {
  const [recordingSeekMs, setRecordingSeekMs] = useState(0);
  const [recordingZoom, setRecordingZoom] = useState(1);
  const [isRecordingFullscreen, setIsRecordingFullscreen] = useState(false);
  const [isClosingRecordingFullscreen, setIsClosingRecordingFullscreen] = useState(false);
  const [networkFilters, setNetworkFilters] = useState<NetworkFilterState>(DEFAULT_NETWORK_FILTERS);
  const recordingViewportRef = useRef<HTMLDivElement>(null);
  const fullscreenTimelineRef = useRef<HTMLDivElement>(null);
  const recordingPanRef = useRef({ active: false, startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0 });
  const consoleLogs = useMemo(() => filterConsoleLogs(liveLogs), [filterConsoleLogs, liveLogs]);
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
    }, { business: 0, preflight: 0, static: 0, telemetry: 0, data: 0, other: 0 })
  ), [networkLogItems]);
  const networkLogs = useMemo(() => {
    const query = networkFilters.search.trim().toLowerCase();

    return networkLogItems.filter(({ log, meta }) => {
      const statusBucket = getStatusBucket(log.network.status);
      const categoryVisible = meta.isError ||
        meta.category === 'business' ||
        (meta.category === 'preflight' && networkFilters.showPreflight) ||
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

  const formatRelativeTime = (relativeMs?: number) => {
    if (typeof relativeMs !== 'number') return '-';
    const safeMs = Math.max(0, Math.round(relativeMs));
    const totalSeconds = Math.floor(safeMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  };

  const seekRecordingFromLog = (log: LogEntry) => {
    if (typeof log.relativeMs === 'number') setRecordingSeekMs(log.relativeMs);
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
    if (typeof network.status !== 'number') return 'bg-slate-800 text-slate-400';
    return network.status < 400 ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400';
  };

  const getNetworkDuration = (network: NonNullable<LogEntry['network']>) => (
    typeof network.duration === 'number' ? `${network.duration}ms` : '-'
  );

  const updateNetworkFilters = (nextFilters: Partial<NetworkFilterState>) => {
    setNetworkFilters((current) => ({ ...current, ...nextFilters }));
  };

  const toggleNetworkFilter = (key: keyof Pick<NetworkFilterState, 'showPreflight' | 'showStatic' | 'showTelemetry' | 'showDataUrls' | 'showOther'>) => {
    setNetworkFilters((current) => ({ ...current, [key]: !current[key] }));
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

  const openRecordingFullscreen = () => {
    setRecordingZoom(1);
    setIsClosingRecordingFullscreen(false);
    setIsRecordingFullscreen(true);
  };

  const closeRecordingFullscreen = () => {
    setIsClosingRecordingFullscreen(true);
    window.setTimeout(() => {
      setIsRecordingFullscreen(false);
      setIsClosingRecordingFullscreen(false);
    }, 180);
  };

  const openEvidenceReport = () => {
    if (!viewTestCase) return;
    window.open(`/api/evidence?testCaseId=${encodeURIComponent(viewTestCase.id)}`, '_blank', 'noopener,noreferrer');
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-background text-foreground">
        <DialogHeader className="p-6 pb-2 shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <ClipboardList className="w-5 h-5 text-indigo-600" />
              Detail Test Case
              {viewTestCase && (
                <Badge variant="outline" className={`gap-1 ml-2 ${getStatusColor(viewTestCase.status)}`}>
                  {getStatusIcon(viewTestCase.status)} {viewTestCase.status}
                </Badge>
              )}
            </DialogTitle>
            {testCaseList && testCaseList.length > 1 && onNavigate && viewTestCase && (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 rounded-lg p-0 text-muted-foreground hover:text-foreground"
                  disabled={testCaseList.findIndex(tc => tc.id === viewTestCase.id) <= 0}
                  onClick={() => {
                    const idx = testCaseList.findIndex(tc => tc.id === viewTestCase.id);
                    if (idx > 0) onNavigate(testCaseList[idx - 1]);
                  }}
                  aria-label="Previous test case"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-[11px] text-muted-foreground font-medium min-w-[40px] text-center">
                  {testCaseList.findIndex(tc => tc.id === viewTestCase.id) + 1}/{testCaseList.length}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 rounded-lg p-0 text-muted-foreground hover:text-foreground"
                  disabled={testCaseList.findIndex(tc => tc.id === viewTestCase.id) >= testCaseList.length - 1}
                  onClick={() => {
                    const idx = testCaseList.findIndex(tc => tc.id === viewTestCase.id);
                    if (idx < testCaseList.length - 1) onNavigate(testCaseList[idx + 1]);
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
          <div className="flex-1 overflow-y-auto outline-none">
            <div className="p-6 pt-2">
              <Tabs defaultValue="details" className="w-full">
                <TabsList className={`grid w-full ${isBugFixDetail ? 'grid-cols-3' : 'grid-cols-2'} mb-6 border border-border/60 bg-secondary/50 p-1 rounded-xl`}>
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

                <TabsContent value="details" className="space-y-6 mt-0 outline-none">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="rounded-xl border border-border/60 bg-secondary/30 p-4">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Identification</p>
                        <div className="space-y-3">
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Test Case ID (Display)</p>
                            <p className="font-mono text-base font-bold text-slate-100">{viewTestCase.testCaseId}</p>
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-xs text-muted-foreground">Internal Database ID (UUID)</p>
                              <Badge variant="secondary" className="h-3.5 border-0 bg-indigo-500/10 px-1 text-[9px] text-indigo-300">Required for Logs</Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              <p className="flex-1 truncate rounded border border-border/60 bg-muted/30 px-2 py-1 font-mono text-[11px] text-slate-400 shadow-inner">
                                {viewTestCase.id}
                              </p>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 w-7 border-border/60 bg-secondary/50 p-0 text-slate-300 hover:bg-indigo-500/10 hover:text-indigo-300"
                                onClick={() => onCopyId(viewTestCase.id)}
                              >
                                <Copy className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-xl border border-border/60 bg-secondary/30 p-4">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Classification</p>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Page / Menu</p>
                            <p className="font-bold text-slate-100">{viewTestCase.page}</p>
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
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Project Tracking</p>
                        <div className="space-y-4">
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Module</p>
                            <div className="flex items-center gap-2">
                              <Layers className="w-3.5 h-3.5 text-slate-400" />
                              <span className="font-semibold text-slate-200">{viewTestCase.module?.name || 'Tanpa Module'}</span>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Bobot Transaksi</p>
                              <Badge variant="secondary" className="border-indigo-500/20 bg-indigo-500/10 font-mono text-indigo-300">
                                {viewTestCase.calculatedWeight != null ? `${viewTestCase.calculatedWeight.toFixed(2)}%` : (viewTestCase.weight || '-')}
                              </Badge>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Progress</p>
                              <div className="flex items-center gap-2 mt-1">
                                <Progress value={viewTestCase.progress} className="h-2 flex-1" />
                                <span className="text-xs font-bold text-slate-300">{viewTestCase.progress}%</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-xl border border-border/60 bg-secondary/30 p-4">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Test Status</p>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Actual Result</p>
                            <Badge className={viewTestCase.actualResult === 'As Expected' ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300' : viewTestCase.actualResult === 'Not As Expected' ? 'border-red-500/25 bg-red-500/10 text-red-300' : 'border-slate-500/20 bg-slate-500/10 text-slate-300'}>
                              {viewTestCase.actualResult || 'BELUM DI-TEST'}
                            </Badge>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Terakhir Diupdate</p>
                            <p className="text-[10px] font-medium text-slate-500">
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
                      <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Test Action</Label>
                      <div className="rounded-xl border border-border/60 bg-secondary/30 p-4 text-sm italic leading-relaxed text-muted-foreground">
                        "{viewTestCase.testAction}"
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Test Steps</Label>
                        <BulletTextView
                          value={viewTestCase.steps}
                          className="min-h-[120px] whitespace-pre-wrap rounded-xl border border-border/60 bg-secondary/30 p-4 text-sm font-medium leading-relaxed text-slate-300 shadow-inner"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Expected Result</Label>
                        <BulletTextView
                          value={viewTestCase.expectedResult}
                          className="min-h-[120px] rounded-xl border border-emerald-500/15 bg-emerald-500/10 p-4 text-sm font-semibold leading-relaxed text-emerald-200 shadow-inner"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Remarks / Catatan</Label>
                      <div className="min-h-[72px] whitespace-pre-wrap rounded-xl border border-amber-500/15 bg-amber-500/10 p-4 text-sm italic text-amber-200 shadow-inner">
                        {viewTestCase.remarks?.trim() || '-'}
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {isBugFixDetail && (
                  <TabsContent value="lifecycle" className="space-y-6 mt-0 outline-none">
                    <div className="rounded-xl border border-border/60 bg-secondary/30 p-5">
                      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Bug Lifecycle</p>
                          <h3 className="mt-1 text-lg font-bold text-slate-100">{viewTestCase.testCaseId}</h3>
                          <p className="mt-1 max-w-2xl text-sm text-slate-500">
                            Perjalanan bug dari laporan awal sampai verified fixed. Status maksimal dari halaman BugFix adalah Ready to Retest; Verified & Fixed terjadi setelah retest berhasil dari halaman Test Case.
                          </p>
                        </div>
                        <Badge variant="outline" className={`gap-1 ${getStatusColor(viewTestCase.status)}`}>
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
                              className={`rounded-md border p-3 ${
                                isDone
                                  ? 'border-emerald-500/20 bg-emerald-500/10'
                                  : isCurrent
                                    ? 'border-cyan-500/20 bg-cyan-500/10'
                                    : 'border-border/50 bg-secondary/20'
                              }`}
                            >
                              <div className="mb-2 flex items-center gap-2">
                                <div className={`flex h-7 w-7 items-center justify-center rounded-full ${
                                  isDone
                                    ? 'bg-emerald-600 text-white'
                                    : isCurrent
                                      ? 'bg-cyan-600 text-white'
                                      : 'bg-slate-700 text-slate-400'
                                }`}>
                                  {isDone ? <CheckCircle2 className="h-4 w-4" /> : isCurrent ? <Clock className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                                </div>
                                <p className="text-sm font-bold text-slate-100">{item.label}</p>
                              </div>
                              <p className="min-h-[36px] text-xs leading-relaxed text-slate-500">{item.description}</p>
                              <p className="mt-3 text-xs font-semibold text-slate-300">{formatDateTime(item.date)}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="rounded-xl border border-border/60 bg-secondary/30 p-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Bug Source</p>
                        <div className="mt-3 space-y-3 text-sm">
                          <div>
                            <p className="text-xs text-muted-foreground">Original Test Case ID</p>
                            <p className="font-mono font-bold text-slate-100">{viewTestCase.sourceTestCaseId || viewTestCase.id}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Actual Result</p>
                            <p className="font-semibold text-red-300">{viewTestCase.actualResult || 'Not As Expected'}</p>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-xl border border-border/60 bg-secondary/30 p-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Status Timing</p>
                        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-xs text-muted-foreground">Reported</p>
                            <p className="font-medium text-slate-300">{formatDateTime(viewTestCase.reportedAt || viewTestCase.createdAt)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Updated</p>
                            <p className="font-medium text-slate-300">{formatDateTime(viewTestCase.updatedAt)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Ready Retest</p>
                            <p className="font-medium text-slate-300">{formatDateTime(viewTestCase.readyAt)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Fixed</p>
                            <p className="font-medium text-slate-300">{formatDateTime(viewTestCase.fixedAt)}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                )}

                <TabsContent value="logs" className="space-y-4 mt-0 outline-none h-full flex flex-col">
                    <div className="flex flex-col flex-1 min-h-0">
                    <div className="mb-4 space-y-3 rounded-2xl border border-teal-500/20 bg-teal-500/5 p-4 shadow-sm">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <div className="p-1.5 rounded-lg bg-teal-500/10">
                          <Wrench className="h-4 w-4 text-teal-400" />
                        </div>
                        <p className="text-xs font-black uppercase tracking-widest text-teal-700 dark:text-teal-200">Intelligence Guide</p>
                        <Badge variant="outline" className="rounded-md border-teal-500/20 bg-teal-500/10 text-[10px] font-bold text-teal-700 uppercase tracking-tighter dark:bg-black/40 dark:text-teal-400">
                          Automation & Manual Capture
                        </Badge>
                      </div>

                      <details className="group rounded-xl border border-border bg-card dark:border-border dark:bg-card">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-2.5 text-[11px] font-bold text-foreground uppercase tracking-widest dark:text-slate-300">
                          <span>Automation Capture</span>
                          <ChevronDown className="h-4 w-4 text-slate-500 transition-transform group-open:rotate-180" />
                        </summary>
                         <div className="border-t border-border px-4 pb-4 pt-3 text-[11px] leading-relaxed text-muted-foreground font-medium dark:border-border/50 dark:text-muted-foreground">
                          <ol className="ml-4 list-decimal space-y-2">
                            <li>Jalankan relay dengan <span className="font-mono text-[11px] text-teal-400 bg-white/5 px-1 rounded">node mini-services/ws-server.js</span>.</li>
                            <li>Salin UUID test case dari tab Informasi Utama, bukan display ID seperti E-124.</li>
                            <li>Pastikan Katalon script mengirim log ke <span className="font-mono text-[11px] text-teal-400 bg-white/5 px-1 rounded">http://127.0.0.1:3001/log</span>.</li>
                            <li>Review hasil dari tab Execution, Console, Network, atau AI Summary.</li>
                          </ol>
                          <a
                            href="/docs/devlog-automation-capture-guide.pdf"
                            target="_blank"
                            rel="noreferrer"
                            className="mt-4 inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-border/60 bg-secondary/50 px-4 text-[10px] font-black uppercase tracking-widest text-slate-300 shadow-lg transition hover:bg-white/10 hover:text-white"
                          >
                            <FileDown className="h-4 w-4" />
                            Panduan PDF
                          </a>
                        </div>
                      </details>

                      <details className="group rounded-xl border border-border bg-card dark:border-border dark:bg-card">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-2.5 text-[11px] font-bold text-foreground uppercase tracking-widest dark:text-slate-300">
                          <span>Manual Capture</span>
                          <ChevronDown className="h-4 w-4 text-slate-500 transition-transform group-open:rotate-180" />
                        </summary>
                         <div className="border-t border-border px-4 pb-4 pt-3 text-[11px] leading-relaxed text-muted-foreground font-medium dark:border-border/50 dark:text-muted-foreground">
                          <ol className="ml-4 list-decimal space-y-2">
                            <li>Masukkan URL website yang ingin dites pada input Manual Capture.</li>
                            <li>Klik Start. QA Desk akan membuka browser capture dan mulai merekam telemetry.</li>
                            <li>Lakukan testing manual di browser yang terbuka.</li>
                            <li>Klik Stop dari QA Desk setelah selesai untuk menyimpan hasil run.</li>
                          </ol>
                        </div>
                      </details>
                    </div>

                    <div className="mb-4 rounded-2xl border border-border/60 bg-secondary/20 p-4 shadow-sm">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2.5">
                            <div className="p-1.5 rounded-lg bg-teal-500/10">
                              <Play className="h-4 w-4 text-teal-400" />
                            </div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Manual Capture Command</p>
                            <Badge
                              variant="outline"
                              className={`rounded-md text-[10px] font-bold uppercase tracking-widest shadow-none ${
                                socketReady
                                  ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                                  : 'border-amber-500/20 bg-amber-500/10 text-amber-400'
                              }`}
                            >
                              {socketReady ? 'Relay Live' : 'Relay Offline'}
                            </Badge>
                            {isManualCaptureActive && (
                              <Badge className="rounded-md bg-teal-500/20 text-[10px] font-black uppercase tracking-tighter text-teal-400 shadow-none border border-teal-500/30">
                                {manualCaptureSessionId?.slice(0, 18)}
                              </Badge>
                            )}
                          </div>
                          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                            <Input
                              value={manualCaptureTargetUrl}
                              onChange={(event) => setManualCaptureTargetUrl(event.target.value)}
                              placeholder="https://target-app.example/path"
                              disabled={isManualCaptureActive}
                              className="h-10 rounded-xl border-border/60 bg-muted/50 text-[11px] text-slate-200 placeholder:text-slate-600 focus:ring-teal-500/40"
                            />
                            {isManualCaptureActive ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-10 shrink-0 gap-2 rounded-xl border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 font-black uppercase tracking-widest text-[10px]"
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
                                className="h-10 shrink-0 gap-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase tracking-widest text-[10px] shadow-lg shadow-teal-900/40"
                                onClick={startManualCapture}
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
                          className="h-10 shrink-0 gap-2 rounded-xl border-border/60 bg-secondary/50 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors"
                          onClick={() => navigator.clipboard.writeText(captureScriptTag)}
                        >
                          <Code2 className="h-4 w-4" />
                          Copy Script
                        </Button>
                      </div>
                    </div>

                    {manualRecording?.frames?.length ? (
                      <div className="mb-4 grid gap-4 rounded-2xl border border-border/60 bg-secondary/20 p-4 shadow-xl lg:grid-cols-[320px_1fr]">
                        <button
                          type="button"
                          className="group relative overflow-hidden rounded-xl border border-border/60 bg-background text-left shadow-2xl"
                          onClick={openRecordingFullscreen}
                        >
                          {selectedRecordingFrame && (
                            <img
                              src={`http://127.0.0.1:3001${selectedRecordingFrame.url}`}
                              alt="Manual capture recording frame"
                              className="aspect-video w-full bg-black object-contain opacity-80 group-hover:opacity-100 transition-opacity"
                            />
                          )}
                          <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition duration-300 group-hover:bg-black/40 group-hover:opacity-100">
                            <span className="inline-flex items-center gap-2 rounded-lg border border-teal-500/20 bg-teal-500/10 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-teal-200 shadow-2xl">
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
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">Screen Analytics</p>
                              <Badge variant="outline" className="rounded-md border-indigo-500/20 bg-indigo-500/10 text-[9px] font-black text-indigo-400 uppercase tracking-tighter">
                                {manualRecording.frames.length} frames
                              </Badge>
                              <Badge variant="outline" className="rounded-md border-border/60 bg-muted/50 text-[9px] font-black text-slate-300 uppercase tracking-tighter">
                                {formatRelativeTime(recordingSeekMs)}
                              </Badge>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="ml-auto h-8 gap-2 rounded-lg border-border/60 bg-secondary/50 px-3 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-white"
                                onClick={openRecordingFullscreen}
                              >
                                <Maximize2 className="h-3.5 w-3.5" />
                                Review
                              </Button>
                            </div>
                            <p className="mt-3 truncate text-[11px] font-medium text-slate-500">
                              {manualRecording.targetUrl || 'Manual capture target'}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {manualRecording.frames
                              .filter((_, index) => index % Math.max(1, Math.floor(manualRecording.frames.length / 12)) === 0)
                              .slice(0, 12)
                              .map((frame) => (
                                <Button
                                  key={frame.file}
                                  type="button"
                                  variant={selectedRecordingFrame?.file === frame.file ? 'default' : 'outline'}
                                  size="sm"
                                  className={`h-8 rounded-lg px-2.5 text-[10px] font-bold ${
                                    selectedRecordingFrame?.file === frame.file 
                                      ? 'bg-teal-600 text-white shadow-lg shadow-teal-900/40' 
                                      : 'border-border/50 bg-secondary/30 text-slate-500 hover:text-slate-200'
                                  }`}
                                  onClick={() => setRecordingSeekMs(frame.relativeMs)}
                                >
                                  {formatRelativeTime(frame.relativeMs)}
                                </Button>
                              ))}
                          </div>
                          <p className="text-[10px] font-medium leading-relaxed text-slate-500 border-l-2 border-teal-500/30 pl-3">
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
                          <h4 className="text-sm font-black text-foreground leading-tight uppercase tracking-tight dark:text-foreground">System DevLog</h4>
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Execution Telemetry</p>
                        </div>
                        {socketReady && (
                          <div className="flex items-center gap-2 ml-4 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 shadow-sm">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-tighter">Live Relay</span>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 bg-muted/70 p-1 rounded-xl border border-border dark:bg-secondary/50 dark:border-border/60">
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`h-8 px-2.5 text-[10px] font-black uppercase tracking-widest gap-2 ${isSummarizing ? 'animate-pulse' : ''} bg-gradient-to-r from-violet-600/20 to-indigo-600/20 text-violet-300 hover:from-violet-600/30 hover:to-indigo-600/30 border border-violet-500/30 rounded-lg`}
                          onClick={generateAISummary}
                          disabled={isSummarizing}
                        >
                          <Sparkles className={`w-3.5 h-3.5 ${isSummarizing ? 'animate-spin' : ''}`} />
                          AI Summary
                        </Button>
                        <Separator orientation="vertical" className="h-5 mx-0.5 bg-white/10" />
                        <Button
                          variant={activeDevLogTab === 'execution' ? 'default' : 'ghost'}
                          size="sm"
                          className={`h-8 rounded-lg px-2.5 text-[10px] font-black uppercase tracking-widest ${activeDevLogTab === 'execution' ? 'bg-teal-500/15 text-teal-200 shadow-xl hover:bg-teal-500/20' : 'text-slate-500 hover:text-slate-300'}`}
                          onClick={() => setActiveDevLogTab('execution')}
                        >
                          Execution
                        </Button>
                        <Button
                          variant={activeDevLogTab === 'console' ? 'default' : 'ghost'}
                          size="sm"
                          className={`h-8 rounded-lg px-2.5 text-[10px] font-black uppercase tracking-widest ${activeDevLogTab === 'console' ? 'bg-teal-500/15 text-teal-200 shadow-xl hover:bg-teal-500/20' : 'text-slate-500 hover:text-slate-300'}`}
                          onClick={() => setActiveDevLogTab('console')}
                        >
                          Console ({consoleLogs.length})
                        </Button>
                        <Button
                          variant={activeDevLogTab === 'network' ? 'default' : 'ghost'}
                          size="sm"
                          className={`h-8 rounded-lg px-2.5 text-[10px] font-black uppercase tracking-widest ${activeDevLogTab === 'network' ? 'bg-teal-500/15 text-teal-200 shadow-xl hover:bg-teal-500/20' : 'text-slate-500 hover:text-slate-300'}`}
                          onClick={() => setActiveDevLogTab('network')}
                        >
                          Network ({networkLogs.length})
                        </Button>
                        <Separator orientation="vertical" className="h-5 mx-0.5 bg-white/10" />
                        <Button
                          variant={loadedRunLabel === 'current' || loadedRunLabel === 'live' ? 'default' : 'ghost'}
                          size="sm"
                          className={`h-8 px-2.5 text-[9px] font-black uppercase tracking-widest rounded-lg ${loadedRunLabel === 'current' || loadedRunLabel === 'live' ? 'bg-teal-600 text-white shadow-lg hover:bg-teal-500' : 'text-slate-500 hover:text-teal-400 hover:bg-teal-500/10'}`}
                          onClick={loadCurrentLogRun}
                          disabled={isLoadingHistory}
                        >
                          Current
                        </Button>
                        <Button
                          variant={loadedRunLabel === 'previous' ? 'default' : 'ghost'}
                          size="sm"
                          className={`h-8 px-2.5 text-[9px] font-black uppercase tracking-widest rounded-lg gap-1.5 ${loadedRunLabel === 'previous' ? 'bg-indigo-600 text-white shadow-lg hover:bg-indigo-500' : 'text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10'}`}
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
                          className="h-8 w-8 p-0 rounded-lg text-slate-600 hover:text-rose-400 hover:bg-rose-500/10"
                          onClick={clearLogs}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex-1 min-h-0 bg-white rounded-2xl border border-slate-300 shadow-xl overflow-hidden flex flex-col font-mono text-[11.5px] dark:bg-background dark:border-border dark:shadow-2xl">
                      {aiSummary && (
                        <div className="bg-indigo-950/30 border-b border-indigo-900/50 p-4 animate-in fade-in slide-in-from-top-2 duration-500">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2 text-indigo-400 font-bold text-[10px] uppercase tracking-wider">
                              <Sparkles className="w-3.5 h-3.5" />
                              AI Result Summary
                            </div>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-indigo-400/50 hover:text-indigo-400" onClick={() => setAiSummary(null)}>
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                          <div className="text-slate-300 leading-relaxed whitespace-pre-wrap text-[11px] prose prose-invert prose-sm max-w-none">
                            {aiSummary}
                          </div>
                        </div>
                      )}
                      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                        {activeDevLogTab === 'execution' ? (
                          <div className="p-5 space-y-0.5">
                            {viewTestCase.stepLogs ? (
                              viewTestCase.stepLogs.split('\n').map((line, index) => {
                                if (!line.trim()) return null;
                                const isError = line.toLowerCase().includes('error') || line.toLowerCase().includes('fail');
                                const isWarning = line.toLowerCase().includes('warn');
                                const isInfo = line.toLowerCase().includes('info') || line.toLowerCase().includes('step');

                                return (
                                  <div key={`${index}-${line}`} className="flex gap-4 hover:bg-white/5 transition-colors px-2 py-0.5 rounded group">
                                    <span className="min-w-[24px] select-none text-right font-bold text-slate-500 opacity-50 group-hover:opacity-100">{index + 1}</span>
                                    <span className={isError ? 'text-rose-400 font-bold' : isWarning ? 'text-amber-400' : isInfo ? 'text-cyan-400' : 'text-emerald-400/90'}>
                                      {line}
                                    </span>
                                  </div>
                                );
                              })
                            ) : (
                              <div className="h-full flex flex-col items-center justify-center py-20 text-slate-600">
                                <Clock className="w-8 h-8 mb-3 opacity-20" />
                                <p className="font-bold tracking-widest text-[10px] uppercase">Awaiting Execution Trace...</p>
                              </div>
                            )}
                            <div ref={logEndRef} className="h-8" />
                          </div>
                        ) : activeDevLogTab === 'console' ? (
                          <div className="divide-y divide-slate-800/50">
                            {consoleLogs.length === 0 ? (
                              <div className="h-full flex flex-col items-center justify-center py-20 text-slate-600">
                                <Clock className="w-8 h-8 mb-3 opacity-20" />
                                <p className="font-bold tracking-widest text-[10px] uppercase">Awaiting Console Output...</p>
                              </div>
                            ) : (
                              consoleLogs.map((log, index) => {
                                const logId = log.id ?? `console-${index}`;
                                const isError = log.level === 'SEVERE' || log.log?.toString().toLowerCase().includes('error');
                                const isWarning = log.level === 'WARNING' || log.log?.toString().toLowerCase().includes('warn');

                                return (
                                  <div key={logId} className={`group ${isError ? 'bg-rose-950/20' : isWarning ? 'bg-amber-950/20' : 'hover:bg-white/5'}`}>
                                    <div
                                      className="flex items-start gap-3 p-2 cursor-pointer transition-colors"
                                      onClick={() => {
                                        seekRecordingFromLog(log);
                                        setExpandedLogId(expandedLogId === logId ? null : logId);
                                      }}
                                    >
                                      <span className="text-slate-600 text-[10px] min-w-[60px] pt-0.5">
                                        {log.timestamp ? new Date(log.timestamp).toLocaleTimeString('id-ID', { hour12: false }) : '-'}
                                      </span>
                                      {typeof log.relativeMs === 'number' && (
                                        <span className="mt-0.5 rounded bg-indigo-950 px-1.5 py-0.5 text-[9px] font-bold text-indigo-300">
                                          {formatRelativeTime(log.relativeMs)}
                                        </span>
                                      )}
                                      <div className="flex-1 break-all">
                                        <span className={isError ? 'text-rose-400' : isWarning ? 'text-amber-400' : 'text-emerald-400/90'}>
                                          {typeof log.log === 'object' ? `${JSON.stringify(log.log).substring(0, 200)}...` : String(log.log ?? '')}
                                        </span>
                                      </div>
                                      {typeof log.log === 'object' && (
                                        <ChevronDown className={`w-3.5 h-3.5 text-slate-600 transition-transform ${expandedLogId === logId ? 'rotate-180' : ''}`} />
                                      )}
                                    </div>
                                    {expandedLogId === logId && typeof log.log === 'object' && (
                                      <div className="px-10 pb-3">
                                        <div className="bg-muted rounded-lg p-3 border border-border shadow-inner">
                                          <pre className="text-emerald-500/80 whitespace-pre-wrap overflow-x-auto">
                                            {JSON.stringify(log.log, null, 2)}
                                          </pre>
                                        </div>
                                      </div>
                                    )}
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
                                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
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
                                  className="h-8 gap-1.5 px-2 text-[10px] font-bold text-slate-400 hover:bg-muted hover:text-white"
                                  onClick={() => setNetworkFilters(DEFAULT_NETWORK_FILTERS)}
                                >
                                  <Filter className="h-3.5 w-3.5" />
                                  Reset
                                </Button>
                              </div>
                              <div className="flex flex-wrap items-center gap-2 text-[10px]">
                                {[
                                  { key: 'showPreflight' as const, label: `Preflight ${networkCategoryCounts.preflight}` },
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
                                    className={`h-7 rounded-full border px-3 text-[10px] font-bold ${
                                      networkFilters[filter.key]
                                        ? 'border-indigo-500/40 bg-indigo-950/60 text-indigo-200 hover:bg-indigo-900/60'
                                        : 'border-border bg-muted text-slate-500 hover:bg-secondary hover:text-foreground'
                                    }`}
                                    onClick={() => toggleNetworkFilter(filter.key)}
                                  >
                                    {filter.label}
                                  </Button>
                                ))}
                                <span className="ml-auto rounded-full border border-cyan-500/20 bg-cyan-950/40 px-2 py-1 font-bold text-cyan-300">
                                  API {networkCategoryCounts.business}
                                </span>
                                {hiddenNetworkCount > 0 && (
                                  <span className="rounded-full border border-border bg-muted px-2 py-1 font-bold text-slate-500">
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
                            <div className="flex-1 overflow-y-auto divide-y divide-slate-800/50">
                              {networkLogs.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center py-20 text-slate-600">
                                  <RefreshCw className="w-8 h-8 mb-3 opacity-20 animate-spin-slow" />
                                  <p className="font-bold tracking-widest text-[10px] uppercase">Waiting for Network Traffic...</p>
                                </div>
                              ) : (
                                networkLogs.map(({ log: net, meta }, index) => {
                                  const logId = net.id ?? `network-${index}`;

                                  return (
                                    <div key={logId} className="group hover:bg-white/5">
                                      <div
                                        className="grid grid-cols-12 gap-2 p-2 cursor-pointer items-center transition-colors"
                                        onClick={() => {
                                          seekRecordingFromLog(net);
                                          setExpandedLogId(expandedLogId === logId ? null : logId);
                                        }}
                                      >
                                        <div className="col-span-1 font-black text-indigo-400 truncate">{getNetworkMethod(net.network)}</div>
                                        <div className="col-span-1 truncate">
                                          <span className={`rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase ${getNetworkCategoryClass(meta.category)}`}>
                                            {meta.label}
                                          </span>
                                        </div>
                                        <div className="col-span-5 min-w-0">
                                          <div className="truncate text-foreground dark:text-slate-300">{meta.pathname.split('/').pop() || meta.pathname || net.network.url}</div>
                                          <div className="truncate text-[9px] text-slate-600">{meta.host}</div>
                                        </div>
                                        <div className="col-span-2 text-center">
                                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${getNetworkStatusClass(net.network)}`}>
                                            {getNetworkStatus(net.network)}
                                          </span>
                                        </div>
                                        <div className="col-span-2 text-right text-slate-500">
                                          <span>{getNetworkDuration(net.network)}</span>
                                          {typeof net.relativeMs === 'number' && (
                                            <span className="ml-2 text-indigo-300">{formatRelativeTime(net.relativeMs)}</span>
                                          )}
                                        </div>
                                        <div className="col-span-1 flex justify-end">
                                          <ChevronDown className={`w-3.5 h-3.5 text-slate-600 transition-transform ${expandedLogId === logId ? 'rotate-180' : ''}`} />
                                        </div>
                                      </div>
                                      {expandedLogId === logId && (
                                        <div className="p-4 bg-muted/50 border-t border-border dark:bg-muted/50 dark:border-border">
                                          <div className="mb-3 rounded-lg border border-border bg-background p-3 dark:border-border dark:bg-card/70">
                                            <p className="mb-1 text-[10px] font-bold uppercase text-slate-500">Full URL</p>
                                            <pre className="whitespace-pre-wrap break-all text-[10px] leading-relaxed text-foreground dark:text-slate-300">
                                              {net.network.url}
                                            </pre>
                                          </div>
                                          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                                            <div className="space-y-3">
                                              <p className="text-[10px] font-bold text-slate-500 uppercase">Headers</p>
                                              <pre className="max-h-[320px] overflow-auto whitespace-pre-wrap break-words rounded border border-border bg-muted p-3 text-[10px] leading-relaxed text-slate-400">
                                                {formatPrettyValue(net.network.headers)}
                                              </pre>
                                            </div>
                                            <div className="space-y-3">
                                              <p className="text-[10px] font-bold text-slate-500 uppercase">Request Payload</p>
                                              <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap break-words rounded border border-border bg-muted p-3 text-[10px] leading-relaxed text-cyan-300/90">
                                                {formatPrettyValue(getRequestPayload(net.network.data))}
                                              </pre>
                                            </div>
                                            <div className="space-y-3">
                                              <p className="text-[10px] font-bold text-slate-500 uppercase">Response</p>
                                              <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap break-words rounded border border-border bg-muted p-3 text-[10px] leading-relaxed text-emerald-500/80">
                                                {formatPrettyValue(getResponsePayload(net.network.data))}
                                              </pre>
                                            </div>
                                          </div>
                                        </div>
                                      )}
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
                        <div className="flex items-center gap-4 text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                            {okLogCount} OK
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                            {errorLogCount} ERRORS
                          </div>
                        </div>
                        <p className="text-[10px] text-slate-500 italic">Auto-scrolling enabled</p>
                      </div>
                    </div>

                    <div className="shrink-0 mt-4 flex items-start gap-3 rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-4 shadow-inner">
                      <div className="mt-0.5 rounded-full border border-indigo-500/20 bg-indigo-500/10 p-1 text-indigo-300 shadow-sm">
                        <HelpCircle className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
                          <span className="font-bold text-indigo-300">DevTools Mode:</span> Tab **Console** menampilkan log browser (JS errors/logs). Tab **Network** menampilkan *XHR/Fetch* traffic. Klik pada baris log untuk melihat detail payload dan headers.
                        </p>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        )}

        {isRecordingFullscreen && manualRecording?.frames?.length && (
          <div
            className={`fixed inset-0 z-[80] flex bg-background text-slate-100 transition-opacity duration-200 ${
              isClosingRecordingFullscreen ? 'opacity-0' : 'opacity-100'
            }`}
          >
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="fixed right-6 top-2 z-[90] h-10 w-10 rounded-full border border-border/60 bg-background/80 p-0 text-slate-300 shadow-2xl backdrop-blur transition hover:scale-105 hover:bg-teal-500/15 hover:text-teal-100"
              onClick={closeRecordingFullscreen}
            >
              <X className="h-4 w-4" />
            </Button>
            <div className={`flex min-w-0 flex-1 flex-col transition duration-200 ${isClosingRecordingFullscreen ? 'scale-[0.985]' : 'scale-100'}`}>
              <div className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Film className="h-4 w-4 text-indigo-300" />
                    <p className="text-xs font-black uppercase tracking-widest text-slate-200">Screen Record Review</p>
                    <Badge variant="outline" className="rounded-md border-indigo-400/30 bg-indigo-950 text-[10px] font-bold text-indigo-200">
                      {formatRelativeTime(recordingSeekMs)}
                    </Badge>
                  </div>
                  <p className="mt-1 truncate text-[11px] text-slate-500">{manualRecording.targetUrl || 'Manual capture target'}</p>
                </div>
                <div className="mr-12 flex items-center gap-1 rounded-md bg-muted p-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-slate-400 hover:bg-secondary hover:text-foreground"
                    onClick={() => updateRecordingZoom(-0.1)}
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </Button>
                  <span className="min-w-[42px] text-center text-[10px] font-bold text-slate-400">
                    {Math.round(recordingZoom * 100)}%
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-slate-400 hover:bg-secondary hover:text-foreground"
                    onClick={() => updateRecordingZoom(0.1)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <div
                ref={recordingViewportRef}
                className={`flex min-h-0 flex-1 overflow-auto bg-black p-4 ${
                  recordingZoom > 1 ? 'cursor-grab active:cursor-grabbing' : 'items-center justify-center'
                }`}
                onPointerDown={startRecordingPan}
                onPointerMove={moveRecordingPan}
                onPointerUp={stopRecordingPan}
                onPointerCancel={stopRecordingPan}
                onPointerLeave={stopRecordingPan}
              >
                {selectedRecordingFrame && (
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
                        height: recordingZoom <= 1 ? 'auto' : 'auto',
                      }}
                    />
                  </div>
                )}
              </div>

              <div className="shrink-0 border-t border-border bg-background p-3">
                <div className="mb-2 flex items-center justify-between gap-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  <span>Timeline</span>
                  <div className="flex items-center gap-2">
                    <span>{manualRecording.frames.length} frames</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 rounded-md border border-border bg-muted p-0 text-slate-400 hover:bg-secondary hover:text-foreground"
                      onClick={() => scrollFullscreenTimeline('left')}
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 rounded-md border border-border bg-muted p-0 text-slate-400 hover:bg-secondary hover:text-foreground"
                      onClick={() => scrollFullscreenTimeline('right')}
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div
                  ref={fullscreenTimelineRef}
                  className="flex gap-1.5 overflow-x-auto pb-1"
                  onWheel={handleTimelineWheel}
                >
                  {manualRecording.frames
                    .filter((_, index) => index % Math.max(1, Math.floor(manualRecording.frames.length / 28)) === 0)
                    .slice(0, 28)
                    .map((frame) => (
                      <Button
                        key={`fullscreen-${frame.file}`}
                        type="button"
                        variant={selectedRecordingFrame?.file === frame.file ? 'default' : 'ghost'}
                        size="sm"
                        className={`h-8 shrink-0 rounded-md px-2 text-[10px] font-bold ${
                          selectedRecordingFrame?.file === frame.file
                            ? 'bg-indigo-500 text-white hover:bg-indigo-500'
                            : 'border border-border bg-muted text-slate-400 hover:bg-secondary hover:text-foreground'
                        }`}
                        onClick={() => setRecordingSeekMs(frame.relativeMs)}
                      >
                        {formatRelativeTime(frame.relativeMs)}
                      </Button>
                    ))}
                </div>
              </div>
            </div>

            <div className={`flex w-[420px] shrink-0 flex-col border-l border-border bg-background transition duration-200 xl:w-[520px] ${isClosingRecordingFullscreen ? 'translate-x-4' : 'translate-x-0'}`}>
              <div className="flex h-24 shrink-0 items-end justify-between gap-4 border-b border-border px-3 pb-3 pt-12 pr-16">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-slate-200">DevTools</p>
                  <p className="text-[10px] text-slate-500">Klik log untuk loncat ke timestamp record.</p>
                </div>
                <div className="flex rounded-md bg-muted p-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={`h-7 px-2 text-[10px] font-bold ${activeDevLogTab === 'console' ? 'bg-teal-500/15 text-teal-100 hover:bg-teal-500/20' : 'text-slate-400 hover:text-white'}`}
                    onClick={() => setActiveDevLogTab('console')}
                  >
                    CONSOLE
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={`h-7 px-2 text-[10px] font-bold ${activeDevLogTab === 'network' ? 'bg-teal-500/15 text-teal-100 hover:bg-teal-500/20' : 'text-slate-400 hover:text-white'}`}
                    onClick={() => setActiveDevLogTab('network')}
                  >
                    NETWORK
                  </Button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto">
                {activeDevLogTab === 'network' ? (
                  <div className="divide-y divide-slate-800/70">
                    {networkLogs.length === 0 ? (
                      <div className="flex h-full flex-col items-center justify-center py-20 text-slate-600">
                        <RefreshCw className="mb-3 h-8 w-8 opacity-20" />
                        <p className="text-[10px] font-bold uppercase tracking-widest">No Network Rows</p>
                      </div>
                    ) : (
                      networkLogs.map(({ log: net, meta }, index) => {
                        const logId = net.id ?? `fullscreen-network-${index}`;

                        return (
                          <div key={logId} className="hover:bg-white/5">
                            <button
                              type="button"
                              className="grid w-full grid-cols-12 items-center gap-2 p-2 text-left"
                              onClick={() => {
                                seekRecordingFromLog(net);
                                setExpandedLogId(expandedLogId === logId ? null : logId);
                              }}
                            >
                              <span className="col-span-2 truncate font-black text-indigo-300">{getNetworkMethod(net.network)}</span>
                              <span className="col-span-2 truncate">
                                <span className={`rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase ${getNetworkCategoryClass(meta.category)}`}>
                                  {meta.label}
                                </span>
                              </span>
                              <span className="col-span-4 min-w-0">
                                <span className="block truncate text-[11px] text-slate-300">{meta.pathname.split('/').pop() || meta.pathname || net.network.url}</span>
                                <span className="block truncate text-[9px] text-slate-600">{meta.host}</span>
                              </span>
                              <span className="col-span-2 text-center">
                                <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${getNetworkStatusClass(net.network)}`}>
                                  {getNetworkStatus(net.network)}
                                </span>
                              </span>
                              <span className="col-span-2 text-right text-[10px] font-bold text-slate-500">
                                {formatRelativeTime(net.relativeMs)}
                              </span>
                            </button>
                            {expandedLogId === logId && (
                              <div className="space-y-2 border-t border-border bg-muted/60 p-3">
                                <pre className="max-h-24 overflow-auto whitespace-pre-wrap break-all rounded border border-border bg-background p-2 text-[10px] text-slate-300">{net.network.url}</pre>
                                <pre className="max-h-44 overflow-auto whitespace-pre-wrap break-words rounded border border-border bg-background p-2 text-[10px] text-emerald-300/80">{formatPrettyValue(getResponsePayload(net.network.data))}</pre>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800/70">
                    {consoleLogs.length === 0 ? (
                      <div className="flex h-full flex-col items-center justify-center py-20 text-slate-600">
                        <Clock className="mb-3 h-8 w-8 opacity-20" />
                        <p className="text-[10px] font-bold uppercase tracking-widest">No Console Rows</p>
                      </div>
                    ) : (
                      consoleLogs.map((log, index) => {
                        const logId = log.id ?? `fullscreen-console-${index}`;
                        const isError = log.level === 'SEVERE' || log.log?.toString().toLowerCase().includes('error');
                        const isWarning = log.level === 'WARNING' || log.log?.toString().toLowerCase().includes('warn');

                        return (
                          <button
                            key={logId}
                            type="button"
                            className={`grid w-full grid-cols-12 gap-2 p-2 text-left hover:bg-white/5 ${isError ? 'bg-rose-950/20' : isWarning ? 'bg-amber-950/20' : ''}`}
                            onClick={() => seekRecordingFromLog(log)}
                          >
                            <span className="col-span-2 text-[10px] font-bold text-slate-500">{formatRelativeTime(log.relativeMs)}</span>
                            <span className={`col-span-10 break-all text-[11px] ${isError ? 'text-rose-300' : isWarning ? 'text-amber-300' : 'text-emerald-300/90'}`}>
                              {typeof log.log === 'object' ? `${JSON.stringify(log.log).substring(0, 240)}...` : String(log.log ?? '')}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
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
              className="h-10 px-6 font-bold gap-2 border-violet-200 text-violet-700 hover:bg-violet-50"
            >
              <Sparkles className="w-4 h-4" /> Refine AI
            </Button>
          )}
          {viewTestCase && (
            <Button
              variant="outline"
              onClick={openEvidenceReport}
              className="h-10 px-6 font-bold gap-2 border-sky-200 text-sky-700 hover:bg-sky-50"
            >
              <FileDown className="w-4 h-4" /> Evidence Report
            </Button>
          )}
          {viewTestCase && (
            <Button onClick={() => { onOpenChange(false); onEdit(viewTestCase); }} className="h-10 px-6 font-bold gap-2 bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-100">
              <Edit3 className="w-4 h-4" /> Edit Test Case
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
