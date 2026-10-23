# Traceva — edit dan hapus akses akun

## Penggunaan

Settings → Team → **Edit akun** membuka editor inline untuk nama, email,
password baru (opsional), dan role. Kosongkan password jika tidak ingin mengganti.
Simpan menampilkan hasil/error; kegagalan tidak menghilangkan draft. Mengubah email
atau password mengakhiri seluruh session akun terkait. Untuk akun sendiri, UI
kembali ke login; perubahan nama/role sendiri memuat ulang izin aplikasi.

Tombol hapus membuka konfirmasi sebelum request dikirim. Owner kedua bukan akun
khusus yang dikunci: Owner dapat mengedit/menghapus Owner lain selama workspace
tetap punya minimal satu Owner **aktif**. Admin tidak boleh mengelola akun Owner.
Role dan delete Owner aktif terakhir dinonaktifkan dengan penjelasan di UI dan
ditolak juga oleh server. Owner yang sudah nonaktif tidak dihitung sebagai cadangan.

## Semantik delete dan keamanan

- Delete mencabut membership workspace dan mengakhiri session. Jika akun tidak
  memiliki workspace lain, `disabledAt` diisi agar akun tidak bisa login lagi.
- Ini soft deletion/deactivation, bukan penghapusan permanen User. UUID, riwayat
  actor, dan data testcase/evidence dipertahankan; email tetap terdaftar dan tidak
  otomatis dibebaskan untuk akun baru. Tidak ada purge atau reaktivasi otomatis.
- Jika masih memiliki workspace lain, akun tidak dinonaktifkan secara global.
  Admin workspace tidak boleh mengganti identitas/password milik orang lain yang
  dipakai lintas-workspace. Role lokal masih bisa diedit. Akun admin sendiri tetap
  dapat mengedit identitasnya sendiri secara sadar.
- Otorisasi permanen dibaca ulang dari database di dalam transaksi. Guard Owner,
  perubahan identitas/role, pencabutan session, dan audit commit/rollback bersama
  dalam transaksi Serializable. Konflik konkurensi dikembalikan sebagai error,
  bukan di-retry diam-diam. Editor mengirim versi membership dan user untuk
  mendeteksi draft kedaluwarsa.
- Password di-hash melalui helper aplikasi yang sudah ada (12–200 karakter).
  Response/audit tidak memuat password atau hash. Audit hanya mencatat user ID,
  role, dan nama field yang berubah.

## Temuan awal dan batas klaim

Kode sebelumnya hanya menyediakan PATCH role dan DELETE membership/session;
tidak ada editor identitas dan akun tanpa membership masih tidak dinonaktifkan.
Alasan persis gagalnya percobaan pada akun asli pengguna tidak direproduksi dengan
akun/database asli. Implementasi baru diverifikasi menggunakan fixture sintetis.
Tidak ada akun asli yang diedit, dihapus, dinonaktifkan, atau direset oleh agent.

## Verifikasi

- 22 integration test baru di `src/lib/workspace-members.integration.test.ts`
  dan 46 test terkait di `src/lib/backend-phase6b.integration.test.ts`: **68 lulus**.
  Database SQLite sementara; tidak membutuhkan database/aplikasi produksi.
- Meliputi edit Owner kedua, password opsional, session, foreign workspace,
  shared-account takeover, Admin vs Owner, disabled Owner, Owner terakhir,
  concurrent removal, stale version, duplicate email, rollback dan response aman.
- Browser Playwright/Chromium: lima kelompok pemeriksaan lulus pada komponen
  terisolasi di port 3110. Memeriksa editor, payload, perubahan role, sukses,
  draft saat konflik, cancel delete, error dan retry delete, serta perlindungan
  Owner terakhir. UI 390px light/dark tanpa horizontal overflow.
- Impeccable memandu editor inline, konfirmasi destruktif, label dan feedback.
  Inspeksi screenshot menemukan warna error dark kurang kontras; diperbaiki
  secara lokal memakai semantic status token, tanpa mengubah shared Alert.
- TypeScript, ESLint terarah, mechanical scan komponen dan diff whitespace lulus.

Screenshot dan hasil browser:
`C:/Users/Admin/AppData/Local/Temp/traceva-members-evidence-20261022/`
(`desktop-edit-owner.png`, `delete-error-confirmation.png`,
`last-owner-protection.png`, `mobile-dark-edit.png`, `mobile-light-edit.png`,
`verification.json`). Browser memakai response sintetis; transaksi dan izin
server diuji terpisah dengan database nyata yang disposable, bukan end-to-end
login ke akun asli. PostgreSQL runtime, real password-manager dan physical touch
device belum diuji. Tidak ada migration/schema change. Tidak build/push/deploy.
