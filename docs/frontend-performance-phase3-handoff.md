# QADesk Phase 2 + Phase 3 performance handoff

Date: 13 October 2026, Asia/Bangkok.

**Overall performance acceptance: NOT PASSED.** Useful targeted fixes are present, but this is not a claim that all workflows now run at 60 FPS. The user requested that the currently running benchmark be the last test, followed by commit/push for discussion with another AI. Further experiments and final browser verification therefore stopped at that boundary.

## A. Git and local changes

- Branch: `codex/frontend-design-system-motion-optimization`.
- Starting HEAD: `bec3fa152962645a39c66a78b4052f9bb6eb6e73`.
- Baseline: the **uncommitted Phase 2 source**, preserved in the managed `qadesk-phase2-optimized` worktree. The older committed version is not the Phase 3 comparison baseline.
- Phase 2 retained: committed callback wrappers, row reconciliation, inspector/fullscreen render boundaries, bounded network/console content, latest-navigation-intent handling, responsive chat viewport fixes, production fixture/E2E infrastructure and opt-in profiling.
- Phase 3: dormant status selectors, memoized status/data-cell boundaries, transient theme-transition guard, shared Select trigger styles, focused tests, independent benchmark scenarios, build/fixture identity checks and diagnostic modes.
- No backend, API contract, schema, auth, real relay, user database or `.env` changes.
- No pre-existing files were reset, reverted, discarded or stashed. Unrelated `.codex/`, `.mcp.json`, CV, instructions, IKF automation files/results and `graphify-out/` are excluded from the commit.
- The original prohibition on Git mutations was superseded by the user's explicit final instruction to commit and push. No PR is requested.

Task files: the frontend/config/E2E changes listed by Git, the three performance scripts, this handoff and benchmark documentation, plus `TestCaseStatusCell`, `use-committed-actions`, `chat-viewport`, `reconcile-rows`, `theme-transition` and their tests. Generated screenshots, traces and fixture databases remain outside Git.

Before staging, 16 unchanged Phase 2 application/helper/config files were SHA-256 checked against the preserved baseline and matched exactly. The remote branch was still at the starting HEAD.

## B. Confirmed causes, fixes and hypotheses

### Cases search, clear and sort

Stable UUID row keys were already retained by Phase 2. Sorting changes ordinal indices and invalidates the entire memoized row, including unchanged controls and content. Profiling also showed repeated status-selector mounting/collection work and subsequent row commits.

Changes:

- A closed status cell starts as an accessible native trigger using the **same shared styles** as the original Select trigger. The original Radix Select mounts when activated by click, Enter/Space, ArrowUp or ArrowDown. Once activated it remains mounted to preserve Radix focus restoration.
- Memoized status cells exclude ordinal/selection props.
- `TestCaseDataCells` separates unchanged data/control content from the row shell's index and selection state. UUID keys, row-click exclusions, sticky columns, menus, statuses and callbacks remain unchanged.
- No virtualization or new table library was introduced.

Chrome baseline traces from 12 October: clear search FunctionCall work approximately 227–237 ms, Layout 16–22 ms, UpdateLayoutTree 33–40 ms and Paint 47–73 ms; sort FunctionCall work approximately 182–247 ms. Trace aggregates can overlap/nest and are **not exclusive CPU totals**.

The final data-cell boundary has normal-browser measurements, but **has not received a new React Profiler or production E2E run**. Do not attribute the earlier profiler numbers to that final extraction.

### Theme switch

This is not primarily a React render problem. One baseline trace recorded 5,744 transition starts and approximately 68,970 calls to the compiled delegated event-dispatch function. Diagnostic suppression of color transitions removed that event storm. Large-DOM style recalculation and paint remain.

Fix: `createThemeTransitionGuard` marks the palette flip, keeps transform/opacity transitions, restores ordinary hover/color transitions after two animation frames, and uses a generation counter so overlapping flips cannot clear a newer guard early. System-theme changes use the same path. Reduced-motion behavior is retained.

**Unconfirmed hypothesis:** the broad descendant guard may itself contribute to style invalidation. The `scoped-theme-guard` benchmark diagnostic was added but **never run**; no narrowed production selector was implemented. Do not describe that hypothesis as proven.

### Scroll, sidebar, navigation and inspector

12 October normal baselines showed scroll P95 17.0–17.1 ms and zero long tasks; sticky-off, simplified paint/cells, 20/50 rows and shell-hidden diagnostics also had zero long tasks. The original regression was not consistently reproducible then.

13 October scroll became substantially slower, and a repeated Phase 2 run improved sharply without source changes. Therefore the apparent A1→B improvement is not sufficient to claim the scroll regression fixed. No speculative removal of sticky columns or permanent feature reduction was applied.

Phase 2 navigation correctness and inspector optimizations are preserved. Separate secondary scenarios were measured on 12 October, but their three repetitions are exploratory, not final ten-sample acceptance. One early navigation harness run waited only for URL and failed during settlement; the corrected harness also waits for the active-menu state. No application navigation fix was inferred from that harness failure.

