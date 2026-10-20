# Phase 8E — Traceability Graph UX and Functional QA

## A. Executive verdict

**PASSED WITH LIMITATIONS** — 19 October 2026, Asia/Bangkok.

The focused Graph View workflow is usable for local QA, with clearer entry, readable focus framing and explicit subset semantics. Twelve targeted Chromium scenarios passed on the isolated production candidate (49.2 seconds, one worker, zero automatic retries). This is not whole-product acceptance or deployment certification.

Primary branch remained `codex/frontend-design-system-motion-optimization`, HEAD `4385c5862edc500d047978ada10178246f20bc88`. No stage/commit/push/merge/deploy. Existing unrelated untracked work was preserved.

## B. Initial findings and investigation

Before changing UI, an isolated dev server and real Chromium session exercised the current uncommitted graph implementation. Evidence: `C:/Users/Admin/AppData/Local/Temp/qadesk-phase8e-20261019/before-observations.json` and `before/` screenshots.

- Confirmed interaction defects: Reset replaced a selected Bug with the original testcase; switching lanes→graph discarded the chosen starting object.
- UX weaknesses: initial full-fit framing made labels too small; filters competed with starting controls; UUID/project IDs dominated details; focus versus filtering and full-subset meaning required interpretation. Initial desktop fit observations were approximately 47–52%; mobile labels were substantially smaller.
- Feature limitations, not data defects: bounded neighborhoods, no direct case→case or case→plan relation, Bug navigation opens its module rather than one record, full graph means loaded subset only.
- Harness issues: initial dev-route compilation exceeded the navigation wait; the first test file used unsupported top-level await in the CommonJS test loader; one cycle locator omitted its status suffix. These were corrected without changing application semantics. A pre-build lint check also found the existing graph route's local `module` variable forbidden by Next's lint rule; renamed to `projectModule`.

## C. UX improvements

- Clear first-use instruction and “Mulai dari” / “Cari nama atau ID”; search results remain bounded and debounced. Search clears old options immediately when its query/type changes.
- After selection, a compact header identifies the loaded object and “Ganti object” reopens search. Filters are progressively disclosed with an active count.
- “Semua yang dimuat” clears display filters; changing the starting object reloads relationships. Copy explains the difference and truncation offers a route to another neighborhood.
- Initial/reset framing prioritizes readable labels. “Paskan semua” is an explicit overview with a small-label explanation; Reset restores the chosen node's framing without changing selection or filters. Selection highlighting no longer unnecessarily re-fits the canvas in ordinary mode.
- Details prioritize display ID, title, status and module. UUID/project move into expandable technical details with tested clipboard feedback. Bug action explicitly says “Buka menu Bugs” and explains searching its display ID.
- Focus survives lane/graph switching within the mounted Traceability panel and remains project-bound. Aborted requests cannot replace newer graph content. Runtime payload validation rejects malformed details, missing roots and dangling edges.
- Incumbent token/shadcn styling, icons and focus states retained. Vertical touch scrolling is not globally trapped by the canvas; drag/keyboard pan and button zoom remain available. No new dependencies or schema/business-rule changes.

## D. Environment and functional results

Browser plugin skill was unavailable; the requested existing Playwright infrastructure was used. Chromium 149.0.7827.55, loopback port 3127, synthetic SQLite only. Workspace A has separate OWNER and VIEWER sessions; workspace B has a separate OWNER with no membership in A. Fixtures contain 15 A cases, one B case, two modules, three requirements, one plan, two cycles, seven executions and two active/resolved Bugs; one requirement links 14 cases to exercise the 12-case cap.

Evidence root: `C:/Users/Admin/AppData/Local/Temp/qadesk-phase8e-20261019/`.

