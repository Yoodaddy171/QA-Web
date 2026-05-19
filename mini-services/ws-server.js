const { WebSocketServer } = require('ws');
const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, spawnSync } = require('child_process');
let sharp = null;
try {
  sharp = require('sharp');
} catch (_) {}
let bundledFfmpegPath = '';
try {
  bundledFfmpegPath = require('@ffmpeg-installer/ffmpeg').path;
} catch (_) {}

const wss = new WebSocketServer({ noServer: true });
const clients = new Set();
const activeManualSessions = new Map();
const cdpSessions = new Map();

// Ensure logs directory exists
const LOGS_DIR = path.join(__dirname, 'logs');
const RUNTIME_DIR = process.env.QA_RUNTIME_DIR
  || path.join(process.env.LOCALAPPDATA || os.tmpdir(), 'web-qa-runtime');
const RECORDINGS_DIR = path.join(RUNTIME_DIR, 'recordings');
const LEGACY_RECORDINGS_DIR = path.join(__dirname, 'recordings');
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}
if (!fs.existsSync(RECORDINGS_DIR)) {
  fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
}

// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('Web UI Client connected');
  clients.add(ws);
  ws.on('close', () => {
    console.log('Web UI Client disconnected');
    clients.delete(ws);
  });
  ws.on('error', (err) => console.error('WebSocket Client Error:', err));
});

// Broadcast helper: Meneruskan data ke semua browser yang konek
function broadcast(data) {
  const message = typeof data === 'string' ? data : JSON.stringify(data);
  
  clients.forEach((client) => {
    if (client.readyState === 1) { // 1 = OPEN
      try {
        client.send(message, (err) => {
          if (err) console.error('Send Error:', err);
        });
      } catch (e) {
        console.error('Broadcast Error:', e);
      }
    }
  });
}

function getRunPaths(testCaseId) {
  return {
    current: path.join(LOGS_DIR, `${testCaseId}.current.jsonl`),
    previous: path.join(LOGS_DIR, `${testCaseId}.previous.jsonl`),
    legacy: path.join(LOGS_DIR, `${testCaseId}.jsonl`),
  };
}

function isRunStart(logData) {
  const text = String(logData.log || '');
  return /Starting\s+.*(Automation|Manual\s+Capture)/i.test(text);
}

function rotateRunIfNeeded(logData) {
  if (!logData.testCaseId || !isRunStart(logData)) return;

  const { current, previous } = getRunPaths(logData.testCaseId);
  if (!fs.existsSync(current)) return;

  try {
    fs.copyFileSync(current, previous);
    fs.truncateSync(current, 0);
    console.log(`[LOG ROTATE] Previous run saved for TC: ${logData.testCaseId}`);
  } catch (err) {
    console.error(`Failed to rotate log for ${logData.testCaseId}:`, err.message);
  }
}

// Persistence helper: Simpan log current run ke file JSONL.
// History hanya menyimpan satu run sebelumnya: current -> previous saat run baru dimulai.
function saveLog(logData) {
  if (!logData.testCaseId) return;

  rotateRunIfNeeded(logData);

  const { current } = getRunPaths(logData.testCaseId);
  const logEntry = JSON.stringify({
    ...logData,
    timestamp: logData.timestamp || new Date().toISOString()
  }) + '\n';

  try {
    fs.appendFileSync(current, logEntry);
  } catch (err) {
    console.error(`Failed to save log for ${logData.testCaseId}:`, err);
  }
}

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function readJsonBody(req, callback) {
  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
    if (body.length > 2_000_000) {
      req.destroy();
    }
  });
  req.on('end', () => {
    try {
      callback(null, body ? JSON.parse(body) : {});
    } catch (error) {
      callback(error);
    }
  });
}

function emitLog(logData) {
  saveLog(logData);
  broadcast(logData);
}

function getManualSession(sessionId) {
  if (!sessionId) return null;
  return activeManualSessions.get(sessionId) || null;
}

function isStoppedManualLog(logData) {
  return String(logData.source || '').startsWith('manual-')
    && logData.sessionId
    && getManualSession(logData.sessionId)?.active !== true;
}

function getRelativeMs(session) {
  if (session?.startedAtHrNs) {
    const elapsedNs = process.hrtime.bigint() - BigInt(session.startedAtHrNs);
    return Math.max(0, Number(elapsedNs / 1000000n));
  }

  const startedAtMs = Number(session?.startedAtMs || new Date(session?.startedAt || 0).getTime());
  return Number.isFinite(startedAtMs) && startedAtMs > 0 ? Math.max(0, Date.now() - startedAtMs) : 0;
}

function getRelativeMsFromWallTime(session, wallTimeMs) {
  const startedAtMs = Number(session?.startedAtMs || new Date(session?.startedAt || 0).getTime());
  if (!Number.isFinite(startedAtMs) || !Number.isFinite(wallTimeMs)) return getRelativeMs(session);
  return Math.max(0, Math.round(wallTimeMs - startedAtMs));
}

function getRelativeMsFromCdpTimestamp(session, cdpTimestampSeconds) {
  const cdpTimestampMs = Number(cdpTimestampSeconds) * 1000;
  const offsetMs = Number(session?.cdpTimeOffsetMs);
  if (!Number.isFinite(cdpTimestampMs) || !Number.isFinite(offsetMs)) return getRelativeMs(session);
  return getRelativeMsFromWallTime(session, cdpTimestampMs + offsetMs);
}

function syncCdpClock(session, cdpTimestampSeconds) {
  const cdpTimestampMs = Number(cdpTimestampSeconds) * 1000;
  if (!Number.isFinite(cdpTimestampMs) || session.cdpTimeOffsetMs) return;
  session.cdpTimeOffsetMs = Date.now() - cdpTimestampMs;
}

function truncateText(value, maxLength = 4000) {
  if (value == null) return value;
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.length > maxLength ? `${text.slice(0, maxLength)}... [truncated]` : text;
}

function isSensitiveKey(key) {
  return /authorization|cookie|token|password|secret|apikey|api-key|access_token|refresh_token|pin/i.test(String(key));
}

function redactDeep(value) {
  if (Array.isArray(value)) return value.map(redactDeep);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, isSensitiveKey(key) ? '[REDACTED]' : redactDeep(item)])
  );
}

