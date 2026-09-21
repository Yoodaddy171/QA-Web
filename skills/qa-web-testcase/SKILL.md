---
name: qa-web-testcase
description: Use QA-Web as the source of truth for creating, maintaining, executing, and evidencing web application test cases through its UI or authenticated local API.
metadata:
  short-description: Manage and execute QA-Web test cases
---

# QA-Web Testcase Skill

## Compact MCP (default)

Only seven tools are advertised: qa_web_guide, qa_web_catalog, qa_web_contract, qa_web_read, qa_web_write, qa_web_delete, qa_browser. Every web_* / relay_* name in the recipes is now an **operation ID**. For example, call `qa_web_read({operation:"web_get_projects"})` or `qa_web_write({operation:"web_post_testcases",body:{...}})`. Use qa_web_delete for DELETE; other categories reject DELETE. Full endpoint tools can optionally be restored with QA_MCP_MODE=full and a process restart.

Read `qa_web_guide({topic:"overview"})` initially, then only the needed topic: testcases, test_runs, reports, browser, relay, excel, knowledge, deletion. Do not request topic all routinely. Search qa_web_catalog by feature; follow nextOffset when more results exist. qa_web_contract returns compact field hints; includeSource:true is an explicit fallback when the recipe and hints do not resolve a question. All existing authorization and read-back rules below still apply.

For ready-to-use MCP payloads, read `references/workflows.md` first. It now also documents the Playwright MCP → QA-Web DevLog binding flow and how it differs from relay Manual Capture. It covers tested creation/link/execution/report workflows, response envelopes, prerequisites, negative cases, and the boundary between live-tested and source-verified operations. Use `qa_web_guide` to retrieve it from MCP.

Use this skill when an agent needs to work with the local QA-Web application: register test cases, refine existing cases, create test runs, execute cases, record actual results, attach evidence, or inspect reports.

## Operating assumptions

- When the `qa-web` MCP server is available, prefer its tools for API operations. Start with `qa_web_guide`, discover operations with `qa_web_catalog`, and read `qa_web_contract` before unfamiliar writes. MCP manages its own local OWNER session; do not request a password or copy cookies.
- For any DELETE tool, show the returned warning/scope to the user and wait for explicit approval before sending the exact request with its single-use `confirmation` and `userConfirmed: true`. Do not self-approve or split bulk deletion into single deletes. This includes project/run cascades and undo-import.
- Use `qa_browser` to perform actual test steps and assertions; save the returned screenshot file through the execution evidence upload tool.
- `qa_browser` is a Playwright runner. When it is bound to a QA-Web testcase by the testcase object's internal database `id`, its Execution, Console, and Network DevLog events are sent directly from the MCP process to the QA-Web relay. This is **not** the same browser session as relay Manual Capture.
- Manual Capture remains a separate relay-managed browser/session. Do not claim Manual Capture recorded MCP Chromium; instead, distinguish **Playwright MCP DevLog** from **Manual Capture DevLog**.
- When a script must execute inside an active Manual Capture tab, use `qa_web_write` operation `relay_post_manual_exec` with the active Manual Capture `sessionId`; read the relay workflow first. This executes trusted JavaScript inside the relay-managed captured tab, not the separate MCP Playwright browser. Get explicit approval before bulk deletion even when performed via exec.

- QA-Web is normally available at `http://127.0.0.1:3000`.
- The browser session is the preferred authentication boundary. Do not read, print, or store passwords, bootstrap tokens, relay tokens, cookies, or API keys.
- Treat the selected project as mandatory context. Never create or update a testcase without first confirming its project.
- Without MCP, use the UI or authenticated browser API. With MCP, use its authenticated endpoint tools and verify persisted results with a read-back.
- A successful HTTP response is not enough: reconcile the returned object or reload the UI and verify the persisted state.

## Choose the mode

1. **Inventory/read mode**: list projects, modules, test cases, test runs, reports, or prior evidence. No mutation.
2. **Authoring mode**: create or update test cases. Validate required fields and duplicate IDs first.
3. **Execution mode**: create/select a Test Run, execute the selected cases, and record status, actual result, remarks, and evidence.
4. **Automation-capture mode**: use the runner-agnostic DevLog flow for Katalon or Playwright, or use relay Manual Capture for a relay-managed browser session. Read the repository automation guide before using Katalon, Playwright, or Manual Capture integration.

## Testcase authoring rules

Each testcase must have:

