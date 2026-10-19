# Phase 7.1 — UX quality, accessibility and QA workflow clarity

## A. Executive verdict

**PASSED WITH LIMITATIONS.** The targeted Phase 7 form-label, read-only-affordance and status-explanation gaps are addressed. A newly observed dialog focus-restoration defect was fixed. The main supported QA workflow completed in an isolated Chromium production instance, with independent SQLite read-back. No known High/Critical regression remains in this tested scope. This is not a full accessibility, security, browser or deployment certification.

Branch and HEAD remain `codex/frontend-design-system-motion-optimization` / `0deffe3b79648614e98f30dafc1be382aef16790`. Earlier Phase 6C/7 work is preserved and uncommitted. No staging, commit, push, merge, PR or deployment was performed. No schema, backend authorization, lifecycle, calculation, dependency or framework change.

## B. Initial findings and remediation

| ID / severity | Reproduction and actual problem | Root cause / expected behavior | Resolution and proof |
|---|---|---|---|
| P71-LABEL / Medium | Phase 7 testcase/report forms display labels, but semantic label queries cannot reliably identify controls | Missing `htmlFor`/IDs; custom date labels disconnected; report section IDs shared across instances. Visible labels should name controls | `useId`-prefixed IDs, associated Labels, SelectTrigger IDs, date trigger `aria-labelledby`, required semantics. P71-A1/A2/A3 |
| P71-READONLY / Medium UX, not auth bypass | Viewer opens Cases, inspector, runs or reports and sees write entry points that backend rejects | No shared selected-workspace UI policy. Read views should remain available without misleading mutation actions | Fail-closed workspace access context; hide mutation entry points, disable contextual outcome/evidence controls, guard keyboard/paste/drop paths. P71-B1/B2/B3; server unchanged |
| P71-CLARITY / Medium UX | Run Pass/Fail can be mistaken for inventory status or Bug verification | Three existing state models have insufficient contextual explanation | Short helpers in Cases, inspector, Bugs, Run workspace, dashboard and reports; accurate execution-save message. P71-C-D plus canonical DB checks |
| P71-FOCUS / Medium | Open Add Test Case, Escape, then inspect focus. Initial P71-A1 failed because opener was not focused | Programmatically opened Radix Dialog has no DialogTrigger ref. Closing must restore the actual opener | Capture opener before autofocus and explicitly restore connected element on close. Final P71-A1 and A3 passed |

The initial browser run retained two failures: the real focus issue above and a **test synchronization error** in report smoke. The latter waited for an already visible Back button, then queried SQLite before report save completed. The harness now awaits the authoritative POST and the saved-report view. No server rule was changed to accommodate the test.

A source review additionally caught the risk of hiding first-project creation when no project/workspace selection exists. Creation is separately allowed only for the server's existing default ADMIN+ workspace, without granting unscoped QA editing. A new synthetic empty OWNER workspace verified actual first-project creation in P71-B4. This is not claimed as a separately reproduced baseline product defect.

## C. Accessibility improvements

| Form / field | Before | After | Verification |
|---|---|---|---|
| Testcase native controls | Placeholder-named inputs/textareas; visual labels disconnected | Unique IDs and `htmlFor` for ID, Page/Menu, Sub Menu, Test Action, Steps, Expected Result, Remarks and Tags; required fields expose `aria-required` | A1 semantic queries, validation retains action text and performs no write, real QA create/edit with empty tags |
| Testcase custom controls | Unnamed Select triggers | Label-associated Tipe Test, Prioritas, Module, Actual Result and Status triggers; required type semantics | A1 Enter/select/focus return; A3 complete 13-field Tab sequence |
| Report form | Metadata labels unassociated; repeated section IDs | Instance-prefixed metadata/section IDs; named template/source controls; existing native Version requirement preserved | A2 semantic queries, QA save/edit, required Version focuses on invalid submit without discarding Document ID |
| Report calendar controls | Visible labels separate from button accessible names | Optional `id`/`labelledBy` forwarding; visible labels name trigger; unique `aria-describedby` exposes selected date and “Wajib diisi” without unsupported button `aria-required` | A2 selects date range and checks accessible required descriptions; Escape returns focus; selected value remains visible |
| Report keyboard sequence | Not established by Phase 7 | Nine primary metadata controls reachable in source order | A3 Tab sequence Template → Document ID → Source Cycle → Version → Document Status → Author → Approved By → issue date → period |
| Dialog dismissal | Opener focus not restored | Actual connected opener restored on close | Final A1 Escape assertion; A3 closes without write |
| Read-only controls | Active-looking unauthorized controls | Hidden mutation entries, native disabled execution/evidence controls, read-only notes/comments, disabled settings fieldsets | B1 plus source review; read navigation retained |

