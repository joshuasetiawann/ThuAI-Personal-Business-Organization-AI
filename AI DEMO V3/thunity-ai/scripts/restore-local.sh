#!/usr/bin/env bash
# Restore a local backup archive produced by backup-local.sh. Local-only.
set -euo pipefail
ARCHIVE="${1:?usage: restore-local.sh <archive.tgz|archive.tgz.gpg>}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STAGE="$(mktemp -d)"

FILE="$ARCHIVE"
if [[ "$ARCHIVE" == *.gpg ]]; then
  command -v gpg >/dev/null || { echo "gpg required"; exit 1; }
  gpg --yes --decrypt "$ARCHIVE" > "$STAGE/archive.tgz"
  FILE="$STAGE/archive.tgz"
fi

tar -xzf "$FILE" -C "$STAGE"
echo "[restore] extracted to $STAGE"

# Restore Postgres dump
SQL="$(ls "$STAGE"/postgres_*.sql 2>/dev/null | head -1 || true)"
if [ -n "$SQL" ] && docker ps --format '{{.Names}}' | grep -q thunity-postgres; then
  cat "$SQL" | docker exec -i thunity-postgres psql -U postgres -d thunity_ai
  echo "[restore] postgres restored from $(basename "$SQL")"
fi

# Restore data dir
DTAR="$(ls "$STAGE"/data_*.tgz 2>/dev/null | head -1 || true)"
[ -n "$DTAR" ] && tar -xzf "$DTAR" -C "$ROOT" && echo "[restore] data dir restored"
rm -rf "$STAGE"
echo "[restore] done. (Real .env is never part of a backup — recreate from .env.example.)"
