# Excel export template update

## Plan and compatibility contract

1. Keep the existing `GET /api/excel` default, CSV headers, and legacy layouts unchanged. Add opt-in `template=qa-report` (XLSX only).
2. Report contains Summary and one flat Test Cases sheet, with explicit module, type, priority, literal multiline descriptions, dates in UTC, numeric percentages and stable internal UUIDs. No synthetic execution/evidence/bug relationships.
3. Summary describes the exported scope only. All testcase statuses count toward total. Progress is the unweighted average of progress among non-TBA cases; no eligible cases displays `—`. Weight remains project-group weight, not a report-wide total. This is not release readiness or a test-run result.
4. Summary formulas reference the Test Cases sheet, with cached results and recalculate-on-open. A hidden numeric module-group column (T), included in the filter/sort range, keeps case-distinct names and wildcard characters reliable across calculation engines. Workbook is an exported snapshot, not a live connection.
5. Freeze identifying columns and headers; use filters, wrapped text, restrained navy/indigo headers, conditional status colors, useful column widths and repeated print identifiers. Keep the existing ExcelJS production implementation; no dependency/framework change.
6. QA Report is intentionally **not importable**. Its marker is rejected before import preview or writes, with a recovery instruction. Legacy export/import continues using the existing mapper; this is not an update/upsert mechanism and existing duplicate IDs remain rejected. Legacy historically does not preserve type/priority or execution history. No claim of a lossless full-project backup.
7. Keep legacy per-module exports, sanitizing invalid/reserved/duplicate sheet names. Truncated/sanitized sheet names are presentation names, not original module identities.

## Delivery scope

- Export menu: QA Report, Legacy single sheet, Legacy per module, CSV.
- Selected-row action: QA Report with explicit selected-only summary scope and Legacy XLSX.
- Import errors surface server-provided explanations instead of a generic format error.
- No database migrations, production service restart, commit, push or main production build.

## Verification

Unit tests cover serialization/read-back using ExcelJS and independently SheetJS, cached zero values, scope totals, non-TBA average, empty/all-TBA exports, literal formula-like text, long steps, legal unique sheet names, legacy parser mapping, explicit URL contract and report detection.

Targeted isolated-browser verification covers actual UI download, source UUID/count/status/percentage reconciliation, subset export, legacy XLSX/per-module/CSV availability, report import rejection, desktop/mobile menus, and unchanged source records. Workbook visual inspection uses a synthetic export; no customer database is copied.

Execution History is deferred. Adding it requires a separate run/execution selection and relationship contract rather than inferring history from testcase status.

### Observed results (19 October 2026)

- Full unit suite: 263 passed, 1 skipped. Targeted Excel suite: 12 passed.
- Full lint: passed. Typecheck passed earlier in the task; a later global run was blocked by concurrently modified Test Run and execution-evidence routes (inferred `never[]` arrays). Those files were not edited by this task.
- Isolated browser: actual menu download and API checks passed, with desktop/mobile screenshots. No source testcase rows changed. Temporary synthetic session removed and owned port 3127 stopped; 3000/3001 left running.
- Final template was independently parsed, recalculated and rendered. Assertions verified total 4, progress 50%, Auth module total 3/progress 75%, ungrouped total 1/progress 0%; changing the first row to DONE/100% changed done count to 2 and Auth progress to 100%. No formula error matches. The artifact runtime produced all outputs and passed assertions, but exited with code 1 during shutdown without an error message. Native Microsoft Excel application behavior was not tested.
- Graphify incremental code synchronization completed (4,886 nodes); warnings reported seven zero-node non-source JSON files, two partially parsed existing Groovy examples, and stale community labels. No forced rebuild or label regeneration.
- Production BUILD_ID remained `DLcEYgHzjF5uLUKnUPV07`. No primary production build, restart, commit or push.

Private synthetic evidence is retained under `%TEMP%/qadesk-phase8e-20261019`: browser result JSON, desktop/mobile menu screenshots, sample workbook, rendered workbook ranges, calculation assertions and formula inspection results.
