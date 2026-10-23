# Durable local artifact storage

Set `QA_DATA_DIR` to an absolute directory outside the repository build output, for example `C:/Users/Admin/AppData/Local/Traceva`. Its children are `evidence`, `automation`, `recordings`, and `logs`. The SQLite database is not moved. Explicit per-service storage variables still override this setting; leave them empty unless intentionally required.

## Existing installations

Do not activate the new root before copying old files. Stop the web, relay, and automation runner. Run `node scripts/migrate-data-storage.mjs` for preflight, then repeat with `--apply`. This local SQLite utility copies files without deleting originals, refuses conflicting destinations, verifies SHA-256, snapshots the database and environment under `maintenance`, and remaps existing absolute recording references. It does not edit `.env`. Activate the root only after verification, rebuild, and restart.

Build output in `.next` is disposable and must never hold permanent artifacts. Keep the old source folders until downloads and recording playback have been checked. Back up the database together with the entire data root; an environment backup contains secrets and must never be committed or shared.

Rollback: stop services, restore the pre-migration database snapshot and environment backup as a pair, then restart the previous build. Do not restore a database snapshot after accepting new writes unless you have accounted for those writes.
