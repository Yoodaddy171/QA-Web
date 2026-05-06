const { WebSocketServer } = require('ws');
const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

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

function getRecordingPaths(testCaseId, sessionId) {
  const safeTestCaseId = encodeURIComponent(testCaseId);
  const safeSessionId = encodeURIComponent(sessionId);
  const baseDir = path.join(RECORDINGS_DIR, safeTestCaseId, safeSessionId);
  return {
    baseDir,
    framesDir: path.join(baseDir, 'frames'),
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
    metadata: path.join(baseDir, 'metadata.json'),
  };
}

function buildRecordingFrameUrl(testCaseId, sessionId, file) {
  return `/recordings/${encodeURIComponent(testCaseId)}/${encodeURIComponent(sessionId)}/frames/${encodeURIComponent(file)}`;
}

function writeRecordingMetadata(recording) {
  if (!recording) return;
  const payload = {
    sessionId: recording.sessionId,
    testCaseId: recording.testCaseId,
    targetUrl: recording.targetUrl,
    startedAt: recording.startedAt,
    stoppedAt: recording.stoppedAt || null,
    frameIntervalMs: recording.frameIntervalMs,
    status: recording.status,
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

function startFrameRecorder(session, cdp, targetUrl) {
  const configuredInterval = Number(process.env.QA_RECORDING_INTERVAL_MS);
  const frameIntervalMs = Number.isFinite(configuredInterval)
    ? Math.min(1000, Math.max(150, configuredInterval))
    : 300;
  const configuredQuality = Number(process.env.QA_RECORDING_JPEG_QUALITY);
  const jpegQuality = Number.isFinite(configuredQuality)
    ? Math.min(80, Math.max(35, configuredQuality))
    : 52;
  const paths = getRecordingPaths(session.testCaseId, session.sessionId);
  fs.mkdirSync(paths.framesDir, { recursive: true });

  const recording = {
    sessionId: session.sessionId,
    testCaseId: session.testCaseId,
    targetUrl,
    startedAt: session.startedAt,
    stoppedAt: null,
    frameIntervalMs,
    status: 'recording',
    frames: [],
    frameIndex: 0,
    timer: null,
    paths,
    capturing: false,
    pendingCapture: false,
    lastCaptureStartedAt: 0,
    lastNetworkActivityAt: Date.now(),
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
    if (!currentSession?.active) return;
    if (recording.capturing) {
      recording.pendingCapture = true;
      return;
    }

    recording.capturing = true;
    recording.pendingCapture = false;
    await waitForPageSettled();
    if (!getManualSession(session.sessionId)?.active) {
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
      if (!getManualSession(session.sessionId)?.active) return;

      const captureEndedRelativeMs = getRelativeMs(currentSession);
      const relativeMs = Math.round((captureStartedRelativeMs + captureEndedRelativeMs) / 2);
      recording.frameIndex += 1;
      const file = `${String(recording.frameIndex).padStart(6, '0')}.jpg`;
      fs.writeFileSync(path.join(paths.framesDir, file), Buffer.from(result.data, 'base64'));
      recording.frames.push({
        file,
        relativeMs,
        capturedAtMs: captureEndedRelativeMs,
        captureDurationMs: Math.max(0, captureEndedRelativeMs - captureStartedRelativeMs),
        reason,
        timestamp: new Date().toISOString(),
      });

      if (recording.frames.length % 5 === 0) writeRecordingMetadata(recording);
    } catch (error) {
      if (getManualSession(session.sessionId)?.active) {
        console.warn('Manual recording frame skipped:', error.message);
      }
    } finally {
      recording.capturing = false;
      if (recording.pendingCapture && getManualSession(session.sessionId)?.active) {
        setTimeout(() => captureFrame('event-followup'), 80);
      }
    }
  };

  recording.captureNow = (reason = 'event') => {
    if (!getManualSession(session.sessionId)?.active) return;
    if (recording.capturing) {
      recording.pendingCapture = true;
      return;
    }
    const elapsedSinceLastCapture = Date.now() - recording.lastCaptureStartedAt;
    if (elapsedSinceLastCapture < 120) {
      recording.pendingCapture = true;
      setTimeout(() => captureFrame(reason), 120 - elapsedSinceLastCapture);
      return;
    }
    setTimeout(() => captureFrame(reason), 0);
  };

  recording.timer = setInterval(captureFrame, frameIntervalMs);
  setTimeout(() => captureFrame('initial'), 100);
  writeRecordingMetadata(recording);
  return recording;
}

function stopFrameRecorder(recording) {
  if (!recording) return null;
  if (recording.timer) clearInterval(recording.timer);
  recording.timer = null;
  recording.status = 'stopped';
  recording.stoppedAt = new Date().toISOString();
  writeRecordingMetadata(recording);
  return {
    sessionId: recording.sessionId,
    testCaseId: recording.testCaseId,
    frameCount: recording.frames.length,
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

async function startCdpCapture(session, targetUrl) {
  const browserPath = findBrowserPath();
  if (!browserPath) throw new Error('Chrome atau Edge tidak ditemukan untuk manual capture');

  const port = 9300 + Math.floor(Math.random() * 500);
  const userDataDir = path.join(os.tmpdir(), `qadesk-manual-${session.sessionId}`);
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

  const target = await waitForCdpPage(port, targetUrl);
  const cdp = createCdpClient(target.webSocketDebuggerUrl);
  await cdp.waitOpen();

  const sessionInfo = {
    browser,
    cdp,
    requestMeta: new Map(),
    userDataDir,
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
      sessionInfo.recording?.captureNow?.('console');
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
      sessionInfo.recording?.captureNow?.('network-request');
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
      sessionInfo.recording?.captureNow?.('network-response');
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
      sessionInfo.recording?.captureNow?.('network-finished');
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
    stopFrameRecorder(sessionInfo.recording);
    cdpSessions.delete(session.sessionId);
  });

  await cdp.send('Runtime.enable');
  await cdp.send('Network.enable');
  await cdp.send('Page.enable');
  await focusCdpPage(cdp, target);
  sessionInfo.recording = startFrameRecorder(session, cdp, targetUrl);
  return { port, mode: 'cdp' };
}

async function stopCdpCapture(sessionId) {
  const session = cdpSessions.get(sessionId);
  if (!session) return { browserClosed: false, cdpClosed: false, recording: null, errors: [] };

  const result = { browserClosed: false, cdpClosed: false, recording: null, errors: [] };
  result.recording = stopFrameRecorder(session.recording);
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
  if (session.userDataDir) {
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
      if (!testCaseId || !sessionId) {
        return sendJson(res, 400, { success: false, error: 'testCaseId and sessionId are required' });
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

      const startedAtMs = Date.now();
      const startedAtHrNs = process.hrtime.bigint().toString();
      const session = {
        sessionId,
        testCaseId,
        targetUrl: targetUrl || null,
        active: true,
        startedAt: new Date(startedAtMs).toISOString(),
        startedAtMs,
        startedAtHrNs,
      };
      activeManualSessions.set(sessionId, session);

      let captureMode = 'url-params';
      try {
        if (launchBrowser && targetUrl) {
          const cdp = await startCdpCapture(session, targetUrl);
          captureMode = cdp.mode;
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
        log: `Starting Manual Capture${targetUrl ? `: ${targetUrl}` : ''}`,
        timestamp: session.startedAt,
        relativeMs: 0,
      });

      sendJson(res, 200, { success: true, session, mode: captureMode });
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
