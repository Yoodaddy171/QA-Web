# QADesk V0.3 — handoff Phase 8E dan pekerjaan sesudahnya

Tanggal: 20 Oktober 2026 (Asia/Bangkok).
Branch: `codex/frontend-design-system-motion-optimization`.
Baseline sebelum delivery ini: `4385c5862edc500d047978ada10178246f20bc88`.

## Cara membaca delivery

Riwayat sebelumnya menggunakan judul commit deskriptif; fase 6C sampai 8C.2 dirangkum dalam isi commit `4385c58`. Tidak ada pola satu commit untuk setiap nomor 8A/8B/8C. Delivery ini dipisahkan per pekerjaan, tanpa mengarang nomor fase 8F/8G baru yang belum diberikan reviewer.

Implementasi Graph View dan refinemen 8E sebelumnya masih berada dalam working tree yang sama. Keduanya dikirim dalam satu commit: tidak dibuat pemisahan historis palsu antara versi awal graph dan hasil refinemen.

| Commit | Pekerjaan |
|---|---|
| `f7ebffb` | Graph View dan refinemen UX/functional Phase 8E |
| `1eecf4a` | Preview evidence dalam halaman dan navigasi galeri |
| `8f7cc16` | Template export Excel QA Report, kompatibilitas legacy |
| `c47c703` | Penyimpanan evidence permanen dan alat pemulihan/backup |
| `4168398` | Perbaikan MCP, sinkronisasi execution dan upload atomik |
| `b16b821` | Perbaikan Cases, inspector dan activity feed berdasarkan Impeccable |

Setiap commit memiliki body tentang scope dan batas verifikasinya. Dokumen ini adalah pekerjaan dokumentasi terpisah. Tidak ada merge ke main, PR, deployment, migrasi schema, perubahan autentikasi, atau push berkas pengguna/database dalam delivery ini.

## 1. Hasil Phase 8E

Graph View membaca relasi tersimpan yang dibatasi project/workspace. Ada pencarian starting object, pemilihan node, highlight tetangga, pan/zoom, filter, framing yang lebih terbaca dan detail object. Reset tidak lagi mengganti node terpilih. Starting object bertahan saat berpindah lane/graph selama panel masih terpasang.

Laporan historis 19 Oktober mencatat 12 skenario Chromium pada kandidat production terisolasi lolos, termasuk relasi dibandingkan dengan SQLite, recovery/race dan workspace isolation. Ini bukan pengujian ulang seluruh aplikasi hari ini. Lihat [laporan 8E](traceability-graph-ux-qa-report.md) dan [scope implementasi graph](traceability-graph-feature-implementation.md).

Tetap terbatas pada neighborhood/subset: 12 testcase, 24 link per relationship query, 24 execution, 16 Bug dan 120 node. Tidak ada relasi testcase-ke-testcase/plan yang dibuat-buat. Navigasi Bug membuka menu Bugs, execution membuka cycle. Tidak ada editor graph, export graph, wheel/pinch zoom atau node evidence mandiri.

## 2. Preview evidence dan galeri

Evidence testcase dibuka sebagai preview di halaman, bukan tab browser baru. Gambar, video dan PDF memiliki representasi preview; tipe lain memiliki fallback. X/Escape menutup preview tanpa menutup inspector di belakangnya.

Galeri gambar mempunyai tombol previous/next, tombol panah keyboard kiri/kanan, posisi foto dan batas navigasi yang disabled. Video/PDF tidak dimasukkan ke urutan foto. Pergantian gambar mempertahankan shell/focus preview; penutupan mengembalikan fokus ke thumbnail awal.

Ada unit test navigasi dan skenario browser terisolasi. Browser verification historis mencakup desktop/mobile dan galeri; bukan klaim seluruh media/perangkat/browser telah diuji. Tidak ada pengubahan UUID, storage key atau file asli oleh fitur preview.

## 3. Export Excel QA Report

Menu export menambah QA Report XLSX dengan sheet Summary dan Test Cases. Ada export selected-only, filter/freeze, kolom module/UUID, multiline text, nilai persentase numerik, format print dan formula summary dengan cached result/recalculate-on-open. Group module numerik tersembunyi menjaga identitas nama module saat filter/sort, termasuk nama dengan wildcard/perbedaan kapital.

CSV dan legacy XLSX satu sheet/per module dipertahankan. QA Report sengaja ditolak untuk import sebelum penulisan; pesan mengarahkan pengguna ke legacy. Ini snapshot inventory, bukan release-readiness, execution history, atau backup project yang lossless. History/relasi tidak dikarang dari status terakhir testcase.

