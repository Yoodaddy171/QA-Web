# Phase 4 — motion and production verification

Status: work in progress. This is not a release certification.

## A. Git and source identity

- Branch: `codex/frontend-design-system-motion-optimization`.
- Phase 3 baseline: `66f4427c271632348015d2aefb6a54428d56c753`.
- No stage, commit, push, merge, PR, branch switch, or destructive Git operation in this phase.
- Baseline standalone build: `wEvXXmw-MDKR_mqi4LQQ9`, built 2026-10-13 from a copy of all tracked source equivalent to the baseline (440 files, zero content mismatches after CRLF normalization).
- Build worktree: `C:/Users/Admin/.codex/worktrees/qadesk-phase3-optimized/QA-Web`. Its detached Git HEAD is older; source equivalence, not that worktree HEAD, identifies this build.
- Baseline raw tracked-file SHA256: `49a17b9ab7b67eb8838d0368d8581be2eb8ec8053691889c5e5e087ecfab7e9b` (includes Windows line endings).
- Standalone: `node .next/standalone/server.js`, loopback port 3100. Phase 2 comparison server: port 3101, build `QkIYdcbeeC9hrOvoyykW7`.
- Benchmark DB: `file:C:/Users/Admin/AppData/Local/Temp/qadesk-performance-fixture.db`; synthetic owner/data/video only. Production E2E owns port 3102 and its worktree `prisma/db/e2e.db`.
- No `.env`, real accounts, user DB, or capture recordings modified. Following explicit permission to run the new build on 3000, the verified QADesk `start-local.mjs` process on that port was stopped and replaced with the latest production build. Relay 3001 was left untouched.

Reference environment: Intel Core i3-1215U, Intel UHD Graphics driver 32.0.101.7082, Windows, display 1920×1080 at **60 Hz** reported by Win32_VideoController. Power plan **Balanced**, unchanged. WMI clock reports 1200 MHz; this is a snapshot, not a thermal/frequency trace. Browser GPU compositing, rasterization and video decode were enabled; thermal conditions remain unverified.

## B. Performance architecture and animation inventory

Existing Phase 2/3 boundaries remain: UUID reconciliation, stable action dispatchers, memoized row/data cells, dormant Radix status selectors, hidden Automation data gating, bounded logs, isolated inspector, latest navigation intent, responsive chat.

Inventory below is static source inspection, not proof of frame acceptance. CSS color feedback requires paint; transform/opacity can be composited but promotion is browser-dependent. Rendering and focus management still run on the main thread.

| Surface / trigger | Duration / easing | Properties | Concurrent work / rendering risk |
|---|---|---|---|
| AppShell menu content | 180 ms / cubic-bezier(.16,1,.3,1) | opacity, translateY | Active page mounts, data/hooks; React mount coincides with entrance |
| Sidebar labels / project selector | 160–180 ms / same ease | opacity, translateX/Y | Conditional content mounts; sidebar width changes immediately, not continuously animated |
| Sidebar offcanvas | 260 ms / same ease | left/right | Layout-sensitive; desktop icon mode gap/width changes immediately |
| Sidebar readiness | content token / same ease | scaleX | Stable track; progress update only |
| Inspector Dialog / overlay | 220 ms / same ease | opacity, translateX; zoom overridden to 1 | Portal/focus scope and Overview content mount; logs gated when Automation hidden |
| Inspector Overview / Steps / Automation | 160–200 ms | opacity, translateY | Selected tab mounts; Automation grouping, recording/event derivation |
| Shared Dialog/Sheet/Popover/Select | 180–260 ms / shared CSS ease | opacity, transform | Portal and focus/collection mounts; geometry computed on open |
| Shared Button | 120 ms / shared ease | colors, border, opacity, transform | Press scale; color feedback paints |
| Tabs | 120 ms | colors | Only active tab contents mount; color feedback paints |
| Network expand / Recording details | 180–200 ms | opacity | Payload construction/DOM expands; height changes immediately, not animated |
| Recording fullscreen / context | 200 ms / ease-out | opacity, transform | Resizable layout, video and filtered events mount; close timer matches exit duration |
| System DevLog fullscreen | overlay primitives | opacity/transform | Bounded event list mounts with selected inline details |
| AI Chat open/close | 220 ms / shared ease | opacity, scale, translateY | Chat body mounts; message motion adds child animations |
| AI Chat minimize/restore/resize | immediate geometry | width/height/top/left (not tweened) | Layout update; pointer drag managed separately |
| Dashboard | parent 180 ms, root 0 ms | parent opacity/translateY | Charts/progress; no redundant full-dashboard entrance |

## C. Confirmed root causes

The required existing scoped-guard diagnostic was executed before any production CSS change. Exploratory traced A/B/A runs (3 repetitions, 10000 ms theme windows) used the same build and fixture:

| Diagnostic | Full-window rAF P95 | Maximum long task | Note |
|---|---:|---:|---|
| Existing broad guard A1 | 18.3 ms | 610 ms | 20 transition starts per sample |
| Existing scoped diagnostic B | 17.2 ms | 323 ms | 116 transition starts per sample; inspect missed targets before shipping |
| Existing broad guard A2 | 17.2 ms | 548 ms | Distribution changed without source change; drift remains |

