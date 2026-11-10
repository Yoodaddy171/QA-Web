# Traceva — efficiency cleanup

Date: 2026-10-26

## Scope

Targeted logic and data-loading improvements. No redesign, schema migration, UUID change, or production database mutation.

1. **Excel import:** each row's testcase, activity, and initial failed-case bug commit in one transaction. Failed rows roll back and return sanitized row errors; partial imports produce a warning rather than an unconditional success notification.
2. **Bugs:** server pagination (25 rows), module and active/resolved filters, page controls, request failure feedback, and query resets replace filtering only the previously loaded subset.
3. **Traceability:** create/link testcase choices load on demand with debounced remote search and pagination. Choices are no longer restricted to the initial 200 testcases; stale options cannot be submitted during a query change.
4. **Playwright Studio:** log reads resume from bounded byte checkpoints while preserving line cursors. Active polling, idle polling, hidden-tab behavior, terminal log draining, and debounced draft persistence reduce redundant work.
5. **Dashboard:** identical in-flight statistics requests share one promise. Superseded requests are aborted; project/version guards prevent stale responses from replacing the current project's statistics.
6. **Test Runs:** list summaries use grouped status counts instead of loading every case status. Execution updates the affected case locally and retrieves only the run summary, preserving loaded pages.
7. **Reports:** an opt-in summary endpoint returns paginated card data; full report content loads when opened. Legacy API callers retain the default full response.

## Verification

- Unit suite: 399 passed, 1 skipped across 74 files.
- Disposable SQLite integration suite: 17 passed, including import rollback, grouped run summaries, and opt-in report summaries.
- TypeScript: passed.
- UI component preview: 27 checks passed at desktop (1440 px) and mobile (390 px), with synthetic API fixtures and no runtime console/page errors. This is not a full authenticated production end-to-end test.
- Impeccable detector on changed UI surfaces: passed; incumbent styling retained.
- Whitespace/diff validation: passed.

The preview covered Bugs pagination/filter reset, Traceability lazy search/page changes, report pagination/detail fetch, statistics request deduplication/project isolation, and Studio event draining/terminal polling.

## Compatibility and deployment

- Existing default report and testcase API contracts remain available. Compact responses require `view=summary` or `view=options` respectively.
- No application-wide FPS or production latency improvement is claimed from synthetic checks.
- Existing local MCP and automation-history changes were preserved, not replaced.
- Production ports 3000/3001 were not stopped. A fresh production build and restart are still required to deploy these source changes.
- No commit or push was performed as part of this cleanup.
# Follow-up: scoped requests, selected Studio export and large histories

- Automation Log now uses server filtering and pages of 25 rows (`page`, `limit`, `search`, `moduleId`). The response includes filtered summary counts and available module IDs. `view=records` returns testcase recording flags without testcase detail rows; ordinary pages include flags only for their visible rows.
- Project/query request ownership aborts prior loads and rejects late responses even if the transport ignores cancellation. The notification center remounts per project, suspends background polling in hidden tabs and reports failed read mutations without falsely clearing unread counts.
- Studio history uses `history-index-v1/<project hash>` case markers. The first request discovers pre-index histories once; later requests inspect registered cases only. Enqueue registers independently written case markers. Delete leaves a small case marker, never a copied run, so there is no ghost result or lost concurrent enqueue. Remove the project's `ready.json` to explicitly rebuild the compatibility index after an out-of-band historical restore.
- Evidence Report sends `source=studio`, `runId` and the selected video `artifactId`. The server applies Studio's owner/admin authorization, validates project/case/run ownership and real artifact containment, and returns an error rather than substituting another run. HTML remains self-contained for offline use; its existing bounded exported log subset is unchanged.
- Variable-height devlog windowing reuses existing scroll containers, measures expanded rows and supports keyboard scrolling/offscreen event selection. All events remain in storage and in the selected result; only visible rows plus overscan mount in the DOM. Backfill accumulates event pages without copying the full prefix each page and publishes UI snapshots at a bounded cadence.

## Follow-up: Test Run drafts, large case pickers and evidence galleries

- Test Run notes flush before changing case/run, unmount and page exit instead of relying solely on a 180 ms timer. Storage failures retain the pending draft and show an error. Run, case-page and execution-evidence requests reject superseded responses.
- Resume uses a project/guest-scoped UUID preference (`traceva.testRun.lastCase.v2`) and a bounded server page containing that UUID. Legacy numeric positions migrate on read; preceding pages remain accessible. UUIDs and existing relations are unchanged.
- The add-testcase picker uses debounced server search and pages of 25 option records. Selections survive page/search changes, including cases beyond the old first-200 boundary.
- The inspector evidence tab retrieves metadata from `GET /api/testcases/:id/evidence?projectId=...&limit=25&cursor=...`, not the complete traceability tree. Execution evidence has a separate load-more control. Photo preview can continue into subsequent metadata pages with buttons or arrow keys.
- Image thumbnails use authenticated `thumbnail=1` requests and bounded WebP generation (640×360 maximum, two concurrent decodes, 16 MB/64-entry memory cache). Original files are never modified. Source read/pixel limits bound processing; failed thumbnails leave the original preview accessible. No new disk storage or schema is introduced.
- Settings AI/Knowledge requests start only when their tabs need them. Failed Knowledge reads show an error/retry state, not an empty-success state; non-admin users do not mount the AI configuration card.

Verification: 457 unit tests passed, 1 skipped; two new disposable SQLite integration tests passed (230 run cases and 70 evidence records); TypeScript and repository lint passed. A parallel suite attempt timed out in the existing devlog SQLite test; that test and the complete serial suite subsequently passed without changing timeouts. Isolated UI fixtures passed 32 assertions at 1440/390 px with no page runtime errors, covering late responses, quick draft navigation, paged selection, photo continuation and lazy Settings errors. Browser plugin not available; regular Playwright was used against a temporary Vite component preview. This does not prove a full authenticated production workflow or production performance. Production build/restart and Git delivery were not performed.

