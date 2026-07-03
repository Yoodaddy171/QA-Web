# Goal: Rapikan UI dan Optimalkan Performa QA-Web

Anggap implementasi Docker dan PostgreSQL tidak pernah ada. QA-Web tetap berjalan lokal menggunakan Next.js, Node.js, dan SQLite yang sudah tersedia.

## Tujuan Utama

Rapikan UI QA-Web agar lebih konsisten, ringkas, responsif, dan nyaman digunakan. Optimalkan implementasi teknis supaya loading project, test case, dashboard, DevLog, recording, serta navigasi terasa cepat.

Perubahan bukan sekadar visual. Audit dan perbaiki bottleneck pada React, API, query SQLite, state management, serta rendering tabel.

## Batasan

- Pertahankan seluruh fitur yang sudah berfungsi.
- Jangan migrasi ke Docker atau PostgreSQL.
- Jangan mengubah struktur data tanpa kebutuhan nyata.
- Jangan menambah dependency jika solusi native atau dependency existing sudah cukup.
- Jangan membuat landing page.
- Jangan melakukan redesign total yang mengubah alur kerja user.
- Jangan menghapus data lokal.
- Pertahankan dark mode dan responsive layout.
- Gunakan komponen serta design system yang sudah ada.

## Audit Awal

Sebelum mengubah kode:

1. Jalankan aplikasi dan identifikasi workflow utama.
2. Periksa console browser, network request, API lambat, dan render berulang.
3. Audit komponen besar seperti dashboard, test-case table, detail dialog, sidebar, DevLog, dan recording preview.
4. Audit seluruh query SQLite dan endpoint API.
5. Cari query tanpa index, pemanggilan API berulang, full-table scan, data besar yang selalu dimuat sekaligus, state yang menyebabkan rerender seluruh halaman, perhitungan agregasi berulang, serta komponen atau effect yang melakukan pekerjaan duplikat.
6. Catat baseline waktu loading dan jumlah request sebelum optimasi.

## Perapihan UI

- Pertahankan sidebar sebagai navigasi utama.
- Rapikan spacing, alignment, typography, warna, border, dan hierarchy.
- Gunakan ukuran heading yang sesuai untuk dashboard operasional.
- Hindari card di dalam card.
- Kurangi dekorasi yang tidak membantu workflow.
- Buat toolbar, filter, pencarian, pagination, dan action button lebih ringkas.
- Gunakan ikon Lucide pada tombol yang sesuai.
- Tambahkan tooltip pada ikon yang tidak jelas.
- Pastikan tabel mudah dipindai dan tidak bergeser saat data berubah.
- Pastikan teks panjang tidak menimpa tombol atau kolom.
- Perbaiki loading, empty, error, disabled, dan skeleton state.
- Pertahankan posisi scroll dan filter saat membuka lalu menutup detail.
- Pastikan dialog test case dan DevLog nyaman pada desktop maupun mobile.
- Jangan menampilkan teks instruksi teknis yang tidak diperlukan user.

## Animasi dan Micro-interaction

Tambahkan animasi pada interaksi yang masih terasa mendadak, tanpa membuat aplikasi operasional menjadi lambat atau berlebihan.

- Gunakan Framer Motion yang sudah tersedia.
- Tambahkan transisi ringan pada:
  - Pergantian menu sidebar.
  - Buka dan tutup dialog atau panel.
  - Pergantian tab.
  - Expand dan collapse section.
  - Filter dan hasil pencarian.
  - Penambahan, pembaruan, dan penghapusan row.
  - Toast, dropdown, popover, dan empty state.
  - Loading menuju konten siap.
  - Preview frame atau video yang baru tersedia.
- Gunakan feedback hover, pressed, focus, dan disabled pada kontrol interaktif.
- Gunakan durasi cepat sekitar 120-220 ms.
- Prioritaskan animasi `opacity` dan `transform`.
- Hindari animasi layout yang menyebabkan tabel bergeser atau berkedip.
- Jangan menganimasikan seluruh halaman setiap kali data berubah.
- Hindari animasi dekoratif, bounce berlebihan, dan stagger panjang.
- Hormati `prefers-reduced-motion`.
- Animasi tidak boleh menunda klik, input, navigasi, atau pembaruan data.
- Pastikan elemen tidak berubah ukuran saat hover atau loading.
- Verifikasi animasi pada desktop, mobile, dan perangkat dengan performa rendah.

## Optimasi Frontend

