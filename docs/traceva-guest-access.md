# Traceva — Project-scoped guest access

## Scope

Guest access is separate from permanent workspace membership. ADMIN/OWNER can issue a token from **Settings → Akses tamu** for one or more active projects in their workspace. The guest enters it manually through **Login → Masuk dengan token tamu**. No token is placed in a URL or saved to browser storage.

- **Reviewer:** read dashboard, cases, bugs, cycles, traceability, reports and activity history. Evidence-file access and exports are opt-in.
- **Tester:** read QA context, execute cases in existing cycles, append evidence to their own executions and create a bug from their own FAILED execution.
- Permissions are customizable. Missing dependencies are selected by the UI and validated by the service. Unknown routes and empty permission sets fail closed.
- Guests cannot administer projects, create/edit testcase definitions or cycles, overwrite/delete executions or evidence, access AI/settings/team, raw Devlog, manual capture or the relay.

## Token and identity model

Tokens contain 32 random bytes. Only SHA-256 hashes are stored; the clear token is returned once at issuance. Default validity is 24 hours from **creation**, configurable 1–720 hours. Default redemption limit is one login, configurable 1–100. Closing a session does not refund a redemption.

Each grant has a dedicated internal `User` with `isGuest=true`, an unusable password hash and no permanent `WorkspaceMembership`. The identity remains for audit/history attribution; guests never impersonate the issuer. The session DTO has a synthetic VIEWER membership for UI compatibility, but authorization uses the explicit grant allowlist, not that membership.

Claiming a redemption, creating its session and recording its audit event are one transaction. Sessions expire at the earlier of normal session TTL (seven days) and grant expiry. Revoke removes all sessions for that guest identity. Every protected request rechecks expiry, revocation, project scope and action permission. Guest API responses strip capture logs/physical storage paths. Guest evidence-file responses are private/no-store.

The UI polls guest session validity every 30 seconds and on focus; a revoked guest's idle screen may remain visible briefly, but subsequent protected requests are denied immediately. Revocation cannot retract data already downloaded or displayed. Evidence preview necessarily sends the file bytes to the recipient; it is not download prevention or DRM. Restrict sensitive material before sharing.

## API

- `GET /api/workspaces/guest-access?workspaceId=...`: admin grant summaries, newest 100; never returns token/hash.
- `POST /api/workspaces/guest-access`: label, workspaceId, projectIds, permissions, preset, expiresInHours, maxUses; returns grant + one-time token.
- `PATCH /api/workspaces/guest-access`: workspaceId + id; revoke a grant and its sessions.
- `POST /api/auth/guest`: token redemption with origin validation, bounded 2 KB body and login rate limiting; sets the existing HttpOnly session cookie.

Rate limiting is process-local, matching the current single-host application. Multi-instance SaaS deployment needs a shared rate-limit store and a trusted reverse-proxy/IP policy.

## Safe deployment

Stop web/relay/MCP processes before schema/client changes. Keep evidence storage outside `.next`; this migration does not move or delete evidence.

SQLite, existing initialized database:

```powershell
npm run db:migrate:guest
npm run db:generate:sqlite
```

`db:migrate:guest` reads the configured SQLite file, refuses to create an absent database, creates a timestamped backup/manifest first, then transactionally adds `User.isGuest` and the two guest tables/indexes. It does not reset or synchronize unrelated schema changes. It is idempotent and runs `integrity_check` afterward. Keep the backup until rollout verification is complete.

PostgreSQL: the additive migration is `202610220001_guest_access`. Deploy through the existing `db:migrate:postgres` workflow after a database backup; generate the PostgreSQL client with the existing command. SQLite behavior is exercised against real disposable databases; PostgreSQL schema validation is not a live PostgreSQL concurrency test.

For remote sharing, configure a stable HTTPS origin, `APP_URL`, `QA_ALLOWED_ORIGINS` as needed and `QA_COOKIE_SECURE=1`. A tunnel is transport, not authorization. Only forward the web server: **never expose port 3001, the raw relay or the database**. Tunnel activation is outside this change.

## Verification

Tests live in `src/lib/domain/guest-access.test.ts` and `src/lib/guest-access.integration.test.ts`. They cover preset dependencies, fail-closed routing, issuance/secret storage, admin/scope checks, validation, redemption, concurrent single-use claims, rollback, expiry/revoke, real guest actor attribution, own-execution upload/bug restrictions, projections, origin/body limits, and additive/idempotent SQLite migration.

Existing authorization regressions remain in `src/lib/backend-phase6b.integration.test.ts`. Browser validation uses a disposable app/database on port 3105, never the user's testcase records. Production build/push and tunnel activation require separate delivery actions.

### Observed validation — 22 October 2026

- Unit tests: 300 passed, one existing optional skip. Guest integration: 23 passed. Existing backend authorization suite: 46 passed.
- TypeScript passed. SQLite and PostgreSQL schemas validated. The targeted Impeccable detector returned no findings.
- Actual disposable browser workflow passed: issue → token login → FAILED execution → PNG upload → Create Bug → refresh → revoke → denied. Desktop 1440, tablet 1024 and mobile 390 had no document overflow or framework error overlay; no page errors recorded. Browser plugin unavailable; Playwright used for this manual validation harness, not a new committed E2E suite.
- An initial isolated webpack preview suffered stale generated manifests; a fresh disposable preview used Turbopack. Its Tailwind source scanning was constrained to the copied `src` tree after nonstandard temporary cache folders were mistakenly scanned. These preview-only changes are not production source changes. The final isolated capture used the same Inter/JetBrains Mono fonts from existing local font output, avoiding network fetches; no font/branding change is part of guest access.
- With explicit user approval, the initialized primary SQLite database was backed up and migrated additively. Backup: `backups/qa-web-2026-10-22T03-50-11-218Z.sqlite` (60,895,232 bytes; matching manifest alongside it). Hashing original columns in all 25 old tables verified all 21,261 rows unchanged. Integrity check passed, foreign-key violations: zero. No guest identities or test executions were created in the primary database.
- The updated real workspace is served in development at `http://127.0.0.1:3104`; `/login` and `/api/auth/status` returned 200. Production build and tunnel remain unchanged/inactive for this task.
