# TRACEVA — Context & Handoff untuk AI Berikutnya

Snapshot: 26 Oktober 2026, Asia/Bangkok. Dokumen ini disiapkan dari percakapan pengembangan, pemeriksaan source/config/Git saat penulisan, dokumentasi repository, dan hasil tes sesi terakhir.

Dokumen ini **bukan instruksi untuk otomatis menjalankan semua pekerjaan**, bukan backup database, dan bukan bukti bahwa source terbaru sudah berjalan di production. Baca permintaan manusia yang terbaru terlebih dahulu. Periksa ulang fakta yang bisa berubah: branch, diff, proses, konfigurasi efektif, schema dan test result.

Tidak ada password, session cookie, bootstrap token, relay token, isi `.env`, script berkredensial, atau data klien yang sengaja disalin ke dokumen ini. Tetap tinjau isinya sebelum membagikannya ke layanan AI eksternal.

## 1. Ringkasan sangat singkat

Traceva adalah aplikasi manajemen QA yang awalnya bernama QA-Web/QADesk. Saat ini digunakan di Windows, dengan SQLite lokal, oleh pemilik dan dapat dibagikan melalui akses tamu serta tunnel. Arah jangka panjang adalah SaaS, tetapi instalasi sekarang bukan platform SaaS terisolasi penuh.

Fitur inti: workspace/project, testcase, Bugs, Test Run/Cycle dan execution, evidence, report, traceability lane/graph, activity/history, notification, manual browser capture/devlog, dan Playwright Studio.

**Paling penting saat melanjutkan:**

1. Jangan merusak database/evidence asli yang dipakai pengguna dan AI lain melalui MCP.
2. Banyak perubahan terbaru belum di-commit; jangan menganggap HEAD mewakili source lokal.
3. Source terbaru belum dibuild/restart dalam pekerjaan optimasi terakhir.
4. Playwright Studio adalah trusted Node runner, **bukan sandbox**.
5. Permanent files tidak boleh disimpan di `.next`.
6. UUID internal, display ID, execution status, inventory status, dan Bug lifecycle adalah konsep berbeda.

## 2. Workspace dan Git saat snapshot

- Repository: `C:\Users\Admin\OneDrive\Desktop\Project Sammy\QA-Web`.
- OS/shell: Windows / PowerShell.
- Timezone pengguna: Asia/Bangkok.
- Brand sekarang: **Traceva**. Nama direktori/repository dan sebagian nama package/legacy variable tetap QA-Web/QADesk; jangan rename seluruh identifier sembarangan.
- Origin: `https://github.com/Yoodaddy171/QA-Web.git`.
- Branch: `codex/frontend-design-system-motion-optimization`.
- HEAD: `1e039d1` — `feat(traceva): deliver guest access, Playwright Studio and durable storage`.
- Perbandingan HEAD vs upstream lokal: `0 0` ketika diperiksa. **Tidak menjalankan fetch baru**, jadi ini bukan klaim remote live tidak berubah.
- Worktree sangat dirty: puluhan file tracked berubah dan sejumlah implementasi/test baru masih untracked.
- Tidak melakukan commit/push/build/restart dalam pekerjaan optimasi terakhir maupun penulisan handoff ini.
- Snapshot juga menemukan `opencode.json` untracked, bukan hasil pekerjaan optimasi sebelumnya; jangan mengubah/menyertakannya tanpa pemeriksaan.

Commit historis penting:

| Commit | Scope |
|---|---|
| `f7ebffb` | Traceability Graph + refinemen Phase 8E |
| `1eecf4a` | Preview evidence dan navigasi galeri |
| `8f7cc16` | QA Report Excel template |
| `c47c703` | Durable evidence storage, recovery/backup |
| `4168398` | MCP execution synchronization dan upload evidence atomik |
| `b16b821` | Cases/inspector/activity polish dengan Impeccable |
| `08e015c` | Handoff reviewer sesudah Phase 8E |
| `1e039d1` | Guest access, Studio, durable storage dan follow-up terkait |

Angka fase 8A/8B/8C/8E berasal dari prompt reviewer eksternal. **Jangan mengarang nomor fase baru** atau berpura-pura setiap fase dahulu punya commit sendiri. Lihat `docs/post-8e-reviewer-handoff.md` dan Git log untuk delivery sebenarnya.

## 3. Preferensi dan batas kerja pengguna

