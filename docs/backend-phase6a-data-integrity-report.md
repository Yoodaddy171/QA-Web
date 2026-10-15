# Phase 6A — Backend data integrity, transactions and concurrency

Date: 15 October 2026. Base and remote HEAD verified as `ffe5fab241eb9e042b7254a1e01821c7ae1cbbba` on `codex/frontend-design-system-motion-optimization`.

## A. Executive summary

**PASSED WITH LIMITATIONS** for the targeted SQLite Bugs PUT, Testcases PUT/PATCH and Bugs/Testcases GET paths. This is not full application release readiness or PostgreSQL acceptance.

The original non-atomic Bug mutation was reproduced with a real SQLite failure trigger: HTTP 500 left the Testcase READY TO RETEST while its Bug remained FIXING. The corrected workflow commits the Bug, related Testcase and new related history together. Conditional writes and Serializable transactions protect stale server-side reads. Conflicts return HTTP 409 without success-shaped data or automatic replay.

Four initial regressions failed against the original source (atomic rollback, retry timestamps, failed retest bounce, tied pagination); all passed after the initial patch. The final expanded SQLite suite has **22 passing tests**, using newly created synthetic databases only. Unit tests: **31 passed across 6 files**. See section E for static gates and limitations.

No schema, index, dependency, authentication architecture, status names, UI rendering, or real user data was changed. No services on 3000/3001 were stopped, no `.env` was edited, and no commit/push/PR or Graphify analysis was performed.

## B. Confirmed findings

### 6A-ATOMIC — High: partial Bug/Testcase update

- Endpoint: `PUT /api/bugfix`.
- Expected: READY or bounce-back changes commit with the source Testcase, or neither changes.
- Reproduction: create a FIXING Bug with FAILED source; install a disposable SQLite trigger rejecting Bug updates; request READY. Original code returned 500 but persisted the source as READY with changed progress and updatedAt.
- Cause: source update completed before a separate global-client Bug update.
- Fix: `updateBugFixStatus` uses a Serializable interactive transaction. All writes and history use `tx`; returning the canonical included-module row preserves the success response shape.
- Regression: real trigger failures at Bug update, Testcase update and history insertion; complete before/after persisted snapshots must match after failure.

### 6A-RACE — High: unguarded stale writes

- Endpoints: Bugs PUT, Testcases PUT; bulk Testcase synchronization inspected and hardened using the same transaction policy.
- Expected: a decision based on a superseded server read must not overwrite the winning mutation.
- Reproduction/protection: tests gate two actual Prisma reads before either request may mutate. Same-transition and opposing-transition races both produce exactly one HTTP 200 and one HTTP 409. A paused old request is also released only after two newer transitions have committed; it is rejected and final READY/READY state remains intact. Concurrent testcase failures create one Bug and one testcase status history entry, not duplicates. READY versus successful testcase retest yields only a consistent winning pair.
- Cause: original Bugs route validated a global read, then updated by ID alone; original Testcases PUT likewise derived data from a pre-transaction read and performed an unconditional update by ID.
- Fix: compare ID, project, expected status and updatedAt in `updateMany`; testcase PUT also compares actualResult. A zero count aborts the entire transaction. Explicit updatedAt values advance at least one millisecond for guarded writes, including a stationary/backward clock. Serializable protects cross-record read/write dependencies in both single and bulk transactions.
- Tests assert final records, stage timestamps, committed status-history counts and retry effects, not HTTP alone.

### 6A-RETRY — Medium: retry rewrites lifecycle time

- Endpoint: Bugs PUT.
- Reproduction: REPORTED → FIXING, capture all records, repeat FIXING. Original fixingAt and updatedAt changed again.
- Fix: a same-state request revalidates its snapshot and returns the canonical row without writing or creating history. Real re-entry into a stage still records a new stage timestamp; reportedAt remains the original report timestamp. READY/fixing bounce preserves the existing readyAt; verification still sets fixedAt from testcase completion; regression reopens the resolved Bug and clears fixingAt/readyAt/fixedAt.
- Regression: exact persisted snapshot equality across retry, including after the winning concurrent transition.

