# Automation Event Contract

User-facing setup and troubleshooting guidance is available in `docs/automation-capture-user-guide.md`.

Automation Capture keeps two separate capture modes:

- Manual Capture uses the relay-controlled browser and CDP capture in `mini-services/ws-server.js`.
- Katalon Capture uses Katalon's Selenium browser with `DevLog.groovy`, `DevLogListener.groovy`, and `HasDevTools`.

The capture layer stays separate because each mode owns a different browser session. Both modes converge after capture into the shared `AutomationEventV1` event pipeline.

## AutomationEventV1

The relay normalizes incoming and relay-generated logs into a versioned event with:

- Identity: `schemaVersion`, `eventId`, `runId`, `testCaseId`, `testCaseName`, `projectId`
- Classification: `mode`, `source`, `eventType`, `stepName`, `status`, `message`
- Timing: `timestamp`, `durationMs`
- Network data: `url`, `method`, request and response headers, bodies, and status
- Evidence data: `screenshotPath`, `evidencePath`
- Browser capability data: `browserName`, `browserSessionId`, `cdpAvailable`, `fallbackUsed`
- Migration data: `metadata`

Supported modes are `manual`, `katalon`, and `unknown`. Supported event types are `run.started`, `run.finished`, `step`, `console`, `network.request`, `network.response`, `screenshot`, `evidence`, `warning`, `error`, and `log`.

## Compatibility

`POST /log` remains compatible with existing manual and Katalon clients. Legacy payloads are still written to the current JSONL files and broadcast as `type: "log"` messages.

Each stored legacy log now includes an `automationEvent` field when normalization is possible. Valid normalized events are also broadcast using the preferred WebSocket envelope:

```json
{
  "type": "automation.event",
  "schemaVersion": 1,
  "event": {}
}
```

Unknown legacy fields are preserved in event metadata for migration diagnostics.

## Frontend Migration Behavior

The Devlog frontend accepts both the preferred `automation.event` WebSocket envelope and legacy `type: "log"` payloads during migration.

Normalized `network.request` and `network.response` events appear as network activity. `console` events appear as console activity. Steps, run start and finish events, screenshots, evidence, and unknown event types appear as execution activity when no dedicated tab exists.

Because the relay may broadcast both formats for one source event, the frontend de-duplicates visible rows using `eventId` when available and a timestamp, source, message, and event type fingerprint as a compatibility fallback.

## Katalon Producer Requirements

Katalon producers must generate one stable `runId` at test case start and reuse it through run start, steps, console logs, network events, screenshots, and run finish. Events use `mode: "katalon"` and resolve the QA-Web internal test case ID through `Include/testcase-map.json`.

Katalon remains the Selenium browser owner and captures DevTools events through `HasDevTools` when available. Events expose `cdpAvailable`, `fallbackUsed`, browser identity when available, and attachment errors in metadata. Optional screenshot events provide a `screenshotPath`; evidence export remains a later phase.

## Later Phases

This phase does not change storage architecture. Migration from test-case-based current and previous JSONL files to run-based folders and manifests will be handled separately.