- Jawab dalam Bahasa Indonesia yang praktis dan jelas.
- Pengguna mengutamakan bukti; bedakan temuan terverifikasi, dugaan, keputusan produk, dan keterbatasan pengujian.
- Rencanakan secukupnya sebelum perubahan besar; optimasi harus mempertahankan fitur/data, bukan menambah scope tanpa izin.
- Refactor pemecahan semua file besar pernah **ditunda**. Ekstraksi kecil yang diperlukan boleh dalam scope pekerjaan; jangan memulai rewrite massal.
- UI harus rapi, premium, padat tetapi terbaca, konsisten light/dark, aksen indigo, animasi cepat dan fungsional. Kecepatan persepsi bukan alasan untuk klaim FPS tanpa profiling.
- `AGENTS.md` pengguna mewajibkan `C:\Users\Admin\.codex\RTK.md` dan skill `C:\Users\Admin\.agents\skills\impeccable\SKILL.md` untuk pekerjaan frontend/UI/UX.
- Gunakan source/component yang sudah ada; jangan mengganti framework/design system hanya untuk polish.
- Hormati reduced motion, keyboard, focus, scroll dalam modal/fullscreen, responsive, loading/error/empty state.
- Gunakan `apply_patch` untuk edit file; pertahankan dirty changes yang bukan milik task.
- Jangan otomatis `git add .`: terdapat dokumen pribadi, artefak QA, database/evidence, MCP config, dan konfigurasi lokal untracked.
- Commit/push hanya jika diminta; commit deskriptif dengan body scope, verification dan batasan. Meminta push bukan otomatis meminta PR atau merge ke main.
- Build dan restart adalah tindakan berbeda dari commit/push. Selalu sebut apakah sudah dilakukan.
- Startup BAT harus **npm start, bukan npm build**, sekaligus relay dan runner/tunnel sesuai launcher.
- Jangan mematikan server yang sedang dipakai Claude/MCP tanpa konteks/otorisasi terbaru. Izin mematikan proses di percakapan lama bukan izin permanen.
- E2E otomatis penuh pernah diminta di-skip. Pengujian UI terisolasi/manual Playwright dilakukan pada pekerjaan terbaru; jangan mengklaimnya sebagai E2E production penuh.
- Lint/build diletakkan di akhir implementasi, bukan berulang saat setiap edit. Jika pengguna eksplisit meminta build setelah tes lolos, ikuti permintaan aktif tersebut.
- Untuk QA website klien, pengguna mengutamakan interaksi UI; API-only perlu alasan. Video, Console dan Network harus diverifikasi terpisah, bukan sekadar menandai PASS.

## 4. Stack dan konfigurasi build

Dari `package.json` saat snapshot (range dependency, bukan seluruh versi lockfile):

- Next.js App Router `^16.1.1`, React 19, TypeScript 5.
- Tailwind CSS 4, shadcn/Radix components, Lucide, Framer Motion.
- Prisma `^6.11.1`; SQLite aktif lokal, PostgreSQL disiapkan sebagai jalur migrasi.
- Vitest 4, Playwright Test `^1.61.1`, ESLint 9.
- ExcelJS + SheetJS, Sharp, ws, FFmpeg installer, Recharts, Zod.
- Node engine: `>=20.9 <26`; panduan launcher menyarankan Node 22/24 LTS. Pernah ada error/log pengguna dari Node 26; jangan menganggap versi itu didukung.

`next.config.ts` sekarang:

- `output: standalone`.
- `typescript.ignoreBuildErrors: false`.
- `reactStrictMode: true`.
- Production profiling hanya opt-in `QA_PERF_PROFILING=1`.
- FFmpeg tracing untuk readiness dan exclusion dev watcher terhadap data/logs/recordings.

Temuan review lama `ignoreBuildErrors:true` dan Strict Mode mati **sudah bukan kondisi config sekarang**. Build pernah gagal karena font jaringan dan Prisma PostgreSQL client statis; periksa kode sekarang sebelum mengulang temuan lama.

## 5. Peta arsitektur

| Area | Lokasi utama |
|---|---|
| App/page orchestration | `src/app/page.tsx`, `src/lib/client/workspace-tab-views.tsx` |
| App shell / brand | `src/components/AppShell.tsx`, login dan asset Traceva |
| UI primitives | `src/components/ui/`, `src/app/globals.css` |
| API | `src/app/api/**/route.ts` |
| Session / authorization | `src/proxy.ts`, `src/lib/request-actor.ts`, `src/lib/domain/guest-access.ts`, auth/workspace services |
| Database singleton | `src/lib/db.ts` |
| Business services | `src/lib/services/` |
| Case inventory | `src/hooks/use-testcases.ts`, testcase routes/services, `TestCaseDetailDialog.tsx` |
| Test Runs | `src/components/TestRunsPanel.tsx`, `test-run-service.ts`, execution services |
| Bugs | `BugFixPanel.tsx`, `use-bugfixes.ts`, bugfix API/sync service |
| Traceability | `TraceabilityPanel.tsx`, traceability services/domain and graph components |
| Evidence gallery | `TestCaseEvidenceTab.tsx`, `TestCaseEvidencePreview.tsx` |
| Reports | `ReportsPanel.tsx`, `ReportHistory.tsx`, report services, `src/app/api/evidence/` |
| Settings/team/guests | `SettingsPanel.tsx`, `ProjectKnowledgeCard.tsx`, workspace/team/guest APIs |
| Studio UI | `PlaywrightScriptPanel.tsx`, Automation section in testcase detail |
| Studio backend | `src/app/api/automation/scripts/`, `src/lib/automation/`, `scripts/automation-runner.mjs` |
| Manual capture relay | `mini-services/ws-server.js`, relay security/capture helpers |
| Devlog/video viewer | `SystemDevLogFullscreen.tsx`, `RecordingVideoPanel.tsx`, `SyncedVideoEventsPanel.tsx`, Console/Network/Execution log views |
| Durable storage | `src/lib/storage/`, evidence maintenance/migration scripts |
| MCP bridge | `mcp-qa-web/`, repository skill `skills/qa-web-testcase/` |
| Regression tests | Tests colocated with source; integration files `src/**/*.integration.test.ts`; relay tests `mini-services/*.test.*` |

