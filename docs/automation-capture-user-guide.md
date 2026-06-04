# Automation Capture User Guide

Automation Capture membantu QA engineer dan automation engineer melihat apa yang terjadi selama pengujian melalui halaman Devlog QA-Web. Fitur ini menggabungkan execution step, browser console, network activity, screenshot, evidence, dan history ke test case yang tepat.

Panduan ini mencakup dua mode capture yang tetap terpisah pada layer browser:

- **Manual Capture**: QA-Web relay membuka dan mengontrol browser sendiri melalui Chrome DevTools Protocol (CDP).
- **Katalon Capture**: Katalon membuka dan mengontrol browser Selenium sendiri, lalu `DevLog.groovy` menangkap event melalui `HasDevTools` atau fallback browser logs.

Setelah event ditangkap, kedua mode memakai pipeline yang sama:

```text
capture source
  -> AutomationEventV1 normalization
  -> relay ingestion
  -> WebSocket broadcast
  -> Devlog UI
  -> evidence/history support
```

## 1. Overview

Automation Capture dibuat agar hasil test tidak hanya berupa status lulus atau gagal. Devlog menampilkan langkah eksekusi, request network, browser console, status CDP, fallback capture, screenshot, dan bukti lain yang membantu investigasi.

Gunakan fitur ini ketika:

- melakukan testing manual yang membutuhkan jejak browser;
- menjalankan automation Katalon dan ingin hasilnya terlihat di QA-Web;
- menelusuri error API, browser console, atau urutan langkah;
- menghubungkan hasil test dengan test case QA-Web yang benar.

**Evidence** adalah artefak pendukung seperti screenshot atau recording. **History** adalah hasil run sebelumnya yang disimpan oleh relay untuk membantu perbandingan.

## 2. System Requirements

| Komponen | Kebutuhan |
| --- | --- |
| QA-Web | Aplikasi berjalan lokal dan test case target sudah tersedia. |
| Relay | `mini-services/ws-server.js` berjalan dan dapat diakses, biasanya pada `http://127.0.0.1:3001`. |
| Browser | Chrome atau Edge Chromium yang kompatibel dengan mode capture. |
| Katalon Studio | Dibutuhkan untuk Katalon Capture. |
| Network | Katalon dan browser dapat mengakses relay URL. |
| Mapping | Katalon test case dipetakan ke internal QA-Web `testCaseId`. |
| Profile | Variabel Automation Capture dikonfigurasi pada Katalon execution profile. |

Variabel profile Katalon:

| Variable | Nilai umum | Keterangan |
| --- | --- | --- |
| `webQaEnabled` | `true` | Mengaktifkan pengiriman event ke QA-Web. |
| `webQaRelayUrl` | `http://127.0.0.1:3001/log` | Endpoint ingestion legacy-compatible. |
| `webQaProjectId` | kosong atau project ID | Project QA-Web opsional. |
| `webQaDefaultTestCaseId` | kosong | Fallback sementara saja. Jangan gunakan sebagai mapping permanen. |
| `webQaCaptureNetwork` | `true` | Mengaktifkan network capture. |
| `webQaCaptureConsole` | `true` | Mengaktifkan browser console capture. |
| `webQaCaptureScreenshots` | `false` atau `true` | Mengaktifkan screenshot event. |

## 3. Architecture

### Manual Capture

```text
User starts Manual Capture
  -> relay opens browser
  -> CDP captures browser events
  -> relay normalizes events
  -> WebSocket broadcasts events
  -> Devlog displays logs
```

### Katalon Capture

```text
Katalon runs test case
  -> DevLogListener starts run
  -> DevLog.groovy captures steps, network, and console
  -> events are normalized
  -> relay receives events through /log
  -> WebSocket broadcasts events
  -> Devlog displays logs
```

Manual Capture dan Katalon Capture tidak berbagi browser session. Keduanya baru menyatu setelah event dinormalisasi menjadi `AutomationEventV1`.

## 4. Manual Capture Guide

1. Buka terminal pada root QA-Web.
2. Jalankan aplikasi dan relay dengan `run-web-qa.bat`, atau jalankan keduanya secara terpisah:

   ```text
   npm run dev
   node mini-services/ws-server.js
   ```

