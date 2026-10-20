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

## Persistent evidence storage (local)

Evidence files must never live inside `.next`, including `.next/standalone/data`. Configure an absolute `QA_EVIDENCE_STORAGE_DIR`, for example `C:/Users/Admin/AppData/Local/QADesk/evidence`. Without an explicit setting, storage now defaults to `QADesk/evidence` under LOCALAPPDATA (or XDG_DATA_HOME / the user's local data directory). An explicit absolute QA_RUNTIME_DIR remains supported with an `execution-evidence` child. Startup rejects relative paths and `.next` paths, including a storage root symlink resolving into `.next`.

Changing `.env` does not relocate existing files. Before rebuilding:

1. Run `npm run evidence:audit`. It reads evidence metadata across **all projects** and checks the permanent folder and known legacy roots. It does not change database rows or source files.
2. Stop the web server on the configured PORT (default 3000). Avoid uploads, imports, deletion and other writers during migration/backup.
3. Run `npm run evidence:migrate`. It copies matching source bytes using exclusive creation, preserves relative storage keys and UUIDs, verifies SHA-256/size and never deletes old copies or overwrites different destination bytes.
4. Run `npm run evidence:backup`. It creates a SQLite `VACUUM INTO` snapshot, verifies `integrity_check`, copies every available referenced evidence file, and verifies copied hashes. Both live under the sibling `maintenance` directory outside build output.
5. Inspect the reports. Exit code 2 means unresolved references remain; a backup with `complete: false` is **not a complete evidence recovery**. Missing files, mismatched hashes and unsupported legacy absolute keys remain listed; metadata is not silently deleted or repointed. Without a recorded database hash, the report explicitly distinguishes size-only historical validation from SHA-256 verification.
6. Restart with `npm start` and verify downloads, or keep the server stopped while running the next build, then start it. The launcher prints the effective evidence root before loading standalone.

The original `db:backup` backs up the database only. `evidence:backup` is the paired local SQLite alternative. Its `database.sqlite.json` sidecar works with `db:restore` when that snapshot is selected; restore the matching `evidence/` directory to QA_EVIDENCE_STORAGE_DIR as well, while the app is stopped. Do not mix snapshots or overwrite existing evidence without a checksum comparison and safety copy. A full restore drill has not been performed on production.

Maintenance manifests contain file keys, hashes and project metadata. Keep them private. The local backup protects against rebuilding, not disk loss: copy the complete backup bundle to a separate disk or encrypted backup destination. No recurring backup job is installed automatically.
