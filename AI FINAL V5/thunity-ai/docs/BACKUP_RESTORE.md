# Backup & Restore

Backups are **local-only**. Nothing is uploaded anywhere, and the real `.env` (secrets)
is **never** included in a backup. Scripts live in `scripts/`.

## Backup (`scripts/backup-local.sh`)

Produces `data/backups/thunity_backup_<timestamp>.tgz` (or `BACKUP_DIR`) containing:

1. **PostgreSQL dump** — `pg_dump` of `thunity_ai` via the `thunity-postgres` container
   (skipped gracefully if the container/tools are absent).
2. **Local data** — a tar of `data/` (files, knowledge, sandbox runs), **excluding**
   `data/backups` itself.
3. **n8n workflows** — if exported under `n8n-workflows/`.
4. **Config template only** — `.env.example` is copied; the real `.env` is **never**
   backed up.

**Optional local encryption:** set `BACKUP_GPG_RECIPIENT` (and have `gpg` installed) to
produce an encrypted `.tgz.gpg` and remove the plaintext archive. Encryption happens
locally; the backup still never leaves the machine.

Run: `bash scripts/backup-local.sh`

## Restore (`scripts/restore-local.sh`)

```
bash scripts/restore-local.sh <archive.tgz|archive.tgz.gpg>
```

Decrypts first if the archive ends in `.gpg`, extracts to a temp staging dir, restores
the Postgres dump into `thunity-postgres` (if running), and restores the `data/` dir. The
real `.env` is never part of a backup — recreate it from `.env.example` after a restore.

## Observability

The metrics overview reports `last_backup` (most recent file mtime in `BACKUP_DIR`, or
`"never"`), giving the dashboard a freshness signal.

## Limitations (honest)

- Restore depends on the `thunity-postgres` container being present/named as expected;
  the Postgres step is skipped if it is not running.
- Backups capture data + DB + workflow exports, **not** Docker volumes wholesale.
- Encryption is opt-in; without `BACKUP_GPG_RECIPIENT` the archive is unencrypted local
  data — protect the `BACKUP_DIR` accordingly.

## Final checks for Sprint 9

Run a real backup → confirm the archive contains `.env.example` and **no** `.env` → run a
restore into a clean local stack → verify data and DB return. Add automated coverage per
the missing-tests checklist (assert the archive excludes the real `.env`).