3. Buka QA-Web, pilih project, lalu buka detail test case yang ingin diuji.
4. Buka tab **Devlog** dan bagian **Manual Capture**.
5. Pastikan status relay menunjukkan koneksi aktif.
6. Masukkan URL website target, pilih browser atau mode recording jika tersedia, lalu klik **Start Capture**.
7. Lakukan interaksi pada browser yang dibuka relay.
8. Buka tab **Network** untuk memastikan request terlihat. Gunakan filter `Document`, `Script`, `Image`, `Preflight`, atau kategori lain bila diperlukan.
9. Buka tab **Console** untuk memastikan browser log terlihat.
10. Buka tab **Execution** untuk melihat aktivitas manual capture.
11. Klik **Stop Capture** setelah pengujian selesai.
12. Periksa recording, evidence, dan history bila tersedia.

Troubleshooting Manual Capture:

- Jika browser tidak terbuka, pastikan Chrome atau Edge tersedia dan profile browser tidak sedang terkunci.
- Jika relay offline, restart `mini-services/ws-server.js`.
- Jika network atau console kosong, pastikan CDP berhasil terhubung dan ulangi capture setelah relay direstart.
- Jika port `3001` dipakai proses lain, hentikan proses tersebut atau perbaiki konfigurasi relay secara konsisten.

## 5. Katalon Capture Guide

1. Buka project Katalon yang akan digunakan.
2. Pastikan project memiliki:
   - `Keywords/com/utils/DevLog.groovy`
   - `Test Listeners/DevLogListener.groovy`
   - `Include/testcase-map.json`
3. Buka execution profile yang digunakan.
4. Set `webQaEnabled` menjadi `true`.
5. Set `webQaRelayUrl` menjadi `http://127.0.0.1:3001/log` atau URL relay yang sesuai.
6. Set `webQaCaptureNetwork` menjadi `true`.
7. Set `webQaCaptureScreenshots` sesuai kebutuhan.
8. Tambahkan mapping test case Katalon ke internal QA-Web `testCaseId` pada `Include/testcase-map.json`.
9. Jalankan QA-Web dan relay.
10. Buka test case QA-Web yang sudah dipetakan, lalu buka tab **Devlog**.
11. Jalankan test case Katalon, misalnya **QA WEB automation**.
12. Verifikasi event `run.started` muncul.
13. Verifikasi step penting muncul pada tab **Execution**.
14. Verifikasi browser console muncul pada tab **Console**.
15. Verifikasi request muncul pada tab **Network**.
16. Setelah run selesai, verifikasi event `run.finished` muncul.

Script Katalon cukup memanggil keyword reusable untuk langkah penting:

```groovy
CustomKeywords.'com.utils.DevLog.step'('Opening checkout page')
CustomKeywords.'com.utils.DevLog.network'('POST', checkoutUrl, checkoutResponse)
CustomKeywords.'com.utils.DevLog.console'('WARNING', 'Optional warning message')
CustomKeywords.'com.utils.DevLog.captureScreenshot'('checkout-result')
```

`DevLogListener` menangani start dan finish run secara otomatis. Jangan membuat `runId` baru untuk setiap step.

## 6. Katalon Test Case Mapping

`Include/testcase-map.json` menghubungkan path test case Katalon dengan internal database ID test case QA-Web.

```json
{
  "Test Cases/QA Web automation": "00000000-0000-0000-0000-000000000001",
  "Test Cases/Checkout/Happy Path": "00000000-0000-0000-0000-000000000002"
}
```

Ganti placeholder dengan internal QA-Web `testCaseId`, bukan display ID seperti `E-124`.

Mapping diperlukan agar event tampil pada test case yang benar. Jika mapping hilang, `DevLog.groovy` mengirim warning dan memakai ID yang ditandai `unmapped:<katalon-path>`, atau memakai `webQaDefaultTestCaseId` bila fallback itu dikonfigurasi. Event tersebut tidak boleh dianggap sebagai mapping permanen.

Cara menambah mapping:

1. Buka detail test case QA-Web dan salin internal database ID.
2. Salin path lengkap test case Katalon, termasuk prefix `Test Cases/`.
3. Tambahkan pasangan path dan ID pada `Include/testcase-map.json`.
4. Pastikan JSON valid.
5. Jalankan ulang test dan periksa test case target di Devlog.

