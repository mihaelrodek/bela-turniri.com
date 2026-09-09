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

# ── Run from anywhere ──────────────────────────────────────────────────────
# Every path in this script is written relative to the repo root, and
# `docker compose` reads `.env` / `.env.prod` from its WORKING DIRECTORY, not
# from wherever the compose file lives. Called from `ops/` (which is exactly
# where a tired hand ends up after `cd ops`), compose therefore starts the
# stack with EMPTY POSTGRES_*/MINIO_* variables — and the prod profile has no
# defaults on purpose, so the backend fails on boot and restarts forever while
# the edge answers 502. That happened on 2026-09-09.
#
# So anchor the working directory to the repo root instead of trusting the
# caller's. `BASH_SOURCE` is used rather than `$0` so this survives being
# sourced, and the `cd` is checked because a repo mounted read-only or a
# deleted directory must fail loudly here rather than half-way through a
# deploy.
cd "$(dirname "${BASH_SOURCE[0]}")/.." || exit 1

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