- project
- immutable `testCaseId` unique within that project
- page
- test action
- steps
- expected result

Optional but useful fields are module, submenu, test type, priority, tags, remarks, and initial status. Keep steps concrete and reproducible. Separate preconditions from actions when the UI supports it. Do not invent an actual result or mark a case done without execution evidence.

### Where prose goes

`actualResult` is an enumerated badge, not a text field. It only accepts `As Expected`, `Not As Expected`, or `-`. All narrative — what was observed, response bodies, affected accounts, counts, environment — goes in `remarks`. Writing prose into `actualResult` breaks the row rendering in the list view.

Keep the verdict pair consistent: `FAILED` with `Not As Expected`, `DONE` with `As Expected`, and `NOT DONE` with `-`.

For defects, start `remarks` with a severity tag so the list stays scannable, for example `DEFECT (High): ...`, `DEFECT (Medium): ...`, `DEFECT (Low): ...`. Add a qualifier when the defect is not in the product itself, such as `DEFECT (Low, third-party): ...` or `DEFECT (Info, methodology): ...`.

### Match the project's existing house style

Before authoring, read one page of existing cases in the target project and copy its conventions rather than inventing new ones. Check at minimum:

- the `testCaseId` prefixes already in use and the highest number per prefix, so new cases continue the sequence
- the module names and their ids, and which module each kind of case belongs to
- the `page` and `subMenu` vocabulary already in use
- the phrasing pattern of `testAction` and `steps`

In practice this project uses `testAction` shaped as `[Short label] description`, and `steps` that open with a `Prerequisite:` line followed by numbered actions.

Before creating a case, search the target project by `testCaseId`, page, action, and tags to avoid duplicates. After saving, reopen or refetch the case and verify all important fields.

For AI-generated cases, treat the model output as a draft. Review scope, preconditions, assertions, data dependencies, negative paths, and duplication before saving. Save only selected, reviewed cases.

## Defect lifecycle

A testcase does not get filed as a bug by hand. Setting `actualResult` to `Not As Expected` is what places it on the project's Bugs page as a reported defect, and it stays in the Bug Aktif tab while it moves through Reported, Fixing, and Ready to Retest. Returning the case to `As Expected` is what retires it into the Riwayat Fixed tab.

Two consequences for how you work:

- Every `Not As Expected` you write becomes a tracked defect. Make sure `remarks` carries the reproduction detail, observed result, environment, and severity before you set it, because that record is what the fix conversation runs on.
- Never flip a case back to `As Expected` to clear the board. Only a retest with evidence justifies that change, and the move to Riwayat Fixed is the claim that the defect is genuinely gone.

See `references/api.md` for the endpoint, the record shape, and the stored status values.

## Automation runner and DevLog rules

QA-Web automation is runner-agnostic. Supported runner concepts are:

- `katalon`
- `playwright`
- `manual`

Do not assume that automation means Katalon.

### Testcase identity for automation

A QA-Web testcase has two different identifiers that must not be confused:

- `testCaseId` — the human/display identifier such as `E-124`, `TC-001`, or `IKF-WEB-042`.
- `id` — the internal database identifier (CUID/UUID depending the application version).

For DevLog association and `qa_browser` automation binding, use the testcase object's internal database **`id`**, not its display `testCaseId`.

Before starting a Playwright MCP automation session:

1. Resolve the testcase from QA-Web.
2. Confirm the selected project.
3. Read the testcase object's internal `id`.
4. Pass that value to `qa_browser` as `testCaseId` (or `qaTestCaseId` when the tool schema exposes that alias) on the first browser action.
5. Reuse the same browser session for the remaining actions.

Example concept:

```json
{
  "action": "open",
  "url": "https://staging.example.com/login",
  "testCaseId": "<internal testcase id>",
  "testName": "Login with valid credentials"
}
```

Do not pass `E-124` or another display identifier as the DevLog association key.

### Playwright MCP capture

When `qa_browser` is bound to a testcase, the MCP Playwright browser may emit DevLog events directly to the same QA-Web relay used by other automation producers.

Expected event metadata includes:

```json
{
  "schemaVersion": 2,
  "type": "log",
  "runner": "playwright",
  "source": "playwright-mcp",
  "testCaseId": "<internal testcase id>",
  "sessionId": "pw-mcp-...",
  "category": "execution | console | network",
  "event": "run.started | run.finished | step | console | network.response | network.error"
}
```