### 6A-RETEST — Medium: failed testcase retest leaves Bug READY

- Endpoints/services: Testcases PUT/PATCH and `syncBugFixForTestCaseStatus`.
- Reproduction: READY source + READY Bug, set testcase FAILED. Original code found an active Bug and returned without changing it.
- Fix: the ready active Bug moves back one adjacent stage to FIXING inside the caller's transaction, sets fixingAt and records status history. Source-project matching is enforced. The established successful retest resolver and VERIFIED & FIXED completion policy remain unchanged; direct Bugs verification is still forbidden.
- Regression: both single and duplicate-ID bulk failed retests; repeated FAILED does not create another Bug or another bounce/history effect. Successful retest and a genuine subsequent regression are also tested.

### 6A-PAGE — Medium: non-unique ordering

- Endpoints: Bugs GET and Testcases GET.
- Reproduction: insert IDs in `c,a,b,d` order with identical createdAt. Original Bugs ascending response was not the unique-ID tie order.
- Fix: use `[{ [validatedPrimary]: requestedDirection }, { id: requestedDirection }]` in both endpoints. Supported primary fields, defaults, filters, page size and response shape are unchanged. The resolved-Bug lookup also uses a unique secondary key when choosing the latest resolved Bug to reopen.
- Regression: both directions, adjacent pages, repeated reads, normal reload-equivalent requests, real lifecycle updates changing updatedAt, all allowed primary sort fields, fallback sort and filtering.

### 6A-BULK-HISTORY — Low: incomplete actual-result history

- Endpoint: Testcases PATCH.
- Cause: existing bulk transaction recorded a status change but omitted its automatic `Not As Expected` → `As Expected` change on DONE.
- Fix: retain the transaction/loop and record that changed actualResult field using the same transaction client. No-op history is not added.
- Regression: two ready cases → DONE with duplicate and missing IDs, assert one status entry and one actualResult entry per case, correct verified Bugs and timestamps; repeat produces no extra history. Failure on the second Bug rolls back the entire batch.

### 6A-PROJECT — Defense-in-depth relationship validation

The schemas permit a Bug's project and its source Testcase's project to differ despite both foreign keys being individually valid. Synthetic mismatched records demonstrate why checking both matters. This is not a claim of a newly exploitable authentication bypass.

Bug mutation now rejects mismatched relationships with 409. Testcase synchronization rejects any mismatched Bug relationship and rolls back rather than changing or silently re-homing the foreign Bug. Ready and verified sync queries are project-scoped. An intentionally orphaned fixture Bug returns 404 without partial updates. Production foreign-key constraints were not changed.

## C. Transactions and concurrency

| Path | Atomic consistency boundary | Conflict behavior |
|---|---|---|
| Bugs PUT | Conditional Bug write, source synchronization, related history, canonical row read | Stale snapshot/relationship mismatch: 409; missing source/Bug: 404 |
| Testcases PUT | Conditional testcase write, Bug sync, existing field history | Stale snapshot: 409; everything rolls back |
| Testcases PATCH | Existing full-batch transaction, per-record guards, Bug sync, changed-field history | Any failure aborts the full batch |

All three use Serializable isolation; the read outside the Bugs/Testcases PUT transaction intentionally represents the expected server snapshot, not authority for an unconditional write. No global-client writes occur inside these transaction callbacks.

`P2034` (serialization/deadlock), `P1008` (operation timeout), `P2028` (transaction closed/expired) and `P2025` (resource lost during mutation) map to a controlled 409 instructing reload. Unexpected failures remain 500. Diagnostic logs retain route context and Prisma error code, not SQL, raw Prisma messages or record contents. Controlled domain errors retain 400/404/409. Existing client functions reject 409 and show the server error; they do not report success or automatically retry a stale decision. This behavior has a focused client test, not a browser acceptance claim.

