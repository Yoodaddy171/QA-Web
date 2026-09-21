import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { TestBrowser } from '../browser.mjs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(import.meta.url);
const { normalizeAutomationEvent, validateAutomationEvent } = require('../../mini-services/automation-event.js');

async function serve(t, handler) {
  const server = http.createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  return `http://127.0.0.1:${server.address().port}`;
}

test('real Chromium preserves actions and raw ordered DevLog with isolated sessions', { timeout: 45000 }, async t => {
  const events = [];
  const paths = [];
  const relay = await serve(t, (req, res) => {
    paths.push(req.url);
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      assert.equal(req.headers.authorization, 'Bearer fixture-relay-token');
      events.push(JSON.parse(body)); res.end('{}');
    });
  });
  let forbiddenWrites = 0;
  const control = await serve(t, (_req, res) => { forbiddenWrites++; res.end('{}'); });
  const target = await serve(t, (req, res) => {
    if (req.url === '/broken') { req.socket.destroy(); return; }
    if (req.url.startsWith('/api')) {
      res.writeHead(500, { 'Content-Type': 'application/json', 'Set-Cookie': 'secret=response-cookie', 'X-Api-Key': 'response-key' });
      res.end('{"message":"fixture HTTP failure"}'); return;
    }
    res.setHeader('Content-Type', 'text/html');
    res.end('<title>Browser fixture</title><label>Email<input id="email"></label><button onclick="document.querySelector(\'#result\').textContent=\'Clicked\'">Login</button><select id="choice"><option value="a">A</option><option value="b">B</option></select><input id="check" type="checkbox"><p id="result">Ready</p>');
  });
  const artifacts = await fs.mkdtemp(path.join(os.tmpdir(), 'qa-browser-test-'));
  const runtime = { root, artifacts, web: control, relay: `${relay}/log`, env: { QA_RELAY_TOKEN: 'fixture-relay-token' }, scrub: value => value };
  const browser = new TestBrowser(runtime);
  t.after(() => browser.close());
  await browser.perform({ action: 'open', url: target, testCaseId: 'internal-case-1', testName: 'Fixture login' });
  const firstSession = browser.sessionId;
  assert.match(firstSession, /^pw-mcp-\d+-/);
  await browser.perform({ action: 'fill', role: 'textbox', name: 'Email', value: 'private-fill-value' });
  await browser.perform({ action: 'press', selector: '#email', value: 'Enter' });
  await browser.perform({ action: 'select', selector: '#choice', value: 'b' });
  await browser.perform({ action: 'check', selector: '#check' });
  await browser.perform({ action: 'wait', selector: '#result' });
  await browser.perform({ action: 'click', role: 'button', name: 'Login' });
  assert.equal((await browser.perform({ action: 'assert_text', value: 'Clicked' })).passed, true);
  assert.equal(await browser.page.locator('#choice').inputValue(), 'b');
  assert.equal(await browser.page.locator('#check').isChecked(), true);
  await browser.page.evaluate(async ({ relay, control }) => {
    console.log('fixture info'); console.warn('fixture warn'); console.debug('fixture debug'); console.error('fixture error');
    console.log('password=console-secret');
    console.log(document.querySelector('#email').value);
    setTimeout(() => { throw new Error('fixture page error'); }, 0);
    await fetch('/api?token=query-secret', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer request-secret', 'X-Api-Key': 'request-key' }, body: JSON.stringify({ password: 'body-secret', nested: { pin: 'pin-secret' }, safe: 'retained' }) });
    await fetch('/api/form', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'password=form-secret&safe=retained' });
    await fetch('/broken').catch(() => {});
    await fetch(control + '/danger', { method: 'POST', mode: 'no-cors', body: 'blocked' }).catch(() => {});
    await fetch(relay + '/danger', { method: 'POST', mode: 'no-cors', body: 'blocked' }).catch(() => {});
  }, { relay, control });
  await browser.delivery;
  const logs = await browser.perform({ action: 'logs' });
  assert.ok(logs.logs.some(e => e.type === 'response' && e.status === 500));
  assert.equal(logs.sessionId, firstSession);
  assert.ok((await browser.perform({ action: 'snapshot' })).snapshot.includes('Clicked'));
  const screenshot = await browser.perform({ action: 'screenshot' });
  assert.equal(path.dirname(screenshot.outputPath), artifacts);
  assert.ok((await fs.stat(screenshot.outputPath)).size > 0);
  assert.equal(screenshot.mimeType, 'image/png');
  await browser.perform({ action: 'snapshot', qaTestCaseId: 'internal-case-2' });
  const secondSession = browser.sessionId;
  assert.notEqual(secondSession, firstSession);
  await browser.perform({ action: 'close', status: 'PASSED' });
  assert.equal(forbiddenWrites, 0);
  assert.ok(paths.every(p => p === '/log'));
  assert.deepEqual(events.filter(e => e.event.startsWith('run.')).map(e => [e.event, e.testCaseId]), [['run.started','internal-case-1'], ['run.finished','internal-case-1'], ['run.started','internal-case-2'], ['run.finished','internal-case-2']]);
  assert.equal(events[0].log, 'Starting Playwright Automation: Fixture login');
  assert.equal(events[0].relativeMs, 0);
  assert.equal(events.at(-1).status, 'PASSED');
  assert.equal(events.find(e => e.event === 'run.finished').status, 'COMPLETED'); // HTTP 500 is not an inferred verdict.
  for (const level of ['INFO','WARNING','DEBUG','SEVERE']) assert.ok(events.some(e => e.category === 'console' && e.level === level));
  assert.ok(events.some(e => e.level === 'SEVERE' && e.log === 'fixture page error'));
  const response = events.find(e => e.network?.status === 500);
  assert.equal(response.event, 'network.response');
  assert.equal(response.network.success, false);
  assert.equal(response.network.method, 'POST');
  assert.ok(response.network.duration >= 0);
  assert.equal(response.network.data.resourceType, 'fetch');
  assert.equal(JSON.parse(response.network.data.requestBody).safe, 'retained');
  assert.ok(events.some(e => e.event === 'network.error' && e.network.status === 0 && e.network.url.endsWith('/broken')));
  assert.ok(events.filter(e => e.category === 'execution').every(e => !('level' in e)));
  const serialized = JSON.stringify(events);
  for (const rawValue of ['private-fill-value','request-secret','request-key','response-cookie','response-key','body-secret','pin-secret','form-secret','query-secret','console-secret']) assert.ok(serialized.includes(rawValue), rawValue);
  assert.ok(!JSON.stringify(events.filter(e => e.category === 'execution')).includes('private-fill-value'));
  // Actual relay normalizer retains compatible categories and lifecycle signals.
  for (const event of events) assert.equal(validateAutomationEvent(normalizeAutomationEvent(event)).valid, true);
  assert.equal(normalizeAutomationEvent(events.at(-1)).eventType, 'run.finished');
  assert.equal(normalizeAutomationEvent(events.find(e => e.category === 'console')).eventType, 'console');
  assert.equal(normalizeAutomationEvent(response).eventType, 'network.response');
  for (const key of ['browser','context','page','testCaseId','sessionId','runStartedAt']) assert.equal(browser[key], null);
  assert.deepEqual(browser.logs, []);
  // Reopening is a clean browser and generates a new automation session.
  await browser.perform({ action: 'open', url: target, testCaseId: 'internal-case-2' });
  assert.notEqual(browser.sessionId, secondSession);
  await browser.close();
});

