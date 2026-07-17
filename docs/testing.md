# Quality gate

Gunakan Node.js 22 LTS (`.nvmrc`). Database test harus terpisah dari database lokal pengguna.

## Lokal

```bash
npm run typecheck
npm run test:coverage
npm run lint
npm run build
npm run test:e2e:production
```

`test:e2e:production` membuat ulang `prisma/db/e2e.db`, membuat fixture owner/project, login melalui endpoint session, lalu menjalankan workflow pada standalone build. File tersebut di-ignore Git dan tidak menggunakan `custom.db`.

Integration test hanya aktif bila `QA_ALLOW_INTEGRATION_DB=1`. Gunakan flag itu hanya dengan database disposable:

```bash
DATABASE_URL=file:./db/integration.db QA_ALLOW_INTEGRATION_DB=1 npm run test:integration
```

## CI matrix

Workflow `.github/workflows/quality.yml` menjalankan:

1. lint, TypeScript, unit test, dan coverage threshold;
2. SQLite integration test;
3. PostgreSQL 16 migration dan integration test;
4. production build dan Playwright Chromium terhadap standalone server.

Coverage minimum untuk critical unit-testable core: lines/statements 75%, functions 70%, branches 65%. Scope-nya mencakup relay security, AI governance, domain transition, storage, normalization, report integrity, dan aggregation. Route/database/UI dijaga terpisah oleh integration test dan production Playwright. Integration test menguji workspace isolation, concurrent business-ID uniqueness, dan konsistensi hasil execution dengan report.
