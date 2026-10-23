/* eslint-disable @typescript-eslint/no-require-imports -- Playwright loads this bridge as CommonJS. */
const { test: base, expect } = require('@playwright/test');
const { emit } = require('./script-telemetry.cjs');
const path = require('node:path');
const cap = value => String(value ?? '').slice(0, 12000);
const test = base.extend({
  _tracevaTelemetry: [async ({ context }, use, testInfo) => {
    const pending = new Set();
    const starts = new WeakMap();
    let pageIndex = 0;
    const attach = page => {
      const videoIndex = pageIndex++;
      const relativeMs = Math.max(0, Date.now() - Number(process.env.TRACEVA_RUN_STARTED));
      if (page.video()) void page.video().path().then(file => emit('execution', 'Rekaman video dimulai', { event: 'video.started', relativeMs, metadata: { file: path.basename(file), testId: testInfo.testId, videoIndex } })).catch(() => {});
      page.on('console', message => emit('console', message.text(), { level: message.type() === 'error' ? 'SEVERE' : message.type() === 'warning' ? 'WARNING' : 'INFO' }));
      page.on('pageerror', error => emit('console', error.message, { level: 'SEVERE' }));
      page.on('framenavigated', frame => { if (frame === page.mainFrame()) emit('execution', `Menuju halaman ${frame.url()}`); });
    };
    context.pages().forEach(attach);
    context.on('page', attach);
    context.on('request', request => starts.set(request, Date.now()));
    context.on('response', response => {
      if (pending.size >= 50) return;
      const work = (async () => {
        const request = response.request();
        const responseHeaders = await response.allHeaders();
        let responseBody;
        if (/json|text|xml|javascript/.test(responseHeaders['content-type'] || '') && Number(responseHeaders['content-length'] || 0) < 100000) {
          responseBody = cap(await response.text().catch(() => ''));
        }
        emit('network', `${request.method()} ${response.url()}`, { network: { method: request.method(), event: 'Response', url: response.url(), status: response.status(), success: response.ok(), duration: Date.now() - (starts.get(request) || Date.now()), headers: responseHeaders,
          data: { resourceType: request.resourceType(), requestHeaders: await request.allHeaders(), requestBody: cap(request.postData()), responseBody } } });
      })().catch(error => emit('console', `Telemetry: ${error.message}`, { level: 'WARNING' }));
      pending.add(work); work.finally(() => pending.delete(work));
    });
    context.on('requestfailed', request => emit('network', request.failure()?.errorText || 'Request gagal', { network: { method: request.method(), url: request.url(), status: 0, success: false, data: { requestBody: cap(request.postData()), resourceType: request.resourceType() } } }));
    try { await use(); } finally { await Promise.race([Promise.allSettled([...pending]), new Promise(resolve => setTimeout(resolve, 2000))]); }
  }, { auto: true }],
});
module.exports = { ...require('@playwright/test'), test, expect };