- Kurangi rerender React yang tidak perlu.
- Pisahkan state lokal dan state halaman secara tepat.
- Stabilkan callback dan derived data hanya jika terbukti membantu.
- Hindari filter, sort, dan agregasi besar pada setiap render.
- Gunakan pagination atau virtualisasi untuk daftar besar.
- Batasi DevLog ke maksimum 500 event terbaru.
- Batalkan request yang sudah tidak relevan dengan `AbortController`.
- Hindari request duplikat ketika tab atau dialog dibuka ulang.
- Gunakan cache React Query yang sudah tersedia.
- Lazy-load bagian berat seperti editor, AI summary, evidence, atau recording.
- Pastikan gambar atau frame recording tidak dimuat sekaligus.
- Hindari bundle baru jika dependency existing sudah cukup.

## Optimasi API dan SQLite

- Gunakan Prisma dan query terstruktur.
- Pilih hanya kolom yang dibutuhkan.
- Hindari `include` relasi besar tanpa batas.
- Tambahkan index hanya untuk query yang benar-benar digunakan.
- Prioritaskan index pada:
  - `projectId`
  - `moduleId`
  - `status`
  - `updatedAt`
  - `testCaseId`
  - Kombinasi filter dan sorting yang sering digunakan.
- Gunakan pagination database, bukan memuat semua data lalu memotong di frontend.
- Gabungkan query agregasi yang berulang jika aman.
- Hindari N+1 query.
- Gunakan transaksi hanya untuk operasi yang memang harus atomik.
- Aktifkan konfigurasi SQLite yang aman untuk performa lokal seperti WAL dan busy timeout jika belum tersedia.
- Jangan melakukan full scan file JSONL pada setiap request.
- Cache data yang jarang berubah hanya jika ada invalidasi yang jelas.
- Pastikan import Excel tetap atomik dan tidak membuat duplikasi.

## Workflow Prioritas

Optimalkan dan uji minimal:

1. Membuka aplikasi.
2. Memilih project.
3. Membuka dashboard.
4. Mencari dan memfilter test case.
5. Membuka detail test case.
6. Mengubah status atau progress.
7. Import dan export Excel.
8. Membuka DevLog.
9. Realtime Console dan Network.
10. Manual dan automation recording.
11. Preview frame atau video setelah recording selesai.
12. Bug Fix lifecycle.
13. AI Summary dan Evidence.

## Target Performa

Pada data lokal saat ini:

- Initial UI meaningful tampil maksimal sekitar 2 detik.
- Pergantian menu terasa instan.
- Tidak ada request API duplikat tanpa alasan.
- Search dan filter memberi respons kurang dari 200 ms setelah debounce.
- Detail test case terbuka tanpa freeze.
- Tabel tetap responsif dengan ratusan test case.
- DevLog baru muncul tanpa refresh.
- Tidak ada long task frontend yang mengganggu interaksi.
- Query API utama mempunyai waktu respons yang konsisten.
- Tidak ada error console atau hydration warning.

## Pengujian

Setelah setiap kelompok perubahan:

- Jalankan unit test.
- Jalankan ESLint.
- Jalankan TypeScript check.
- Jalankan production build.
- Gunakan browser testing pada `http://localhost:3000`.
- Periksa console dan network.
- Ambil screenshot desktop dan mobile.
- Uji data kosong, loading, error, dan data besar.
- Bandingkan baseline sebelum dan sesudah.
- Pastikan tidak ada regresi import Excel, DevLog, dan recording.

## Kriteria Animasi Selesai

- Setiap interaksi utama memiliki feedback visual yang jelas.
- Transisi terasa halus tetapi tetap cepat.
- Tidak ada layout shift, flicker, overlap, atau input lag.
- Reduced-motion berfungsi.
- Animasi tidak menambah rerender atau memperlambat workflow.

## Kriteria Selesai

- UI lebih konsisten dan nyaman tanpa mengubah workflow utama.
- Dashboard, tabel, dialog, dan sidebar responsif.
- Request API berkurang atau lebih efisien.
- Query SQLite menggunakan index dan pagination yang tepat.
- Tidak ada full-table atau full-file scan yang tidak perlu.
- DevLog dan recording tetap realtime.
- Seluruh test, lint, typecheck, dan production build lulus.
- Hasil diverifikasi melalui browser, bukan hanya berdasarkan build.
- Perubahan sudah di-commit dan di-push dengan ringkasan benchmark sebelum dan sesudah.
