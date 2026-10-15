# Phase 5A — Backend vs frontend bottleneck diagnosis

Date: 14 October 2026. Local diagnostic only; no implementation, staging, commit, push, PR, schema, dependency, or API-contract change.

## A. Executive conclusion

**FRONTEND RENDERING DOMINANT**, with high confidence for the synthetic workload investigated. Backend execution contributes ordinary data-refresh latency, but does not explain the main UI freezes. This is not a 60 FPS acceptance result.

The decisive comparison is Cases → Bugs with React component timestamp logging suppressed in the browser diagnostic harness:

- Real API: 584 / 723 ms maximum long tasks; HTTP response totals 54.6 / 58.8 ms; GET handlers 13.3 / 22.8 ms.
- Exact recorded Bugs response replay: 599 / 610 ms maximum long tasks; HTTP totals 10.3 / 9.4 ms; no live Bugs handler/query.
- All four largest tasks finish **before the Bugs fetch starts**. The request starts 657.6–813.5 ms after sample start, after the synchronous panel activation has already blocked the browser.
- The second replay still freezes for 610 ms with **0 ms sampled Node CPU** in its interaction window. Node activity is therefore not necessary for this stall.
- Theme and loaded Cases scrolling generated **zero observed API requests** in all three measured samples each. Theme still produced 296–356 ms tasks; scrolling produced 0 / 50 / 51 ms tasks.

Important correction: enabling React production profiling introduced substantial **measurement overhead**. Its internal `rw` function emits component `console.timeStamp` records. A CPU profile attributed 448.6 ms of exclusive sampled time to that function. The initial profiled Bugs tasks of 1.43–1.68 seconds must **not** be presented as ordinary-production regression magnitudes. Disabling only browser `console.timeStamp` reduced them to the ranges above, without changing application DOM, data, controls, or query logic. The ordinary-production Phase 4 trace already showed a 590.9 ms Bugs task, corroborating the remaining application-side problem.

Answers to the stop-condition questions:

1. **Backend materially responsible for freezing?** Not demonstrated. Real GET handlers are roughly 8–33 ms here; comparable freezes survive replay, including a zero-Node-CPU control.
2. **Frontend-limited interactions?** Bugs activation/refreshed-row rendering; Cases sort/filter DOM and selector work; theme invalidation. Loaded scrolling is also browser/environment-side, with a smaller and less repeatable stall.
3. **CPU contention distorting results?** Node/browser contention is not established as dominant. Browser profiling overhead and between-run drift clearly distort magnitudes. External scheduling/GPU/thermal effects remain unisolated.
4. **Top three measured application bottleneck paths?** Synchronous Bugs activation plus repeat rendering, Cases table/selector invalidation, and global theme style invalidation. Individual Radix-control savings are not yet causally quantified.
5. **Next improvements?** Target those three frontend paths in small controlled changes; do not start a database refactor on this evidence.

## B. End-to-end breakdown

Milliseconds unless noted. HTTP total means Resource Timing `responseEnd − startTime`; handler time excludes authentication/proxy/framework work. React is `Profiler.actualDuration`, **not DOM commit duration**. Ranges and medians come from different sample groups explicitly identified below. Do not add overlapping columns.

