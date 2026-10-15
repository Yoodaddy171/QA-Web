# Phase 6B.1 — Security patch final review and release preparation

Date: 15 October 2026. Review scope: Phase 6B API authorization, representative legitimate QA workflows, legacy evidence compatibility and controlled-release preparation. No production deployment occurred.

## A. Executive verdict

**READY WITH LIMITATIONS** for feature-branch review of the Phase 6B patch **plus the uncommitted Phase 6B.1 correction**. The existing remote commit alone is not the final reviewed release candidate.

Actual branch: `codex/frontend-design-system-motion-optimization`. HEAD at entry and completion: `1d98baa9a1865b087ed238558d97f6b85606d0f0`. Phase 6B comparison base: `a5444eb4b235c1a6e4f11637615016bc7960d49f`. Contrary to the original prompt's stale premise, the nine-file Phase 6B patch had already been committed and pushed with separate user approval. Historical statements in the 6A/6B reports describe those assessments, not current Git delivery state.

Final review found **6B1-PATH, High with custom/legacy-ID preconditions**: two related ownership-resolution gaps remained for dynamic report IDs. Both were reproduced against the actual production HTTP stack using synthetic records, then corrected locally. No known unresolved High regression remains in this reviewed scope after the correction. This is not whole-application security certification or blanket production approval.

New final evidence: **19 selected integration tests passed (27 deliberately skipped), 27/27 incremental production HTTP checks passed, full lint and typecheck passed, isolated production build passed**. Existing comprehensive 6B/6A results are reused where code and invariants were unchanged; they were not all rerun.

## B. Exact diff and logic review

The committed `a5444eb..1d98baa` diff contains exactly the expected nine files: 806 insertions and 27 deletions. No unexpected tracked file is present in that commit.

| File inspected | Review outcome |
|---|---|
| `src/proxy.ts` | Session/role/origin enforcement, all project selectors, body guard, direct IDs, nested paths, matcher and trusted headers reviewed. Additional custom-ID correction required, described below. |
| `src/app/api/testcases/route.ts` | One Phase 6B GET project guard; normal filter/count/order contracts retained. POST/PUT/PATCH inspected against proxy inputs. Phase 6A mutations unchanged by 6B/6B.1. |
| `src/app/api/bugfix/route.ts` | One GET project guard; atomic status service/error mapping retained. |
| `src/app/api/evidence/route.ts` | Authorized record resolution, canonical candidate IDs, project-filtered database telemetry/recordings, filesystem fallback and generic 500 reviewed. |
| `src/app/api/excel/route.ts` | Multipart query/form equality precedes workbook processing and notification assignment. Own preview/import contracts remain usable. |
| `src/lib/backend-phase6b.integration.test.ts` | Real disposable SQLite, explicit actor memberships, proxy-to-handler adapter and before/after business snapshots reviewed. Extended with three custom-ID cases. |
| `scripts/phase6b-fixture.mjs` | Generated A/A2/B resources and role/session fixtures. No app database import; caller supplies explicit test client. |
| `scripts/verify-phase6b-http.mjs` | Owned 31xx preflight, explicit temporary datasource, actual Next HTTP requests, redacted results and owned-process cleanup reviewed; unchanged. |
| `docs/backend-phase6b-security-authorization-report.md` | Findings, role policy, test provenance, compatibility tradeoff and limitations reviewed; unchanged historical report. |

Related source reviewed: auth/session helpers, DB/devlog client selection, report read/update/finalize service and routes, run assignment/execution services, nested evidence routes, devlog persistence/import, Prisma provider metadata, startup/standalone packaging, backup/restore scripts and deployment/authentication documentation.

### Confirmed additional finding: 6B1-PATH

Severity: **High, conditional on valid custom/legacy report IDs**. Confidence: High. Actor: QA in workspace A only; target: persisted report in workspace B; owner positive control: OWNER in B only. Ordinary generated CUIDs do not contain separators and are not `next-id`/`read-all`; no claim is made that normal CUID requests have this bypass.

