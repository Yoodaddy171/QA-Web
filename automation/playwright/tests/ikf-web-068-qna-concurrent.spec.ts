import path from 'node:path';
import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { sendDevLog, sanitizeBody, redactHeaders } from '../devlog-client';

/**
 * IKF-WEB-068 — Q&A dua sesi paralel tetap terisolasi.
 *
 * Dua peserta terautentikasi dipertahankan paralel pada dua BrowserContext
 * terpisah, masing-masing pada Q&A sesi berbeda. Codex sebelumnya hanya
 * berhasil satu peserta membuka dua Q&A bergantian, jadi aspek realtime
 * antar-klien belum terbukti.
 *
 * Q&A disimpan di Firebase RTDB (tidak ada endpoint REST di API doc), jadi
 * verifikasi dilakukan pada apa yang benar-benar dirender tiap klien.
 */

const QA_TESTCASE_ID = 'cmuaxa3xg0009wqjcqe00l7qh';
const BASE = process.env.QA_BASE_URL || 'https://ikf2026.unictive.net';
const SESSION_A = process.env.QA_SESSION_A || '10';
const SESSION_B = process.env.QA_SESSION_B || '23';
const CODE_A = process.env.QA_CODE_A || 'PR3FLJKY';
const CODE_B = process.env.QA_CODE_B || 'PR3FNLHV';

const RUN_TAG = `QA068-${Date.now().toString(36).toUpperCase()}`;
const MARKER_A = `${RUN_TAG}-ALPHA`;
const MARKER_B = `${RUN_TAG}-BRAVO`;

const sessionId = `pw-068-${Date.now()}`;
const startedAtMs = Date.now();

async function devlog(input: Parameters<typeof sendDevLog>[0]) {
  await sendDevLog({ ...input, relativeMs: Date.now() - startedAtMs });
}

const step = (message: string, data?: unknown) =>
  devlog({
    category: 'execution',
    event: 'step',
    testCaseId: QA_TESTCASE_ID,
    sessionId,
    log: data === undefined ? message : { message, data: sanitizeBody(data) },
  });

/** Wire console + network of a manually created context into the QA-Web relay. */
function attachDevLog(context: BrowserContext, label: string) {
  context.on('console', (msg) => {
    const type = msg.type();
    void devlog({
      category: 'console',
      event: 'console',
      testCaseId: QA_TESTCASE_ID,
      sessionId,
      level: type === 'error' ? 'SEVERE' : type === 'warning' ? 'WARNING' : 'INFO',
      console: true,
      log: `[${label}] ${msg.text()}`,
    });
  });

  context.on('page', (page) => {
    page.on('pageerror', (error) => {
      void devlog({
        category: 'console',
        event: 'console',
        testCaseId: QA_TESTCASE_ID,
        sessionId,
        level: 'SEVERE',
        console: true,
        log: { context: label, name: error.name, message: error.message },
      });
    });
  });

  context.on('response', async (response) => {
    const url = response.url();
    // Only the product's own traffic; skip assets and the relay itself.
    if (!/cms-ikf2026|ikf2026\.unictive|firebaseio|firebasedatabase/.test(url)) return;
    if (/\.(js|css|png|jpg|jpeg|svg|woff2?)(\?|$)/.test(url)) return;

    let headers: Record<string, string> = {};
    try { headers = redactHeaders(await response.allHeaders()); } catch { /* best effort */ }

    void devlog({
      category: 'network',
      event: 'network.response',
      testCaseId: QA_TESTCASE_ID,
      sessionId,
      log: 'Network Trace',
      network: {
        event: 'Response',
        method: response.request().method(),
        url,
        status: response.status(),
        success: response.ok(),
        headers,
        data: { context: label, requestBody: sanitizeBody(response.request().postData()) },
      },
    });
  });
}

/** Ticket-code login. Waits on real conditions, never on a fixed sleep. */
async function login(page: Page, code: string, label: string) {
  await page.goto(`${BASE}/entry`, { waitUntil: 'domcontentloaded' });

  const codeInput = page.locator('input[name=code]');
  await codeInput.waitFor({ state: 'visible' });
  await codeInput.fill(code);

  // The submit button inside the form only enables once Ionic's form control
  // accepts the value; header has a second "Login" button that must be avoided.
  const submit = page.locator('form ion-button').filter({ hasText: /Login/i });
  await expect(submit).toBeEnabled();
  await submit.click();

  await page.waitForURL((url) => !/\/entry(\/|$)/.test(url.pathname), { timeout: 45_000 });
  await step(`[${label}] login selesai`, { landedUrl: page.url() });
  expect(page.url()).not.toMatch(/\/personal-data/);
}

/** Open a Q&A session page and wait until it is actually interactive. */
async function openQna(page: Page, session: string, label: string) {
  await page.goto(`${BASE}/qna-session/${session}`, { waitUntil: 'domcontentloaded' });

  const editor = page.locator('ion-textarea textarea, textarea').first();
  await editor.waitFor({ state: 'visible', timeout: 30_000 });

  const send = page.locator('ion-button, button').filter({ hasText: /^\s*Send\s*$/i }).last();
  await send.waitFor({ state: 'visible', timeout: 30_000 });

  await step(`[${label}] Q&A sesi ${session} siap`, { url: page.url() });
  return { editor, send };
}

async function askQuestion(page: Page, session: string, label: string, marker: string) {
  const { editor, send } = await openQna(page, session, label);
  const text = `${marker} pertanyaan uji isolasi sesi ${session}`;

  await editor.fill(text);
  await expect(send).toBeEnabled();
  await send.click();

  // The question is considered delivered once this client renders it back.
  await expect(page.locator('body')).toContainText(marker, { timeout: 30_000 });
  await step(`[${label}] pertanyaan terkirim di sesi ${session}`, { marker });
  return text;
}

