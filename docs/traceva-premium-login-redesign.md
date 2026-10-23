# Traceva — premium login redesign

Implemented 22 October 2026. Scope: login presentation and approved asset integration only.

## Implementation and visual direction

The previous centered, shadowed card and accent strip are replaced by an edge-to-edge desktop split. At 1024px and above, the left visual occupies approximately 57.4% and the right authentication surface 42.6%. The existing Traceva logo, Inter typography, violet primary action, semantic theme tokens, Input, Label and Button components are retained.

The left section places the approved static illustration behind the original wordmark and the supplied copy, “Quality, connected.” The right section centers a maximum-420px form without a floating card, glass, decorative badges, testimonials or invented authentication options. Fields and submit controls are 48px tall. Labels, helper text, visible focus rings, status and error announcements retain clear hierarchy. No entrance or background animation was introduced; reduced-motion disables spinner rotation.

## Assets and provenance

- Shipping asset: `public/brand/traceva/login-background.webp`, copied byte-for-byte from `Traceva-03-Login-Background.webp` in the user-supplied `C:/Users/Admin/Downloads/Traceva-Brand-Assets-01-and-03.zip`.
- Original dimensions: 1672 × 941. Size: 19,202 bytes. No graphics generated or raster alterations performed.
- CSS `background-size: cover` preserves proportions with a deliberate 72% horizontal focal position. A restrained dark overlay supports text contrast. The image is decorative, so it is not redundantly announced to assistive technology.
- The background URL is declared only in the desktop media query. The large illustration is neither displayed nor downloaded in the tested mobile layout.
- Asset 01 is reserved: its opaque dark square is unnecessary beside the existing transparent logo and would add competing artwork. Neither unused PNG originals nor the unused emblem were copied into public assets.
- `BrandMark`, `/traceva-logo.png`, metadata and favicon were not changed by this task.

## Responsive and themes

- Desktop 1440 × 900: full-height split, headline lower left, form vertically centered on the right.
- Laptop 1366 × 768 and 1024 × 768: fluid crop and padding preserve a usable form; no horizontal overflow observed.
- Mobile 390 × 844: single-column form with original logo; hero hidden. Normal login fits the viewport. Bootstrap can scroll naturally because it has additional required fields.
- The existing `Providers` theme mechanism is unchanged. The artwork stays dark in both themes; a nested existing `dark` scope keeps its logo and text readable. The form uses the application's card/background/foreground/input/ring/primary/status tokens, not a separate color palette.

## Authentication preservation

The existing state, status fetch effect, submit function, request bodies, endpoints, credential validation and safe `next` redirect logic are unchanged. Existing owner/workspace/bootstrap controls, password autocomplete values and 12-character minimum are retained. No password visibility, recovery or identity-provider feature was invented. Password hints and bootstrap hints are now connected with `aria-describedby`; submitting exposes `aria-busy` and a disabled button with a processing label.

## Exact files in this task

1. `src/app/login/page.tsx` — presentation markup, copy, input/announcement semantics; existing authentication functions preserved.
2. `src/app/globals.css` — explicitly `.traceva-login*`-scoped presentation and responsive rules; no global token changes.
3. `public/brand/traceva/login-background.webp` — approved Asset 03 delivery file.
4. `docs/traceva-premium-login-redesign.md` — this report.

Other dirty files predate this task and were preserved. No stage, commit, push, merge or deployment was performed.

## Development preview and safety

Preview: <http://127.0.0.1:3104/login>.

The isolated directory `C:/Users/Admin/AppData/Local/Temp/traceva-login-dev-20261022` has its own `.next` and guarded working directory. A local watcher copies changes to the primary login, CSS and layout into the preview, where Next.js dev HMR updates the page. Shared existing components and public assets are read through junctions. The primary `.next`, environment files and database are not used or overwritten.

Preview-only API stubs return unauthenticated status and explanatory login/bootstrap errors. **Port 3104 is a visual preview, not a second production login.** Browser checks intercept those endpoints with synthetic responses. No accounts, sessions or database records were created or modified. Ports 3000 and 3001 remained on their original PIDs, 28252 and 19364 respectively, during the post-test check.

## Verification actually performed

- Targeted ESLint on `src/app/login/page.tsx`: passed.
- Targeted TypeScript check of the isolated login/layout import graph (`tsc --noEmit -p tsconfig.check.json`, incremental disabled): passed.
- Source comparison of authentication state, status effect and submit function against HEAD: unchanged, byte-for-byte after line-ending normalization.
- `git diff --check`: passed.
- Regular Playwright used because the Browser plugin/skill was unavailable. Chromium dev preview inspected at 1440×900 dark/light, 1366×768, 1024×768 and 390×844. No horizontal overflow; 48px inputs; desktop split ratio checked in the DOM.
- Keyboard order: Email → Password → Submit; visible focus and accessible field labels checked.
- Mocked status loading, disabled submit/loading label, 401 error recovery, unchanged credential payload, safe internal `next` redirect, bootstrap fields, `new-password` autocomplete and bootstrap error rendering: passed.
- Browser `pageerror`: zero. The intentional rejected-auth response is not evidence of a backend defect or a successful real login.
- Impeccable detector ran once. Its only warning points to the pre-existing `.animate-ping, .animate-bounce { animation: none !important; }` reduced-motion rule: a disabled-animation selector, not newly introduced bounce motion. No unrelated animation styles changed.
- No full historical suite, production build or database-backed authentication acceptance was run.

## Independent Impeccable finish review

Disposition: **Ship**, limited to the scoped visual redesign. The reviewer inspected all five default-state screenshots, the supplied artwork and brief, login markup, scoped CSS and theme tokens. No material visual finding was reported. The review confirmed readable hierarchy, the desktop split, proportionate artwork crop, usable tablet form, and mobile prioritization. Token-based contrast checks reported secondary/placeholder contrast of 4.63–7.41:1 and button contrast of 6.29:1 light / 5.36:1 dark. This verdict does not constitute backend acceptance; keyboard/mock-flow checks above are separate observed evidence. Mobile light theme, screen-reader use and physical keyboards remain unverified.

## Screenshot and machine-result references

All captures are outside the repository at `C:/Users/Admin/AppData/Local/Temp/traceva-login-dev-20261022/`:

- `desktop-dark.png`, `desktop-light.png`
- `laptop.png`, `tablet.png`
- `mobile.png`, `bootstrap-mobile.png`, `error-state.png`
- `verification.json` — viewport measurements and exercised mock-flow checks.

## Remaining limitations

Real session creation, actual credentials, persistence and production deployment were deliberately not exercised. The preview tests validate the real frontend against controlled responses, not the real backend. Browser coverage is Chromium only; no screen-reader or physical mobile keyboard session was performed. Screenshot references are temporary local files, not committed artifacts. The existing running production app does not include this redesign until a separately authorized build/restart.