1. **Encoded separator:** create a synthetic B report whose ID is `<existing-A-report-id>/foreign`. Request `GET /api/reports/<A-report-id>%2Fforeign` as A. Old proxy decoded and joined the entire path, then split it again: it authorized A's prefix ID. Next passed the entire decoded dynamic ID to the handler, which read B. PATCH of the same resource also changed B's persisted author. B's actual owner was incorrectly denied because the proxy checked A's prefix.
2. **Globally reserved ID words:** create B reports with valid custom IDs `next-id` and `read-all`. Request each under `/api/reports/<ID>?projectId=<A>`. Proxy globally excluded those words from resource lookup, accepted the A query, and the report handler read/updated B. Without the A query, B's legitimate owner received missing-scope 400.

Expected: deny A's reads/mutations, return no B content, preserve B's records, allow B owner reads. Baseline HTTP returned 200 for all three foreign reads and mutations; persisted changes were verified. Read-only separator reproduction was observed in two earlier bounded runs; the final focused baseline reproduced all variants in one disposable fixture (0/9 expected-security checks passed). This does not establish their presence in real historical data.

Fix in `src/proxy.ts`: normalize each segment with decode/re-encode before routing comparisons; decode individual resource segments only after splitting, preserving an encoded slash inside a single ID. Restrict the `read-all` action exception to `notifications/read-all`; do not exclude arbitrary words on other dynamic resources. All referenced project memberships still require their actual minimum role. No UUID, schema or business permission changed.

Final HTTP: all three foreign reads/mutations return 403 with unchanged target records; all three owner reads return 200. Integration verifies denied reads, denied PATCH, permitted owner read and complete snapshot equality. Encoded ordinary IDs, malformed bodies, role/finalize gates and nested-resource controls were included in selected regressions. Malformed-path rejection was statically reviewed, not separately exercised in the new HTTP smoke.

### Phase 6B.1 changes only

- `src/proxy.ts`: small correction above, the only production source change.
- `src/lib/backend-phase6b.integration.test.ts`: three parameterized 6B1-PATH regressions using existing isolated fixture conventions.
- `scripts/verify-phase6b1-http.mjs`: incremental HTTP release/compatibility checks; `--paths-only` supports focused custom-ID reproduction. Temporary data, generated credentials, owned 31xx process, bounded waits and checked cleanup paths only.
- This report.

The original nine-file Phase 6B commit remains intact. These four working-tree files are the separately reviewable 6B.1 delta, not an assertion that the combined release still has only nine changed files. No staging, commit, push, PR, merge, schema/dependency/environment edit or Graphify operation was performed in 6B.1. Unrelated untracked artifacts remain untouched, including `.codex/`, `.mcp.json`, CV/instructions files, existing Playwright artifacts/test and `graphify-out/`.

## C. Security verification

PASS below means the reviewed invariant, not every possible API route or payload.

| Original finding | Final outcome | Basis |
|---|---|---|
| 6B-SCOPE — High | PASS | Cases/Bugs GET require explicit project; Modules proxy guard retained. Own ID cannot unlock global collection. Handler guards remain even if proxy execution is adapted in tests. Existing regression evidence reused. |
| 6B-QUERY-BODY — High | PASS | All supplied query project values plus string JSON project authorized independently, as are resolved existing mutation IDs. Foreign query/body combination blocked. No stronger role borrowed from another workspace. |
| 6B-BODY — High | PASS | Unsupported JSON media 415, malformed/non-object JSON 400, declared/actual streamed size over 1,000,000 bytes 413. Only real multipart routes bypass JSON parsing. Selected guard regressions rerun; original size-bound evidence reused. |
| 6B-PATH — High | PASS after 6B.1 | Original percent-encoded CUID fix retained; additional separator/reserved-word variants reproduced and corrected. Actual Next HTTP negative and owner-positive controls passed. |
| 6B-EVIDENCE — High | PASS | Record must belong to authorized project; source ID confirmed same project; DB run/recording project predicates and canonical file keys retained. New HTTP contains own marker, not B marker. Trusted filesystem and stored media metadata are assumptions, not a filesystem-ACL audit. |
| 6B-MULTIPART — High | PASS | Form project exactly matches authorized query. New HTTP mismatch 400 and foreign delta 0; valid own preview 200 and import 201 with exactly one persisted row. |
| 6B-MATCHER — conditional Medium | PASS | Explicit `/api/:path*` matcher remains; unauthenticated valid filename-like report ID returns 401 in final HTTP smoke. |
| 6B-ERROR — Low | PASS | Evidence catches unexpected errors with generic response, no raw exception message. Prior fault-injection proof reused; no new production fault induced. This does not certify error sanitization across all other routes. |