Diagram konseptual:

```text
Browser → authenticated Next API → service/transaction → SQLite metadata
                                  └→ durable evidence/artifact filesystem

Manual capture → loopback relay → browser recording + devlog
Studio API → persisted queue → separate local runner → Playwright → per-run artifacts/events
MCP → real authenticated owner session → same application API/RBAC
```

Graphify ada di `graphify-out/graph.json`. Query terlebih dahulu untuk navigasi codebase, kemudian verifikasi source yang relevan. Jangan menganggap graph sebagai pengganti kode aktual. Setelah edit source/config/docs, gunakan incremental `graphify update .`, bukan full extraction paksa.

## 6. Domain data dan semantik yang tidak boleh disamakan

- Workspace menaungi project; project memiliki testcase/module, runs, requirements/plans, Bugs, reports, history.
- `TestCase.id` adalah opaque internal primary key (umumnya Prisma CUID; percakapan menyebutnya UUID). **Jangan mengasumsikan semua ID format UUID RFC.** `testCaseId` adalah ID tampilan yang bisa diresequence/rename.
- Relasi memakai internal ID, bukan string display ID. Resequence tidak boleh memutus execution/evidence/Bug/history.
- Inventory testcase status berbeda dari hasil execution dalam suatu cycle dan berbeda dari Bug workflow.
- Test Run statuses: `DRAFT`, `READY`, `IN PROGRESS`, `COMPLETED`, `ARCHIVED`.
- Execution statuses: `NOT RUN`, `IN PROGRESS`, `PASSED`, `FAILED`, `BLOCKED`, `RETEST`, `VERIFIED`.
- Label UI bukan izin mengubah enum/kontrak persisted seenaknya. Inventory masih mempunyai status legacy; baca domain/progress helpers.
- Satu testcase dapat punya banyak execution historis. Pemilihan latest harus deterministic, mengikuti effective result time dan tie-break persisted, bukan urutan respons browser.
- Ada jalur synchronization execution→inventory/Bug di backend. **Jangan menganggap semua execution otomatis menyinkronkan inventory.** UI Test Run membedakan hasil cycle dengan verifikasi Bug inventory; MCP punya kontrak explicit sync. Baca `execution-result-service.ts`, caller dan request contract.
- Studio script run sendiri **tidak otomatis mengubah verdict testcase/Test Run**. Status script gagal bisa berarti script salah, capture gagal, atau bug aplikasi; bedakan dengan hasil QA.
- Jumlah failed testcase tidak harus sama dengan jumlah Bug; jangan menyimpulkan korupsi tanpa memeriksa relasi/jalur mutation. Ada patch direct-create FAILED agar tidak melewati bug queue.
- Histori/audit actor diambil dari session di server, bukan actor string request yang tidak dipercaya.

## 7. Fitur dan keputusan UX utama

### Case inventory dan inspector

- Search/filter/sort/pagination/saved views/density; pengguna meminta **satu urutan terbaru** mencakup baru dibuat maupun diedit, bukan dua mode terpisah.
- Detail memakai right-side inspector desktop dan fullscreen sheet di layar kecil; posisi dari atas viewport.
- Ukuran shell konsisten antar-tab; header/tab rail tetap, tab horizontal scroll tanpa overlap.
- Tab mencakup Overview, Steps, Traceability, Execution, Evidence, Bugs, History, Comments, Automation.
- Previous/Next tidak perlu kembali ke tabel; tab aktif dipertahankan.
- Bug Steps kosong pada transisi Overview→Steps pernah dilaporkan dan kemudian dikonfirmasi pengguna sudah fix. Jangan menganggapnya masih terbuka tanpa reproduksi.
- Activity feed harus memakai bahasa aktivitas manusia, bukan `GuestAccessGrant redeemed` / `evidence_added` / UUID sebagai satu-satunya konteks.

### Test Run/Cycle

- Workspace rail/canvas/context, sticky outcome bar, notes, execution/evidence/Bug.
- Shortcuts P/F/B/R/N; abaikan saat fokus input/editor.
- Draft browser lokal; server save adalah tindakan execution, bukan sekadar perubahan textarea.
- Request guards dan resume UUID terbaru dijelaskan di bagian perubahan lokal.

### Evidence dan report