function redactPayload(value) {
  if (value == null) return value;
  const text = typeof value === 'string' ? value : JSON.stringify(value);

  try {
    return truncateText(JSON.stringify(redactDeep(JSON.parse(text))));
  } catch (_) {}

  try {
    const params = new URLSearchParams(text);
    if (Array.from(params.keys()).length > 0) {
      for (const key of Array.from(params.keys())) {
        if (isSensitiveKey(key)) params.set(key, '[REDACTED]');
      }
      return truncateText(params.toString());
    }
  } catch (_) {}

  return truncateText(
    text
      .replace(/("?(?:password|pin|token|access_token|refresh_token|secret)"?\s*[:=]\s*)("[^"]*"|[^,&}\s]+)/gi, '$1"[REDACTED]"')
      .replace(/((?:password|pin|token|access_token|refresh_token|secret)=)[^&\s]+/gi, '$1[REDACTED]')
  );
}

function redactHeaders(headers = {}) {
  const output = {};
  for (const [key, value] of Object.entries(headers || {})) {
    output[key] = isSensitiveKey(key)
      ? '[REDACTED]'
      : value;
  }
  return output;
}

function findBrowserPath() {
  const candidates = [
    path.join(process.env.ProgramFiles || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env['ProgramFiles(x86)'] || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env.ProgramFiles || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  ];
  return candidates.find(candidate => candidate && fs.existsSync(candidate));
}

function isValidHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function httpJson(url, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, (response) => {
      let body = '';
      response.on('data', chunk => { body += chunk.toString(); });
      response.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on('error', reject);
    request.setTimeout(timeoutMs, () => {
      request.destroy(new Error(`Timeout requesting ${url}`));
    });
  });
}

function launchBrowser(browserPath, args) {
  const browser = spawn(browserPath, args, {
    detached: true,
    stdio: 'ignore',
  });
  browser.unref();
  return browser;
}

function getManualCaptureProfileDir() {
  const baseDir = process.env.LOCALAPPDATA
    || process.env.APPDATA
    || path.join(os.homedir(), '.qadesk');
  return path.join(baseDir, 'QADesk', 'ManualCaptureProfile');
}

function resolveManualUserDataDir(sessionId, browserMode) {
  if (browserMode === 'profiled') {
    return {
      userDataDir: getManualCaptureProfileDir(),
      cleanupUserDataDir: false,
    };
  }

  return {
    userDataDir: path.join(os.tmpdir(), `qadesk-manual-${sessionId}`),
    cleanupUserDataDir: true,
  };
}

function cleanupProfileBrowserProcesses(userDataDir) {
  if (process.platform !== 'win32' || !userDataDir) return;
  const escapedProfile = userDataDir.replace(/'/g, "''");
  const script = [
    `$profile='${escapedProfile}'`,
    "Get-CimInstance Win32_Process -Filter \"name='chrome.exe' or name='msedge.exe'\"",
    " | Where-Object { $_.CommandLine -and $_.CommandLine.Contains($profile) }",
    " | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }",
  ].join('');
  try {
    spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], {
      windowsHide: true,
      timeout: 5000,
      stdio: 'ignore',
    });
  } catch (error) {
    console.warn('Failed to cleanup profiled browser processes:', error.message);
  }
}

function cleanupProfileLockFiles(userDataDir) {
  if (!userDataDir || !fs.existsSync(userDataDir)) return;
  for (const name of ['lockfile', 'SingletonLock', 'SingletonCookie', 'SingletonSocket']) {
    try {
      fs.rmSync(path.join(userDataDir, name), { force: true });
    } catch (_) {}
  }
}

async function waitForCdpPage(port, targetUrl) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    try {
      const targets = await httpJson(`http://127.0.0.1:${port}/json/list`);
      const pages = targets.filter(target => target.type === 'page');
      const exact = pages.find(target => target.url && target.url.startsWith(targetUrl.split('?')[0]));
      const first = exact || pages[0];
      if (first?.webSocketDebuggerUrl) return first;
    } catch (_) {}
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  throw new Error('Chrome DevTools target tidak ditemukan');
}

function createCdpClient(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }), (error) => {
      if (error) {
        pending.delete(id);
        reject(error);
      }
    });
  });

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      if (message.id && pending.has(message.id)) {
        const promise = pending.get(message.id);
        pending.delete(message.id);
        if (message.error) promise.reject(new Error(message.error.message));
        else promise.resolve(message.result);
      }
    } catch (error) {
      console.error('CDP message parse error:', error.message);
    }
  });

  return {
    ws,
    send,
    waitOpen: () => new Promise((resolve, reject) => {
      ws.once('open', resolve);
      ws.once('error', reject);
    }),
  };
}

async function focusCdpPage(cdp, target) {
  try {
    await cdp.send('Page.bringToFront');
  } catch (_) {
    // Best effort only. Capture should still work if the OS blocks focus changes.
  }

  try {
    const result = await cdp.send('Browser.getWindowForTarget', { targetId: target.id });
    if (result?.windowId) {
      await cdp.send('Browser.setWindowBounds', {
        windowId: result.windowId,
        bounds: { windowState: 'maximized' },
      });
    }
  } catch (_) {
    // Some Chromium builds or policies may reject window bounds changes.
  }
}

async function installCdpClickTracker(cdp, session) {
  const relayUrl = 'http://127.0.0.1:3001/log';
  const source = `(() => {
    if (window.__qaCdpClickTrackerInstalled) return;
    window.__qaCdpClickTrackerInstalled = true;
    const relayUrl = ${JSON.stringify(relayUrl)};
    const testCaseId = ${JSON.stringify(session.testCaseId)};
    const sessionId = ${JSON.stringify(session.sessionId)};
    const truncate = (value) => {
      const text = value == null ? '' : String(value);
      return text.length > 400 ? text.slice(0, 400) + '... [truncated]' : text;
    };
    document.addEventListener('click', (event) => {
      let targetLabel = '';
      try {
        const target = event.target;
        const element = target?.closest?.('button,a,input,select,textarea,[role="button"],[data-testid],[aria-label]') || target;
        targetLabel = element ? [
          element.tagName,
          element.getAttribute?.('aria-label') || element.getAttribute?.('data-testid') || element.id || element.name,
          element.textContent?.trim().slice(0, 80),
        ].filter(Boolean).join(' ') : '';
      } catch (_) {}
      const payload = {
        type: 'log',
        source: 'manual-cdp-click',
        testCaseId,
        sessionId,
        timestamp: new Date().toISOString(),
        level: 'INFO',
        console: false,
        log: 'Manual Click',
        interaction: {
          type: 'click',
          x: event.clientX,
          y: event.clientY,
          viewportWidth: window.innerWidth || document.documentElement.clientWidth || 0,
          viewportHeight: window.innerHeight || document.documentElement.clientHeight || 0,
          target: truncate(targetLabel),
        },
      };
      try {
        navigator.sendBeacon?.(relayUrl, new Blob([JSON.stringify(payload)], { type: 'application/json' }))
          || fetch(relayUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), keepalive: true }).catch(() => {});
      } catch (_) {}
    }, true);
  })();`;
  try {
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source });
    await cdp.send('Runtime.evaluate', { expression: source, returnByValue: true });
  } catch (error) {
    console.warn('Failed to install CDP click tracker:', error.message);
  }
}