| Interaction | API Total: HTTP / handler | Prisma awaited operations | Client processing | Render / paint evidence | Long task | Main bottleneck |
|---|---|---|---|---|---|---|
| Cases → Bugs | Timestamp-OFF real: 56.7 / 18.0 median | count 1.1–2.6; findMany 6.7–10.0; engine events 0–1 per query | JSON parse 0.9–1.7; body-read + parse 5.3–6.4 | Timestamp-OFF largest React render 105.1 median; ordinary Phase 4 max style/layout/paint 93.5 / 42.4 / 16.5 | Real 584–723; replay 599–610, timestamp OFF | Synchronous browser activation before fetch; then another render after response |
| Cases Sort | Real median 40.7 / 12.3 | count 1.5; findMany 7.5; groupBy 1.9 median | JSON parse 0.6 median; reconciliation/queue time not separately instrumented | Profiled max React render 57.0 median; ordinary Phase 4 max style/layout/paint 79.0 / 52.1 / 29.7 | Profiled real 88–360; replay 106–330 | Browser update path; profiling/scheduling confounds prevent precise cost shares |
| Cases Filter | Real median 38.0 / 12.0 | count 2.1; findMany 5.9; groupBy 2.3 median | JSON parse 0.4 median; reconciliation/queue time N/A separately | Profiled max React render 31.6 median; replay trace style/layout/paint max 36.7 / 4.2 / 9.1 | Profiled real 126–292; replay 111–281 | Selector activation and table changes; stalls also precede API completion |
| Theme | N/A; 0 observed requests | N/A | N/A | Profiled max React render 4.3 median; ordinary Phase 4 max style/layout/paint 210.4 / 28.2 / 43.3 | Profiled 296–356; ordinary Phase 4 task up to 417.8 | Browser global style invalidation / presentation |
| Scroll | N/A; 0 observed requests | N/A | N/A | 0 React commits; ordinary Phase 4 max JS/style/layout/paint 1.6 / 13.0 / 4.6 / 20.9 | New 0 / 50 / 51; ordinary Phase 4 trace task up to 83.6 | Browser paint/input/scheduling; exact hover/sticky/GPU share unresolved |

### Server stages, payload, and timing boundaries

Cases operations retain their existing `Promise.all` overlap. Awaited count/findMany/groupBy durations include Prisma JavaScript, result conversion, queue/scheduling and instrumentation, and must not be summed as critical-path time. Native Prisma engine query event durations are integer milliseconds: **0–1 ms** in these measured handler windows; zero means below timer resolution, not no work. Events are correlated by timestamp, not uniquely assigned to individual SQL statements.

- Cases ascending response: **70,950 bytes**, 100 rows. Checkout filter starts with 100 visible rows and returns **50 rows / 35,428 bytes**. It was not padded with duplicate rows.
- Bugs response: **79,270 bytes**, 100 records. The existing active-tab filter displays **75 rows and 75 table comboboxes**; the other 25 are resolved records. No rows/controls were removed for performance scoring.
- Cases weight-map construction: 0.007–0.063 ms; enrichment: 0.054–0.456 ms in measured real samples. The groupBy awaited duration is separate.
- Cases serialization: 0.796–13.219 ms for sort and 0.649–1.916 ms for filter. Bugs timestamp-OFF serialization: 1.111 / 4.541 ms. These are `NextResponse.json` call durations, not wire-transfer time.
- Timestamp-OFF Bugs TTFB: 30.9 / 44.7 ms real versus 10.3 / 9.4 ms replay. Browser fetch-to-headers: 66.8 ms real median versus 23.0 ms replay median. Callback scheduling can extend this beyond network delivery.
- The instrumentation measures JSON body read separately from synchronous `JSON.parse`; it does not attribute the body-read wait to parsing.
- Client JSON-completion → React callback timing includes scheduling, hook updates and rendering. Exact reconciliation time, DOM commit duration and the instant every control becomes usable are **N/A separately**. Last mutation/commit timestamps are retained as proxies, not claimed as precise usability latency.

## C. Real API versus replay

Recorded responses were obtained from the isolated authenticated synthetic backend. Interception fulfilled the **same response text/status, row ordering, and shape** keyed by the full GET path/query; no fabricated rows or adjusted delays. Warm-up records missing variants outside measured windows. Measured replay fails closed if a variant is missing. Both modes use the same panel navigation, fixture, viewport, production profiling build and instrumentation.

