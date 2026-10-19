# Phase 7 — End-to-end functional acceptance

Date: **16 October 2026 (Asia/Bangkok)**. Local, synthetic-only acceptance. No Git delivery or deployment.

## A. Executive verdict

**PASSED WITH LIMITATIONS for the selected core workflows.** All selected gates and owned-environment cleanup completed. Twelve distinct browser scenarios have passing outcomes across the bounded initial and targeted retest passes; this is **not a single clean 12-test run on one build**, nor a whole-product correctness certification.

Five High functional defects were confirmed and fixed with small client-contract corrections. No Critical defect or known unresolved High remains in the executed scope after retest. A QA engineer can create/edit a testcase, execute a cycle, attach evidence, create/fix a Bug, retest through inventory testcase controls, verify the Bug, and create/finalize an execution-based report.

Important actual product semantics: **TestExecution outcome is separate from inventory TestCase status**. Pass/Fail creates historical execution data and updates run membership; contextual Create Bug synchronizes a failed execution into inventory/Bug. Successful or failed Bug retest is driven by inventory testcase status/result. Clicking Pass in a cycle alone does not verify an existing Bug. Test Plans link requirements, requirements link testcases, and run membership is explicitly assigned. No new automatic synchronization or invented plan semantics was introduced.

## B. Environment, provenance and safety

- Branch `codex/frontend-design-system-motion-optimization`; HEAD unchanged at `0deffe3b79648614e98f30dafc1be382aef16790`.
- Windows laptop, Node v24.19.0, Next 16.2.4, Prisma 6.19.3 / SQLite 3.46.0. Chromium **149.0.7827.55**, desktop **1440×900**, one Playwright worker, zero automatic retries. Browser plugin unavailable; existing Playwright dependency used directly.
- Owned application origin **http://127.0.0.1:3119**. No testing against ports 3000/3001, real databases/accounts, recordings or evidence. Browser contexts block localhost/127.0.0.1 relay HTTP/WebSocket traffic on 3001. No `.env` edits.
- Isolated build root `C:\Users\Admin\.codex\worktrees\qadesk-phase2-baseline\QA-Web`. Main build remains **`SG3cqw3ttuk_5_z7f3xEs`**, untouched and not claimed to contain these fixes.
- Initial reused build **`CPqk0A6j3_b_LFlgshv53`** (unchanged Phase 6C source); first four fixes build **`lkuhxzAoL-jnC3aWz8clL`**; final five-fix build **`fJTDf_mp0CwRwSMS0HClP`**. Both new builds completed production compilation, TypeScript, 37 generated pages and standalone finalization.
- Initial main/isolated 264-file production input SHA-256: `24ab641a63789eb181468347a453bd2798e933d3914c04fd9935dd45ce2a5795`. Final main/isolated hashes match: **`46ff00c1282e7a129801b0285aad6444547797062a86f18c226392b35e089eb4`**. This is source-input parity, not reproducible binary identity. SQLite schema unchanged, SHA-256 `5d9b4f6f7d861634be567b1eee5a977e9d19feba84acc2b7e840f166a35e442f`.

### Phase 6C preflight

Reviewed selected-run stats service, its mocked query tests and real SQLite equivalence tests, diagnostic environment/ownership guards and prior report. Candidate runs remain project-filtered, newest ten non-archived, with IN PROGRESS → READY → newest preference. Only selected-run latest execution statuses are hydrated; aggregate response contract/helper remains unchanged. No auth/lifecycle/transaction/schema/pagination changes were mixed into 6C; no production profiling helper/headers remain. Existing Phase 6C evidence was reused only where source is unchanged; no 5k benchmark rerun. New 26-test run includes four SQLite equivalence tests and all 22 Phase 6A regressions.

### Fixture and role ledger

Each environment starts with synthetic A/B workspaces, main and alternate projects in A, private project in B, **24 main cases, 3 modules, mixed priorities and Positive/Negative types**, requirement, plan, and active cycle with four memberships. Cases begin Not Done to make transition assertions explicit; browser scenarios create the execution outcomes, lifecycle stages, evidence/history and report. A separate archived foreign run/execution/file provides an ownership-negative control. No thousands-row fixture was generated.