test('offline/slow relay does not fail browser actions; fallback binding and unbound usage work', { timeout: 20000 }, async t => {
  const hanging = await serve(t, () => {});
  const target = await serve(t, (_req, res) => res.end('<p>Offline relay fixture</p>'));
  const runtime = { root, web: hanging, relay: hanging, env: {}, scrub: v => v };
  const browser = new TestBrowser(runtime);
  t.after(() => browser.close());
  await browser.perform({ action: 'open', url: target });
  assert.equal(browser.testCaseId, undefined);
  runtime.env.QA_TEST_CASE_ID = 'fallback-internal-id';
  const started = Date.now();
  await browser.perform({ action: 'snapshot' });
  assert.equal(browser.testCaseId, 'fallback-internal-id');
  assert.equal((await browser.perform({ action: 'assert_text', value: 'Offline relay fixture' })).passed, true);
  assert.equal(await browser.emitDevLog({ category: 'execution', log: 'timeout check' }), false);
  assert.ok(Date.now() - started < 5500);
  assert.equal((await browser.perform({ action: 'assert_text', value: 'missing text' })).passed, false);
  assert.equal(browser.actionFailed, true);
  await browser.close();
});

test('stdio qa_browser schema preserves binding arguments', { timeout: 15000 }, async () => {
  const client = new Client({ name: 'browser-schema-test', version: '1' });
  const transport = new StdioClientTransport({ command: process.execPath, args: [path.join(root, 'mcp-qa-web/server.mjs')], stderr: 'pipe' });
  try {
    await client.connect(transport);
    const tool = (await client.listTools()).tools.find(tool => tool.name === 'qa_browser');
    for (const key of ['testCaseId','qaTestCaseId','testName','status']) assert.equal(tool.inputSchema.properties[key].type, 'string');
    assert.deepEqual(tool.inputSchema.required, ['action']);
  } finally { await client.close(); }
});

