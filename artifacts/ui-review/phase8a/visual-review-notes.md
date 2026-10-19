# QADesk Phase8A visual review notes

Verdict: **COMPLETE WITH LIMITATIONS**

129 original PNG captures; 105 desktop state entries; eight primary authenticated routes. Additional viewport/theme captures are variants, not extra application pages.

## Evidence boundaries

- First-owner bootstrap was not captured: the isolated database already contains synthetic accounts. Normal login and required-field validation were captured.
- No real AI inference, Figma sync, manual browser launch, external website execution, destructive confirmation, or security/performance acceptance was performed. Forms and existing feedback states were captured only.
- The compiled relay URL is port3001. Browser HTTP was forwarded to unmodified owned relay3117; live WebSocket3001 was blocked. No request reached the personal relay. Relay Offline and readiness warnings reflect this isolated configuration.
- The three-second recording is synthetic fixture media built from the actual dashboard screenshot, not proof of a real website test. Original screenshot PNGs were never transformed.
- Several inspector tab switches left the body empty. Their content was captured after closing/reopening the same testcase without route reload; UI-127 preserves the empty-body defect.
- Viewport captures and bounded scroll segments cover important regions, not every table permutation, every report version, or every branch of every external integration.
- Screenshots establish visual evidence only. They do not prove WCAG conformance, keyboard completeness, successful mutations, 60 FPS, or release readiness.

## Directly supported accessibility observations

- Statuses pair text with color and frequently an icon (Cases/Bugs/cycle captures). This is not a measured contrast result.
- Calendar and table controls retain native rendered focus treatment where focused during capture. No exhaustive keyboard or screen-reader audit was run.
- Knowledge edit uses an icon-only control whose source has no accessible name; it becomes visible on row hover. Its actual edit state is UI-083. This collection did not alter the control.
- Narrow captures preserve the actual horizontal tab/table constraints and responsive navigation. No assertion of complete mobile usability is made.

## Dashboard

Screenshot IDs: UI-001, UI-002, UI-003, UI-101, UI-107, UI-116

Captured states: overview, attention, module-progress, compact, narrow, light

Release decision and active cycle dominate the first viewport. Advanced analytics require vertical scrolling on desktop (UI-001..003); mobile initially collapses these analytics (UI-107).

Missing states: None among the inventoried representative states; global limitations above still apply.

## Cases

Screenshot IDs: UI-004, UI-005, UI-006, UI-007, UI-008, UI-009, UI-010, UI-011, UI-012, UI-013, UI-014, UI-015, UI-016, UI-017, UI-018, UI-019, UI-020, UI-021, UI-022, UI-023, UI-102, UI-108, UI-117, UI-125, UI-126

Captured states: table, compact-density, filters, date-picker, columns, saved-views, export-menu, row-menu, status-menu, create, validation, edit, bulk-actions, bulk-status, bulk-assign, bulk-execute, delete-confirm, empty-search, import-preview, ai-generator, compact, narrow, light, table-bottom, create-bottom

The 1440px table truncates long test actions and some result badges. Authentication wraps over two lines in UI-004. Compact density exposes more rows. Filter/date/columns/views/export/action menus, bulk dialogs, create/edit, validation, import preview and empty search are captured. Import was not confirmed.

Missing states: None among the inventoried representative states; global limitations above still apply.

## Inspector

Screenshot IDs: UI-024, UI-025, UI-026, UI-027, UI-028, UI-029, UI-030, UI-031, UI-032, UI-033, UI-034, UI-035, UI-036, UI-037, UI-038, UI-039, UI-040, UI-041, UI-042, UI-109, UI-118, UI-127, UI-129

Captured states: overview, overview-bottom, steps, traceability, execution, evidence, bugs, history, comments, automation, automation-network, automation-network-detail, automation-console, automation-execution, automation-fullscreen, automation-event-detail, automation-timeline, ai-refiner, evidence-report, narrow, light, transition-empty-body, timeline-event-menu

The desktop inspector is right-aligned, with a fixed header/footer and horizontal tab rail; the last tab needs horizontal scrolling. Viewport-bound internal scrolling is visible in UI-024/025. UI-127 records a selected Steps tab with no mounted body; tab content captures use the close/reopen recovery noted in the manifest. Evidence, linked bugs, immutable history, comments and recovered DevLog content are included.

Missing states: None among the inventoried representative states; global limitations above still apply.

## Bugs

Screenshot IDs: UI-043, UI-044, UI-045, UI-046, UI-047, UI-103, UI-110, UI-119

Captured states: active, resolved, status-menu, detail-lifecycle, empty, compact, narrow, light