| Alias | Workspace membership | Usage |
|---|---|---|
| lead | A / QA_LEAD, none in B | Main browser flows and report finalization |
| qa | A / QA, none in B | Valid testcase mutation; report-finalize denial |
| viewer | A / VIEWER, none in B | Read-positive, mutation-negative, foreign-negative |
| foreign | B / OWNER, none in A | Owns private fixture resources |

Contexts are isolated per browser test; explicit role-cookie switching occurs only in the role scenario. Test identities are verified by real login/session response, role memberships in the seeded DB and resulting server permissions. Generated credentials are not included in source/report. All fixture clients override datasource URLs explicitly.

### Evidence index

All roots below are under `C:\Users\Admin\AppData\Local\Temp\`. Keep local; Windows Temp cleanup may remove them. Browser failure traces/screenshots, network status summaries and persisted-state attachments are retained. Credentials/session material is synthetic; do not publish raw traces indiscriminately.

| Pass | Root / result file | Outcome |
|---|---|---|
| Smoke | `qadesk-phase7-Po3M9S\browser-results.json` | 1 passed / 1 harness-selector failure |
| Initial critical selection | `qadesk-phase7-Po3M9S\browser-results-critical-initial.json` | 2 passed / 8 failed: four product failures, four harness assumptions |
| Four-fix retest | `qadesk-phase7-1TnNMI\browser-results-fixed-pass1.json` | 6 passed / 3 failed: one additional product defect, two harness assertions |
| Final targeted retest | `qadesk-phase7-autXrx\browser-results-final-targeted.json` | **4/4 passed**, 52.6 seconds |
| Read-only dashboard supplement | `qadesk-phase7-autXrx\dashboard-ui-check.json` | PASS: rendered seven status cards and total match independently counted DB rows; no pageerrors |

Total: **25 scenario invocations, 12 distinct scenarios**. Failed attempts are not hidden or counted as passes. Only affected/new assertions were rerun, not the full suite repeatedly. Each pass uses a fresh owned fixture when needed. Tests require the fixture created by the environment script, not ambient application data.

## C. Workflow coverage matrix

PASS means actual browser steps plus API/Prisma verification described here, not just a success toast. Lower-level negatives are labeled separately.

| ID / workflow | Entry and user action | Expected state / entities | Role and feedback | Result / evidence |
|---|---|---|---|---|
| P7-01 Authentication / project navigation | Login form → Cases → Bugs → Back/Forward → reload | Session authenticated; selected authorized project retained | Lead; redirect, meaningful screens, no runtime errors | PASS, smoke |
| P7-02 Testcase management | Cases → invalid empty save → create → edit → reload | No invalid write; TestCase fields/module/type/priority persist | QA+; validation toast, saved dialog closes | PASS, four-fix retest; POST 201 / PUT 200 + DB |
| P7-03 Search/filter/sort/pagination | Cases ID sort, next page, search, status/module filters, keyboard popup | Correct matching list, page transition, saved BLOCKED status | QA+; popup focus restored on Escape | PASS, four-fix retest; existing status-selector E2E informed locators |
| P7-04 Inspector | Row detail → Overview/Steps/Execution/Evidence/Bugs/History/Comments/Traceability → Escape | Tabs activate, dialog closes, no runtime exception | Read access; accessible tab states | PASS, initial critical selection; Automation tab/next-previous not certified here |
| P7-05 Execution / evidence / Bug | Active cycle → Pass → next → Fail → upload PNG → Create Bug → reload | Executions and latest status, actor, evidence, Bug.sourceExecutionId/source testcase match; failed inventory synchronization | QA+; saved outcomes, evidence link, 1 passed / 1 failed summary | PASS, final targeted. Own file downloaded with exact stored size; nonexistent evidence ID 404 |
| P7-06 Complete Bug lifecycle | Case Failed → Bugs Fixing → Ready → case Done → reload → Fixed history | One Bug, correct project/source, all lifecycle timestamps, committed history, VERIFIED & FIXED | QA+; canonical server statuses and resolved tab | PASS, four-fix retest; Phase 6A regressions also passed |
| P7-07 Failed retest | Failed → Fixing → Ready → Failed; repeat identical request | Case FAILED, Bug FIXING; no duplicate Bug/history from repeated identical action | QA+; failed-retest state persists | PASS, initial critical selection; repeated no-op API + direct DB count |
| P7-08 Dashboard / reporting | Known stored state → dashboard → inventory transition → dashboard → create report from cycle → finalize | Exact DB totals/status/Bug counts/progress; selected-run failed count; report execution metrics and final state | Lead; selectable source cycle, saved report, final badge; QA finalize denied 403 | PASS, final targeted; screenshot `report-after.png` |
| P7-09 Synchronization / conflict | Hold old search response → newer search; two tabs; hold response during project switch; actual relationship 409 | Newer data wins; no prior-project row leaks; committed record/history unchanged on conflict, reload works | Lead; specific error, canonical reload | PASS, final targeted; actual 409, not fabricated success |
| P7-10 Authorization / validation | Viewer read + denied write; QA mutation; invalid status/missing ID; foreign URL/evidence | Server denial with unchanged state, no private marker; QA own write works | Viewer/QA, workspace A vs B | PASS, four-fix retest; direct negative requests supplement browser access |
| P7-11 Excel | UI upload/preview → confirm → exact two rows → export/download → malformed preview | +2 persisted cases; UI rows and XLSX content match; malformed input no mutation | QA+; preview, validation, download | PASS, four-fix retest; real multipart 200/201 and downloaded workbook parsed |
| P7-12 Traceability / plan / cycle | Requirement lane → linked plan/run → create cycle selecting plan → assign case | Existing requirement→case→plan→run visible; new run.testPlanId and membership persist | Lead; cycle created and assignment feedback | PASS, final targeted |

Additional inventory: workspace creation/membership administration and module CRUD exist in source/API but are **NOT TESTED as UI creation workflows** here. They are fixture prerequisites, not claimed acceptance passes. Test Plan selection/relationship visualization and cycle creation are covered; new Test Plan creation/edit UI is not fully exercised. Deletion/resequence, manual capture/legacy recordings, all Automation functionality and exhaustive report export formats are NOT TESTED.

## D. Confirmed defects and fixes

All findings concern synthetic A / lead on the corresponding production-like build. Baseline API/database evidence is attached to each failing browser result; no console exception was needed to prove these contract failures. Reproduction is one controlled browser occurrence plus source/network correlation; repeats were limited to affected retests. **Critical: 0; High confirmed: 5; High still open in tested scope: 0.**

| ID | Severity / feature | Reproduction, expected vs actual | Confirmed root cause | Focused fix / retest |
|---|---|---|---|---|
| P7-CASE-TAGS | High / edit | Create default case with empty tags, edit action, Save. Expected persisted edit/closed dialog; actual PUT 400, dialog stays and DB action unchanged | Form sends `tags:null`; PUT only accepts string/array when supplied | Form sends empty string; server normalization still clears tags. P7-02 passed with DB edit/reload |
| P7-EXEC-BUG | High / execution Bug creation | Run Fail, attach evidence, Create Bug. Expected linked Bug/source; actual POST 415, no Bug persisted | Empty POST violates existing JSON mutation guard | Send JSON `{}` with Content-Type. Final P7-05 passed; linked Bug/sourceExecutionId, inventory status and evidence verified |
| P7-EXCEL | High / import | Upload valid two-row workbook via UI. Expected preview; actual POST 400, no import | Client omits query project required by proxy/handler form-query binding | Add encoded project query for preview and import; do not weaken guard. P7-11 passed exact +2, export content and malformed no-write |
| P7-REPORT-SOURCE | High / report creation | Reports → new status report → source dropdown. Existing cycle should be selectable; only placeholder shown | ReportForm reads `data.runs`; route returns `testRuns` | Read actual response field. Final P7-08 selected cycle, saved real report and checked execution-derived snapshot |
| P7-REPORT-ACTION | High / report finalization | Create valid draft with author/approval/ID/dates → Finalize. Expected FINAL; actual POST 415, DB stays DRAFT | Shared report action client sends empty POST | JSON `{}` for refresh/finalize/versions. Three unit expectations failed before fix, pass after; browser finalization passes. Refresh/new-version rendered flows not separately certified |

No server security policy, origin/body limit, RBAC, ownership check, Serializable/conditional guard or lifecycle rule was relaxed to make tests pass. No schema/index/dependency/architecture change.

## E. Verification gates

| Gate | Result | Evidence / scope |
|---|---|---|
| Browser E2E | PASS selected 12 distinct scenarios across bounded passes | Evidence index above; final targeted 4/4, not a single 12/12 final-build run |
| Relevant units | PASS **17/17**, 5 files | Excel/reports clients, stats query/aggregation, report integrity |
| API/SQLite integration | PASS **26/26** | Four Phase 6C equivalence + 22 Phase 6A atomicity/lifecycle/history/pagination/concurrency checks |
| Phase 6B security preservation | PASS **12 selected, 34 skipped** of 46 | `6B-MULTIPART`, `6B-RBAC`, `6B-NESTED`, `6B-EVIDENCE`; not the entire suite |
| Persistence | PASS selected records | Independent Prisma after browser operations; own evidence bytes; actual XLSX download; snapshots attached on failure |
| Phase 6C preservation | PASS | Same stats source, narrower query unit expectations, selected-run SQLite equivalence and real dashboard values |
| Lint | PASS | Full ESLint exit 0; final harness/config/tests focused follow-up exit 0 |
| Typecheck | PASS | `node node_modules/typescript/bin/tsc --noEmit`, exit 0 |
| Isolated production build | PASS | Final `fJTDf_mp0CwRwSMS0HClP`; source parity and static/public finalization verified |
| Diff / service hygiene | PASS | Main build/ports protected; no staged changes; owned sessions/credentials removed |

Key commands (from main checkout unless stated):

```powershell
# Fresh synthetic environment; isolated artifact only. Prints disposable root.
node scripts/phase7-environment.mjs C:\Users\Admin\.codex\worktrees\qadesk-phase2-baseline\QA-Web\.next\standalone
# In a second terminal, use exactly the emitted root and a new output label:
$env:QA_PHASE7_ROOT = '<emitted temporary root>'
$env:QA_PHASE7_RUN = 'fresh-acceptance'
$env:PW_TEST_SCREENSHOT_NO_FONTS_READY = '1'
node node_modules/@playwright/test/cli.js test --config playwright.phase7.config.ts

