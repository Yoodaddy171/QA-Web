# Phase 6B.2 — Git delivery and deployment handoff

Date: 15 October 2026. **FEATURE BRANCH DELIVERY COMPLETE.** Deployment approval, deployment execution and target-environment acceptance are separate and have not occurred. This handoff is intentionally local/untracked, outside the approved four-file commit scope.

## A. Git delivery

- Repository: `https://github.com/Yoodaddy171/QA-Web.git`.
- Branch: `codex/frontend-design-system-motion-optimization`; no branch switch.
- Previous HEAD: `1d98baa9a1865b087ed238558d97f6b85606d0f0`.
- Final commit: **`0deffe3b79648614e98f30dafc1be382aef16790`**.
- Verified remote feature-branch HEAD: **`0deffe3b79648614e98f30dafc1be382aef16790`**, obtained directly using `git ls-remote --heads` after push.
- Commit: `fix(security): harden custom report ID authorization`.
- Commit URL: [0deffe3](https://github.com/Yoodaddy171/QA-Web/commit/0deffe3b79648614e98f30dafc1be382aef16790).
- Normal push succeeded: `1d98baa..0deffe3`; no force, amend, merge or PR.

Exactly four files committed, 374 insertions and 3 deletions:

1. `src/proxy.ts`: segment-preserving normalization and route-specific reserved-action handling.
2. `src/lib/backend-phase6b.integration.test.ts`: three custom report-ID ownership cases, including read/mutation denials, owner-positive read and unchanged business snapshots.
3. `scripts/verify-phase6b1-http.mjs`: incremental isolated production HTTP release checks.
4. `docs/backend-phase6b1-release-readiness-report.md`: security/compatibility evidence and readiness limitations.

Preflight fetch with an explicit feature-branch refspec failed because a pre-existing local `refs/codex/turn-diffs/checkpoints/...` reference points to a bad object. No internal ref was deleted or repaired. Direct remote metadata showed the remote SHA equalled local `1d98baa` before commit, so there was no remote divergence to reconcile. The normal push then succeeded; direct post-push SHA equality verifies delivery independently of that fetch problem. Auto-maintenance/GC and push negotiation were disabled for the Git delivery commands, without changing repository configuration.

Staged file names, cached diff and `git diff --cached --check` were inspected before commit. `git show --stat` confirmed the final commit scope after push. No unexplained tracked edits remained. Existing Phase 6A/readiness/Phase 6B commits remain in ancestry; their transaction services, schemas, dependencies, role policy and frontend were not edited by 6B.1/6B.2.

Remaining local changes: this handoff report only for 6B.2, plus preserved unrelated untracked `.codex/`, `.mcp.json`, `DROP_IN_INSTRUCTIONS.txt`, `Sammy_Raimee_QA_Engineer_CV.pdf`, `automation/playwright/playwright-report/`, `automation/playwright/test-results/`, `automation/playwright/tests/ikf-web-068-qna-concurrent.spec.ts`, and `graphify-out/`. None was committed. No user database, recording, environment file or secret was modified.

## B. Security status

These are scoped findings and previously executed regressions, not full application security certification.

| Finding | Status in delivered candidate | Coverage reused |
|---|---|---|
| 6B-SCOPE — High | Fixed: project-required collections cannot borrow scope from one own ID | Cases/Bugs/Modules integration; prior production list disclosure regression |
| 6B-QUERY-BODY — High | Fixed: authorize every supplied query/body project and referenced mutation ID | Conflicting A-query/B-body creation and unchanged foreign-count checks |
| 6B-BODY — High | Fixed: fail-closed media type, malformed/non-object JSON and declared/streamed byte limit | Plain/oversize/streamed integration plus HTTP media rejection |
| 6B-PATH — High | Original encoded-CUID protection retained and strengthened | Encoded normal-ID denial, plus 6B.1 custom-ID negative/positive cases |
| 6B-EVIDENCE — High | Fixed: canonical IDs and project-owned run/recording/source lookup | Duplicate display-ID integration and own-marker/no-foreign-marker HTTP |
| 6B-MULTIPART — High | Fixed: Excel form project must match authorized query | Mismatch 400/no foreign mutation; own preview/import positive controls |
| 6B-MATCHER — conditional Medium | Fixed: explicit matcher protects filename-like API IDs | Actual production HTTP no-session 401; existing owner-positive check |
| 6B-ERROR — Low | Fixed in evidence route: generic unexpected-error response | Prior controlled error-marker injection regression |
| 6B1-PATH — conditional High | Fixed: encoded slash cannot authorize a prefix; `next-id`/`read-all` not globally exempt | Three integration cases; actual HTTP foreign GET/PATCH 403 with unchanged target, legitimate B-owner GET 200 |

Custom/legacy-ID findings require those valid unusual IDs to exist; ordinary generated CUIDs do not have those formats. Real historical prevalence was not inspected. No known unresolved High/Critical bypass remains in the reviewed/tested candidate; untested routes and infrastructure are not certified safe.

Phase 6A atomicity, Serializable guards, stale-write 409, retry timestamps, failed-retest bounce, successful verification and deterministic tie ordering remain unchanged. Existing 22-test evidence covers those guarantees. Phase 6B.1 HTTP also verifies lifecycle positives and a real project-relationship conflict 409, not a new HTTP race test. Offset pagination is not a snapshot under concurrent inserts/deletes, and server snapshot checks are not an HTTP If-Match contract.

## C. Validation and provenance

No production/test source changed in 6B.2. Required preflight checks found no invalidated test/build evidence, so no integration suite, HTTP suite, lint, typecheck or build was automatically repeated. New work in 6B.2 was Git inspection/delivery, source/evidence/package verification and this local runbook.

| Gate | Result | Evidence and phase |
|---|---|---|
| Diff review | PASS, new inspection | Exact local/cached proxy/test diff and all four committed files; `git diff --check` and cached check passed |
| Security regressions | PASS, reused | Phase 6B.1: 19 selected passed, 27 skipped of 46 collected; new slash/reserved-ID assertions are still present and unchanged |
| Phase 6A preservation | PASS, diff + reused evidence | Transaction/sync/error services untouched; prior 22 integration passes retained; Phase 6B1 HTTP READY/retest/409 positives |
| Earlier 6B/auth/readiness | PASS, reused | 43 Phase 6B integration checks and 12 auth/readiness unit checks from the recorded earlier phase, not newly executed |
| Lint | PASS, reused | Phase 6B.1 full lint exit 0; final helper cleanup separately linted; no subsequent source edits |
| Typecheck | PASS, reused | Phase 6B.1 full typecheck exit 0 after final source/test changes |
| Production build | PASS, reused + package reinspection | Isolated build `yo_57LWTvs_QAp6TriypM`; final source-input hash still matches; static/public assets and packaged FFmpeg present |
| Production HTTP smoke | PASS, reused and evidence re-read | `C:/Users/Admin/AppData/Local/Temp/qadesk-phase6b1-http-Yew7Vc/results.json`: 27/27, all results true, matching isolated build ID |
| Local/remote SHA parity | PASS, newly executed | Local and direct GitHub feature ref both `0deffe3b79648614e98f30dafc1be382aef16790` |

Current source-input provenance: 264 tracked non-test production `src` files plus `next.config.ts`, `package.json` and lockfile, hashing each relative path and raw file content in Git file-list order. SHA-256 in both the delivery checkout and isolated build workspace remains **`8ab99746241f79423e7a5140a2f746d04409548bab947284be67ed0e106215da`**, matching the final 6B.1 recorded value. This is source-input parity, not binary reproducibility or coverage of every environment variable/dependency. File newline differences across operating systems may change this raw-byte hash; record the Git commit/tree identity as the primary portable provenance.

Isolated build workspace: `C:/Users/Admin/.codex/worktrees/qadesk-phase2-baseline/QA-Web`. Package inspection confirmed `.next/static`, `public`, the platform FFmpeg binary under standalone, and absence of the four root `.env*` filenames removed by finalization. This narrow inspection is **not** a comprehensive secret scan of every compiled byte. Build secrets must be excluded by the release pipeline, especially browser-visible `NEXT_PUBLIC_*` settings.

Main application build remains **`SG3cqw3ttuk_5_z7f3xEs`**, which does **not** include the 6B.1 correction. It was not overwritten or started. No statement that the active user application is patched is made. Services on 3000/3001 were neither requested nor restarted/interrupted. No deployment, production smoke, migration, real-data access, Graphify analysis, broad audit or Phase 6C work occurred.

## D. Deployment prerequisites and artifact runbook

### D1. Resolve release decisions first

| Decision | Current classification | Required approval/evidence |
|---|---|---|
| Approved target and owner | NOT VERIFIED | Named host/environment, owner, maintenance window, OS/architecture and rollback decision-maker |
| Intended deployment database | UNKNOWN / NOT YET SPECIFIED | Local metadata confirms SQLite, not the future hosting choice |
| Current local database provider | SQLite | BOM-aware `.env` parsing emitted engine/presence only; no separate DevLog URL configured; main generated schema is SQLite |
| PostgreSQL acceptance | NOT TESTED | Mandatory live disposable tests if that provider is chosen |
| Historical evidence impact | NOT VERIFIED | Owner-approved read-only inventory/acceptance; no real historical records inspected here |
| Backup/restore rehearsal and recovery targets | NOT VERIFIED | Consistent backup, disposable restore proof, measured RPO/RTO |
| Target secrets/origin/TLS/storage/relay setup | NOT VERIFIED | Validate on approved target; do not copy current local settings blindly |
| Actual target smoke | NOT VERIFIED | Run only after deployment approval |

### D2. Produce an artifact from the exact final commit — instructions only

Use a **new isolated build checkout/CI job**, not the user's running/main checkout. Build on the intended target OS/architecture with supported Node (`>=20.9 <26`; prior verification used Node 24.19.0). Native Prisma engines, sharp and FFmpeg are platform-specific; the existing Windows artifact is not accepted as a Linux artifact.

Example commands, to be adapted by the approved release pipeline; none executed in this task:

```powershell
git clone --no-checkout --branch codex/frontend-design-system-motion-optimization https://github.com/Yoodaddy171/QA-Web.git <new-isolated-release-source>
Set-Location <new-isolated-release-source>
git checkout --detach 0deffe3b79648614e98f30dafc1be382aef16790
git rev-parse HEAD
npm ci --ignore-scripts
# Select exactly ONE provider generation below after supplying a disposable,
# build-only datasource through the CI environment. No production credentials.
npm run db:generate:sqlite
# OR, for approved PostgreSQL target: npm run db:generate:postgres
npm run build
```

`--ignore-scripts` avoids implicit default SQLite postinstall before the explicit provider choice. Explicit generation produces the main `@prisma/client` for `prisma/sqlite.prisma` or `prisma/schema.prisma` respectively, and the separate PostgreSQL `@prisma/devlog-client`. Any installation scripts needed for native tooling must be handled and validated by that target's build pipeline; do not assume an untested platform succeeded. For SQLite, provide an absolute `file:` URL to a disposable on-disk build database, never the user's DB. For PostgreSQL use only an approved disposable build/test datasource; do not use a production connection to satisfy a build.

`npm run build` runs `next build` followed by `scripts/finalize-standalone.mjs`. `output: standalone` is configured; finalization copies static assets to `.next/standalone/.next/static` and public assets to `.next/standalone/public`, and removes listed env/runtime/backup/test directories. Verify generated client provider, `server.js`, `.next/BUILD_ID`, proxy output via the isolated HTTP checks, static/public files and target FFmpeg executable. Preserve the **whole** standalone tree including hidden `.next` and traced `node_modules`, not just server.js. Do not bundle user DBs/logs/media or unreviewed config files.

Run the incremental harness in the build checkout against its final standalone artifact on an owned free 31xx port:

```powershell
node scripts/verify-phase6b1-http.mjs <absolute-standalone-root> 3117
```

This creates and cleans its own synthetic SQLite fixture; it is **not PostgreSQL acceptance** and cannot substitute for PostgreSQL tests when building the main client for PostgreSQL. For PostgreSQL releases, keep the SQLite regression job separate with its SQLite-generated client/artifact; validate the actual PostgreSQL artifact against a designated disposable PostgreSQL database and equivalent required checks before deployment. Do not point this SQLite-specific harness at a PostgreSQL-generated artifact and call its failure a production defect.

Record final Git commit/tree, Node/OS/architecture, selected Prisma provider, lockfile digest, build ID, build logs and redacted checks. Archive the finalized standalone tree and compute its SHA-256 (`Get-FileHash <artifact-archive> -Algorithm SHA256` on Windows, or equivalent CI native tooling). Store this release manifest outside the immutable archive or alongside it; compare checksums after transfer. Any rebuild/platform/provider change requires validation of that resulting artifact, not blind reuse of the Windows build ID.

### D3. Runtime configuration and startup

Inject runtime environment through the deployment secret mechanism; do not check in or bake secrets into client bundles. Set:

- `DATABASE_URL`: correct absolute persisted SQLite `file:` path or approved PostgreSQL URL; matches the generated main client.
- `POSTGRES_DATABASE_URL`: only if using the separate DevLog database; otherwise leave unset to read DevLog from the main SQLite client. If used, its Project/entity IDs and ownership must correspond to the main DB.
- `APP_URL`, narrowly allowlisted `QA_ALLOWED_ORIGINS`, `QA_COOKIE_SECURE=1` for approved HTTPS. Ensure trusted proxy Host/origin settings and edge/TLS policies. Local insecure cookies are not a production default.
- Explicit absolute `QA_RUNTIME_DIR` and `QA_EVIDENCE_STORAGE_DIR`; set quotas/permissions for the approved deployment.
- `HOSTNAME`/`PORT`: approved service bind address/port, normally behind the trusted reverse proxy. These instructions do not authorize changing current ports.
- Host provider keys/bootstrap/relay credentials only as required, without printing them. Do not bootstrap/reset existing accounts during deployment. Remove temporary bootstrap credentials after a separately approved first-owner setup.

A direct standalone runtime starts `node server.js` from the artifact root with environment already injected. The repository's local `npm start` wrapper requires a local `.env`, resolves SQLite paths relative to `<repo>/prisma`, and imports `.next/standalone/server.js`; do not transplant that relative-path behavior into a new layout without explicitly resolving it. Neither startup path automatically applies database migrations. No schema migration is introduced by this patch.

Manual-capture relay is a separate service, not assumed complete just because Next standalone built. If enabled, package the required `mini-services` code/dependencies from the same commit, configure an authenticated relay/token and approved origin/host consistently, then verify relay/browser/FFmpeg behavior in the target environment. That separate runtime/browser acceptance remains outstanding. Never publish an unauthenticated relay to work around setup problems.

### D4. Storage inventory and legacy compatibility checklist

| Data/path relationship | Accessible/required behavior | Release check |
|---|---|---|
| Business DB | Absolute SQLite file or approved PostgreSQL DB; all entities/project/workspace links | Resolve actual service datasource privately; do not infer it from cwd |
| AutomationRun/DevLog | Canonical internal record ID and correct non-null projectId | Main DB fallback or separate DevLog DB; compare authoritative ownership IDs |
| Bug source | Source internal ID must exist in same project | Reject mismatched/orphan relationship; do not re-home records automatically |
| Recording rows | Canonical internal ID, matching run.projectId, valid mediaRoot | Persist and mount original media at expected location or separately migrate with approval |
| Current recordings | `<QA_RUNTIME_DIR>/recordings/<encoded-internal-ID>/<session>/...` | Persistent volume shared consistently with authorized producers/readers |
| Execution attachments | Explicit `QA_EVIDENCE_STORAGE_DIR`; stored keys relative to this root | Read/write access, quotas and parent execution/run ownership |
| Legacy HTML-evidence logs | `<actual-evidence-route-cwd>/mini-services/logs/<encoded-internal-ID>.current.jsonl` | Persistent mount at the route's real cwd-based location |
| Legacy recordings | `<actual-evidence-route-cwd>/mini-services/recordings/<encoded-internal-ID>/...` | Mount media separately; do not put private files in immutable artifact |
| Relay logs | `QA_RELAY_LOGS_DIR` or `<relay-script-dir>/logs` | If legacy HTML fallback is needed, map this deliberately to the route's expected directory |
| Historical display-ID-only/null-owned data | May no longer resolve; intentionally blocked as ambiguous | Real-data impact NOT VERIFIED; separate owner-approved inventory/migration only |

Internal IDs are opaque canonical IDs (often CUIDs, not necessarily RFC UUID strings). Display-ID requests may still resolve a current record in its authorized project; the display string is no longer an unrestricted telemetry key. Record/source internal IDs with correct ownership remain supported. The HTML evidence route does **not** honor `QA_LEGACY_LOGS_DIR`/`QA_LEGACY_RECORDINGS_DIR` just because the startup wrapper sets them. Validate actual mounts/cwd rather than assuming these overrides work there.

Recovery of historical display-ID-only data requires independently proven at-capture ownership, a dry-run mapping manifest, backups, transaction/idempotency/uniqueness validation on a clone, owner-positive/foreign-negative tests, reversible file copies and rollback mapping. Ambiguous rows stay quarantined; current display-ID uniqueness after resequence/delete is not proof. Do not restore the insecure fallback, run the existing orphan-allowing import as a blind repair, rewrite IDs or delete history. No migration or real-data inventory was performed.

## E. Backup, rollback and future deployment smoke

### E1. Operational backup and disposable restore runbook — not executed

1. Release owner identifies exact business DB, separate DevLog DB (if any), attachment root, current/legacy recording roots, relay/legacy log roots, service configuration references and encryption keys. Keep actual secret values in the approved vault, not this report. Confirm maintenance approval, write owners and RPO/RTO.
2. In the approved maintenance window, stop/quiesce **all** app/relay/import/automation writers and prevent them restarting during the snapshot. No services were stopped here. For SQLite, checkpoint/backup with a trusted SQLite-native backup operation or verified quiesced checkpoint-and-copy; account for `.db`, `-wal`, `-shm` state. Do not copy only a live DB and assume consistency. The repository `db:backup` helper checkpoints then copies, so external write quiescence remains necessary.
3. For a selected PostgreSQL deployment, use compatible `pg_dump --format=custom --no-owner` tooling against each approved DB with secrets injected via secure environment/service settings, not command-line URLs/history. If main and DevLog databases are separate, coordinate a write-quiesced consistency point. Capture needed roles/extensions/config separately under approved controls; a single DB dump does not back up filesystem media.
4. Snapshot/copy every media/log root consistently with the DB backups; preserve original paths and checksums. Use encrypted, restricted storage outside the application volume and a second failure domain. Save manifests (size, SHA-256, timestamp, provider, release SHA, storage mapping); test checksum/readability.
5. Restore backups into **fresh disposable targets**, never over the real database. SQLite: restore a closed copy with no stale target WAL/SHM; run integrity/foreign-key checks and inspect canonical ownership/lifecycle rows. PostgreSQL: restore into a fresh restricted database, validate compatible schema/constraints and compare representative counts/relationships. Use a separate artifact configured only for the clone and isolated test storage.
6. Run authorized read/evidence/media smoke and foreign-negative checks on the clone, verify Bug/Testcase lifecycle consistency and attachment/recording checksums. Record measured recovery duration, completeness, failures and explicit owner sign-off. Until this succeeds in the intended environment, **rollback/restore readiness is NOT VERIFIED**.

The existing restore helper requires explicit confirmation and validates the SHA-256 sidecar, but PostgreSQL uses destructive clean/restore semantics and SQLite replaces files. Do not run it with ambient real-target environment just for rehearsal. In all cases positively verify resolved disposable targets and use least-privilege credentials. No production backup/restore command was executed in 6B.2.

### E2. Code rollback is separate from data restore

- No schema change here: deploying/replacing code alone does not require restoring the DB.
- Never roll an exposed service back to `a5444eb` or bare `1d98baa`, which reopens known cross-workspace vulnerabilities. Prefer a verified forward fix or a previously approved artifact with equivalent protections. If none exists, use controlled maintenance/network isolation under owner approval.
- Keep last-known **secure** artifact/checksum/config manifest and rehearse target-specific activation/reversion before claiming readiness. Do not infer a safe artifact exists merely from earlier release tags.
- Restore data only for an identified corruption/integrity incident and with separate approval. Reconcile post-backup legitimate writes, recordings and audit history; choose a consistent DB/media recovery point and record data loss/RPO. Avoid reverting valid changes just to undo code.

### E3. Compact post-deployment smoke plan — approval required before execution

Use freshly generated synthetic A/B workspaces and isolated VIEWER/QA/QA_LEAD/OWNER identities; verify memberships before requests. Expected denials must include no foreign content and unchanged persistence/history, not status alone. Clean only fixture-owned records after collecting redacted evidence.

| Area | Future controlled check | Expected result |
|---|---|---|
| Auth/session | Valid login; invalid/expired session; logout then reuse cookie; current workspace role | Correct identity/role; invalid/expired/revoked session 401 |
| Normal reads | Own projects/Cases/Bugs/report/Test Run | Authorized content only, response/pagination contracts retained |
| Workspace isolation | Foreign project read and mutation; conflicting project selectors | 403/404 policy-appropriate denial; no foreign data or side effects |
| Custom report paths | Encoded slash/prefix and `next-id`/`read-all` fixtures; ordinary encoded ID; owner positives | Foreign GET/PATCH 403, owner 200, target unchanged after denial |
| Matcher/body | No-session filename-like ID; malformed/unsupported/oversized JSON; missing scope | Authentication required; controlled 400/413/415 as applicable; no writes |
| Lifecycle | Case update, Bug READY TO RETEST, successful retest | Source/Bug/history change consistently; successful retest verifies Bug |
| Conflict/atomicity | Controlled stale request and synthetic injected failure in an approved disposable clone | 409/reload on stale decision; no partial Bug/Testcase/history on failed transaction. Never install failure triggers on real user data |
| Reports/roles | Read, QA finalize negative, QA_LEAD finalize positive | Existing role hierarchy retained |
| Execution | Own Test Run execution update; wrong-parent execution/evidence | Allowed own update; wrong parent denied |
| Excel | Own preview/import; foreign form/query mismatch | 200/201 own import with exact read-back count; mismatch 400 with no side effects |
| Evidence/recordings/DevLog | Canonical own record/source, duplicate display IDs across workspaces, mounted media | Own evidence visible, no foreign logs/media, historical ambiguity not guessed |
| Runtime readiness | `/api/readiness`, FFmpeg path/execution and relay if enabled | Actual target readiness verified; no secret/log dump; browser manual-capture separately accepted |

The shipped `verify-phase6b1-http.mjs` safely validates its own disposable local SQLite server; it is not a switch to run mutations against arbitrary production origins. Target smoke requires a separately approved safe fixture procedure and explicit target identity. None of these deployment smoke steps was executed here.

## F. Outstanding risks and final verdict

**FEATURE BRANCH DELIVERY COMPLETE.** Corrected source is version-controlled and the remote feature ref matches local HEAD. Ready for **controlled deployment review**, not automatic deployment.

Outstanding deployment gates:

- Approved target/provider/OS/architecture and release owner: NOT VERIFIED.
- PostgreSQL live rollback/Serializable stale-write/409/unique-FK/pagination/authorization/main-DevLog verification: NOT TESTED; mandatory if PostgreSQL selected. SQLite local acceptance does not block feature delivery for an optional future provider.
- Historical evidence population impact and owner acceptance/recovery mapping: NOT VERIFIED.
- Backup/restore rehearsal, recovery timing and a safe rollback artifact: NOT VERIFIED.
- Target TLS/origin/Host/cookie/secrets/storage/relay configuration and platform-specific artifact validation: NOT VERIFIED.
- Actual approved-deployment smoke: NOT VERIFIED.
- Known follow-ups remain as documented: some nested invalid inputs return 500 despite rollback; universal run/report unexpected-error sanitization, reverse-proxy behavior and unreviewed endpoints were not certified in this scope.
- Local internal Codex checkpoint ref remains broken for fetch; no ref repair attempted. It did not prevent verified normal feature-branch delivery.

No unresolved required Git-delivery blocker remains. This local report does not itself approve a PR, merge, deployment, service restart, data migration or Phase 6C work.
