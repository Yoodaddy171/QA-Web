import { db } from '@/lib/db';
import { devlogDb } from '@/lib/devlog-db';
import {
  adaptAutomationEventToLogEntry,
  type AutomationEventV1,
} from '@/lib/client/automation/automation-event-client';
import { NextRequest, NextResponse } from 'next/server';
import { renderHtml } from './evidence-renderer';
import fs from 'node:fs/promises';
import path from 'path';
import os from 'os';

export const maxDuration = 60;

export type EvidenceRecord = {
  id: string;
  sourceTestCaseId?: string | null;
  testCaseId: string;
  page: string;
  subMenu?: string | null;
  testType: string;
  testAction: string;
  steps: string;
  expectedResult: string;
  actualResult?: string | null;
  status: string;
  priority?: string | null;
  remarks?: string | null;
  projectId: string;
  moduleId?: string | null;
  createdAt: Date;
  updatedAt: Date;
  project?: { name: string } | null;
  module?: { name: string } | null;
};

type RecordingFrame = {
  file: string;
  relativeMs: number;
  timestamp?: string;
};

type RecordingMetadata = {
  mode?: 'frame' | 'video' | 'hybrid';
  sessionId: string;
  testCaseId: string;
  targetUrl?: string | null;
  startedAt?: string;
  stoppedAt?: string | null;
  video?: {
    file?: string;
    url?: string;
    mimeType?: string;
    startedAtRelativeMs?: number;
    durationMs?: number;
    status?: string;
  };
  frames: RecordingFrame[];
};

export type EvidenceLog = {
  id: string;
  tab: 'console' | 'network';
  order: number;
  category?: 'business' | 'preflight' | 'static' | 'telemetry' | 'data' | 'other';
  host?: string;
  relativeMs?: number;
  level?: string;
  message: string;
  method?: string;
  status?: number;
  url?: string;
  detail?: unknown;
};

function normalizeRelativeMs(value: unknown) {
  const relativeMs = Number(value);
  if (!Number.isFinite(relativeMs) || relativeMs < 0 || relativeMs > 12 * 60 * 60 * 1000) return undefined;
  return relativeMs;
}

export type EvidenceFrame = {
  time: string;
  relativeMs: number;
  src: string;
};

export type EvidenceVideo = {
  src: string;
  sizeBytes: number;
  mimeType: string;
};

const RUNTIME_DIR = process.env.QA_RUNTIME_DIR
  || path.join(process.env.LOCALAPPDATA || os.tmpdir(), 'web-qa-runtime');
