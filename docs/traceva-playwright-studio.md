# Traceva Playwright Studio

Tab Automation pada detail testcase sekarang menerima script Playwright Test.
Editor mempertahankan pola visual inspector; hasil memakai viewer video,
Execution, Console, Network, timeline, dan fullscreen yang sudah tersedia.
Manual capture tetap terpisah dan dapat dipilih kembali.

## Menghapus percobaan dari riwayat

Di Riwayat eksekusi, gunakan **Hapus** untuk satu run, atau centang run selesai
dan pilih **Hapus terpilih**. Konfirmasi menampilkan ID, waktu dan status run.
Pilihan semua hanya berlaku untuk run selesai yang sedang ditampilkan, bukan
semua riwayat di disk. Run aktif harus di-Stop dan selesai difinalisasi dahulu.

Penghapusan permanen mencakup folder run (video, screenshot, trace, snapshot
script/input, devlog) dan pointer riwayatnya. Script tersimpan di editor,
testcase, evidence QA terpisah dan run lain tetap ada. Tidak ada pembersihan
otomatis berdasarkan FAILED; kegagalan bisa menandakan bug aplikasi sungguhan.
Run lama dapat muncul kembali karena daftar menampilkan 20 run terbaru tersisa.

MCP: `web_delete_automation_scripts_history` memakai query projectId/testCaseId
dan JSON `{runIds:[...],confirmed:true}` (1–20 UUID unik). Guard MCP tetap
memerlukan persetujuan manusia atas challenge yang terikat payload. API Stop
lama tidak berubah. Respons `{deletedRunIds,failedRunIds}` dapat menunjukkan
hasil parsial jika penyimpanan bermasalah; baca ulang sebelum retry.

## Verifikasi penghapusan riwayat — 23 Oktober 2026

- Full unit suite serial: 393 lulus, 1 skip. Run pertama mengalami timeout pada
  persiapan SQLite Devlog saat preview aktif; run ulang tanpa preview lulus,
  tanpa menaikkan timeout. Tes penghapusan memakai folder temporer saja.
- Mencakup scoped deletion, bulk preflight, run aktif/finalisasi, invalid ID,
  foreign testcase, symlink/junction, kegagalan disk parsial, pointer lama,
  script/evidence terpisah yang tetap ada, session/role/origin dan konfirmasi.
- TypeScript dan targeted ESLint lulus. Detector Impeccable tidak menemukan
  antipattern pada panel yang diubah.
- Preview komponen terisolasi dengan respons sintetis di port 3112: 21
  pemeriksaan Playwright desktop 1440/mobile 390 lulus, tanpa runtime error.
  Konfirmasi, batal tanpa request, error server, single/bulk delete dan Stop
  diperiksa; screenshot desktop/mobile juga ditinjau. Preview sudah dihentikan.
- Ini bukan penghapusan riwayat asli atau E2E produksi. Web/relay yang sedang
  dipakai tidak dihentikan; diperlukan build/restart terpisah untuk memakai
  kode baru di mode production dan reconnect MCP untuk discovery baru.

## Menjalankan script

1. Install dependency project lengkap (`npm install`, termasuk devDependencies).
2. Pastikan Chromium tersedia: `npx playwright install chromium` jika belum ada.
3. Setelah perubahan frontend/API dibangun secara manual, jalankan `npm start`.
4. Jalankan `npm run automation:runner` dalam terminal lain. Alternatifnya,
   BAT production + tunnel otomatis menjalankan runner jika belum aktif.
   BAT tetap **tidak menjalankan build**.
5. Login sebagai owner/admin project, buka testcase → Automation → Playwright Studio.
6. Isi atau unggah script, Base URL bila memakai URL relatif, dan batas waktu.
   Simpan script atau langsung Run script menggunakan isi editor saat itu.
7. Konfirmasikan bahwa script dipercaya, lalu Run script. Klik riwayat run untuk
   melihat hasil pada viewer di bawah. Video tersedia setelah context ditutup.

Format yang didukung adalah script `.spec.ts` mandiri:

```ts
import { test, expect } from '@playwright/test';

test('Login page', async ({ page }) => {
  await test.step('Buka halaman login', async () => {
    await page.goto('/login');
  });
  await expect(page.getByRole('button', { name: 'Masuk', exact: true })).toBeVisible();
});
```

Chromium headless, satu worker, tanpa retry. Import fixture `test` dari
`@playwright/test` dihubungkan otomatis ke kolektor telemetry. Script yang
membutuhkan helper/file lokal lain belum didukung oleh uploader satu file.
Browser/context yang dibuat sendiri di luar fixture tidak mendapat jaminan
video dan telemetry otomatis; gunakan fixture `page`/`context` bawaan.

