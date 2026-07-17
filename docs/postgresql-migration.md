# PostgreSQL Migration

## Development

```powershell
npm run db:export-sqlite
$env:POSTGRES_PASSWORD="<strong-local-password>"
docker compose up -d postgres
$env:POSTGRES_DATABASE_URL="postgresql://qa_web:<password>@127.0.0.1:5432/qa_web"
npm run db:migrate:postgres
npm run db:import-postgres
npm run db:import-devlog
```

Keep `POSTGRES_DATABASE_URL` available to the relay and migration tools. During
migration, `DATABASE_URL` may still point to SQLite. Before building the
PostgreSQL deployment, set `DATABASE_URL` to the PostgreSQL URL and run
`npm run db:generate:postgres`.

## External PostgreSQL

Set both `DATABASE_URL` and `POSTGRES_DATABASE_URL` to the external PostgreSQL
connection string, then run:

```powershell
npm run db:migrate:postgres
npm run db:generate:postgres
npm run db:import-postgres
npm run db:import-devlog
```

The import scripts are idempotent. Business data is verified against the
SQLite export counts. DevLog JSONL events use stable IDs, while recording
metadata points to the existing filesystem media directories.
