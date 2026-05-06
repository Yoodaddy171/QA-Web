import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';

export const maxDuration = 60;

type EvidenceRecord = {
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
  sessionId: string;
  testCaseId: string;
  targetUrl?: string | null;
  startedAt?: string;
  stoppedAt?: string | null;
  frames: RecordingFrame[];
};

type EvidenceLog = {
  id: string;
  tab: 'console' | 'network';
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

type EvidenceFrame = {
  time: string;
  relativeMs: number;
  src: string;
};

const RUNTIME_DIR = process.env.QA_RUNTIME_DIR
  || path.join(process.env.LOCALAPPDATA || os.tmpdir(), 'web-qa-runtime');
const RECORDINGS_DIR = path.join(RUNTIME_DIR, 'recordings');
const LEGACY_RECORDINGS_DIR = path.join(process.cwd(), 'mini-services', 'recordings');
const LOGS_DIR = path.join(process.cwd(), 'mini-services', 'logs');
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
        category: meta.category,
        host: meta.host,
        relativeMs: parsed.relativeMs,
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
      relativeMs: parsed.relativeMs,
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

  if (parsed.protocol === 'data:' || parsed.protocol === 'blob:') return { category: 'data' as const, host: parsed.host };
  if (method === 'OPTIONS') return { category: 'preflight' as const, host: parsed.host };
  if (pathname.includes('/cdn-cgi/rum') || pathname.includes('/collect') || pathname.includes('/analytics')) return { category: 'telemetry' as const, host: parsed.host };
  if (
    pathname.includes('/_next/') ||
    pathname.includes('/assets/') ||
    pathname.includes('/public/') ||
    pathname.includes('/media/') ||
    pathname.includes('/images/') ||
    /\.(js|css|png|jpe?g|svg|gif|webp|ico|woff2?|ttf|map|json)$/i.test(pathname)
  ) return { category: 'static' as const, host: parsed.host };
  if (pathname.startsWith('/api/')) return { category: 'business' as const, host: parsed.host };
  return { category: 'other' as const, host: parsed.host };
}