| Workload / instrumentation | Samples per mode | Real HTTP median | Replay HTTP median | Real max-task values | Replay max-task values |
|---|---:|---:|---:|---|---|
| Bugs, normal profiling timestamps | 3 | 244.8 | 19.5 | 1676, 1431, 1534 | 1668, 1681, 1635 |
| Bugs, timestamp-OFF control | 2 additional | 56.7 | 9.9 | 723, 584 | 599, 610 |
| Sort, profiling timestamps | 5 | 40.7 | 19.7 | 88, 360, 263, 213, 131 | 270, 330, 306, 106, 107 |
| Filter, profiling timestamps | 5 | 38.0 | 5.4 | 288, 292, 273, 126, 126 | 115, 281, 111, 136, 124 |

Replay removes targeted backend work, **not browser event scheduling, React effects, DOM/style updates or all server activity**. Resource Timing and delayed fetch callbacks are not interchangeable. A lower HTTP time is not proof the removed SQL caused the freeze. The filter median difference is particularly unsuitable as a causal percentage: real-mode added samples also dropped to 126 ms without changing backend code.

Confounds explicitly retained:

- Normal-profiling and timestamp-OFF samples are **not pooled**. OFF controls still use React's profiling bundle and root/row Profiler callbacks; they are not an ordinary-production acceptance run.
- Real then replay ordering, JIT/warm-up, GC, Windows scheduling, and browser/server sharing one machine can change magnitudes. No randomization or statistical speedup claim.
- A starts from 100 Cases rows here; Phase 4 navigation normalized Cases to 10. Its trace is corroboration, not a matched numerical baseline.
- Fixed post-action collection windows include idle time; end-of-window duration is not action latency. Raw input timestamps, fetch/parse timestamps, mutations, commits, rAF intervals and long tasks are retained.
- API routes use no response caching change. Playwright interception applies equally in both modes and can affect browser cache behavior. Both configurations are warmed separately.
- The filter replay trace includes **one live notification poll** in addition to replayed Cases; primary filter samples have only their single targeted GET. No API calls were observed during the six negative-control samples.
- Focus/visibility were recorded; all completed samples ended visible/focused and no page errors were recorded. This is not a guarantee against every external OS disturbance.

### D experiment: CPU and memory

Server process `cpuUsage` and RSS were sampled at nominal 250 ms; Chromium process CPU counters came from CDP `SystemInfo.getProcessInfo`, with renderer JS heap/TaskDuration metrics sampled alongside them. CPU milliseconds are process CPU time, **not wall-clock freeze duration** and not machine-wide percentage. Peak percentages are normalized to one logical CPU, not eight-core utilization.

Normal-profiling median window CPU: Bugs real Node **89.8 ms** versus Chromium renderer **2710.5 ms**; replay Node **16.0 ms** versus renderer **2732.4 ms**. Sort Node median **47.0 ms real / 0 replay**; filter **46.0 / 0**. Theme and scroll both **0 Node CPU** in every measured sample. Normal-profiling Node peak sampling bins were approximately 17–18% of one core for real A/B; not a sustained saturated server.

The timestamp-OFF replay controls show a transient **406 ms Node CPU** window followed by **0 ms** in the next window; corresponding browser tasks remain **599 / 610 ms**. The transient is not attributed to a Bugs query (none ran). Residual server/GC/preparation activity is not isolated. This variation does not support Node CPU as necessary or dominant, but also means replay cannot be described as universally eliminating all Node work.

Observed Node RSS approximately 138–174 MiB in the initial real A/B groups; renderer JS heap maxima approximately 32–57 MiB. Browser full-process working-set/paging history was not captured. CDP metric requests can wait behind a blocked renderer, so 250-ms browser bins are approximate and cannot establish sub-frame CPU causation. No separate server environment was used; no power setting, unrelated process or user service was changed. Reference CPU and **Balanced** scheme were read back: i3-1215U, 6 physical / 8 logical cores.

## D. Confirmed paths, root-cause scope, and hypotheses

### 1. Bugs synchronous activation and repeat update — high confidence at path level

