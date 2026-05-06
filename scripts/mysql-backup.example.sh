#!/usr/bin/env bash
# Example: MySQL logical backup before migrate deploy (run on the server or a jump host with DB access).
# Copy to mysql-backup.sh, chmod +x, set MYSQL_* or pass arguments. Do not commit credentials.
#
# Usage:
#   export MYSQL_HOST=127.0.0.1 MYSQL_USER=... MYSQL_PWD=... MYSQL_DATABASE=pms_prod
#   ./mysql-backup.sh
#
# Or use DATABASE_URL (requires parsing) — simpler to use explicit vars for mysqldump.

set -euo pipefail

STAMP=$(date -u +%Y%m%dT%H%M%SZ)
OUT_DIR="${BACKUP_DIR:-./db-backups}"
mkdir -p "$OUT_DIR"
OUT_FILE="${OUT_DIR}/${MYSQL_DATABASE:-db}-backup-${STAMP}.sql.gz"

: "${MYSQL_HOST:?Set MYSQL_HOST}"
: "${MYSQL_USER:?Set MYSQL_USER}"
: "${MYSQL_DATABASE:?Set MYSQL_DATABASE}"

echo "Writing $OUT_FILE"
mysqldump \
  -h "$MYSQL_HOST" \
  -u "$MYSQL_USER" \
  -p"${MYSQL_PWD:-}" \
  --single-transaction \
  --routines \
  --triggers \
  "$MYSQL_DATABASE" | gzip > "$OUT_FILE"

echo "Done: $OUT_FILE"
