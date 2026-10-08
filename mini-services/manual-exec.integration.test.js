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
      const execution = await call(`/manual/${sessionId}/exec`, { expression: '(async () => { console.log("exec-fixture-marker"); return await Promise.all([0,1,2].map(i => fetch("/dummy?i="+i, {method:"POST"}).then(r => r.json()))); })()' });
      expect(await execution.json()).toMatchObject({ success: true, result: [{ ok: true }, { ok: true }, { ok: true }], exceptionDetails: null });
      let records = [];
      for (let i = 0; i < 40; i++) {
        const response = await call(`/logs/${testCaseId}?run=current`);
        if (response.ok) records = (await response.text()).trim().split('\n').filter(Boolean).map(line => JSON.parse(line).automationEvent);
        if (records.filter(row => JSON.stringify(row).includes('/dummy') && row.eventType === 'network.response').length >= 3) break;
        await pause(250);
      }
      expect(hits).toBe(3);
      for (const eventType of ['network.request', 'network.response']) {
        expect(records.filter(row => row.eventType === eventType && JSON.stringify(row).includes('/dummy')).length, JSON.stringify(records.map(r => ({ eventType: r.eventType, type: r.type })))).toBe(3);
      }
      expect(records.some(row => JSON.stringify(row).includes('exec-fixture-marker'))).toBe(true);
      expect(fs.readdirSync(path.join(directory, 'logs')).length).toBeGreaterThan(0);
      console.log(`Verified real capture JSONL: ${path.join(directory, 'logs')}`);
    } finally {
      try { await call('/manual/stop', { sessionId }); } catch (_) {}
      relay.kill();
      await new Promise(resolve => fixture.close(resolve));
    }
  }, 90000);
});