The active and fixed tables use a different column set and uppercase status treatments from Cases. The explanatory retest guidance is visible above the table. Lifecycle detail, status menu and an empty project are included.

Missing states: None among the inventoried representative states; global limitations above still apply.

## Test Cycles

Screenshot IDs: UI-048, UI-049, UI-050, UI-051, UI-052, UI-053, UI-054, UI-055, UI-056, UI-104, UI-111, UI-120

Captured states: list, workspace, notes-evidence, create-bug, new-cycle, cycle-dates, edit-cycle, assign-cases, empty, compact, narrow, light

A run list, execution rail/canvas/context and outcomes are shown. The primary 1440px workspace is dense; evidence/context controls extend vertically. Compact/narrow captures document the actual adaptation without changing widths. Create Bug is a contextual direct action, not a second dialog.

Missing states: None among the inventoried representative states; global limitations above still apply.

## Traceability

Screenshot IDs: UI-057, UI-058, UI-059, UI-060, UI-061, UI-062, UI-112, UI-121

Captured states: lanes, uncovered, new-relation, new-relation-bottom, manage-relation, empty, narrow, light

Requirements, Test Cases, Test Plans and Test Cycles are lanes within one route. New Relation and Manage Relations are distinct sheets. The form requires internal scrolling. Coverage summaries and uncovered-gap filtering are shown; no new relationship mutation was required.

Missing states: None among the inventoried representative states; global limitations above still apply.

## Reports

Screenshot IDs: UI-063, UI-064, UI-065, UI-066, UI-067, UI-068, UI-069, UI-070, UI-071, UI-072, UI-073, UI-074, UI-075, UI-105, UI-113, UI-122, UI-128

Captured states: list, create-status, source-select, date-picker, create-planning, form-bottom, draft-preview, draft-bottom, final-preview, planning-preview, new-version, empty, error, compact, narrow, light, draft-middle

The list, two templates, source/date selection, long forms and draft/final/planning previews are present. Header, middle and bottom segments retain readable content. The new-version result is an actual synthetic 1.0.1 draft. UI-075 is an explicitly controlled HTTP500 error, not a spontaneous backend failure.

Missing states: None among the inventoried representative states; global limitations above still apply.

## Settings

Screenshot IDs: UI-076, UI-077, UI-078, UI-079, UI-080, UI-081, UI-082, UI-083, UI-084, UI-085, UI-086, UI-087, UI-106, UI-114, UI-123

Captured states: system, team, ai, ai-bottom, projects, create-project, knowledge, knowledge-edit, integrations, modules, create-module, viewer-team, compact, narrow, light

All seven existing sections are represented: System, Team, AI, Projects, Knowledge, Integrations and Modules. Team shows synthetic roles and empty password input; no credential values are visible. The system readiness relay blocker and AI warning are expected in the isolated host configuration. Viewer Team is read-only.

Missing states: None among the inventoried representative states; global limitations above still apply.

## Automation

Screenshot IDs: UI-088, UI-089, UI-090

Captured states: history, record-detail, empty

The history vault contains one synthetic captured testcase. Its detail uses the shared inspector. Populated DevLog network/console/execution, expanded payload, system fullscreen and recording timeline are in the Inspector section. No live personal relay connection or real browser capture was used.

Missing states: None among the inventoried representative states; global limitations above still apply.

## Global

Screenshot IDs: UI-091, UI-092, UI-093, UI-094, UI-095, UI-096, UI-097, UI-098, UI-099, UI-100, UI-115, UI-124

Captured states: notifications, command-search, project-menu, account-menu, theme-menu, ai-chat, viewer-cases, login, login-validation, loading, narrow, light

Notification, command palette, project/account/theme menus, AI chat, Viewer Cases and login are included. UI-100 deliberately holds a real testcase GET to expose the existing loading skeleton. Narrow navigation is captured with the responsive sidebar open.

Missing states: None among the inventoried representative states; global limitations above still apply.

## Source and safety

Branch `codex/frontend-design-system-motion-optimization`; HEAD `0deffe3b79648614e98f30dafc1be382aef16790`; isolated build `ESutzoQzEi__YXUHx008_`. Browser Chromium 149.0.7827.55.
Production source parity: 282 tracked/new production/config/schema/package files compared with the isolated checkout; zero differences. Zero production file changes during capture. The main build and ports3000/3001 were preserved. No stage/commit/push/merge/deploy.

The package excludes all SQLite data, session cookies, private fixture files, relay credentials, traces, environment files and repository source. Synthetic example session-placeholder text inside a network payload is not an authentication credential.