Mandatory questions: unscoped collections are blocked; supplied project selectors are authorized; ID normalization now preserves dynamic-ID boundaries; unsupported/malformed/oversized bodies fail closed; reviewed child handlers constrain exact run/execution/evidence chain; all API suffixes match authentication; denied mutations preserve tested state; evidence errors are generic; representative valid contracts passed. Authorization-versus-concurrent ownership transfer remains outside these guarantees, as already documented in 6B.

### HTTP response classification

401/403/404 ownership distinctions, body 400/413/415 and Phase 6A 409 mappings were reviewed. The new HTTP smoke verifies a real 409 from an intentionally project-mismatched Bug/source relationship and unchanged Bug; this is **not** a fresh HTTP concurrency/stale-read race test. Existing deterministic Phase 6A race tests remain the stale-write evidence.

Nested foreign-child assignment/bulk execution still throws the known generic domain validation error, which routes classify as 500. The service checks all requested children inside a transaction before any write; prior complete snapshot regressions showed rollback/no partial effects, and selected nested checks passed again. This is safe denial for those tested inputs, but poor classification. Mapping domain validation to 400/404 and sanitizing unexpected errors in those pre-existing handlers should be a separate narrow follow-up; no broad error refactor was introduced. Unexpected-error sanitization on every run/report route is **NOT VERIFIED** by this release review. Do not label all existing 500 bodies safe solely from the evidence-route fix.

## D. Regression evidence and provenance

### Reused, not newly executed as complete suites

- Phase 6B: 43/43 integration tests from its report.
- Phase 6A: 22/22 integration tests, including trigger-based rollback, deterministic races, retry timestamps, failed-retest bounce, bulk effects and pagination.
- Auth/readiness: 12/12 unit checks across four files.
- Prior production HTTP: 17/17, build `Mv4I7J4UCd7DHGHjhfNwu`, retained `C:/Users/Admin/AppData/Local/Temp/qadesk-phase6b-http-QYsbfl/results.json` (file re-read during this review).
- Previous user-approved main build: `SG3cqw3ttuk_5_z7f3xEs`, successful in the preceding delivery turn. This old build was used for the synthetic pre-fix HTTP reproduction, not represented as containing the new 6B.1 fix.

### Newly executed in 6B.1

| Check | Result and scope |
|---|---|
| Targeted integration | `npm run test:integration -- src/lib/backend-phase6b.integration.test.ts -t '6B1-PATH\|6B-PATH\|6B-GUARD\|6B-NESTED\|6B-RBAC'`: **19 passed, 27 skipped** out of 46 collected. Not a claim all 46 ran. |
| New paths-only baseline | **0/9 security expectations**, old build `SG3cqw3ttuk_5_z7f3xEs`; intentional failing proof, not release success. |
| Final incremental HTTP | **27/27**, fresh synthetic on-disk SQLite, owned port 3117, actual production Next server. Custom-ID controls, filename matcher, cross-workspace read/mutation, projects, testcase GET/POST/PUT, Bugs GET/PUT, READY sync, successful retest, execution PUT, relationship 409, report finalize, Excel preview/import/mismatch, evidence, real login/logout. |
| Full lint | `npm run lint`: exit 0, no errors/warnings. Final helper cleanup edit separately checked with `npx eslint scripts/verify-phase6b1-http.mjs`. |
| Full typecheck | `npm run typecheck`: exit 0 after final production/test changes. |
| Production build | `npm run build` in owned isolated build workspace: exit 0, build **`yo_57LWTvs_QAp6TriypM`**, including TypeScript, 37 static pages and standalone finalization. Explicit disposable build-only SQLite URL; no user `.env` or DB. |
| Diff hygiene | `git diff --check`; no unrelated changes staged. |

