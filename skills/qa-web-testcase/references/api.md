# QA-Web API reference

Use MCP-managed authentication when available, or an authenticated QA-Web browser session otherwise. Read `workflows.md` for live-tested MCP recipes and coverage. The exact response shape may evolve; inspect the live response and the corresponding client code before building a new integration.

## Read operations

- `GET /api/projects` — list accessible projects. Returns a bare array of project objects.
- `GET /api/testcases?projectId=<id>&page=1&limit=50` — list cases. Useful filters include `moduleId`, `status`, `testType`, `priority`, `tag`, `testRunId`, `hasBug`, and `search`.

### Response envelopes

These shapes are verified; do not assume a bare array for list endpoints.

- `GET /api/testcases` returns `{ testCases: [...], total, page, limit, totalPages }`. The array key is `testCases` — not `data`, `items`, or the root.
- `GET /api/auth/status` returns `{ setupRequired, authenticated, user }`. When the session is missing, the app redirects browsing to `/login?next=...` and authenticated endpoints such as `/api/projects` return `401`.
- A testcase object exposes: `id`, `testCaseId`, `page`, `subMenu`, `testType`, `testAction`, `steps`, `expectedResult`, `actualResult`, `status`, `progress`, `remarks`, `tags`, `priority`, `projectId`, `moduleId`, `createdAt`, `updatedAt`, `module`, `weight`, `calculatedWeight`, and `stepLogs` on create.

## Modules

- `GET /api/modules?projectId=<id>` — returns a bare array of modules, each with `id`, `name`, `projectId`, and `_count.testCases`. The `projectId` query is mandatory; omitting it returns `400 {"error":"Project scope wajib diisi."}`.
- `POST /api/modules` with `{ "projectId": "...", "name": "..." }` — returns `201` and the created module.
- `DELETE /api/modules?id=<moduleId>` — deletes one module. Use only with explicit user authorization.

A testcase also carries an expanded `module` object with `name`, so `{ module.name -> moduleId }` can be derived from a page of cases when you only need the mapping. `moduleId` must reference an existing module; it cannot be invented.

### Reorganizing modules safely

When restructuring a project's modules, never delete first. Create the new modules, move every case with `PUT` (see the payload rules below), then re-read and confirm:

- total case count is unchanged
- no case has a null `moduleId`
- `_count.testCases` from `GET /api/modules` agrees with the counts you compute from the cases themselves

Only delete an old module once its `_count.testCases` is exactly `0`, and only when the user has authorized the deletion.
- `GET /api/test-runs?projectId=<id>` — list Test Runs.
- `GET /api/test-plans?projectId=<id>` — list Test Plans.
- `GET /api/auth/status` — confirm the current authenticated session; do not expose its response beyond the needed identity/workspace context.

## Testcase mutations

`POST /api/testcases` requires JSON containing:

```json
{
  "projectId": "...",
  "testCaseId": "TC-001",
  "page": "Login",
  "testAction": "Login with valid credentials",
  "steps": "1. Open login page\n2. Enter valid credentials\n3. Submit",
  "expectedResult": "User reaches the workspace",
  "testType": "Positive",
  "priority": "Medium",
  "status": "NOT DONE",
  "tags": ["smoke", "auth"]
}
```

`POST` returns `201` with the created object. Beyond the fields shown above it also accepts `moduleId`, `subMenu`, `actualResult`, and `remarks`, and persists them.

`PUT /api/testcases` requires `id`. `testCaseId` is immutable. Required text fields must remain non-empty. `PATCH /api/testcases` accepts `{ "ids": ["..."], "status": "..." }` for bounded bulk status changes. Use `DELETE` only with explicit user authorization.

### Enumerated field values

These fields are constrained. Sending free text into them corrupts how the UI renders the row.

- `status`: `"DONE"`, `"FAILED"`, `"NOT DONE"`, `"IN PROGRESS"`, `"BLOCKED"`, `"READY TO RETEST"`, `"TBA"` (current domain source). Note the space — there is no `NOT_DONE`.
- `actualResult`: `"As Expected"`, `"Not As Expected"`, or `"-"`. **It is a badge/button in the UI, not a prose field.** Never write an explanation, observed output, or log excerpt here; that belongs in `remarks`.
- `testType`: `"Positive"` or `"Negative"`.
- `priority`: `"Low"`, `"Medium"`, `"High"`, `"Critical"` (current domain source).