Test workbook memakai ExcelJS serta pembacaan independen SheetJS. Verifikasi historis mencakup unduhan UI, rekonsiliasi sumber, subset, penolakan import report dan recalculation/render sintetis. Runtime renderer menghasilkan output/assertion yang benar tetapi pernah exit 1 saat shutdown tanpa pesan error. Native Microsoft Excel belum diuji. Detail: [laporan Excel](excel-export-template-update.md).

## 4. Evidence tidak lagi bergantung pada folder build

Akar insiden: storage relatif terhadap cwd standalone dapat masuk `.next/standalone/data`, lalu hilang saat rebuild meskipun metadata database tetap ada.

Storage sekarang memakai absolute `QA_EVIDENCE_STORAGE_DIR`, atau `QA_RUNTIME_DIR/execution-evidence`, atau direktori data pengguna `QADesk/evidence` di luar build. Root relatif/bersegmen `.next` dan root symlink yang mengarah ke `.next` ditolak. Launcher menampilkan effective root. File yang sudah ada tidak dihapus saat exclusive-create mengalami collision.

Perintah baru: `evidence:audit`, `evidence:migrate`, `evidence:backup`. Audit memeriksa seluruh project. Migrasi copy-only, tidak overwrite konflik atau menghapus salinan lama, serta menjaga UUID/relative keys. Backup menyandingkan snapshot SQLite dan file evidence, SHA-256, integrity check dan sidecar restore. Manifest incomplete tetap ditandai incomplete.

Pemulihan lokal pada 19 Oktober (bukan audit ulang metadata hari ini): 374 file tersedia disalin dan diverifikasi; 11 file masih hilang dan satu path legacy tidak didukung. Jadi masalah penyimpanan ke depan ditangani, tetapi kehilangan historis belum sepenuhnya selesai. Dua unduhan terautentikasi saat pemulihan berhasil dan cocok hash. Tidak ada klaim semua evidence project pulih.

Konfigurasi `.env`, evidence pengguna, snapshot dan manifest privat tidak dikirim ke Git. Backup lokal bukan perlindungan terhadap kerusakan disk; tetap perlu backup terpisah. Belum ada full production restore drill/backup scheduler otomatis. Panduan: [backup dan restore](backup-restore.md).

## 5. Perbaikan MCP dan kontrak hasil execution

- API menerima internal UUID atau exact display ID testcase dalam project yang diminta. Run/execution tetap menggunakan ID internal. Unknown menghasilkan 404; collision ambigu menghasilkan 409; membership yang belum ada ditambahkan.
- Creation/update/bulk execution menyinkronkan testcase status, actual-result badge, progress dan lifecycle Bug dalam transaksi. Latest memakai completedAt, lalu startedAt/createdAt dan tie-break recording order. Import historis tidak menggantikan verdict yang lebih baru; NOT RUN tidak mereset verdict.
- Response `testCaseSync` menjelaskan applied/reason/previous/current status dan warning. Detail observasi execution tetap dibedakan dari badge inventory.
- Upload multipart menerima maksimal 20 file/25MB total. Semua file divalidasi, metadata/activity commit bersama dan file staged dibersihkan bila gagal. Single-file response dipertahankan; batch menambah `uploadedCount`. MIME diambil dari bytes bila hint kosong/generic; mismatch eksplisit ditolak.
- Error transport membedakan server offline/refused, timeout dan reset. Hasil mutasi yang transport-nya gagal tetap UNKNOWN dan harus direkonsiliasi sebelum retry.

**Poin review penting:** ini bukan perubahan transport saja. PASSED/VERIFIED dapat menyinkronkan inventory menjadi DONE/As Expected dan memanggil sinkronisasi lifecycle Bug. Periksa kembali kesesuaian semantik dan copy lama tentang pemisahan inventory/Run/retest di Dashboard/inspector. Jangan mengasumsikan kontrak sebelum patch masih persis sama.

Validasi delivery 20 Oktober: 22 integration test SQLite/API terisolasi lolos, serta 18 test paket MCP lolos. Sebagian MCP suite mencakup Chromium/relay sintetis. Tidak ada whole-product E2E atau PostgreSQL concurrency certification. Panduan API/cookbook MCP ikut diperbarui.

## 6. Audit dan perbaikan Impeccable

Antislop tidak terpasang dan instalasinya dibatalkan atas arahan pengguna; workflow yang dipakai adalah Impeccable. Tidak ada klaim sertifikasi Antislop.

