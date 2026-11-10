# Report filters and clipboard fixes

Date: 4 November 2026 (Asia/Bangkok).

## Scope and implementation

- REPORT-PAGINATION: summary-list API filters search/type/status before the 25-item cursor page. Counts distinguish all project reports, matching reports, and rendered items. Canonical and legacy report types remain searchable. Full document detail remains on-demand.
- REPORT-SEARCH-SPACES: trim and lowercase search before matching. Test Cycles also trims its name/assignee search.
- REPORT-FILTER-A11Y: use existing Radix ToggleGroup controls for type/status, named groups, selected-state semantics and arrow-key behavior. Add a visible search label and announce result counts. Controls remain available through loading, errors and empty results.
- REPORT-CLIPBOARD: shared copy helper attempts Clipboard API then legacy copy. It removes the temporary textarea and restores focus even on failure. ReportViewer retains existing success/error feedback; repeated copies reset a single cleaned-up timer.
- Query changes cancel old list requests. Detail requests use a separate controller. Search requests are debounced; filters do not download every report into the browser.

No migration, production data mutation, build, restart, commit or push was performed. Existing unrelated changes were preserved.

## Verification

- 16 targeted unit tests passed across filters, API client, clipboard fallback and rendered filter semantics/states.
- 19 integration tests passed in `testcase-create.integration.test.ts`, using its disposable SQLite fixture. The added regression cases use 31 same-project reports and another project's report to prove filtering beyond page one, counts, legacy type handling, cursor continuation, version/project search and project isolation. API tests also cover invalid filters and positive filtered results.
- TypeScript: `npx tsc --noEmit` passed.
- Scoped ESLint passed for changed source and tests.
- PostgreSQL runtime was not tested. No new raw SQL or schema changes were introduced.

## Design decisions

Antislop mode: during (session selection). Impeccable mode: Operate, narrow hardening of the existing interface.

Design Read: QA report retrieval for testers and leads, preserving Traceva's neutral surfaces and existing brand accent; ENERGY 1 / RHYTHM 1 / MOTION 1.

- Existing semantic colors, typography and components are retained to preserve the current product identity.
- Search and selection controls remain together so users can refine an empty result without leaving the context.
- Result counts come from server data, not the currently loaded subset.
- No new assets, glow, gradients, glass surfaces or decorative motion were added.

## Antislop delivery gate (bounded scope)

This is a source/test handoff, not production visual acceptance. The user explicitly deferred mobile and assigned build to Gemini.

### Hard gate

- R-02 PASS: no new em-dash UI copy.
- R-03 DEFERRED: mobile browser QA skipped by user request; existing responsive wrappers retained.
- R-17 PASS: counts come from scoped database queries; integration fixtures verify them.
- R-18 N/A: no testimonials.
- R-23 PASS: no new brand or media assets.
- R-24 N/A: no navigation additions.
- R-25 DEFERRED: existing semantic colors retained; rendered contrast was not remeasured.
- R-26 PASS (source/unit scope): filters, clear/reset, retry and copy have handlers; no placeholder actions added.
- R-27 PASS (source/unit scope): loading/error/empty branches render; retry and reset remain available.
- R-28 N/A: no FAQ.
- R-32 PASS (source/SSR scope): native input/button controls and Radix keyboard semantics; live keyboard acceptance remains pending.
- R-33 PASS: changes are direct source patches, not runtime/source-rewrite scripts.
- R-34 DEFERRED: existing theme tokens retained; new-render theme acceptance awaits build.
- R-35 DEFERRED: no production build or new-render click-through by explicit user instruction.
- R-36 PASS: no performance, security or compliance claims added.
- R-37 PASS: direction and dials declared before editing.
- R-38 PASS: no fabricated product content.
- R-39 PASS (source/SSR scope): labeled search, named groups and selected-state semantics; existing focus styles retained.
- R-40 PASS (change scope): no media, third-party scripts or unmeasured performance numbers added.

### Purpose gate

- R-01 N/A: no new gradient or color palette.
- R-04 PASS: existing search/clear/document icons describe their actions or content.
- R-06 PASS: existing typography retained; monospace remains limited to numeric counters.
- R-07 N/A: no background pattern.
- R-08 N/A: no decorative arrows.
- R-09 PASS: existing badges show actual report status/metrics.
- R-10 N/A: no new blur/glass.
- R-12 N/A: no new elevation treatment.
- R-13 N/A: no new glow.
- R-14 N/A: no new feature-card layout.
- R-19 PASS: no decorative motion added.
- R-22 N/A: no illustrations.

### Liveliness

- PASS (preservation scope): dials and Design Read declared; existing report content remains focal, toolbar groups related controls, current brand accent and visual identity retained.
- DEFERRED: visual confirmation of the new render awaits Gemini's build.

### Craftsmanship and quality locks

- C-1 PASS: reasons recorded above.
- C-2 PASS (source/unit scope): no dummy controls added.
- C-3 PASS: no filler sections added.
- C-4 DEFERRED: source/state regressions tested; browser/theme acceptance remains pending.
- C-5 PASS: assertions limited to measured tests and actual source changes.
- R-05 PASS: existing task-oriented composition retained.
- R-11 PASS: existing component radius system retained.
- R-15 PASS: action-specific labels for search, reset, retry and copy.
- R-16 PASS: no promotional claims or buzzwords added.
- R-20 PASS: current Traceva identity preserved; no redesign.
- R-21 PASS: no default-theme change.
- R-29 PASS: existing semantic palette retained.
- R-30 PASS: no external product layout copied.
- R-31 PASS: major decisions documented.

## Gemini handoff

Build and restart using the project's normal safe workflow. Do not build while another dev/build process shares `.next`.

After the new build, verify on desktop:

1. Search project name with leading/trailing spaces; the same reports should match.
2. Search a report older than the first 25, combine type/status, load the next page, then reset. Check matching/total/displayed counts.
3. Change query quickly; old results must not replace the newest query. Retry after a failed list request.
4. Navigate the filter groups by keyboard and confirm selected-state announcements.
5. Copy the executive summary and compare visible numbers; check clipboard-denied/unavailable behavior in a controlled browser fixture.
6. Confirm both light and dark appearance. Mobile remains out of the current acceptance scope.

Until that build, the production server still runs the previous implementation, including its old clipboard path.
