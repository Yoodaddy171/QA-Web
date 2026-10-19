# Phase 8C.1 — Core UI polish

## Executive verdict: PASSED WITH LIMITATIONS

Final acceptance completed on 19 October 2026 (Asia/Bangkok). The targeted five browser regressions passed, selected 17 unit tests passed, typecheck/full ESLint passed, and the final isolated production build passed. Thirty final screenshots cover the requested six viewport/theme combinations; eight before/after contact sheets were inspected. No Critical/High functional defect remains in the tested scope. This is not full-product accessibility, performance or security certification.

Historical safety incident, retained explicitly: an earlier build command accidentally ran from the primary checkout, failed with `EBUSY` while cleaning `.next/standalone`, and removed part of the main build output. The user subsequently rebuilt it and authorized continuation. During resumed verification the user's build ID remained `oMEWn85xB97Dk_3l5dWYm`; no main build was run again. Final candidate build ID: `AT3ss2TStDvzDe7oQIL2_`, exclusively in `C:/Users/Admin/.codex/worktrees/qadesk-phase2-baseline/QA-Web`. Build commands now have an explicit working-directory guard.

No staging, commit, push, branch switch, real database/recording/environment modification, or intentional stop of user services was performed. Only positively identified synthetic server children on port 3119 were stopped/restarted. No listener existed on 3000/3001 when verification resumed on 19 October; this observation is not a claim about earlier service availability. The current primary build does not include the final Compact spacing correction unless the user rebuilds it later.

## Baseline and design findings

The user clarified that the Phase 8B reference means the existing Phase 8A PDF/ZIP, screenshots and notes. No separate Phase 8B report was supplied or invented. Reference source: `artifacts/ui-review/phase8a/visual-review-notes.md` and its original UI-001–UI-129 collection.

Existing theme tokens, violet identity, domain constants, icon language and sidebar were retained. Scoped Cases/Bugs toolbar and table styles standardize controls, labels, badges and surfaces without introducing a second styling system. Existing 4px spacing tokens compose 36px toolbar controls, 40px form/footer controls, 44px table headers and 24px badge targets. Body/table copy uses the existing 14px role; labels, helpers and metadata use the existing 12px caption role.

Tables use a single keyboard-focusable scroll region with sticky identity/actions and discoverable scrolling guidance. Deliberate column minimum widths keep results and status controls readable after horizontal scrolling. Long actions show two lines with full text available in the title and inspector. Existing responsive column visibility is unchanged; no additional columns were silently removed. Pagination has room reserved for the floating AI action. Both density modes are preserved.

Forms retain existing fields and permission/validation logic while grouping classification, procedure/results and notes. Header/footer remain outside internal scrolling. Inspector tabs have clearer active styling, scrolling guidance and organized action hierarchy. Bug lifecycle rules and lazy status selectors were not replaced.

## UI-127 reproduction and fix

The original production baseline reproduced Overview → Steps becoming active with an empty body after four seconds. The outer `AnimatePresence mode="wait"` coordinated exits around conditionally unmounted Radix tab content; the outgoing content could disappear before exit completion, preventing incoming content from mounting. Removing that outer presence wrapper fixes lifecycle ownership without force-mounting all tabs, reloading or adding arbitrary delays. Steps now has a proper TabsContent wrapper.

The initial fix rendered all ten tested transitions but exposed closing-focus restoration failure. A subsequent opener capture/restore correction passed the targeted regression, including Escape returning to the originating action button. Focus is not stolen when another dialog has opened.

Private reproduction artifacts remain under `C:/Users/Admin/AppData/Local/Temp/qadesk-phase7-okiCNG/`: `browser-results-8c1-baseline.json`, `browser-results-8c1-inspector-fix.json`, `browser-results-8c1-focus-confirm.json`. These contain synthetic-session testing material and must not be packaged indiscriminately.

## Visual evidence and change log

