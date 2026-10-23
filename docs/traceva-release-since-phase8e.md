# Traceva delivery since Phase 8E

## Git baseline and scope

Compared on 23 October 2026 against branch `codex/frontend-design-system-motion-optimization` at `08e015c4ccea398a603fe54d4b3c838dccc901f6` (`docs(review): summarize Phase 8E delivery and subsequent follow-ups`, 20 October). Direct `git ls-remote` confirmed this is still the GitHub branch tip. Ordinary fetch failed on a broken local `refs/codex/turn-diffs/checkpoints/...` object; no checkpoint references were removed or rewritten.

This delivery captures the accumulated product changes listed below. It does not include local environment files, MCP client configuration, databases, user evidence, private documents, generated browser results, graph output, or unrelated IKF test work. No push or PR is part of this commit request.

## Product changes

### Traceva branding and login

- Replace visible QADesk branding in the application shell, metadata, favicon, export/report labels and capture guide with Traceva.
- Integrate the supplied logo, login illustration and trace overlay assets.
- Deliver the desktop split login composition, responsive mobile layout, light/dark styling, password visibility control and subtle controllable motion with reduced-motion handling.
- Retain normal login and first-owner bootstrap, and provide a separate guest-token entry flow.

### Temporary guest access and permanent account management

- Add guest identities, token grants and project assignments to both Prisma schemas, with additive SQLite/PostgreSQL migrations and a backup-first SQLite migration utility.
- Issue expiring, limited-use tokens with project scopes and permission presets; store hashes, not reusable plaintext tokens.
- Recheck guest expiry, revocation and permissions on protected requests; restrict guests from administration, raw Devlog, relay and script execution.
- Adapt navigation, execution, evidence, reports and exports to scoped guest capabilities, with isolated guest draft notes and restricted response projections.
- Allow authorized account name/email/password/role edits and membership removal, retaining history and protecting the last active Owner. Credential changes revoke sessions; optimistic versions detect stale editors.

### QA workflow and activity clarity

- Add one **Terbaru** sort for testcase creation/edit activity, with a return to ID ordering.
- Synchronize Bug creation transactionally when a testcase is initially created as FAILED, rather than only when later updated.
- Replace raw activity action/entity identifiers with Indonesian descriptions, contextual object labels and safe fallbacks, including guest access, account changes and execution evidence events.

### Local Playwright Studio

- Add script editing, save/run/stop, recent results and artifact inspection inside testcase Automation.
- Run queued scripts through a separate local worker; collect video, failure screenshots, trace and timestamped Execution/Console/Network telemetry.
- Reuse the existing recording/Devlog viewer without mixing script results with manual-capture controls. Warn about unsaved script changes.
- Protect APIs with real account role/project checks and bounded artifact manifests/range downloads. Guests cannot run scripts.
- The worker runs trusted local code, **not a security sandbox**. Script results do not automatically change testcase status. Test-only environment forwarding does not expose application secrets to scripts.

### Production launcher

- Add a BAT and Node launcher for the existing production build, local relay, automation runner and temporary Cloudflare Quick Tunnel.
- Startup does not build. Validate prerequisites, reuse a healthy runner where appropriate, gate public forwarding on readiness and keep relay/database local.
- Keep tunnel settings process-local, do not persist tokens in source, and clean up processes owned by the launcher.

### Durable unified artifact storage

- Add an opt-in absolute `QA_DATA_DIR`, shared across web, relay, importer, script worker and artifact cleanup/readers. Children: `evidence`, `automation`, `recordings`, `logs`.
- Retain explicit overrides and legacy defaults until an installation intentionally migrates. Reject relative and `.next` storage roots.
- Add an offline, copy-only SQLite migration with conflict checks, per-file SHA-256 verification, environment/database snapshots, absolute-path remapping and row-count/integrity checks. Do not move the main database or delete original files.
- The current host migration verified 1,820 files (584,403,243 bytes), remapped 34 references and preserved counts: 7 projects, 1,464 testcases, 569 executions, 631 evidence rows and 33 recordings.

## Verification and limits

The final integrated storage delivery immediately preceding this commit passed 376 unit tests with one skipped test, TypeScript, ESLint and production build. The build reported a non-fatal Turbopack file-tracing warning through the script store; standalone finalization completed. These checks were not rerun solely to create the Git commit.

After restart, login and auth-status endpoints returned HTTP 200, authenticated relay health returned ready, and the local runner heartbeat was fresh. A real evidence download returned HTTP 200 with its recorded SHA-256, and an existing video returned a valid HTTP 206 byte range.

All 622 present evidence references matched their recorded size/hash. Nine older references have no file in the migrated or inspected legacy roots: six in IKF 2026 and three in MCP Smoke Validation. Migration did not recover those missing originals. Source folders and the private migration manifest/backup remain on the local host.

Earlier feature documents record their own isolated browser and integration checks. This commit is not a new full browser/E2E, live PostgreSQL concurrency, tunnel uptime, accessibility or 60 FPS certification. No new tunnel was started during the storage restart.

## Feature documentation

- [Guest access](traceva-guest-access.md)
- [Guest access design](traceva-guest-access-design.md)
- [Account management](traceva-account-management.md)
- [Login redesign](traceva-premium-login-redesign.md)
- [Login motion and polish](traceva-login-motion-and-polish.md)
- [Playwright Studio](traceva-playwright-studio.md)
- [Production and tunnel launcher](traceva-production-tunnel.md)
- [Durable data storage](traceva-data-storage.md)
