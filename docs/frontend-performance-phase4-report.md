# Phase 4 final acceptance — 14 October 2026

**Verdict: PERFORMANCE ACCEPTANCE FAILED.** Final functional verification is complete for the requested scope. The reference machine does not consistently meet the smooth 60 Hz objective; this is not release certification.

No stage, commit, push, merge, PR, branch switch, or reset was performed. Corrections remain local. User databases, accounts, environment files, recordings, and services on 3000/3001 were not modified. All acceptance tests used owned 31xx standalone servers and synthetic fixtures. The final build was **not installed over the user's port-3000 build**.

## A. Final quality gates

| Check | Result | Evidence / scope |
|---|---|---|
| Lint | PASSED | `npm run lint`, exit 0; final command session 72292 |
| Typecheck | PASSED | `npm run typecheck`, exit 0; session 16475 |
| Full unit suite | PASSED, preparation flake disclosed | **184 passed, 1 skipped; 46 files passed, 1 skipped**, 18.06 s; controlled full run session 3535 |
| Production build | PASSED | `npm run build`, exit 0; session 48697. Compile 57 s, build TypeScript 41 s, 37 static pages. Build `-m0z-9AjKYcsr1puqRHsk` |
| Production E2E | PASSED | **15/15**, 2.1 min; session 38590 and `C:/Users/Admin/AppData/Local/Temp/qadesk-phase4-oct14-fixed-e2e/.last-run.json` |
| Responsive visual regression | PASSED for scoped matrix | **120 screenshots**: 6 widths × 2 themes × (8 menus + inspector + chat); overflow/alignment/sticky/bounds/page-error checks passed |
| Status selector regression | PASSED | **9/9** scenarios in `e2e/status-selector.spec.ts`, included in the final 15-test run |
| Accessibility regression | PASSED for exercised interactions | Keyboard activation/dismissal, focus restoration, inspector tabs, DevLog keyboard expansion, reduced motion, OS theme, Back/Forward/reload; not a full WCAG/screen-reader audit |
| 60 FPS animation acceptance | **FAILED** | Final 29-scenario × 10-sample benchmark and Chrome presentation traces show repeated long frames / imperfect presentation |
| Operation responsiveness | **FAILED** | Filter, theme, status and navigation still cause stalls; input-to-next-rAF proxy exceeds 200 ms in several scenarios |

Browser plugin/`browser` skill was unavailable, so the established regular Playwright/CDP fallback was used. No browser dependency, framework, schema, business rule, or component library was replaced.

### Functional coverage

- Status: mouse/Enter/Space/ArrowDown/Up, Escape/outside dismissal, trigger focus restoration, all seven statuses, one mutation per choice, persisted-state read-back.
- Cases: sorting/search/pagination; active-filter removal after save; stale GET cannot overwrite PUT; server-normalized Retest; pending save refreshes latest query; responsive column mounting and saved preferences.
- Inspector: nine tabs, retained tab across testcase navigation, narrow viewport and reduced motion.
- Navigation: eight menus, **24 same-project transitions** with same-DOM sentinel, latest intent, Back/Forward and reload.
- QA workflow: execution → evidence → bug → retest → report.
- Final recording/DevLog proof: keyboard Network expand/collapse, Use retains Headers + Payload, play/seek, fullscreen close, Escape retains inspector, wheel scroll **12 → 412 px**. Video duration 10 s, readyState 4, no video error.
- Responsive widths: **320, 360, 390, 768, 1280, 1440**, light/dark. Ready-data waits precede screenshots; skeleton captures are not treated as visual completion. Header/cell counts and rectangles align; ID/action remain sticky at two already-pinned scroll positions. All tabs at desktop and chat minimize/restore were exercised. Representative final screenshots were visually inspected; minor incumbent narrow-word wrapping is not a redesign trigger.
- HTTP/WebSocket relay traffic on 3001 was mocked with synthetic events/video. Viewer/workspace integration was verified, **not real external manual capture or the user's live relay**.

