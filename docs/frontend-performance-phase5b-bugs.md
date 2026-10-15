# Phase 5B — Bugs rendering optimization

15 October 2026. **IMPROVED BUT TARGET NOT MET.** This report accompanies the Phase 5B implementation commit; raw diagnostic artifacts remain local.

## A. Baseline and experiment design

Base: `6a6ad38c8fb9d3551dca0e28af968c1c17d2ddb1`, branch `codex/frontend-design-system-motion-optimization`. Phase 4 and the local Phase 5A diagnosis were reused. No Graphify analysis, broad refactor, database/schema/API-contract/dependency change, or unrelated acceptance matrix was performed.

All primary runs used **ordinary production**, headed Chromium **149.0.7827.55**, 1440 × 900, real isolated APIs on **127.0.0.1:3115**, and a fresh backup of the existing synthetic SQLite fixture. React production profiling and verbose component timestamp profiling were OFF. Relay HTTP/WebSocket access was mocked inside the test browser.

Workload: Cases **100 visible rows** → Bugs **75 active rows from 100 fetched records**, back to Cases, plus an unchanged Bugs response triggered by a whitespace search and clear. No rows, status options, columns or business functionality were removed to improve results.

| Configuration | Production build | Activation maximum long tasks, ms | Unchanged-refresh maximum long tasks, ms |
|---|---|---|---|
| A: unchanged original, initial 3 | `pXvlSrm1vEMCynipAl-Wz` | 286, 324, 314 | 77, 56, 58 |
| A repeat: 2 drift controls | same build | 757, 642 | 132, 105 |
| B: dormant selector only, 3 + 2 | `lPUcErvHIl7oMGsaqoEoH` | 347, 343, 329; 399, 337 | 60, 515, 0; 0, 0 |
| C: row identity/memoization, selectors kept fully mounted, 3 | `Z5z5K9N5ps9XX6GQZqMaA` | 407, 334, 335 | 0, 0, 0 |
| BC: combined candidate, initial 3 | `XMH51-sIsE7XCgUFYOJ8n` | 479, 401, 190 | 0, 0, 0 |
| Final mutation-correctness revision, 2 additional | `wUzvMDPBk4DZt6s86_qLD` | **145, 135** | **0, 0** |

Zero means **no Long Tasks API entry at/above its ~50-ms threshold**, not zero rendering/CPU time. All outliers remain included, including B's 515-ms refresh and the earlier combined candidate's 479-ms activation.

There was substantial environmental drift: original Cases-control tasks changed from 205–267 ms to 417–518 ms without an implementation change. The A repeat used the same verified production build from the restored main standalone directory; other runs used the owned worktree. Different server filesystem locations can affect request latency. This is not a randomized trial or a defensible percentage-speedup claim.

The budget stayed Bugs-specific: A/B expanded from 3 to 5 due to noise, C used 3, combined used 3 plus 2 after a mutation-correctness revision. Across the three permitted scenarios: **54 non-trace samples and 2 trace samples**, not the Phase 4 matrix. Functional continuation did not rerun benchmarks.

## B. Root cause and attribution

**Confirmed:**
- Equivalent refresh previously replaced every record object. Existing deep JSON reconciliation now preserves both the unchanged array and unchanged nested row references. Row memoization and stable callbacks avoid rebuilding equivalent cell/date/control subtrees.
- C kept **75 real Select trees** mounted yet removed refresh long tasks in all 3 samples. The refresh improvement therefore is not merely a consequence of lazy selectors.
- Dormant selectors eliminate closed Radix collection/presence setup for untouched rows. B had **0 mounted real row selectors**, versus A/C's 75, while retaining all 75 interactive status triggers. In the noisy repeat pair, B activation was 337–399 ms versus A's 642–757 ms with similar Cases-control costs. This supports a selector contribution, **not Radix as the sole cause**.
- The combined candidate has no observed post-response long task in its 5 samples; API requests and canonical updates still occur.

