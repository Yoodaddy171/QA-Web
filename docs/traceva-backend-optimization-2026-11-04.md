# Backend optimization handoff

Date: 4 November 2026 (Asia/Bangkok).

## Scope

Three backend paths only: Automation Logs, standalone Evidence Report, and dashboard statistics. No schema migration, dependency installation, UI redesign, verdict/status change, build, restart, commit or push. Existing dirty-worktree changes were preserved.

## Changes

### Automation Logs

- Query lightweight project-scoped headers for search/filter/counts; hydrate full testcase/Bug records only for the selected page.
- The `view=records` contract still returns all testcase automation indicators, but skips document hydration, weight aggregation and detailed relay recording/event reads.
- Fetch relay recording metadata and event counts only for visible rows. Preserve latest-source ordering, merging, and Studio precedence on equal timestamps.
- Read legacy JSONL incrementally rather than buffering and parsing the whole file into an event array. Inspect only IDs already scoped to the authorized project; use at most eight file workers per request.
- Persist a content-free metadata index in `<logs>/.history-index-v1`, with source size/mtime/ctime validation, atomic writes and a bounded process cache. Append, replacement and deletion are reflected on the next read. Read-only index storage falls back to streamed metadata, not an application failure.
- Existing Studio run files, index markers, runner execution and history deletion were not modified.

### Evidence Report

- Preserve the standalone HTML format and embedded video, including selected-run semantics and existing download headers.
- Inspect the file before returning the body; stream Base64 in aligned chunks rather than retaining the video, Base64 copy and completed video-bearing HTML in memory.
- Use bounded byte-based backpressure, snapshot the readable file length, close the source on completion/cancellation, and propagate request abort.
- A video removed before stream opening falls back to the existing no-video report behavior. No artificial video-size cap or external-video dependency was added.
- The renderer, report styles and browser interactions were not edited by this task.

### Dashboard

- Aggregate testcase status/type/priority and Bug status/priority counters in the database.
- Keep a thinner testcase identity/menu inventory because existing `weightMap`, menu/module progress and filter consumers still need it. Do not remove those response fields.
- Load at most eight retest rows and eight aging Bug details; rank aging by the same fixing/reported/updated timestamp fallback. Exact age ties use deterministic ordering.
- Aggregate the selected cycle's latest execution statuses in SQL instead of materializing every membership/execution object. Keep selection precedence and latest-created execution semantics, including the no-execution fallback.
- Replace module-by-module inventory filtering with one-pass Map grouping.
- Coalesce concurrent reads for the same project only while in flight. Completed/failed responses are never cached, so no stale TTL or broad write-path invalidation was introduced.
- Keep project/workspace checks, activity labels, readiness calculation and response fields.

## Verification

| Check | Result |
|---|---|
| Final targeted unit tests | 78 passed across 13 files |
| Final disposable SQLite integration tests | 51 passed across backend phase 6B security and 6C stats suites |
| TypeScript | Passed |
| Scoped ESLint | Passed |
| Diff whitespace check, changed backend source | Passed; Git reported normal LF/CRLF conversion warnings |
| Broader unit-suite checkpoint | 502 passed, 1 skipped, 1 failed across 98 files |

The broad-suite failure is `src/lib/client/ui-motion.test.ts`: it expects a content duration of `0.18`, while the existing modified `ui-motion.ts` uses `0.22`. Neither animation file was changed for this backend task. The broad checkpoint preceded the last additional endpoint assertions; the final targeted and integration results above were rerun after the backend edits.

Regression evidence includes:

- Full endpoint export retains the exact selected video's Base64 bytes without `readFile(video)`.
- Base64 boundaries, empty files, missing files, cancellation and request abort are covered. An 8 MiB+1 byte export emitted video chunks no larger than 64 KiB and the exact expected output byte count.
- A 30-row Automation Logs fixture hydrates only five detail rows on a five-row page; the records-only view hydrates none.
- Legacy log indexing covers malformed lines, foreign-ID exclusion, warm/restarted cache use, append/replacement/deletion and absence of private log content in the index.
- A mixed real SQLite dataset compares all dashboard fields with the full-inventory calculation, including TBA/unknown statuses, priorities, module/menu weights, retest/aging queues and foreign-project exclusion.
- Module grouping verifies inventory lookups grow with testcase count rather than module count multiplied by testcase count.
- Concurrent/failed stats requests verify in-flight entries are removed and the next request reads fresh data.

## Limits and deployment

This proves contracts, bounded detail reads and streaming behavior, not a production latency or throughput target. No production p95/RSS/load benchmark, PostgreSQL runtime test or new-build browser acceptance was performed. Authorization regression tests used disposable SQLite, not customer records.

For compatibility, dashboard identity/menu data and Automation Logs filter headers still scale with project size. The first legacy-index build must read the authorized historical logs; subsequent reads reuse unchanged metadata. Standalone HTML still includes all video bytes and retains its original download size/client-side storage cost.

Gemini owns build/restart per user instruction. After building, verify dashboard counts and attention queues, Cases filter/menu progress, Automation Logs filters/pagination/record badges, Studio/relay history merging, and standalone video export/playback. Do not build concurrently with another process sharing `.next`.
