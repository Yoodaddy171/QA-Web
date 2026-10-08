# QA Web - Playwright DevLog Adapter

Folder ini membuat Playwright dapat mengirim log ke DevLog QA Web yang sama dengan Katalon.

## Yang tetap dipakai dari QA Web

Relay existing tetap:

```text
http://127.0.0.1:3001/log
```

Tidak perlu mengganti `mini-services/ws-server.js` untuk integration versi ini.

## Install

Dari Windows:

```bat
automation\playwright\install-playwright.bat
```

Atau manual:

```bash
cd automation/playwright
npm install
npx playwright install chromium
```

## Jalankan relay QA Web

Dari root repository:

```bash
node mini-services/ws-server.js
```

Atau launcher QA Web existing milik project.

## Jalankan test

Relay mengautentikasi **semua** request, termasuk `/log`. Tanpa `QA_RELAY_TOKEN`
di environment, DevLog dibalas `401` lalu ditelan diam-diam (sifatnya
best-effort) sehingga testnya tetap hijau tetapi **tidak ada evidence yang masuk
ke QA-Web**. Gunakan script `test:relay`, yang memuat `.env` root repo otomatis
supaya token tidak perlu ditempel manual:

```bash
cd automation/playwright
npm run test:relay
```

Satu file test saja:

```bash
npm run test:relay -- tests/nama-file.spec.ts
```

Headed (browser terlihat):

```bash
npm run test:relay:headed
```

`npm test` biasa tetap ada, tetapi tidak memuat token — pakai itu hanya untuk
test yang memang tidak perlu mengirim DevLog.

Debug:

```bash
npm run test:debug
```

### IKF-WEB-068 (Q&A dua sesi paralel)

```bash
npm run test:068
```

Headed, kalau ingin menonton dua peserta berjalan bersamaan:

```bash
npm run test:068:headed
```

Test ini membuka dua BrowserContext peserta terautentikasi sekaligus dan
merekam satu video per peserta ke `test-results/ikf-web-068/`. Path kedua video
dicetak di akhir run sebagai `VIDEO_PESERTA_A` dan `VIDEO_PESERTA_B`.

Variabel yang bisa diubah tanpa menyentuh kode:

```text
QA_CODE_A / QA_CODE_B        ticket code tiap peserta (default PR3FLJKY / PR3FNLHV)
QA_SESSION_A / QA_SESSION_B  id sesi Q&A (default 10 / 23, keduanya harus is_opened)
QA_BASE_URL                  default https://ikf2026.unictive.net
QA_VIDEO_DIR                 folder output video
```

Tiap run mengirim satu pertanyaan uji baru ke Q&A staging pada kedua sesi dan
pertanyaan itu menetap di sana, jadi jalankan seperlunya saja.

## Hubungkan Test Case QA Desk

Set `qaTestCaseId` menggunakan **Internal Database ID / UUID** QA Desk.

```ts
import { test, expect } from '../devlog-fixture';

test.use({
  qaTestCaseId: 'UUID-DARI-QA-DESK',
});

test('Login berhasil', async ({ page, qaLog }) => {
  await qaLog('Open login page');
  await page.goto('https://staging.example.com/login');

  await qaLog('Input credentials');
  await page.getByLabel('Email').fill('qa@example.com');
  await page.getByLabel('Password').fill('secret');

  await qaLog('Submit login');
  await page.getByRole('button', { name: 'Login' }).click();

  await expect(page.getByText('Dashboard')).toBeVisible();
});
```

`qaLog()` opsional. Console dan network capture berjalan otomatis.

## Data yang otomatis dikirim

- Run started / finished
- Browser console
- Uncaught page errors
- Network responses
- Failed network requests
- Request payload
- Text/JSON response payload dengan limit
- Response status + duration
- Runner = `playwright`
- Session ID unik per test

Sensitive headers/body seperti authorization, cookie, token, password, PIN, secret, dan API key di-redact sebelum dikirim.

## Environment variables

```text
QA_RELAY_TOKEN                 WAJIB agar DevLog diterima relay; dimuat otomatis oleh test:relay
QA_BASE_URL
QA_HEADLESS=0
QA_IGNORE_HTTPS_ERRORS=1
QA_PLAYWRIGHT_WORKERS=1
QA_DEVLOG_URL=http://127.0.0.1:3001/log
QA_DEVLOG_TIMEOUT_MS=1500
QA_DEVLOG_MAX_TEXT_LENGTH=4000
QA_DEVLOG_MAX_RESPONSE_BODY_BYTES=1048576
```

## Artifact Playwright

Config sudah mengaktifkan:

```text
screenshot = only-on-failure
video      = retain-on-failure
trace      = retain-on-failure
```

Artifact Playwright disimpan di folder `test-results` / report Playwright.
Versi ini belum meng-upload artifact tersebut ke relay QA Web; DevLog QA Web fokus dulu pada Execution, Console, dan Network agar migration dari Katalon tetap aman.