| Scenario | Result | Evidence |
|---|---|---|
| Open Graph View | PASS | FUNC-8E-01; meaningful page, correct URL/title, no framework overlay |
| Search/select entity | PASS | FUNC-8E-01, 05, 06, 09; testcase/requirement/cycle/Bug searches |
| Node and edge correctness | PASS | DATA-8E-07; rendered IDs equal API; every returned node/edge checked against SQLite foreign keys/joins |
| Node selection | PASS | GRAPH-001/003; pressed state, direct-neighbor opacity, correct details |
| Pan/zoom/Fit/Reset | PASS | GRAPH-001/003; pointer and arrow-key pan, zoom buttons, overview and retained selection |
| Filters | PASS | FUNC-8E-03; type/module/status, direct-only, active count and empty-filter recovery |
| Detail navigation | PASS | FUNC-8E-04/05/06; exact testcase UUID, selected cycle, execution's persisted cycle, requirement context, honest Bug module label and clipboard read-back |
| View switching | PASS | FUNC-8E-04; chosen focus restored; FUNC-8E-05 checks browser Back/Forward for cycle navigation |
| Empty/error states | PASS | FUNC-8E-09/10; unlinked requirement, empty search/project, injected 503/retry and unavailable-object UI |
| Rapid selection/race | PASS | FUNC-8E-10; delayed older response released after a newer selection; newer root remains selected |
| Cross-workspace isolation | PASS | AUTHZ-8E-08; authorized Viewer GET 200, foreign seed in A 404, B project 403, positive B-owner GET 200, foreign search empty; denied Viewer PUT 403 with unchanged record |
| Responsive layout | PASS | VISUAL-8E-12; 1440×900 dark/light, 1366×768 dark, 390×844 dark, no document horizontal overflow |

`browser-results-production.json` contains the final 12/12 result. The first dev batch retained 9 passes/one harness failure in `browser-results.json`; the focused follow-up retained 3 passes in `browser-results-dev-navigation.json`. No broad historical suite or benchmark was run.

Unit: **5/5 passed**, `npx vitest run src/lib/traceability-graph.test.ts` (namespaced identity, deterministic layout, neighbors, readable framing and payload validation). API integration is the real HTTP + SQLite DATA/AUTHZ scenarios above, not a mocked route test. Injected failure/race responses are state-recovery tests, not backend-failure or security proof.

Static checks: full `npm run lint` passed; final `tsc --noEmit --incremental false` passed; Impeccable static detector on both UI components returned zero findings. A separate production browser-health check verified owner identity, title/route, rendered graph, **zero console errors/warnings and zero uncaught page errors** (`browser-health.json`).

## E. Defect register and retest

### GRAPH-001 — Reset silently changes selection (Medium, fixed)

Reproduction: select AUTH-001's Bug, then Reset. Expected: retain selected Bug while restoring framing. Actual: original testcase became selected. Root cause: reset handler explicitly assigned `data.rootId`. Fix: reset now frames the existing selection without clearing filters. Before: `before-observations.json` records Bug→Testcase. Retest: GRAPH-001/003 passes in production.

### GRAPH-002 — Initial diagram labels too small (Medium UX defect, improved)

Reproduction: select AUTH-001 at desktop/mobile widths. Expected: readable starting object and discoverable relationships. Actual: automatic full-fit reduced labels to tiny text; controls consumed substantial space. Root cause: automatic overview fit regardless of viewport. Fix: readable focus framing (minimum 85%), higher vertical placement, explicit overview and collapsed secondary controls. Retest: unit framing check, FUNC-8E-01 and inspected four-view screenshots pass. Overview still deliberately reduces labels; not every node fits at readable scale.

### GRAPH-003 — View switch loses starting context (Low usability defect, fixed)

Reproduction: select testcase, switch to lanes, return to graph. Expected: retain chosen area during the same Traceability visit. Actual: empty start guidance. Root cause: conditional unmount discarded component-local starting state. Fix: parent stores project-bound graph focus and restores it on remount. Retest: FUNC-8E-04 passes. Filters/pan/zoom and cross-module page reload persistence are not promised.

## F. Visual evidence

Before: `before/graph-1440-dark.png`, `graph-1440-light.png`, `graph-1366-dark.png`, `graph-390-dark.png`; initial search: `before/initial-1440-dark.png`.

After: same filenames under `after/production/`. Clean 1440×900 viewport: `after/production/graph-final-1440x900.png`.