Filter Cases mobile menjadi sheet scrollable; tanggal berada di panel filter; opsi tabel sekunder berada di balik satu tombol. Desktop mempertahankan kontrol langsung, laptop memakai layout yang tidak memotong toolbar. Dalam pengukuran kandidat mobile, tinggi toolbar 275px dan tabel mulai sekitar y=376.

Overview mendahulukan test action, steps, expected/actual result dan catatan. Metadata teknis dipindah ke bagian expandable, tetap tersedia. Label aksesibilitas copy/filter ditambahkan; tombol navigasi/copy/close/tab/footer inspector mobile terukur 44px. Tab aktif tetap bertahan saat Next testcase.

Feed aktivitas memakai display ID dari data scoped yang sudah dimuat, tanpa query tambahan; nama field seperti actualResult/remarks ditampilkan manusiawi. Update berdekatan dengan object/actor sama, field berbeda dan jendela maksimum satu detik dikelompokkan sebagai perubahan terkait. Semua event asli tetap ada; tidak ada rewrite audit history atau asumsi semua event satu menit adalah satu operasi.

Reduced-motion CSS menghapus gerakan spasial/dekoratif sambil mempertahankan feedback warna/fade; bukan global duration 0.01ms. OS-level reduced-motion dan seluruh assistive technology belum diverifikasi langsung.

Validasi kandidat 20 Oktober:

- Unit suite: 287 passed, 1 skipped. Termasuk 13 test activity presentation. Run awal mengalami timeout test DevLog SQLite; test itu lolos terpisah, lalu full suite lolos dengan maxWorkers=2 tanpa mengubah timeout test.
- Full lint, TypeScript dan whitespace diff check lolos.
- Build production **terisolasi** `next build --webpack` lolos; ada warning parser `module.createRequire` pada readiness-service yang tidak diubah. Bukan bukti default build Turbopack/standalone finalization/production restart.
- Kandidat Edge memakai database sintetis dan origin terpisah dari produksi: 1440x900, 1024x900, 390x844; light/dark; filter/status/reset/kalender/Escape, opsi tabel, Overview/metadata/Steps/Next, serta activity navigation diperiksa. Tidak ada error console relevan/frame error overlay pada hasil akhir.
- Hash 11 file perubahan UI/support dibandingkan antara checkout utama dan kandidat; cocok. Port 3000 tetap berjalan dan output build utamanya tidak ditimpa. Screenshot verifikasi memakai data sintetis dan disimpan privat, bukan dimasukkan ke Git.

## Batas delivery dan prioritas reviewer

1. Review kontrak sinkronisasi execution/inventory/Bug sebelum menyimpulkan teks workflow lama masih akurat.
2. Review bukti storage/backup dan unresolved historical evidence secara terpisah dari preview UI.
3. Pertahankan batas subset graph dan label summary Excel: jangan menyamakan inventory progress dengan release readiness.
4. Jika akan dipakai dalam mode production, lakukan build/restart utama yang terencana dan smoke-test setelahnya; commit/push ini tidak mengganti aplikasi berjalan.
5. Tidak ada klaim 60 FPS, full accessibility compliance, full regression, PostgreSQL readiness atau SaaS deployment approval dari delivery ini.

Git delivery juga menemukan referensi checkpoint internal Codex yang rusak saat fetch. Remote branch dibandingkan langsung dan masih cocok dengan baseline sebelum commit. Tidak ada force-push, penghapusan ref, reset atau rewrite history sebagai workaround. Hasil push/verifikasi remote dilaporkan pada pesan delivery; kesehatan checkpoint lokal tidak dianggap sudah diperbaiki.

## Pesan singkat untuk reviewer

Prompt pekerjaan terakhir Anda adalah Phase 8E. Hasil graph 8E beserta laporan sudah dikirim, lalu ada lima follow-up: inline evidence preview/galeri, QA Report Excel, durable evidence storage/recovery, perbaikan MCP dan sinkronisasi hasil execution, serta perbaikan UI berbasis Impeccable. Silakan review diff dari baseline `4385c58` ke ujung branch berdasarkan commit per pekerjaan di atas. Perhatikan terutama perubahan semantik execution–inventory–Bug dan evidence historis yang belum seluruhnya pulih. Unit/lint/typecheck/build kandidat sudah lolos dengan batas pengujian di dokumen ini; aplikasi produksi utama belum diganti oleh delivery tersebut.
