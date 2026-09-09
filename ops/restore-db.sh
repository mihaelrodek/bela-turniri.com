#!/usr/bin/env bash
#
# Restore Postgres for bela-turniri.com from a backup produced by
# ops/backup-db.sh (or a plain/custom-format pg_dump archive).
#
# DESTRUCTIVE: drops and recreates the database named in .env.prod, so
# everything currently in it is gone once you confirm. There is no undo
# short of restoring an even older backup.
#
# Usage (from the repo root, on the prod server):
#   ./ops/restore-db.sh backups/bela-2026-09-04-0300.sql.gz
#
# What it does:
#   1. Prompt for an explicit "yes" confirmation (skippable with -y for
#      scripted/tested runs, e.g. a disaster-recovery drill).
#   2. Stop the backend so nothing writes to the database mid-restore.
#   3. Drop and recreate the database.
#   4. Restore from the given file — gunzip on the fly for a .gz plain-SQL
#      dump (what ops/backup-db.sh produces), pg_restore for a custom-format
#      archive (pg_dump -Fc, extension .dump/.backup), or feed a plain .sql
#      file straight to psql.
#   5. Start the backend again.
#
# Shows the "Nadogradnja u tijeku" maintenance page for the duration, same
# as ops/deploy.sh / ops/up.sh, since a restore is at least as disruptive as
# a deploy.
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

usage() {
    echo "Usage: $0 [-y] <backup-file>" >&2
    echo "  -y   skip the interactive confirmation prompt" >&2
    exit 1
}

SKIP_CONFIRM=0
while getopts ":y" opt; do
    case "$opt" in
        y) SKIP_CONFIRM=1 ;;
        *) usage ;;
    esac
done
shift $((OPTIND - 1))

[[ $# -eq 1 ]] || usage
BACKUP_FILE="$1"

if [[ ! -f "$BACKUP_FILE" ]]; then
    echo "Backup file not found: $BACKUP_FILE" >&2
    exit 1
fi

# $POSTGRES_USER / $POSTGRES_DB below are interpolated by THIS shell (they
# pick the restore target on the host side of the `exec`), not inside the
# container - so they need to be in the environment here too, not just
# passed to compose via --env-file. Same pattern as ops/backup-db.sh.
set -a
# shellcheck disable=SC1091
. .env.prod
set +a

FLAG="ops/maintenance/ENABLED"
COMPOSE=(docker compose -f docker-compose.prod.yaml --env-file .env.prod)

mkdir -p ops/maintenance

echo "⚠️  This will DROP and recreate database '$POSTGRES_DB' and restore it"
echo "    from: $BACKUP_FILE"
echo "    ALL current data in that database will be permanently lost."
if [[ "$SKIP_CONFIRM" -eq 0 ]]; then
    read -r -p "Type 'yes' to continue: " CONFIRM
    if [[ "$CONFIRM" != "yes" ]]; then
        echo "Aborted - nothing was changed."
        exit 1
    fi
fi

maintenance_off() {
    rm -f "$FLAG"
    echo "✅ Maintenance OFF - site je opet dostupan."
}
trap maintenance_off EXIT

echo "🛠  Maintenance ON - prikazuje se 'Nadogradnja u tijeku'."
touch "$FLAG"
sleep 2

echo "🛑 Stopping backend (so nothing writes during restore)…"
"${COMPOSE[@]}" stop backend

echo "🗑  Dropping and recreating database '$POSTGRES_DB'…"
"${COMPOSE[@]}" exec -T postgres psql -U "$POSTGRES_USER" -d postgres \
    -v ON_ERROR_STOP=1 \
    -c "DROP DATABASE IF EXISTS \"$POSTGRES_DB\";" \
    -c "CREATE DATABASE \"$POSTGRES_DB\" OWNER \"$POSTGRES_USER\";"

echo "📥 Restoring from $BACKUP_FILE…"
case "$BACKUP_FILE" in
    *.dump|*.backup)
        # Custom-format pg_dump archive (pg_dump -Fc) - needs pg_restore,
        # not psql. Not what ops/backup-db.sh produces today, but supported
        # here in case that ever changes or a backup is imported from
        # elsewhere.
        cat "$BACKUP_FILE" | "${COMPOSE[@]}" exec -T postgres \
            pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner
        ;;
    *.gz)
        # Plain-SQL dump gzipped, as produced by ops/backup-db.sh
        # (pg_dump | gzip).
        gunzip -c "$BACKUP_FILE" | "${COMPOSE[@]}" exec -T postgres \
            psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1
        ;;
    *)
        "${COMPOSE[@]}" exec -T postgres \
            psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 \
            < "$BACKUP_FILE"
        ;;
esac

echo "▶️  Starting backend…"
"${COMPOSE[@]}" up -d backend

echo "✅ Restore complete."

# EXIT trap clears the maintenance flag → maintenance OFF.
