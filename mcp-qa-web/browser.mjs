import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';

// Separate browser for the system under test. QA-Web persistence uses authenticated API tools.
export class TestBrowser {
  logs = [];
  requestTiming = new WeakMap();
  requestSessions = new WeakMap();
  delivery = Promise.resolve(true);
  pendingLogs = 0;
  captures = new Set();
  constructor(runtime) { this.runtime = runtime; }
  emitDevLog(entry) {
    if (!this.testCaseId || this.pendingLogs >= 200) return Promise.resolve(false);
    const deadline = Date.now() + 1500;
    let payload;
    try {
      payload = JSON.stringify({
        ...entry,
        schemaVersion: 2, type: 'log', runner: 'playwright', source: 'playwright-mcp',
        testCaseId: this.testCaseId, sessionId: this.sessionId,
        timestamp: new Date().toISOString(), relativeMs: entry.event === 'run.started' ? 0 : Math.max(0, Date.now() - this.runStartedAt),
      });
    } catch { return Promise.resolve(false); }
    this.pendingLogs++;
    // Snapshot identity/payload now, then serialize delivery so run rotation cannot overtake steps.
    this.delivery = this.delivery.then(async () => {
      try {
        const remaining = deadline - Date.now();
        if (remaining <= 0) return false;
        const url = new URL(this.runtime.relay);
        const basePath = url.pathname.replace(/\/+$/, '');
        url.pathname = basePath.endsWith('/log') ? basePath : `${basePath}/log`;
        const headers = { 'Content-Type': 'application/json', Origin: this.runtime.web };
        if (this.runtime.env?.QA_RELAY_TOKEN) headers.Authorization = `Bearer ${this.runtime.env.QA_RELAY_TOKEN}`;
        const response = await fetch(url, { method: 'POST', headers, body: payload, redirect: 'error', signal: AbortSignal.timeout(remaining) });
        await response.body?.cancel();
        return response.ok;
      } catch { return false; }
      finally { this.pendingLogs--; }
    });
    return this.delivery;
  }
  async bind(args) {
    const id = args.testCaseId ?? args.qaTestCaseId ?? this.testCaseId ?? this.runtime.env?.QA_TEST_CASE_ID;
    if (!id || id === this.testCaseId) return;
    await this.finishRun();
    this.testCaseId = id;
    this.sessionId = `pw-mcp-${Date.now()}-${crypto.randomUUID()}`;
    this.runStartedAt = Date.now();
    this.actionFailed = false;
    this.endingRun = false;
    await this.emitDevLog({ category: 'execution', event: 'run.started', relativeMs: 0, log: `Starting Playwright Automation: ${args.testName || id}` });
  }
  async finishRun(status) {
    if (!this.sessionId) return;
    this.endingRun = true;
    await Promise.allSettled([...this.captures]);
    await this.delivery;
    await this.emitDevLog({ category: 'execution', event: 'run.finished', log: 'Execution complete: Playwright Automation', durationMs: Date.now() - this.runStartedAt, status: status || (this.actionFailed ? 'FAILED' : 'COMPLETED') });
    this.testCaseId = this.sessionId = this.runStartedAt = null;
  }
  log(entry) {
    this.logs.push(entry);
    if (this.logs.length > 500) this.logs.shift();
  }
  captureNetwork(request, response) {
    const capture = this.readNetwork(request, response);
    this.captures.add(capture);
    void capture.finally(() => this.captures.delete(capture));
  }
  async readNetwork(request, response) {
    try {
    if (response) this.log({ type: 'response', url: response.url().split('?')[0], status: response.status() });
    else this.log({ type: 'requestfailed', url: request.url().split('?')[0], text: request.failure()?.errorText });
    if (!this.sessionId || this.endingRun || this.requestSessions.get(request) !== this.sessionId) return;
    const duration = Math.max(0, Date.now() - (this.requestTiming.get(request) ?? Date.now()));
    // allHeaders includes cookie/security headers omitted by Playwright's headers().
    const [requestHeaders, responseHeaders] = await Promise.all([request.allHeaders(), response ? response.allHeaders() : {}]);
    const status = response?.status() ?? 0;
    void this.emitDevLog({ category: 'network', event: response ? 'network.response' : 'network.error', network: {
      event: response ? 'Response' : 'Error', method: request.method(), url: request.url(), status,
      success: !!response && status < 400,
      duration, headers: responseHeaders,
      data: { resourceType: request.resourceType(), requestHeaders, requestBody: request.postData(), ...(!response ? { error: request.failure()?.errorText } : {}) },
    } });
    } catch { /* Observability must never throw into Playwright's event dispatcher. */ }
  }
  async perform(args) {
    if (args.action === 'close') { await this.close(args.status); return { closed: true }; }
    await this.bind(args);
    const labels = { open: 'Open', click: 'Click', fill: 'Fill', select: 'Select', press: 'Press key', check: 'Check', wait: 'Wait for visible element', assert_text: 'Assert text on page', screenshot: 'Capture screenshot' };
    if (labels[args.action]) void this.emitDevLog({ category: 'execution', event: 'step', log: `${labels[args.action]}${args.action === 'open' ? ` ${args.url}` : args.role ? ` role=${args.role} name=${args.name || ''}` : args.selector ? ` ${args.selector}` : ''}` });
    try {
    if (!this.browser) {
      const require = createRequire(path.join(this.runtime.root, 'package.json'));
      const { chromium } = require('playwright');
      this.browser = await chromium.launch({ headless: true });
      this.context = await this.browser.newContext();
      await this.context.route('**/*', async route => {
        const request = route.request();
        const url = new URL(request.url());
        const controlService = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && [new URL(this.runtime.web).port, new URL(this.runtime.relay).port].includes(url.port);
        if (controlService && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) return route.abort('blockedbyclient');
        await route.continue();
      });
      this.page = await this.context.newPage();
      this.page.setDefaultTimeout(15000);
      this.page.on('console', msg => {
        this.log({ type: 'console', level: msg.type(), text: msg.text() });
        if (!this.endingRun) void this.emitDevLog({ category: 'console', event: 'console', level: ({ error: 'SEVERE', warning: 'WARNING', debug: 'DEBUG' })[msg.type()] || 'INFO', log: msg.text() });
      });
      this.page.on('pageerror', e => {
        this.log({ type: 'error', text: e.message });
        if (!this.endingRun) void this.emitDevLog({ category: 'console', event: 'console', level: 'SEVERE', log: e.message });
      });
      this.context.on('request', request => {
        this.requestTiming.set(request, Date.now());
        this.requestSessions.set(request, this.sessionId);
      });
      this.context.on('response', response => this.captureNetwork(response.request(), response));
      this.context.on('requestfailed', request => this.captureNetwork(request));
    }
    const locator = args.role ? this.page.getByRole(args.role, { name: args.name, exact: true }) : args.selector ? this.page.locator(args.selector) : null;
    switch (args.action) {
      case 'open': {
        const url = new URL(args.url);
        if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Use an http/https test target.');
        await this.page.goto(url.href, { waitUntil: 'domcontentloaded' }); break;
      }
      case 'click': await locator.click(); break;
      case 'fill': await locator.fill(args.value); break;
      case 'select': await locator.selectOption(args.value); break;
      case 'press': await (locator || this.page.locator('body')).press(args.value); break;
      case 'check': await locator.setChecked(args.value !== 'false'); break;
      case 'wait': await locator.waitFor({ state: 'visible' }); break;
      case 'assert_text': {
        const actual = await (locator || this.page.locator('body')).innerText();
        if (!actual.includes(args.value)) this.actionFailed = true;
        void this.emitDevLog({ category: 'execution', event: 'step', log: 'Text assertion result', status: actual.includes(args.value) ? 'PASSED' : 'FAILED' });
        return { passed: actual.includes(args.value), expected: args.value, actual: actual.slice(0, 12000), url: this.page.url() };
      }
      case 'screenshot': {
        await fs.mkdir(this.runtime.artifacts, { recursive: true });
        const outputPath = path.join(this.runtime.artifacts, `${crypto.randomUUID()}.png`);
        await this.page.screenshot({ path: outputPath, fullPage: true });
        return { outputPath, mimeType: 'image/png', url: this.page.url(), next: 'Attach using the execution evidence POST tool with files:[{path:outputPath}] and query.projectId.' };
      }
      case 'logs': return this.runtime.scrub({ logs: this.logs, runner: 'playwright', testCaseId: this.testCaseId, sessionId: this.sessionId });
      case 'snapshot': break;
      default: throw new Error('Unknown browser action');
    }
    return this.runtime.scrub({ url: this.page.url(), title: await this.page.title(), snapshot: (await this.page.locator('body').ariaSnapshot()).slice(0, 24000) });
    } catch (error) {
      this.actionFailed = true;
      void this.emitDevLog({ category: 'execution', event: 'step', status: 'FAILED', log: `Browser action failed: ${args.action}` });
      throw error;
    }
  }
  async close(status) {
    try { await this.finishRun(status); await this.browser?.close(); }
    finally {
      this.browser = this.context = this.page = null;
      this.logs = [];
      this.requestTiming = new WeakMap();
      this.requestSessions = new WeakMap();
      this.captures.clear();
      this.testCaseId = this.sessionId = this.runStartedAt = null;
      this.actionFailed = false;
      this.endingRun = false;
    }
  }
}