- Evidence dibuka inline preview, bukan tab browser baru; X/Escape menutup preview saja.
- Foto punya previous/next dan ArrowLeft/Right; video/PDF bukan bagian urutan foto.
- File asli tetap bisa dibuka/diunduh sesuai authorization; thumbnail bukan pengganti original evidence.
- Evidence Report Studio harus memakai run/video yang dipilih, bukan diam-diam latest/relay lain.
- QA Report XLSX berisi Summary + Test Cases, selected-only, UUID/module, numeric progress, styling/filter/freeze, cached formulas.
- Legacy single-sheet/per-module XLSX dan CSV tetap tersedia.
- **QA Report bukan format import dan bukan backup lossless**. Import QA Report sengaja ditolak sebelum write. Legacy import juga bukan general upsert/history restore.
- Import row testcase/activity/initial Bug harus atomic; kegagalan satu bagian rollback row tersebut.

### Traceability

- Relasi requirement → testcase → plan → run; lane dan graph membaca relasi nyata.
- Manage Relationships untuk edit data/relasi yang ada; create action terpisah agar tidak membingungkan.
- Graph adalah bounded neighborhood, bukan seluruh database tanpa batas. Laporan 8E mendokumentasikan limits; periksa source jika mengubahnya.
- Tidak boleh membuat relasi palsu dari nama/status/kedekatan posisi node.

### Automation / capture

- Automation tab dipecah **Hasil / Script / Capture**, default hasil terbaru; jangan mengembalikan editor besar yang mendorong seluruh devlog ke bawah.
- Riwayat dapat dihapus single/bulk dengan konfirmasi; hanya run terminal, bukan yang masih aktif/finalizing.
- Delete Studio history mencakup folder run terpilih/artifacts/snapshot, bukan saved editor script, testcase atau evidence QA lain.
- Jangan auto-delete FAILED: bisa bukti bug sungguhan. Stop terlebih dahulu, tunggu finalization, lalu delete jika diotorisasi.
- Automation Log menggabungkan relay dan metadata Studio saat read, tanpa menyalin artifact ke database atau mengubah verdict.
- Fullscreen viewer harus benar-benar viewport, interaktif, X/Escape bekerja, tidak membawa state fullscreen saat inspector dibuka lagi.
- Network expand turun di bawah row; tombol Use tetap menampilkan headers/payload/response, tidak hanya response.
- Touchpad/wheel harus bekerja pada list dan detail, bukan scrollbar saja. Portal/focus lock/scroll container pernah menjadi sumber regresi.
- Execution log menampilkan aksi manusia (klik, input, pilih dropdown, navigasi). Console/Network/Execution ada di viewer fullscreen.
- Timeline bisa berisi beberapa event per timestamp; perlu daftar event yang dapat dipilih dan membawa fokus ke event terkait.
- ArrowLeft/Right video ±5 detik; jangan aktif saat mengetik atau bertabrakan dengan kontrol lain.
- Pengguna ingin raw telemetry tidak direduksi/redacted untuk reproduksi; ini **bukan izin membagikan secret di chat/dokumen/commit atau melemahkan auth**.

## 8. Authentication, akun dan guest

- App **sudah memiliki authentication sekarang**. Konteks awal single-user/no-auth hanya historis, bukan saran menonaktifkan keamanan saat ini.
- Session opaque token, database menyimpan hash; cookie HttpOnly/SameSite dan origin protections.
- Role permanent: OWNER, ADMIN, QA_LEAD, QA, VIEWER. Detail action permission mengikuti policy server.
- First owner via bootstrap form/command, token host-only. Tidak ada default login yang boleh diasumsikan.
- Jangan membaca/menampilkan password. Jika login hilang, gunakan flow reset/bootstrap yang memang aman dan diotorisasi.
- Team edit mendukung nama/email/password opsional/role; delete membership/deactivation menjaga audit, bukan purge User.
- Owner kedua dapat dikelola oleh Owner, tetapi Owner aktif terakhir harus dilindungi. Admin tidak mengelola Owner.
- Guest grant terpisah dari permanent membership; token hash, expiry, project allowlist, privilege allowlist dan max redemption.
- Reviewer/Tester preset dapat disesuaikan. Tester dapat execute pada cycle yang ada dan evidence/Bug milik execution sendiri sesuai izin.
- Guest tidak boleh mengakses script runner/raw devlog/relay/admin/AI, mengubah definisi testcase/cycle, atau melakukan destructive overwrite.
- Revocation/expiry diperiksa server pada setiap protected request. UI polling bukan kontrol authorization utama.
- Dokumen sumber: `docs/authentication.md`, `docs/traceva-account-management.md`, `docs/traceva-guest-access.md`.

## 9. Storage permanen — insiden penting

Pernah terjadi evidence metadata ada tetapi gambar rusak setelah rebuild karena file tersimpan di `.next/standalone/data/evidence`. Build output terhapus, file hilang, DB tetap menunjuk file lama. Sebagian dipulihkan dari sesi QA dengan SHA-256 matching. **Jangan pernah mengulang storage relatif terhadap cwd standalone.**

Keputusan pengguna: satu root data utama dengan subfolder `evidence`, `automation`, `recordings`, `logs`.