Use `category` as the primary classifier. Legacy Katalon payloads may not contain it, so QA-Web must keep its legacy fallback classification.

Playwright MCP capture rules:

- meaningful browser actions become Execution steps
- browser console and uncaught page errors become Console events
- HTTP responses become Network response events
- transport/browser request failures become Network error events
- HTTP `4xx`/`5xx` responses are still responses; do not misclassify them as `requestfailed`
- the first run event uses `Starting Playwright Automation: ...` for compatibility with the existing current/previous run rotation
- DevLog delivery is best-effort; a relay outage must not by itself make the product test fail
- never inject `public/qa-capture.js` into the Playwright MCP browser
- Manual Capture is a separate relay-managed browser flow

### Sensitive data

For this Playwright MCP integration, the user explicitly requested raw DevLog capture: captured headers, request bodies, URLs and console messages are sent without filtering, redaction or truncation. The generic `fill` execution label still omits the entered value. Existing credential scrubbing of MCP tool responses is unchanged.

For other producers and manually authored log text, redact at minimum:

- `Authorization`
- cookies
- passwords and PINs
- access/refresh tokens
- generic token/secret fields
- API keys

Do not include entered field values in generic Execution-step descriptions when those values may contain credentials.

### Source-of-truth rule for QA-Web changes

Before modifying QA-Web source or MCP integration, inspect the current source file first. The repository/workspace source is the source of truth. Merge changes into the current version; do not overwrite an existing file from stale skill/reference text or a remembered template. Preserve newer Manual Capture, recording, video-processing, and UI fields unless the current source intentionally removes them.

## Execution and evidence rules

- Use one stable Test Run for one coherent execution batch.
- Use one stable execution identity per testcase/run; do not create a new run for every step.
- Record observed status and actual result, not the expected result copied into the actual-result field.
- Attach evidence to the specific execution/testcase: screenshot, recording, console/network log, request/response, or defect reference.
- For failures, preserve the exact reproduction steps, observed result, environment, timestamp, and evidence before changing the case.
- If a run times out or returns a server error, inspect the persisted run/execution/evidence state before retrying; the write may have committed.
- Do not delete or reset test data unless the user explicitly requests it and the exact scope is confirmed.

## UI workflow

1. Open QA-Web and confirm the logged-in workspace and selected project.
2. Inventory existing projects/modules/cases before mutation.
3. For authoring, use the testcase list/create/edit/AI refine flow and verify the saved record.
4. For execution, create or open a Test Run, add/select cases, execute the target flow, and update the execution result.
5. Open the case's Devlog/evidence/history area when capture is needed.
6. Finish by reporting testcase IDs, run ID, verdicts, evidence locations, and anything not tested.

## API fallback

When UI automation is unavailable or a bounded batch is explicitly needed, use the endpoints and payload rules in `references/api.md`. Preserve browser authentication; never put credentials in a script or command history. API calls must include the current session cookie and be followed by a read-back verification.

Practical notes for driving the API from an authenticated page context:

- Issue calls with `credentials: 'include'` from the QA-Web origin so the session cookie travels with them. Do not ask for or handle the password; if the session is missing, hand the login step back to the user.
- Probe with one record before running a batch. Confirm the response shape and that every field you sent was actually persisted, then proceed.
- Read `references/api.md` for the enumerated values and the `tags` pitfall on PUT before writing any mutation payload.
- List endpoints are paginated and wrapped. Pass an explicit `limit` and read the documented array key; do not assume the response is a bare array, and reconcile the returned count against the reported `total`.
- Partial batches overwrite nothing server-side, but local result files do. When a run is scoped to a subset, merge results into prior output instead of replacing it.

## Read-back verification

Treat a `200` or `201` as a request outcome, not a state outcome. After any batch, re-fetch and assert:

- every intended `testCaseId` exists, and none was created twice
- required text fields are non-empty
- `actualResult` holds an allowed enum value
- `status` and `actualResult` agree
- `remarks` is populated for any case that is not a plain pass

Report what failed these checks rather than restating the write response.

## Reporting

Use explicit verdicts: `PASS`, `FAIL`, `BLOCKED`, `NOT REPRODUCED`, or `NOT RUN`. Distinguish:

- planned vs executed
- expected vs observed
- evidence captured vs evidence missing
- automation runner (`katalon`, `playwright`, or `manual`) when automation was used
- local/staging/production environment
- confirmed fact vs inference

Never claim a testcase was executed, persisted, or fixed without direct UI/API evidence.