function getRecordingPaths(testCaseId, sessionId) {
  const safeTestCaseId = encodeURIComponent(testCaseId);
  const safeSessionId = encodeURIComponent(sessionId);
  const baseDir = path.join(RECORDINGS_DIR, safeTestCaseId, safeSessionId);
  return {
    baseDir,
    framesDir: path.join(baseDir, 'frames'),
    videoDir: path.join(baseDir, 'video'),
    metadata: path.join(baseDir, 'metadata.json'),
  };
}

function getLegacyRecordingPaths(testCaseId, sessionId) {
  const safeTestCaseId = encodeURIComponent(testCaseId);
  const safeSessionId = encodeURIComponent(sessionId);
  const baseDir = path.join(LEGACY_RECORDINGS_DIR, safeTestCaseId, safeSessionId);
  return {
    baseDir,
    framesDir: path.join(baseDir, 'frames'),
    videoDir: path.join(baseDir, 'video'),
    metadata: path.join(baseDir, 'metadata.json'),
  };
}

function buildRecordingFrameUrl(testCaseId, sessionId, file) {
  return `/recordings/${encodeURIComponent(testCaseId)}/${encodeURIComponent(sessionId)}/frames/${encodeURIComponent(file)}`;
}

function buildRecordingVideoUrl(testCaseId, sessionId, file) {
  return `/recordings/${encodeURIComponent(testCaseId)}/${encodeURIComponent(sessionId)}/video/${encodeURIComponent(file)}`;
}

function parseCaptureMode(value) {
  return ['frame', 'video', 'hybrid'].includes(value) ? value : 'frame';
}

