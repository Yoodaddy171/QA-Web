# QA-Web MCP

## Compact default

The default now advertises **7 tools** while retaining all 99 endpoint operations. No client configuration change is needed; restart/reconnect the MCP process in Claude/Codex to reload the tool list.

- `qa_web_guide({topic:"overview"})`: short introduction; load only a relevant topic afterward.
- `qa_web_catalog({search:"testcases"})`: 15 results per page, operation IDs and routing; follow nextOffset with offset.
- `qa_web_contract({operation:"web_post_testcases"})`: field hints without source. `includeSource:true` explicitly retrieves source if needed.
- `qa_web_read({operation:"web_get_projects"})`: GET/HEAD operations.
- `qa_web_write({operation:"web_post_testcases",body:{...}})`: POST/PUT/PATCH, including multipart.
- `qa_web_delete({operation:"web_delete_testcases",query:{...}})`: original confirmation guard, unchanged.
- `qa_browser`: persistent browser actions with optional testcase-bound Playwright DevLog.

Legacy `web_*` / `relay_*` names in examples below are operation IDs for these tools, not directly advertised tools in compact mode. Set `QA_MCP_MODE=full` on the server process to advertise the old endpoint tools. Topic-based guides and compact contracts apply in either mode; use topic `all` only for an explicit complete manual request.

Measured JSON sizes after optimization: full schema 150,530 bytes versus compact 6,276 bytes (95.8% reduction). Overview approximately 1,019 bytes versus full guide approximately 36 KB (guide size grows with documentation edits). These are payload bytes, not tokenizer counts or guaranteed billing savings. Run `node mcp-qa-web/measure.mjs` to remeasure. Client deferral/caching and returned task data still determine actual token use.

Local stdio MCP server for Codex, Claude Code, Claude Desktop, and other clients supporting stdio MCP. Node 24 recommended. No paid AI API key is needed for the adapter itself.

## Use on this computer

1. Keep QA-Web (dev or production, port 3000) running. Start `npm run relay` for capture features (port 3001).
2. Codex: the `qa-web` MCP entry is registered in the user configuration. Start a new task/reload the client to load newly registered tools.
3. Claude Code: open this repository, approve the project `.mcp.json` server when prompted, and check `/mcp`.
4. Ask: `Use qa-web. Read qa_web_guide, list projects, then work on project <name>.`

The MCP process is launched automatically by the AI client; do not start it as an HTTP server. It resolves the repository from its own file path, so Codex can use it from other projects too.

For Claude Desktop, merge the `qa-web` entry from `.mcp.json` into its `mcpServers` configuration (omit `type` if the client requires only command/args), preserving other entries, then restart. This has not been installed into Claude Desktop automatically. Cloud-only chats cannot reach this local stdio process directly.

## Installation elsewhere

Run `npm ci` in the repository and `npm ci --prefix mcp-qa-web`. Install Chromium with `npx playwright install chromium` for browser tools. Update command/absolute server path in the MCP client config. The repository source and skill folder must accompany the server.

```powershell
codex mcp add qa-web -- node "C:\path\QA-Web\mcp-qa-web\server.mjs"
```

## Available tools and contracts

`qa_web_catalog` lists web/relay operations with keyword search and pagination. Every exported business HTTP handler in `src/app/api/**/route.ts` becomes an operation ID (`web_get_projects`, `web_post_testcases`, etc.). There are currently 99 endpoint operations, accessed through 7 compact tools; full mode advertises 103 tools. New exported routes appear after restarting MCP. Relay routes are an explicit maintained catalog.

- `qa_web_guide`: current skill plus Claude's accumulated usage findings.
- `qa_web_contract`: actual route implementation and enums; inspect before unfamiliar payloads. Discovered fields are hints, not complete validation schemas.
- `web_*`: projects, modules, testcases, bugs, requirements, plans, runs, executions, evidence, traceability, reports/version/finalize/DOCX, Excel, notifications, activity, stats/readiness, knowledge/Figma, AI functions/settings/governance, workspace members, authentication status.
- `relay_*`: health, events/log ingestion, manual capture start/stop/session, run/event history, recording metadata/frames/video and saved logs.
- `qa_browser`: persistent headless Chromium, snapshots, clicks, inputs, selection, keyboard, checks, assertions, screenshots and console/network status logs.

Each endpoint tool accepts `params` (path), `query`, `body` (JSON), or `form` + `files` (multipart). Uploaded files use local absolute paths. Files exported by APIs are saved under `data/mcp-artifacts/` with unique names. Pagination/response envelopes are preserved.

Example create:
```json
{"body":{"projectId":"<internal-id>","testCaseId":"TC-001","page":"Login","testAction":"[Invalid login] Reject incorrect password","steps":"Prerequisite: test account exists\n1. Open login\n2. Enter incorrect password\n3. Submit","expectedResult":"Login rejected","status":"NOT DONE","actualResult":"-","priority":"Medium","testType":"Negative"}}
```

Example execution evidence upload:
```json
{"params":{"id":"<run-id>","executionId":"<execution-id>"},"query":{"projectId":"<project-id>"},"files":[{"path":"C:/evidence/screenshot.png","mimeType":"image/png"}]}
```

## Local access and deletion warning