- Setting utama: `QA_DATA_DIR`, contoh `%LOCALAPPDATA%/Traceva`.
- Override evidence: `QA_EVIDENCE_STORAGE_DIR`; pengguna sebelumnya memasang `C:/Users/Admin/AppData/Local/QADesk/evidence` sebelum konsolidasi.
- Studio override: `QA_SCRIPT_RUNNER_DIR`.
- Runtime/relay overrides antara lain `QA_RUNTIME_DIR`, `QA_RELAY_LOGS_DIR`; compatibility paths tetap ada.
- **Nilai efektif `.env` tidak dibaca ulang/disalin untuk handoff ini.** Jangan menebak root aktif hanya dari contoh atau sejarah.
- `DATABASE_URL` tetap menunjuk database sendiri; konsolidasi artifact tidak berarti memindahkan DB.
- Web, relay dan runner wajib memakai konfigurasi storage yang konsisten.
- Root harus absolut, di luar `.next`; perhatikan realpath/symlink/junction, path traversal dan manifest validation.
- Migrasi harus stop writer yang relevan, backup, copy-only, verifikasi hash, tolak konflik; jangan hapus source lama sebelum read-back.
- Backup DB bersama artifact root. DB-only backup tidak menyelamatkan file video/evidence.
- `scripts/migrate-data-storage.mjs`: preflight tanpa `--apply`; jangan menjalankan apply lagi tanpa kebutuhan/otorisasi.
- Perintah evidence audit/migrate/backup ada; baca help/source sebelum mutation.
- Dokumen: `docs/traceva-data-storage.md`, `docs/backup-restore.md`.

## 10. Process, startup, build dan tunnel

| Tujuan | Perintah |
|---|---|
| Development (default 3000 loopback) | `npm run dev` |
| Production build | `npm run build` |
| Start existing standalone build | `npm start` |
| Relay (umumnya loopback 3001) | `npm run relay` |
| Studio worker, tidak membuka port | `npm run automation:runner` |
| Production + relay + runner + random tunnel | `run-traceva-production-tunnel.bat` |
| Launcher preflight tanpa start | `run-traceva-production-tunnel.bat --check` |

- Build menjalankan `next build && node scripts/finalize-standalone.mjs`.
- Start memakai `scripts/start-local.mjs`, memuat `.env`, menormalisasi SQLite path, menegakkan durable evidence root dan default loopback.
- Jangan jalankan dev dan build bersamaan pada checkout/output `.next` yang sama. Port berbeda tidak mengisolasi output build.
- Browser production tidak memperlihatkan source edit sampai build/restart benar-benar dilakukan.
- Jangan terminate semua node.exe/global kill ports; identifikasi process owner/project terlebih dahulu.
- Web/relay/runner terakhir yang dipakai user tidak diaudit ulang liveness-nya dalam handoff ini. Port preview sementara 3113 dari pengujian terakhir sudah dihentikan.
- Named Tunnel sempat dibahas, tetapi pengguna belum punya domain dan memilih **random Quick Tunnel** dahulu.
- Launcher sekarang menggunakan existing build, menjalankan relay/runner dan quick tunnel; **tidak build otomatis**.
- Hanya web yang dipublikasikan. Jangan expose relay 3001, DB, raw Devlog atau filesystem.
- URL random bukan authentication. Gunakan guest grant, bukan password Owner untuk berbagi.
- `QA_RELAY_TOKEN` diperlukan dan harus acak dengan kekuatan/panjang minimal sesuai validator. Jangan memasukkan token tersebut ke browser bundle atau handoff.
- Origin localhost vs 127.0.0.1 pernah menimbulkan 403; token bootstrap/relay salah pernah menjadi masalah berbeda. Jangan menyelesaikan dengan bypass security.
- Sumber launcher/tunnel: `scripts/start-prod-tunnel.mjs`, `docs/traceva-production-tunnel.md`.

## 11. Playwright Studio dan MCP

### Studio

- Script Playwright Test `.spec.ts` mandiri memakai `test`, `expect`, fixture `page/context` dari `@playwright/test`.
- Worker terpisah diperlukan; POST queued bukan bukti sudah dieksekusi.
- Web dan worker harus melihat storage root yang sama dan memiliki izin OS yang sesuai.
- Run punya opaque ID, actor/time/status, snapshot script/input, video, trace, screenshot saat gagal, telemetry.
- Video biasanya siap setelah context ditutup/finalization. Poll terminal state, drain event pages dan baca artifact manifest.
- Artefak diakses lewat endpoint authenticated dan manifest ID; jangan mengarang path disk/URL.
- Permissions Studio owner/admin; guest dan role QA biasa bukan pemberi izin menjalankan Node code.
- Trusted local runner memiliki akses akun OS. Sebelum SaaS perlu container/job sandbox, network/volume isolation, secret broker dan resource quota nyata.
- Child environment difilter; kredensial test sengaja disediakan melalui host `TRACEVA_TEST_*`, bukan menyalin seluruh `.env` aplikasi.
- Queue/run/event/artifact limits tersedia. Jangan menganggap limits operasional sebagai sandbox terhadap malicious code.
- Riwayat lama tetap disimpan kecuali dihapus eksplisit. Sebagian dokumentasi lama mengatakan belum ada delete; **section delete terbaru dan source API sekarang lebih berwenang**.

