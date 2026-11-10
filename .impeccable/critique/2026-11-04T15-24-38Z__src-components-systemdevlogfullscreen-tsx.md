---
target: Fullscreen DevLog IAPAYS 2.0, oldest replayable inspected run
total_score: 17
max_score: 32
na_heuristics: 5,9
p0_count: 0
p1_count: 3
timestamp: 2026-11-04T15-24-38Z
slug: src-components-systemdevlogfullscreen-tsx
---
Method: dual-agent (A: 01a1a716-d1ed-7af1-ae8a-fdd88777e95f; B: 01a1a716-d352-7833-ab8e-3aa70b0e4253). Impeccable and Antislop during (session override).

# Fullscreen recording and DevLog review

## Scope and evidence

Desktop production at 127.0.0.1:3000, 4 November 2026. Final target: IAPAYS 2.0 (not Refactor), TC-TAX-RPA-01, selected run 23 October 2026 11:34:33. The earlier listed run at 11:33:43 was interrupted and had no replay. This identifies the oldest replayable run in the oldest listed testcase's inspected history, not a global audit of every historical run in storage.

The reviewed video is 153.56 seconds long. The interface contains 166 synced events, 15 timeline clusters and 20 execution activities. The parent verified ArrowRight moves playback from 0 to 5 seconds. Studio initially showed Processing, then media and events loaded successfully; this was not classified as a permanent processing defect. Existing IKF records were preliminary availability checks only and are not the basis for the final IAPAYS findings.

## Verdict

The viewer is specific to QA work: video, steps, Console and Network have useful relationships. Its weakness is orientation and interaction consistency, not a lack of decoration. It needs a focused review workspace rather than another layer of badges or animation.

## Design health

This is an expert heuristic assessment, not a user study or performance benchmark. Scores are 0-4; n/a means not assessed in this read-only scope.

| Heuristic | Score | Main evidence |
|---|---:|---|
| Visibility of system status | 2 | Header time can differ from a newly mounted video's position. |
| Match to QA work | 3 | Recording and technical evidence belong together. |
| User control and freedom | 2 | Close/Escape work, but DevLog focus escapes behind the overlay. |
| Consistency and standards | 2 | Recording and DevLog fullscreen use different modal patterns. |
| Error prevention | n/a | Destructive/write actions were excluded. |
| Recognition rather than recall | 2 | Selected Execution detail disappears across category changes. |
| Flexibility and efficiency | 2 | Seek works; video zoom does not change video dimensions. |
| Aesthetic and minimalist design | 2 | Several parallel event navigators compete. |
| Error recovery | n/a | Network/artifact failures were not forced. |
| Help and documentation | 2 | Useful hints exist, but some controls have ambiguous behavior/names. |
| **Total** | **17/32** | **Acceptable, with substantial improvements needed.** |

## Priority issues

### 1. P1: Fullscreen DevLog does not contain keyboard focus

Both independent assessments reproduced focus reaching controls behind the visible fullscreen DevLog. On opening, focus can remain on its inspector trigger; Tab/Shift+Tab can reach the background UI. Escape did close the fullscreen and leave the inspector available.

Fix: use the same modal lifecycle as recording fullscreen, with an accessible name, initial focus, focus containment, inert background and focus restoration. Do not merely adjust z-index.

Source: `src/components/SystemDevLogFullscreen.tsx:28`, `src/components/TestCaseDetailDialog.tsx:722`, `src/components/TestCaseDetailDialog.tsx:1312`.

Suggested workflow: Impeccable harden.

### 2. P1: Timestamp may describe a different position than the video

Assessment A observed header 0:55 while the fullscreen player was at 0:00. After seeking forward, both showed 0:05. The parent observed a fresh opening at 0:00 and separately confirmed seeking 0 to 5 seconds; the mismatch is therefore sequence-dependent, not universal on every opening.

Source uses `recordingSeekMs` for display while fullscreen mounts a separate video element. Metadata handling updates duration but does not restore its position.

Fix: the active player's actual currentTime must drive the displayed position and selected event. Restore the intended playback position after metadata is ready, and reset state when run/video identity changes.

Source: `src/components/TestCaseDetailDialog.tsx:498`, `src/components/TestCaseDetailDialog.tsx:515`, `src/components/TestCaseDetailDialog.tsx:697`, `src/components/RecordingVideoPanel.tsx:186`.

Suggested workflow: Impeccable harden.

### 3. P1 accessibility / P2 behavior: Video zoom controls are misleading and unnamed

Assessment A observed the zoom label changing from 100% to 110% while video width stayed 800 px. Source applies zoom dimensions to frame images, not the video. Assessment B confirmed both zoom buttons have no accessible name or title and are 28 by 28 px.

Fix: implement actual video zoom/pan or hide frame-only zoom for Video only. Give controls Perbesar/Perkecil rekaman names and visible feedback that matches the result. Do not preserve a percentage-only placebo.

Source: `src/components/RecordingVideoPanel.tsx:147`, `src/components/RecordingVideoPanel.tsx:185`, `src/components/RecordingVideoPanel.tsx:196`.