A3 checked distinct control IDs across testcase and report forms. Approval/reference controls were located by visible labels in A2; every possible planning-template field and accordion keyboard permutation was not tested. Automated DOM/keyboard observations do not prove how every screen reader announces the form. No WCAG 2.2 certification is claimed.

## D. Role-based UI behavior

Policy authority: `src/proxy.ts:requiredRole`, actual workspace memberships from `/api/auth/status`, `src/lib/auth.ts` hierarchy and workspace member handlers. Project records already return `workspaceId`; no extra backend permission endpoint was added.

| Action | VIEWER | QA | QA_LEAD | ADMIN / OWNER |
|---|---|---|---|---|
| Read testcase/detail and navigate | Allowed | Allowed | Allowed | Allowed |
| Create/edit/delete testcase; bulk writes | Hidden; status rendered read-only | Allowed | Allowed | Allowed |
| Change Bug status | Badge, no mutation selector | Allowed | Allowed | Allowed |
| Record execution / edit run | Disabled outcomes; mutation entries hidden; Next remains usable | Allowed | Allowed | Allowed |
| Evidence upload/delete/replace | Disabled upload/delete; replacement absent; links remain readable | Allowed | Allowed | Allowed |
| Excel import | Hidden | Allowed | Allowed | Allowed |
| Create/edit/refresh/version report | Hidden | Allowed | Allowed | Allowed |
| Finalize report | Hidden | Hidden; server still 403 | Allowed | Allowed |
| Module / project knowledge mutation | Hidden/disabled | Allowed | Allowed | Allowed |
| Project creation/deletion | Hidden | Hidden | Hidden | ADMIN+; creation uses existing default admin workspace; deletion only for selected project |
| Team administration / AI configuration mutation | Unavailable/disabled | Unavailable/disabled | Unavailable/disabled | ADMIN+; team UI restricted to actual default admin workspace |
| Grant/change/remove OWNER membership | Unavailable | Unavailable | Unavailable | **ADMIN cannot** grant OWNER or edit/remove existing OWNER; OWNER can, subject to server's last-owner rules |

`workspaceRole` resolves the exact selected workspace, never maximum membership rank. Unknown workspace, unknown role, failed session load and unauthenticated state do not enable QA mutation. Session metadata is refreshed on workspace change/window focus; no client visibility check replaces server authorization.

The existing team API is **unscoped** and selects the first ADMIN+ membership. This phase does not invent a workspace selection contract or alter that backend. The UI therefore does not present that other workspace's team under a different selected workspace, and explains the limitation. First-project creation remains possible for an empty authorized workspace; it does not globally enable QA controls.

Runtime controls: Viewer own-project PUT testcase and POST execution remained 403 with unchanged state; QA finalization remained 403 and DRAFT; ADMIN A → VIEWER B hid controls and denied B writes without mutation. QA created/edited testcase, changed Bug lifecycle, recorded the later Pass and completed inventory retest. Lead created failed execution/evidence/Bug and finalized report. ADMIN/OWNER existing QA menus and member-owner disabled differences were observed; empty OWNER actually created its first project. This does **not** claim every action was executed for every role.

## E. Workflow clarity and unchanged semantics

New concise copy explains:

- Cases: inventory retest is completed through Done / As Expected on the related testcase; Viewer sees a read-only/QA-permission explanation.
- Inspector Overview: displayed status is inventory status, not the outcome of a Test Run.
- Test Run: an execution outcome belongs to this cycle and does not automatically change inventory or verify a Bug. Save feedback says the same.
- Failed execution context: Create Bug connects the failed execution to its source inventory testcase; subsequent Bug retest uses inventory controls.
- Bugs: READY TO RETEST means QA must retest the source inventory case; Run Pass alone does not verify the Bug.
- Dashboard: readiness summarizes inventory, execution and Bugs; an execution Pass is not automatic Bug verification.
- Report form/view: cycle headline uses latest executions, with inventory and Bug verification separate; finalization requires QA_LEAD+.
- Empty reports for Viewer no longer instruct them to create a report they cannot create.

