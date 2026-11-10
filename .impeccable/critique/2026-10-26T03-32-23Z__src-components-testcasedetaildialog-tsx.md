---
target: Automation tab crowding after Playwright Studio
total_score: 22
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
timestamp: 2026-10-26T03-32-23Z
slug: src-components-testcasedetaildialog-tsx
---
# Automation tab critique

Method: dual-agent (A: 01a1763d-9c08-7441-be9e-b98257754254; B: 01a1763d-9ee9-75b0-b569-e33a492d7385). A reviewed source independently; its browser attempt was blocked by login/session timeouts. B inspected an authenticated new Edge tab. No application data or source changes.

## Verdict

The functionality fits a QA product, but script authoring, history management, manual capture and result review are stacked without task priority. Improve information architecture rather than adding decoration or removing capabilities.

## Heuristic scores (provisional, 0-4)

| Heuristic | Score | Main observation |
|---|---:|---|
| System status | 3 | Runner and draft status available |
| User language | 2 | Script result versus testcase verdict needs distinction |
| User control | 3 | Collapse, stop and draft protections exist |
| Consistency | 2 | Studio and manual capture use different structures |
| Error prevention | 3 | Trust gate and deletion confirmation |
| Recognition | 2 | History points to a distant viewer below |
| Efficiency | 2 | Keyboard save available; editor dominates entry |
| Minimalism | 1 | Multiple tasks stacked together |
| Error recovery | 2 | Feedback exists, recovery guidance varies |
| Help | 2 | Instructions are fragmented |
| Total | 22/40 | Structural improvement needed; not a measured usability result |

## Evidence

B inspected TC-ACCT-AKS-01 with editor open and no runs at viewport 1912 x 947. Automation content viewport was 1039 x 627, scroll height 1634 (2.61 times viewport height). Studio alone was 740 px tall, exceeding available content height by 113 px. Devlog toolbar started at y=1355. No horizontal overflow: clientWidth and scrollWidth both 1039. There were 29 button/input/textarea elements across all content, not all simultaneously visible.

Source: PlaywrightScriptPanel.tsx:53 defaults editorOpen=true; :222 fixes editor height at 288px. TestCaseDetailDialog.tsx:1098 places Studio before manual capture and the viewer.

## Strengths

- Concrete trust warning, draft protection, Stop and deletion confirmation.
- Editor already supports collapse and result inspection uses the shared viewer.

## Priority issues

1. P1: Default-open editor dominates other tasks. Use local Hasil / Script / Capture Manual modes; retain drafts and existing functionality. Suggested command: impeccable distill.
2. P1: History and selected result are distant. Co-locate run selector with video/devlog and show selected run identity. Suggested command: impeccable layout.
3. P2: Repeated deletion checkboxes/buttons add noise to result review. Reveal them through Kelola riwayat mode. Suggested command: impeccable quieter.
4. P2: Berhasil may imply testcase Passed. Clarify script outcome and persist a short verdict distinction. Suggested command: impeccable clarify.

## Cognitive load and personas

Five of eight checklist items are at risk: single focus, chunking across tasks, hierarchy, one task at a time, progressive disclosure. Editor exposes five actions before configuration. History may show twenty runs and repeated management controls. Power users face configuration before evidence; first-timers must distinguish script, capture and testcase verdict. Trust safeguards are reassuring, but evidence is too late in the reading journey.

## Detector and limitations

One warning: overused-font at TestCaseDetailDialog.tsx:723, inside copied evidence HTML, not the rendered Automation surface. It does not explain the crowding. Detector exited 1 despite usable JSON; multi-path parser coverage was not confirmed, so no clean guarantee for Studio is claimed. Browser evidence was read-only DOM and inline screenshot; no screenshot file path was returned. No overlay injection, live server, mobile validation or populated-run validation.

## Questions

- Default mode: Hasil terbaru (recommended), Script, or Capture Manual?
- Scope: task separation plus compact history (recommended), or only collapse the editor initially?