Retry semantics: completed same-Bug-status retry is a true no-op. A currently pending stale request fails 409, including when its desired status happens to equal the winner's status. A later deliberate request is evaluated against a newly read current state. Bulk `updated` continues to mean unique existing matched records, including same-status matches, not the count of lifecycle changes.

Bulk missing-ID policy is preserved: valid existing IDs are processed; missing IDs are ignored; duplicates act once; all missing yields `{ updated: 0 }`. Invalid status and an empty ID list are rejected at the route. Proxy membership/role checks run before the handler and prevent an unauthorized existing ID in a mixed-project batch from being mutated. Service functions remain internal and do not replace the proxy's authorization boundary.

Compatibility: Prisma conditional updateMany and Serializable are supported by the repository's SQLite/PostgreSQL Prisma configurations. **Only SQLite was executed.** No PostgreSQL server/client generation, migration or isolation test was run. PostgreSQL serialization/deadlock response behavior is code-reviewed and unit-tested by error code, not proven against a live PostgreSQL transaction.

## D. Pagination

Before: one non-unique primary sort only. After: the same primary sort and direction plus `id` in that direction. Default Bugs createdAt DESC and Cases testCaseId ASC are retained. Offset/limit/count response contracts remain unchanged.

Equal-timestamp synthetic data has stable repeated results, no duplicate IDs between adjacent pages and no missing rows for unchanged primary data. Actual status transitions change updatedAt without changing createdAt pagination order. Sorting primarily by updatedAt intentionally moves a changed record according to that primary value.

This does **not** provide a snapshot across requests or between count and row reads. Inserts, deletes or changes to a primary/filter field between offset-page requests can still shift page boundaries. No cursor system or snapshot pagination was introduced.

## E. QA results

| Gate | Result | Evidence |
|---|---|---|
| Lint | PASS: full repository, 0 errors/warnings | `npm run lint`, final rerun exit 0 |
| Typecheck | PASS | `npm run typecheck`, final rerun exit 0 |
| Targeted unit tests | PASS: 31 tests / 6 files | Existing Bug lifecycle/sync/history/client tests plus testcase resolver and mutation-error tests |
| SQLite integration tests | PASS: 22 tests / 1 file | `npm run test:integration -- src/lib/backend-phase6a.integration.test.ts` |
| Concurrency regression | PASS | Read barriers, no sleeps; same/opposing Bug writes, paused stale write, duplicate testcase failures, cross-direction READY/retest |
| Transaction rollback | PASS | SQLite triggers reject Bug, testcase or history writes; persisted snapshots unchanged; second-Bug bulk failure rolls back prior work |
| Pagination regression | PASS | Ties, both directions, all allowed primary sorts, filters/defaults, repeat/page boundaries, real status updates |
| Relevant API tests | PASS at handler/proxy level | NextRequest/NextResponse handlers against real synthetic SQLite; real proxy/session checks for no session, viewer, authorized QA and cross-workspace mixed bulk |
| Production build | Not run in Phase 6A | No bundling/runtime dependency changes; unit/API integration + typecheck are the relevant gates |
| Frontend E2E / performance | Not run | Explicitly out of scope |
| PostgreSQL integration | Not run | Live verification remains required before a PostgreSQL release |

Test database setup uses `mkdtemp`, an explicit temporary SQLite datasource and schema push into that disposable file with client generation skipped. No local `.env` is changed. The original Prisma CLI setup failed when the SQLite file did not yet exist; explicitly creating the empty fixture file fixed setup, after which the four original regressions reproduced. This setup failure was not counted as application evidence.

An expanded lifecycle test initially supplied only actualResult while current status was DONE; the existing resolver intentionally forces DONE to As Expected. The fixture was corrected to send both FAILED and Not As Expected, as a genuine regression. No domain rule was changed to satisfy the test. Typecheck initially found test-barrier Promise-versus-Prisma-fluent mock typings; the awaited-read test adapters were corrected without changing production behavior.

