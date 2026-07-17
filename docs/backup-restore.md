# Backup, restore, and retention

## Backup

Stop write-heavy imports before a backup, then run `npm run db:backup`. SQLite is checkpointed before copying. PostgreSQL uses `pg_dump` custom format and requires PostgreSQL client tools on `PATH` (or `PG_DUMP_PATH`). Every backup has a sidecar JSON manifest with SHA-256 and byte size.

Store the backup directory outside the application volume in production, encrypt it at rest, and copy it to a second failure domain. A recommended baseline is daily backups, 30-day retention, and a monthly restore drill.

## Retention

Set `QA_BACKUP_RETENTION_DAYS` and run `npm run db:prune-backups` from Task Scheduler or cron after a successful backup. The script only removes QADesk backup files inside the configured backup directory.

## Restore

1. Stop the application and relay.
2. Select a backup and its matching `.json` manifest.
3. Set `QA_RESTORE_FILE` to the backup path and `QA_RESTORE_CONFIRM=RESTORE`.
4. Run `npm run db:restore`.
5. Run `npm run db:check-migration`, start the application, and verify System Readiness.

Restore verifies the SHA-256 manifest first. SQLite makes a safety copy of the current database. PostgreSQL uses `pg_restore --clean --if-exists`; therefore restore must target the intended database and should first be rehearsed on a disposable environment.
