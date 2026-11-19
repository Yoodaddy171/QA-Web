# Guidebook Traceva

Traceva menyimpan inventaris testcase, hasil eksekusi per siklus, bug, bukti pengujian, dan laporan QA. Panduan ini memakai instalasi lokal di Windows dengan satu workspace dan SQLite.

- [Sebelum mulai](#sebelum-mulai)
- [Instalasi otomatis](#instalasi-otomatis)
- [Instalasi manual](#instalasi-manual)
- [Menjalankan aplikasi](#menjalankan-aplikasi)
- [Peta halaman](#peta-halaman)
- [Alur QA pertama](#alur-qa-pertama)
- [Capture dan Playwright Studio](#capture-dan-playwright-studio)
- [Konfigurasi dan pemecahan masalah](#konfigurasi-dan-pemecahan-masalah)

## Sebelum mulai

| Kebutuhan | Kegunaan |
| --- | --- |
| Windows, Git, dan izin akses repo | Clone atau pull cabang yang memuat setup. |
| Node.js **24.x** atau **22.13+ di seri 22**, dengan npm | Instalasi, build, dan menjalankan Traceva. |
| Akses internet saat setup | Unduh paket dari npm dan SheetJS, binary Prisma, font build jika diperlukan, serta Chromium Playwright. |
| Chrome atau Edge | Buka Traceva. Manual Capture mode browser memakai browser Chromium yang didukung relay. |
| Ruang lokal untuk database dan rekaman | SQLite menyimpan data aplikasi. Video, screenshot, dan log tersimpan terpisah. |

Ambil [installer Git untuk Windows](https://git-scm.com/download/win) dan [installer resmi Node.js](https://nodejs.org/en/download) sesuai arsitektur komputer. Buka PowerShell baru setelah menginstal, masuk ke folder repo, lalu cek:

```powershell
git --version
node --version
npm.cmd --version
```

SQLite dan FFmpeg yang dipakai aplikasi ikut dependensi repo. PostgreSQL, Docker, Katalon, Ollama, dan layanan AI cloud diperlukan hanya untuk workflow yang menggunakannya.

## Instalasi otomatis

1. Buka **`setup-traceva.bat`** di root repo. Bisa juga menjalankan `.\setup-traceva.bat` dari PowerShell.
2. Tunggu `npm ci` memasang dependensi dari `package-lock.json`. Setup membuat `.env` bila file belum ada, dengan konfigurasi localhost, pasangan token relay acak, dan penyimpanan artefak di folder `data` di luar hasil build.
3. Untuk database kosong, isi email, nama, nama workspace, lalu password 12–200 karakter dua kali. Terminal menyembunyikan input password. Setup meneruskan password ke proses bootstrap dan menyimpan hash akun di database.
4. Setup memasang Chromium untuk Playwright Studio dan membuat build standalone. Tunggu pesan **Setup selesai** sebelum menjalankan launcher.

Pada pengulangan, setup mempertahankan `.env` serta melewati pembuatan skema bila database sudah ada. Jika akun sudah tersedia, setup melewati pembuatan Owner. Setelah mengubah token relay, buat build baru agar bundle web memakai token yang sama dengan relay.

## Instalasi manual

Jalankan dari root repo. Jika setup berhenti di tengah, lanjutkan dari langkah yang gagal.

### 1. Konfigurasi lokal

```powershell
node scripts/setup-windows.mjs --env-only
```

Jika helper juga gagal dan `.env` belum ada, salin sendiri. Perintah di bawah membuat file tanpa menimpa konfigurasi yang sudah tersedia.

```powershell
if (Test-Path -LiteralPath .env) { throw '.env sudah ada. Periksa konfigurasi yang ada.' }
$tracevaToken = node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))"
$tracevaData = (Join-Path (Get-Location).Path 'data').Replace('\', '/')
$tracevaEnv = (Get-Content -Raw -LiteralPath .env.example) `
  -replace '(?m)^QA_RELAY_TOKEN=.*$', "QA_RELAY_TOKEN=$tracevaToken" `
  -replace '(?m)^NEXT_PUBLIC_QA_RELAY_TOKEN=.*$', "NEXT_PUBLIC_QA_RELAY_TOKEN=$tracevaToken" `
  -replace '(?m)^QA_RELAY_ALLOW_BROWSER_LAUNCH=.*$', 'QA_RELAY_ALLOW_BROWSER_LAUNCH=1' `
  -replace '(?m)^QA_DATA_DIR=.*$', ('QA_DATA_DIR="' + $tracevaData + '"')
[System.IO.File]::WriteAllText((Join-Path (Get-Location).Path '.env'), $tracevaEnv)
Remove-Variable tracevaToken,tracevaEnv,tracevaData
```

### 2. Instal paket dan siapkan SQLite

```powershell
npm.cmd ci --include=dev
node scripts/setup-windows.mjs --database
```

`npm ci` memakai lockfile dan menjalankan `postinstall` untuk generate Prisma Client. Jika generate terlewati karena pengaturan npm, jalankan `npm.cmd run db:generate`.

Untuk konfigurasi lokal standar, helper membuat `prisma/db/custom.db` jika belum tersedia. Jika helper gagal, alternatif berikut berlaku untuk **database baru** dengan `DATABASE_URL="file:./db/custom.db"`. File kosong dibuat dulu agar Prisma dapat membuka target di Windows.

```powershell
if (Test-Path -LiteralPath prisma/db/custom.db) { throw 'Database sudah ada. Periksa skema dan backup dahulu.' }
New-Item -ItemType Directory -Path prisma/db -Force | Out-Null
New-Item -ItemType File -Path prisma/db/custom.db -ErrorAction Stop | Out-Null
npm.cmd run db:push:sqlite
```

Untuk database lama yang butuh pembaruan skema, buat backup dan ikuti prosedur migrasi yang sesuai. [npm ci](https://docs.npmjs.com/cli/v11/commands/npm-ci/) · [Penyimpanan Traceva](traceva-data-storage.md)

### 3. Buat Owner dan build

```powershell
node scripts/setup-windows.mjs --owner
npm.cmd exec -- playwright install chromium
npm.cmd run build
```

Baris instal Chromium bisa ditunda jika workflow belum memakai Playwright Studio. Jika helper Owner gagal setelah database selesai dibuat, CLI repo juga dapat memakai variabel sementara di proses PowerShell:

```powershell
$env:QA_BOOTSTRAP_EMAIL = Read-Host 'Email Owner'
$env:QA_BOOTSTRAP_NAME = Read-Host 'Nama Owner'
$env:QA_BOOTSTRAP_WORKSPACE = Read-Host 'Nama workspace (opsional)'
$tracevaSecret = Read-Host 'Password Owner (minimal 12 karakter)' -AsSecureString
try {
  $env:QA_BOOTSTRAP_PASSWORD = ([pscredential]::new('traceva', $tracevaSecret)).GetNetworkCredential().Password
  npm.cmd run auth:bootstrap
  if ($LASTEXITCODE -ne 0) { throw 'Pembuatan Owner gagal.' }
} finally {
  Remove-Item Env:QA_BOOTSTRAP_EMAIL,Env:QA_BOOTSTRAP_NAME,Env:QA_BOOTSTRAP_WORKSPACE,Env:QA_BOOTSTRAP_PASSWORD -ErrorAction SilentlyContinue
  $tracevaSecret.Dispose()
}
```

[Browser Playwright](https://playwright.dev/docs/browsers)

## Menjalankan aplikasi

Buka **`run-web-qa-production.bat`** untuk menjalankan web dan relay. Setelah web siap, buka [Traceva lokal](http://127.0.0.1:3000) dan masuk dengan akun Owner atau akun yang dibuat lewat **Settings → Team**.

Jika launcher gagal, buka terminal terpisah di root repo sesuai kebutuhan:

| Terminal | Perintah | Kapan digunakan |
| --- | --- | --- |
| Web | `npm.cmd start` | Aplikasi standalone di `127.0.0.1:3000`. Build dulu dengan `npm.cmd run build`. |
| Relay | `npm.cmd run relay` | Manual Capture dan penerimaan telemetry di `127.0.0.1:3001`. |
| Worker | `npm.cmd run automation:runner` | Jalankan skrip yang masuk antrean Playwright Studio. |

Untuk mengedit source, gunakan `npm.cmd run dev` sebagai proses web. Hentikan web dev sebelum build pada checkout yang sama. Hentikan proses dengan `Ctrl+C` pada terminal layanan terkait.

## Peta halaman

Pilih workspace dan project sesuai pekerjaan. Menu dan aksi yang muncul mengikuti role akun dan izin project.

| Halaman | Fungsi dan cara pakai |
| --- | --- |
| **Login** | Masukkan email dan password yang diberikan administrator atau dibuat saat setup. Tautan tamu masuk melalui alur berbeda, mengikuti scope dan masa berlaku tautan. |
| **Dashboard** | Cek ringkasan status testcase, risiko rilis, serta pekerjaan yang perlu perhatian. Buka item yang perlu ditindaklanjuti ke halaman terkait. |
| **Cases** | Buat, cari, filter, dan pelihara testcase per project. Isi halaman atau modul, skenario, langkah, data uji, dan expected result. Klik baris untuk membuka inspector. Gunakan aksi Excel untuk impor atau ekspor. |
| **Bugs** | Cari bug berdasarkan status, prioritas, atau testcase. Buka detail untuk memeriksa reproduksi, dampak, bukti, dan hubungan ke case. Perbarui status setelah retest sesuai hasil. |
| **Automation Logs** | Pilih project dan buka run untuk melihat riwayat capture atau automation. Gunakan video, timeline, Execution, Console, dan Network untuk menyelidiki kejadian di waktu tertentu. |
| **Test Cycles** | Buat siklus untuk build atau periode uji, tambahkan testcase, pilih case pada workbench, lalu catat outcome, actual result, dan bukti. Gunakan riwayat eksekusi untuk membandingkan retest. |
| **Traceability** | Hubungkan Requirement ke Test Cases dan Test Plan, lalu telusuri relasinya sampai Test Cycles. Gunakan **Buat Relasi**, **Kelola Relasi**, atau **Filter Celah Coverage**. Pilih node atau kartu untuk mengikuti relasi yang tersimpan. |
| **Reports** | Buat **Test Planning (TPD)** untuk ruang lingkup dan rencana, atau **Status Report (TSR)** untuk progres dan hasil. Tinjau isi draft, finalisasi bila sudah disetujui, lalu ekspor HTML atau DOCX sesuai izin. |
| **Evidence Vault** | Cari dan pratinjau bukti pada project terpilih. Buka screenshot, video, atau PDF yang tersedia dan kembali ke testcase atau eksekusi sumber saat perlu konteks. |
| **Activity & Audit** | Lihat aktivitas, perubahan, dan notifikasi yang tersedia. Gunakan filter dan buka item terkait. Tandai notifikasi yang sudah diperiksa sebagai dibaca. |
| **Settings** | Kelola kesiapan sistem, anggota workspace, project, dan konfigurasi yang dijelaskan di bawah. |
| **User Profile** | Lihat identitas akun dan sesi. Kelola profil, ganti password dengan password saat ini, atau akhiri sesi lewat kontrol yang tersedia. |

### Tab Settings

| Tab | Cara pakai |
| --- | --- |
| **System** | Periksa readiness komponen ketika web, relay, atau fitur pendukung bermasalah. Admin dapat melihat kontrol pemeliharaan storage. |
| **Team** | Owner atau Admin yang berwenang dapat menambah member, mengedit akun atau role, serta mencabut akses sesuai aturan workspace. Workspace harus tetap memiliki Owner aktif. |
| **Akses tamu** | Buat tautan dengan project, izin, masa berlaku, dan batas pemakaian yang sesuai. Bagikan hanya ke penerima yang dituju dan cabut lewat Settings saat akses selesai. |
| **AI** | Tinjau provider dan konfigurasi yang tersedia sesuai izin. Isi kredensial provider di host bila diperlukan. Tinjau hasil AI sebelum memasukkannya ke testcase atau laporan. |
| **Projects** | Buat project pertama atau edit nama, deskripsi, dan Automation Context. Pilih project dari pemilih project setelah penyimpanan. |
| **Knowledge** | Simpan konteks dan informasi project yang relevan untuk tim dan fitur AI. |
| **Integrations** | Kelola integrasi project yang ditampilkan, misalnya Figma, sesuai akses dan konfigurasi host. |
| **Modules** | Kelola kelompok modul yang dipakai untuk mengelompokkan testcase di project. |

## Alur QA pertama

1. **Settings → Projects.** Buat project lalu pilih project itu. Buat modul jika perlu mengelompokkan case.
2. **Cases.** Buat satu testcase, misalnya login valid. Tulis prasyarat, langkah, data uji, dan expected result yang dapat diperiksa. Klik testcase untuk melihat detail, langkah, traceability, execution, evidence, bugs, history, dan komentar sesuai akses.
3. **Traceability.** Jika ada requirement formal, hubungkan testcase ke requirement dan plan. Gunakan filter coverage untuk menemukan requirement yang belum lengkap.
4. **Test Cycles.** Buat siklus untuk build yang diuji dan tambahkan testcase. Jalankan langkah pengujian, isi actual result, pilih outcome, lalu simpan eksekusi. Unggah bukti pada eksekusi yang tepat.
5. **Bugs.** Untuk kegagalan yang perlu ditindaklanjuti, buat atau tautkan bug dari eksekusi jika tersedia. Catat langkah reproduksi, dampak, expected result, actual result, dan bukti. Saat retest, catat eksekusi baru.
6. **Reports.** Buat TSR dari scope yang relevan, tinjau hasilnya, lalu finalisasi dan ekspor jika diperlukan.

Untuk migrasi inventaris case, gunakan format impor dari UI dan cek hasil per baris. Ekspor QA Report Excel ditujukan untuk dibaca dan dibagikan. Untuk pemulihan instalasi, backup database beserta artefak. [Panduan penyimpanan](traceva-data-storage.md)

## Capture dan Playwright Studio

### Manual Capture dan Devlog

1. Pastikan relay aktif. Buka **Cases → detail testcase → Automation**, lalu pilih **Capture Manual**.
2. Masukkan URL sistem uji yang diizinkan. Pilih mode yang tersedia dan mulai capture. Lakukan langkah uji, lalu hentikan capture agar rekaman dapat diproses.
3. Buka **Hasil** atau recording pada riwayat. Saat memeriksa video, pilih **Execution** untuk kejadian pengujian, **Console** untuk pesan browser, dan **Network** untuk request yang tercatat. Gunakan **Fetch/XHR** untuk menyaring request API sesuai jenis yang terekam. Bersihkan filter atau pilih **All** jika daftar kosong.
4. Klik event untuk melompat ke waktu terkait jika tersinkron. Gunakan kontrol fullscreen untuk meninjau video dan Devlog, serta **Ikuti video** untuk kembali ke posisi playback setelah menjelajah manual.

### Playwright Studio

1. Pastikan Chromium sudah diunduh dan worker berjalan.
2. Dari detail testcase, buka **Automation → Script**. Masukkan code Playwright Test dari sumber yang kamu percayai, atur Base URL bila diperlukan, simpan, lalu jalankan.
3. Buka **Hasil** untuk melihat status run, video, trace, screenshot, dan log yang tersedia. Buka **Automation Logs** untuk riwayat di level project.
4. Catat verdict QA di **Test Cycles** sesuai expected dan actual result. Status run Playwright menunjukkan hasil skrip, sehingga verdict kasus tetap perlu ditinjau sesuai skenario.

Studio menjalankan skrip dengan hak akun Windows yang menjalankan worker. Untuk integrasi Katalon, ikuti konfigurasi dan pemetaan testcase pada panduan capture. [Playwright Studio](traceva-playwright-studio.md) · [Automation Capture](automation-capture-user-guide.md)

## Konfigurasi dan pemecahan masalah

| Pengaturan | Default setup dan cara pakai |
| --- | --- |
| `DATABASE_URL` | `file:./db/custom.db`, relatif terhadap folder schema `prisma`. |
| `QA_WEB_HOST`, `PORT`, `APP_URL`, `QA_ALLOWED_ORIGINS` | Loopback port 3000, dengan origin localhost dan 127.0.0.1. |
| `QA_RELAY_HOST`, `QA_RELAY_PORT`, `QA_RELAY_ALLOWED_ORIGINS` | Loopback port 3001. Origin relay menunjuk web port 3000. Klien Devlog lokal mengharapkan port 3001. |
| `QA_RELAY_TOKEN`, `NEXT_PUBLIC_QA_RELAY_TOKEN` | Satu nilai acak yang sama di dua variabel. Nilai `NEXT_PUBLIC_` terpasang di bundle web. Gunakan relay bind lokal. |
| `QA_RELAY_ALLOW_BROWSER_LAUNCH` | `1` untuk Manual Capture mode browser. |
| `QA_DATA_DIR` | Folder absolut `data` pada checkout baru. Simpan bersama database saat backup atau pindah komputer. Perbarui path ini jika checkout dipindah. |
| `QA_COOKIE_SECURE` | `0` untuk HTTP lokal. Konfigurasi HTTPS mengikuti deployment host. |
| `GROQ_API_KEY`, `GEMINI_API_KEY`, `OLLAMA_BASE_URL` | Opsional untuk AI. Atur provider sesuai kebutuhan dan simpan kunci hanya pada host. |
| `QA_BOOTSTRAP_*`, `POSTGRES_DATABASE_URL` | Nilai bootstrap permanen dan PostgreSQL dapat dibiarkan kosong untuk jalur setup lokal ini. |

Simpan `.env`, database, dan bukti pengujian di luar commit. Untuk penggunaan bersama, ikuti panduan deployment dan storage sebelum mengubah bind atau mengaktifkan tunnel. [Deployment dan tunnel](traceva-production-tunnel.md) · [Penyimpanan dan backup](traceva-data-storage.md)

| Kendala | Pemeriksaan |
| --- | --- |
| `node` atau `npm` tidak ditemukan | Pasang Node.js beserta npm, buka terminal baru, lalu cek versi. Gunakan `npm.cmd` jika PowerShell memblokir `npm.ps1`. |
| `npm ci` gagal | Cek koneksi, versi Node, dan apakah `package.json` serta `package-lock.json` berasal dari commit yang sama. Jika muncul `EPERM`, tutup layanan terkait sebelum mengulang instalasi. |
| Port 3000 atau 3001 sudah dipakai | Gunakan `Get-NetTCPConnection -State Listen -LocalPort 3000,3001` untuk melihat PID. Hentikan proses Traceva terkait dari terminalnya sebelum mengulang setup atau memulai launcher. |
| Error Prisma atau tabel belum ada | Cek `DATABASE_URL`. Jalankan `npm.cmd run db:generate` bila client belum terbentuk. Jika file SQLite lama ada tapi skemanya berbeda, backup dan gunakan prosedur migrasi. |
| Login gagal | Cek email, URL, dan akun pada database yang dipakai web. Cek apakah setup Owner selesai. Untuk akun yang sudah ada, gunakan **User Profile**, **Settings → Team**, atau prosedur reset lokal yang tersedia sesuai akses. |
| Standalone belum ada atau browser gagal buka saat launcher mulai | Jalankan `npm.cmd run build`, mulai web, lalu buka ulang URL setelah terminal melaporkan Ready. |
| Devlog relay offline | Cek status relay dari **Settings → System**, terminal relay, origin, dan pasangan token. Endpoint `/health` milik relay memerlukan token. Setelah mengubah token, rebuild web dan restart kedua layanan. |
| Studio berhenti di antrean atau binary Chromium hilang | Pastikan worker berjalan. Ulangi `npm.cmd exec -- playwright install chromium` setelah pembaruan Playwright. |
| Network kosong saat memutar rekaman lama | Periksa filter dan pilih **All**. Data yang tersedia mengikuti jenis telemetry dan metadata yang tercatat saat run dibuat. Uji capture baru jika perlu membandingkan. |