const RECORDINGS_DIR = path.join(/*turbopackIgnore: true*/ RUNTIME_DIR, 'recordings');
const LEGACY_RECORDINGS_DIR = path.join(/*turbopackIgnore: true*/ process.cwd(), 'mini-services', 'recordings');
const LOGS_DIR = path.join(/*turbopackIgnore: true*/ process.cwd(), 'mini-services', 'logs');
const IMPORTANT_LOG_PATTERN = /error|failed|failure|exception|timeout|severe|warn|warning|status["':= ]+(4|5)\d\d|success[:= ]+false/i;

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDate(value?: string | Date | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

function formatRelativeTime(relativeMs?: number) {
  if (typeof relativeMs !== 'number') return '-';
  const totalSeconds = Math.floor(Math.max(0, relativeMs) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function compactLogLine(line: string) {
  try {
    const parsed = JSON.parse(line);
    const network = parsed.network;
    return [
      formatRelativeTime(parsed.relativeMs),
      parsed.level,
      network?.method,
      network?.status ? `status=${network.status}` : '',
      network?.url,
      parsed.log,
    ].filter(Boolean).join(' | ');
  } catch {
    return line.trim();
  }
}

function parseEvidenceLog(line: string, index: number): EvidenceLog | null {
  try {
    const parsed = JSON.parse(line);
    if (parsed.network) {
      const network = parsed.network;
      const meta = getNetworkMeta(network);
      return {
        id: parsed.id || `network-${index}`,
        tab: 'network',
        order: index,
        category: meta.category,
        host: meta.host,
        relativeMs: normalizeRelativeMs(parsed.relativeMs),
        message: network.url || parsed.log || 'Network Trace',
        method: network.method || network.event,
        status: typeof network.status === 'number' ? network.status : undefined,
        url: network.url,
        detail: {
          headers: network.headers,
          data: network.data,
          duration: network.duration,
          success: network.success,
        },
      };
    }

    return {
      id: parsed.id || `console-${index}`,
      tab: 'console',
      order: index,
      relativeMs: normalizeRelativeMs(parsed.relativeMs),
      level: parsed.level,
      message: String(parsed.log || parsed.console || ''),
      detail: parsed.log,
    };
  } catch {
    const text = line.trim();
    if (!text) return null;
    return {
      id: `log-${index}`,
      tab: 'console',
      order: index,
      message: text,
      detail: text,
    };
  }
}

function parseNetworkUrl(url: string) {
  if (url.startsWith('data:')) return { host: 'data:', pathname: 'data:', protocol: 'data:' };
  if (url.startsWith('blob:')) return { host: 'blob:', pathname: 'blob:', protocol: 'blob:' };

  try {
    const parsed = new URL(url, 'http://local.invalid');
    return { host: parsed.hostname || 'local', pathname: parsed.pathname || '/', protocol: parsed.protocol };
  } catch {
    return { host: 'unknown', pathname: url, protocol: '' };
  }
}

function getNetworkMeta(network: { method?: string; event?: string; url?: string }) {
  const url = network.url || '';
  const parsed = parseNetworkUrl(url);
  const method = (network.method || network.event || 'TRACE').toUpperCase();
  const pathname = parsed.pathname.toLowerCase();
  const isLikelyApi =
    pathname.startsWith('/api/') ||
    pathname.startsWith('/graphql') ||
    pathname.startsWith('/rest/') ||
    pathname.startsWith('/rpc/') ||
    /^\/v\d+\//.test(pathname) ||
    pathname.includes('/api/') ||
    pathname.includes('/ajax/') ||
    pathname.includes('/service/') ||
    pathname.includes('/oauth') ||
    pathname.includes('/auth') ||
    pathname.includes('/token') ||
    !['GET', 'HEAD', 'OPTIONS', 'TRACE'].includes(method);

  if (parsed.protocol === 'data:' || parsed.protocol === 'blob:') return { category: 'data' as const, host: parsed.host };
  if (method === 'OPTIONS') return { category: 'preflight' as const, host: parsed.host };
  if (pathname.includes('/cdn-cgi/rum') || pathname.includes('/collect') || pathname.includes('/analytics')) return { category: 'telemetry' as const, host: parsed.host };
  if (isLikelyApi) return { category: 'business' as const, host: parsed.host };
  if (
    pathname.includes('/_next/') ||
    pathname.includes('/assets/') ||
    pathname.includes('/public/') ||
    pathname.includes('/media/') ||
    pathname.includes('/images/') ||
    /\.(js|css|png|jpe?g|svg|gif|webp|ico|woff2?|ttf|map|json)$/i.test(pathname)
  ) return { category: 'static' as const, host: parsed.host };
  return { category: 'other' as const, host: parsed.host };
}

function buildRunLogs(raw: string, logPath: string | null) {
  const lines = raw.split('\n').filter(line => line.trim());
  const important = lines.filter(line => IMPORTANT_LOG_PATTERN.test(line)).slice(-35);
  const tail = lines.slice(-35);
  const networkLines = lines.filter(line => {
    try {
      return Boolean(JSON.parse(line).network);
    } catch {
      return false;
    }
  });
  const selectedSet = new Set([...networkLines, ...important, ...tail]);
  const selectedRaw = lines.filter(line => selectedSet.has(line)).slice(0, 500);
  const selected = selectedRaw.map(compactLogLine).slice(-60);
  const logs = selectedRaw
    .map(parseEvidenceLog)
    .filter((log): log is EvidenceLog => Boolean(log))
    .slice(0, 300);

  return { raw, path: logPath, selected, logs };
}
async function readRunLogs(candidateIds: string[]) {
  for (const id of candidateIds) {
    const logPath = path.join(/*turbopackIgnore: true*/ LOGS_DIR, `${encodeURIComponent(id)}.current.jsonl`);
    try { return buildRunLogs(await fs.readFile(logPath, 'utf8'), logPath); } catch (error: any) { if (error.code !== 'ENOENT') throw error; }
  }
  return buildRunLogs('', null);
}

async function readRunLogsFromDatabase(candidateIds: string[]) {
  if (!devlogDb) return null;
  const run = await devlogDb.automationRun.findFirst({
    where: { testCaseId: { in: candidateIds } },
    orderBy: { startedAt: 'desc' },
    select: {
      events: {
        orderBy: { sequence: 'asc' },
        take: 500,
        select: { payload: true },
      },
    },
  });
  if (!run) return null;
  const raw = run.events.map(row => JSON.stringify(adaptAutomationEventToLogEntry({
    type: 'automation.event',
    schemaVersion: 1,
    event: row.payload as unknown as AutomationEventV1,
  }))).join('\n');
  return buildRunLogs(raw, null);
}

async function getRecordingMetadataCandidates(testCaseIds: string[]) {
  const metadataItems: Array<{ metadataPath: string; mtimeMs: number }> = [];

  for (const root of [RECORDINGS_DIR, LEGACY_RECORDINGS_DIR]) {
    for (const testCaseId of testCaseIds) {
      const testCaseDir = path.join(/*turbopackIgnore: true*/ root, encodeURIComponent(testCaseId));
      let entries;
      try { entries = await fs.readdir(testCaseDir, { withFileTypes: true }); } catch (error: any) { if (error.code === 'ENOENT') continue; throw error; }
      const sessionDirs = entries.filter(entry => entry.isDirectory()).map(entry => path.join(/*turbopackIgnore: true*/ testCaseDir, entry.name));

      for (const sessionDir of sessionDirs) {
        const metadataPath = path.join(/*turbopackIgnore: true*/ sessionDir, 'metadata.json');
        try { metadataItems.push({ metadataPath, mtimeMs: (await fs.stat(metadataPath)).mtimeMs }); } catch (error: any) { if (error.code !== 'ENOENT') throw error; }
      }
    }
  }

  return metadataItems.sort((a, b) => b.mtimeMs - a.mtimeMs);
}

async function readLatestRecording(testCaseIds: string[]) {
  for (const item of await getRecordingMetadataCandidates(testCaseIds)) {
    try {
      const metadata = JSON.parse(await fs.readFile(item.metadataPath, 'utf8')) as RecordingMetadata;
      if (!metadata.frames?.length && !metadata.video?.url) continue;
      return {
        metadata,
        framesDir: path.join(/*turbopackIgnore: true*/ path.dirname(item.metadataPath), 'frames'),
        videoDir: path.join(/*turbopackIgnore: true*/ path.dirname(item.metadataPath), 'video'),
      };
    } catch (_) {}
  }

  return null;
}

async function readLatestRecordingFromDatabase(testCaseIds: string[]) {
  if (!devlogDb) return null;
  const recording = await devlogDb.recording.findFirst({
    where: { testCaseId: { in: testCaseIds } },
    orderBy: { startedAt: 'desc' },
    select: { metadata: true, mediaRoot: true },
  });
  if (!recording) return null;
  const metadata = recording.metadata as unknown as RecordingMetadata;
  return {
    metadata,
    framesDir: path.join(/*turbopackIgnore: true*/ recording.mediaRoot, 'frames'),
    videoDir: path.join(/*turbopackIgnore: true*/ recording.mediaRoot, 'video'),
  };
}

function extractImportantRelativeTimes(rawLogs: string) {
  return rawLogs
    .split('\n')
    .map(line => {
      try {
        const parsed = JSON.parse(line);
        return IMPORTANT_LOG_PATTERN.test(line) && typeof parsed.relativeMs === 'number' ? parsed.relativeMs : null;
      } catch {
        return null;
      }
    })
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
}

function pickFrames(frames: RecordingFrame[], importantTimes: number[]) {
  if (!frames.length) return [];

  const sortedFrames = [...frames].sort((a, b) => a.relativeMs - b.relativeMs);
  const targets = [
    sortedFrames[0].relativeMs,
    sortedFrames[Math.floor(sortedFrames.length * 0.35)]?.relativeMs,
    sortedFrames[Math.floor(sortedFrames.length * 0.7)]?.relativeMs,
    ...importantTimes.slice(-3),
    sortedFrames[sortedFrames.length - 1].relativeMs,
  ].filter((value): value is number => typeof value === 'number');

  const selected = targets.map(target => (
    sortedFrames.reduce((closest, frame) => (
      Math.abs(frame.relativeMs - target) < Math.abs(closest.relativeMs - target) ? frame : closest
    ), sortedFrames[0])
  ));

  return Array.from(new Map(selected.map(frame => [frame.file, frame])).values()).slice(0, 8);
}

async function imageDataUri(filePath: string) {
  try { return `data:image/jpeg;base64,${(await fs.readFile(filePath)).toString('base64')}`; } catch (error: any) { if (error.code === 'ENOENT') return ''; throw error; }
}

async function videoDataUri(filePath: string, mimeType = 'video/webm'): Promise<EvidenceVideo | null> {
  try {
    const [stat, file] = await Promise.all([fs.stat(filePath), fs.readFile(filePath)]);
    return { src: `data:${mimeType};base64,${file.toString('base64')}`, sizeBytes: stat.size, mimeType };
  } catch (error: any) { if (error.code === 'ENOENT') return null; throw error; }
}

function toJsonScript(value: unknown) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

async function findRecord(requestedId: string, projectId: string): Promise<{ record: EvidenceRecord | null; type: 'TestCase' | 'BugFix' }> {
  const testCase = await db.testCase.findFirst({
    where: { projectId, OR: [{ id: requestedId }, { testCaseId: requestedId }] },
    include: { project: { select: { name: true } }, module: { select: { name: true } } },
  });

  if (testCase) return { record: testCase, type: 'TestCase' };

  const bugFix = await db.bugFix.findFirst({
    where: { projectId, OR: [{ id: requestedId }, { testCaseId: requestedId }, { sourceTestCaseId: requestedId }] },
    include: { project: { select: { name: true } }, module: { select: { name: true } } },
  });

  return { record: bugFix, type: 'BugFix' };
}


export async function GET(req: NextRequest) {
  try {
    const requestedId = req.nextUrl.searchParams.get('testCaseId')?.trim();
    const projectId = req.nextUrl.searchParams.get('projectId')?.trim();
    const shouldDownload = req.nextUrl.searchParams.get('download') === '1';
    if (!requestedId) return NextResponse.json({ error: 'testCaseId is required' }, { status: 400 });
    if (!projectId) return NextResponse.json({ error: 'projectId is required' }, { status: 400 });

    const { record, type } = await findRecord(requestedId, projectId);
    if (!record) return NextResponse.json({ error: 'Test case atau bug fix tidak ditemukan.' }, { status: 404 });

    const candidateIds = Array.from(new Set([
      requestedId,
      record.id,
      record.testCaseId,
      record.sourceTestCaseId || '',
    ].filter(Boolean)));
    const { raw, logs } = await readRunLogsFromDatabase(candidateIds) || await readRunLogs(candidateIds);
    const recording = await readLatestRecordingFromDatabase(candidateIds) || await readLatestRecording(candidateIds);
    const pickedFrames = recording ? pickFrames(recording.metadata.frames, extractImportantRelativeTimes(raw)) : [];
    const frames = recording ? (await Promise.all(pickedFrames.map(async frame => ({
      time: formatRelativeTime(frame.relativeMs),
      relativeMs: frame.relativeMs,
      src: await imageDataUri(path.join(/*turbopackIgnore: true*/ recording.framesDir, frame.file)),
    })))).filter(frame => frame.src) : [];
    const video = recording?.metadata.video?.file
      ? await videoDataUri(
          path.join(/*turbopackIgnore: true*/ recording.videoDir, recording.metadata.video.file),
          recording.metadata.video.mimeType || 'video/webm'
        )
      : null;
    const html = renderHtml({ record, type, logs, recording, frames, video });
    const safeName = record.testCaseId.replace(/[^a-z0-9-_]/gi, '_');

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `${shouldDownload ? 'attachment' : 'inline'}; filename="qa-evidence-${safeName}.html"`,
      },
    });
  } catch (error: any) {
    console.error('GET /api/evidence error:', error);
    return NextResponse.json({ error: `Failed to generate evidence report: ${error.message}` }, { status: 500 });
  }
}