The user explicitly grants the AI owner access on this local machine. The adapter loads `.env`/`.env.local` internally and creates a dedicated seven-day session for the single existing active OWNER; it does not read passwords or change roles. If multiple owners exist, set `QA_MCP_USER_ID` locally. The adapter only writes the authentication session directly; all business data goes through the web APIs and existing RBAC. It renews its session on expiry and revokes it on normal process close. Force-killed processes leave a session until expiry.

Services are restricted to loopback origins, with redirects disabled. Optional `QA_MCP_WEB_URL` / `QA_MCP_RELAY_URL` must be local origins. Session and relay credentials never appear in tool results. Mutation audit metadata is in `data/mcp-artifacts/audit.jsonl`; this file does not store request bodies or credentials.

Every DELETE, including bulk deletion, project/run cascades, unlinking and undo-import, first returns `executed:false`, a warning, exact requested scope and a five-minute single-use challenge. The AI must show the warning and obtain user confirmation, then repeat the exact arguments with `confirmation` and `userConfirmed:true`. This is an agent-mediated confirmation contract, not independent proof of a human click; client tool approval remains an additional control. Splitting bulk into individual deletes is prohibited. Browser writes to the local QA-Web/relay ports are blocked so the supported persistence path uses the guarded API tools.

## Limits represented honestly

- Generating a PASSED execution record is not running a test. Use `qa_browser` or an actual runner first and attach evidence.
- MCP Chromium and relay Manual Capture use separate browser sessions. Relay capture is controlled through the relay tools; it is not automatically recording MCP Chromium. MCP screenshots can be uploaded to executions directly.
- AI script generation is disabled by the application; that endpoint returns its existing message. AI secret settings are read-only over HTTP (PUT returns 405). No MCP bypass is provided.
- AI/Figma integrations require configured providers and app permissions; PostgreSQL DevLog history may be unavailable when that backend is not configured. Existing saved-log/recording endpoints remain accessible.
- A timeout/5xx can follow a committed mutation. Never retry writes automatically; reconcile through reads.
- Tools reflect current source. If the running production build is older, rebuild the application so contracts match.

## Verification

### Playwright DevLog smoke

Restart/reconnect the MCP process to reload the `qa_browser` schema. Optional fields are
`testCaseId` (internal database `id`, not the display ID), `qaTestCaseId` (alias),
`testName`, and `status` (explicit status on `close`). `QA_TEST_CASE_ID` is an optional
environment fallback. The existing browser actions and screenshot `outputPath` are preserved.

1. Read `qa_web_guide` and use catalog/contracts to list projects and resolve an authorized testcase's internal `id`.
2. Call `qa_browser` with `{"action":"open","url":"https://your-authorized-target/","testCaseId":"<internal-id>","testName":"Playwright smoke"}`.
3. Use `fill`, `click`, `assert_text`, and `screenshot` as usual; subsequent actions reuse the binding.
4. Call `{"action":"close"}`. Read relay logs for that internal ID and check the same `pw-mcp-...` session across start, steps, console, network and finish. Open that testcase's DevLog to check the three tabs.
5. Repeat against an unavailable relay: browser actions must still work. DevLog delivery has a 1.5-second budget per queued event, a bounded queue and no retries. Logs may be dropped during an outage or burst; delivery is not a product verdict.

Node/MCP sends authenticated DevLog V2 directly to `/log`; no capture script is injected.
The existing relay's legacy adapter retains the payload and normalizes it for current consumers.
Execution has no `level`; console errors/page errors are `SEVERE`; HTTP error responses
remain `network.response`, while transport failures are `network.error` with status 0.
As explicitly requested, DevLog headers, request bodies, URLs and console messages are
sent raw without redaction or truncation. The fill step label does not include its value,
but application console/network output may contain it. Response bodies are not captured.
The pre-existing runtime credential scrub still applies to MCP tool responses, including
the local `logs` action; it is not applied to relay DevLog delivery. Screenshot pixels remain original evidence.
Changing the testcase finishes the old run and generates a new session; `close` clears browser state.
The default finish status is `COMPLETED` (or `FAILED` after a failed browser action/assertion),
not an automatic product PASS. Manual Capture remains an independent session.

`npm --prefix mcp-qa-web test` includes real headless Chromium fixture tests for every
existing action, raw payload preservation, control-service write blocking, lifecycle, offline delivery,
and the actual MCP stdio schema. These tests require the existing Playwright Chromium installation.

The expanded cookbook is returned by `qa_web_guide` under `workflows`, so Claude receives actual tested payload examples rather than only endpoint source code. `node mcp-qa-web/validate-workflows.mjs` exercises synthetic modules, requirements/plan/run links, defect transitions, knowledge, report creation/export/finalization/version, Excel preview and operational reads. It leaves clearly labeled fixtures. It does not submit external AI/Figma requests, alter real workspace memberships, or execute deletion. Evidence JSON records each response and distinguishes cached evidence when resumed with `--resume <evidence-json>`.

`npm --prefix mcp-qa-web test`: catalog/name coverage, path safety, bound/expiring/single-use delete challenges, enum handling, multipart, binary and HTTP behavior.

`npm --prefix mcp-qa-web run smoke`: real stdio handshake, list tools, authenticated reads, deletion guard and relay health.

`node mcp-qa-web/smoke.mjs --write-fixture`: also create/reuse isolated `MCP Smoke Validation`, execute a login-screen browser assertion, save execution/screenshot evidence, read it back and export XLSX. Leaves the fixture visible for review; does not delete user data. This is representative coverage, not an end-to-end test of every endpoint/provider.