node node_modules/vitest/vitest.mjs run src/lib/client/api/reports-client.test.ts src/lib/client/api/excel-client.test.ts src/lib/services/stats-query.test.ts src/lib/services/__tests__/stats-aggregation.test.ts src/lib/services/report-integrity.test.ts
node node_modules/vitest/vitest.mjs run --config vitest.integration.config.ts src/lib/backend-phase6a.integration.test.ts src/lib/backend-phase6c-stats.integration.test.ts
node node_modules/vitest/vitest.mjs run --config vitest.integration.config.ts src/lib/backend-phase6b.integration.test.ts -t '6B-MULTIPART|6B-RBAC|6B-NESTED|6B-EVIDENCE'
node node_modules/eslint/bin/eslint.js .
node node_modules/typescript/bin/tsc --noEmit
```

The command example for a fresh acceptance run is reproducibility guidance, **not a claim a new full suite was run**. Never invoke the default production E2E config against the user's main build/ports for this phase. Shutdown/cleanup must positively identify the owned server; cleanup refuses a live 3119 listener and only accepts a direct owned Temp root. After stopping that verified process, `node scripts/phase7-environment.mjs --cleanup '<root>'` revokes fixture sessions, removes plaintext fixture credentials and retains offline synthetic state/evidence.

### Harness failures and environmental observations

- Initial schema push failed on an absent SQLite file; explicit empty file creation corrected setup. No app defect or real DB access.
- `npx playwright` stalled in its npm/cmd wrapper; only verified owned wrapper processes were stopped. Direct installed Playwright CLI then worked. No new package/browser install.
- Smoke placeholder selector assumed actual newlines; JSX placeholder contained a different literal representation. Corrected semantic prefix match. Initial failure retained.
- Other incorrect harness assumptions: case-sensitive uppercase pagination copy; searching the active Bugs tab for an already resolved Bug; missing resource without explicit project returns 400 (correct missing-scope policy); expecting a separator in a checkbox label; expecting assignee rather than authenticated actor for execution; immediate DB read before asynchronous assignment completion. Corrected locators/expectations/polling, not product rules.
- One isolated build was aborted after copy commands mistakenly targeted source files onto themselves due cwd. Copies were corrected to absolute main→isolated paths before the successful build. No main build or user process was touched.
- First new successful build emitted the existing nonfatal SQLite code 5 WAL initialization warning during concurrent static workers on the **build-only synthetic DB**. It still exited 0; final build passed without that warning. Runtime safety is supported by prior storage tests and new integrity checks, not inferred from a build warning.
- No automatic retries, performance matrix, hundreds of screenshots or hidden discarded failures. Targeted API tests are not relabeled browser E2E.

## F. Functional UX and accessibility findings

Impeccable audit/hardening guidance and existing React/shadcn components were used to preserve incumbent UI while correcting behavior. Mechanical detector returned **`[]`** on the three touched components. This does not establish accessibility conformance or replace manual source/browser checks.

Observed positives: login has associated labels, real status controls support Enter/Escape and focus restoration, inspector tabs open/activate/dismiss without runtime errors, loading resolves in tested routes, newer search/project data is not replaced by delayed responses, actual conflicts show failure rather than false success, and failed save/preview preserves safe persistence. No persistent blank screen, framework overlay or pageerror was observed in the selected passing flows. Initial Cases and final report screenshots were inspected at 1440×900; no redesign acceptance score is claimed. A final read-only browser supplement explicitly verified rendered dashboard values against SQLite: Total 24, Done 1, Active 0, Blocked 1, Backlog 20, Failed 2, Retest 0, TBA 0 (`dashboard-ui-check.json` and `dashboard-after.png`).

Remaining nonblocking gaps:

- Testcase and report forms contain visual Labels without `htmlFor`/matching control IDs. Source and browser accessible snapshots show placeholder-named rather than label-named fields. Read-only browser probe confirmed zero controls matched the visible Test Action label. This is a targeted **Medium accessibility issue**, not a claim of full WCAG failure testing. Broad form-layout replacement was deliberately avoided.
- VIEWER can still see some mutation entry controls, although server mutation is correctly denied (verified unchanged DB). Read-only UI affordances could be clearer; **Medium UX**, not an authorization bypass.
- Two tabs can display stale state until refresh. A later valid action from the other tab may commit; there is no client If-Match contract. The test demonstrated canonical DB/read-after-refresh, not universal stale-browser prevention. Actual 409 was separately exercised using a known synthetic relationship conflict, not misrepresented as an If-Match race.
- Inventory progress, run execution progress and Bug verification are distinct concepts; users must follow the documented control path. A single-workspace automatic retest redesign is outside this scoped fix.

No mobile/tablet matrix, light-theme audit, contrast certification, screen reader/Windows high contrast, full keyboard-only navigation or animation profiling was performed. These are NOT TESTED, not silently passed.

## G. Exact changes

### Preserved Phase 6C local work (9 files, not newly authored in Phase 7)

`src/lib/services/stats-service.ts`; `src/lib/services/stats-query.test.ts`; `src/lib/backend-phase6c-stats.integration.test.ts`; `scripts/phase6c-benchmark.mjs`; `scripts/phase6c-server.mjs`; `scripts/phase6c-http-concurrency.mjs`; `scripts/phase6c-reliability.mjs`; `scripts/phase6c-worker.mjs`; `docs/backend-phase6c-local-scalability-report.md`.

### New Phase 7 work (11 files)

| File | Purpose |
|---|---|
| `src/components/TestCaseDialog.tsx` | Empty tags serialize as valid string; no change to server validation |
| `src/components/TestRunsPanel.tsx` | JSON request for contextual Create Bug |
| `src/components/ReportForm.tsx` | Read canonical testRuns response field |
| `src/lib/client/api/excel-client.ts` | Authorized query/form project binding for preview/import |
| `src/lib/client/api/reports-client.ts` | JSON mutation contract for report actions |
| `src/lib/client/api/excel-client.test.ts` | Three client query/form/denial regressions |
| `src/lib/client/api/reports-client.test.ts` | Three action JSON regressions; demonstrated pre-fix failures |
| `e2e/phase7.acceptance.spec.ts` | Twelve selected real-browser scenarios and independent persistence checks |
| `playwright.phase7.config.ts` | Isolated origin/output roots, one worker, no retries/default setup/service |
| `scripts/phase7-environment.mjs` | Owned synthetic seed/server, credential cleanup and integrity/state record |
| `docs/phase7-end-to-end-functional-acceptance.md` | This report, workflow matrix, defects, gates and evidence |

No other source file is part of Phase 7. Unrelated existing untracked `.codex/`, `.mcp.json`, clipboard instructions/CV, prior handoff and Playwright/Graphify artifacts are preserved. Nothing was staged. Graphify was queried read-only for source mapping; synchronization intentionally skipped under artifact restrictions. No framework, dependency, schema or visual-system replacement.

## H. Remaining limitations

- Chromium-only desktop acceptance; selected scenarios, not exhaustive combinations or a long CI flakiness run.
- Same fixture can accumulate scenario state. Assertions derive expectations from actual persisted state and scenario-owned cases, but a fresh environment is the supported rerun boundary; do not point tests at a historical/main DB.
- Bootstrap, workspace/member/module creation UI, full Test Plan editing, testcase deletion/resequence, manual capture/legacy recording compatibility, AI/provider integrations, notifications, every report action/export and long-duration usage are not fully accepted here.
- Existing Phase 6B limitations remain: some nested validation errors classify as 500 despite rollback, unreviewed routes/host/proxy/filesystem configuration and real historical evidence ownership were not certified. No PostgreSQL, cloud or public-deployment readiness claim.
- All five fixed functional issues are client/server integration failures. No Critical/High integrity or workspace-exposure defect was observed in this targeted phase, but absence in this sample is not proof of total security.
- Main runtime still uses the older build; these patches are not activated there. A future user-approved build/restart is required.

## I. Final recommendation

1. **Main supported workflow is usable after these fixes**, including verified Bug resolution via testcase retest controls, contextual evidence/Bug creation and final execution-based report.
2. Checked DB/UI/API state is consistent under the actual separate inventory/execution model; do not equate Pass with automatic Bug verification.
3. No known unresolved Critical/High remains in the selected workflows. Medium accessibility/read-only-affordance gaps remain documented.
4. Tests use zero retries, owned fresh SQLite setup and bounded UI/network/DB checks. Harness assumptions were corrected openly; no long-run stability certification or single final-build full-suite pass is claimed.
5. Before everyday use of this patch: review the local diff, then explicitly approve building/restarting the main runtime. Keep current security/6A/6C safeguards. Address the Medium form-label and read-only UX gaps separately; no database migration or performance redesign is required for this handoff.

### Final cleanup record

The final owned 3119 PID was checked against its recorded parent and `phase6c-server.mjs` command before termination. Earlier owned instances were stopped before rebuilding their artifact; no user PID was targeted. All three completed fixture roots had synthetic sessions revoked and plaintext `fixture.json` removed using guarded cleanup. Offline synthetic DBs, redacted `resulting-state.json`, raw browser results/traces and screenshots remain locally for inspection; no active fixture credentials remain in the fixture manifest. Raw failure traces may still contain now-revoked synthetic session headers and should not be publicly uploaded.

Cleanup independently reopened all three SQLite fixtures: integrity `ok`, foreign-key violations zero. Port 3119 is no longer listening. User listeners remain 3000 PID 19736 and 3001 PID 22580; main build remains `SG3cqw3ttuk_5_z7f3xEs`. Branch/HEAD unchanged, staged diff empty, and `git diff --check` passed with only LF/CRLF conversion warnings.

**No stage, commit, push, merge, PR, deploy, real data mutation or user-service interruption.** This is a local handoff, not activation of the patch in the user's running app.
