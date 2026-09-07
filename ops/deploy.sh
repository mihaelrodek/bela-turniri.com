#!/usr/bin/env bash
#
# Deploy bela-turniri.com - shows the "Nadogradnja u tijeku" maintenance
# page for the whole update, then clears it (even if the deploy fails).
#
# Usage (run from the repo root on the prod server):
#   ./ops/deploy.sh
#
# What it does:
#   1. touch ops/maintenance/ENABLED  → Caddy starts serving the 503 page.
#   2. git pull + rebuild + restart the stack (backend migrations run here).
#   3. rm ops/maintenance/ENABLED     → back to normal (via EXIT trap, so it
#      clears even on error / Ctrl-C).
#
# Note: the maintenance page is served by the *running* edge container. The
# very first time you introduce this, the currently-running edge doesn't know
# about it yet, so that one deploy has the usual brief blip; every deploy after
# it shows the page. When a deploy rebuilds the edge image itself (frontend
# change), there's still a ~1-3 s connection blip while the container swaps -
# unavoidable with a single edge - but the flag stays ON across the swap.
#
# Rollback on build/up failure: before rebuilding, the backend/edge images
# currently tagged :latest are re-tagged :previous. If `compose up --build`
# then fails (bad Dockerfile change, dependency the build host can't reach,
# etc.), the script re-tags :previous back onto :latest and does a plain
# `compose up -d` (no --build) to get the previously-working containers back
# up, then exits non-zero - leaving the site running on the *old* code
# instead of dead or half-upgraded. It does NOT revert the `git pull` - only
# the images. The very first deploy on a fresh box has no :previous to fall
# back to, so a failure there just exits non-zero with nothing to roll back
# onto.
set -euo pipefail

cd "$(dirname "$0")/.."

FLAG="ops/maintenance/ENABLED"
COMPOSE=(docker compose -f docker-compose.prod.yaml --env-file .env.prod)

mkdir -p ops/maintenance

maintenance_off() {
    rm -f "$FLAG"
    echo "✅ Maintenance OFF - site je opet dostupan."
}
trap maintenance_off EXIT

echo "🛠  Maintenance ON - prikazuje se 'Nadogradnja u tijeku'."
touch "$FLAG"
# Small pause so in-flight requests land on the maintenance page before we
# start tearing containers down.
sleep 2

echo "⬇️  git pull…"
git pull --ff-only

# Rollback point: tag whatever is currently :latest as :previous BEFORE
# rebuilding. `|| true` because a fresh box has no :latest yet on its first
# deploy - nothing to roll back to, which is fine, first deploys have no
# traffic to protect anyway.
echo "🏷  Tagging current images as :previous (rollback point)…"
docker tag bela-backend:latest bela-backend:previous 2>/dev/null || true
docker tag bela-edge:latest bela-edge:previous 2>/dev/null || true

echo "🐳 Rebuild + restart…"
if ! "${COMPOSE[@]}" up -d --build; then
    echo "❌ Build/up failed - attempting rollback to :previous images…" >&2
    ROLLED_BACK=0
    if docker image inspect bela-backend:previous >/dev/null 2>&1; then
        docker tag bela-backend:previous bela-backend:latest
        ROLLED_BACK=1
    fi
    if docker image inspect bela-edge:previous >/dev/null 2>&1; then
        docker tag bela-edge:previous bela-edge:latest
        ROLLED_BACK=1
    fi
    if [[ "$ROLLED_BACK" -eq 1 ]]; then
        # No --build here on purpose: reuse the just-restored :latest tags
        # rather than rebuilding from the (possibly broken) new source.
        "${COMPOSE[@]}" up -d
        echo "↩️  Rolled back to the previous images and restarted them." >&2
    else
        echo "⚠️  No :previous images found - nothing to roll back to." >&2
    fi
    # EXIT trap still clears the maintenance flag below.
    exit 1
fi

echo "🧹 Prune old images…"
docker image prune -f

# EXIT trap clears the flag → maintenance OFF.