Evidence files (redacted status/boolean summaries, no credentials):

- Baseline all path variants: `C:/Users/Admin/AppData/Local/Temp/qadesk-phase6b1-http-DUyFR7/results.json`.
- Final fixed HTTP: `C:/Users/Admin/AppData/Local/Temp/qadesk-phase6b1-http-Yew7Vc/results.json`.
- Earlier separator-only compatibility run: `qadesk-phase6b1-http-zY6UTG/results.json` under the same Temp directory, 18/21; all three failures were the custom separator ownership bug.

The first new harness setup copied an existing report's unique document/version combination and failed with P2002 before HTTP execution. Fixture versions were made unique; this was a test setup defect, not application security evidence. A later new integration run deliberately failed for `next-id`/`read-all` before their fix. Intermediate 21/21 HTTP on the separator-only correction was superseded by the final 27/27 after both variants were fixed. Reruns were bounded and justified by those concrete changes, not repeated full 6B acceptance matrices.

All synthetic HTTP processes/databases/accounts/session data were cleaned up; only redacted results remain. No requests or process interruption on 3000/3001. Main build stays at `SG3cqw3ttuk_5_z7f3xEs`; deploying 6B.1 requires the new artifact or a fresh approved build, not starting that old main artifact.

Final source parity check: 264 tracked non-test production `src` files plus Next/package configuration, SHA-256 `8ab99746241f79423e7a5140a2f746d04409548bab947284be67ed0e106215da`, equal in the main checkout and the isolated build workspace. This is source-input parity, not a byte-for-byte reproducible-build claim. Final listener check showed no owned test server left on 3117; 3000/3001 were also not listening and were never stopped by this phase.

No UI/browser acceptance, Phase 4/5 benchmarks, full frontend E2E, external scan, load test or PostgreSQL test was run. Existing Phase 5B/frontend files and Phase 6A transaction services are unchanged in the committed patch and current correction; preservation is verified by diff, not fresh UI/performance results.

## E. Legacy Evidence compatibility

This review inspected storage/lookup code, **not real user records or recording contents**. Population-level historical impact cannot be established from repository code alone.

| Identifier/storage | Current behavior |
|---|---|
| Request testcase internal ID or project-local display ID | Both resolve a record constrained to the authorized project. Display input does not become a telemetry/file key. |
| Request Bug internal ID, display ID or source testcase ID | Existing project-scoped record resolution remains; testcase match takes precedence. A Bug source is included as a telemetry key only after same-project confirmation. |
| DB AutomationRun keyed by internal record ID, correct non-null projectId | Supported. Latest matching run selected; its events adapted into evidence. |
| DB Recording keyed by internal ID, correct parent run.projectId | Supported, with media read from its stored mediaRoot. |
| Files keyed by internal record/source ID | Supported fallback where actually mounted: `<cwd>/mini-services/logs/<encoded-ID>.current.jsonl`; recording metadata under `<QA_RUNTIME_DIR>/recordings/<encoded-ID>/<session>/metadata.json` or `<cwd>/mini-services/recordings/...`. Media must exist. |
| Display-ID-only DB/file telemetry, null/wrong run.projectId | Intentionally not guessed. Even an otherwise authorized historical record may lose this telemetry in generated HTML. No deletion occurred. |
| Nested TestExecutionEvidence attachments | Separate execution/parent-scoped API/storage path, not selected through the removed display-ID fallback. |

Internal IDs are opaque database IDs (commonly CUIDs), not necessarily RFC UUID strings. The patch does not rewrite them. The evidence route's legacy filesystem constants are cwd-based; it does not read the startup wrapper's `QA_LEGACY_LOGS_DIR`/`QA_LEGACY_RECORDINGS_DIR` overrides. A deployment must not assume those variables alone mount old HTML-evidence files correctly. This pre-existing path limitation is documented, not changed here.

The devlog store resolves current ownership by internal testcase/Bug ID. The existing import helper permits orphan runs; simply running it is **not** an ownership-aware repair for old display-ID data. Current display-ID uniqueness is insufficient proof of historical ownership after delete/resequence/reuse.

