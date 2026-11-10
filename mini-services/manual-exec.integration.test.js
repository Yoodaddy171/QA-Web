// Opt-in real Chrome/Edge test: QA_RELAY_EXEC_INTEGRATION=1 npx vitest run mini-services/manual-exec.integration.test.js
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');

const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

describe.skipIf(process.env.QA_RELAY_EXEC_INTEGRATION !== '1')('manual exec real capture', () => {
  it('captures page-side concurrent fetch requests, responses and console into JSONL', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-relay-exec-'));
    const token = crypto.randomBytes(32).toString('hex');
    const sessionId = `exec-${crypto.randomUUID()}`;
    const testCaseId = sessionId;
    let hits = 0;
    const fixture = http.createServer((req, res) => {
      if (req.url.startsWith('/dummy')) { hits++; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ ok: true })); }
      else if (req.url.startsWith('/fixture.js')) { res.setHeader('Content-Type', 'application/javascript'); res.end('console.debug("exec-fixture-debug");'); }
      else if (req.url === '/connection-failure') { req.socket.destroy(); }
      else { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><title>Local exec fixture</title><p>Local capture fixture</p>'); }
    });
    const fixturePort = await listen(fixture);
    const reservation = http.createServer();
    const relayPort = await listen(reservation);
    await new Promise(resolve => reservation.close(resolve));
    const relay = spawn(process.execPath, ['mini-services/ws-server.js'], {
      cwd: path.resolve(__dirname, '..'), windowsHide: true,
      env: { ...process.env, QA_RELAY_TOKEN: token, QA_RELAY_PORT: String(relayPort), QA_RELAY_ALLOW_BROWSER_LAUNCH: '1', QA_RUNTIME_DIR: directory, QA_RELAY_LOGS_DIR: path.join(directory, 'logs'), POSTGRES_DATABASE_URL: 'disabled' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    relay.stdout.on('data', data => { output = (output + data).slice(-4000); });
    relay.stderr.on('data', data => { output = (output + data).slice(-4000); });
    const call = (route, body, authenticated = true) => fetch(`http://127.0.0.1:${relayPort}${route}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', ...(authenticated ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(45000),
    });
    try {
      let ready = false;
      for (let i = 0; i < 80; i++) {
        try { ready = (await call('/health')).ok; } catch (_) {}
        if (ready) break;
        if (relay.exitCode !== null) throw new Error(`Relay exited: ${output}`);
        await pause(250);
      }
      expect(ready).toBe(true);
      expect((await call(`/manual/${sessionId}/exec`, { expression: '42' }, false)).status).toBe(401);
      expect((await call(`/manual/${sessionId}/exec`, { expression: '42' })).status).toBe(404);
      const start = await call('/manual/start', { sessionId, testCaseId, targetUrl: `http://127.0.0.1:${fixturePort}/`, launchBrowser: true, browserMode: 'clean', captureMode: 'frame' });
      const started = await start.json();
      expect(started, JSON.stringify(started)).toMatchObject({ success: true, mode: 'cdp' });
      let pageReady = false;
      for (let i = 0; i < 80; i++) {
        const probe = await call(`/manual/${sessionId}/exec`, { expression: '({url:location.href,ready:document.readyState})' });
        const state = await probe.json();
        pageReady = state.result?.url === `http://127.0.0.1:${fixturePort}/` && state.result?.ready === 'complete';
        if (pageReady) break;
        await pause(250);
      }
      expect(pageReady).toBe(true);
      const execution = await call(`/manual/${sessionId}/exec`, {
        expression: `(async () => {
          await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = '/fixture.js?token=synthetic-secret';
            script.onload = resolve;
            script.onerror = reject;
            document.head.append(script);
          });
          console.log('exec-fixture-marker');
          const responses = await Promise.all([0, 1, 2].map(() => fetch('/dummy', { method: 'POST' }).then(r => r.json())));
          const failed = await fetch('/connection-failure', { method: 'POST' }).then(() => false, () => true);
          return { responses, failed };
        })()`,
      });
      expect(await execution.json()).toMatchObject({
        success: true, result: { responses: [{ ok: true }, { ok: true }, { ok: true }], failed: true }, exceptionDetails: null,
      });
      let records = [];
      for (let i = 0; i < 40; i++) {
        const response = await call(`/logs/${testCaseId}?run=current`);
        if (response.ok) records = (await response.text()).trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
        if (records.filter(row => row.automationEvent.eventType === 'network.response' && row.network?.url.endsWith('/dummy')).length >= 3
          && records.some(row => row.automationEvent.eventType === 'network.response' && row.network?.url.endsWith('/connection-failure'))
          && records.some(row => row.log === 'exec-fixture-debug')) break;
        await pause(250);
      }
      expect(hits).toBe(3);
      for (const eventType of ['network.request', 'network.response']) {
        expect(records.filter(row => row.automationEvent.eventType === eventType && row.network?.url.endsWith('/dummy'))).toHaveLength(3);
      }
      const completed = records.filter(row => row.automationEvent.eventType === 'network.response' && row.network?.url.endsWith('/dummy'));
      expect(new Set(completed.map(row => row.network.data.requestId)).size).toBe(3);
      for (const response of completed) {
        const captured = response.network.data;
        expect(captured).toMatchObject({
          requestId: expect.any(String), resourceType: 'fetch', mimeType: 'application/json', protocol: 'http/1.1',
        });
        expect(captured.transferSize).toBeGreaterThan(0);
        expect(response.automationEvent.metadata.networkDetails).toMatchObject({
          requestId: captured.requestId, resourceType: 'fetch', mimeType: 'application/json',
          protocol: 'http/1.1', transferSize: captured.transferSize,
        });
      }
      const failed = records.find(row => row.automationEvent.eventType === 'network.response' && row.network?.url.endsWith('/connection-failure'));
      expect(failed?.network).toMatchObject({ success: false, data: { failureText: expect.stringMatching(/^net::ERR_/) } });
      expect(failed.automationEvent.metadata.networkDetails.failureText).toBe(failed.network.data.failureText);
      expect(records.some(row => row.log === 'exec-fixture-marker')).toBe(true);
      const debug = records.find(row => row.log === 'exec-fixture-debug');
      expect(debug?.automationEvent).toMatchObject({ eventType: 'console', metadata: { legacy: { level: 'VERBOSE' }, consoleDetails: { type: 'debug', lineNumber: 0 } } });
      const sourceUrl = new URL(debug.automationEvent.metadata.consoleDetails.url);
      expect(sourceUrl.pathname).toBe('/fixture.js');
      expect(sourceUrl.searchParams.get('token')).toBe('[REDACTED]');
      expect(fs.readdirSync(path.join(directory, 'logs')).length).toBeGreaterThan(0);
      console.log(`Verified real capture JSONL: ${path.join(directory, 'logs')}`);
    } finally {
      try { await call('/manual/stop', { sessionId }); } catch (_) {}
      relay.kill();
      await new Promise(resolve => fixture.close(resolve));
    }
  }, 90000);
});