function getNumberEnv(name, fallback, min, max) {
  const value = Number(process.env[name]);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function shouldSaveKeyframe(recording, reason) {
  if (recording.mode === 'frame') return true;
  if (recording.mode === 'video' && recording.video?.status !== 'failed') return false;
  if (['initial', 'final', 'periodic-keyframe', 'exception', 'network-error'].includes(reason)) return true;
  if (/console|error|failed|failure|warning|warn/i.test(reason)) return true;
  if (!recording.lastKeyframeSavedAt) return true;
  return Date.now() - recording.lastKeyframeSavedAt >= recording.keyframeIntervalMs;
}

async function drawClickMarkers(imageBuffer, markers) {
  if (!sharp || !markers?.length) return imageBuffer;
  try {
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();
    const width = Number(metadata.width || 0);
    const height = Number(metadata.height || 0);
    if (!width || !height) return imageBuffer;

    const circles = markers.map(marker => {
      const viewportWidth = Math.max(1, Number(marker.viewportWidth || width));
      const viewportHeight = Math.max(1, Number(marker.viewportHeight || height));
      const x = Math.max(0, Math.min(width, Number(marker.x || 0) * width / viewportWidth));
      const y = Math.max(0, Math.min(height, Number(marker.y || 0) * height / viewportHeight));
      const radius = Math.max(14, Math.min(34, Math.round(Math.min(width, height) * 0.035)));
      const stroke = Math.max(4, Math.round(radius * 0.22));
      return [
        `<circle cx="${x}" cy="${y}" r="${radius}" fill="rgba(239,68,68,0.12)" stroke="#ef4444" stroke-width="${stroke}"/>`,
        `<circle cx="${x}" cy="${y}" r="${Math.max(3, Math.round(radius * 0.18))}" fill="#ef4444"/>`,
      ].join('');
    }).join('');

    const overlay = Buffer.from(
      `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">${circles}</svg>`
    );
    return await image.composite([{ input: overlay, left: 0, top: 0 }]).jpeg({ quality: 88 }).toBuffer();
  } catch (error) {
    console.warn('Click marker overlay skipped:', error.message);
    return imageBuffer;
  }
}

function writeRecordingMetadata(recording) {
  if (!recording) return;
  const payload = {
    mode: recording.mode || 'frame',
    sessionId: recording.sessionId,
    testCaseId: recording.testCaseId,
    targetUrl: recording.targetUrl,
    startedAt: recording.startedAt,
    stoppedAt: recording.stoppedAt || null,
    frameIntervalMs: recording.frameIntervalMs,
    keyframeIntervalMs: recording.keyframeIntervalMs,
    status: recording.status,
    video: recording.video ? {
      ...recording.video,
      url: recording.video.file ? buildRecordingVideoUrl(recording.testCaseId, recording.sessionId, recording.video.file) : undefined,
    } : undefined,
    warnings: recording.warnings || [],
    frames: recording.frames.map(frame => ({
      ...frame,
      url: buildRecordingFrameUrl(recording.testCaseId, recording.sessionId, frame.file),
    })),
  };

  try {
    fs.writeFileSync(recording.paths.metadata, JSON.stringify(payload, null, 2));
  } catch (error) {
    console.error('Failed to write recording metadata:', error.message);
  }
}

function startManualRecorder(session, cdp, targetUrl, options = {}) {
  const mode = parseCaptureMode(options.captureMode || process.env.QA_CAPTURE_MODE);
  const configuredInterval = Number(process.env.QA_RECORDING_INTERVAL_MS);
  const frameIntervalMs = Number.isFinite(configuredInterval)
    ? Math.min(1000, Math.max(150, configuredInterval))
    : 300;
  const keyframeIntervalMs = getNumberEnv('QA_KEYFRAME_INTERVAL_MS', 2000, 500, 10000);
  const videoWidth = getNumberEnv('QA_VIDEO_WIDTH', 1280, 640, 3840);
  const videoHeight = getNumberEnv('QA_VIDEO_HEIGHT', 720, 360, 2160);
  const videoFps = getNumberEnv('QA_VIDEO_FPS', 30, 1, 60);
  const videoBitrateMbps = getNumberEnv('QA_VIDEO_BITRATE_MBPS', 4, 1, 20);
  const videoMaxDurationMs = getNumberEnv('QA_VIDEO_MAX_DURATION_MS', 300000, 10000, 3600000);
  const configuredQuality = Number(process.env.QA_RECORDING_JPEG_QUALITY);
  const jpegQuality = Number.isFinite(configuredQuality)
    ? Math.min(80, Math.max(35, configuredQuality))
    : 52;
  const paths = getRecordingPaths(session.testCaseId, session.sessionId);
  fs.mkdirSync(paths.framesDir, { recursive: true });
  fs.mkdirSync(paths.videoDir, { recursive: true });

  const recording = {
    mode,
    sessionId: session.sessionId,
    testCaseId: session.testCaseId,
    targetUrl,
    startedAt: session.startedAt,
    stoppedAt: null,
    frameIntervalMs,
    keyframeIntervalMs,
    status: 'recording',
    frames: [],
    frameIndex: 0,
    timer: null,
    keyframeTimer: null,
    videoTimer: null,
    paths,
    video: null,
    ffmpeg: null,
    videoFrameIndex: 0,
    videoMaxDurationTimer: null,
    warnings: [],
    capturing: false,
    pendingCapture: false,
    pendingCaptureReason: null,
    clickMarkers: [],
    lastCaptureStartedAt: 0,
    lastKeyframeSavedAt: 0,
    lastVideoFrameRelativeMs: null,
    lastNetworkActivityAt: Date.now(),
  };

  const ensureKeyframeFallback = () => {
    if (recording.status !== 'recording') return;
    if (recording.videoTimer) {
      clearInterval(recording.videoTimer);
      recording.videoTimer = null;
    }
    if (!recording.keyframeTimer) {
      recording.keyframeTimer = setInterval(() => captureFrame('periodic-keyframe'), keyframeIntervalMs);
    }
  };

  const startVideoWriter = () => {
    if (!['video', 'hybrid'].includes(recording.mode)) return;
    const file = 'recording.webm';
    const filePath = path.join(paths.videoDir, file);
    recording.video = {
      file,
      mimeType: 'video/webm',
      startedAtRelativeMs: getRelativeMs(session),
      durationMs: 0,
      width: videoWidth,
      height: videoHeight,
      fps: videoFps,
      bitrateMbps: videoBitrateMbps,
      sizeBytes: 0,
      status: 'starting',
    };

    try {
      const args = [
        '-y',
        '-f', 'image2pipe',
        '-framerate', String(videoFps),
        '-i', 'pipe:0',
        '-vf', `scale=${videoWidth}:${videoHeight}:force_original_aspect_ratio=decrease,pad=${videoWidth}:${videoHeight}:(ow-iw)/2:(oh-ih)/2`,
        '-r', String(videoFps),
        '-c:v', 'libvpx',
        '-b:v', `${videoBitrateMbps}M`,
        '-an',
        filePath,
      ];
      const ffmpegBinary = process.env.FFMPEG_PATH || bundledFfmpegPath || 'ffmpeg';
      const ffmpeg = spawn(ffmpegBinary, args, { stdio: ['pipe', 'ignore', 'pipe'] });
      recording.ffmpeg = ffmpeg;
      recording.video.status = 'recording';
      ffmpeg.stderr.on('data', data => {
        const text = data.toString();
        if (/not recognized|not found|unknown encoder|error/i.test(text)) {
          recording.warnings.push(text.trim().slice(0, 240));
        }
      });
      ffmpeg.on('error', error => {
        recording.video.status = 'failed';
        recording.warnings.push(`Video recorder failed: ${error.message}`);
        ensureKeyframeFallback();
      });
      ffmpeg.stdin.on('error', error => {
        recording.video.status = 'failed';
        recording.warnings.push(`Video pipe failed: ${error.message}`);
        ensureKeyframeFallback();
      });
      ffmpeg.on('close', () => {
        if (fs.existsSync(filePath)) {
          recording.video.sizeBytes = fs.statSync(filePath).size;
          if (recording.video.status !== 'failed') recording.video.status = 'ready';
        } else {
          recording.video.status = 'failed';
          ensureKeyframeFallback();
        }
        writeRecordingMetadata(recording);
      });
    } catch (error) {
      recording.video.status = 'failed';
      recording.warnings.push(`Video recorder failed: ${error.message}`);
      ensureKeyframeFallback();
    }
  };

  const waitForPageSettled = async () => {
    const maxWaitMs = 1200;
    const quietWindowMs = 250;
    const deadline = Date.now() + maxWaitMs;

    while (Date.now() < deadline) {
      const quietEnough = Date.now() - recording.lastNetworkActivityAt >= quietWindowMs;
      try {
        const result = await cdp.send('Runtime.evaluate', {
          expression: `(() => {
            const state = document.readyState;
            const pendingImages = Array.from(document.images || []).filter(img => !img.complete).length;
            const fontsReady = !document.fonts || document.fonts.status === 'loaded';
            return { state, pendingImages, fontsReady };
          })()`,
          returnByValue: true,
        });
        const value = result?.result?.value || {};
        if (quietEnough && value.state === 'complete' && value.pendingImages === 0 && value.fontsReady) return;
      } catch (_) {
        if (quietEnough) return;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  };

  const captureFrame = async (reason = 'interval') => {
    const currentSession = getManualSession(session.sessionId);
    if (!currentSession || (!currentSession.active && reason !== 'final')) return;
    if (recording.capturing) {
      recording.pendingCapture = true;
      if (shouldSaveKeyframe(recording, reason)) recording.pendingCaptureReason = reason;
      return;
    }

    recording.capturing = true;
    recording.pendingCapture = false;
    if (reason !== 'video-frame') await waitForPageSettled();
    const settledSession = getManualSession(session.sessionId);
    if (!settledSession || (!settledSession.active && reason !== 'final')) {
      recording.capturing = false;
      return;
    }
    const captureStartedRelativeMs = getRelativeMs(currentSession);
    const captureStartedAt = Date.now();
    recording.lastCaptureStartedAt = captureStartedAt;
    try {
      const result = await cdp.send('Page.captureScreenshot', {
        format: 'jpeg',
        quality: jpegQuality,
        captureBeyondViewport: false,
      });
      if (!result?.data) return;
      const capturedSession = getManualSession(session.sessionId);
      if (!capturedSession || (!capturedSession.active && reason !== 'final')) return;

      const captureEndedRelativeMs = getRelativeMs(currentSession);
      const relativeMs = Math.round((captureStartedRelativeMs + captureEndedRelativeMs) / 2);
      const imageBuffer = Buffer.from(result.data, 'base64');
      const markerWindowMs = getNumberEnv('QA_CLICK_MARKER_WINDOW_MS', 1200, 250, 5000);
      const activeClickMarkers = recording.clickMarkers
        .filter(marker => Math.abs(relativeMs - marker.relativeMs) <= markerWindowMs)
        .slice(-3);

      if (recording.video?.status === 'recording' && recording.ffmpeg?.stdin?.writable) {
        const elapsedSinceLastVideoFrame = recording.lastVideoFrameRelativeMs === null
          ? Math.round(1000 / videoFps)
          : Math.max(0, relativeMs - recording.lastVideoFrameRelativeMs);
        const videoFrameCopies = Math.max(1, Math.min(120, Math.round(elapsedSinceLastVideoFrame * videoFps / 1000)));
        for (let copyIndex = 0; copyIndex < videoFrameCopies; copyIndex += 1) {
          recording.ffmpeg.stdin.write(imageBuffer);
        }
        recording.videoFrameIndex += videoFrameCopies;
        recording.lastVideoFrameRelativeMs = relativeMs;
        recording.video.durationMs = Math.max(0, relativeMs - (recording.video.startedAtRelativeMs || 0));
      }

      if (shouldSaveKeyframe(recording, reason)) {
        recording.frameIndex += 1;
        const file = `${String(recording.frameIndex).padStart(6, '0')}.jpg`;
        const frameBuffer = await drawClickMarkers(imageBuffer, activeClickMarkers);
        fs.writeFileSync(path.join(paths.framesDir, file), frameBuffer);
        recording.lastKeyframeSavedAt = Date.now();
        recording.frames.push({
          file,
          relativeMs,
          capturedAtMs: captureEndedRelativeMs,
          captureDurationMs: Math.max(0, captureEndedRelativeMs - captureStartedRelativeMs),
          reason,
          clickMarkers: activeClickMarkers,
          timestamp: new Date().toISOString(),
        });
      }
      recording.clickMarkers = recording.clickMarkers.filter(marker => relativeMs - marker.relativeMs <= markerWindowMs);

      if (recording.frames.length % 5 === 0) writeRecordingMetadata(recording);
    } catch (error) {
      if (getManualSession(session.sessionId)?.active) {
        console.warn('Manual recording frame skipped:', error.message);
      }
    } finally {
      recording.capturing = false;
      if (recording.pendingCapture && getManualSession(session.sessionId)?.active) {
        const pendingReason = recording.pendingCaptureReason || 'event-followup';
        recording.pendingCaptureReason = null;
        setTimeout(() => captureFrame(pendingReason), 80);
      }
    }
  };

  recording.noteClick = (interaction) => {
    if (!interaction || typeof interaction.x !== 'number' || typeof interaction.y !== 'number') return;
    const currentSession = getManualSession(session.sessionId);
    if (!currentSession?.active) return;
    const relativeMs = getRelativeMs(currentSession);
    const duplicate = recording.clickMarkers.some(marker => (
      Math.abs(marker.relativeMs - relativeMs) <= 180
      && Math.abs(marker.x - interaction.x) <= 3
      && Math.abs(marker.y - interaction.y) <= 3
    ));
    if (duplicate) return;
    recording.clickMarkers.push({
      x: interaction.x,
      y: interaction.y,
      viewportWidth: interaction.viewportWidth,
      viewportHeight: interaction.viewportHeight,
      relativeMs,
      target: interaction.target,
    });
    recording.captureNow?.('click');
  };

  recording.captureNow = (reason = 'event') => {
    const currentSession = getManualSession(session.sessionId);
    if (!currentSession || (!currentSession.active && reason !== 'final')) return;
    if (recording.capturing) {
      recording.pendingCapture = true;
      if (shouldSaveKeyframe(recording, reason)) recording.pendingCaptureReason = reason;
      return;
    }
    const elapsedSinceLastCapture = Date.now() - recording.lastCaptureStartedAt;
    if (elapsedSinceLastCapture < 120) {
      recording.pendingCapture = true;
      if (shouldSaveKeyframe(recording, reason)) recording.pendingCaptureReason = reason;
      setTimeout(() => captureFrame(reason), 120 - elapsedSinceLastCapture);
      return;
    }
    setTimeout(() => captureFrame(reason), 0);
  };

  if (recording.mode === 'frame') {
    recording.timer = setInterval(captureFrame, frameIntervalMs);
  } else {
    startVideoWriter();
    const videoIntervalMs = Math.max(33, Math.round(1000 / videoFps));
    recording.videoTimer = setInterval(() => captureFrame('video-frame'), videoIntervalMs);
    if (recording.mode === 'hybrid' || recording.video?.status === 'failed') {
      recording.keyframeTimer = setInterval(() => captureFrame('periodic-keyframe'), keyframeIntervalMs);
    }
    recording.videoMaxDurationTimer = setTimeout(() => {
      stopManualRecorder(recording, 'stopped_limit');
    }, videoMaxDurationMs);
  }
  setTimeout(() => captureFrame('initial'), 100);
  writeRecordingMetadata(recording);
  return recording;
}

function stopManualRecorder(recording, stopStatus = 'stopped') {
  if (!recording) return null;
  if (recording.timer) clearInterval(recording.timer);
  if (recording.keyframeTimer) clearInterval(recording.keyframeTimer);
  if (recording.videoTimer) clearInterval(recording.videoTimer);
  if (recording.videoMaxDurationTimer) clearTimeout(recording.videoMaxDurationTimer);
  recording.timer = null;
  recording.keyframeTimer = null;
  recording.videoTimer = null;
  recording.videoMaxDurationTimer = null;
  recording.status = recording.status === 'stopped_limit' ? 'stopped_limit' : stopStatus;
  recording.stoppedAt = new Date().toISOString();
  if (recording.video) {
    recording.video.durationMs = Math.max(0, getRelativeMs({ startedAt: recording.startedAt, startedAtMs: new Date(recording.startedAt).getTime() }) - (recording.video.startedAtRelativeMs || 0));
    if (recording.video.status === 'recording' || recording.video.status === 'starting') recording.video.status = 'finalizing';
  }
  recording.captureNow?.('final');
  if (recording.ffmpeg?.stdin?.writable) {
    try {
      recording.ffmpeg.stdin.end();
    } catch (_) {}
  }
  writeRecordingMetadata(recording);
  return {
    sessionId: recording.sessionId,
    testCaseId: recording.testCaseId,
    mode: recording.mode || 'frame',
    frameCount: recording.frames.length,
    video: recording.video,
    metadataUrl: `/recordings/${encodeURIComponent(recording.testCaseId)}/${encodeURIComponent(recording.sessionId)}/metadata`,
  };
}

function readRecordingMetadata(testCaseId, sessionId) {
  for (const paths of [getRecordingPaths(testCaseId, sessionId), getLegacyRecordingPaths(testCaseId, sessionId)]) {
    if (!fs.existsSync(paths.metadata)) continue;
    try {
      return JSON.parse(fs.readFileSync(paths.metadata, 'utf8'));
    } catch {
      return null;
    }
  }
  return null;
}

function getLatestRecordingMetadata(testCaseId) {
  const roots = [RECORDINGS_DIR, LEGACY_RECORDINGS_DIR];
  const metadataItems = [];

  for (const root of roots) {
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

  metadataItems.sort((a, b) => b.mtimeMs - a.mtimeMs);
  for (const item of metadataItems) {
    try {
      return JSON.parse(fs.readFileSync(item.metadataPath, 'utf8'));
    } catch (_) {}
  }
  return null;
}

async function startCdpCapture(session, targetUrl, options = {}) {
  const browserPath = findBrowserPath();
  if (!browserPath) throw new Error('Chrome atau Edge tidak ditemukan untuk manual capture');

  const port = 9300 + Math.floor(Math.random() * 500);
  const browserMode = options.browserMode === 'profiled' ? 'profiled' : 'clean';
  const { userDataDir, cleanupUserDataDir } = resolveManualUserDataDir(session.sessionId, browserMode);
  if (browserMode === 'profiled') {
    cleanupProfileBrowserProcesses(userDataDir);
    cleanupProfileLockFiles(userDataDir);
  }
  fs.mkdirSync(userDataDir, { recursive: true });
  const browserArgs = [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--new-window',
    '--start-maximized',
    targetUrl,
  ];
  const browser = launchBrowser(browserPath, browserArgs);
  let target;
  let cdp;
  try {
    target = await waitForCdpPage(port, targetUrl);
    cdp = createCdpClient(target.webSocketDebuggerUrl);
    await cdp.waitOpen();
  } catch (error) {
    try {
      if (!browser.killed) browser.kill();
    } catch (_) {}
    if (browserMode === 'profiled') {
      cleanupProfileBrowserProcesses(userDataDir);
      cleanupProfileLockFiles(userDataDir);
    }
    throw new Error(`${error.message}. Jika memakai Profiled Browser, coba start ulang; profile QA lama sudah dibersihkan.`);
  }

  const sessionInfo = {
    browser,
    cdp,
    requestMeta: new Map(),
    userDataDir,
    cleanupUserDataDir,
    browserMode,
    recording: null,
  };
  cdpSessions.set(session.sessionId, sessionInfo);

  cdp.ws.on('message', async (data) => {
    let message;
    try {
      message = JSON.parse(data.toString());
    } catch {
      return;
    }
    if (!message.method) return;
    const currentSession = getManualSession(session.sessionId);
    if (!currentSession?.active) return;
    if (message.params?.timestamp) syncCdpClock(currentSession, message.params.timestamp);
    if (message.params?.wallTime && !currentSession.cdpTimeOffsetMs) {
      currentSession.cdpTimeOffsetMs = (Number(message.params.wallTime) * 1000) - (Number(message.params.timestamp || 0) * 1000);
    }

    if (message.method === 'Runtime.consoleAPICalled') {
      const args = message.params.args || [];
      const relativeMs = getRelativeMsFromCdpTimestamp(currentSession, message.params.timestamp);
      emitLog({
        type: 'log',
        source: 'manual-cdp',
        sessionId: session.sessionId,
        testCaseId: session.testCaseId,
        level: message.params.type === 'error' ? 'SEVERE' : message.params.type === 'warning' ? 'WARNING' : 'INFO',
        console: true,
        log: args.map(arg => truncateText(arg.value ?? arg.description ?? arg.type)).join(' '),
        timestamp: new Date(currentSession.startedAtMs + relativeMs).toISOString(),
        relativeMs,
      });
      if (message.params.type === 'error' || message.params.type === 'warning') {
        sessionInfo.recording?.captureNow?.('console-error');
      }
    }

    if (message.method === 'Runtime.exceptionThrown') {
      const relativeMs = getRelativeMsFromCdpTimestamp(currentSession, message.params.timestamp);
      emitLog({
        type: 'log',
        source: 'manual-cdp',
        sessionId: session.sessionId,
        testCaseId: session.testCaseId,
        level: 'SEVERE',
        console: true,
        log: message.params.exceptionDetails?.text || 'Runtime exception',
        timestamp: new Date(currentSession.startedAtMs + relativeMs).toISOString(),
        relativeMs,
      });
      sessionInfo.recording?.captureNow?.('exception');
    }

    if (message.method === 'Network.requestWillBeSent') {
      if (sessionInfo.recording) sessionInfo.recording.lastNetworkActivityAt = Date.now();
      const requestRelativeMs = getRelativeMsFromCdpTimestamp(currentSession, message.params.timestamp);
      sessionInfo.requestMeta.set(message.params.requestId, {
        method: message.params.request.method,
        url: message.params.request.url,
        headers: redactHeaders(message.params.request.headers),
        requestBody: redactPayload(message.params.request.postData),
        startedAt: Date.now(),
        requestRelativeMs,
        requestTimestamp: message.params.timestamp,
      });
      if (sessionInfo.recording?.mode === 'frame') sessionInfo.recording.captureNow?.('network-request');
    }

    if (message.method === 'Network.responseReceived') {
      if (sessionInfo.recording) sessionInfo.recording.lastNetworkActivityAt = Date.now();
      const request = sessionInfo.requestMeta.get(message.params.requestId) || {};
      const response = message.params.response;
      const responseRelativeMs = getRelativeMsFromCdpTimestamp(currentSession, message.params.timestamp);
      sessionInfo.requestMeta.set(message.params.requestId, {
        ...request,
        status: response.status,
        responseHeaders: redactHeaders(response.headers),
        responseRelativeMs,
        responseTimestamp: message.params.timestamp,
      });
      if (response.status >= 400) sessionInfo.recording?.captureNow?.('network-error');
    }

    if (message.method === 'Network.loadingFinished') {
      if (sessionInfo.recording) sessionInfo.recording.lastNetworkActivityAt = Date.now();
      const request = sessionInfo.requestMeta.get(message.params.requestId);
      if (!request?.url) return;
      const finishedRelativeMs = getRelativeMsFromCdpTimestamp(currentSession, message.params.timestamp);
      let body = null;
      try {
        const result = await cdp.send('Network.getResponseBody', { requestId: message.params.requestId });
        body = result?.base64Encoded ? '[base64 response omitted]' : redactPayload(result?.body);
      } catch (_) {}
      sessionInfo.requestMeta.delete(message.params.requestId);
      emitLog({
        type: 'log',
        source: 'manual-cdp',
        sessionId: session.sessionId,
        testCaseId: session.testCaseId,
        log: 'Network Trace',
        network: {
          event: 'Response',
          method: request.method,
          url: request.url,
          status: request.status,
          success: typeof request.status === 'number' ? request.status < 400 : undefined,
          duration: Math.max(0, Math.round(finishedRelativeMs - (request.requestRelativeMs ?? finishedRelativeMs))),
          headers: request.responseHeaders || request.headers,
          data: {
            requestHeaders: request.headers,
            requestBody: request.requestBody,
            responseBody: body,
          },
        },
        timestamp: new Date(currentSession.startedAtMs + finishedRelativeMs).toISOString(),
        relativeMs: finishedRelativeMs,
      });
      if (typeof request.status === 'number' && request.status >= 400) {
        sessionInfo.recording?.captureNow?.('network-error');
      } else if (sessionInfo.recording?.mode === 'frame') {
        sessionInfo.recording.captureNow?.('network-finished');
      }
    }
  });

  cdp.ws.on('close', () => {
    const currentSession = getManualSession(session.sessionId);
    if (currentSession?.active) {
      activeManualSessions.set(session.sessionId, {
        ...currentSession,
        active: false,
        stoppedAt: new Date().toISOString(),
      });
    }
    stopManualRecorder(sessionInfo.recording, 'interrupted');
    stopCdpCapture(session.sessionId).catch(() => {});
    emitLog({
      type: 'log',
      source: 'manual-capture',
      sessionId: session.sessionId,
      testCaseId: session.testCaseId,
      level: 'INFO',
      log: 'Manual Capture Stopped',
      timestamp: new Date().toISOString(),
      relativeMs: getRelativeMs(currentSession || session),
    });
    cdpSessions.delete(session.sessionId);
  });

  await cdp.send('Runtime.enable');
  await cdp.send('Network.enable');
  await cdp.send('Page.enable');
  await installCdpClickTracker(cdp, session);
  await focusCdpPage(cdp, target);
  sessionInfo.recording = startManualRecorder(session, cdp, targetUrl, { captureMode: session.captureMode });
  return {
    port,
    mode: 'cdp',
    browserMode,
    profileDir: browserMode === 'profiled' ? userDataDir : null,
  };
}

async function stopCdpCapture(sessionId) {
  const session = cdpSessions.get(sessionId);
  if (!session) return { browserClosed: false, cdpClosed: false, recording: null, errors: [] };

  const result = { browserClosed: false, cdpClosed: false, recording: null, errors: [] };
  result.recording = stopManualRecorder(session.recording);
  try {
    await session.cdp.send('Browser.close');
    result.browserClosed = true;
  } catch (error) {
    result.errors.push(`Browser.close failed: ${error.message}`);
  }
  try {
    session.cdp.ws.close();
    result.cdpClosed = true;
  } catch (error) {
    result.errors.push(`CDP close failed: ${error.message}`);
  }
  try {
    if (!session.browser.killed) {
      session.browser.kill();
      result.browserClosed = true;
    }
  } catch (error) {
    result.errors.push(`Browser kill failed: ${error.message}`);
  }
  cdpSessions.delete(sessionId);
  if (session.userDataDir && session.cleanupUserDataDir !== false) {
    setTimeout(() => {
      fs.rm(session.userDataDir, { recursive: true, force: true }, () => {});
    }, 1500);
  }
  return result;
}

// HTTP Server: Menerima POST /log dari Katalon
const server = http.createServer((req, res) => {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const requestUrl = new URL(req.url, 'http://localhost:3001');

  if (req.method === 'POST' && requestUrl.pathname === '/log') {
    readJsonBody(req, (error, logData) => {
      try {
        if (error) throw error;
        if (isStoppedManualLog(logData)) {
          return sendJson(res, 409, { success: false, error: 'Manual capture session is not active' });
        }

        if (logData.interaction?.type === 'click' && logData.sessionId) {
          const sessionInfo = cdpSessions.get(logData.sessionId);
          sessionInfo?.recording?.noteClick?.(logData.interaction);
        }

        console.log(`[HTTP IN] Received log #${logData.type} for TC: ${logData.testCaseId}`);
        emitLog(logData);

        sendJson(res, 200, { success: true });
      } catch (e) {
        console.error('Invalid JSON received:', e.message);
        sendJson(res, 400, { success: false, error: 'Invalid JSON' });
      }
    });
  } else if (req.method === 'POST' && requestUrl.pathname === '/manual/start') {
    readJsonBody(req, async (error, data) => {
      if (error) return sendJson(res, 400, { success: false, error: 'Invalid JSON' });
      const { testCaseId, sessionId, targetUrl, launchBrowser } = data;
      const requestedBrowserMode = data.browserMode || 'clean';
      const requestedCaptureMode = parseCaptureMode(data.captureMode || process.env.QA_CAPTURE_MODE);
      if (!testCaseId || !sessionId) {
        return sendJson(res, 400, { success: false, error: 'testCaseId and sessionId are required' });
      }
      if (!['clean', 'profiled'].includes(requestedBrowserMode)) {
        return sendJson(res, 400, { success: false, error: 'browserMode must be clean or profiled' });
      }
      if (targetUrl && !isValidHttpUrl(targetUrl)) {
        return sendJson(res, 400, { success: false, error: 'targetUrl must be a valid http/https URL' });
      }

      for (const [id, session] of activeManualSessions.entries()) {
        if (session.testCaseId === testCaseId && session.active) {
          activeManualSessions.set(id, { ...session, active: false, stoppedAt: new Date().toISOString() });
          await stopCdpCapture(id);
        }
      }

      if (requestedBrowserMode === 'profiled') {
        for (const [id, session] of activeManualSessions.entries()) {
          if (session.browserMode === 'profiled' && session.active) {
            activeManualSessions.set(id, { ...session, active: false, stoppedAt: new Date().toISOString() });
            await stopCdpCapture(id);
          }
        }
        cleanupProfileBrowserProcesses(getManualCaptureProfileDir());
        cleanupProfileLockFiles(getManualCaptureProfileDir());
      }

      const startedAtMs = Date.now();
      const startedAtHrNs = process.hrtime.bigint().toString();
      const session = {
        sessionId,
        testCaseId,
        targetUrl: targetUrl || null,
        browserMode: requestedBrowserMode,
        captureMode: requestedCaptureMode,
        active: true,
        startedAt: new Date(startedAtMs).toISOString(),
        startedAtMs,
        startedAtHrNs,
      };
      activeManualSessions.set(sessionId, session);

      let captureMode = 'url-params';
      let profileDir = null;
      try {
        if (launchBrowser && targetUrl) {
          const cdp = await startCdpCapture(session, targetUrl, { browserMode: requestedBrowserMode });
          captureMode = cdp.mode;
          profileDir = cdp.profileDir;
        }
      } catch (error) {
        activeManualSessions.set(sessionId, { ...session, active: false, stoppedAt: new Date().toISOString() });
        return sendJson(res, 500, { success: false, error: error.message });
      }

      emitLog({
        type: 'log',
        source: 'manual-capture',
        sessionId,
        testCaseId,
        level: 'INFO',
        log: `Starting Manual Capture (${requestedBrowserMode === 'profiled' ? 'Profiled Browser' : 'Clean Browser'}, ${requestedCaptureMode} mode)${targetUrl ? `: ${targetUrl}` : ''}`,
        timestamp: session.startedAt,
        relativeMs: 0,
      });

      sendJson(res, 200, { success: true, session, mode: captureMode, browserMode: requestedBrowserMode, captureMode: requestedCaptureMode, profileDir });
    });
  } else if (req.method === 'POST' && requestUrl.pathname === '/manual/stop') {
    readJsonBody(req, async (error, data) => {
      if (error) return sendJson(res, 400, { success: false, error: 'Invalid JSON' });
      const { sessionId } = data;
      const session = getManualSession(sessionId);
      if (!session) {
        const cleanup = await stopCdpCapture(sessionId);
        return sendJson(res, 200, { success: true, alreadyStopped: true, cleanup });
      }

      const stoppedAt = new Date().toISOString();
      activeManualSessions.set(sessionId, { ...session, active: false, stoppedAt });
      const cleanup = await stopCdpCapture(sessionId);
      emitLog({
        type: 'log',
        source: 'manual-capture',
        sessionId,
        testCaseId: session.testCaseId,
        level: 'INFO',
        log: 'Manual Capture Stopped',
        timestamp: stoppedAt,
        relativeMs: getRelativeMs(session),
      });

      sendJson(res, 200, { success: true, cleanup });
    });
  } else if (req.method === 'GET' && requestUrl.pathname.startsWith('/manual/session/')) {
    const sessionId = decodeURIComponent(requestUrl.pathname.split('/').pop());
    const session = getManualSession(sessionId);
    if (!session) return sendJson(res, 404, { success: false, active: false });
    sendJson(res, 200, { success: true, ...session });
  } else if (req.method === 'GET' && requestUrl.pathname.startsWith('/recordings/')) {
    const parts = requestUrl.pathname.split('/').filter(Boolean).map(decodeURIComponent);
    const [, testCaseId, sessionId, type, file] = parts;

    if (testCaseId && sessionId === 'latest') {
      const metadata = getLatestRecordingMetadata(testCaseId);
      if (!metadata) return sendJson(res, 404, { success: false, error: 'Recording not found' });
      return sendJson(res, 200, { success: true, recording: metadata });
    }

    if (testCaseId && sessionId && type === 'metadata') {
      const metadata = readRecordingMetadata(testCaseId, sessionId);
      if (!metadata) return sendJson(res, 404, { success: false, error: 'Recording not found' });
      return sendJson(res, 200, { success: true, recording: metadata });
    }

    if (testCaseId && sessionId && type === 'frames' && file) {
      let framePath = null;
      for (const paths of [getRecordingPaths(testCaseId, sessionId), getLegacyRecordingPaths(testCaseId, sessionId)]) {
        const candidatePath = path.resolve(paths.framesDir, file);
        const frameRoot = path.resolve(paths.framesDir);
        const relativeFramePath = path.relative(frameRoot, candidatePath);
        if (!relativeFramePath.startsWith('..') && !path.isAbsolute(relativeFramePath) && fs.existsSync(candidatePath)) {
          framePath = candidatePath;
          break;
        }
      }
      if (!framePath) {
        return sendJson(res, 404, { success: false, error: 'Frame not found' });
      }
      res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'no-store' });
      return fs.createReadStream(framePath).pipe(res);
    }

    if (testCaseId && sessionId && type === 'video' && file) {
      let videoPath = null;
      for (const paths of [getRecordingPaths(testCaseId, sessionId), getLegacyRecordingPaths(testCaseId, sessionId)]) {
        const candidatePath = path.resolve(paths.videoDir, file);
        const videoRoot = path.resolve(paths.videoDir);
        const relativeVideoPath = path.relative(videoRoot, candidatePath);
        if (!relativeVideoPath.startsWith('..') && !path.isAbsolute(relativeVideoPath) && fs.existsSync(candidatePath)) {
          videoPath = candidatePath;
          break;
        }
      }
      if (!videoPath) {
        return sendJson(res, 404, { success: false, error: 'Video not found' });
      }
      const ext = path.extname(videoPath).toLowerCase();
      const contentType = ext === '.mp4' ? 'video/mp4' : 'video/webm';
      const stat = fs.statSync(videoPath);
      const range = req.headers.range;
      if (range) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(range);
        if (match) {
          const start = match[1] ? Number(match[1]) : 0;
          const end = match[2] ? Number(match[2]) : stat.size - 1;
          const safeStart = Math.max(0, Math.min(start, stat.size - 1));
          const safeEnd = Math.max(safeStart, Math.min(end, stat.size - 1));
          res.writeHead(206, {
            'Content-Type': contentType,
            'Cache-Control': 'no-store',
            'Accept-Ranges': 'bytes',
            'Content-Range': `bytes ${safeStart}-${safeEnd}/${stat.size}`,
            'Content-Length': safeEnd - safeStart + 1,
          });
          return fs.createReadStream(videoPath, { start: safeStart, end: safeEnd }).pipe(res);
        }
      }
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-store',
        'Accept-Ranges': 'bytes',
        'Content-Length': stat.size,
      });
      return fs.createReadStream(videoPath).pipe(res);
    }

    sendJson(res, 404, { success: false, error: 'Recording not found' });
  } else if (req.method === 'GET' && requestUrl.pathname.startsWith('/logs/')) {
    // run=current/latest mengambil run terbaru; run=previous/history mengambil satu run sebelumnya.
    // Tanpa query, fallback ke previous lalu current agar UI lama tidak 404 ketika baru ada satu run.
    const tcId = decodeURIComponent(requestUrl.pathname.split('/').pop());
    const run = requestUrl.searchParams.get('run') || 'auto';
    const { current, previous, legacy } = getRunPaths(tcId);
    const candidates = run === 'current' || run === 'latest'
      ? [{ kind: 'current', filePath: current }]
      : run === 'previous' || run === 'history'
        ? [{ kind: 'previous', filePath: previous }, { kind: 'legacy', filePath: legacy }]
        : [
            { kind: 'previous', filePath: previous },
            { kind: 'current', filePath: current },
            { kind: 'legacy', filePath: legacy },
          ];
    const found = candidates.find(candidate => fs.existsSync(candidate.filePath));
    
    if (found) {
      res.writeHead(200, {
        'Content-Type': 'application/x-jsonlines',
        'X-QA-Log-Run': found.kind,
      });
      fs.createReadStream(found.filePath).pipe(res);
    } else {
      res.writeHead(404);
      res.end(`No ${run === 'auto' ? 'saved' : run} logs found for this test case`);
    }
  } else {
    res.writeHead(404);
    res.end();
  }
});

// Upgrade HTTP ke WebSocket
server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

server.listen(3001, () => {
  console.log('Log Relay Server (HTTP + WS) started on http://localhost:3001');
});