Initial lint identified three forbidden CommonJS imports in the new fixture's hoisted setup. They were replaced with hoisted dynamic ES imports; the final integration rerun again passed all 22 tests and full lint passed. These test/tooling corrections were the technical reasons for the reruns; no performance or release acceptance cycle was repeated.

No standalone HTTP server, browser, user account or production DB was used for this phase's verification. API tests call the actual handlers and separately exercise the actual proxy with synthetic sessions; this is not full deployed middleware/network-stack verification.

## F. Changed files

Phase 6A only:

- `src/app/api/bugfix/route.ts`: deterministic sorting; delegate atomic mutation; controlled error responses.
- `src/lib/services/bugfix-service.ts`: targeted Bug mutation transaction, source/project check, compare-and-swap, retry-safe timestamps and history.
- `src/app/api/testcases/route.ts`: tie-breaker, include optimistic version in snapshot, map safe mutation errors.
- `src/lib/services/testcase-service.ts`: protect existing single/bulk transactions against stale reads; use the new canonical snapshot for Bug content; complete bulk actualResult history.
- `src/lib/services/bugfix-sync-service.ts`: failed-retest bounce and project checks; deterministic resolved-Bug choice.
- `src/lib/services/mutation-error.ts`: small domain error, sanitized diagnostic/error mapping and monotonic timestamp helper.
- `src/lib/backend-phase6a.integration.test.ts`: isolated real SQLite/API/proxy regression matrix.
- `src/lib/domain/testcase.test.ts`: preserve existing testcase transition semantics.
- `src/lib/services/mutation-error.test.ts`: status/error sanitization and version advancement tests.
- `src/lib/client/api/bugfix-client.test.ts`: existing Bug and testcase mutation clients reject 409 without retry/success.
- `docs/backend-phase6a-data-integrity-report.md`: this report.

Pre-existing readiness work is preserved separately, not part of Phase 6A: `next.config.ts`, `src/lib/services/readiness-service.ts`, `src/lib/services/readiness-service.test.ts`, and `src/lib/services/readiness-api.test.ts`. Other pre-existing untracked artifacts, including `graphify-out/`, were not staged or changed by Phase 6A.

## G. Remaining risks

- Live PostgreSQL concurrent/rollback verification is outstanding. Error-code unit tests cannot prove that server's locking/isolation behavior.
- The guarantee covers the audited Bugs/Testcases entry points. The shared sync helper is also used by the existing execution-to-Bug endpoint, which retains its caller transaction; that endpoint and other record-writing/import paths did not receive a wider concurrency audit. Do not generalize to every application write path.
- No schema uniqueness constraint for one active Bug per testcase was added. The guarded testcase routes prevent the tested concurrent duplicate creation; pre-existing duplicate Bugs or other writers require separate investigation rather than an unapproved migration/data repair.
- Version comparison is internal to overlapping server requests, not an HTTP If-Match/client version contract. A deliberately submitted request after another has already committed is validated against the then-current state. No claim is made that the server knows which version an old browser tab displayed.
- Serializable aborts or timeouts fail safely and ask the user to reload. Heavy contention/500-record transaction duration was not load-tested; no speculative timeout or performance tuning was introduced.
- As described in D, deterministic offset ordering does not ensure concurrent snapshot consistency.
- Same-state retry deliberately preserves timestamps instead of repairing pre-existing missing lifecycle timestamps. No legacy-data cleanup was attempted.
- Relationship mismatches now fail safely with 409 and require separate data repair; the patch does not modify real records.

## H. Release recommendation

Ready for focused review: lint, typecheck and the targeted unit/integration gates passed. The targeted SQLite evidence supports this patch's transactional, stale-write, retry, bulk and ordering objectives. Review the documented 409/reload behavior and failed-retest bounce. Require PostgreSQL verification before claiming equivalent PostgreSQL acceptance. No recommendation for full application release readiness, Phase 6B security completion or Phase 6C scalability is made.

Implementation and report are intentionally left **uncommitted and unpushed** for review.
