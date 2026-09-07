#!/usr/bin/env bash
#
# Nightly Postgres dump for bela-turniri.com. gzip's the dump, drops it in
# ./backups/, and prunes anything older than 14 days so the VPS disk doesn't
# fill up silently.
#
# Usage (from the repo root, or via cron with an absolute path - see below):
#   ./ops/backup-db.sh
#
# Crontab line (nightly at 03:00, as the `deploy` user):
#   0 3 * * * cd /home/deploy/bela-turniri.com && ./ops/backup-db.sh >> /home/deploy/backups/backup.log 2>&1
#
# For off-site copies, add a second cron line that syncs ./backups elsewhere
# (rclone to Backblaze B2 etc.) - see DEPLOY.md.
set -euo pipefail

cd "$(dirname "$0")/.."

# $POSTGRES_USER / $POSTGRES_DB below are interpolated by THIS shell (they
# pick the dump target on the host side of the `exec`), not inside the
# container - so they need to be in the environment here too, not just
# passed to compose via --env-file. Source .env.prod to get them.
set -a
# shellcheck disable=SC1091
. .env.prod
set +a

COMPOSE=(docker compose -f docker-compose.prod.yaml --env-file .env.prod)
BACKUP_DIR="backups"
mkdir -p "$BACKUP_DIR"

OUT="$BACKUP_DIR/bela-$(date +%F-%H%M).sql.gz"

"${COMPOSE[@]}" exec -T postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "$OUT"
echo "✅ Backup written to $OUT"

# Keep last 14 days.
find "$BACKUP_DIR" -name 'bela-*.sql.gz' -mtime +14 -delete