### SQLite timeout investigation

The test owns a unique `fs.mkdtempSync` directory and empty DB. Assertions and **30,000 ms timeout remain unchanged**. Diagnostic timing surrounds the existing Prisma CLI preparation, without changing behavior.

| Full-suite run | Schema preparation | Outcome |
|---|---:|---|
| Previous controlled full suite | 4,687 ms | 184 passed / 1 skipped; 33.88 s |
| Run while lint/typecheck remained active | **46,760 ms** | 183 passed / 1 timeout / 1 skipped; 73.57 s |
| Final controlled full suite after those commands finished | **3,416 ms** | 184 passed / 1 skipped; 18.06 s |

The reproduced timeout is in `spawnSync(prisma db push)`, **before DevLog assertions begin**. Final total test time was 3,543 ms, approximately 127 ms after preparation. This localizes the issue to preparation/process/schema-engine latency, not a reproduced deduplication/cursor/recording defect. Resource contention is consistent with the observations; the exact OS/filesystem cause is **not proven**. Shared SQLite locking is not established because the test uses a unique DB. The entire suite was rerun, not just the failed test.

This remains a tooling flake under contention. Serialize heavy quality gates; do not increase timeout or weaken assertions. Negative/fallback unit paths logged missing DATABASE_URL while running without user environment. E2E preparation logged three schema-engine errors before its existing migrate-diff / dedicated-SQLite fallback succeeded; warnings are disclosed, not hidden.

## B. Phase 3 versus final Phase 4

### Source, environment, reproducibility

| Item | Baseline A | Final candidate B |
|---|---|---|
| Source | `66f4427c271632348015d2aefb6a54428d56c753` | `e486f8fc3f10d0676332ac16f5a4ac88e67547d1` plus local fixes |
| Build | `wEvXXmw-MDKR_mqi4LQQ9` | `-m0z-9AjKYcsr1puqRHsk` |
| Owned worktree | `C:/Users/Admin/.codex/worktrees/qadesk-phase3-optimized/QA-Web` | `C:/Users/Admin/.codex/worktrees/qadesk-phase2-baseline/QA-Web` |
| Source verification | **301 runtime files**, zero CRLF-normalized mismatches with archived baseline source | **447 tracked files**, zero byte mismatches with workspace immediately before final testing |
| Snapshot SHA256 | Baseline archive: `f4e988dc48a5bef2a2241b2b0d78770a3c14c638a4162fcdea43d6754c302cd5` | Pre-report path/content hash: `d53e6bb19439efa0f3bb0fb865b0350e1e08a60ef51240b9f40b054a25d963fe` |

Copied worktrees have older detached Git HEADs: file equality and served build-manifest bytes identify the tested source, not those HEADs. Updating this non-runtime report after the build changes the all-tracked-file hash, not the tested runtime.

Reference: Windows, Intel i3-1215U / Intel UHD Graphics, driver 32.0.101.7082, **60 Hz** display confirmed by WMI, unchanged Balanced power plan. Node 24.19.0, Next 16.2.4, React 19.2.5, Playwright 1.61.1, headed Chromium **149.0.7827.55**, **1440 × 900**, ordinary production build / no React profiling flag. GPU compositing/raster/video decode enabled in CDP. Synthetic video is 30 FPS; UI target is separately 60 Hz. User background applications were not closed; thermal/frequency conditions were not controlled.

Matched workload:

- Same frozen harness `scripts/benchmark-production.mjs`, SHA256 **`84fde509de4a1596ca6498e7741846f7cf48f10dc17e04d41a8a21c18fff35e5`**.
- Same browser/settings/viewport, action order, **1 warm-up + 10 measured repetitions per primary scenario**.
- Same initial fixture hash **`272f60d390184f2326864bc739afb52802c538c89b7b771e4a29a859fb1500e9`**: 150 testcases, 3 modules, 120 bugs, 100 runs, 300 persisted events, 60 executions; 500 mocked relay events, representative Network payloads and 10-second video.
- Separate synthetic SQLite backups. Cases operations use **100 visible rows**; navigation is normalized on both builds to ascending / **10 rows** because baseline RSC remount resets query state while native history retains it. Status mutations run last.
- Foreground/focus, finite-motion settling, two rAFs and idle preparation are checked outside windows. No build/tests/Graphify/heavy trace analysis ran concurrently with primary measurement.
- Both primary runs complete **29 × 10 = 290 valid measured samples**, **0 window overruns, 0 focus changes, 0 page errors**; build manifests match tested worktrees.

Identical windows, ms:

```json
{"default":1800,"cases-scroll":6000,"cases-search":4000,"cases-clear-search":4000,"cases-sort-ascending":4000,"cases-sort-descending":4000,"cases-module":5000,"cases-clear-module":5000,"cases-status":4000,"inspector-tabs":3000,"network-expansion":3000,"recording-fullscreen-close":6000,"rapid-menu-navigation":8000,"recording-playback":4000,"theme-switch":10000}
```

### Measurement interpretation

**rAF callback intervals are not exact compositor FPS.** Full-window P95 includes idle time and can hide initial stalls. Active intervals overlap CSS event/elapsed windows, newly created WAAPI animations, or observed inline transform/opacity mutations. Associated hover/color feedback is included; this union is **not necessarily the main shell alone**. Initial mount stalls can precede a deferred animation; max long tasks and input feedback remain separate so that work does not disappear.

