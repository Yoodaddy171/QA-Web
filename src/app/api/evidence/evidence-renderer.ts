import type { EvidenceFrame, EvidenceLog, EvidenceRecord, EvidenceVideo } from './route';
import { buildEvidenceBrowserScript } from './evidence-browser-script';
import { EVIDENCE_STYLES } from './evidence-styles';

type EvidenceRecording = {
  metadata: {
    mode?: string;
    frames?: unknown[];
    targetUrl?: string | null;
    video?: { durationMs?: number } | null;
  };
};

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

function toJsonScript(value: unknown) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}


export function renderHtml(params: {
  record: EvidenceRecord;
  type: 'TestCase' | 'BugFix';
  logs: EvidenceLog[];
  recording: EvidenceRecording | null;
  frames: EvidenceFrame[];
  video: EvidenceVideo | null;
}) {
  const { record, type, logs, recording, frames, video } = params;
  const statusClass = /done|fixed|as expected/i.test(`${record.status} ${record.actualResult}`) ? 'pass' : /fail|not as expected/i.test(`${record.status} ${record.actualResult}`) ? 'fail' : 'neutral';
  const initialFrame = frames[0];
  const videoUrl = video?.src || '';
  const videoDurationText = typeof recording?.metadata.video?.durationMs === 'number' ? formatRelativeTime(recording.metadata.video.durationMs) : '-';
  const recordingSummary = recording
    ? `${recording.metadata.mode || 'frame'} / ${recording.metadata.frames?.length || 0} frames${videoUrl ? ` / video ${videoDurationText}` : ''}`
    : 'No recording';
  const hasVisualEvidence = Boolean(frames.length || videoUrl);

  return `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>QA Evidence - ${escapeHtml(record.testCaseId)}</title>
  <style>
    ${EVIDENCE_STYLES}
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
      <div class="box"><b>Recording</b>${escapeHtml(recordingSummary)}</div>
    </section>

    <section class="section">
      <h2>Test Case Detail</h2>
      <div class="meta-row"><b>Test Case ID</b><span>${escapeHtml(record.testCaseId)}</span></div>

      <div class="meta-row"><b>Source</b><span>${escapeHtml(type)}</span></div>
      <div class="meta-row"><b>Project</b><span>${escapeHtml(record.project?.name || record.projectId)}</span></div>
      <div class="meta-row"><b>Module</b><span>${escapeHtml(record.module?.name || record.moduleId || '-')}</span></div>
      <div class="meta-row"><b>Page</b><span>${escapeHtml(record.page)}</span></div>
      <div class="meta-row"><b>Sub Menu</b><span>${escapeHtml(record.subMenu || '-')}</span></div>
      <div class="meta-row"><b>Type</b><span>${escapeHtml(record.testType)}</span></div>
      <div class="meta-row"><b>Priority</b><span>${escapeHtml(record.priority || '-')}</span></div>
      <div class="meta-row"><b>Status</b><span>${escapeHtml(record.status)}</span></div>
      <div class="meta-row"><b>Created</b><span>${escapeHtml(formatDate(record.createdAt))}</span></div>
      <div class="meta-row"><b>Updated</b><span>${escapeHtml(formatDate(record.updatedAt))}</span></div>
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
      ${hasVisualEvidence ? `
      <div class="viewer">
        <div class="screen">
          <div class="screen-head">
            <div class="screen-title"><b>Screen Record Review</b><small class="muted">${escapeHtml(recording?.metadata.targetUrl || '-')}</small></div>
            <span id="currentTime" class="status neutral">${escapeHtml(initialFrame?.time || (videoUrl ? '0:00' : '-'))}</span>
          </div>
          <div class="screen-body">
            ${videoUrl ? `<video id="frameVideo" src="${escapeHtml(videoUrl)}" controls preload="metadata"></video>` : `<img id="frameImage" src="${initialFrame?.src || ''}" alt="Selected evidence frame" />`}
            ${videoUrl && initialFrame ? `<img id="frameImage" src="${initialFrame.src}" alt="Selected evidence frame" style="display:none" />` : ''}
          </div>
          <div class="timeline">
            <div class="timeline-label"><span>Timeline</span><span>${escapeHtml(frames.length)} keyframes</span></div>
            <div class="timeline-row" id="timeline"></div>
          </div>
        </div>
        <div class="devtools">
          <div class="dev-head">
            <div class="dev-title"><b>DevTools</b><small class="muted">Klik log untuk pindah timestamp.</small></div>
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
    ${buildEvidenceBrowserScript({
      framesJson: toJsonScript(frames),
      logsJson: toJsonScript(logs),
      videoJson: toJsonScript(recording?.metadata.video || null),
    })}
  </script>
</body>
</html>`;
}
