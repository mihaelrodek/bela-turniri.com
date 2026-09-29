#!/usr/bin/env bash
#
# One-off copy of every poster/avatar from the local MinIO bucket into
# Cloudflare R2 (2026-09-29 — MinIO stopped publishing images; see DEPLOY.md
# "Object storage: Cloudflare R2").
#
#   ./ops/migrate-to-r2.sh          # copy + verify
#
# Safe to run as often as you like: `rclone copy` never deletes on either
# side and skips objects that already match, so a second run only moves what
# was uploaded in between. It does NOT touch the running site — the backend
# keeps using whatever storage .env.prod/compose currently point it at.
#
# Needs S3_ENDPOINT / S3_ACCESS_KEY / S3_SECRET_KEY / S3_BUCKET in .env.prod
# (the R2 values) AND the old MINIO_ROOT_USER / MINIO_ROOT_PASSWORD /
# MINIO_BUCKET, which the local MinIO still uses.
set -euo pipefail

# Same reason as ops/up.sh: compose reads .env.prod from the working dir.
cd "$(dirname "${BASH_SOURCE[0]}")/.." || exit 1

COMPOSE=(docker compose -f docker-compose.prod.yaml --env-file .env.prod --profile legacy-minio)

for var in S3_ENDPOINT S3_ACCESS_KEY S3_SECRET_KEY S3_BUCKET MINIO_ROOT_USER MINIO_ROOT_PASSWORD MINIO_BUCKET; do
    if ! grep -qE "^${var}=.+" .env.prod; then
        echo "❌ ${var} nije postavljen u .env.prod" >&2
        exit 1
    fi
done

echo "🪣 Pokrećem lokalni MinIO (izvor)…"
"${COMPOSE[@]}" up -d minio

echo "☁️  Kopiram MinIO → Cloudflare R2 i provjeravam…"
"${COMPOSE[@]}" run --rm r2-migrate

echo "✅ Gotovo. Svaki objekt iz MinIO-a postoji u R2."
