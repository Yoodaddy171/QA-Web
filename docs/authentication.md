# Authentication and workspace access

QADesk requires an authenticated session for the UI and every application API. Sessions use an opaque random token stored as a SHA-256 hash in the database and an `HttpOnly`, `SameSite=Strict` cookie.

## Create the first owner

Use either the first-run form at `/login` with `QA_BOOTSTRAP_TOKEN`, or set these host-only environment values and run:

```powershell
npm run auth:bootstrap
```

Required values are `QA_BOOTSTRAP_EMAIL`, `QA_BOOTSTRAP_NAME`, and `QA_BOOTSTRAP_PASSWORD` (minimum 12 characters). Delete the bootstrap password/token from the environment after setup.

## Roles

- `OWNER`: full workspace control.
- `ADMIN`: projects, settings, and team administration.
- `QA_LEAD`: QA mutations and report finalization.
- `QA`: QA execution and content changes.
- `VIEWER`: read-only access.

Every project belongs to exactly one workspace. The server resolves the session and workspace membership before a project-scoped route executes. Audit actors and notification recipients are derived from that session, not from request payloads.

## Reverse proxy

Set `APP_URL` to the canonical HTTPS origin and `QA_COOKIE_SECURE=1`. Add only trusted browser origins to `QA_ALLOWED_ORIGINS`. TLS termination, rate limiting at the edge, and secure secret injection remain deployment responsibilities.