Impeccable governed appearance-preserving optimization and shared hover/focus styles. Its detector returned no findings before the final row-boundary extraction. Final responsive/visual inspection was not completed after that extraction.

## C. Before/after performance

### Method

Headed Chromium, 1440×900, one warm-up and **10 measured repetitions per primary scenario**. Production standalone only. Normal builds disable React profiling; diagnostic profiling builds are separate. No build/install/test processes were intentionally overlapped with browser measurements.

Measurements are rAF callback intervals and Long Tasks, **not exact compositor FPS or standardized INP**. Input feedback is event-to-next-rAF. Windows background activity/power/GPU conditions were not fully controlled; the observed CPU is an Intel i3-1215U with Balanced power scheme. No user power settings or unrelated processes were changed.

All three 13 October runs have matching fixture SHA-256:
`54924f6e686ea511f8fa2ce5a24c7d79ee197286c808db17585c030f2333a086`.

### Comparable normal measurements, 13 October

Each cell below is **median / P95 / P99 ms; long-task count / maximum ms**. A1→B→A2 order was used. A2 repeats clear/module with larger matched windows to avoid A1 overruns.

| Action | Phase 2 | Phase 3 | Verdict |
|---|---|---|---|
| Search, 1800 ms window | A1: 16.70 / 100.10 / 566.70; 47 / 722 | 16.70 / 66.60 / 149.90; 40 / 138 | Lower stalls; still not consistently 60 Hz |
| Clear search, 4000 ms | A2: 16.70 / 33.40 / 166.50; 23 / 1271 | 16.70 / 33.30 / 100.00; 26 / 676 | Maximum stall reduced; remaining large outlier |
| Module, 5000 ms | A2: 16.70 / 33.50 / 267.10; 66 / 769 | 16.70 / 33.30 / 199.90; 65 / 528 | Modest improvement; incomplete |
| Clear module, 5000 ms | A2: 16.70 / 83.30 / 399.90; 60 / 1361 | 16.70 / 50.00 / 266.70; 61 / 638 | Stall reduction; incomplete |
| Scroll, 3000 ms | A1: 16.90 / 66.70 / 83.30; 95 / 73. A2: 16.70 / 33.30 / 50.00; 4 / 54 | 16.70 / 50.10 / 66.60; 41 / 64 | Inconclusive; candidate worse than repeat baseline |
| Theme, 10000 ms | A1: 16.70 / 183.60 / 1149.90; 123 / 1400 | 16.70 / 32.70 / 549.80; 118 / 970 | Better distribution, severe stall still present |

Sort is **not a valid final frame comparison**: Phase 2 A1 1800 ms P95 50.10 ms/max task 1048 ms; candidate 1800 ms P95 66.70 ms/max task 650 ms had **3 window overruns**. Phase 2 A2 4000 ms P95 17.10 ms/max task 1158 ms had no overruns, but the candidate was not repeated at 4000 ms before the user stopped testing. Do not hide the apparent regression or claim sort passed.

A1 clear-search had 3 overruns; A1 module and clear-module had 10 each. Their frame summaries are excluded from the matched table above. Candidate clear/module and A2 matched runs have no overruns.

### Variability and input feedback

| Action | Phase 2 sample P95 min–max | Phase 3 sample P95 min–max | >17.5 ms %, Phase 2 → Phase 3 |
|---|---|---|---|
| Search | 83.20–200.00 | 50.00–83.30 | 29.30 → 11.67 |
| Clear search | 17.60–83.20 | 17.50–99.90 | 7.69 → 7.07 |
| Module | 17.40–100.10 | 17.20–50.10 | 8.51 → 6.83 |
| Clear module | 66.50–99.90 | 17.00–166.50 | 13.77 → 8.70 |
| Scroll | A1 66.50–83.20; A2 33.20–50.00 | 50.00–66.50 | A1 47.20; A2 11.65 → 35.77 |
| Theme | 99.90–533.50 | 17.40–133.20 | 10.39 → 5.91 |

Search event-to-next-rAF P95: 83.30→74.30 ms. Clear-search feedback P95: matched baseline 43.70→36.40 ms. Neither is INP.

### Separate React Profiler diagnostics, 12 October

These precede the final data-cell extraction; 10 repetitions each.

| Action | Phase 2 React P95 ms | Earlier Phase 3 React P95 ms |
|---|---:|---:|
| Search | 46.4 | 29.9 |
| Clear search | 92.3 | 76.1 |
| Sort | 82.7 | 71.6 |

Earlier candidate inspector open/close React P95: 7.3/14.9 ms. No aligned final inspector/sidebar/rapid-navigation profiler comparison was completed.

Secondary candidate normal results, 12 October, **3 repetitions only**: rapid navigation P95 17.4 ms/max task 64 ms; inspector open 17.4/149; close 17.2/73; sidebar collapse 17.1/0; expand 17.2/52; fullscreen 18.4/93; recording playback 17.2/0. These are exploratory and do not establish final acceptance.

### Evidence locations

Local raw files are intentionally not committed:

- `%TEMP%/qadesk-phase2-phase3-20261013-baseline/results.json`
- `%TEMP%/qadesk-phase2-phase3-20261013-candidate/results.json`
- `%TEMP%/qadesk-phase2-phase3-20261013-baseline-valid/results.json`
- `%TEMP%/qadesk-phase2-phase3-current-baseline/results.json`
- `%TEMP%/qadesk-phase2-phase3-baseline-repeat/results.json`
- `%TEMP%/qadesk-phase2-phase3-candidate/results.json`
- `%TEMP%/qadesk-phase2-phase3-phase2-profiler/results.json`
- `%TEMP%/qadesk-phase2-phase3-profiler/results.json`
- `%TEMP%/qadesk-phase2-phase3-baseline-trace/*.trace.json`
- `%TEMP%/qadesk-phase2-phase3-theme-no-color-valid/*.trace.json`
- `%TEMP%/qadesk-phase2-phase3-scroll-*` and `diagnostic-*`

Diagnostic limitations: empty Cases uses intercepted responses, 20/50 removes DOM rows only, hidden shell does not stop its React work, and system-media theme switching must be compared only with the same method. One full-scroll trace had LayerTree instrumentation and P95 33.3 ms; that trace is confounded and not normal acceptance. Failed setup/navigation diagnostic runs were discarded.

## D. Production verification

- Baseline build: `QkIYdcbeeC9hrOvoyykW7`, loopback port 3100, managed `qadesk-phase2-optimized` worktree.
- Candidate normal build: `s4RW1r_edhaCt2I9HLePb`, port 3101, managed `qadesk-phase3-optimized` worktree; `npm run build` succeeded. Served manifests matched the local build IDs.
- Startup: `node .next/standalone/server.js`; fixed Temp synthetic SQLite database, explicit loopback origin and non-secure test cookie settings.
- Node 24.19.0, Next 16.2.4, React 19.2.5, Playwright 1.61.1, Chromium 149.0.7827.55, Windows 10.0.26200.
- Fixture: 150 cases, 120 bugs, 100 automation runs, 60 executions. Relay HTTP/WS intercepted with 500 synthetic events. Native H.264 10-second video, 640×360, 30 FPS. No actual capture relay contacted.
- TypeScript passed before the last ARIA attribute adjustment.
- Unit suite: **172 passed, 1 skipped, 44 passed files/1 skipped file** on repeat with one worker. The preceding concurrent run had two timeouts (notification service and devlog SQLite), not failed assertions; they passed on repeat without changing test timeouts.
- Lint initially found a benchmark variable named `module` and a missing `aria-controls` warning. Both were fixed. **Lint was not rerun after these edits.**
- The normal benchmark build includes the final data-cell boundary but **predates the small `aria-controls`/popup-ID adjustment**. No later rebuild was performed after the user's stop-testing instruction.
- Newly added production E2E assertions for status keyboard/focus, sorting/selection, tabs/fullscreen and theme guard were **not executed in Phase 3**. Final Phase 3 responsive matrix was **not executed**. Phase 2's prior passes must not be presented as current Phase 3 evidence.
- Browser plugin was unavailable; regular Playwright was used. Browser wheel is not physical touchpad verification.
- Graphify incremental synchronization completed: 4,203 nodes, 12,330 edges, 248 communities. It warned that `.last-run.json` produced no nodes, two existing Katalon Groovy templates have syntax errors at line 27, and community labels are stale after the community set changed (67 renamed by hub). No extra LLM relabeling was run. These graph gaps are not a frontend build/test result; graph output remains excluded from Git.
- An earlier accidental root build was canceled and never used as acceptance. Root `.next` artifacts may be partial; user ports 3000/3001 were not stopped or rebuilt. Only owned benchmark servers are stopped at handoff.

## E. Remaining issues, ranked

1. **Scroll acceptance unresolved:** large same-source variance; candidate is slower than the repeated baseline. Capture aligned paint/style/composite traces on a stable machine before selecting a fix.
2. **Sort acceptance unresolved:** repeat candidate at the same 4000 ms window and profile the final row/data-cell boundaries. Investigate remaining mount/commit costs; do not infer success from the earlier profiler alone.
3. **Theme still has a 970 ms stall:** trace style invalidation and paint separately from React. The narrowed guard diagnostic is untested and remains a hypothesis.
4. **Clear/filter outliers remain 528–676 ms:** improvement is real in these runs, but latency is not yet acceptable for a consistently fluid workflow.
5. **Final correctness gates unfinished:** rerun lint, typecheck, full tests, normal build, production E2E and responsive/keyboard verification against the exact final source before claiming release readiness.
6. **Inspector/sidebar/navigation final acceptance incomplete:** retain existing Phase 2 benefits; investigate layout/portal/focus/video costs with aligned independent runs, not a broad AppShell rewrite.

Reproduction flags and isolated fixture safeguards are documented in `frontend-performance-benchmark.md`. Keep profiler diagnostics separate from normal timing, use matching fixture/build identity, do not alter user databases or ports 3000/3001, and retain latest-navigation-intent correctness.
