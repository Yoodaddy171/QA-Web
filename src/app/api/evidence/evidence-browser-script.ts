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
    const getTimelineBounds = () => {

      const values = logs
        .map(log => typeof log.relativeMs === 'number' ? log.relativeMs : null)
        .filter(value => typeof value === 'number' && Number.isFinite(value));
      if (!values.length) return { min: 0, max: 0 };
      return { min: Math.max(0, Math.min(...values) - 10000), max: Math.max(...values) };
    };
    const getLogVideoMs = (log) => {
      const durationMs = getVideoDurationMs();
      if (typeof log?.relativeMs === 'number') {
        const bounds = getTimelineBounds();
        const span = Math.max(1, bounds.max - bounds.min);
        const normalized = Math.max(0, log.relativeMs - bounds.min);
        const mapped = durationMs > 0 ? normalized * durationMs / span : normalized;
        return durationMs > 0 ? Math.min(durationMs, mapped) : mapped;
      }
      if (durationMs > 0 && logs.length > 1) {
        return Math.min(durationMs, Math.max(0, (Number(log?.order || 0) / Math.max(1, logs.length - 1)) * durationMs));
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
        if (currentTime) currentTime.textContent = frames[activeFrameIndex].time;
      }
      document.querySelectorAll('.time-btn').forEach((button, idx) => button.classList.toggle('active', idx === activeFrameIndex));
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
        ? frames.map((frame, index) => '<button class="time-btn '+(index===activeFrameIndex?'active':'')+'" data-index="'+index+'">'+frame.time+'</button>').join('')
        : '<span class="muted">Video only</span>';
      target.querySelectorAll('.time-btn').forEach(button => button.addEventListener('click', () => {
        const index = Number(button.dataset.index);
        renderFrame(index);
        seekVideo(frames[index]?.relativeMs);
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
    const renderLogs = () => {
      document.querySelectorAll('.tab-btn').forEach(button => button.classList.toggle('active', button.dataset.tab === activeTab));
      byId('networkFilters').style.display = activeTab === 'network' ? 'flex' : 'none';
      const list = byId('logList');
      const tabRows = logs.filter(log => log.tab === activeTab);
      const rows = activeTab === 'network' ? tabRows.filter(isVisibleNetworkLog) : tabRows;
      const hidden = activeTab === 'network' ? tabRows.length - rows.length : 0;
      const groups = groupRows(rows);
      byId('hiddenCount').textContent = activeTab === 'network' && hidden > 0 ? hidden + ' network rows hidden by filters' : '';
      document.querySelector('[data-tab="network"]').textContent = 'Network (' + groupRows(logs.filter(log => log.tab === 'network').filter(isVisibleNetworkLog)).length + ')';
      document.querySelector('[data-tab="console"]').textContent = 'Console (' + groupRows(logs.filter(log => log.tab === 'console')).length + ')';
      if (!groups.length) {
        list.innerHTML = '<div class="empty">Tidak ada log '+activeTab+'.</div>';
        return;
      }
      list.innerHTML = groups.map(group => {
        const log = group.log;
        const statusClass = log.status >= 400 ? ' err' : '';
        const title = log.tab === 'network' ? (log.url || log.message || '') : (log.message || '');
        let host = '';
        try { host = log.url ? new URL(log.url).host : ''; } catch {}
        const repeat = group.count > 1 ? '<span class="repeat">x'+group.count+'</span>' : '';
        return '<button class="log-row '+(activeLogId===log.id?'active':'')+'" data-id="'+log.id+'">'
          + '<span class="time">'+formatLogTime(getLogVideoMs(log))+'</span>'
          + '<span class="method">'+escapeHtmlClient(log.method || log.level || 'LOG')+'</span>'
          + '<span class="url"><b>'+escapeHtmlClient(title.split('/').pop() || title)+repeat+'</b><small>'+escapeHtmlClient(host || title)+'</small></span>'
          + '<span class="status-code'+statusClass+'">'+escapeHtmlClient(log.status || '')+'</span>'
          + '</button>';
      }).join('');
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
`;
}