Trace artifacts: `C:/Users/Admin/AppData/Local/Temp/qadesk-phase2-phase4-{broad-guard-trace,scoped-guard-trace,broad-guard-trace-a2}`. Trace event totals are diagnostic sums, not exclusive wall time or CPU utilization. The Phase 3 broad guard already suppressed the historical thousands-of-transitions storm; remaining cost included style invalidation on 5390 DOM nodes, layout/paint and input/portal work. Phase 4 now scopes the guard to transition-bearing surfaces, including SVG targets reached through parent variants, and preserves Tailwind 4 individual transform properties. Final matched performance verification remains pending.

Browser GPU feature status confirms GPU compositing/rasterization and video decode enabled, not a deliberately software-rendered benchmark.

Animation inventory identified BrandMark's 300 ms `max-width` animation and its unqualified ancestor `group-hover` logo rotation. Phase 4 removes the width tween and scopes hover to the brand itself. Inspector shell/overlay animations now use transform/opacity; heavy tab content waits for the actual shell animation to finish, with cancellation and reduced-motion handling. Responsive tables omit hidden optional cell trees while preserving saved column preferences and sticky columns. List results commit atomically at transition priority with version/project guards; quick status updates use the canonical server response and refresh the latest active query when needed. These are implemented source changes, not a verified 60 FPS claim.

## D. Animation performance

NOT RUN on the final Phase 4 source. Initial animation-probe baseline completed 10 repetitions for 22 scenarios (`qadesk-phase2-phase4-baseline-a1`). It exposed stalls overlapping Inspector and fullscreen windows. It is exploratory: the probe was subsequently refined to exclude setup animations and add request/DOM timing, so it must not be compared as if its instrumentation were identical to the final candidate. WAAPI probing can flush style and its overhead must remain disclosed. rAF callback intervals are not compositor FPS. No overall 60 FPS acceptance claim.

## E. Operation responsiveness

Pending matched measurements. Sorting must include the preserved Phase 2 build with identical 4000 ms windows (expand both if either overruns).

Priority 0 matched sorting completed, 10 repetitions + warm-up, 4000 ms on both builds, zero overruns/errors, same 150-row dataset SHA256 `272f60d390184f2326864bc739afb52802c538c89b7b771e4a29a859fb1500e9`:

- Phase 2: rAF P95 17.2 ms; maximum long task 1221 ms; automation action P95 1877 ms.
- Phase 3: rAF P95 16.9 ms; maximum long task 382 ms; automation action P95 865 ms.
- These are operation windows/action automation durations, not animation FPS or standardized INP. Phase 2 vs final Phase 4 still required.

## F. QA results

Priority 0 baseline checks:

| Gate | Status | Evidence |
|---|---|---|
| Lint | PASSED | Fresh `rtk npm run lint`, exit 0 |
| Typecheck | PASSED | Fresh `rtk npm run typecheck`, exit 0 |
| Unit tests | PASSED on repeat | 172 passed, 1 skipped; 44 files passed, 1 skipped; `rtk npx vitest run --maxWorkers=1` |
| Production build | PASSED | Fresh baseline standalone build ID above |
| Production E2E | PASSED across initial and focused repeat | Initial 4/5 passed; combined frontend test timed out under concurrent browser load. Exact-source focused repeat with trace passed in 35.7 s, no timeout change. Isolated port 3102 |
| Responsive / visual matrix | PASSED geometry; visual samples inspected | 120 screenshots, six widths × light/dark × eight menus, inspector/chat; no page errors. Artifacts: `C:/Users/Admin/AppData/Local/Temp/qadesk-phase2-ui-phase4-p0` |
| Matched sorting | PASSED comparison validity | Phase 2 / Phase 3, equal 4000 ms windows, 10 repetitions, zero overruns, identical dataset |

Initial unit run had one SQLite DevLog test timeout while production build ran concurrently: 171 passed, 1 failed, 1 skipped, 245.27 s total. Repeat after build finished: 172 passed, 1 skipped, 52.63 s total, no timeout threshold/test changes. Resource contention is a plausible explanation; the failed run remains disclosed.

Latest-source checks on 2026-10-13 (not full Phase 4 acceptance):

- Lint initially found one synchronous effect-state reset in the inspector. It was corrected by resetting readiness when the open prop changes during render; the full lint repeat passed with zero errors.
- Unit suite: 183 passed, 1 failed (SQLite DevLog 30000 ms timeout), 1 skipped. The unchanged SQLite test passed on an isolated repeat in 7.16 seconds. This is a passing focused repeat, not an entirely green single suite run.
- Root production build passed, including TypeScript and all 37 static pages. Build ID: `frXxjpMcDpjq-r9ZWIPj-`.
- Latest production server is listening on `127.0.0.1:3000`; `/login` returned HTTP 200. This is a runtime smoke check, not authenticated UI or 60 FPS verification.
- Frozen matched baseline A1 completed scenarios through module filtering, then failed while waiting for navigation to Traceability (30000 ms). Artifacts: `C:/Users/Admin/AppData/Local/Temp/qadesk-phase2-phase4-matched-a1`. Its partial results must not be presented as a completed matched suite.

Final-source production E2E, responsive visual verification and matched candidate performance measurements remain pending. No commit or push was performed.

## G. Remaining defects / verification gaps

No new defect classification until reproduction. Mandatory animation, status-selector matrix, matched-sort and final regression evidence is incomplete.

## H. Release recommendation

**READY FOR REVIEW** — interim baseline functional checks completed, Phase 4 performance and final-source gates still pending. Not RELEASE READY.