Exact path: `src/app/page.tsx` active-tab entry → `BugFixPanel` active table in `src/components/BugFixPanel.tsx` → `useBugFixes.loadBugFix` in `src/hooks/use-bugfixes.ts` → `setBugFixItems` after a new response.

Repro: warm Bugs once, return to Cases, enter Bugs again with the unchanged fixture. The cached 75-row active panel blocks before the refresh request; after the identical dataset arrives, another render/task occurs. In the timestamp-OFF controls, post-response tasks are **119–163 ms**, in addition to the **584–723 ms** pre-request task. Root Profiler callbacks record multiple updates/nested updates; their exact effect/subtree shares are not isolated.

Profiling support: first replay trace has 1,080.7 ms max FunctionCall, 117.3 ms style, 29.6 ms layout, 13.9 ms paint, but is timestamp-biased. The second profile identifies React timestamp overhead and also samples Radix Presence animation-name reading and `BugFixPanel` date formatting. The controls and ordinary Phase 4 trace demonstrate that browser activation still stalls without that timestamp cost.

Smallest proposed fix: first preserve unchanged BugFix row identity on equivalent refresh and memoize the table row boundary; measure activation/commit effects separately. Investigate lazy activation of closed status selectors with a component-scoped A/B **before** adopting the Cases dormant-selector approach. Preserve status semantics, focus, keyboard support and all rows.

**Not yet confirmed:** how many milliseconds are caused specifically by the 75 Radix Select trees. Presence reads/date formatting are observed work, not proof a dormant selector change will remove the entire stall. No such optimization was implemented.

### 2. Cases selector/table invalidation — high confidence browser-side, medium exact cause

Exact paths: `useTestCases.loadTestCases` / `reconcileRows` in `src/hooks/use-testcases.ts`, and `TestCaseTable` / `TestCaseTableBody` including `TestCaseDataRow` and `TestCaseDataCells`.

Repro: 100 loaded Cases → ID descending then ascending; open module filter → Checkout. Sort reorders 100 rows; filter opens selectors and replaces the visible set with 50 rows. Ordinary Phase 4 style/layout costs and current replay trace corroborate browser update work with database removed. Replay filter still produces pre-request selector tasks and subsequent table tasks.

Smallest proposed fix: profile selector opening separately from the response-driven row update; reduce avoidable row/cell invalidation while retaining existing reconciliation and mounted-column semantics. Consider local layout containment only after matched browser proof. Do not reduce visible rows, remove columns or introduce broad virtualization speculatively.

### 3. Theme global style invalidation — high confidence category, medium exact selector

Exact path: `applyTheme` in `src/components/Providers.tsx`, `createThemeTransitionGuard` in `src/lib/client/theme-transition.ts`, root dark-class change and scoped transition rules in `src/app/globals.css`.

Repro: loaded 100-row Cases → Light / Dark. Zero API and Node CPU observed; root React render is small, while ordinary Phase 4 style work reaches 210.4 ms. This is a global browser style/presentation path, not Prisma.

Smallest proposed fix: isolate dark-class invalidation from transition-guard changes, then narrow only proven expensive selectors/style propagation. Preserve OS theme, reduced motion and focus. Previous Phase 4 CSS experiments were inconclusive; removing guards or animations wholesale is not justified.

### Additional confirmed measurement defect / unresolved hypotheses

- **Profiler timestamp overhead is confirmed** in the separate profiling bundle. Source mapping by generated chunk location identifies `rw` calling `console.timeStamp`; controlled suppression reduces Bugs long tasks without a product source change. This is not a defect in the ordinary-production app build.
- Hover/sticky paint contribution to scrolling, GPU/compositor scheduling, individual focus/scroll-lock costs, CPU thermal/power throttling and exact external contention remain hypotheses. No full system trace was taken.
- SQLite lock contention, heavy weight-map computation or oversized JSON parsing are **not demonstrated** by this fixture. Larger real datasets may behave differently.

## E. Ranked Phase 5B recommendations