Observed coherent smoke: inventory initially NOT DONE → historical FAILED execution while inventory remains NOT DONE → upload evidence → contextual Bug creation synchronizes inventory FAILED → QA sets Fixing, then Ready → inventory READY TO RETEST → QA records PASSED execution while Bug **remains READY TO RETEST** → QA sets inventory DONE / As Expected → Bug VERIFIED & FIXED → lead creates/finalizes source-cycle report.

Independent read-back: two historical executions (FAILED by lead, PASSED by QA), one linked evidence file, one VERIFIED & FIXED Bug, source inventory DONE / As Expected, final report `P71-SMOKE` with one passed/zero failed latest results and 11 project activity records. Integrity check `ok`; foreign-key violations zero. The report still correctly recommends READY WITH RISK because three planned cases remain unrun. No automatic synchronization, new status or metric formula was introduced.

## F. Test evidence and gates

### Environment and evidence identity

- Chromium, 1440×900, one worker, zero automatic retries; Browser plugin unavailable, repository Playwright used explicitly.
- Owned production URL `http://127.0.0.1:3119`; fresh synthetic SQLite, A/B memberships and additional empty OWNER workspace. User relay HTTP and WebSocket port 3001 blocked in browser contexts.
- Final isolated build: `C:\Users\Admin\.codex\worktrees\qadesk-phase2-baseline\QA-Web`, Build ID **`ESutzoQzEi__YXUHx008_`**.
- Main and isolated normalized SHA-256 over 266 production/config/package files: **`5f6edc7744ae35b87ef987a089b967d839da0516bfe83e056f09cc4d7fd4ec70`**, equal. Test-only scripts/specs excluded from this production identity.
- Initial `jZXqpyalEFfXOjo1BgjAY` build: six scenarios, four passed/two failed. Intermediate `Tp5ixIZldlqXYpz74dcd0` was built successfully but no browser pass is attributed to it; source review caught the first-project edge before testing it. Workflow-smoke build `7MKGv0BdBcFz_RdLKoY-K` includes that fix and Viewer empty-state copy. The last build `ESutzoQzEi__YXUHx008_` additionally uses valid required/value descriptions for date buttons; A2/A3 were retested after that accessibility-only adjustment.