### Proposed recovery only — no migration executed

1. Obtain owner approval and inventory on a read-only backup: DB runs/events/recordings, canonical entity/source/project links, metadata and file checksums. Do not dump secrets into a report.
2. Produce a dry-run manifest mapping each legacy key/session/run to exactly one internal record and project, supported by authoritative at-capture metadata or independently validated history. Reject ambiguous, orphaned, conflicting and cross-project mappings; quarantine for owner review.
3. Back up business DB, separate devlog DB if used, and all media/log roots together under a write-quiesced window. Verify checksum/restore on a disposable clone first.
4. On the clone, update run.projectId, run/event/recording keys and any runKey/recording uniqueness constraints consistently in transactions; copy media to canonical keys, retaining originals and checksummed reverse mappings. Do not change entity IDs or restore a global display-ID search.
5. Test owner-positive and foreign-negative evidence for duplicate display IDs, historical resequences, Bugs/sources, orphan projects, missing media and repeat migration. Require idempotence and explicit per-item audit/approval before real execution.
6. Roll back DB changes via validated manifest/transaction backup and remove only newly copied media; preserve original files. Never infer mappings just because a single current testcase happens to match a display string.

No schema migration is needed for 6B/6B.1. Legacy recovery is conditional and separately authorized; unknown historical impact must be accepted or investigated before release to affected users.

## F. Deployment preparation and release gates

### Database target

BOM-aware environment parsing emitted only engine/presence metadata: this local configuration is **SQLite**, with no separate PostgreSQL devlog URL. Generated main Prisma provider is SQLite; default install/generation scripts select SQLite. Compose provides a loopback-bound development PostgreSQL service, and migration docs describe a **future/optional PostgreSQL deployment**. These do not prove production uses PostgreSQL. The final deployment destination/engine has not been independently specified.

**PostgreSQL acceptance: NOT TESTED.** No designated disposable PostgreSQL environment was available; no local 5432 listener or docker/pg_isready command was found. No attempt was made to connect to any real external DB. Before a PostgreSQL release, generate the correct main client and verify live transaction rollback, Serializable same/opposing/stale writes, actual 409 error mapping, pagination ties/directions, workspace predicates, unique/foreign keys and devlog/main ownership consistency. Do not infer these from SQLite passes or schema validity alone.

### Required configuration and artifact

- Declare approved target, database engine, data retention/RPO and responsible release owner. Use a supported Node version per package engines (`>=20.9 <26`; current test runtime Node 24.19.0).
- Inject DATABASE_URL and, only when actually used, POSTGRES_DATABASE_URL securely. Generate/build the main Prisma client for the chosen provider; do not run a SQLite-generated client against PostgreSQL.
- Set canonical APP_URL, narrow QA_ALLOWED_ORIGINS and secure cookies for HTTPS (`QA_COOKIE_SECURE=1`); use local cookie settings only for loopback HTTP. Verify proxy Host/origin handling in the approved deployment, not by trusting arbitrary forwarded headers.
- Keep runtime/evidence volumes persistent and access-restricted; ensure the actual legacy lookup paths described above are mounted if needed. Verify FFmpeg/readiness in the target runtime. Configure authenticated relay token consistently if manual capture is enabled; never expose unauthenticated relay services.
- Keep bootstrap/provider/DB secrets out of artifacts, logs and source control. Bootstrap only with explicit first-owner setup policy; remove bootstrap credentials after use. No secret values are included here and no `.env` was changed.
- Package the corrected source, not merely commit `1d98baa`. Record commit/artifact hash and smoke results. The final isolated artifact was built from source-equivalent production files, but has not been installed into the main runtime.

### Backup and rollback preparation (not executed)

Before release, quiesce app/relay/import writers in an approved window; back up the correct resolved DB and all media/log roots, plus any separate devlog DB. For SQLite account for WAL/checkpoint consistency; do not casually copy only a live `.db`. The repository backup helper checkpoints then copies: release owners must still arrange write quiescence and verify the manifest on a disposable restore. For PostgreSQL use a compatible pg_dump/pg_restore workflow and validate role/schema/ownership. Record checksums, tested restore steps and recovery time.