test('actual relay persists Playwright logs and rotates previous run on read-back', { timeout: 20000 }, async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'qa-browser-relay-'));
  const reservation = http.createServer();
  await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const relayUrl = `http://127.0.0.1:${port}`;
  const token = 'isolated-fixture-relay-token-for-browser-tests';
  const child = spawn(process.execPath, ['mini-services/ws-server.js'], {
    cwd: root, windowsHide: true, stdio: ['ignore','ignore','ignore'],
    env: { ...process.env, QA_RELAY_TOKEN: token, QA_RELAY_PORT: String(port), QA_RUNTIME_DIR: directory, QA_RELAY_LOGS_DIR: path.join(directory, 'logs'), POSTGRES_DATABASE_URL: 'disabled', DATABASE_URL: 'disabled' },
  });
  t.after(async () => {
    if (child.exitCode === null) { const exited = new Promise(resolve => child.once('exit', resolve)); child.kill(); await exited; }
  });
  const call = route => fetch(relayUrl + route, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(1000) });
  let ready = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    try { ready = (await call('/health')).ok; } catch { /* Startup only. */ }
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready, 'isolated relay ready');
  const target = await serve(t, (_req, res) => { res.setHeader('Content-Type','text/html'); res.end('<p>Persisted fixture</p><script>console.warn("raw relay marker")</script>'); });
  const browser = new TestBrowser({ root, relay: relayUrl, web: 'http://127.0.0.1:3000', env: { QA_RELAY_TOKEN: token }, scrub: v => v });
  t.after(() => browser.close());
  const read = async run => {
    const response = await call(`/logs/fixture-internal-id?run=${run}`);
    assert.equal(response.status, 200);
    return (await response.text()).trim().split('\n').map(line => JSON.parse(line));
  };
  await browser.perform({ action: 'open', url: target, testCaseId: 'fixture-internal-id' });
  const first = browser.sessionId;
  await browser.close();
  const stored = await read('current');
  assert.ok(stored.every(row => row.sessionId === first && row.runner === 'playwright'));
  assert.equal(stored[0].event, 'run.started');
  assert.equal(stored.at(-1).event, 'run.finished');
  for (const category of ['execution','console','network']) assert.ok(stored.some(row => row.category === category));
  assert.ok(stored.some(row => row.automationEvent.eventType === 'console' && row.log === 'raw relay marker'));
  await browser.perform({ action: 'open', url: target, testCaseId: 'fixture-internal-id' });
  const second = browser.sessionId;
  await browser.close();
  assert.notEqual(first, second);
  assert.ok((await read('previous')).every(row => row.sessionId === first));
  assert.ok((await read('current')).every(row => row.sessionId === second));
});
