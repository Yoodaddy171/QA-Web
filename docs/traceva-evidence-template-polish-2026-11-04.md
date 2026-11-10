# Evidence Report template polish

## Scope and direction

Standalone HTML export only. Existing evidence, testcase status, logs, run selection and video streaming are preserved. No database, authentication, application navigation or production process changes.

Impeccable guided a refinement of the existing Traceva identity, not a replacement: readable paper-style report, a restrained violet accent and a dark technical viewer. ENERGY 1 / RHYTHM 1 / MOTION 1. The report is for QA reviewers inspecting a result, so evidence precedes the longer scenario. Segoe UI is retained for offline availability; monospace is reserved for identifiers and request details.

## Changes

- Clearer testcase heading, outcome summary and project/module context.
- Evidence before scenario; sticky section links retain access to scenario and appendix.
- Labelled network filters, reset action and activity/group counts.
- Complete endpoint paths in log rows; selected request context above Headers/Payload/Response.
- Independent scrolling for activity list and request details, with selection preserving list position.
- Logs-only exports use the full viewer width instead of an empty video column.
- Stronger text/control contrast, keyboard focus, pressed state and reduced-motion support.
- Print layout retains keyframes and the complete supplied log appendix.

## Verification

- 19 tests passed across `evidence-preview.test.ts`, `evidence-renderer.test.ts`, `route.test.ts` and `evidence-html-stream.test.ts`.
- Scoped ESLint passed; TypeScript `tsc --noEmit` passed; scoped `git diff --check` passed apart from Git's existing LF/CRLF conversion notices.
- Browser checks used synthetic data only: video playback/seek, timeline, network search/method/category filters, reset, repeated console groups, Headers/Payload/Response selection and keyboard activation.
- Wheel scrolling changed the internal log list's scrollTop from 0 to 864 without scrolling the detail pane.
- Video, logs-only and empty fixtures were reviewed on desktop; no horizontal document overflow observed.
- Print-media emulation hid interactive controls and retained both keyframes plus all 24 synthetic log rows. Actual paginated A4/PDF output was not tested.
- Browser capture recorded one asynchronous message-channel warning; its origin was not established. No template ReferenceError or TypeError was observed during these checks.
- Mobile testing was excluded as requested. No production build, restart, commit or push was performed.
- Graphify incremental synchronization was attempted. AST extraction finished, but the command did not finish during the bounded wait and was stopped; the graph is not confirmed current. Existing warnings covered seven zero-node JSON files and two partially parsed Groovy templates. This does not affect the validated HTML output.

Preview files and screenshots: `artifacts/evidence-template-preview/`. They contain labelled synthetic examples, not client evidence. Regenerate with `TRACEVA_EVIDENCE_PREVIEW_DIR=artifacts/evidence-template-preview` when running `evidence-preview.test.ts`; without that variable the test does not write preview files or invoke FFmpeg.

## Delivery gate

This gate covers the changed standalone report and the desktop checks above. It does not certify untested mobile behavior, native print-dialog behavior or production deployment.

- R-02 PASS: new interface copy contains no decorative em dash; stored evidence text is preserved.
- R-03 PASS (desktop scope): video, logs-only and empty fixtures had no horizontal document overflow; mobile browser checks excluded by user instruction.
- R-17 PASS: counts derive from the supplied evidence array, not marketing statistics.
- R-18 PASS: no testimonials or fictional customer claims.
- R-23 PASS: no new branded assets; preview media is explicitly synthetic test data.
- R-24 PASS: section links target existing evidence, scenario and appendix IDs.
- R-25 PASS: measured primary text/control samples exceed AA thresholds; normal muted text 5.94:1, dark muted text 9.14:1, input boundary 3.56:1.
- R-26 PASS: filters, reset, tabs, timeline and appendix have handlers/native behavior; print control retains its existing window.print handler.
- R-27 PASS: no-recording, no-log and no-match states remain; static export has no asynchronous application loading flow.
- R-28 PASS: no FAQ introduced.
- R-32 PASS: native links/buttons/fields, visible focus and keyboard activation retained; detail tab activated using Enter in browser.
- R-33 PASS: implementation edited directly in source via apply_patch, not external source-rewrite scripts.
- R-34 PASS: no theme toggle added; paper report and technical viewer use explicit contrasting surfaces.
- R-35 PASS (template scope): actual renderer output ran in browser and the changed interactions were exercised; production build intentionally omitted.
- R-36 PASS: no unmeasured performance, compliance or security claims.
- R-37 PASS: incumbent Traceva visual direction and calm dials established before implementation.
- R-38 PASS: preview data labelled synthetic; production fields remain sourced from the supplied record.
- R-39 PASS: labelled native controls, image alt text, pressed states, focus and reduced-motion rules present; document retains lang, title and main landmark.
- R-40 PASS: viewer and media aspect ratio reserve space; no remote blocking assets or unmeasured speed claims.
- R-01 PASS: no gradient or glow added.
- R-04 PASS: no decorative icon set added.
- R-06 PASS: offline Segoe UI retained; monospace limited to technical identifiers/details.
- R-07 PASS: no decorative grid or pattern.
- R-08 PASS: no decorative arrows added to actions.
- R-09 PASS: badges represent actual status, timestamp and repeated-event counts.
- R-10 PASS: no glassmorphism.
- R-12 PASS: no large repeated shadows.
- R-13 PASS: no glow effects.
- R-14 PASS: no marketing feature-card grid.
- R-19 PASS: only short control feedback; reduced motion disables transitions/smooth scroll.
- R-22 PASS: no generic illustration; preview colorbars are a labelled media test fixture.
- Liveliness/dials PASS: ENERGY 1 / RHYTHM 1 / MOTION 1 reflected in the restrained report.
- Liveliness/focus PASS: outcome and evidence hierarchy precede scenario and appendix.
- Liveliness/space PASS: rules and spacing separate context, viewer and narrative content.
- Liveliness/accent PASS: violet reserved for Traceva identity, section links and active controls.
- Liveliness/motif PASS: paper-style report framing contrasts with a contained technical evidence workspace.
- Liveliness/design-read PASS: QA evidence review was the declared task and composition basis.
- C-1 PASS: typography, accent, surfaces and section order have written functional reasons above.
- C-2 PASS: no dummy action introduced; existing print behavior retained.
- C-3 PASS: sections correspond to evidence, scenario, log appendix and provenance.
- C-4 PASS (tested scope): desktop media/log/empty states and keyboard control checks passed; mobile/PDF pagination remain explicitly unverified.
- C-5 PASS: no fabricated production evidence or claims.
- R-05 PASS: section rhythm follows QA report content, not a landing-page template.
- R-11 PASS: modest radii distinguish report, viewer and controls; no all-pill treatment.
- R-15 PASS: actions describe their outcome, including Reset filter and Cetak / Simpan PDF.
- R-16 PASS: no promotional AI buzzwords added.
- R-20 PASS: Traceva context, QA outcome and paired recording/request inspection drive the composition.
- R-21 PASS: light paper supports sharing/printing; dark viewer separates technical inspection without forcing the entire report dark.
- R-29 PASS: neutral surfaces, one violet accent and semantic success/error colors.
- R-30 PASS: no other product's visual system copied.
- R-31 PASS: major visual choices and reasons recorded in Scope and direction.

## Deployment handoff

Gemini must build/restart the application when appropriate. Re-export Evidence Report after that build to receive this template. Previously downloaded standalone HTML files are snapshots and do not update automatically.