### MCP

- `mcp-qa-web/` adalah bridge ke aplikasi dengan session OWNER nyata; tetap melalui RBAC/API.
- Mulai operasi yang belum dikenal dengan `qa_web_guide` / `qa_web_contract` / catalog discovery, jangan menebak nama tool/request schema.
- Catalog harus mendeteksi exported route alias `export const GET = handle`, bukan function declaration saja.
- Studio exposed melalui operation group `automation_scripts`; delete history terpisah.
- Selalu gunakan ID internal testcase dalam binding Studio; jangan memasukkan display ID yang kebetulan mirip.
- Destructive MCP operation memakai confirmation challenge/payload binding; jangan bypass hanya karena akun Owner.
- Setelah mutation lakukan read-back. Nilai HTTP 200/202 saja bukan verifikasi state/artifact.
- Trial/error script bisa menghasilkan banyak run. Hapus hanya run yang dipilih/diotorisasi; jangan menghapus semua FAILED otomatis.
- Contract tests MCP tidak membuktikan worker nyata/video/console/network lengkap.
- Dokumen: `mcp-qa-web/README.md`, `skills/qa-web-testcase/SKILL.md` beserta references, `docs/traceva-playwright-studio.md`.

## 12. Perubahan lokal belum di-commit — jangan hilang

Bagian ini ringkasan logical work, bukan seluruh `git status`. Periksa diff aktual sebelum stage. Ada perubahan lain dari pengguna/AI lain.

### A. Studio history, layout dan viewer

- Single/bulk terminal-run delete + MCP discovery/guard/tests.
- Automation default Hasil, pemisahan Hasil/Script/Capture, history lebih rapi.
- Timeline multi-event dan seek ±5 detik; viewer synchronization.
- Studio run masuk Automation Log bersama relay history.
- Selected-run Studio Evidence Report; tidak fallback ke run lain.
- Variable-height devlog virtualization dan event-page buffering.

File kunci: `PlaywrightScriptPanel.tsx`, `TestCaseDetailDialog.tsx`, `SystemDevLogFullscreen.tsx`, `RecordingVideoPanel.tsx`, `SyncedVideoEventsPanel.tsx`, `VirtualLogList.tsx`, `use-automation-devlog.ts`, `src/lib/client/automation/`, `src/lib/automation/`, automation/evidence API, `mcp-qa-web/`.

### B. Efisiensi batch sebelumnya

- Excel import row atomic, sanitized row error dan partial-success warning.
- Bugs server pagination 25/filter; tidak hanya filter subset data client.
- Traceability picker lazy server search/page, melewati batas 200 lama.
- Studio bounded-byte log checkpoints dan adaptive polling/draining.
- Dashboard stats in-flight dedup dan stale project guard.
- Test Run summary aggregate counts; execution local update + summary refresh.
- Reports opt-in compact summary, detail on demand; legacy response dipertahankan.
- Notification scoped requests, hidden-tab polling pause, read-mutation errors.
- Automation Log pagination/search/module; Studio filesystem case-marker index.
- Event windowing tidak menghapus log tersimpan, hanya membatasi mounted DOM.

Penjelasan lanjutan: `docs/traceva-efficiency-cleanup.md`.

### C. Batch terbaru: enam perbaikan yang baru selesai

1. **Draft notes:** `src/lib/client/run-draft.ts` flush sebelum ganti case/run, unmount, page exit; debounce 180 ms tidak lagi satu-satunya penyelamatan. Storage failure mempertahankan pending draft dan memberi error.
2. **Stale reads:** run/list/case-page/execution-evidence request ownership, abort + generation/current identity guards; late A tidak menimpa B.
3. **Resume UUID:** `traceva.testRun.lastCase.v2.<scope>.<runId>`; server `focusCaseId` mengambil page berisi UUID meskipun di luar 100 awal; legacy index dibaca untuk migration, preceding page bisa dimuat. Guest scope dipisah.
4. **Add-case picker:** `view=options`, debounced server search, limit 25/page, pilihan Set bertahan lintas page/query.
5. **Evidence:** endpoint metadata `GET /api/testcases/:id/evidence?projectId&limit&cursor`; gallery tidak lagi fetch seluruh traceability tree; execution evidence load-more; foto Next/arrow dapat memuat page berikutnya.
6. **Settings:** AI/Knowledge fetch hanya saat tab perlu; error HTTP bukan empty-success; Knowledge retry; AI card tidak dimount untuk non-admin.

Tambahan thumbnail:

- Existing evidence-file endpoint menerima `thumbnail=1` untuk image.
- Sharp menghasilkan WebP maximum 640×360, tidak upscale, original tidak berubah.
- Decode concurrency 2, pending dedup, cache memory 64 entries / 16 MB; source cap 25 MB dan input pixel cap 40 juta.
- Authorization harus berjalan **sebelum** cache/file access. Key mencakup content identity/version.
- Fallback thumbnail gagal tetap membuka original secara eksplisit, bukan otomatis memuat seluruh original di semua cards.
- Tidak menambah schema atau file thumbnail persisten.