Earlier candidates remain in `artifacts/ui-review/phase8c1/candidate/` and `pass1-narrow/`. Final evidence is `artifacts/ui-review/phase8c1/candidate-final/` with `candidate-final-manifest.json`. Chromium 149.0.7827.55, device scale 1, reduced motion, 1440×900 / 1366×768 / 390×844, each dark/light. Every combination includes Cases, create form, inspector Overview and Bugs. Additional 1440 dark captures cover filters, edit, lower form fields, right-scrolled results, Steps after direct switching, and Bug lifecycle.

Screenshot inspection identified overlapping Bugs filters, translucent sticky-header bleed and pagination spacing. The correction batch sets filter width to its grid track, makes sticky headers opaque, reduces table maximum height and scopes minimum width by viewport. Final rendered inspection confirmed the Bugs filter separation, visible pagination, non-colliding form/inspector footers and readable right-scrolled results. Data outside the viewport deliberately needs internal scrolling; the first view does not show every column simultaneously.

Contact sheets: `artifacts/ui-review/phase8c1/before-after/{ID}-before-after.png`, with explicit source mapping in `before-after/manifest.json`:

| Reference | Verified change |
|---|---|
| UI-004 | Cases action hierarchy, two-line actions, sticky IDs/actions, scroll hint and pagination |
| UI-006 | Consistent filter controls and aligned toolbar; full filter set retained |
| UI-013 | Create form field grouping, readable labels, stable visible action footer |
| UI-015 | Edit form parity, protected display ID, stable footer and internal scroll |
| UI-024 | Inspector active tab styling, tab-scroll guidance, calmer header/footer |
| UI-043 | Neutral Bugs KPI surfaces, aligned filters, wider statuses, readable actions |
| UI-046 | Lifecycle semantics/data retained with consistent inspector shell |
| UI-127 | Previously empty Steps body now renders immediately on direct tab change |

All eight pairs were inspected. Originals are unchanged. Contact sheets are explicitly labeled 50% thumbnails; full-size screenshots remain available. Same logical Phase8A fixture (Mercury Commerce QA, 24 cases, three modules, four Bugs), viewport, theme and scale are used. Fresh synthetic UUIDs and timestamps differ; this is not a pixel-identical snapshot comparison. Final fixtures intentionally omit the earlier synthetic relay/media seed, so Automation live media is not equivalent coverage.

## Accessibility and theme observations

The screenshot harness recorded no horizontal document overflow or out-of-viewport dialogs across the six combinations. Table actions and create footer were reachable. Keyboard regression verifies Escape and restoration to the opener. Steps has an actual tabpanel, active states remain semantic, table scroll regions have accessible names/descriptions, and checkbox names identify cases. Screenshot samples confirm light-theme controls do not disappear and mobile form/footer content stays within the viewport.

Three existing opaque token-pair contrast measurements (not all rendered elements):

| Pair | Dark | Light |
|---|---:|---:|
| Foreground / card | 16.14:1 | 17.72:1 |
| Muted foreground / card | 7.03:1 | 4.83:1 |
| Primary foreground / primary | 5.36:1 | 6.29:1 |

These exceed 4.5:1 for those specific pairs only. Translucent status badges, hover/focus states, screen readers, forced colors, 200% text zoom and cross-browser behavior were not comprehensively measured. Dense controls can remain below 44px touch targets; mobile is a sanity check, not a new mobile interface. Reduced-motion captures and the existing conditional/lazy rendering remain in place; no new 60 FPS claim is made.

## Verification performed

