# Traceva guest access: local UI extension

## Overview

Mode: **Operate**. This completed, bounded extension lets admins issue scoped guest access and lets guests enter the existing workspace. It inherits Traceva branding and the semantic shadcn light/dark system; it is not a redesign or a new application-wide design specification. This record applies only to the surfaces below (2026-10-22).

Reviewer disposition supplied for this extension: **ship**, with both scored fixes resolved: an untruncated mobile one-time-token warning and visible keyboard focus on evidence upload. Source and supplied screenshots were inspected for this record; no new whole-app review, live interaction retest, or backend/security certification is implied.

## Colors

`src/app/globals.css` remains authoritative: neutral surfaces, indigo primary actions, muted supporting text, semantic borders and focus rings. Guest UI consumes `background`, `foreground`, `card`, `primary`, `secondary`, `muted-foreground`, `border`, `ring`, and `destructive` rather than introducing guest-specific colors. The expiry banner uses the secondary surface; token states use outline badges with text, not a new status palette. Errors reuse destructive alerts.

The same stylesheet supplies light (`:root`) and dark (`.dark`) values. Existing branding comes from `src/components/BrandMark.tsx`, `/traceva-logo.png`, and the login artwork `/brand/traceva/login-background.webp`; these are retained, not reinterpreted.

## Typography

`src/app/layout.tsx` loads **Inter** for sans-serif UI and **JetBrains Mono** for monospace content, despite the retained CSS variable names `--font-geist-sans` and `--font-geist-mono`. The extension uses existing small, medium/semibold labels and headings, muted descriptions, and compact metadata. The disclosed token uses monospace. Indonesian task copy and explicit labels carry meaning without relying on icons alone.

## Layout

`src/components/SettingsPanel.tsx` adds an admin-only **Akses tamu** tab to the existing horizontally scrollable Settings tabs. Its card is scoped to the selected project's workspace and remounts when that workspace changes.

`src/components/GuestAccessCard.tsx` keeps issuance inline above the latest-token summaries, not in a new page or creation modal. Field pairs, project choices, and permissions stack on mobile and use two columns from `sm`. Project and permission labels have a minimum height of 44px; long names wrap. Summary rows stack on mobile and use horizontal alignment from `sm`. The existing Settings stylesheet supplies 20px card-header/content padding, separators, and 36px minimum button height.

`src/app/login/page.tsx` retains the incumbent split login. `src/app/globals.css` shows artwork and story beside the form at 1024px and above; below that, the hero is hidden and the logo sits above the single-column form. The form stays within 420px, with 48px inputs and submit button. Guest mode substitutes token entry for account credentials; it does not add a second login composition.

## Elevation & Depth

Guest administration inherits the flat Settings card treatment: borders and separators establish grouping, and Settings removes card shadows. Shared buttons and inputs retain their existing subtle shadows and interaction states. The guest banner is a bordered secondary strip beneath the shell header, not a floating warning or overlay.

## Shapes

Reuse the existing rounded cards, controls, project-choice borders, and outline badges from `src/components/ui/{card,button,input,badge,alert}.tsx`. The theme radius remains defined in `src/app/globals.css`; login retains its existing 8px control corners. No guest-only shape scale is introduced.

## Components

- **Admin issuance and summaries** — `src/components/GuestAccessCard.tsx`: “Buat token” toggles the inline form with `aria-expanded`. Reviewer/Tester presets remain adjustable, with supporting permissions selected automatically. Defaults are 24 hours from creation and one allowed redemption; usage counts token logins, not clicks. Submission is disabled while saving or without projects/permissions; loading, empty, and failure states are explicit. Up to 100 summaries show label, project names, expiry, redemption count, permission count, and expandable permission details. Revocation uses the shared confirmation dialog and explains session termination and retained history.
- **One-time disclosure** — the same card shows a read-only token field, copy confirmation, manual-copy fallback, and explicit dismissal. The warning says to copy now, share privately, avoid URLs, and count validity from creation. It explicitly overrides the shared alert title's single-line clamp so the complete warning wraps on mobile. The raw token is held in component state, not included in summary rows; closing, starting another issuance, or successful revocation clears it.
- **Guest login** — `src/app/login/page.tsx`: the masked token field has a label and associated hint, with autocomplete and spellcheck off. A ghost button switches back to account login and clears token/error state. Submission exposes busy/disabled feedback and inline errors; successful guest login clears the token and goes to `/`.
- **Scoped workspace** — `src/components/AppShell.tsx` filters navigation and command-palette destinations by guest permissions and displays a `role="status"` banner stating Reviewer/Tester, expiry, and admin-defined scope. `src/components/WorkspaceAccess.tsx` supplies permission gates, redirects on expiry, revalidates on focus, and checks authentication every 30 seconds while a guest remains idle. These are UI behaviors, not independent proof of server enforcement.
- **Execution evidence** — `src/components/TestRunsPanel.tsx` gates upload to permitted guests on their own execution; replacement and removal remain member editing actions. The native file input is visually hidden but keyboard-focusable. Its enclosing dashed upload label shows a 2px semantic ring with 2px background offset on focus within, preserving visible keyboard location. Existing drag/paste/picker behavior, disabled treatment, and evidence feedback are retained. Shared button/input focus styles remain in `src/components/ui/button.tsx` and `src/components/ui/input.tsx`; loading spinners opt out under reduced motion.

## Do's and Don'ts

- Do preserve inherited semantic themes, branding, component variants, inline hierarchy, complete warning text, and upload focus visibility.
- Don't place raw tokens in URLs, summaries, documentation, or evidence; don't turn this local record into global design rules or a whole-app approval.

Evidence inspected: `C:/Users/Admin/AppData/Local/Temp/traceva-guest-dev-20261022/screenshots/` — `admin-desktop.png`, `admin-mobile.png`, `admin-tablet.png`, `login-desktop.png`, `login-mobile.png`, `guest-workspace.png`, `issuance-mobile.png`, and `upload-keyboard-focus.png`. The issuance image redacts the token and shows the full wrapped warning; the upload image shows the focus ring. These existing captures support the bounded record, not an exhaustive theme/device/accessibility audit.