File/test baru batch C:

```text
src/lib/client/run-draft.ts
src/lib/client/run-draft.test.ts
src/lib/services/run-resume.test.ts
src/lib/services/evidence-thumbnail.ts
src/lib/services/evidence-thumbnail.test.ts
src/lib/services/run-gallery.integration.test.ts
src/app/api/testcases/[id]/evidence/route.ts
src/app/api/testcases/[id]/evidence/route.test.ts
```

Existing file yang berubah pada batch C meliputi `TestRunsPanel.tsx`, `SettingsPanel.tsx`, `ProjectKnowledgeCard.tsx`, `TestCaseEvidenceTab.tsx`, `TestCaseEvidencePreview.tsx`, `test-run-service.ts`, run/cases/evidence routes, `guest-access.ts` dan cleanup documentation.

## 13. Hasil verifikasi terbaru dan batas klaim

Dilakukan pada sesi sebelum penulisan handoff, 26 Oktober 2026:

| Pemeriksaan | Hasil |
|---|---|
| Full unit suite serial | **457 passed, 1 skipped**, 88 files (87 passed, 1 skipped) |
| Integration baru run/gallery | **2 passed**, SQLite disposable; 230 run cases dan 70 evidence metadata |
| TypeScript | `npx tsc --noEmit` passed |
| Full repository lint | `npm run lint` passed |
| Isolated UI fixture | **32 assertions passed**, Chromium 1440/390 px, synthetic API data |
| Runtime page errors pada fixture | Tidak ditemukan |
| Impeccable detector changed surfaces | Exit 0, tidak ada finding |
| Production build/restart | **Tidak dilakukan** |
| Commit/push | **Tidak dilakukan** |
| Full authenticated production E2E | **Tidak dilakukan** |
| Seluruh integration suite / live PostgreSQL | **Tidak dijalankan ulang** pada batch terakhir |

UI checks mencakup late response A/B, resume testcase 150, quick Next/Previous draft, flush saat unmount, evidence page berikutnya, multi-page checkbox selection, case search setelah 200, thumbnail URL, preview Next/ArrowLeft, dan lazy Settings error states.

Ada satu kegagalan awal full unit paralel: existing `mini-services/devlog-sqlite.test.js` timeout pada schema preparation (~52 detik). Isolated rerun lolos sekitar 2 detik; full suite serial kemudian lolos tanpa menaikkan timeout. Jangan menyembunyikan flake ini atau menyimpulkan bug data baru tanpa reproduksi.

Browser fixture memakai Playwright biasa karena Browser plugin tidak tersedia. Vite preview terisolasi `127.0.0.1:3113`, bukan prod; sudah dihentikan. Cold dependency optimization sempat timeout dan satu locator fixture salah memilih pagination sidebar; diperbaiki pada harness, bukan dianggap defect produk.

Artefak/harness sementara (bisa hilang ketika Temp dibersihkan):

