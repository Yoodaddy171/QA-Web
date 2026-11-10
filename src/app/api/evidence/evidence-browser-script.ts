type EvidenceBrowserScriptInput = {
  framesJson: string;
  logsJson: string;
  videoJson: string;
};

export function buildEvidenceBrowserScript(input: EvidenceBrowserScriptInput) {
  const { framesJson, logsJson, videoJson } = input;
  return `
    const frames = ${framesJson};
    const logs = ${logsJson};
    const video = ${videoJson};
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
    const getVideoDurationMs = () => {
      const player = byId('frameVideo');
      if (player && Number.isFinite(player.duration) && player.duration > 0) return Math.round(player.duration * 1000);
      const metadataDuration = Number(video?.durationMs || 0);
      return Number.isFinite(metadataDuration) && metadataDuration > 0 ? metadataDuration : 0;
    };
    const getLogVideoMs = (log) => {
      const durationMs = getVideoDurationMs();
      if (typeof log?.relativeMs === 'number' && Number.isFinite(log.relativeMs)) {
        const offset = byId('frameVideo') ? log.relativeMs - Number(video?.startedAtRelativeMs || 0) : log.relativeMs;
        return Math.max(0, Math.min(durationMs || Infinity, offset));
      }
      return undefined;
    };
    const closestFrameIndex = (relativeMs) => {
      if (!frames.length || typeof relativeMs !== 'number') return activeFrameIndex;
      return frames.reduce((best, frame, index) => (
        Math.abs(frame.relativeMs - relativeMs) < Math.abs(frames[best].relativeMs - relativeMs) ? index : best
      ), 0);
    };
    const renderFrame = (index) => {
      if (frames.length) {
        activeFrameIndex = Math.max(0, Math.min(frames.length - 1, index));
        const frameImage = byId('frameImage');
        if (frameImage) frameImage.src = frames[activeFrameIndex].src;
        const currentTime = byId('currentTime');
        if (currentTime && !byId('frameVideo')) currentTime.textContent = frames[activeFrameIndex].time;
      }
      document.querySelectorAll('.time-btn').forEach((button, idx) => { button.classList.toggle('active', idx === activeFrameIndex); button.setAttribute('aria-pressed', String(idx === activeFrameIndex)); });
    };
    const seekVideo = (relativeMs, log) => {
      const player = byId('frameVideo');
      if (!player) return;
      const videoMs = log ? getLogVideoMs(log) : relativeMs;
      if (typeof videoMs !== 'number') return;
      const duration = getVideoDurationMs() / 1000;
      const target = Math.max(0, Math.min(duration || Number.POSITIVE_INFINITY, videoMs / 1000));
      try { player.currentTime = target; } catch {}
    };
    const renderTimeline = () => {
      const target = byId('timeline');
      if (!target) return;
      target.innerHTML = frames.length
        ? frames.map((frame, index) => '<button class="time-btn '+(index===activeFrameIndex?'active':'')+'" aria-pressed="'+(index===activeFrameIndex)+'" data-index="'+index+'">'+escapeHtmlClient(frame.time)+'</button>').join('')
        : '<span class="muted">'+(byId('frameVideo') ? 'Rekaman video tanpa keyframe' : 'Belum ada keyframe')+'</span>';
      target.querySelectorAll('.time-btn').forEach(button => button.addEventListener('click', () => {
        const index = Number(button.dataset.index);
        renderFrame(index);
        seekVideo(frames[index]?.relativeMs - (byId('frameVideo') ? Number(video?.startedAtRelativeMs || 0) : 0));
      }));
      target.addEventListener('wheel', (event) => {
        if (!event.shiftKey) return;
        event.preventDefault();
        target.scrollBy({ left: event.deltaY || event.deltaX });
      }, { passive: false });
    };
    const setupNetworkFilters = () => {
      const hosts = [...new Set(logs.filter(log => log.tab === 'network' && log.host).map(log => log.host))].sort();
      const methods = [...new Set(logs.filter(log => log.tab === 'network' && log.method).map(log => log.method))].sort();
      byId('hostFilter').innerHTML = '<option value="all">Semua host</option>' + hosts.map(host => '<option value="'+escapeHtmlClient(host)+'">'+escapeHtmlClient(host)+'</option>').join('');
      byId('methodFilter').innerHTML = '<option value="all">Semua metode</option>' + methods.map(method => '<option value="'+escapeHtmlClient(method)+'">'+escapeHtmlClient(method)+'</option>').join('');
      byId('networkSearch').addEventListener('input', event => {
        networkFilter.search = event.target.value.trim().toLowerCase();
        renderLogs(true);
      });
      byId('hostFilter').addEventListener('change', event => {
        networkFilter.host = event.target.value;
        renderLogs(true);
      });
      byId('methodFilter').addEventListener('change', event => {
        networkFilter.method = event.target.value;
        renderLogs(true);
      });
      document.querySelectorAll('.filter-btn').forEach(button => button.addEventListener('click', () => {
        const key = button.dataset.filter;
        networkFilter[key] = !networkFilter[key];
        button.classList.toggle('active', networkFilter[key]);
        button.setAttribute('aria-pressed', String(networkFilter[key]));
        renderLogs(true);
      }));
      byId('resetNetworkFilters').addEventListener('click', () => {
        Object.assign(networkFilter, { search: '', host: 'all', method: 'all', preflight: false, static: false, telemetry: false, other: false });
        byId('networkSearch').value = ''; byId('hostFilter').value = 'all'; byId('methodFilter').value = 'all';
        document.querySelectorAll('.filter-btn[data-filter]').forEach(button => { button.classList.remove('active'); button.setAttribute('aria-pressed', 'false'); });
        renderLogs(true);
      });
    };
    const isVisibleNetworkLog = (log) => {
      if (log.tab !== 'network') return true;
      const category = log.category || 'business';
      const categoryVisible = category === 'business' || Boolean(networkFilter[category]);
      if (!categoryVisible) return false;
      if (networkFilter.host !== 'all' && log.host !== networkFilter.host) return false;
      if (networkFilter.method !== 'all' && log.method !== networkFilter.method) return false;
      if (!networkFilter.search) return true;
      const haystack = [log.url, log.message, log.host, log.method, log.status].join(' ').toLowerCase();
      return haystack.includes(networkFilter.search);
    };

    const getLogSignature = (log) => {
      if (log.tab === 'network') {
        return [log.method || '', log.url || log.message || '', log.status || 'unknown', log.category || 'other'].join('|');
      }
      return [log.level || 'INFO', log.message || ''].join('|');
    };
    const groupRows = (rows) => {
      const groups = [];
      rows.forEach((log) => {
        const signature = getLogSignature(log);
        const previous = groups[groups.length - 1];
        if (previous && previous.signature === signature) {
          previous.count += 1;
          previous.entries.push(log);
          return;
        }
        groups.push({ id: log.id, signature, log, entries: [log], count: 1 });
      });
      return groups;
    };
    const renderLogs = (resetScroll = false) => {
      document.querySelectorAll('.tab-btn').forEach(button => { button.classList.toggle('active', button.dataset.tab === activeTab); button.setAttribute('aria-pressed', String(button.dataset.tab === activeTab)); });
      byId('networkFilters').style.display = activeTab === 'network' ? 'flex' : 'none';
      const list = byId('logList');
      const previousScroll = resetScroll ? 0 : list.scrollTop;
      const tabRows = logs.filter(log => log.tab === activeTab);
      const rows = activeTab === 'network' ? tabRows.filter(isVisibleNetworkLog) : tabRows;
      const hidden = activeTab === 'network' ? tabRows.length - rows.length : 0;
      const groups = groupRows(rows);
      byId('hiddenCount').textContent = rows.length + ' dari ' + tabRows.length + ' aktivitas · ' + groups.length + ' kelompok' + (hidden ? ' · ' + hidden + ' disembunyikan' : '');
      byId('resetNetworkFilters').disabled = !networkFilter.search && networkFilter.host === 'all' && networkFilter.method === 'all' && !['preflight','static','telemetry','other'].some(key => networkFilter[key]);
      document.querySelector('[data-tab="network"]').textContent = 'Network (' + logs.filter(log => log.tab === 'network').length + ')';
      document.querySelector('[data-tab="console"]').textContent = 'Console (' + logs.filter(log => log.tab === 'console').length + ')';
      if (activeLogId && !rows.some(log => log.id === activeLogId)) { activeLogId = null; renderDetail(null); }
      if (!groups.length) {
        list.innerHTML = '<div class="empty">'+(tabRows.length ? 'Tidak ada aktivitas pada filter ini. Ubah pencarian atau kategori di atas.' : 'Belum ada log '+activeTab+' di laporan ini.')+'</div>';
        return;
      }
      list.innerHTML = groups.map(group => {
        const log = group.log;
        const statusClass = log.status >= 400 || log.status === 0 ? ' err' : '';
        const title = log.tab === 'network' ? (log.url || log.message || '') : (log.message || '');
        let host = '';
        let label = title;
        try { if (log.url) { const url = new URL(log.url); host = url.host; label = url.pathname + url.search; } } catch {}
        const repeat = group.count > 1 ? '<span class="repeat">x'+group.count+'</span>' : '';
        return '<button class="log-row '+(activeLogId===log.id?'active':'')+'" aria-pressed="'+(activeLogId===log.id)+'" title="'+escapeHtmlClient(title)+'" data-id="'+escapeHtmlClient(log.id)+'">'
          + '<span class="time">'+formatLogTime(getLogVideoMs(log))+'</span>'
          + '<span class="method">'+escapeHtmlClient(log.method || log.level || 'LOG')+'</span>'
          + '<span class="url"><b>'+escapeHtmlClient(label)+repeat+'</b><small>'+escapeHtmlClient(host || 'Console')+'</small></span>'
          + (typeof log.status === 'number' ? '<span class="status-code'+statusClass+'">'+escapeHtmlClient(log.status)+'</span>' : '<span aria-hidden="true"></span>')
          + '</button>';
      }).join('');
      list.scrollTop = previousScroll;
      list.querySelectorAll('.log-row').forEach(row => row.addEventListener('click', () => {
        const log = logs.find(item => item.id === row.dataset.id);
        if (!log) return;
        activeLogId = log.id;
        if (typeof log.relativeMs === 'number') {
          seekVideo(log.relativeMs, log);
          renderFrame(closestFrameIndex(log.relativeMs));
        } else {
          seekVideo(undefined, log);
        }
        renderDetail(log);
        renderLogs();
      }));
    };
    const HTTP_STATUS_LABELS = { 200:'OK',201:'Created',202:'Accepted',204:'No Content',301:'Moved Permanently',302:'Found',304:'Not Modified',400:'Bad Request',401:'Unauthorized',403:'Forbidden',404:'Not Found',405:'Method Not Allowed',409:'Conflict',422:'Unprocessable Entity',429:'Too Many Requests',500:'Internal Server Error',502:'Bad Gateway',503:'Service Unavailable',504:'Gateway Timeout' };
    const formatStatusText = (status) => {
      const code = Number(status);
      if (!Number.isFinite(code) || code <= 0) return status == null ? 'Pending' : String(status);
      return HTTP_STATUS_LABELS[code] ? code + ' ' + HTTP_STATUS_LABELS[code] : String(code);
    };
    const renderHeaderRows = (headersObj) => {
      if (!headersObj || typeof headersObj !== 'object' || Array.isArray(headersObj)) return '<div class="dt-empty">-</div>';
      const entries = Object.entries(headersObj).filter(([, v]) => v != null && v !== '');
      if (!entries.length) return '<div class="dt-empty">-</div>';
      return entries.map(([k, v]) => '<div class="dt-row"><span class="dt-key">'+escapeHtmlClient(k)+':</span><span class="dt-val">'+escapeHtmlClient(typeof v === 'string' ? v : JSON.stringify(v))+'</span></div>').join('');
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
      document.querySelectorAll('.detail-tab').forEach(button => { button.classList.toggle('active', button.dataset.detail === activeDetailTab); button.setAttribute('aria-pressed', String(button.dataset.detail === activeDetailTab)); });
      byId('detailContext').textContent = log ? [log.method || log.level || 'Console', log.url || log.message, formatLogTime(getLogVideoMs(log))].filter(Boolean).join(' · ') : 'Detail aktivitas';
      byId('detailContext').title = byId('detailContext').textContent;
      if (isNetwork && activeDetailTab === 'headers') {
        const detail = log.detail || {};
        const data = detail.data || {};
        const statusNum = Number(log.status);
        const dotClass = !Number.isFinite(statusNum) || statusNum <= 0 ? 'warn' : statusNum >= 400 ? 'err' : 'ok';
        byId('logDetail').innerHTML =
          '<details open class="dt-sec"><summary class="dt-title">General</summary>'
          + '<div class="dt-row"><span class="dt-key">Request URL:</span><span class="dt-val">'+escapeHtmlClient(log.url || log.message || '-')+'</span></div>'
          + '<div class="dt-row"><span class="dt-key">Request Method:</span><span class="dt-val">'+escapeHtmlClient((log.method || 'GET').toUpperCase())+'</span></div>'
          + '<div class="dt-row"><span class="dt-key">Status Code:</span><span class="dt-val"><span class="dt-dot '+dotClass+'"></span>'+escapeHtmlClient(formatStatusText(log.status))+'</span></div>'
          + (typeof detail.duration === 'number' ? '<div class="dt-row"><span class="dt-key">Duration:</span><span class="dt-val">'+escapeHtmlClient(detail.duration + 'ms')+'</span></div>' : '')
          + '</details>'
          + '<details open class="dt-sec"><summary class="dt-title">Response Headers</summary>'
          + renderHeaderRows(detail.headers)
          + '</details>'
          + '<details open class="dt-sec"><summary class="dt-title">Request Headers</summary>'
          + renderHeaderRows(data.requestHeaders)
          + '</details>';
        return;
      }
      const value = getDetailValue(log);
      byId('logDetail').textContent = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    };
    const escapeHtmlClient = (value) => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
    document.querySelectorAll('.tab-btn').forEach(button => button.addEventListener('click', () => {
      activeTab = button.dataset.tab;
      activeLogId = null;
      activeDetailTab = 'headers';
      renderDetail(null);
      renderLogs(true);
    }));
    document.querySelectorAll('.detail-tab').forEach(button => button.addEventListener('click', () => {
      activeDetailTab = button.dataset.detail;
      renderDetail();
    }));
    const player = byId('frameVideo');
    if (player) {
      player.addEventListener('timeupdate', () => { byId('currentTime').textContent = formatLogTime(player.currentTime * 1000); });
      player.addEventListener('loadedmetadata', renderLogs);
      document.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight'].includes(event.key) || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || event.isComposing) return;
        if (event.target.closest('input,textarea,select,[contenteditable="true"]')) return;
        event.preventDefault(); event.stopPropagation(); seekVideo(player.currentTime * 1000 + (event.key === 'ArrowRight' ? 5000 : -5000));
      }, true);
    }
    byId('printReport')?.addEventListener('click', () => window.print());
    const printDetails = [...document.querySelectorAll('details')];
    let savedOpenState = [];
    window.addEventListener('beforeprint', () => { savedOpenState = printDetails.map(detail => detail.open); printDetails.forEach(detail => { detail.open = true; }); });
    window.addEventListener('afterprint', () => printDetails.forEach((detail, index) => { detail.open = savedOpenState[index] ?? false; }));
    renderTimeline();
    setupNetworkFilters();
    renderDetail(null);
    renderLogs();
`;
}