Evidence roots under `C:\Users\Admin\AppData\Local\Temp\`:

| Root | Evidence and outcome |
|---|---|
| `qadesk-phase7-K9ryVW` | `browser-results-ux-pass1.json`: A2/B1/B2/B3 PASS; A1 focus failure and C-D harness race retained, including traces/screenshots. Initial Viewer screenshot captured loading, so it is not used as settled visual proof |
| `qadesk-phase7-h0y1V7` | Intermediate fixture initialized but no acceptance test run claimed; sessions removed before replacing artifact |
| `qadesk-phase7-PCA5Qa` | `browser-results-ux-final-targeted.json`: A1/B1/C-D/B4 **4/4 PASS** on workflow-smoke build `7MKGv0BdBcFz_RdLKoY-K` |
| `qadesk-phase7-PCA5Qa` | `browser-results-ux-keyboard-supplement.json`: A3 **1/1 PASS**; full field Tab sequences, unique associations, no write |
| `qadesk-phase7-wViTKA` | `browser-results-ux-date-description.json`: A2/A3 **2/2 PASS** on final `ESutzoQzEi__YXUHx008_`, including required calendar accessible descriptions and full field Tab paths |

Eight distinct scenarios passed across bounded selections, **not** one final 8/8 suite. Thirteen total invocations: initial six, workflow-focused four, keyboard supplement one, final date/keyboard two. A2/A3 were rerun on the very last artifact; B2/B3 retain their initial Phase 7.1 proof and the coherent lifecycle is accepted on the preceding date-equivalent workflow build. This provenance is explicit; no all-twelve Phase 7 rerun.

| Gate | Result | Newly executed evidence / limitations |
|---|---|---|
| Form accessibility | PASS targeted | A1/A2/A3 label queries, required states, unique IDs; final-build A2 date accessible descriptions + A3 keyboard passed |
| Keyboard interaction | PASS targeted | Full testcase/primary report Tab paths; Select Enter; date picker Escape; dialog opener restored; validation retains text |
| Viewer read-only UI | PASS targeted | Initial B1 + final B1; cases, detail, comments, run outcomes/file upload, navigation, report create absence; direct forbidden requests and unchanged DB |
| Multi-workspace role behavior | PASS | B2 initial Phase 7.1 build: same user ADMIN A / VIEWER B; actual sidebar switch, scoped denial and unchanged B record |
| QA/lead/admin/owner positive controls | PASS selected | A1/A2/B3; final coherent smoke authenticates explicit QA/lead handoffs; final B4 empty OWNER creation |
| Complete QA smoke | PASS final | Final C-D; real evidence upload, source execution link, lifecycle, inventory retest, final report; canonical SQLite read-back |
| Phase 7 functional regression | PASS selected / reused | New QA empty-tag edit, contextual Bug and source-cycle finalization exercised. Excel/reports client units newly rerun; full browser Excel/import and other prior Phase 7 scenarios reused, not rerun |
| Backend authorization preservation | PASS selected | **8 passed / 38 skipped**: `6B-RBAC`, `6B-MEMBERSHIP`, `6B-MEMBERS:`; fresh integration fixtures. Viewer/QA runtime denials supplement browser proof |
| Unit/client regressions | PASS | **15/15**, four files: workspace permissions, reports client, Excel client, execution shortcuts |
| Lint | PASS | Full ESLint exit 0, followed by focused final file checks exit 0 |
| Typecheck | PASS | Main `tsc --noEmit --incremental false` exit 0; final isolated build TypeScript passes; focused final specs/config typecheck with repository DOM/esnext libraries exits 0 |
| Isolated production build | PASS | Final build above, all 37 static pages, finalizer exit 0; no main build command |
| Visual/source review | PASS scoped / warnings retained | Final settled Cases, Viewer Reports and Final Report screenshots inspected; no demonstrated clipping/overlap in those desktop views. No redesign or broad visual certification |

Workflow screenshots: `p71-cases.png`, `p71-viewer.png`, `p71-report-final.png`, `p71-report-form-keyboard.png` in `qadesk-phase7-PCA5Qa`; final date/keyboard screenshot also in `qadesk-phase7-wViTKA`. They prove selected rendered states, not all responsive/theme/assistive-technology combinations. Network method/path/status and pageerror arrays attached to tests; passing scenarios report no pageerror. Expected API 403 is not a console-health failure.

Impeccable hardening/polish workflow preserved incumbent styling. One mechanical detector invocation reported two **pre-existing warnings**, verified against HEAD: Cases loading `animate-bounce` and Inter in an exported evidence HTML string. They were intentionally not redesigned under this scope. A detector warning or clean scan is not accessibility certification. Graphify was queried read-only; synchronization that can replace/clean graph artifacts was skipped to preserve existing artifacts.

Reproducibility commands:

```powershell
node scripts/phase7-environment.mjs C:\Users\Admin\.codex\worktrees\qadesk-phase2-baseline\QA-Web\.next\standalone --ux
$env:QA_PHASE7_ROOT = '<fresh emitted root>'
$env:QA_PHASE7_RUN = 'unique-label'
node node_modules/@playwright/test/cli.js test --config playwright.phase7-1.config.ts
node node_modules/vitest/vitest.mjs run src/lib/client/workspace-permissions.test.ts src/lib/client/api/reports-client.test.ts src/lib/client/api/excel-client.test.ts src/lib/client/execution-shortcuts.test.ts
node node_modules/vitest/vitest.mjs run --config vitest.integration.config.ts src/lib/backend-phase6b.integration.test.ts -t '6B-RBAC|6B-MEMBERSHIP|6B-MEMBERS:'
```

The full Phase 7.1 command above is rerun guidance, not a claim that every scenario ran together on the final artifact. Do not use the default E2E config or real DB. Stop only the verified owned child before guarded `--cleanup`; offline synthetic evidence remains, sessions/fixture credential manifest are removed.

## G. Exact changed files and phase separation

### Existing Phase 6C work — preserved, not authored here

`src/lib/services/stats-service.ts`; `src/lib/services/stats-query.test.ts`; `src/lib/backend-phase6c-stats.integration.test.ts`; `scripts/phase6c-benchmark.mjs`; `scripts/phase6c-server.mjs`; `scripts/phase6c-http-concurrency.mjs`; `scripts/phase6c-reliability.mjs`; `scripts/phase6c-worker.mjs`; `docs/backend-phase6c-local-scalability-report.md`.

### Existing Phase 7 work — preserved

Five functional fixes remain in `TestCaseDialog.tsx` (empty tags), `TestRunsPanel.tsx` (Bug JSON body), `ReportForm.tsx` (canonical source response), `src/lib/client/api/excel-client.ts` (query/form scope) and `src/lib/client/api/reports-client.ts` (JSON action body). Existing client tests, `e2e/phase7.acceptance.spec.ts`, `playwright.phase7.config.ts`, `scripts/phase7-environment.mjs` and `docs/phase7-end-to-end-functional-acceptance.md` remain. Three components and the fixture script now also contain explicitly listed Phase 7.1 additions; no earlier fix was reverted.

### Phase 7.1 production files — 22

| File | Phase 7.1-only purpose |
|---|---|
| `src/components/WorkspaceAccess.tsx` (new) | Fail-closed scoped UI context, session refresh, mutation wrapper, default admin/first-project handling |
| `src/lib/client/workspace-permissions.ts` (new) | Pure exact-membership role resolution and hierarchy helper; no server imports in client |
| `src/lib/client/api/types.ts` | Existing Project.workspaceId represented in client type |
| `src/app/page.tsx` | Provide selected workspace permissions; gate create shortcut/dialog and AI flows; reset report context per project; prevent stale other-project inspector |
| `src/components/TestCaseDialog.tsx` | Native/custom labels, required semantics, instance IDs, opener focus restoration; Phase 7 tags fix preserved |
| `src/components/ReportForm.tsx` | Metadata/section/date associations and source helper; Phase 7 source fix preserved |
| `src/components/ui/date-picker.tsx` | Backward-compatible optional trigger ID/labelledBy and valid required/value descriptions |
| `src/components/TestCaseTable.tsx` | Gate create/import/bulk/status affordances; short inventory/read-only explanations |
| `src/components/TestCaseTableBody.tsx` | Read-only status badges and gated Edit/Duplicate/Delete menu items |
| `src/components/TestCaseDetailDialog.tsx` | Manual capture mutation entry hidden without QA permission |
| `src/components/TestCaseDetailDialogFooter.tsx` | Gate edit/refine; keep close/evidence report read actions |
| `src/components/TestCaseDetailsTab.tsx` | Explain inventory and retest semantics |
| `src/components/TestCaseCommentsTab.tsx` | Viewer read-only comments, no posting action |
| `src/components/TestRunsPanel.tsx` | Outcome/edit/evidence/shortcut gating and helpers; Phase 7 JSON Bug fix preserved |
| `src/components/BugFixPanel.tsx` | Viewer status badges; READY TO RETEST next-step explanation |
| `src/components/TraceabilityPanel.tsx` | Hide create/manage mutation entry points; keep lanes/navigation |
| `src/components/ReportsPanel.tsx` | Gate report creation |
| `src/components/ReportViewer.tsx` | Tier-correct draft/final/version actions and status semantics copy |
| `src/components/ReportHistory.tsx` | Viewer-appropriate empty-state instruction |
| `src/components/SettingsPanel.tsx` | Scoped project/module/team/knowledge/AI mutation affordances; preserve readable settings |
| `src/components/WorkspaceMembersCard.tsx` | ADMIN cannot edit/remove OWNER; OWNER controls preserved |
| `src/components/DashboardPanel.tsx` | Concise readiness/inventory/execution/Bug distinction |

### Phase 7.1 tests / fixture / documentation — 5

- `src/lib/client/workspace-permissions.test.ts` (new): seven cases including five role tiers, cross-workspace downgrade, unknown-state deny.
- `e2e/phase7-1.acceptance.spec.ts` (new): eight focused semantic/role/workflow scenarios, API observations and persistence assertions.
- `playwright.phase7-1.config.ts` (new): extends guarded Phase 7 config, no second framework or default-user server.
- `scripts/phase7-environment.mjs` (shared Phase 7 file): opt-in `--ux` additional synthetic actors, ADMIN A/VIEWER B membership and empty OWNER workspace; ordinary Phase 7 fixture behavior retained.
- `docs/phase7-1-ux-accessibility-workflow-clarity.md` (new): this report.

Unrelated `.codex/`, `.mcp.json`, clipboard instructions/CV, prior handoff, staging Playwright files/results and `graphify-out/` preserved. No Git staging separates or absorbs these phases; this manifest describes overlaps precisely for later review.

## H. Remaining limitations

- Chromium desktop only. No mobile/tablet, Firefox/WebKit, full light-theme matrix, physical screen reader, high contrast, zoom/contrast certification or exhaustive keyboard audit. Static fields such as computed weight remain non-input information.
- Not every role/action combination was executed. Delete/resequence, bulk mutations, evidence replacement/deletion with existing files, workspace membership writes and every report export/version path were source-reviewed/gated but not fully exercised in this phase.
- Team/project creation still use existing default admin workspace API behavior; arbitrary workspace selection for those operations needs a separate backend/API change. Current UI prevents showing unrelated team administration rather than claiming that capability exists.
- Existing three-state mental model remains; concise hints reduce ambiguity but do not constitute user research. No inventory/run auto-sync was added. An all-Pass run still does not independently verify a Bug.
- Prior Phase 6A/6C transaction/stats evidence is reused, not relabeled newly executed scalability/concurrency testing. No full historical E2E, security/performance matrix, soak test, external scan, PostgreSQL or SaaS deployment acceptance.
- UI session metadata refreshes on workspace/focus, not live role push. Server continues to re-evaluate authorization for every request. Frontend gating is never a security boundary.
- Two pre-existing detector warnings remain as described. No unrelated visual-world change was justified.
- User main services/build changed externally during the task: initial build ID `SG3cqw3ttuk_5_z7f3xEs` / listeners 19736 and 22580; later observed main ID `AmyDLAA7FqMbgWcvb59Fm`, 3000 PID 7580 and 3001 PID 18472. All agent build/finalizer commands targeted the isolated checkout and stop commands only verified owned 3119 children. Therefore this report does not claim the user's runtime remained byte-for-byte unchanged; it was not used for acceptance or modified by our runtime commands.

## I. Final recommendation

1. **Forms meaningfully more accessible:** yes within label, required-state, keyboard, validation retention and focus checks, not a full conformance claim.
2. **Viewer read-only UX:** consistent in tested primary paths; navigation/read/export remain distinct from mutations. Untested actions are listed above.
3. **Selected-workspace scope:** yes, exact-membership resolution and ADMIN A → VIEWER B browser/server proof; default administration API limitation explicit.
4. **Status distinctions:** concise, accurate explanations shipped and verified against actual persistence. No unsupported automatic synchronization claim.
5. **Main QA workflow:** passed end-to-end, including real evidence, QA retest, Bug verification and lead-finalized report.
6. **Introduced High/Critical defects:** none known in tested scope. Focus regression is resolved; first-project onboarding risk is covered.
7. **Ready for focused code review:** yes. Review UI permission surfaces, default admin behavior and Dialog focus handling first. No activation, commit or deployment is implied.

### Final handoff checks

Full lint and main typecheck completed successfully; subsequent focused lint passed. The standalone test-only typecheck initially omitted the repository's `lib: esnext` setting and rejected `replaceAll` / `Object.hasOwn`; repeating with the actual repository DOM/esnext libraries passed without changing application code. Final date descriptions use valid button semantics rather than unsupported `aria-required`; the last isolated build/report-keyboard verification is recorded in the evidence addendum below.

The first three fixture roots were cleaned: sessions revoked, plaintext credential manifests removed, SQLite integrity `ok` and zero foreign-key violations. Offline evidence retained. Port 3119 was free after their cleanup; user listeners remained 3000 PID 7580 and 3001 PID 18472. Staged diff empty; `git diff --check`, branch and HEAD checks passed. No real runtime activation or Git delivery.

The last `qadesk-phase7-wViTKA` server was likewise positively matched to its ownership record/parent before stopping. Guarded cleanup revoked its sessions and removed the plaintext fixture manifest; retained SQLite integrity is `ok`, with zero foreign-key violations. No owned 3119 listener remains. Offline DBs, screenshots, results and failure traces are intentionally retained. Raw traces may contain now-revoked synthetic session headers and should not be publicly uploaded without review.