| Rank | Scoped task | Measured reason / expected benefit | Risk and regression guard |
|---|---|---|---|
| 1 | Bugs activation + equivalent-refresh reconciliation; instrument closed-selector subtree before a dormant-selector change | Largest reproduced application freeze, ~0.6 s even with replay; another 119–163 ms task after refresh. Reduce synchronous mount/effect and redundant update work; no percentage promised. | Medium. Verify all bug statuses, active/resolved filters, stable IDs, date copy, keyboard/focus and detail opening. Ship lazy selectors only if component A/B supports it. |
| 2 | Cases sort/filter row/cell and selector invalidation | Replay and ordinary traces retain style/layout/JS stalls; API handler ~12 ms is not the main optimization opportunity. | Medium. Preserve pagination, selection, latest-request guards, UUID/display ID, saved filters and canonical updates; separate selector action from data commit. |
| 3 | Theme invalidation isolation and targeted style narrowing | Backend-free stalls; ordinary trace style cost 210.4 ms. | Medium. Preserve both themes, OS changes, reduced motion and current motion/focus behavior. Require matched controls before CSS changes. |
| Later | Scroll hover/sticky paint investigation | Smaller 0–51 ms tasks here; Phase 4 paint/scheduling issue still unresolved. | Low-to-medium targeted work; do not hide table content to improve metrics. |

Measurement prerequisite: use ordinary production for user-visible latency, with a separate opt-in profiler pass for attribution; disclose timestamp overhead. **No backend refactor recommended now.** Parallelizing Bugs count/findMany might save a few awaited milliseconds, but is not supported as a solution to the freezing problem.

## F. Evidence, provenance and limitations

### Identity and isolation

- Main source SHA: `6a6ad38c8fb9d3551dca0e28af968c1c17d2ddb1`; branch unchanged: `codex/frontend-design-system-motion-optimization`.
- Diagnostic production build ID: `ywvgQGLFQVCQFbIEFfAg2`, verified against its served build manifest. Built once with existing `QA_PERF_PROFILING=1` and `NEXT_PUBLIC_QA_PERF_PROFILING=1` support.
- Owned copy: `C:/Users/Admin/.codex/worktrees/qadesk-phase2-baseline/QA-Web`. Compared 344 relevant tracked runtime/config/public/schema/script files against main: only four diagnostic edits differ (`db.ts`, the two GET routes, `weight-service.ts`), plus added `perf-diagnosis.ts`.
- Diagnostic patch content SHA-256: `5eb8fd9b8115239f8783379d8e2475299a2907815c3b32a6fa8adcafaa004372`. Instrumentation is default OFF via `QA_PERF_DIAGNOSTICS`; query/stage logs contain numeric timing and fixed operation labels, not SQL/params/payloads. It exists only in the owned diagnostic copy, not main source.
- Fresh SQLite backup per launch; 150 testcase rows. Canonical two-page testcase API hash: `272f60d390184f2326864bc739afb52802c538c89b7b771e4a29a859fb1500e9`, matches Phase 4.
- Replay Bugs response hash: `0930a441d908ef6eb5a86cbf05e0dfed85be6d13468e7481815f74903098fdf7`; ascending Cases: `5f2c221c9ad3cbe4224f81fcfb036d5124db93edb287830245f57fa1980bd030`; Checkout: `adeb5c80a6217dcaad086f2894b64f45dba3fc5220529f31e478b717d4dc9019`. Full query keys, sizes and other hashes are in `results.json`.
- Chromium `149.0.7827.55`, headed Playwright, 1440 × 900, Windows, Node v24.19.0. The Browser plugin was unavailable; regular Playwright/CDP was used. No new dependencies.
- Loopback **3105** only. HTTP/WS access to relay 3001 mocked inside the diagnostic browser. User services were independently restarted by the user during the pause; resumed baseline PIDs 3000=`15920`, 3001=`32396` remained unchanged through our experiments. Owned 3105 was stopped.

### Sample count and artifacts

