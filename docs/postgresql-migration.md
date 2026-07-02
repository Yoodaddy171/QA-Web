# PostgreSQL Migration

## Development

```powershell
npm run db:export-sqlite
docker compose up -d postgres
$env:DATABASE_URL="postgresql://qa_web:qa_web@127.0.0.1:5432/qa_web"
$env:POSTGRES_DATABASE_URL=$env:DATABASE_URL
npx prisma migrate deploy
npm run db:import-postgres
npm run db:import-devlog
```

Keep `POSTGRES_DATABASE_URL` available to Next.js and
`node mini-services/ws-server.js`. During migration, `DATABASE_URL` may still
point to SQLite for the main application.

## External PostgreSQL

Set both `DATABASE_URL` and `POSTGRES_DATABASE_URL` to the external PostgreSQL
connection string, then run:

```powershell
npx prisma migrate deploy
npm run db:import-postgres
npm run db:import-devlog
```

The import scripts are idempotent. Business data is verified against the
SQLite export counts. DevLog JSONL events use stable IDs, while recording
metadata points to the existing filesystem media directories.