There is no schema change, so code rollback does not itself require data rollback. **Do not roll an exposed deployment back to `a5444eb` or bare `1d98baa`: known authorization gaps would reopen.** Prefer forward correction or maintenance/network isolation until a vetted artifact with equivalent guards is available. Restore data only if necessary, explicitly approved, and reconciled with legitimate writes after the backup; keep new recordings and audit history safe. No rollback drill or production backup was performed in this task.

### Post-deployment smoke, after approval only

On the approved environment using synthetic accounts/resources: verify login/logout/revoked cookie, own project listing, own testcase create/update and READY-to-successful-retest synchronization, report read/finalize role, execution update, own evidence, Excel preview/import. Verify foreign read/mutation denial including all custom-ID variants, missing scope/body guards, filename-like API auth, multipart mismatch and no persisted foreign changes. Confirm representative 409/reload behavior, System Readiness/FFmpeg, mounts and relay status if enabled. Remove synthetic data safely and retain only redacted evidence. This list is preparation, not a claim these target-environment checks already ran.

### Individual readiness checklist

| Item | Status | Qualification |
|---|---|---|
| Phase 6B diff reviewed | PASS | Exact nine-file committed diff plus separately identified 6B.1 delta. |
| All six original High findings remain fixed | PASS | Path fix strengthened; new variants closed in local candidate. |
| No known new cross-workspace bypass in reviewed candidate | PASS | One conditional High finding discovered and fixed; not a global guarantee. |
| Representative legitimate QA workflows preserved | PASS | New HTTP positives and selected role/nested regressions; no browser acceptance claim. |
| Phase 6A data-integrity guarantees preserved | PASS | Services unchanged, existing 22-test evidence reused, relevant new lifecycle/409 HTTP controls. |
| Existing frontend Phase 5B changes preserved | PASS | Diff preservation only. |
| Evidence compatibility impact documented | PASS | Lookup matrix and ownership-aware recovery proposal. |
| Historical evidence population impact accepted/verified | NOT VERIFIED | No real records inspected; owner assessment outstanding. |
| Production build verified | PASS | Final isolated build, not a main-runtime installation. |
| Relevant HTTP smoke verified | PASS | Final 27/27, actual production stack, disposable SQLite. |
| Database compatibility limitations documented | PASS | SQLite current; PostgreSQL NOT TESTED. |
| Live PostgreSQL acceptance | NOT VERIFIED | Required if PostgreSQL chosen as release target. |
| Migration requirements identified | PASS | No schema change; conditional evidence recovery requires separate approval. |
| Secrets/environment untouched | PASS | No .env or secret changes; redacted metadata only. |
| Unrelated work excluded | PASS | Unstaged/unmodified; no Graphify analysis. |
| Deployment rollback considerations documented | PASS | No unsafe rollback to known-vulnerable artifact. |
| Approved target, backup/restore rehearsal and deployment smoke | NOT VERIFIED | Release-owner gates remain; no deployment authorized/performed. |

No FAIL remains in the final executed checks. NOT VERIFIED items are not silently counted as PASS.

## G. Separate approval recommendations

1. **Commit to feature branch:** ready for approval/review of these four files. No commit or staging performed in 6B.1.
2. **Push feature branch:** ready after reviewed commit and explicit approval; existing remote `1d98baa` does not include the new correction.
3. **Propose merge:** technically ready for focused reviewer consideration with the conditional-ID finding and evidence compatibility tradeoff explicit. Creating a PR/merging still requires approval; neither was done.
4. **Deploy to approved environment:** conditional, not automatic. Identify target/provider, include the corrected artifact, complete backup/restore preparation, accept/investigate legacy evidence impact, and run target smoke. PostgreSQL requires its missing live verification first. No production deployment approval is implied.

Stop point reached: focused review complete, discovered conditional High corrected and directly retested, report/compatibility/release caveats documented. No Phase 6C, unrelated API expansion, performance acceptance cycle or infrastructure change undertaken.
