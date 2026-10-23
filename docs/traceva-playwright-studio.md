# Traceva Playwright Studio

Tab Automation pada detail testcase sekarang menerima script Playwright Test.
Editor mempertahankan pola visual inspector; hasil memakai viewer video,
Execution, Console, Network, timeline, dan fullscreen yang sudah tersedia.
Manual capture tetap terpisah dan dapat dipilih kembali.

## Menjalankan

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
