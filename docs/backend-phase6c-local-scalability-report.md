# Phase 6C — Local backend scalability and SQLite reliability

## A. Executive summary

**Verdict: PASSED WITH LIMITATIONS.** Investigation completed on isolated synthetic SQLite databases on the local laptop. One measured production bottleneck was minimally fixed: dashboard readiness loaded testcase/execution graphs for ten candidate runs although only one run was consumed. Existing authorization, lifecycle, conditional updates, transaction isolation, and deterministic pagination were not changed.

At 5,000 cases / 1,000 bugs, dashboard HTTP samples changed from **747.86, 764.66, 779.02 ms** to **146.77, 277.15, 313.98, 280.57, 300.61 ms**. Descriptive medians: 764.66 → 280.57 ms (about 63% lower). Small samples are not an SLA or reliable P95 estimate. The final samples remain noisy and are all retained.

No corruption or partial Bug/Testcase/history update was observed in the scoped tests. Deliberate write contention still costs about 5.5 seconds before HTTP 409: bounded, but visibly slow during an unusual held writer. No automatic retry was added. SQLite remains appropriate for this measured local workload; no migration or index change is justified by these results.

All changes remain **local and uncommitted**. No staging, commit, push, merge, PR, deployment, real database/account/evidence mutation, `.env` edit, or frontend modification was performed. User ports 3000/3001 and the main application build were not restarted or overwritten.

## B. Environment and measurement identity

- Branch: `codex/frontend-design-system-motion-optimization`.
- Starting/ending HEAD: `0deffe3b79648614e98f30dafc1be382aef16790`.
- Windows 11 Home Single Language; Intel Core i3-1215U, 6 physical / 8 logical cores; 16,890,978,304 bytes RAM (about 15.73 GiB). Intel UHD / 60 Hz is the reference display, not part of API measurements.
- Node v24.19.0; Next.js 16.2.4; Prisma 6.19.3; SQLite 3.46.0, SQLite provider.
- Deterministic synthetic content seed label `20261015`; distinct statuses, priorities, modules and timestamps; no copied user data. Each dataset has 10 modules, 10 runs, one run-case per case, two executions per case, and one initial history per case. Fixture writes used an explicit temporary database URL and a generated synthetic session.
- Production HTTP server: owned loopback port 3118, same laptop and fixed request configuration. One warm-up plus three measured requests per variant; final large stats expanded to five because max/min exceeded 1.8. No frontend benchmark or browser profiling. Test/build/performance runs were serialized rather than overlapped in the canonical comparison.
- Fourteen variants cover five endpoint families: six Cases variants, five Bugs variants, dashboard stats, valid Bug mutation, and Test Run execution PUT. Row counts, bytes, process CPU, memory and GC are retained per sample in JSON.
- Primary measurements exclude detailed query instrumentation. Separate opt-in detailed builds supplied handler/query timing. HTTP includes authentication and transfer; diagnostic handler timing excludes middleware/authentication outside the handler. Native query durations are millisecond-resolution sums, not the critical path: parallel queries, queueing, ORM hydration, business logic and serialization prevent exact subtraction into “JavaScript time.” CPU is whole owned-server process delta, not handler-only CPU.

| Artifact | Build ID / source identity |
|---|---|
| Baseline primary | `KOE8_hBuc8SRqpDLgsi8-` (diagnostic overlay compiled but disabled) |
| Baseline detail | `0cLdOnQC3LNB0da3XT2Wf` |
| Optimized detail | `9AUYBD0p6YffG-9yJOxpt` |
| Final clean optimized primary | `CPqk0A6j3_b_LFlgshv53` |
| Main application, untouched older build | `SG3cqw3ttuk_5_z7f3xEs` |

Baseline SHA-256 of 264 tracked production source/config/package files (tests excluded): `8ab99746241f79423e7a5140a2f746d04409548bab947284be67ed0e106215da`. Final main and isolated source hashes match: `24ab641a63789eb181468347a453bd2798e933d3914c04fd9935dd45ce2a5795`. SQLite schema hash unchanged: `5d9b4f6f7d861634be567b1eee5a977e9d19feba84acc2b7e840f166a35e442f`.

Isolated build: `C:\Users\Admin\.codex\worktrees\qadesk-phase2-baseline\QA-Web`. Preserved diagnostic baseline artifact is outside that source root at `C:\Users\Admin\.codex\worktrees\qadesk-phase2-baseline\phase6c-baseline-standalone`.

