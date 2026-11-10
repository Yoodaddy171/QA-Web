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
  if (!Number.isFinite(new Date(value).getTime())) return '-';
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
  const status = record.status.trim().toUpperCase();
  const actual = record.actualResult?.trim().toUpperCase();
  const statusClass = ['FAILED', 'FAIL'].includes(status) ? 'fail' : ['DONE', 'PASSED', 'VERIFIED', 'VERIFIED & FIXED'].includes(status) ? 'pass' : 'neutral';
  const actualClass = actual === 'NOT AS EXPECTED' ? 'fail' : actual === 'AS EXPECTED' ? 'pass' : 'neutral';
  const initialFrame = frames[0];
  const videoUrl = video?.src || '';
  const videoDurationText = typeof recording?.metadata.video?.durationMs === 'number' ? formatRelativeTime(recording.metadata.video.durationMs) : '-';
  const recordingSummary = recording
    ? `${recording.metadata.mode || 'frame'} · ${recording.metadata.frames?.length || 0} frame${videoUrl ? ` · video ${videoDurationText}` : ''}`
    : 'Tanpa rekaman';
  const hasVisualEvidence = Boolean(frames.length || videoUrl);
  const networkCount = logs.filter(log => log.tab === 'network').length;
  const failureCount = logs.filter(log => (log.status || 0) >= 400 || /^(SEVERE|ERROR)$/i.test(log.level || '')).length;

  return `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Traceva Evidence Report - ${escapeHtml(record.testCaseId)}</title>
  <style>
    ${EVIDENCE_STYLES}
  </style>
</head>
<body>
  <main class="wrap">
    <header class="report-bar"><a class="brand" href="#report-title" aria-label="Traceva Evidence Report">Traceva</a><span class="muted">Evidence Report</span><button type="button" id="printReport" class="print-button">Cetak / Simpan PDF</button></header>
    <header class="report-heading" id="report-title">
      <div><p class="case-id">${escapeHtml(record.testCaseId)}</p><h1>${escapeHtml(record.testAction || 'Skenario pengujian')}</h1><p class="muted">${escapeHtml(type === 'BugFix' ? 'Bug fix' : 'Testcase')} · Dibuat ${escapeHtml(formatDate(new Date()))}</p></div>
      <div class="outcome"><div class="outcome-item"><span class="field-label">Status testcase</span><span class="status ${statusClass}">${escapeHtml(record.status)}</span></div>${record.actualResult ? `<div class="outcome-item"><span class="field-label">Hasil tercatat</span><span class="status ${actualClass}">${escapeHtml(record.actualResult)}</span></div>` : ''}</div>
    </header>
    <dl class="context-grid">
      <div><dt>Project</dt><dd>${escapeHtml(record.project?.name || record.projectId)}</dd></div>
      <div><dt>Module</dt><dd>${escapeHtml(record.module?.name || record.moduleId || '-')}</dd></div>
      <div><dt>Halaman / Submenu</dt><dd>${escapeHtml([record.page, record.subMenu].filter(Boolean).join(' / ') || '-')}</dd></div>
      <div><dt>Tipe / Prioritas</dt><dd>${escapeHtml(record.testType || '-')} · ${escapeHtml(record.priority || '-')}</dd></div>
    </dl>
    <nav class="report-nav" aria-label="Bagian laporan"><a href="#evidence">Bukti & DevTools</a><a href="#scenario">Skenario</a><a href="#appendix">Lampiran log</a></nav>
    <section class="section evidence-section" id="evidence" aria-labelledby="evidence-title">
      <div class="section-heading"><div><h2 id="evidence-title">Bukti & DevTools</h2><p class="muted">${escapeHtml(recordingSummary)} · ${frames.length} frame disertakan</p></div><p class="log-summary">${networkCount} network · ${logs.length - networkCount} console · ${failureCount} error terindikasi</p></div>
      ${!hasVisualEvidence ? '<p class="notice">Tidak ada rekaman visual yang disertakan. Log yang tersedia tetap dapat ditinjau di bawah.</p>' : ''}
      <div class="viewer${!hasVisualEvidence ? logs.length ? ' viewer-logs-only' : ' viewer-empty' : ''}">
        <div class="screen">
          <div class="screen-head">
            <div class="screen-title"><b>Rekaman pengujian</b><small class="muted">${escapeHtml(recording?.metadata.targetUrl || 'Tanpa rekaman visual')}</small></div>
            <span id="currentTime" class="status neutral">${escapeHtml(videoUrl ? '0:00' : initialFrame?.time || '-')}</span>
          </div>
          <div class="screen-body">
            ${videoUrl ? `<video id="frameVideo" src="${escapeHtml(videoUrl)}"${initialFrame ? ` poster="${escapeHtml(initialFrame.src)}"` : ''} controls preload="metadata" aria-label="Video bukti pengujian"></video>` : initialFrame ? `<img id="frameImage" src="${escapeHtml(initialFrame.src)}" alt="Frame bukti pengujian pada ${escapeHtml(initialFrame.time)}" />` : '<p class="visual-empty">Rekaman visual belum tersedia.</p>'}
            ${videoUrl && initialFrame ? `<img id="frameImage" src="${escapeHtml(initialFrame.src)}" alt="Frame bukti pengujian" style="display:none" />` : ''}
          </div>
          <div class="timeline">
            <div class="timeline-label"><span>Timeline rekaman</span><span>${escapeHtml(frames.length)} keyframe</span></div>
            <div class="timeline-row" id="timeline"></div>
          </div>
        </div>
        <div class="devtools">
          <div class="dev-head">
            <div class="dev-title"><b>DevTools</b><small class="muted">Klik log untuk pindah timestamp.</small></div>
            <div class="tabs">
              <button type="button" class="tab-btn active" data-tab="network" aria-pressed="true">Network</button>
              <button type="button" class="tab-btn" data-tab="console" aria-pressed="false">Console</button>
            </div>
          </div>
          <div class="filters" id="networkFilters">
            <label class="filter-search">Cari aktivitas<input id="networkSearch" aria-label="Cari network berdasarkan URL atau status" placeholder="URL, status, atau metode…" /></label>
            <label class="filter-select">Host<select id="hostFilter" aria-label="Filter host"><option value="all">Semua host</option></select></label>
            <label class="filter-select">Metode<select id="methodFilter" aria-label="Filter metode HTTP"><option value="all">Semua metode</option></select></label>
            <div class="category-filters" role="group" aria-label="Sertakan kategori network">
              <span class="filter-badge" aria-label="Filter default Fetch/XHR aktif">Fetch/XHR</span>
              <button class="filter-btn" data-filter="preflight" aria-pressed="false">Preflight</button>
              <button class="filter-btn" data-filter="static" aria-pressed="false">Static</button>
              <button class="filter-btn" data-filter="telemetry" aria-pressed="false">Telemetry</button>
              <button class="filter-btn" data-filter="other" aria-pressed="false">Lainnya</button>
            </div>
            <div class="filter-feedback"><span class="hidden-count" id="hiddenCount" role="status"></span><button type="button" id="resetNetworkFilters" class="filter-btn" disabled>Reset filter</button></div>
          </div>
          <div class="log-list" id="logList"></div>
          <div class="detail-panel">
            <p class="detail-context" id="detailContext">Detail aktivitas</p>
            <div class="detail-tabs" id="detailTabs">
              <button class="detail-tab active" data-detail="headers">Headers</button>
              <button class="detail-tab" data-detail="payload">Payload</button>
              <button class="detail-tab" data-detail="response">Response</button>
            </div>
            <div class="log-detail" id="logDetail">Pilih salah satu log untuk melihat detail.</div>
          </div>
        </div>
      </div>
      <div class="print-frames">${frames.map((frame, index) => `<figure><img src="${escapeHtml(frame.src)}" alt="Bukti ${index + 1}" loading="eager" /><figcaption>Frame ${index + 1} · ${escapeHtml(frame.time)}</figcaption></figure>`).join('')}</div>
      <p class="print-note">Video dan detail request dapat ditinjau pada file HTML asli. ${frames.length ? 'Frame terpilih disertakan pada cetakan.' : 'Laporan ini tidak menyertakan frame statis.'}</p>
    </section>
    <section class="section" id="scenario" aria-labelledby="scenario-title">
      <h2 id="scenario-title">Skenario pengujian</h2>
      <div class="scenario-grid"><div><h3>Langkah pengujian</h3><pre class="prose-block">${escapeHtml(record.steps || 'Belum ada langkah pengujian.')}</pre></div><div><h3>Hasil yang diharapkan</h3><pre class="prose-block">${escapeHtml(record.expectedResult || 'Belum ada hasil yang diharapkan.')}</pre></div></div>
      <div class="remarks"><h3>Catatan</h3><p class="prose-block">${escapeHtml(record.remarks || 'Tidak ada catatan tambahan.')}</p></div>
    </section>
    <section class="section" id="appendix" aria-labelledby="appendix-title">
      <details class="log-appendix"><summary id="appendix-title">Lampiran log <span>${logs.length} event disertakan</span></summary><p class="muted">Ringkasan event yang disertakan dalam ekspor ini, bukan seluruh riwayat testcase. Error teknis tidak otomatis menentukan verdict testcase.</p>
      ${logs.length ? `<div class="table-scroll"><table><caption class="sr-only">Ringkasan log pengujian</caption><thead><tr><th>Waktu sesi</th><th>Jenis</th><th>Status</th><th>Aktivitas</th></tr></thead><tbody>${logs.map(log => `<tr><td>${escapeHtml(formatRelativeTime(log.relativeMs))}</td><td>${escapeHtml(log.method || log.tab)}</td><td>${escapeHtml(log.status ?? log.level ?? '-')}</td><td>${escapeHtml(log.url || log.message || '-')}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Belum ada log yang disertakan.</p>'}</details>
    </section>
    <footer class="report-footer"><p>Traceva · Evidence Report · ${escapeHtml(record.testCaseId)}</p><p>Dibuat: ${escapeHtml(formatDate(record.createdAt))} · Diperbarui: ${escapeHtml(formatDate(record.updatedAt))}</p><p class="internal-id">UUID: ${escapeHtml(record.id)} · Project ID: ${escapeHtml(record.projectId)}</p></footer>
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
