# Traceva — production lokal + Quick Tunnel

Jalankan `run-traceva-production-tunnel.bat` dari folder project (double-click).
Launcher memakai build yang sudah ada melalui `npm start`, menjalankan
`npm run relay`, dan meminta URL acak. URL publik ditampilkan setelah web dan
relay siap serta pemeriksaan autentikasi berhasil. Launcher tidak menjalankan
build. Biarkan satu jendela tersebut terbuka; tekan **Ctrl+C** untuk menghentikan
web, relay, runner, dan tunnel milik launcher. Jika salah satu layanan berhenti, layanan lain yang
dijalankan launcher ikut dihentikan.

Playwright Studio juga mendapat runner lokal otomatis melalui
`npm run automation:runner`. Runner yang sudah aktif digunakan kembali tanpa
dimatikan oleh launcher. Runner tidak membuka port dan hanya menerima script
melalui API web yang dibatasi owner/admin. Lihat
[panduan Playwright Studio](traceva-playwright-studio.md) sebelum menjalankan script.
Jangan menutup paksa jendela: cleanup tidak dijamin jika proses launcher dibunuh.

## Persiapan satu kali

- Gunakan Node.js 22 atau 24 LTS dan jalankan `npm install` bila dependency belum ada.
- Install cloudflared: `winget install --id Cloudflare.cloudflared --exact`.
  Buka ulang terminal/BAT setelah instalasi. Alternatif: isi
  `TRACEVA_CLOUDFLARED_PATH="C:/path/cloudflared.exe"` pada `.env` lokal.
- `.env` harus sudah berisi konfigurasi database yang benar dan evidence storage
  permanen di luar `.next`. Launcher tidak mengubah `.env`, memigrasikan, atau
  mereset database. Akun owner harus sudah dibuat secara lokal.
- Jalankan `npm run build` secara manual sebelum startup pertama dan setelah
  memperbarui kode. Build standalone wajib sudah tersedia; jika belum, launcher
  berhenti dengan petunjuk, tanpa membangun otomatis.
- Isi `QA_RELAY_TOKEN` dengan token acak minimal 32 byte pada `.env` lokal.
  Token tidak ditampilkan oleh launcher.
- Hentikan layanan lain pada port `PORT` (default 3000) dan
  `QA_RELAY_PORT` (default 3001). Kedua port harus berbeda. Launcher
  menolak port yang sibuk, bukan mematikan proses milik aplikasi lain.
- Hentikan juga server Next.js dev project ini sebelum build, walaupun portnya
  berbeda, karena keduanya menggunakan folder `.next` yang sama.
- Jika punya `~/.cloudflared/config.yml` atau `config.yaml` untuk Named Tunnel,
  pindahkan sementara secara manual. Launcher tidak mengubah konfigurasi itu.

## Pilihan

```bat
run-traceva-production-tunnel.bat --check
run-traceva-production-tunnel.bat --no-build
run-traceva-production-tunnel.bat --help
```

`--check` memeriksa prasyarat tanpa membuka tunnel atau menjalankan server.
Tanpa argumen pun selalu memakai build yang ada. `--no-build` dipertahankan hanya
untuk kompatibilitas dan memiliki perilaku yang sama. Opsi `--build` tidak
didukung. Lint/unit test tidak dijalankan otomatis setiap startup.

## Akses dan batasan

Gunakan URL **HTTPS** yang ditampilkan untuk login. APP_URL, allowed origins, dan
cookie Secure disetel pada environment proses; file `.env` tetap sama. URL berubah
setiap startup dan tidak membutuhkan akun/domain Cloudflare. Quick Tunnel untuk
berbagi/testing sementara, bukan pengganti deployment production: tidak ada
jaminan uptime, maksimal 200 request in-flight, dan SSE tidak didukung.
Sumber: [Cloudflare Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/).

Web tetap di loopback. Gateway loopback tambahan menolak akses publik sampai web
siap, relay sehat, dan bootstrap sudah selesai. Hanya HTTP web yang diteruskan;
relay dan database tidak dipublikasikan. Relay otomatis berjalan di
`127.0.0.1:3001` (atau `QA_RELAY_PORT`) untuk penggunaan lokal. Manual capture/relay
jarak jauh tidak termasuk launcher ini.

Login normal tetap tersedia di URL publik. Untuk tamu, admin membuat token
project/privilege/expiry melalui Settings → Akses tamu. Bagikan URL dan token
secara terpisah, jangan password admin. URL acak bukan pengganti autentikasi.

BAT tidak otomatis membuka tunnel saat dibuat atau diuji dengan `--check`.
Instalasi cloudflared dan koneksi Cloudflare nyata perlu diverifikasi pada mesin
yang akan menjalankannya.