Keep `status` and `actualResult` consistent: `FAILED` pairs with `"Not As Expected"`, `DONE` pairs with `"As Expected"`, and a case that has not been executed keeps `"-"`.

### PUT pitfall: read-modify-write fails on `tags`

A GET returns `tags: null` for cases that have no tags, but PUT rejects `null` with `400 {"error":"Tags tidak valid."}`. Echoing a fetched object straight back therefore fails for every untagged case.

Send an explicit scalar payload instead of spreading the GET result, and normalize `tags` to an array:

```json
{
  "id": "...", "testCaseId": "IKF-WEB-042", "projectId": "...", "moduleId": "...",
  "page": "Web", "subMenu": "Login", "testType": "Positive", "priority": "High",
  "testAction": "...", "steps": "...", "expectedResult": "...",
  "status": "DONE", "actualResult": "As Expected", "remarks": "...",
  "tags": []
}
```

Do not include relation or server-managed fields (`module`, `progress`, `weight`, `calculatedWeight`, `createdAt`, `updatedAt`) in the PUT body.

## Test Run mutations (Test Cycles menu)

The chain is **Test Run → Test Run Case → Execution → Evidence / Bug**.

- `POST /api/test-runs` requires an authenticated user and `projectId` + `name`; optional `description`, `status`, `testPlanId`, `startDate`, `endDate`, `assignedTo`.
- `GET /api/test-runs?projectId=<id>` returns `{ testRuns, hasMore, nextCursor }` — cursor paginated, not page/limit.
- `PUT /api/test-runs/<runId>` updates the run; `projectId` is required in the body alongside the fields being changed.
- `DELETE /api/test-runs/<runId>?projectId=<id>` removes a run. Prefer setting `status` to `ARCHIVED` over deleting.
- `POST /api/test-runs/<runId>/cases` with `{ projectId, testCaseIds: [...] }` (CUID `id` values, not `testCaseId` strings) returns `{ added: n }` and is idempotent on duplicates.
- `GET /api/test-runs/<runId>/cases?projectId=<id>` returns `{ testCases, hasMore, nextCursor }`.
- `POST /api/test-runs/<runId>/executions` with `{ projectId, testCaseId, status, actualResult?, notes?, startedAt?, completedAt? }` creates one execution. `tester` is taken from the authenticated session and cannot be passed in.
- `PUT /api/test-runs/<runId>/executions` updates one, keyed by `executionId` in the body.

Status enums:

- Test Run `status`: `DRAFT`, `READY`, `IN PROGRESS`, `COMPLETED`, `ARCHIVED`.
- Execution `status`: `NOT RUN`, `IN PROGRESS`, `PASSED`, `FAILED`, `BLOCKED`, `RETEST`, `VERIFIED`.
- Run progress counts a case as completed once its execution leaves `NOT RUN` and `IN PROGRESS`.

Unlike the testcase field of the same name, an execution's `actualResult` **is free text**. The per-run narrative belongs there and in `notes`; the testcase's own `actualResult` stays an enum badge.

A testcase carries only its latest state, with no history. Executions are where run-over-run history lives, so record each real execution round as its own Test Run rather than overwriting the case.

## Traceability (Requirements and Test Plans)

The chain is **Requirement → Test Plan → Test Run**, plus a many-to-many **Requirement ↔ Test Case** link.