**Remaining contributors:** initial panel/row construction and style/layout work still exceed the desired budget. Stats/animated numbers and date formatting were not separately causally quantified. Their code was not removed or redesigned. No backend performance refactor was justified.

Ordinary-production trace maxima, ms (one trace per compared build, not additive):

| Category | Original A | Combined candidate |
|---|---:|---:|
| FunctionCall | 164.0 | 106.1 |
| EventDispatch | 208.0 | 116.3 |
| Style / UpdateLayoutTree | 56.5 | 58.5 |
| Layout | 16.9 | 22.5 |
| Paint | 6.9 | 7.5 |

The lower JS maximum supports reduced browser work, but layout/paint are not uniformly improved. Exact React render/DOM-commit durations are **N/A**: no profiling build was mixed into acceptance. RunTask was not captured by the selected trace categories; the analysis helper's zero for that category is unavailable evidence, not proof of no task. Long-task figures above come from the browser observer.

## C. Implemented changes

| File | Change / reason | Risk / protection |
|---|---|---|
| `src/components/BugFixStatusCell.tsx` | Untouched rows use a native popup button; interaction mounts the actual Radix Select. The activated trigger stays mounted for focus restoration. Same labels, dimensions, palette, editable statuses and transition helper. | Native button avoids a fake combobox/dangling initial aria-controls. Real popup naming/controls, keyboard, dismissal and focus were verified. |
| `src/components/BugFixPanel.tsx` | Memoized keyed `BugFixTableRow`; stable column-class callback and latest detail callback; ignore option/listbox clicks when deciding to open row detail. | Every record field can still invalidate the row. Columns, density, ordering, row count and layout retained. |
| `src/hooks/use-bugfixes.ts` | Reuse `reconcileRows`; stable loaders/status callback; abort/version/project guards, including a second check in the state updater; prevent raw-search/debounced-query mismatch. | Late search/GET and canonical PUT races exercised; no merge across projects. |
| same hook | PUT applies the canonical row. Refill only when a status filter, interrupted query, or changed query requires it. Existing navigation/search/filter refreshes remain. | Avoids a newly introduced unnecessary full reload on an unchanged unfiltered view; a status-filter mutation was verified to remove/refill the affected row. This is not skipping existing refreshes for a score. |
| `src/lib/client/api/bugfix-client.ts` | Forward optional AbortSignal; reject unsuccessful GETs instead of interpreting errors as an empty successful response. | Query shape and server validation unchanged. |
| `src/components/BugFixStatusCell.test.ts` | Native dormant-trigger semantics for all 3 editable states. | SSR checks label, button/listbox semantics, collapsed state, no fake combobox and no mutation. |
| `src/lib/client/bugfix-reconciliation.test.ts` | Equivalent page identity; every relevant field, nested module, ordering/removal and unchanged other-row identity. | Does not use status/updatedAt-only shortcuts. |
| `src/lib/client/api/bugfix-client.test.ts` | Cancellation/query forwarding and HTTP-error handling. | No API-contract change. |

No AppShell, navigation, shared UI primitive, Cases, theme, Prisma model or backend route was changed. UUID/internal record IDs remain the React keys; display IDs and relations were not rewritten.

## D. Before versus after

| Metric | Baseline | Candidate / final revision | Verdict |
|---|---|---|---|
| Activation max long task | 286–757 ms across 5 | combined series 135–479; latest revision **135 / 145 ms** | Improved observed low-end; still fails <100 ms |
| Input-feedback P95 | N/A: initial probe invalid | latest 2: **158.9 ms**; earlier combined 3: 512.6 ms | No valid paired baseline latency claim |
| Navigation-to-content | N/A for initial probe | latest median **211.4 ms**; earlier combined median 498.5 ms | Two-rAF DOM-ready proxy, not exact presented/usable time |
| Bugs DOM nodes | 1,956 document / 1,575 tbody descendants | same counts | Content/DOM not hidden for score |
| Real closed status selectors | 75 | 0 untouched; **75 native status action triggers remain** | Deferred setup; real controls activate on demand |
| Unchanged refresh render cost | Exact React time N/A; long tasks 56–132 ms | Exact React time N/A; **no ≥50-ms task in all 5 combined samples** | Measurable removal of expensive refresh work |
| Post-response long task | Activation follow-up tasks 58–141 ms | 0 observed in C/combined | Improved; zero does not mean no CPU work |
| rAF intervals | A initial P95 17.0 ms, max 316.7; repeat P95 16.8, max 783.4 | final revision P95 17.1, max 150.1 | Tail stalls remain; not compositor FPS |
| Bugs HTTP total | A medians 37.8 / 76.4 ms | final revision median 43.7 ms | Backend not optimized |

