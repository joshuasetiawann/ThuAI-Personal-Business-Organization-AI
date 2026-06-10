#!/usr/bin/env bash
# Local-only backup. Dumps Postgres + tars local data. NEVER uploads anywhere,
# NEVER backs up the real .env (secrets). Optional local GPG encryption.
set -euo pipefail
TS="$(date +%Y%m%d_%H%M%S)"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${BACKUP_DIR:-$ROOT/data/backups}"
mkdir -p "$OUT"
STAGE="$(mktemp -d)"

echo "[backup] $TS -> $OUT"

# 1) PostgreSQL dump (skips gracefully if pg tools/container absent)
if docker ps --format '{{.Names}}' 2>/dev/null | grep -q thunity-postgres; then
  docker exec thunity-postgres pg_dump -U postgres thunity_ai > "$STAGE/postgres_${TS}.sql" || true
fi

# 2) Local data (files, knowledge, sandbox) — but not backups themselves
tar -czf "$STAGE/data_${TS}.tgz" -C "$ROOT" \
    --exclude='data/backups' data 2>/dev/null || true

# 3) n8n workflows (if exported under n8n-workflows/)
[ -d "$ROOT/n8n-workflows" ] && tar -czf "$STAGE/n8n_${TS}.tgz" -C "$ROOT" n8n-workflows || true

# 4) Config TEMPLATE only — never the real .env
[ -f "$ROOT/.env.example" ] && cp "$ROOT/.env.example" "$STAGE/.env.example"

ARCHIVE="$OUT/thunity_backup_${TS}.tgz"
tar -czf "$ARCHIVE" -C "$STAGE" .
rm -rf "$STAGE"

# 5) Optional local encryption: set BACKUP_GPG_RECIPIENT to enable
if [ -n "${BACKUP_GPG_RECIPIENT:-}" ] && command -v gpg >/dev/null; then
  gpg --yes --encrypt --recipient "$BACKUP_GPG_RECIPIENT" "$ARCHIVE" && rm -f "$ARCHIVE"
  echo "[backup] encrypted: ${ARCHIVE}.gpg"
else
  echo "[backup] done: $ARCHIVE"
fi