- `GET /api/requirements?projectId=<id>` returns `{ requirements }` with `_count` of linked test cases and test plans.
- `POST /api/requirements` requires `projectId`, `key`, and `title`; optional `description`, `status` (default `DRAFT`), `priority` (default `Medium`).
- `POST /api/requirements/<requirementId>/test-cases` with `{ projectId, testCaseIds: [...] }` links cases and returns `{ linked: n }`; it skips links that already exist and rejects cases from another project. `DELETE` on the same path with the same body unlinks.
- `GET /api/test-plans?projectId=<id>` returns `{ testPlans }`; `POST /api/test-plans` requires `projectId` + `name`.
- `GET /api/traceability?projectId=<id>` requires **either** `testCaseId` **or** `requirementId`, otherwise `400`. It is a per-item lookup, not a whole-matrix dump — the matrix view is assembled client-side.
  - With `testCaseId` it returns the case plus its requirement links (and each requirement's test plans), its test run cases with executions, evidence and linked bug-fix records, and its bug-fix items.
  - With `requirementId` it returns the requirement plus its test plans (with their runs) and its linked test cases.

Traceability only earns its keep when real requirements exist to trace to. Do not invent requirements to populate the matrix.

## Bugs (defect lifecycle)

The Bugs page is backed by `/api/bugfix`, not `/api/bugs` — that path does not exist and returns the SPA HTML with `404`.

- `GET /api/bugfix?projectId=<id>&limit=100` — returns `{ bugFixItems, total, page, limit, totalPages }`.

A bug-fix item is a **separate record that mirrors the testcase**, not the testcase itself. It carries `sourceTestCaseId` back to the originating case, a copy of `testCaseId`, `page`, `subMenu`, `testType`, `testAction`, `steps`, `expectedResult`, `actualResult`, `priority`, `moduleId`, plus `status` and the lifecycle timestamps `reportedAt`, `fixingAt`, `readyAt`, and `fixedAt`.

Stored `status` values, in lifecycle order:

| Stored value | UI label | Tab |
|---|---|---|
| `SUDAH DILAPORKAN` | Reported / DILAPORKAN | Bug Aktif |
| `SEDANG DI FIX` | Fixing | Bug Aktif |
| `READY TO RETEST` | Ready to Retest | Bug Aktif |
| `VERIFIED & FIXED` | Fixed | Riwayat Fixed |

Note that the stored value and the displayed badge differ; do not filter on the UI label.

Entry into the lifecycle is automatic: setting a testcase's `actualResult` to `Not As Expected` makes it appear on the Bugs page as a reported defect. Returning the testcase to `As Expected` after a verified retest is what moves it out of Bug Aktif and into Riwayat Fixed. Do not flip a case back to `As Expected` to tidy the board — only after an actual retest with evidence.

Live-tested on explicitly synthetic fixtures: `PUT /api/bugfix` with `{ "id": "<bugFix-id>", "status": "SEDANG DI FIX" }`, then `READY TO RETEST`. Transitions must advance one stage at a time; skipped stages return 400. This endpoint does not accept `VERIFIED & FIXED`: finish through an evidenced testcase retest. The latter fix/retest transition was not exercised here.

## MCP usage and verified limits

When using `qa_browser` for a QA-Web testcase, resolve the testcase through the authenticated QA-Web API first and keep both identifiers distinct: the display `testCaseId` is human-facing, while the testcase object's internal `id` is the value used to bind Playwright DevLog to that testcase.


The local `mcp-qa-web` server publishes named tools for the actual route exports plus relay routes. Use `qa_web_catalog` to discover names and `qa_web_contract` for exact route fields. A response is wrapped as `{ ok, status, data }`; original application envelopes are under `data`.

Use `params` for `[id]` path placeholders, `query` for URL fields, `body` for JSON, or `form` and `files` for multipart. For uploads, supply `projectId` in `query` (the proxy checks scope before parsing multipart). Downloads return `data.outputPath` and are saved locally, never base64-dumped into the prompt.

Verified through real MCP during setup: authenticated reads, testcase creation/read-back, browser login-screen text assertion, execution creation, screenshot upload/read-back, Excel export and relay health. Other operations are published from source but not all were live-mutated. A project named with an ISO timestamp containing colons caused the existing single-sheet Excel export to return 500; changing the isolated fixture name to `MCP Smoke Validation` allowed export. Prefer Excel-valid sheet/project names when exporting single-sheet until the app sanitizes them.

`POST /api/ai/automation` is intentionally disabled by the app. `PUT /api/settings/ai` returns 405; configure provider secrets on the host. MCP preserves both restrictions and does not claim these features work.

## AI-assisted authoring

The UI exposes AI generation and refinement. The client implementation is in `src/lib/client/api/ai-client.ts` and the flow is in `src/hooks/use-ai-testcase-flows.ts`. AI output is a draft and must be reviewed before saving. Do not send secrets, production credentials, OTPs, or sensitive customer data in prompts.

## Automation capture

QA-Web DevLog is runner-agnostic. Katalon, Playwright, and Manual Capture may all produce events consumed by the same DevLog UI, but they are distinct runner/session types.

For browser/relay capture, read `public/docs/devlog-automation-capture-guide.html` or the current source guide referenced there. Always inspect the current implementation before relying on a remembered contract.

> Compatibility note: the Playwright-MCP additions below describe the updated MCP/QA-Web contract. Re-run local MCP smoke validation after deploying the new MCP browser module; the older verification ledger predates this integration.

### Testcase identifier used by DevLog

Do not confuse these testcase fields:

- `testCaseId` — human/display identifier such as `E-124` or `TC-001`.
- `id` — internal database identifier (CUID/UUID depending application version).

The DevLog payload field named `testCaseId` carries the testcase object's internal database **`id`** for association with QA-Web. It does **not** carry the human/display `testCaseId`.

When using `qa_browser`, resolve the testcase first and pass its internal `id` as the browser action's `testCaseId` (or `qaTestCaseId` when that alias is exposed).

### DevLog event contract

New producers should use schema-version-2 concepts:

```json
{
  "schemaVersion": 2,
  "type": "log",
  "category": "execution",
  "event": "step",
  "runner": "playwright",
  "source": "playwright-mcp",
  "testCaseId": "<internal testcase id>",
  "sessionId": "pw-mcp-...",
  "timestamp": "2026-09-21T00:00:00.000Z",
  "relativeMs": 123,
  "log": "Click role=button name=Login"
}
```

Primary categories:

- `execution`
- `console`
- `network`
- `artifact` when implemented by the active producer

Common event values:

- `run.started`
- `run.finished`
- `step`
- `console`
- `network.request`
- `network.response`
- `network.error`
- `artifact`

`category` is the primary classifier for new payloads. Legacy Katalon payloads remain valid and may rely on older fields such as `level`, `console`, `network`, and `log`, so consumers must preserve legacy fallback classification.

### Playwright MCP runner

`qa_browser` uses Playwright as its browser engine. When the browser session is bound to a testcase internal `id`, the MCP process sends DevLog events directly to the existing relay:

```text
POST http://127.0.0.1:3001/log
```

Typical metadata:

```json
{
  "runner": "playwright",
  "source": "playwright-mcp",
  "sessionId": "pw-mcp-..."
}
```

The run-start execution message remains compatible with the existing relay run-rotation rule:

```text
Starting Playwright Automation: <test name>
```

This lets the relay rotate current → previous before beginning the new current run.

Playwright capture semantics:

- meaningful MCP browser actions become Execution steps
- browser console output and uncaught page errors become Console events
- normal HTTP responses, including `4xx` and `5xx`, become Network response events
- `requestfailed` represents browser/transport failures where an HTTP response was not successfully received
- DevLog delivery is observability-only and best-effort; relay unavailability must not by itself fail the product test

### Playwright MCP vs Manual Capture

These are separate browser/session mechanisms:

- **Playwright MCP** — `qa_browser`; DevLog is emitted from the MCP/Node process when bound to a testcase.
- **Manual Capture** — relay-managed browser/session used by QA-Web Manual Capture and `relay_post_manual_exec`.

Do not claim that Manual Capture recorded the MCP Chromium session. Likewise, do not inject `public/qa-capture.js` into the Playwright MCP browser.

### Sensitive data and redaction

Automation producers must redact sensitive material before persistence/broadcast. At minimum protect:

- `Authorization`
- cookies
- password/PIN fields
- access and refresh tokens
- generic token/secret fields
- API keys

Do not hardcode credentials or tokens in skill examples, browser payloads, or DevLog messages. Generic Execution-step descriptions should not include entered secret values.

### Screenshots and evidence

`qa_browser` screenshots remain local artifacts returned by the browser tool. Attach them to the relevant Test Run execution using the execution evidence upload operation. A screenshot returned by `qa_browser` is not automatically equivalent to a Manual Capture frame/recording.

The shared DevLog contract does not imply that Playwright trace/video/screenshot artifacts are automatically persisted by the QA-Web relay unless the current source explicitly implements that storage path.