Long-frame % below means active rAF intervals **>33.3 ms**, not compositor drops. Raw >16.67/>17.5 fractions are retained, but near-16.7-ms timestamp jitter alone is not considered failure. Input → next-rAF is a responsiveness proxy, **not field INP**. Action duration includes Playwright actionability, multiple clicks and scripted waits, not pure API latency. Observed active duration is union-window P95, **not declared CSS duration or exact shell duration**. [Smoothness](https://web.dev/articles/smoothness), [Chrome Performance reference](https://developer.chrome.com/docs/devtools/performance/reference).

### Primary comparison

Values are **A → final B**, milliseconds except %. Every row has 10/10 measured samples. Row verdicts describe recorded pacing; near-budget rAF is not certification. Differences are observational, **not causal gain/regression claims**, because unchanged-baseline controls demonstrate drift.

| Scenario | Full rAF P95 | Active rAF P95 | Active long-frame % | Max long task | Observed active-duration P95 | Samples A/B | Verdict |
|---|---:|---:|---:|---:|---:|---:|---|
|sidebar-collapse|17.1 → 17.2|17.1 → 33.2|1.9 → 3.3|59 → 0|545.8 → 312.9|10 / 10|Near budget; not certified|
|sidebar-expand|17.3 → 17.2|17.2 → 17.4|1.6 → 2.2|0 → 0|554.8 → 307.9|10 / 10|Near budget; not certified|
|inspector-open|17.1 → 17.3|116.5 → 17.0|7.5 → 0.0|150 → 132|269.0 → 451.6|10 / 10|Near budget; not certified|
|inspector-close|17.4 → 17.2|17.2 → 17.0|1.6 → 0.0|76 → 83|371.1 → 378.0|10 / 10|Near budget; not certified|
|dialog-open|17.2 → 17.3|116.7 → 116.7|14.3 → 11.6|144 → 124|233.2 → 234.0|10 / 10|Pacing failed|
|dialog-close|17.3 → 17.3|66.6 → 49.9|16.2 → 12.0|89 → 59|150.0 → 150.0|10 / 10|Pacing failed|
|inspector-tabs|17.1 → 17.1|16.9 → 17.0|0.0 → 0.5|0 → 0|347.8 → 477.4|10 / 10|Near budget; not certified|
|cases-scroll|17.3 → 25.4|16.9 → 33.6|0.7 → 13.6|0 → 59|1395.8 → 1673.5|10 / 10|Pacing failed|
|cases-search|17.2 → 17.5|16.9 → 50.2|0.8 → 13.3|0 → 59|397.2 → 535.9|10 / 10|Pacing failed|
|cases-clear-search|17.2 → 17.4|17.1 → 33.3|2.9 → 4.4|66 → 257|632.9 → 621.2|10 / 10|Near budget; not certified|
|cases-sort-ascending|17.2 → 17.5|83.2 → 166.4|9.1 → 21.2|65 → 160|240.2 → 286.5|10 / 10|Pacing failed|
|cases-sort-descending|17.4 → 17.5|83.4 → 150.1|7.1 → 22.9|171 → 150|337.0 → 269.7|10 / 10|Pacing failed|
|cases-module|17.4 → 32.6|116.7 → 100.1|15.8 → 20.0|305 → 306|1108.3 → 1461.9|10 / 10|Pacing failed|
|cases-clear-module|17.5 → 18.5|66.6 → 166.6|12.0 → 23.4|261 → 247|1139.1 → 1157.4|10 / 10|Pacing failed|
|nav-dashboard-cases|33.5 → 50.1|50.3 → 116.9|24.0 → 81.5|86 → 141|778.4 → 493.2|10 / 10|Pacing failed|
|nav-cases-bugs|17.9 → 50.0|49.9 → 584.3|11.0 → 68.1|278 → 1377|1030.0 → 790.8|10 / 10|Pacing failed|
|nav-bugs-automation|17.3 → 50.0|33.3 → 383.0|5.5 → 76.8|70 → 408|628.3 → 464.2|10 / 10|Pacing failed|
|nav-automation-reports|17.7 → 17.7|33.3 → 116.9|5.3 → 6.8|171 → 141|949.6 → 250.2|10 / 10|Pacing failed|
|rapid-menu-navigation|17.4 → 66.5|33.3 → 166.6|4.1 → 46.0|130 → 586|3429.0 → 2838.8|10 / 10|Pacing failed|
|network-expansion|17.2 → 17.5|50.1 → 116.8|16.7 → 57.7|62 → 100|235.8 → 247.6|10 / 10|Pacing failed|
|devlog-fullscreen-open|49.9 → 33.2|150.0 → 316.3|100.0 → 90.9|173 → 338|269.6 → 125.2|10 / 10|Pacing failed|
|devlog-fullscreen-close|50.2 → 18.0|83.4 → 133.4|100.0 → 75.9|134 → 190|253.6 → 129.1|10 / 10|Pacing failed|
|recording-fullscreen-open|50.0 → 83.4|383.1 → 466.6|65.5 → 80.8|413 → 494|686.3 → 820.3|10 / 10|Pacing failed|
|recording-fullscreen-close|17.1 → 17.4|316.7 → 216.6|30.9 → 83.3|338 → 538|463.7 → 184.8|10 / 10|Pacing failed|
|recording-playback|17.0 → 33.4|— → —|— → —|148 → 60|0.0 → 0.0|10 / 10|No bounded UI motion|
|ai-chat-open|17.0 → 17.5|17.1 → 33.1|0.4 → 2.6|0 → 0|411.2 → 395.2|10 / 10|Near budget; not certified|
|ai-chat-close|16.9 → 17.5|16.9 → 17.3|0.0 → 0.0|0 → 0|503.9 → 495.2|10 / 10|Near budget; not certified|
|theme-switch|17.3 → 17.9|266.6 → 383.3|16.4 → 87.5|275 → 380|1605.7 → 720.0|10 / 10|Pacing failed|
|cases-status|17.0 → 33.1|266.6 → 66.8|17.0 → 30.8|317 → 329|481.4 → 720.8|10 / 10|Pacing failed|

Primary Inspector-open active P95 improves to 17.0 ms, but final traces still show initial stalls and imperfect presentation. It is **not consistently accepted**. Functional navigation/status/video passes do not override pacing failures.

Actual bounded motion captured in final samples: inspector/overlay in/out **220 ms**; Add Case dialog enter **220 ms**; sidebar label opacity **180–260 ms** and group-label margin/opacity **200 ms**; recording panel opacity/scale enter **200 ms**. Framer tab/menu/chat first/last mutation spans vary with scheduling. Add Case is conditionally unmounted on close (`src/app/page.tsx`), so no shell exit window exists in the capture: that row measures associated button feedback, not an invented exit animation. DevLog is an immediate geometry-mode switch after the unintended tween fix, not a separately authored entrance; its active window measures associated feedback. Recording close can coalesce timer/two-rAF style changes; no complete shell CSS exit window was captured. Raw window arrays explicitly retain these limitations.

### Operation responsiveness, separate from motion

| Operation | Input → next-rAF P95 A → B | Scripted completion P95 A → B |
|---|---:|---:|
|cases-scroll|— → —|1323 → 1746|
|cases-search|32.1 → 47.5|481 → 601|
|cases-clear-search|18.9 → 22.1|536 → 697|
|cases-sort-ascending|12.4 → 22.4|267 → 532|
|cases-sort-descending|24.7 → 24.5|474 → 487|
|cases-module|243.8 → 264.2|1579 → 1657|
|cases-clear-module|162.8 → 189.4|1682 → 1629|
|theme-switch|265.6 → 365.5|2201 → 2532|
|cases-status|302.6 → 298.8|1050 → 1126|

Wheel scroll has no input-event proxy here. Request/JSON/table-commit timing is separately retained in `samples[].requests` / `tableCommits`. Failure comes from UI/rendering stalls and delayed feedback, **not merely completion exceeding 16.67 ms**. Sorting/filtering/status persistence assertions still pass.

### Drift and contaminated evidence

Unchanged baseline repeats, full-window P95 / max task, ms:

| Scenario | A1 | A2 | A3 |
|---|---:|---:|---:|
|inspector-open|17.1 / 150|33.4 / 394|—|
|dialog-open|17.2 / 144|17.3 / 303|—|
|cases-scroll|17.3 / 0|17.2 / 0|33.4 / 58|
|nav-cases-bugs|17.9 / 278|35.7 / 384|49.9 / 349|
|recording-fullscreen-open|50.0 / 413|50.0 / 410|99.6 / 470|
|theme-switch|17.3 / 275|17.4 / 334|17.8 / 428|

A2: **8 × 10** samples. A3: **4 × 10** samples, same source/browser/harness/fixture/windows, no errors/focus loss/overruns. A3 recording P95 99.6 ms vs A1 50.0 ms demonstrates significant drift without source change; final B's 83.4 ms is therefore not a proven code regression. The final clean Bugs 1377-ms long task is real, but the exact extreme did not reproduce in traced samples (590.9 ms); precise attribution remains unresolved. Controls were repeated rather than trusting a single baseline.

In the pre-fix candidate, recorded WAAPI callback P95 was 0–0.2 ms, max 5 ms; CSS/inline callback P95 0.1–0.3 ms, max 1.2 ms. Callback timing does not capture every potential observer/style-flush side effect. An earlier **3-repetition / four-scenario no-motion/no-request-probe control** still had long tasks: inspector 165 ms, dialog 130 ms, recording 180 ms, theme 120 ms. It is diagnostic on the earlier build, not final-source acceptance or a causal overhead estimate. Final raw probe costs remain in JSON. Traced numbers are never mixed into primary P95s.

**Invalidated run `qadesk-phase2-phase4-oct14-fixed-b`:** user confirmed clicking an Automation status on **3103** during measurement. All samples from that run are excluded, including the **342-ms scroll stall**. Focus logs did not identify the intervention; absence of blur is not proof of isolation. Partial evidence is preserved with `RUN-INVALIDATED.md`. Replacement `qadesk-phase2-phase4-oct14-fixed-clean-b` uses a fresh synthetic backup and completes all 29 scenarios. No valid clean-run sample was discarded for being slow.

Confirmed changes are structural/functional: reduced Cases control/cell mounting, same-project shell continuity / reliable navigation, and removal of unintended geometry transitions. **No defensible overall 60 FPS gain or percentage speedup is claimed.**

### Final Chrome traces

Final source: **12 scenarios × 3 repetitions = 36 trace files**. Baseline trace uses the same scenario subset/windows/harness and repetitions. `qa-bench-anchor` aligns performance.now() to trace time. Work is restricted to the tested page's **CrRendererMain**. Costs below are maximum individual events across three samples, **not summed nested events or exclusive CPU totals**.

Presentation counts use tested renderer PID, `PipelineReporter ph=b`, within observed motion windows. `STATE_NO_UPDATE_DESIRED` is excluded; partial presentation is separate from drop. Counts are **page-level**, not per-layer exact FPS. Frame-start filtering/window boundaries and associated motion limit their interpretation.

| Scenario | FunctionCall max | Style max | Layout max | Paint max | RunTask max | Presented all / partial / dropped |
|---|---:|---:|---:|---:|---:|---|
|inspector-open|369.5|169.4|12.6|38.4|404.7|41 / 46 / 30|
|inspector-close|127.4|123.0|7.3|16.3|143.2|59 / 46 / 4|
|dialog-open|255.6|99.0|9.9|26.1|288.3|3 / 2 / 37|
|cases-scroll|1.6|13.0|4.6|20.9|83.6|171 / 237 / 28|
|cases-sort-ascending|45.0|79.0|52.1|29.7|178.6|27 / 29 / 3|
|cases-module|164.3|135.9|14.3|29.7|315.2|99 / 122 / 63|
|nav-cases-bugs|393.6|93.5|42.4|16.5|590.9|10 / 24 / 58|
|devlog-fullscreen-open|36.4|59.4|88.2|28.7|233.4|9 / 18 / 4|
|recording-fullscreen-open|171.8|203.9|186.9|53.5|515.4|9 / 89 / 16|
|recording-fullscreen-close|26.4|221.2|153.4|45.4|408.0|5 / 6 / 18|
|theme-switch|378.7|210.4|28.2|43.3|417.8|45 / 40 / 147|
|cases-status|146.9|125.3|6.2|22.0|275.4|66 / 66 / 32|

This corroborates substantial initial style/layout/JS work and imperfect presentation. A rAF stall is not automatically proof that every compositor-only layer stalled. Ordinary production React profiling is disabled; exact subtree attribution is not asserted. Raw trace flags for compositor/main animation and smooth input are retained.

## C. Corrections and remaining issues

### Verified local corrections

**APPNAV-001 — P1 navigation defect, fixed.** A prior full-source E2E reproduced Test Cycles → Traceability leaving the URL on test-runs. Sections re-export the same client workspace; RSC transitions could remount the shell while the next click landed. Same-project navigation now uses Next-integrated native History API; initial entry/project changes retain server routing. Dashboard refreshes on entry. Regression verifies active URL/item, same-DOM sentinel through 24 transitions, Back/Forward/reload. Final E2E/benchmark have no navigation timeout. This is functional proof, not proof of faster presentation. [Next History API guidance](https://nextjs.org/docs/app/getting-started/linking-and-navigating).

**PERF-FS-001 — P1 unintended fullscreen geometry transition, fixed; overall fullscreen still fails.** Nonzero duration utilities combined with the initial transition-property `all` animated inspector width/min-width/borders/radius for 220 ms. Captured CSS events and recurring layout confirm this. CSS now limits that inspector transition to opacity/transform/translate/scale/rotate. Authored 220-ms inspector entrance/exit and recording opacity/scale remain intact; geometry settles once. E2E checks transition properties/fullscreen width. Final fullscreen samples contain **zero inspector width/min-width/radius/border transition events**. No essential content, data rows, or status functionality were hidden to improve scores. Remaining mount costs are explicitly failed. [CSS transition initial values](https://www.w3.org/TR/css-transitions/).

### Remaining issues and reproducibility

Trace directory: `C:/Users/Admin/AppData/Local/Temp/qadesk-phase2-phase4-oct14-final-trace-b/`. Each listed scenario has `<scenario>-1.trace.json` through `-3.trace.json`. Category attribution is confirmed; suggested fixes are **not yet implemented**.

| ID / severity | Steps on synthetic fixture | Root cause / evidence | Suggested scoped solution | Blocks requested acceptance? |
|---|---|---|---|---|
| PERF-01 / P1 | Cases 100 rows → open inspector or Add Case → close/repeat | Modal activation/mount: JS/style tasks; `inspector-open` 404.7 ms, `dialog-open` 288.3 ms. Exact React subtree and focus/scroll-lock contribution not fully isolated. | Separate profiling build; isolate content mount vs focus/inert/scroll-lock invalidation; retain modality and essential controls. | **Yes** |
| PERF-02 / P1 | Automation → Network → DevLog/Recording Fullscreen → close | Geometry tween fixed; viewer/return still incurs style/layout/paint. Recording tasks 515.4 / 408.0 ms; layout 186.9 / 153.4 ms. `devlog-fullscreen-open`, `recording-fullscreen-open/close`. | Stabilize viewer layout invalidation and event derivation, bound independent payload rendering; retest Use, wheel, video, focus/close. | **Yes** |
| PERF-03 / P1 | Cases 100 rows → sort asc/desc → Checkout filter → clear | `cases-sort-ascending` style/layout 79.0/52.1 ms; `cases-module` task 315.2 ms, feedback 264.2 ms. Semantics pass; rendering cost remains. | Target proven table/selector work, preserve pagination/selection/UUID/canonical saves; causally validate containment/virtualization before shipping. Earlier CSS experiments were inconclusive and not applied. | **Yes** |
| PERF-04 / P1 | Cases → Bugs; cycle eight menus rapidly | Clean primary task 1377 ms / feedback 1387.5 ms; `nav-cases-bugs` trace reproduces 590.9-ms JS/style/layout task, not the exact extreme. Baseline also drifts. | Profile Bugs mount/row controls and transition overlap separately; do not attribute all delta to native history without a controlled causal comparison. | **Yes** |
| PERF-05 / P1 | Cases 100 rows → Light → Dark; change first testcase status | `theme-switch` task 417.8 ms, style 210.4 ms; `cases-status` task 275.4 ms. Primary feedback >200 ms. | Narrow measured style/selector invalidation while preserving OS theme/reduced motion/focus/seven statuses/server normalization/latest query. | **Yes** |
| PERF-06 / P2 | Scroll 100-row Cases with pointer over rows | Clean max task 59 ms; `cases-scroll` JS callbacks max 1.6 ms, paint max 20.9 ms; imperfect presentation. GPU/external scheduling contribution not proven. Contaminated 342-ms sample excluded. | Investigate hover/sticky paint with matched GPU/frame controls, without removing columns or reducing visible rows. | **Yes**, for strict smoothness |
| TOOL-01 / P2 | Schema-preparing SQLite test under competing command load | Preparation-stage timeout, unique DB; controlled full suite passes. Exact OS/filesystem cause unresolved. | Serialize heavy gates; consider separately prepared isolated full-schema fixture if flake persists; keep assertions/timeout. | CI risk; not a reproduced product defect |
| MOTION-01 / P2 | Close Add Case / toggle sidebar | Add Case conditional unmount has no shell exit; group-label margin still transitions for 200 ms. Retained incumbent behavior. | Future scoped transform/opacity motion correction with focus/task regression; no broad redesign. | Prevents blanket motion certification |

Minor incumbent long-word wrapping in Cases is retained; no unreadable/control-blocking clipping was observed. This pass does not silently redesign the product or hide outstanding bottlenecks.

## D. Final verdict and handoff

**PERFORMANCE ACCEPTANCE FAILED.** Verification is no longer just a partial benchmark: final-source quality gates, all 15 E2E scenarios, 120 responsive screenshots, 29 primary scenarios with 10 repetitions, drift controls, final traces, and recording/DevLog proof were completed. Functional gates pass; 60 Hz smoothness and important operation responsiveness do not.

No release-ready claim, exact compositor-FPS claim, or percentage speedup. Near-budget primary windows do not cancel out traced stalls. Navigation and fullscreen geometry fixes are verified; further targeted work is required before accepting the 60 FPS objective. End-state service cleanup targets only owned 31xx processes; user 3000/3001 remain untouched.

### Evidence inventory

All artifacts are outside Git under `C:/Users/Admin/AppData/Local/Temp/`:

| Artifact | Purpose |
|---|---|
| `qadesk-phase4-oct14-fixed-e2e/.last-run.json` | Final production E2E result; detailed command output session 38590 |
| `qadesk-phase2-ui-phase4-oct14-fixed/` | Final responsive JSON and 120 screenshots |
| `qadesk-phase2-phase4-oct14-a/results.json` | Primary baseline, 290 measured samples |
| `qadesk-phase2-phase4-oct14-fixed-clean-b/results.json` | **Final primary candidate**, 290 measured samples |
| `qadesk-phase2-phase4-oct14-a2/results.json` | 80 baseline drift samples |
| `qadesk-phase2-phase4-oct14-a3/results.json` | 40 final baseline drift samples |
| `qadesk-phase2-phase4-oct14-trace-a/` | 36 baseline trace files |
| `qadesk-phase2-phase4-oct14-final-trace-b/` | 36 final-source trace files |
| `qadesk-phase2-phase4-oct14-final-functional/` | Final viewer/DevLog proof and screenshot |
| `qadesk-phase4-analysis.json`, `qadesk-phase4-analyze.mjs` | Derived comparison and trace-analysis method |
| `qadesk-phase2-phase4-oct14-b/`, `...-trace-b/`, `...-no-probe/` | Earlier candidate diagnostics; not final-source certification |
| `qadesk-phase2-phase4-oct14-fixed-b/RUN-INVALIDATED.md` | Manual-intervention provenance, partial metrics excluded |

Baseline archive: `qadesk-phase4-baseline66-runtime.zip`. Historical mismatched/partial/stale runs remain preserved but are not mixed into primary comparison.

Reproduction: start each verified worktree's `node .next/standalone/server.js` on loopback 3100/3103 with a **fresh own synthetic DB backup**, matching APP_URL/origin and test cookie setting. Run the frozen workspace harness with QA_BENCH_ROOT/URL/LABEL, repetitions 10, trace 0, telemetry/animations 1, no diagnostic/functional override, and windows/scenarios above. Do not interact with the benchmark browser/server. For trace use repetitions 3 / trace 1 and the 12-scenario subset listed in the trace table; traced samples are diagnostic only. Never point fixture preparation at user data.

Limits: one Windows reference machine/Chromium, viewport emulation not physical mobile performance; no Safari/Firefox, full contrast/screen-reader audit, actual external capture replay, SaaS authorization review, user-data migration, or controlled thermal lab test. These are not claimed as covered.

Local edits: navigation/CSS corrections, two E2E files, SQLite test timing, benchmark/visual harness corrections, and this report. No schema/dependency/business-rule change. Impeccable preserved the incumbent design and bounded visual verification; mechanical scans of the changed targets found no issues. Unrelated untracked files, including Graphify output, remain unstaged. For future interactive UI QA, installing the Browser plugin is optional; the current regular Playwright evidence remains valid.