function readRunLogs(candidateIds: string[]) {
  const logPath = candidateIds
    .map(id => path.join(LOGS_DIR, `${id}.current.jsonl`))
    .find(candidate => fs.existsSync(candidate));

  if (!logPath) return { raw: '', path: null as string | null, selected: [] as string[], logs: [] as EvidenceLog[] };

  const raw = fs.readFileSync(logPath, 'utf8');
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

function getRecordingMetadataCandidates(testCaseIds: string[]) {
  const metadataItems: Array<{ metadataPath: string; mtimeMs: number }> = [];

  for (const root of [RECORDINGS_DIR, LEGACY_RECORDINGS_DIR]) {
    for (const testCaseId of testCaseIds) {
      const testCaseDir = path.join(root, encodeURIComponent(testCaseId));
      if (!fs.existsSync(testCaseDir)) continue;

      const sessionDirs = fs.readdirSync(testCaseDir, { withFileTypes: true })
        .filter(entry => entry.isDirectory())
        .map(entry => path.join(testCaseDir, entry.name));

      for (const sessionDir of sessionDirs) {
        const metadataPath = path.join(sessionDir, 'metadata.json');
        if (!fs.existsSync(metadataPath)) continue;
        metadataItems.push({ metadataPath, mtimeMs: fs.statSync(metadataPath).mtimeMs });
      }
    }
  }

  return metadataItems.sort((a, b) => b.mtimeMs - a.mtimeMs);
}

function readLatestRecording(testCaseIds: string[]) {
  for (const item of getRecordingMetadataCandidates(testCaseIds)) {
    try {
      const metadata = JSON.parse(fs.readFileSync(item.metadataPath, 'utf8')) as RecordingMetadata;
      if (!metadata.frames?.length) continue;
      return {
        metadata,
        framesDir: path.join(path.dirname(item.metadataPath), 'frames'),
      };
    } catch (_) {}
  }

  return null;
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

function imageDataUri(filePath: string) {
  if (!fs.existsSync(filePath)) return '';
  return `data:image/jpeg;base64,${fs.readFileSync(filePath).toString('base64')}`;
}

function toJsonScript(value: unknown) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

async function findRecord(requestedId: string): Promise<{ record: EvidenceRecord | null; type: 'TestCase' | 'BugFix' }> {
  const testCase = await db.testCase.findFirst({
    where: { OR: [{ id: requestedId }, { testCaseId: requestedId }] },
    include: { project: { select: { name: true } }, module: { select: { name: true } } },
  });

  if (testCase) return { record: testCase, type: 'TestCase' };

  const bugFix = await db.bugFix.findFirst({
    where: { OR: [{ id: requestedId }, { testCaseId: requestedId }, { sourceTestCaseId: requestedId }] },
    include: { project: { select: { name: true } }, module: { select: { name: true } } },
  });

  return { record: bugFix, type: 'BugFix' };
}

function renderHtml(params: {
  record: EvidenceRecord;
  type: 'TestCase' | 'BugFix';
  logs: EvidenceLog[];
  recording: ReturnType<typeof readLatestRecording>;
  frames: EvidenceFrame[];
}) {
  const { record, type, logs, recording, frames } = params;
  const statusClass = /done|fixed|as expected/i.test(`${record.status} ${record.actualResult}`) ? 'pass' : /fail|not as expected/i.test(`${record.status} ${record.actualResult}`) ? 'fail' : 'neutral';
  const initialFrame = frames[0];

  return `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>QA Evidence - ${escapeHtml(record.testCaseId)}</title>
  <style>
    body{margin:0;background:#f8fafc;color:#0f172a;font-family:Inter,Segoe UI,Arial,sans-serif;line-height:1.55}
    .wrap{max-width:1120px;margin:0 auto;padding:32px}
    .hero{background:#020617;color:white;border-radius:18px;padding:28px;box-shadow:0 24px 60px rgba(15,23,42,.18)}
    .eyebrow{font-size:11px;text-transform:uppercase;letter-spacing:.16em;color:#94a3b8;font-weight:800}
    h1{margin:8px 0 4px;font-size:30px;line-height:1.1}
    h2{margin:28px 0 12px;font-size:17px}
    .grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-top:18px}
    .box{background:white;border:1px solid #e2e8f0;border-radius:12px;padding:14px}
    .box b{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin-bottom:4px}
    .status{display:inline-flex;border-radius:999px;padding:4px 10px;font-size:12px;font-weight:800}
    .pass{background:#dcfce7;color:#166534}.fail{background:#fee2e2;color:#991b1b}.neutral{background:#e0f2fe;color:#075985}
    pre{white-space:pre-wrap;background:#0f172a;color:#dbeafe;border-radius:12px;padding:16px;overflow:auto}
    .evidence-section{width:min(96vw,1420px);margin-left:50%;transform:translateX(-50%)}
    .viewer{display:grid;grid-template-columns:minmax(0,1fr) 480px;height:min(820px,84vh);min-height:620px;background:#020617;border-radius:16px;overflow:hidden;border:1px solid #1e293b}
    .screen{display:flex;flex-direction:column;min-width:0;min-height:0;background:#000}
    .screen-head,.dev-head{display:flex;align-items:center;justify-content:space-between;height:56px;padding:0 16px;border-bottom:1px solid #1e293b;background:#020617;color:white}
    .screen-body{min-height:0;flex:1 1 auto;display:flex;align-items:center;justify-content:center;padding:18px;overflow:hidden}
    .screen-body img{max-width:100%;max-height:100%;object-fit:contain;box-shadow:0 18px 50px rgba(0,0,0,.45)}
    .timeline{height:76px;flex:0 0 76px;border-top:1px solid #1e293b;background:#020617;padding:10px 12px}
    .timeline-label{display:flex;justify-content:space-between;color:#64748b;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.12em;margin-bottom:8px}
    .timeline-row{display:flex;gap:8px;overflow-x:auto;overflow-y:hidden;padding-bottom:8px;scrollbar-color:#475569 #020617;scrollbar-width:thin}
    button{font:inherit;cursor:pointer}
    .time-btn,.tab-btn{border:1px solid #334155;background:#0f172a;color:#cbd5e1;border-radius:8px;padding:7px 10px;font-size:12px;font-weight:800;white-space:nowrap}
    .time-btn.active,.tab-btn.active{background:#6366f1;border-color:#6366f1;color:white}
    .devtools{min-width:0;min-height:0;border-left:1px solid #1e293b;background:#020617;color:#dbeafe;display:flex;flex-direction:column}
    .tabs{display:flex;gap:6px;background:#0f172a;border-radius:8px;padding:4px}
    .filters{display:flex;flex-wrap:wrap;gap:6px;border-bottom:1px solid #1e293b;background:#020617;padding:10px}
    .filters input,.filters select{min-width:0;border:1px solid #334155;background:#0f172a;color:#dbeafe;border-radius:8px;padding:7px 8px;font-size:12px;font-weight:700}
    .filters input{flex:1 1 140px}.filters select{flex:0 0 112px}
    .filter-btn{border:1px solid #334155;background:#0f172a;color:#94a3b8;border-radius:999px;padding:6px 9px;font-size:11px;font-weight:900}
    .filter-btn.active{border-color:#6366f1;background:#312e81;color:#e0e7ff}
    .hidden-count{width:100%;color:#64748b;font-size:11px;font-weight:800}
    .log-list{min-height:0;flex:1 1 auto;overflow:auto}
    .log-row{display:grid;grid-template-columns:62px 64px minmax(0,1fr) 54px;gap:8px;align-items:center;width:100%;border:0;border-bottom:1px solid #1e293b;background:transparent;color:#cbd5e1;text-align:left;padding:10px}
    .log-row:hover{background:#0f172a}.log-row.active{background:#172554}
    .method{font-weight:900;color:#a5b4fc}.status-code{justify-self:center;border-radius:6px;background:#064e3b;color:#6ee7b7;padding:2px 6px;font-size:11px;font-weight:900}.status-code.err{background:#7f1d1d;color:#fecaca}
    .url{min-width:0}.url b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}.url small{display:block;color:#64748b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .detail-panel{height:220px;flex:0 0 220px;border-top:1px solid #1e293b;background:#0f172a;display:flex;flex-direction:column;min-height:0}
    .detail-tabs{display:flex;gap:6px;padding:8px;border-bottom:1px solid #1e293b}
    .detail-tab{border:1px solid #334155;background:#020617;color:#94a3b8;border-radius:8px;padding:6px 9px;font-size:11px;font-weight:900}
    .detail-tab.active{background:#0369a1;border-color:#0ea5e9;color:white}
    .log-detail{min-height:0;flex:1;overflow:auto;padding:12px;color:#bfdbfe;font-family:Consolas,monospace;font-size:11px;white-space:pre-wrap}
    .empty{padding:48px 18px;text-align:center;color:#64748b}
    .muted{color:#64748b}.section{background:white;border:1px solid #e2e8f0;border-radius:16px;padding:20px;margin-top:18px}
    @media(max-width:980px){.evidence-section{width:auto;margin-left:0;transform:none}.viewer{grid-template-columns:1fr;height:auto}.devtools{border-left:0;border-top:1px solid #1e293b}.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
    @media print{body{background:white}.wrap{padding:0}.hero,.section,.box{box-shadow:none;break-inside:avoid}.viewer{display:block}.devtools{display:none}}
  </style>
</head>
<body>
  <main class="wrap">
    <section class="hero">
      <div class="eyebrow">QA Evidence Report</div>
      <h1>${escapeHtml(record.testCaseId)} - ${escapeHtml(record.testAction)}</h1>
      <p class="muted">${escapeHtml(type)} generated ${escapeHtml(formatDate(new Date()))}</p>
      <span class="status ${statusClass}">${escapeHtml(record.status)}${record.actualResult ? ` / ${escapeHtml(record.actualResult)}` : ''}</span>
    </section>

    <section class="grid">
      <div class="box"><b>Project</b>${escapeHtml(record.project?.name || record.projectId)}</div>
      <div class="box"><b>Module</b>${escapeHtml(record.module?.name || record.moduleId || '-')}</div>
      <div class="box"><b>Page</b>${escapeHtml(record.page)}</div>
      <div class="box"><b>Sub Menu</b>${escapeHtml(record.subMenu || '-')}</div>
      <div class="box"><b>Type</b>${escapeHtml(record.testType)}</div>
      <div class="box"><b>Priority</b>${escapeHtml(record.priority || '-')}</div>
      <div class="box"><b>Updated</b>${escapeHtml(formatDate(record.updatedAt))}</div>
      <div class="box"><b>Recording</b>${escapeHtml(recording ? `${recording.metadata.frames.length} frames` : 'No recording')}</div>
    </section>

    <section class="section">
      <h2>Test Steps</h2>
      <pre>${escapeHtml(record.steps)}</pre>
      <h2>Expected Result</h2>
      <pre>${escapeHtml(record.expectedResult)}</pre>
      <h2>Actual Result</h2>
      <pre>${escapeHtml(record.actualResult || 'Belum ada actual result.')}</pre>
      <h2>Remarks</h2>
      <pre>${escapeHtml(record.remarks || '-')}</pre>
    </section>

    <section class="section evidence-section">
      <h2>Interactive Screen Recording & DevTools</h2>
      ${frames.length ? `
      <div class="viewer">
        <div class="screen">
          <div class="screen-head">
            <div><b>Screen Record Review</b><br><small class="muted">${escapeHtml(recording?.metadata.targetUrl || '-')}</small></div>
            <span id="currentTime" class="status neutral">${escapeHtml(initialFrame?.time || '-')}</span>
          </div>
          <div class="screen-body">
            <img id="frameImage" src="${initialFrame?.src || ''}" alt="Selected evidence frame" />
          </div>
          <div class="timeline">
            <div class="timeline-label"><span>Timeline</span><span>${escapeHtml(frames.length)} frames</span></div>
            <div class="timeline-row" id="timeline"></div>
          </div>
        </div>
        <div class="devtools">
          <div class="dev-head">
            <div><b>DevTools</b><br><small class="muted">Klik log untuk pindah timestamp.</small></div>
            <div class="tabs">
              <button class="tab-btn active" data-tab="network">Network</button>
              <button class="tab-btn" data-tab="console">Console</button>
            </div>
          </div>
          <div class="filters" id="networkFilters">
            <input id="networkSearch" placeholder="Search URL/status..." />
            <select id="hostFilter"><option value="all">All hosts</option></select>
            <select id="methodFilter"><option value="all">All methods</option></select>
            <button class="filter-btn" data-filter="preflight">Preflight</button>
            <button class="filter-btn" data-filter="static">Static</button>
            <button class="filter-btn" data-filter="telemetry">Telemetry</button>
            <button class="filter-btn" data-filter="other">Other</button>
            <div class="hidden-count" id="hiddenCount"></div>
          </div>
          <div class="log-list" id="logList"></div>
          <div class="detail-panel">
            <div class="detail-tabs" id="detailTabs">
              <button class="detail-tab active" data-detail="headers">Headers</button>
              <button class="detail-tab" data-detail="payload">Payload</button>
              <button class="detail-tab" data-detail="response">Response</button>
            </div>
            <div class="log-detail" id="logDetail">Pilih salah satu log untuk melihat detail.</div>
          </div>
        </div>
      </div>` : '<p class="muted">Tidak ada screen recording untuk testcase ini.</p>'}
    </section>

    <section class="section">
      <h2>Important DevTools / Automation Logs</h2>
      <p class="muted">Log lengkap yang relevan tersedia di viewer interaktif di atas.</p>
    </section>
  </main>
  <script>
    const frames = ${toJsonScript(frames)};
    const logs = ${toJsonScript(logs)};
    let activeFrameIndex = 0;
    let activeTab = 'network';
    let activeLogId = null;
    let activeDetailTab = 'headers';
    const networkFilter = { search: '', host: 'all', method: 'all', preflight: false, static: false, telemetry: false, other: false };

    const byId = (id) => document.getElementById(id);
    const fmt = (value) => value == null ? '-' : String(value);
    const formatLogTime = (relativeMs) => {
      if (typeof relativeMs !== 'number') return '-';
      const totalSeconds = Math.floor(Math.max(0, relativeMs) / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      return minutes + ':' + String(seconds).padStart(2, '0');
    };
    const closestFrameIndex = (relativeMs) => {
      if (!frames.length || typeof relativeMs !== 'number') return activeFrameIndex;
      return frames.reduce((best, frame, index) => (
        Math.abs(frame.relativeMs - relativeMs) < Math.abs(frames[best].relativeMs - relativeMs) ? index : best
      ), 0);
    };
    const renderFrame = (index) => {
      if (!frames.length) return;
      activeFrameIndex = Math.max(0, Math.min(frames.length - 1, index));
      byId('frameImage').src = frames[activeFrameIndex].src;
      byId('currentTime').textContent = frames[activeFrameIndex].time;
      document.querySelectorAll('.time-btn').forEach((button, idx) => button.classList.toggle('active', idx === activeFrameIndex));
    };
    const renderTimeline = () => {
      const target = byId('timeline');
      if (!target) return;
      target.innerHTML = frames.map((frame, index) => '<button class="time-btn '+(index===activeFrameIndex?'active':'')+'" data-index="'+index+'">'+frame.time+'</button>').join('');
      target.querySelectorAll('.time-btn').forEach(button => button.addEventListener('click', () => renderFrame(Number(button.dataset.index))));
      target.addEventListener('wheel', (event) => {
        if (!event.shiftKey) return;
        event.preventDefault();
        target.scrollBy({ left: event.deltaY || event.deltaX });
      }, { passive: false });
    };
    const setupNetworkFilters = () => {
      const hosts = [...new Set(logs.filter(log => log.tab === 'network' && log.host).map(log => log.host))].sort();
      const methods = [...new Set(logs.filter(log => log.tab === 'network' && log.method).map(log => log.method))].sort();
      byId('hostFilter').innerHTML = '<option value="all">All hosts</option>' + hosts.map(host => '<option value="'+escapeHtmlClient(host)+'">'+escapeHtmlClient(host)+'</option>').join('');
      byId('methodFilter').innerHTML = '<option value="all">All methods</option>' + methods.map(method => '<option value="'+escapeHtmlClient(method)+'">'+escapeHtmlClient(method)+'</option>').join('');
      byId('networkSearch').addEventListener('input', event => {
        networkFilter.search = event.target.value.toLowerCase();
        renderLogs();
      });
      byId('hostFilter').addEventListener('change', event => {
        networkFilter.host = event.target.value;
        renderLogs();
      });
      byId('methodFilter').addEventListener('change', event => {
        networkFilter.method = event.target.value;
        renderLogs();
      });
      document.querySelectorAll('.filter-btn').forEach(button => button.addEventListener('click', () => {
        const key = button.dataset.filter;
        networkFilter[key] = !networkFilter[key];
        button.classList.toggle('active', networkFilter[key]);
        renderLogs();
      }));
    };
    const isVisibleNetworkLog = (log) => {
      if (log.tab !== 'network') return true;
      const isError = Number(log.status || 0) >= 400;
      const category = log.category || 'other';
      const categoryVisible = isError || category === 'business' || Boolean(networkFilter[category]);
      if (!categoryVisible) return false;
      if (networkFilter.host !== 'all' && log.host !== networkFilter.host) return false;
      if (networkFilter.method !== 'all' && log.method !== networkFilter.method) return false;
      if (!networkFilter.search) return true;
      const haystack = [log.url, log.message, log.host, log.method, log.status].join(' ').toLowerCase();
      return haystack.includes(networkFilter.search);
    };
    const renderLogs = () => {
      document.querySelectorAll('.tab-btn').forEach(button => button.classList.toggle('active', button.dataset.tab === activeTab));
      byId('networkFilters').style.display = activeTab === 'network' ? 'flex' : 'none';
      const list = byId('logList');
      const tabRows = logs.filter(log => log.tab === activeTab);
      const rows = activeTab === 'network' ? tabRows.filter(isVisibleNetworkLog) : tabRows;
      const hidden = activeTab === 'network' ? tabRows.length - rows.length : 0;
      byId('hiddenCount').textContent = activeTab === 'network' && hidden > 0 ? hidden + ' network rows hidden by filters' : '';
      if (!rows.length) {
        list.innerHTML = '<div class="empty">Tidak ada log '+activeTab+'.</div>';
        return;
      }
      list.innerHTML = rows.map(log => {
        const statusClass = log.status >= 400 ? ' err' : '';
        const title = log.tab === 'network' ? (log.url || log.message || '') : (log.message || '');
        let host = '';
        try { host = log.url ? new URL(log.url).host : ''; } catch {}
        return '<button class="log-row '+(activeLogId===log.id?'active':'')+'" data-id="'+log.id+'">'
          + '<span>'+formatLogTime(log.relativeMs)+'</span>'
          + '<span class="method">'+escapeHtmlClient(log.method || log.level || 'LOG')+'</span>'
          + '<span class="url"><b>'+escapeHtmlClient(title.split('/').pop() || title)+'</b><small>'+escapeHtmlClient(host || title)+'</small></span>'
          + '<span class="status-code'+statusClass+'">'+escapeHtmlClient(log.status || '')+'</span>'
          + '</button>';
      }).join('');
      list.querySelectorAll('.log-row').forEach(row => row.addEventListener('click', () => {
        const log = logs.find(item => item.id === row.dataset.id);
        if (!log) return;
        activeLogId = log.id;
        if (typeof log.relativeMs === 'number') renderFrame(closestFrameIndex(log.relativeMs));
        renderDetail(log);
        renderLogs();
      }));
    };
    const getSelectedLog = () => logs.find(item => item.id === activeLogId);
    const getDetailValue = (log) => {
      if (!log) return 'Pilih salah satu log untuk melihat detail.';
      if (log.tab !== 'network') return log.detail ?? log.message;
      const detail = log.detail || {};
      const data = detail.data || {};
      if (activeDetailTab === 'headers') return detail.headers || data.requestHeaders || {};
      if (activeDetailTab === 'payload') return data.requestBody ?? data.payload ?? data.body ?? '-';
      return data.responseBody ?? data.response ?? data.data ?? '-';
    };
    const renderDetail = (log = getSelectedLog()) => {
      const isNetwork = log?.tab === 'network';
      byId('detailTabs').style.display = isNetwork ? 'flex' : 'none';
      document.querySelectorAll('.detail-tab').forEach(button => button.classList.toggle('active', button.dataset.detail === activeDetailTab));
      const value = getDetailValue(log);
      byId('logDetail').textContent = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    };
    const escapeHtmlClient = (value) => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
    document.querySelectorAll('.tab-btn').forEach(button => button.addEventListener('click', () => {
      activeTab = button.dataset.tab;
      activeLogId = null;
      activeDetailTab = 'headers';
      renderDetail(null);
      renderLogs();
    }));
    document.querySelectorAll('.detail-tab').forEach(button => button.addEventListener('click', () => {
      activeDetailTab = button.dataset.detail;
      renderDetail();
    }));
    renderTimeline();
    setupNetworkFilters();
    renderDetail(null);
    renderLogs();
  </script>
</body>
</html>`;
}

export async function GET(req: NextRequest) {
  try {
    const requestedId = req.nextUrl.searchParams.get('testCaseId')?.trim();
    if (!requestedId) return NextResponse.json({ error: 'testCaseId is required' }, { status: 400 });

    const { record, type } = await findRecord(requestedId);
    if (!record) return NextResponse.json({ error: 'Test case atau bug fix tidak ditemukan.' }, { status: 404 });

    const candidateIds = Array.from(new Set([
      requestedId,
      record.id,
      record.testCaseId,
      record.sourceTestCaseId || '',
    ].filter(Boolean)));
    const { raw, logs } = readRunLogs(candidateIds);
    const recording = readLatestRecording(candidateIds);
    const pickedFrames = recording ? pickFrames(recording.metadata.frames, extractImportantRelativeTimes(raw)) : [];
    const frames = recording ? pickedFrames.map(frame => ({
      time: formatRelativeTime(frame.relativeMs),
      relativeMs: frame.relativeMs,
      src: imageDataUri(path.join(recording.framesDir, frame.file)),
    })).filter(frame => frame.src) : [];
    const html = renderHtml({ record, type, logs, recording, frames });
    const safeName = record.testCaseId.replace(/[^a-z0-9-_]/gi, '_');

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="qa-evidence-${safeName}.html"`,
      },
    });
  } catch (error: any) {
    console.error('GET /api/evidence error:', error);
    return NextResponse.json({ error: `Failed to generate evidence report: ${error.message}` }, { status: 500 });
  }
}