Suggested workflow: Impeccable harden, then polish.

### 4. P2: Event navigation is duplicated and clustered markers overlap

Timeline clusters, the horizontal Synced Events shelf and the vertical Execution/Console/Network view all offer routes to the same moment. The shelf adds seven category filters and paging on top of the three DevTools categories and three log filters. This dilutes the primary path.

Assessment B measured an overlap of about 10.82 by 16 px between the 59-event and 25-event markers near the start of the recording. The marker itself was 16 px high. Clustering 166 events into 15 points is useful, but the cluster hit targets still need collision handling.

Fix: retain one primary event list and one timeline. Show cluster contents contextually for the selected moment, keep advanced/raw categories behind a disclosure, and separate marker hit targets without implying evenly spaced event times. Preserve access to every event.

Source: `src/components/RecordingVideoPanel.tsx` (TimelineEventMarker), `src/components/SyncedVideoEventsPanel.tsx:29`, `src/components/RecordingEvidencePanel.tsx:45`.

Suggested workflow: Impeccable distill and layout.

### 5. P2: Selection is difficult to retain across categories

An Execution row opens details, but has no persistent selected-state styling/semantics. Execution to Console to Execution clears the previous detail. Network has a visual selected row, but its state is not exposed semantically; category/filter buttons likewise lack pressed/selected states.

Fix: store selected event and scroll position per category within the same run. Keep a visible selected row and the corresponding accessible state, with Headers/Payload/Response in a stable detail region. Reset on a new run, not every category switch.

Source: `src/components/ExecutionLogView.tsx:78`, `src/components/SystemDevLogFullscreen.tsx:60`, `src/components/RecordingEvidencePanel.tsx`.

Suggested workflow: Impeccable harden and layout.

## Proposed composition

```text
Testcase | selected run | result | current time / duration | Close
----------------------------------------------------------------
Video and playback controls       | Events / Console / Network
                                  | Search and active filter summary
                                  | One scrollable event list
----------------------------------+-----------------------------
Timeline and playhead             | Selected event detail
                                  | Headers / Payload / Response
                                  | Wrap | Copy selected evidence
```

This is a proposal, not an implemented redesign. Preserve resizing, keyframes, repeated-request groups and evidence copy. Put advanced filters and raw events in an explicit disclosure. Make testcase/run provenance visible instead of only the generic Playwright script heading. Use the existing Traceva neutral surfaces and restrained accent to identify the selected moment, not every control. Suggested dials remain ENERGY 1 / RHYTHM 1 / MOTION 1: review precision takes precedence over decorative animation.

## What works

- Video and technical context can be reviewed without leaving the testcase.
- Cluster grouping reduces timeline density while retaining access to individual events.
- Five-second seeking works; Network row selection opens matching detail; closing controls work in the observed assessments.

## Cognitive load and user journey

Four of eight structural cognitive-load checks showed risk: competing focal points, large option groups, parallel navigation choices and recall after selection loss. This is a design judgement, not a measured human working-memory test.

- Experienced QA: searching a moment and correlating request evidence is slowed by timestamp/selection inconsistency.
- New QA: Timeline, Synced Events and DevTools compete as the first action; an inert zoom percentage teaches an incorrect model.
- Keyboard user: focus can leave fullscreen for hidden background controls; icon-only zoom is unnamed.

The positive moment is a seek that exposes the matching technical detail. The weak moment is having to ask which time and event are currently selected.

## Detector and Antislop evidence

The CLI detector ran once on four concrete components. It returned one `overused-font` finding, exit 2, at `TestCaseDetailDialog.tsx:749`. That Inter font declaration belongs to generated Copy Evidence HTML, not the rendered fullscreen viewer: it is not a confirmed fullscreen typography defect. Other rules returned zero findings in that narrow scan, which is not proof of complete UI compliance.

Browser/DOM evidence found real interaction problems the detector did not catch. Antislop concerns are principally R-26 (control outcome), R-32 (keyboard focus), R-39 (accessible names/states), C-2 (functional completeness) and C-4 (resilience). The existing UI is not certified as passing those gates; this task delivers the review, not fixes. No fabricated test, contrast, FPS or mobile claims are made. No user evidence was rewritten or redacted in storage.

## Limitations

Desktop only. No mobile, extra theme, real touchpad, clipboard/export or full E2E acceptance claim. Large nested payload scrolling was not reproduced as a defect. No contrast conformance claim. Video media became ready and returned HTTP 206; an observed canceled media request did not establish playback failure. Source references support the runtime findings but do not prove every branch was executed. Sensitive SSO parameters are excluded from this report and the selected screenshot.

Screenshot: `artifacts/ui-review/fullscreen-2026-11-04/iapays-old-run-fullscreen.jpg`.

## Questions for the next change

1. Primary emphasis: QA review workspace with video/events foremost (recommended), or technical-debugging workspace with larger request details?
2. Scope: fix interaction defects and simplify the complete fullscreen together (recommended), or fix the three functional/accessibility issues before changing layout?