`C:\Users\Admin\AppData\Local\Temp\traceva-automation-modes-20261026\`

Antara lain `workflow-main.tsx`, `workflow-check.mjs`, `workflow-390.png`, `workflow-1440.png`. Beberapa screenshot gallery diambil pada fase closing animation; jangan memakainya sebagai bukti final visual media production. Test gambar memakai media sintetis, bukan evidence klien.

Graphify sync terakhir sebelum handoff: berhasil, 5.361 nodes / 14.653 edges / 306 communities. Warnings: tujuh non-source JSON zero-node, dua Groovy template parse errors lama, community labels berubah. Ini bukan kegagalan unit test atau bukti aplikasi runtime rusak.

## 14. Perintah verifikasi aman

Pada Codex/mesin ini gunakan RTK untuk external commands sesuai aturan pengguna:

```powershell
rtk git status --short
rtk git log -5 --oneline
rtk proxy git rev-list --left-right --count 'HEAD...@{upstream}'
rtk proxy npx vitest run --maxWorkers=1
rtk proxy npx vitest run --config vitest.integration.config.ts src/lib/services/run-gallery.integration.test.ts
rtk proxy npx tsc --noEmit
rtk npm run lint
```

Untuk AI lain tanpa RTK, jalankan tool aslinya dengan output terbatas. `--maxWorkers=1` berguna menghindari resource contention pada mesin ini; jangan menaikkan timeout untuk menyembunyikan regresi.

Integration fixture harus membuat database/folder sementara dan mock DB singleton ke datasource tersebut. Jangan menjalankan destructive DB reset/push/seed pada `.env` utama hanya demi tes. Jangan memindahkan `.env` atau membuat akun test di DB asli tanpa kebutuhan/izin.

Perintah seperti `db:reset:sqlite`, restore, migrate apply, evidence migration, grant revoke, history delete, dan kill process bukan pemeriksaan read-only.

## 15. Langkah yang disarankan untuk AI penerus

1. Baca permintaan manusia terbaru. Handoff ini context, bukan backlog yang otomatis diotorisasi.
2. Baca `AGENTS.md`, RTK dan Impeccable bila mengubah frontend.
3. Periksa status Git, branch, HEAD dan diff aktual. Snapshot ini bisa stale.
4. Identifikasi proses web/relay/runner dan siapa yang memakai sebelum stop/build; jangan infer dari port saja.
5. Baca dokumentasi domain yang relevan, lalu source. Query Graphify untuk peta, bukan mengganti source verification.
6. Jika diminta build/deploy: pastikan backup/storage permanen benar, writer/Next dev terkait aman dihentikan, build berhasil, restart dan smoke test sumber/build yang benar. Jangan hanya berkata sudah build dari tes source.
7. Jika diminta commit/push: stage per logical task setelah review; sertakan file baru yang dibutuhkan; exclude secret, DB, evidence, artifact/private config. Beri commit body yang menjelaskan verifikasi dan yang belum diuji. Jangan rebase/reset dirty worktree.
8. Jika melanjutkan optimasi: ukur bottleneck nyata, lindungi correctness/request identity/draft/history, pertahankan default API compatibility, gunakan pagination/metadata projections sebelum micro-optimization.
9. Laporkan outcome, bukti, risiko dan apakah build/restart/commit/push benar-benar dilakukan.

Belum ada task implementasi baru yang otomatis tertunda setelah enam perbaikan terakhir; permintaan aktif saat dokumen ini dibuat adalah **membuat file context untuk AI lain**.

## 16. Index dokumentasi lanjutan

Mulai dari source bila dokumen historis bertentangan. Semua path berikut relatif root repository:

- `docs/traceva-efficiency-cleanup.md` — optimasi terbaru dan kontrak kompatibilitas.
- `docs/traceva-playwright-studio.md` — runner, artifacts, delete history, Automation Log.
- `docs/traceva-data-storage.md`, `docs/backup-restore.md` — persistent files, migration/rollback.
- `docs/authentication.md`, `docs/traceva-guest-access.md`, `docs/traceva-account-management.md`.
- `docs/traceva-production-tunnel.md` — launcher tanpa build, loopback, Quick Tunnel.
- `docs/traceva-release-since-phase8e.md`, `docs/post-8e-reviewer-handoff.md` — reviewer history.
- `docs/excel-export-template-update.md` — QA Report vs import/backup.
- `docs/traceability-graph-feature-implementation.md`, `docs/traceability-graph-ux-qa-report.md`.
- `docs/backend-phase6a-data-integrity-report.md` — transaction/concurrency findings.
- `docs/backend-phase6b-security-authorization-report.md`, phase6b1/6b2 reports.
- `docs/backend-phase6c-local-scalability-report.md` — SQLite/local resource scope.
- `docs/frontend-performance-phase3-handoff.md`, phase4/5a/5b reports — profiling sejarah; jangan menganggap angka lama masih current.
- `docs/phase7-end-to-end-functional-acceptance.md`, `docs/phase7-1-ux-accessibility-workflow-clarity.md`.
- `docs/phase8c1-ui-design-system-core-polish.md`, `docs/phase8c2-ui-consistency-implementation.md`.
- `docs/traceva-premium-login-redesign.md`, `docs/traceva-login-motion-and-polish.md`.
- `docs/testing.md`, `docs/postgresql-migration.md`, `docs/ai-governance.md`.
- `mcp-qa-web/README.md`, `skills/qa-web-testcase/`.

Dokumen lama berisi test totals dan build/port/DB snapshot pada tanggal masing-masing. Jangan menjumlahkannya sebagai jumlah tes current, menganggap port masih hidup, atau mengulang migration yang dahulu sudah diterapkan.

## 17. Prompt singkat untuk memulai chat AI lain

```text
Saya melanjutkan pengembangan Traceva (sebelumnya QA-Web/QADesk).
Baca TRACEVA_AI_CONTEXT.md di root repository terlebih dahulu, lalu AGENTS.md.
Dokumen itu adalah snapshot, bukan instruksi mengeksekusi seluruh backlog.
Periksa current branch/Git diff/source sebelum bertindak; banyak perubahan belum di-commit.
Jangan menimpa perubahan lokal, membuka secret, mengubah data QA asli, atau menghentikan
web/relay/runner tanpa kebutuhan dan otorisasi task saya yang terbaru.
Untuk frontend ikuti Impeccable. Jangan mengklaim production sudah ter-update hanya
karena unit test source lolos. Bedakan build, restart, commit, push dan smoke test.
Setelah membaca, ringkas kondisi current dan kerjakan permintaan terbaru saya:
[ISI PERMINTAAN SAYA DI SINI]
```

## 18. Cara menjaga context tetap berguna

Setiap handoff berikutnya sebaiknya memperbarui tanggal, branch/HEAD, logical pending diff, test/build/deploy status, process/storage facts yang benar-benar dicek, dan langkah berikut yang diotorisasi. Jangan menempel secret atau seluruh percakapan lama. Bila tidak memverifikasi ulang, tandai sebagai historical/unverified, bukan fakta current.