async function bodyText(page: Page) {
  return (await page.locator('body').innerText()).replace(/\s+/g, ' ');
}

test.describe.configure({ mode: 'serial' });

test('IKF-WEB-068 - Q&A dua sesi paralel tetap terisolasi', async ({ browser }) => {
  test.setTimeout(300_000);

  await devlog({
    category: 'execution',
    event: 'run.started',
    testCaseId: QA_TESTCASE_ID,
    sessionId,
    relativeMs: 0,
    log: 'Starting Playwright Automation: IKF-WEB-068 Q&A dua sesi paralel',
  });

  // Rekam tiap peserta sebagai video terpisah. Manual Capture hanya punya satu
  // browser, jadi justru tidak bisa membuktikan skenario dua peserta paralel;
  // dua video inilah bukti visual yang benar untuk testcase ini.
  const videoDir = path.resolve(process.env.QA_VIDEO_DIR || 'test-results/ikf-web-068');
  // Ukuran video disamakan dengan viewport; kalau beda, halaman diperkecil dan
  // sisanya jadi bilah abu-abu di tepi frame.
  const viewport = { width: 1366, height: 900 };
  const recordVideo = { dir: videoDir, size: viewport };

  const ctxA = await browser.newContext({ viewport, recordVideo });
  const ctxB = await browser.newContext({ viewport, recordVideo });
  attachDevLog(ctxA, 'A');
  attachDevLog(ctxB, 'B');

  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();
  pageA.setDefaultTimeout(45_000);
  pageB.setDefaultTimeout(45_000);

  const findings: Record<string, unknown> = { runTag: RUN_TAG, sessionA: SESSION_A, sessionB: SESSION_B };

  try {
    await step('Login dua peserta secara paralel');
    await Promise.all([
      login(pageA, CODE_A, 'A'),
      login(pageB, CODE_B, 'B'),
    ]);

    await step('Buka kedua Q&A bersamaan dan kirim satu pertanyaan unik masing-masing');
    const [textA, textB] = await Promise.all([
      askQuestion(pageA, SESSION_A, 'A', MARKER_A),
      askQuestion(pageB, SESSION_B, 'B', MARKER_B),
    ]);
    findings.textA = textA;
    findings.textB = textB;

    // Beri kesempatan realtime menyebar sebelum menyatakan tidak ada kebocoran.
    await step('Verifikasi isolasi saat kedua klien masih hidup (realtime)');
    const crossA = await pageA.locator('body')
      .filter({ hasText: MARKER_B })
      .waitFor({ state: 'visible', timeout: 8_000 })
      .then(() => true)
      .catch(() => false);
    const crossB = await pageB.locator('body')
      .filter({ hasText: MARKER_A })
      .waitFor({ state: 'visible', timeout: 8_000 })
      .then(() => true)
      .catch(() => false);

    findings.liveLeakIntoA = crossA;
    findings.liveLeakIntoB = crossB;
    await step('Hasil pemeriksaan realtime', { liveLeakIntoA: crossA, liveLeakIntoB: crossB });

    expect(crossA, `Pertanyaan sesi ${SESSION_B} bocor ke sesi ${SESSION_A}`).toBe(false);
    expect(crossB, `Pertanyaan sesi ${SESSION_A} bocor ke sesi ${SESSION_B}`).toBe(false);

    await step('Refresh kedua konteks dan verifikasi pertanyaan tetap di sesi asal');
    await Promise.all([
      pageA.reload({ waitUntil: 'domcontentloaded' }),
      pageB.reload({ waitUntil: 'domcontentloaded' }),
    ]);
    await Promise.all([
      expect(pageA.locator('body')).toContainText(MARKER_A, { timeout: 30_000 }),
      expect(pageB.locator('body')).toContainText(MARKER_B, { timeout: 30_000 }),
    ]);

    const afterA = await bodyText(pageA);
    const afterB = await bodyText(pageB);
    findings.afterReloadLeakIntoA = afterA.includes(MARKER_B);
    findings.afterReloadLeakIntoB = afterB.includes(MARKER_A);
    findings.afterReloadKeepsOwnA = afterA.includes(MARKER_A);
    findings.afterReloadKeepsOwnB = afterB.includes(MARKER_B);

    await step('Hasil pemeriksaan setelah refresh', findings);

    expect(findings.afterReloadLeakIntoA, 'Setelah refresh, pertanyaan sesi B muncul di sesi A').toBe(false);
    expect(findings.afterReloadLeakIntoB, 'Setelah refresh, pertanyaan sesi A muncul di sesi B').toBe(false);
  } finally {
    await step('Ringkasan eksekusi', findings);
    await devlog({
      category: 'execution',
      event: 'run.finished',
      testCaseId: QA_TESTCASE_ID,
      sessionId,
      log: { message: 'Finished Playwright Automation: IKF-WEB-068', findings },
    });
    // Video baru ditulis ke disk setelah context ditutup.
    const videoA = pageA.video();
    const videoB = pageB.video();
    await ctxA.close();
    await ctxB.close();

    const paths = {
      pesertaA: await videoA?.path().catch(() => null),
      pesertaB: await videoB?.path().catch(() => null),
    };
    console.log('VIDEO_PESERTA_A:', paths.pesertaA);
    console.log('VIDEO_PESERTA_B:', paths.pesertaB);
    await step('Video per peserta tersimpan', paths);
  }
});
