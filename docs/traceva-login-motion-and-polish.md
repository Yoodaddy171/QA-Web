# Traceva — login motion and polish

Implemented 22 October 2026 on `codex/frontend-design-system-motion-optimization`,
starting HEAD `08e015c4ccea398a603fe54d4b3c838dccc901f6`. Existing dirty changes were
preserved. This is a refinement of the approved split-screen login, not a redesign.

## Presentation and motion

- Original background, Traceva mark, copy and desktop 57.4%/42.6% split retained.
  The headline sits about 58px higher at 1440×900, with a slightly quieter type
  scale, aligned left edges and a narrower supporting-text measure.
- Right form remains integrated in its surface at maximum 420px. Removed the
  artificial 15-character heading width, shortened supporting copy to “pekerjaan
  QA Anda”, refined heading spacing, kept 48px fields/primary action, and made
  the 44px guest action visibly secondary. No new card, imagery, theme or font.
- Input borders are quieter than the previous full-strength outline, without
  sacrificing boundary contrast. Violet focus, placeholders, native invalid
  state, autofill colors, disabled and loading feedback are scoped to login.
- Password visibility uses a labelled, non-submit button outside the input.
  It preserves the field value, autocomplete and validation. Returning from guest
  mode remasks the password.
- Provided `traceva-login-trace-overlay.svg` is the live asset, not GIF/MP4.
  Its paths, signal colors, tiny bounded blur and native 18-second timelines are
  unchanged. Added only explicit SVG `width="1672" height="941"`; without these,
  Chromium reported a default 267×150 intrinsic image size despite the viewBox.
- Background and overlay share the exact 1672×941 coordinate system, `cover`
  sizing and one `72% center` focal-position variable. Desktop computed positions
  both resolve to `72% 50%`. Cropping naturally hides parts of the lower path at
  taller aspect ratios; paths are not distorted or moved to fake visibility.
- Within the isolated hero stacking context: background −3, SVG −2, contrast
  treatment −1, content in normal foreground paint order. Motion is decorative,
  inaccessible to pointer/keyboard focus, and behind all branding/controls.
- Native SVG animation needs no JS animation loop, canvas, Framer Motion or new
  dependency. Only media-query/document-visibility events update motion presence.
  Below 1024px, reduced motion, or a hidden document, the SVG is not mounted.
  Static artwork is retained for reduced motion; mobile shows the original logo
  and authentication form without a large visual panel.
- Impeccable's accessibility workflow informed a small “Jeda animasi” / “Putar
  animasi” control. Pausing removes the decorative overlay; resuming restarts it.

Background SHA-256 remains
`43827e92af1874b64bbb02e0aac07a97a4b16a8f32348bb2cb27aa0ce3adb8c4`,
identical to the supplied Motion Kit background. No replacement graphics generated.

## Password helper and authentication preservation

The existing client input already enforced `minLength={12}`. The login API verifies
the stored password hash rather than imposing a new minimum-length check; account
creation uses the existing 12-character rule. No validation was relaxed or changed.
The permanent helper now appears only in owner creation. Normal login retains
native required/minlength feedback on submission: a short password was observed
to block POST. Current-password/new-password autocomplete is preserved.

The complete submit function and status/session effect compare identically to the
pre-task snapshot. Endpoints, payloads, safe `next` redirects, guest-token handling,
cookies, services, roles and schemas were not changed by this task.

## Targeted verification

Browser plugin unavailable; used installed Playwright/Chromium on an isolated
Next.js dev preview at `http://127.0.0.1:3110/login`. Candidate folder:
`C:/Users/Admin/AppData/Local/Temp/traceva-login-motion-20261022`.
Only login/UI source, theme wrapper, approved assets and cached local copies of
the same Inter/mono fonts were present. No `.env`, auth service, API route or
database was copied. All auth requests were fulfilled with synthetic responses.

18 focused checks passed:

- 1440×900 dark/light, 1366×768 dark, 1024×768 dark, 390×844 dark/light.
- No horizontal overflow, clipped primary controls or framework error overlay.
  Screenshot pixels additionally verify that desktop logo/headline really paint.
- SVG/background dimensions and crop, visible native motion sampled over 18.6s
  (7 samples, 4 distinct frames), pause/resume and live reduced-motion switching.
- Keyboard focus/order, password show/hide/value preservation, existing minimum
  length preventing submit, current-password autocomplete.
- Disabled pending submit/guest actions, specific login error, guest token request
  body/endpoint/error, return-to-account mode, owner-creation form/helper.
- Synthetic successful response preserves a safe `next` redirect.
- No unexpected browser console/runtime errors. Expected synthetic HTTP 401/403
  messages are recorded separately, not silently counted as application defects.

Measured light/dark contrast respectively: placeholder **4.60/6.41**, primary text
**6.29/5.36**, border against field **3.16/5.15**, supporting text **4.83/7.03**.
Targeted ESLint, isolated TypeScript and `git diff --check` passed. Impeccable's
single mechanical page scan returned no findings; rendered screenshots were also
inspected, not inferred from the detector.

## Files changed by this task

- `src/app/login/page.tsx` — presentation, visibility toggle, decorative motion.
- Login-only opening block of `src/app/globals.css` — scoped visual refinement.
- `public/brand/traceva/traceva-login-trace-overlay.svg` — supplied motion asset
  with explicit intrinsic dimensions.
- `docs/traceva-login-motion-and-polish.md` — this report.
- `evidence/light-diagnostic.png` — intermediate, untracked diagnostic capture,
  not the final release evidence. Its cleanup command was blocked by execution
  policy; no alternative deletion mechanism was attempted.

## Final evidence

All paths below are under
`C:/Users/Admin/AppData/Local/Temp/traceva-login-motion-20261022/evidence/`:

- `before-desktop-dark.png` — pre-task composition.
- `final-desktop-dark.png`, `final-desktop-light.png` — final desktop captures.
- `laptop-dark.png`, `tablet-1024-dark.png` — final intermediate widths.
- `mobile-dark.png`, `mobile-light.png` — final mobile captures.
- `keyboard-focus.png`, `submitting.png`, `login-error.png`, `guest-error.png`,
  `bootstrap-mobile.png`, `reduced-motion.png` — targeted states.
- `motion/page@5d82d6a0571cf7e635a1eaa47288609c.webm` — actual final browser
  recording, including the full signal sampling interval and UI interactions.
- `verification.json`, `contract-and-contrast.json` — observed results.

## Safety and limitations

No stage, commit, push, merge, deployment, production build, primary `.next`
overwrite, real account access, database write, or `.env` edit was performed.
Ports 3000/3001 were not interrupted. Isolated preview output stayed in its own
`.next-motion` directory. The preview is stopped after verification.

No full historical suite or production build was requested/run. Real backend
authentication/session creation, saved-password-manager autofill, Safari/Firefox,
physical mobile keyboards and low-end-hardware frame-time profiling remain
untested; this is not a 60 FPS certification. Production will show these changes
only after the user's next build. Temporary evidence is local, not published.