## Hasil dan data

- Run mempunyai UUID, actor, waktu, status, durasi, input snapshot, dan artefak sendiri.
- Video `.webm`, screenshot saat gagal, serta trace `.zip` tersimpan per run.
- Console, langkah Playwright/assertion, navigasi, dan network direkam.
  Header, payload, dan response tekstual dibatasi ukurannya; bukan pengganti HAR penuh.
- Preview video menggunakan endpoint session-authenticated, mendukung HTTP byte ranges.
- Riwayat menampilkan 20 run terbaru. Run lama tetap ada di disk; belum ada penghapusan
  atau retensi otomatis. Pantau ruang disk dan backup folder runner secara terpisah.
- Status testcase tidak berubah otomatis. Hasil script bukan bukti retest manual.
- Draft browser bersifat lokal, versioned, dan bisa dipulihkan setelah refresh.
  Simpan ke server untuk salinan lintas perangkat; jangan simpan kredensial di editor.
- Tidak ada perubahan schema atau migrasi database utama.

Storage default Windows: `%LOCALAPPDATA%/Traceva/automation`.
Override dengan `QA_SCRIPT_RUNNER_DIR` berupa folder absolut di luar `.next`.
Web dan runner harus memakai konfigurasi/path yang sama serta identitas OS yang
dapat mengakses folder tersebut. Storage tidak memakai `process.cwd()` sehingga
build standalone tidak menghapus hasil run.

## Keamanan dan batasan

Ini **trusted local runner, bukan sandbox**. Script adalah kode Node.js dan
memiliki hak akun OS runner, termasuk akses filesystem dan jaringan. Jangan
memberi role ADMIN/OWNER kepada pengguna yang tidak dipercaya menjalankan kode.
Guest, VIEWER, QA, dan QA_LEAD tidak dapat membaca script/artefak runner atau
menjalankan, menyimpan, dan menghentikannya. API memeriksa session, workspace,
project, testcase, origin mutasi, serta manifest artefak.

Proses script tidak mewarisi environment aplikasi (database, bootstrap, relay,
tunnel token, NODE_OPTIONS). Untuk kredensial pengujian yang sengaja disediakan,
gunakan environment host `TRACEVA_TEST_*`, misalnya `TRACEVA_TEST_PASSWORD`,
lalu baca `process.env.TRACEVA_TEST_PASSWORD` di script. Nilai ini tetap dapat
dibaca script tepercaya; console/network/video bisa merekam data sensitif.

Antrean maksimal 10 permintaan dan satu run aktif per testcase; satu runner
global mengeksekusi secara berurutan. Batas waktu 10–180 detik, hard stop setelah
grace period, telemetry dibatasi sekitar 8 MB, artefak terpantau sampai 250 MB.
Ini pembatasan operasional, **bukan** quota/sandbox yang bisa menahan script jahat.
Stop menghentikan hanya process tree milik run. Run terputus tidak diputar ulang
otomatis saat runner restart. Run antrean baru diproses setelah runner hidup.

Runner tidak membuka port. BAT memakai heartbeat untuk menggunakan runner yang
sudah aktif tanpa mengambil alih proses tersebut; Ctrl+C hanya menghentikan
proses milik launcher. Tunnel tetap meneruskan web saja.

Sebelum SaaS multi-tenant, ganti worker lokal dengan container/job sandbox,
isolasi jaringan/volume, akun OS non-privileged, secret broker, dan quota nyata.

## Verifikasi implementasi

Pengujian runner memakai folder sementara dan website sintetis di loopback,
bukan project atau website produksi. Kasus sukses memverifikasi video, trace,
Execution, Console, dan Network; kasus gagal memverifikasi screenshot dan video.
Test API mencakup session, role, guest, cross-workspace/project, origin,
path traversal, manifest artefak, serta byte-range download.

Fixture dan reporter mengikuti kontrak resmi
[Playwright fixtures](https://playwright.dev/docs/test-fixtures),
[reporters](https://playwright.dev/docs/test-reporters), dan
[video](https://playwright.dev/docs/videos).
# Automation Log integration

Automation Log now merges relay/devlog history with Playwright Studio metadata at read time. Existing Studio runs appear without rerunning or copying artifacts into the database. The table retains one row per testcase; open Automation → Hasil to select individual Studio runs. Use **Sinkronkan** to refresh the list.

Studio metadata remains restricted to project owners/admins, matching the Studio API. The merge never changes the testcase verdict and does not expose script contents, event payloads or artifact filesystem paths. Removing Studio history is reflected on the next synchronization, with retained older runs becoming the latest result where applicable.