Four experimental groups only: A navigation; B sort/filter; C negative controls; D CPU/memory observed alongside them. Warm-up precedes each configuration.

- A: 3 normal-profiling repetitions per real/replay configuration; 2 additional timestamp-OFF controls per configuration. Groups kept separate.
- B: 3 initially, expanded to **5** per real/replay sort/filter because of drift. No ten-repetition sweep.
- C: 3 theme and 3 scroll samples. D uses their process samples rather than an artificial stress test.
- Total: **36 completed non-trace samples**, plus **3 trace samples**: one Bugs replay trace, one Cases filter replay trace, and a second Bugs trace with CPU profiling to investigate overhead. Existing Phase 4 sort/theme/scroll traces reused; no new responsive/E2E matrix.

Artifacts under `C:/Users/Admin/AppData/Local/Temp/`:

| Path | Purpose |
|---|---|
| `qadesk-phase5a-oct14/results.json`, `server.jsonl` | Initial 24 non-trace samples plus 2 traces; pipeline, CPU, replay hashes, stage/query timings |
| `qadesk-phase5a-oct14/cases-bugs-replay-trace.json` | Initial timestamp-biased Bugs trace |
| `qadesk-phase5a-oct14/cases-filter-replay-trace.json` | Replay filter trace, including one notification poll |
| `qadesk-phase5a-oct14-extra/results.json`, `server.jsonl` | Four completed added real sort/filter samples before harness replay-cache failure |
| `qadesk-phase5a-oct14-extra-recovery/results.json`, `server.jsonl` | Four added replay sort/filter samples; second Bugs trace |
| `qadesk-phase5a-oct14-extra-recovery/cases-bugs-replay-trace.json`, `bugs-cpu-profile.json` | Attribution/overhead diagnostic, not pooled with primary samples |
| `qadesk-phase5a-oct14-timestamp-control/results.json`, `server.jsonl` | Four Bugs samples with timestamp logging suppressed |
| `qadesk-phase5a-oct14/analysis.json`, `source-provenance.json` | Derived per-sample values and runtime source comparison |
| `qadesk-phase5a.cjs`, `qadesk-phase5a-analyze.cjs` | Focused harness and analysis; no repository test-suite changes |
| `qadesk-phase2-phase4-oct14-final-trace-b/` | Reused ordinary-production traces; see Phase 4 report for complete prior evidence |

The initial run contains **24** non-trace samples (A 6, B 12, C 6); added real 4 + replay 4 + timestamp controls 4 = **36** non-trace samples overall.

### Failures, overhead and boundaries

The first extra run's uncached Bugs replay raised a **harness error** before its planned trace/replay samples; the four earlier completed real B samples remain valid and preserved. Recovery pre-recorded and warmed Bugs, then ran only missing replay samples. No product failure was inferred. Completed runs report no page errors. Source/build were not repeatedly rebuilt.

Timing overhead includes production React profiling, component timestamp instrumentation, bounded observers, fetch-body/parse wrapping, Prisma extension/event logging, and nominal 250-ms CPU collection. Exact total probe overhead was not calibrated; the CPU profile and timestamp control expose a material part. Trace-enabled samples are separate; no A/B percentage gain, ordinary-build regression magnitude or 60 FPS claim is made from them.

Synchronous JSON parsing is measured; pure Prisma engine execution has coarse resolution; handler/HTTP gaps include proxy/auth, framework, delivery and client scheduling. React profiling does not time DOM commit/paint. Trace events are nested: union time is computed within each category, **never summed across JS/style/layout/paint**. CPU sampling is not a contention intervention. Short sequences are enough for category diagnosis, not comprehensive production capacity, SaaS readiness or a quantified fix benefit.

Main repository changes from this task: **this report only**, local and uncommitted. Impeccable guided renderer/visual-interaction attribution; API QA Inspector and React guidance were used for pipeline separation. Graphify, full audits, unit/E2E/responsive reruns, business changes and speculative fixes were deliberately not performed.