Contact sheet: `before-after-contact-sheet.png` (labeled scaled thumbnails). Full-size screenshots were also inspected. Observed improvements: fewer competing controls, identifiable loaded object, readable selected-case labels, secondary technical IDs, clearer selection/details and no document overflow. Focus mode intentionally leaves other nodes beyond canvas edges; pan/overview and the relationship list expose them. Mobile uses vertical scrolling and a stacked detail panel, not a simultaneous desktop-width graph. Long titles remain truncated on nodes but readable in details/tooltips.

## G. Exact Phase 8E code/document changes

These refine the already-uncommitted graph implementation; they are not all new-feature additions relative to Git HEAD.

| File | Phase 8E change |
|---|---|
| `src/components/TraceabilityGraphView.tsx` | Entry/search/filter hierarchy, focus framing/reset, details/copy, selection dependencies, runtime validation and testable graph identity attributes |
| `src/components/TraceabilityPanel.tsx` | Project-bound starting-object preservation across lane/graph switch |
| `src/lib/traceability-graph.ts` | Focus contract, pure viewport helper, payload validator |
| `src/app/api/traceability/graph/route.ts` | Local variable rename for lint only; relationship/loading/auth policy unchanged |
| `src/lib/traceability-graph.test.ts` | Two focused framing/validation tests added to the existing three |
| `e2e/phase8e.graph.spec.ts` | Twelve focused browser/API/SQLite scenarios |
| `playwright.phase8e.config.ts` | One Chromium worker, no retries, per-run private artifacts |
| `scripts/phase8e-environment.mjs` | Guarded isolated worktree/source snapshot and synthetic fixture |
| `scripts/phase8e-server.mjs` | Explicit isolated cwd/Git root/output checks and pre-build hash parity |
| `scripts/phase8e-explore.mjs` | Before-edit browser exploration/screenshots |
| `scripts/phase8e-evidence.mjs` | Contact sheet, production parity/DB integrity/console checks and credential cleanup |
| `docs/traceability-graph-feature-implementation.md` | Historical report cross-reference |
| `docs/traceability-graph-ux-qa-report.md` | This report |

## H. Build safety, cleanup and limitations

Exactly one isolated production build: `next build --webpack`, launched with cwd/Git root `C:/Users/Admin/AppData/Local/Temp/qadesk-phase8e-20261019/candidate`, output its own `.next`. Manifest contained 405 copied source/config/support files, including uncommitted graph code; pre-build hashes were checked against the primary source. Final production-source parity found zero differences (`final-safety.json`). Subsequent harness/report changes do not alter the served production code.

Build passed with two existing readiness-service `module.createRequire` parser warnings. Compiled output was exercised with `next start`; Next emitted its existing standalone-configuration advisory. Standalone finalization/distribution was not tested. No build command ran against the primary cwd/output.

Primary build ID stayed `DLcEYgHzjF5uLUKnUPV07`. User services remained port 3000 PID 21484 and port 3001 PID 2828. Only owned port 3127 was stopped. Synthetic sessions were revoked and token fields removed from the fixture; offline SQLite/evidence remain for review. Cases matched their original status/update times; SQLite integrity was `ok`, foreign-key check empty. Real user databases and `.env` were untouched. Graphify synchronization was explicitly skipped as requested; no index/output writes were performed.

Limits remain 12 cases, 24 links per relationship query, 24 executions, 16 Bugs and 120 nodes. This is not complete project history, and no evidence nodes, export, editing, pathfinding, wheel/pinch zoom or inferred case relationships were added. Bug navigation is module-level; execution navigation opens its cycle, not a historical execution inspector. Browser coverage is Chromium only; real touch hardware, assistive technology, full contrast certification, enormous projects and unrelated modules were not audited. Some relationships require scrolling/panning; zoom overview is for structure rather than reading long labels.

## I. Recommendation

First-time entry is clearer and the tested relationship meanings are accurate. Users can navigate to testcase, requirement and cycle context; Bug limitations are explicit. No unresolved High/Critical defect was observed in this focused scope. Ready for everyday **local** use with the listed limits, after a separately authorized primary build/restart. The current running user app has not been updated by this task. Consider Bug-first relationship grouping and optional selected-view persistence later; neither requires changing the domain model.