**Probe correction:** the original feedback probe used the timestamp supplied to rAF, which can precede callback execution when the main thread stalls. Initial A/B/C feedback values are invalid and explicitly excluded. The combined runs use `performance.now()` after observing the target row set across two rAF callbacks. This estimates a rendering opportunity, not actual compositor presentation or proven click latency. Refresh latency is N/A because its unchanged row count is already present before input. The long-task observer and request/resource timing methods did not change.

The two latest samples belong to the final correctness revision; the earlier three combined samples remain separately disclosed rather than silently discarded or described as the identical source.

## E. Targeted QA

| Check | Observed result |
|---|---|
| Lint | Full `npm run lint`: exit 0, no warnings after native-button semantic correction. Final hook adjustment additionally passed targeted ESLint. |
| Typecheck/build | CLI `npm run typecheck` passed; final isolated production build also passed TypeScript. Final compile 13.1 s, TypeScript 16.8 s, build exit 0. |
| Directly affected unit tests | **38 passed, 6 files**: new trigger/client/reconciliation tests plus existing reconciliation, latest-result and bug lifecycle tests. Not the full suite. |
| Keyboard/accessibility | Enter, Space, ArrowDown/Up, Escape, focus restoration, mouse/outside dismissal, closed-trigger Tab, accessible name and open-popup aria-controls verified. No unintended row-detail opening. |
| Status lifecycle | Illegal jump disabled and HTTP 400; adjacent FIXING/READY and bounce-back exercised; canonical response/read-back and reload persistence verified. |
| Filtered mutation | Reported filter refills after the edited row becomes FIXING. |
| Retest synchronization | READY updates related testcase; direct Bugs VERIFIED rejected; testcase DONE retest produces VERIFIED & FIXED. |
| Data correctness | Real backend row change appears; unrelated row DOM retained with no text/child mutations. Delayed search response and GET in flight cannot overwrite latest search/canonical PUT. |
| Other Bugs flows | Active/resolved read-only views, search/clear, module filtering, detail open/close, same-project Back/Forward verified. |
| Project route isolation | Fresh second synthetic project route shows no previous project's rows. Not a multi-role/tenant security certification. |
| Browser health | Production page content/title/entry route observed; no framework overlay seen. Final functional prefix and continuation both captured **0 page errors and 0 console warnings/errors**. |
| Visual scope | Desktop real-popup and 390-px screenshots inspected. No page-wide mobile overflow; existing badge/density-toolbar crowding remains at 390 px. No responsive matrix or broad redesign. |

The Browser plugin/its browser skill was unavailable; existing regular Playwright/CDP was used. Evidence is a targeted production Playwright flow, not a claim that all Phase 4 E2E tests passed again.

### Failures and fixture corrections retained