### Evidence files

All paths below are under `C:\Users\Admin\AppData\Local\Temp\`; JSON retains individual observations, not just summaries. Temporary fixture databases were removed after disconnecting owned clients/processes; results remain. Temp files are local evidence and may be removed by Windows cleanup.

| Run | Relative evidence path |
|---|---|
| Canonical baseline primary | `qadesk-phase6c-bench-9QZgRQ\results.json` |
| Baseline detail, valid small dataset | `qadesk-phase6c-bench-aaRYHA\results.json` |
| Baseline detail, resumed medium/large | `qadesk-phase6c-bench-togLVL\results.json` |
| Optimized detail | `qadesk-phase6c-bench-RGkDbQ\results.json` |
| Canonical final clean primary | `qadesk-phase6c-bench-oTusuw\results.json` |
| Corrected graceful-restart confirmation, medium only | `qadesk-phase6c-bench-kMnkk4\results.json` |
| Direct SQLite crash/rollback checks | `qadesk-phase6c-49TVWr\result.json` |

## C. API scalability

Raw HTTP durations in milliseconds, **baseline → final**, with Cases/Bugs counts explicit. These are warm samples, not cold-start or P95 measurements. Unmodified endpoint changes are observational noise, not attributed optimization gains.

| Endpoint / scenario | 100 cases / 25 bugs | 1,000 cases / 250 bugs | 5,000 cases / 1,000 bugs | Finding |
|---|---|---|---|---|
| Cases GET default | 32.89,30.27,41.05 → 39.82,25.92,20.95 | 18.91,21.43,31.35 → 34.05,15.26,15.23 | 23.96,28.14,37.77 → 34.09,29.37,27.98 | No disproportionate default-list growth |
| Bugs GET default | 28.25,29.27,30.32 → 20.99,32.03,34.05 | 25.25,23.55,32.64 → 23.73,13.49,14.33 | 37.63,29.72,29.35 → 31.82,26.27,13.90 | No list rewrite justified |
| Dashboard stats | 36.71,45.88,45.08 → 38.96,26.09,38.53 | 173.78,185.57,188.26 → 33.06,43.33,48.44 | 747.86,764.66,779.02 → 146.77,277.15,313.98,280.57,300.61 | Confirmed unnecessary graph loading fixed |
| Valid Bug mutation | 34.36,42.51,59.67 → 52.15,53.68,52.87 | 44.22,49.53,42.45 → 35.62,20.35,43.96 | 54.21,41.52,41.94 → 60.32,37.68,56.47 | Atomic synchronization preserved |
| Run execution PUT | 36.29,28.89,36.43 → 51.43,52.90,37.14 | 36.90,35.74,112.08 → 28.12,35.90,37.05 | 77.19,57.19,42.53 → 45.64,27.68,42.79 | Baseline 112.08 outlier retained |

Cases search/status/module/sort/combined and Bugs active/search/sort/page samples, handler/query durations and resource deltas are in the corresponding raw results. They were executed, not inferred from default pagination. No general “every API under 100 ms” claim is made.

Payload/readback equivalence: Cases default returns 50 rows (29,055 / 29,291 / 29,294 bytes); Bugs returns 25 / 50 / 50 rows (16,485 / 33,106 / 33,201 bytes); stats one object (40,524 / 70,043 / 182,122 bytes). These counts and bytes match before/after. Mutation responses are 798 bytes (Bug) and 515 bytes (Run). Stats still grows with aggregate output; response-shape optimization was not attempted.

Separate detailed profiling, dashboard only:

| Cases | Baseline handler ms | Final handler ms | Baseline native query sum ms / count | Final native query sum ms / count |
|---|---|---|---|---|
| 100 | 21.91,20.90,28.17 | 11.99,18.96,14.85 | 3,2,8 / 10 | 0,4,2 / 10 |
| 1,000 | 153.60,169.52,146.91 | 41.46,68.56,56.90 | 37,40,40 / 11 | 6,10,6 / 10 |
| 5,000 | 736.10,723.41,718.31 | 116.03,247.41,244.33 | 165,158,157 / 15 | 16,25,49 / 10 |

Counts are handler-only query events, not all queries across proxy/auth. Integer zero is resolution-limited, not proof of no database work. Detailed and primary timings are not pooled because build/instrumentation differs.

## D. Database analysis

### 6C-STATS — unnecessary candidate-run relation materialization

Original query fetched ten latest non-archived project runs with all run-case fields and latest execution fields, including unused notes. Readiness then picked IN PROGRESS, else READY, else the first candidate. On this fixture 5,000 run-case/latest-execution graphs were materialized although only 500 belonged to the selected run. Those are ORM graph counts, not an exact count of engine rows read.

Fix: keep the same project-filtered ten candidate selection/order and preference; select only run ID/name/status, then fetch only the selected run's latest execution **status** per run-case. Existing aggregation and readiness helper are unchanged. No cache, contract change, relation duplication, auth shortcut, isolation change, or new dependency.

Representative SQLite `EXPLAIN QUERY PLAN` results (not claimed to be verbatim captured Prisma SQL):

- Cases project/order: existing `TestCase_projectId_testCaseId_key` search.
- Bugs project/order: existing `BugFix_projectId_updatedAt_idx`, plus temporary B-tree for ordering.
- Weight grouping: existing testcase project index plus temporary B-tree for grouping.
- Before ten-run graph and after selected-run graph: existing `TestRunCase_testRunId_testCaseId_key` search. The improvement is narrower scope/projection, not a different index.
- Latest execution: existing `TestExecution_testRunCaseId_createdAt_idx` search.

Primary stats descriptive median at medium: 185.57 → 43.33 ms; large: 764.66 → 280.57 ms. Small timings overlap normal noise. Large detailed native query sums also fall (157–165 → 16–49 ms), while handler cost remains materially above native engine time; ORM hydration/application/serialization are part of the remaining cost. Exact CPU attribution is not possible from these aggregate counters.

Tradeoffs: a dependent selected-run follow-up query; no atomic snapshot across all dashboard queries, as before. Concurrent run changes can affect the multiquery summary. No index/schema write or storage overhead was added. Small lists and existing plans do not justify index proliferation, FTS, cache invalidation complexity, or pagination changes. Source/project boundaries and unique sorting tie-breakers remain intact.

## E. Resource usage

| Dataset | Baseline seed ms → final seed ms | Main DB / WAL / SHM bytes | Baseline max sampled RSS → final MiB |
|---|---|---|---|
| 100 / 25 | 328.21 → 227.42 | 614400 / 329632 / 32768 | 170.75 → 165.80 |
| 1000 / 250 | 1526.20 → 1709.09 | 2097152 / 358472 / 32768 | 184.01 → 175.48 |
| 5000 / 1000 | 8218.95 → 8278.03 | 8486912 / 366712 / 32768 | 263.54 → 203.93 |

Seed durations exclude schema CLI/startup. Max RSS is the highest **sampled** value during requests/cycles, not continuous OS peak measurement. Largest main database is about 8.09 MiB. No optional 10k fixture was necessary.

Large stats whole-process CPU deltas: baseline 1078/1124/1188 ms; final 156/234/360/297/375 ms. Multithread/native work means process CPU can exceed elapsed HTTP time. Windows timing granularity and background work affect precision.

Three bounded navigation/filter/pagination/stats cycles at 5k ended at final RSS 198.43/198.80/203.93 MiB and heap 72.03/75.38/89.24 MiB. During the subsequent nominal five-second inactivity window, two GC events totaling about 46.26 ms occurred: heap fell 89.24 → 45.54 MiB and RSS 203.93 → 138.25 MiB, with 171 ms process CPU. Small/medium idle CPU deltas were 0 ms; baseline idle deltas were 16/0/16 ms. Zero is not proof of literally no work.

No repeatable unbounded memory growth was demonstrated. Retained V8/native/RSS memory alone is not a leak. This is a short bounded workload, **not prolonged-use/overnight soak verification**. Free RAM was logged; early preparation had substantial memory contention, whereas canonical baseline had roughly 2.1–2.3 GiB free. Background laptop activity was not fully controlled. Canonical timings did not overlap builds/tests.

## F. Reliability and contention

Detailed application-connection readbacks at all three sizes showed WAL, busy_timeout 5000, foreign_keys 1. Fixture connection readbacks were separate. Application PRAGMA initialization remains existing best-effort asynchronous setup; a sampled connection does not prove pool-wide initialization. No production initialization code was changed.

### Actual authenticated HTTP scenarios, synthetic 1k fixture

Canonical final run: **7 checks passed, 16 requests**, including ownership/scope guards and the six required scenarios.

1. Four simultaneous GET launches: all 200, 39–45 ms, no mutation.
2. Bug READY plus list reads: 200, consistent Bug/source pair and exactly two history records.
3. Opposing valid transitions from FIXING: observed 200/409, only winner history committed. Shared HTTP launch is not a deterministic server-read barrier; deterministic stale-write coverage comes from retained Phase 6A integration tests.
4. Bulk two eligible nonbug cases plus reads: exactly two changes/history records; no Bug side effects.
5. Deliberately acquired/held write transaction: competing HTTP write returned **409 after 5558 ms**; hold lasted 5579 ms. Failed Bug/source/history remained identical; held module update rolled back.
6. Deliberate fresh valid request after release: 200, one consistent pair and exactly two history records. No silent success or automatic stale retry.

### Storage interruption, separate layer

Owned synthetic SQLite worker: **9 checks passed**, including concurrent reads, WAL reader during held writer, bounded competitor P1008 (~226 ms with explicitly test-only 150 ms timeout), rollback, fresh retry and crash/reopen. An owned fork was abruptly terminated after four awaited uncommitted writes (Bug, testcase, two history rows). Reopened committed state was unchanged; integrity_check `ok`, foreign_key_check zero rows; exactly committed history persisted. This tests storage transaction recovery, not an actual application handler crash or laptop power loss. Production timeout was not reduced to 150 ms.

### Clean application restart

First final harness restart entered Next cleanup but exited 128 because the harness emitted SIGTERM without its argument; no forced-kill fallback, full state snapshot preserved, subsequent GET and valid write both 200. Harness corrected to emit the signal argument and medium-only confirmation reran: **exit 143 (expected handled SIGTERM), forcedFallback false, preserved true, read 200, resumed mutation 200**. Confirmation concurrency again passed 7 checks / 16 requests (held-write 409 at 5537 ms). Confirmation timings are not pooled with canonical performance samples.

No real application PID was terminated. Crash/restart exercised only owned disposable processes. No corruption repair, hardware power-failure simulation or real database access.

## G. Implemented files and risk

| File | Purpose / impact / risk |
|---|---|
| `src/lib/services/stats-service.ts` | Only production change: narrower selected-run graph/status projection; avoids unused relation hydration. Selection and payload regressions covered below; multiquery snapshot caveat retained. |
| `src/lib/services/stats-query.test.ts` | Four mocked query/selection tests: preferred in-progress, ready, latest fallback, empty. No real DB IO. |
| `src/lib/backend-phase6c-stats.integration.test.ts` | Four temporary SQLite cases compare readiness to original full-graph query and check project boundary. |
| `scripts/phase6c-benchmark.mjs` | Retained diagnostic CLI: synthetic fixtures, HTTP/resource samples, query plans, cleanup and graceful restart. Explicit isolated artifact/31xx/temp guards. Not imported by production. |
| `scripts/phase6c-server.mjs` | Owned fork-only server with IPC metrics/shutdown; explicit temp DB/port guard. No public metrics endpoint. |
| `scripts/phase6c-http-concurrency.mjs` | Authenticated actual API overlap and held-write checks; caller-owned server/client and scope guards. Synthetic mutations only. |
| `scripts/phase6c-reliability.mjs` | Disposable SQLite transaction/lock/crash verification with guarded temporary cleanup. |
| `scripts/phase6c-worker.mjs` | Verified owned child for deterministic held-write/crash synchronization; simplified storage transaction, not production service replacement. |
| `docs/backend-phase6c-local-scalability-report.md` | This report, evidence identities, limitations and recommendations. |

Temporary profiling overlay existed only in the isolated build tree. It has been removed: helper deleted; route/db wrappers restored to main source; final 264-file production source hash matches main. No production query timing headers remain in the final clean build. Diagnostic scripts are intentionally retained for reproducibility. Schema, migrations, package files and indexes unchanged. Graphify sync intentionally skipped because this phase forbids changes to Graphify output. Existing unrelated untracked artifacts were preserved, not staged.

## H. QA verification and deviations

| Gate | Result | Evidence |
|---|---|---|
| Targeted units | PASS 9/9 across 2 files | New query tests + existing stats aggregation tests |
| SQLite equivalence integration | PASS 4/4 | New Phase 6C suite, original-query readiness comparison |
| Phase 6A atomicity/concurrency | PASS 22/22 | Combined integration command: 26/26 including new four |
| Authorization preservation | PASS selected 7; 39 skipped | Phase 6B `6B1-PATH`, `6B-SCOPE`, `6B-READ`; not entire 6B suite |
| Actual HTTP concurrency | PASS 7 checks / 16 requests | Canonical final medium fixture; confirmation also passes |
| Storage integrity/recovery | PASS 9 checks | Separate storage worker result JSON |
| Full lint | PASS | `npm run lint`; focused lint rerun on final diagnostic scripts |
| Typecheck | PASS | `npm run typecheck` |
| Isolated production build | PASS | Final clean build ID `CPqk0A6j3_b_LFlgshv53`; finalizer exit 0 |
| Before/after API measurements | PASS within scope | Three sizes, all fourteen variants, raw JSON above |
| Long-duration soak / power failure / PostgreSQL / UI/E2E | NOT TESTED | Outside bounded local backend scope |

The new mocked query-shape regression was run before the fix: **3 failed / 1 passed**, demonstrating inefficient query shape, not an existing output mismatch. After the fix all four pass. No known failing product regression remains within these selected gates.

Failures/deviations retained, not silently discarded:

- Early primary `qadesk-phase6c-bench-IW0rZH\results.json` used an invalid product Bug status (`REPORTED` instead of `SUDAH DILAPORKAN`) and overlapped a diagnostic build. Excluded for fixture/configuration invalidity, not because latency was high; raw results retained.
- First detailed attempt failed a three-second IPC pragma request because Next's runtime realm did not expose the bootstrap getter. Switched isolated opt-in diagnostics to same-realm response headers. Harness failure, not API defect; no completed result file claimed for that attempt.
- Detail small result `aaRYHA` remained valid, but later progress serialization failed on BigInt. Added JSON replacer consistently and resumed only missing medium/large (`togLVL`).
- First isolated build emitted a nonfatal SQLite code 5 WAL initialization warning on the disposable build DB. Later runtime readbacks/builds passed; best-effort PRAGMA initialization remains a limitation, not proven globally reliable.
- One optimized build was deliberately aborted during TypeScript after a preserved standalone artifact was placed inside the isolated source root, potentially expanding TypeScript scanning. Artifact moved outside that root; retry and final clean build passed. User processes were untouched.
- Initial graceful restart signal-argument error and successful correction are disclosed in F.
- Outliers remain in evidence, including baseline medium Run PUT 112.08 ms, optimized detailed Bug mutation about 138 ms, and all noisy final large stats samples. Separate detail/confirmation runs are not pooled to improve results.

## I. Final recommendation

1. **SQLite remains appropriate** for measured single-user/small local workload through 5k cases/1k bugs. No compelling reason to migrate.
2. A meaningful dashboard scaling cost appeared at 1k and became pronounced at 5k; ordinary paginated lists did not show comparable growth in these samples.
3. Main bottleneck: unnecessary ten-run relation materialization and broader ORM/application processing in stats. Payload growth remains a future observation point.
4. No data-safety failure observed in selected tests. Limits: asynchronous PRAGMA setup, multiquery dashboard snapshot, ~5.5-second held-writer conflict latency, short-duration testing, and no hardware-failure simulation.
5. Justified improvement: selected-run-only, status-only loading with unchanged readiness semantics. Retain regression tests and diagnostic harness.
6. Defer speculative indexes, caching, FTS, pagination rewrites, broad refactors and database migration. No schema approval needed because none changed.
7. Another backend phase is not immediately necessary. Revisit only if actual workloads show problems: much deeper histories, >5k/10k cases, more simultaneously active writers, or repeatable long-soak growth. Do not extrapolate this bounded test into unlimited scalability.

The running main app still uses its older untouched build. This patch has been built and verified only in isolation; applying it to the user runtime requires a later explicitly requested build/restart. **No Git delivery action was performed.**

Final hygiene: focused ESLint on all five final diagnostic scripts exited 0; `git diff --check` exited 0 (only Git's existing LF/CRLF conversion warning). Branch/HEAD unchanged and staged diff empty. User listeners remain port 3000 PID 19736 and port 3001 PID 22580; owned port 3118 has no listener. Existing unrelated untracked files remain untouched.