Jangan hardcode `testCaseId` pada script automation. Hardcoded ID mudah salah ketika script dipakai ulang atau test case dipindahkan.

## 7. Event Contract

`AutomationEventV1` adalah format event bersama yang membuat Manual Capture dan Katalon Capture dapat ditampilkan dengan cara yang konsisten.

| Field | Arti |
| --- | --- |
| `schemaVersion` | Versi kontrak, saat ini `1`. |
| `eventId` | ID unik untuk deduplikasi event. |
| `runId` | ID stabil untuk satu run. |
| `mode` | `manual`, `katalon`, atau `unknown`. |
| `testCaseId` | Internal QA-Web test case ID. |
| `testCaseName` | Nama atau path test case. |
| `source` | Sumber event, misalnya `manual-cdp`, `katalon-devtools`, atau `katalon-fallback`. |
| `eventType` | Jenis event. |
| `message` | Pesan yang ditampilkan. |
| `timestamp` | Waktu event. |
| `url`, `method`, `responseStatus` | Informasi network. |
| `cdpAvailable` | Apakah capture CDP tersedia. |
| `fallbackUsed` | Apakah fallback browser/performance log digunakan. |
| `screenshotPath` | Lokasi screenshot bila tersedia. |
| `metadata` | Informasi tambahan untuk diagnosis dan kompatibilitas. |

Event type umum:

- `run.started`
- `run.finished`
- `step`
- `console`
- `network.request`
- `network.response`
- `screenshot`
- `warning`
- `error`

## 8. Devlog Page

Devlog tersedia pada detail test case QA-Web.

| Tab | Isi |
| --- | --- |
| Execution | Run start, run finish, step, warning, error, screenshot, dan evidence. |
| Console | Browser console activity. |
| Network | Request dan response network, status, URL, header, payload, dan kategori resource. |
| Current / Previous | Run terbaru atau history sebelumnya. |

Network log dapat difilter berdasarkan host, method, status, dan kategori seperti API, Preflight, Document, Script, Image, Static, Telemetry, Data URL, atau Other.

Relay dapat mengirim format legacy `type: "log"` dan envelope baru `type: "automation.event"` untuk event yang sama. Frontend mencegah baris duplikat menggunakan `eventId`, lalu memakai fingerprint timestamp, source, message, dan event type sebagai fallback.

Untuk memastikan event terhubung ke test case yang benar, periksa mapping Katalon dan pastikan `testCaseId` event sama dengan internal ID test case yang sedang dibuka.

## 9. Troubleshooting

| Problem | Possible Cause | How To Fix |
| --- | --- | --- |
| Devlog tidak menampilkan log | Relay offline atau WebSocket belum terhubung | Jalankan atau restart relay, lalu refresh QA-Web. |
| Network event tidak muncul | CDP gagal, network capture mati, atau filter menyembunyikan resource | Set `webQaCaptureNetwork=true`, cek `cdpAvailable`, dan aktifkan filter Network yang sesuai. |
| Console event tidak muncul | Browser log tidak tersedia atau console capture belum aktif | Pastikan browser mendukung logs/CDP dan cek Desired Capabilities. |
| Katalon berjalan tetapi Devlog kosong | `webQaEnabled=false`, relay URL salah, atau mapping hilang | Aktifkan profile, perbaiki URL, dan lengkapi `testcase-map.json`. |
| Test case yang salah menerima log | Mapping atau fallback ID salah | Perbaiki mapping dan kosongkan fallback sementara bila tidak diperlukan. |
| Relay port sudah dipakai | Proses lain memakai port `3001` | Hentikan proses tersebut, lalu restart relay. |
| CDP attach gagal | Browser driver tidak mendukung `HasDevTools` atau library tidak cocok | Gunakan browser/driver yang kompatibel dan cek Selenium DevTools library. |
| `fallbackUsed` bernilai `true` | DevTools tidak tersedia | Periksa `metadata.devToolsAttachError`; fallback network dapat bersifat parsial. |
| Mapping `testcase-map.json` hilang | File tidak ada atau path Katalon tidak cocok | Buat file, gunakan path lengkap, dan validasi JSON. |
| `webQaEnabled` bernilai `false` | Profile salah atau capture dinonaktifkan | Gunakan profile yang benar dan set menjadi `true`. |
| `webQaRelayUrl` salah | URL tidak menuju endpoint `/log` | Gunakan URL relay yang benar, biasanya `http://127.0.0.1:3001/log`. |
| Browser logs tidak tersedia | Desired Capabilities belum mengaktifkan browser/performance logs | Aktifkan logging capability untuk browser Katalon. |
| Log duplikat muncul | Event legacy dan normalized tidak memiliki fingerprint yang sama | Pastikan producer mempertahankan `eventId`, `timestamp`, `source`, dan `eventType`. |
| Screenshot hilang | Screenshot capture mati atau browser belum terbuka | Set `webQaCaptureScreenshots=true` dan panggil screenshot setelah browser tersedia. |