- Final isolated production build: passed, compile 49s, TypeScript 60s, 37 static pages, standalone finalization successful. These build durations are observations, not performance benchmarks.
- Typecheck (`tsc --noEmit --incremental false`) and full ESLint (`npm run lint`): passed on the candidate; the subsequently added test identity separation and measurement assertions are exercised by Playwright.
- Selected unit tests: 17 passed in five files across table container compatibility, workspace permissions, Excel/report clients and execution shortcuts.
- Final targeted browser run `8c1-confirmed`: five passed, zero skipped/flaky/unexpected, 19.4s. Includes ten inspector tab transitions and Escape/opener focus, table horizontal scroll and result readability, density persistence, search/filter/sort/status save with DB read-back, required-field validation retaining input, create/edit with empty tags and refresh, lazy Bug selector transitions with synchronized source testcase, and Viewer/cross-workspace denial with unchanged DB state.
- The first five-scenario run had four passes and one genuine failure: two-line action content plus cell padding made Compact stay 57px, equal to Comfortable. A scoped compact-cell padding/line-height correction now measures 45px versus 57px, verified after state selection and across refresh. This required an additional functional correction/build, not an open-ended cosmetic polish loop. The original failed run remains in the private `qadesk-phase7-OZeasG` artifacts.
- Role checks use distinct Viewer and multi-membership browser contexts, verify `/api/auth/status` actor IDs, and prove ADMIN in workspace A has create UI while VIEWER in workspace B does not. A denied PUT returns 403 and preserves the foreign testcase. This is a targeted regression, not a complete authorization matrix.
- Five read-only shared-component arrival checks passed for Dashboard, Reports, Traceability, Settings and Test Cycles, with meaningful content, expected header/route, no framework overlay, no horizontal document overflow and no page errors. Those modules were not redesigned.
- Final capture recorded zero uncaught page errors. Complete warning/resource-error and offline-network audits were not performed; synthetic relay HTTP/WebSocket port3001 traffic was intentionally blocked.
- Full performance/security/E2E suites: intentionally not rerun.

Portable credential-free summary and eleven-file SHA256 parity: `artifacts/ui-review/phase8c1/verification-results.json`. Shared smoke: `shared-smoke.json`; compact proof: `compact-confirmation.png`. Private final traces/results are under `C:/Users/Admin/AppData/Local/Temp/qadesk-phase7-DTzOLQ/`, not packaged for publication. Fixture sessions are revoked and credential files removed during final cleanup.

Impeccable workflow informed scoped typography/control/surface alignment and rendered inspection. Its mechanical detector ran once; the unnecessary bouncing search icon was removed. The incumbent Inter font in an export template was intentionally retained.

## Exact Phase 8C.1 implementation files

Production:

- `src/app/globals.css`
- `src/components/ui/table.tsx`
- `src/components/TestCaseTableBody.tsx`
- `src/components/TestCaseTable.tsx`
- `src/components/BugFixPanel.tsx`
- `src/components/BugFixStatusCell.tsx`
- `src/components/BugFixStatsCards.tsx`
- `src/components/TestCaseDialog.tsx`
- `src/components/TestCaseDetailDialog.tsx`
- `src/components/TestCaseDetailDialogHeader.tsx`
- `src/components/TestCaseDetailDialogFooter.tsx`

Supporting additions:

- `src/components/ui/table.test.tsx`
- `e2e/phase8c1.inspector.spec.ts`
- `playwright.phase8c1.config.ts`
- `scripts/phase8c1-environment.mjs`
- `scripts/phase8c1-capture.mjs`
- `scripts/phase8c1-contact-sheets.py`
- `scripts/phase8c1-shared-smoke.mjs`
- `scripts/phase8c1-evidence.mjs`
- This report and Phase 8C.1 screenshot/manifests.

These are this phase's changes, not a claim that all dirty files in the checkout belong to this phase. Earlier Phase 6C/7/7.1 edits remain uncommitted and must be preserved.

## Remaining inconsistencies / Phase 8C.2

Cases/Bugs intentionally trade simultaneous all-column visibility for readable content, with internal scrolling. Long values use truncation/titles plus inspector details; small-screen column visibility is inherited. Mixed Indonesian/domain English terminology remains, especially established status constants and technical tabs. Some nested inspector cards and dense technical text remain for a later focused pass. Real recordings, fullscreen DevLog interaction, upload failures and live automation relay were not revalidated in this phase.

Recommend Phase 8C.2 apply the established toolbar/control/surface rhythm to Dashboard, Reports, Traceability, Settings and Test Cycles while preserving their distinct workflows. Expand keyboard/assistive-technology and translucent semantic-color contrast coverage rather than treating this targeted pass as WCAG certification. No further redesign, merge, staging or delivery action is authorized by this report.