1. B's first keyboard attempt used a role locator excluded by Radix's intentional aria-hidden background; the repeat used a normal locator click on the modal-disabled background. The harness was corrected to stable trigger locators and a real coordinate click outside. These were automation failures; later keyboard/dismissal checks passed.
2. The first combined functional run exposed **unstable pagination ties**: all fixture Bugs had identical createdAt. SQLite used the project/updatedAt index before sorting those ties, so changing updatedAt could move an edited record outside the first 100. Direct read-only DB verification confirmed the saved status existed. Backend ordering was not changed; a deterministic tie-breaker remains a separate follow-up for real bulk-import ties.
3. Functional QA therefore uses a separate owned fixture with unique Bug createdAt values. Primary performance fixtures were never reseeded this way. The newly added eager post-PUT reload was also narrowed to query/membership changes, preserving canonical unfiltered page behavior.
4. The full functional run then stopped on a harness assumption of 100 Cases rows after reload; the app correctly defaulted to 10. Its successful prefix is recorded in `BC-QA/PARTIAL-QA.md`. Only remaining checks continued on a fresh backup of that owned fixture in `BC-QA-tail`, same final build, exiting 0. No passing performance matrix was rerun for this continuation.

No failure or outlier was deleted. No whole-app accessibility, cross-browser or 60 FPS acceptance is claimed.

## F. Final verdict and handoff

**IMPROVED BUT TARGET NOT MET.** Equivalent refresh no longer produces observed long tasks, lazy selector behavior and status/data correctness are verified, and the most recent activation samples are 135–145 ms. However, they still exceed 100 ms, earlier combined samples reached 479 ms, and environmental drift prevents a precise durable speedup claim.

**Phase 5C: not recommended yet as the next performance step.** Review this local patch and address the remaining Bugs activation cost first. Stats/date-formatting and style/layout attribution remain bounded follow-up candidates, not proven fixes. Cases/theme work was not started.

### Provenance and evidence

- Final build: `wUzvMDPBk4DZt6s86_qLD`.
- Changed source/test file-set SHA-256: `9dcbda17d00e99bef79520336599aabcd01a621aa4320c0951276b5c354da870`; all 7 files were byte-compared against the built worktree. Details: `C:/Users/Admin/AppData/Local/Temp/qadesk-phase5b-source.json`.
- Primary canonical testcase API hash: `272f60d390184f2326864bc739afb52802c538c89b7b771e4a29a859fb1500e9`, shared across compared primary fixtures. Functional fixtures intentionally diverge after lifecycle tests.
- Raw artifacts: `C:/Users/Admin/AppData/Local/Temp/qadesk-phase5b-oct15-{A,A-repeat,B,B-repeat,C-rows,BC-final,BC-final2,BC-QA,BC-QA-tail}/`.
- Each results.json preserves build/browser identity, sample records and failures. Final functional results preserve console/page-error records. The continuation's seven named checks are in `BC-QA-tail/results.json`; the completed prefix is documented separately.
- Traces: `...-A/activation.trace.json` and `...-BC-final/activation.trace.json`. These are attribution samples, not pooled primary samples. Category durations overlap and must not be summed.
- Analysis: `C:/Users/Admin/AppData/Local/Temp/qadesk-phase5b-analysis.json`. Invalid early feedback values are nulled. Harnesses: `qadesk-phase5b.cjs`, `qadesk-phase5b-qa.cjs`, `qadesk-phase5b-qa-tail.cjs`, `qadesk-phase5b-analyze.cjs`, in the same Temp parent.
- Screenshots: `...-BC-QA/status-popup.png`, `...-BC-QA/keyboard.png`, `...-BC-QA-tail/bugs-mobile.png`, `...-BC-QA-tail/empty-project.png`.
- Owned runtime: `C:/Users/Admin/.codex/worktrees/qadesk-phase2-baseline/QA-Web`. Build commands explicitly checked this cwd. All owned 3115 test servers were stopped. No listeners were observed on user ports 3000/3001 at the start/end of this implementation; they were not started/stopped or rebuilt over.
- Historical preparation incident, 14 October: an earlier mistaken main-directory build removed generated artifacts and caused 500/one missing script. Artifacts were restored; the user restarted services and all 10 referenced scripts plus login were then verified 200. That was an agent error, not an application defect or performance result. This implementation did not repeat that main-directory build.

Source/report changes remain **local, unstaged and uncommitted**. Phase 5A diagnosis, Graphify output, unrelated local files, real databases, accounts, recordings and environment files were preserved. This report supersedes the earlier recovery/pending status, not the retained raw evidence.