## 10. Validation Checklist

### Manual Capture

- [ ] Relay berjalan.
- [ ] Browser dibuka oleh relay.
- [ ] CDP capture bekerja.
- [ ] Network muncul.
- [ ] Console muncul.
- [ ] Event muncul pada Devlog test case yang benar.
- [ ] Stop Capture bekerja.

### Katalon Capture

- [ ] Execution profile dikonfigurasi.
- [ ] `testcase-map.json` dikonfigurasi.
- [ ] QA WEB automation berjalan.
- [ ] Satu `runId` stabil dipakai selama run.
- [ ] `mode` bernilai `katalon`.
- [ ] `testCaseId` sesuai mapping.
- [ ] Network muncul.
- [ ] Console muncul.
- [ ] `run.finished` muncul.

## 11. Best Practices

- Selalu gunakan `testcase-map.json`.
- Jangan hardcode `testCaseId`.
- Gunakan satu `runId` stabil per run.
- Restart relay dengan sengaja sebelum validasi besar.
- Biarkan Manual Capture dan Katalon Capture tetap terpisah pada capture layer.
- Normalisasi event sebelum ditampilkan.
- Jangan mengubah perilaku CDP relay tanpa menguji Manual Capture.
- Gunakan nama test case yang jelas.
- Dokumentasikan perubahan pada template.
- Jangan menghapus kompatibilitas `/log` sampai migrasi selesai.

## 12. For Developers

File penting di QA-Web:

| File | Tanggung jawab |
| --- | --- |
| `mini-services/ws-server.js` | Relay HTTP, WebSocket broadcast, Manual Capture, dan JSONL storage. |
| `mini-services/automation-event.js` | Normalisasi AutomationEventV1. |
| `mini-services/automation-event.test.js` | Test normalizer relay. |
| `src/lib/client/automation/automation-event-client.ts` | Parser dan adapter event frontend. |
| `src/lib/client/automation/automation-event-client.test.ts` | Test parser frontend. |
| `src/hooks/useAutomationLogs.ts` | WebSocket consumption dan visible log deduplication. |
| `docs/automation-event-contract.md` | Kontrak event teknis. |

File penting di Katalon:

| File | Tanggung jawab |
| --- | --- |
| `Scripts/QA Web automation/Script1777866267090.groovy` | Flow automation dan pemanggilan step/network penting. |
| `Test Listeners/DevLogListener.groovy` | Memulai dan menyelesaikan run. |
| `Keywords/com/utils/DevLog.groovy` | Capture, normalisasi, dan pengiriman event. |
| `Include/testcase-map.json` | Mapping Katalon path ke QA-Web testCaseId. |
| `Profiles/default.glbl` | Konfigurasi capture. |
| `README-AUTOMATION-CAPTURE.md` | Catatan integrasi Katalon. |

Normalisasi relay terjadi di `mini-services/automation-event.js`. WebSocket broadcast terjadi di `mini-services/ws-server.js`. Parsing frontend terjadi di `src/lib/client/automation/automation-event-client.ts`. Katalon mengirim log dari `DevLog.groovy` ke endpoint `/log`.

Untuk menambah event type baru dengan aman:

1. Tambahkan event type pada kontrak relay.
2. Pastikan normalizer mempertahankan field yang diperlukan.
3. Perbarui parser frontend dan aturan kategorisasi.
4. Perbarui producer Katalon bila diperlukan.
5. Tambahkan test relay dan frontend.
6. Jalankan:

   ```text
   npm test
   npm run lint
   npx tsc --noEmit
   ```

Dokumen teknis tambahan: `docs/automation-event-contract.md`.
