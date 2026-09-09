#!/usr/bin/env bash
#
# Thin wrapper around the production `docker compose ... up -d --build`.
#
# It does exactly what the raw compose command does, but shows the
# "Nadogradnja u tijeku" maintenance page for the duration of the
# rebuild/restart and clears it afterwards - even if the build fails or you
# Ctrl-C (via the EXIT trap).
#
# WHY a wrapper: `docker compose` has no pre/post-up hooks, so the raw command
# can't toggle the maintenance flag by itself. Run THIS instead of the raw
# command whenever you want the maintenance page.
#
# Usage (from the repo root on the prod server):
#   ./ops/up.sh              # rebuild + restart the whole stack
#   ./ops/up.sh backend      # rebuild + restart only the backend service
#   ./ops/up.sh edge backend # any extra args are passed straight to compose
#
# Difference vs ./ops/deploy.sh: deploy.sh is the full release flow (git pull
# + rebuild + image prune). up.sh is just the guarded compose up - no git pull,
# no prune - a drop-in replacement for a manual `docker compose up -d --build`.
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

echo "🐳 Rebuild + restart…"
"${COMPOSE[@]}" up -d --build "$@"

# EXIT trap clears the flag → maintenance OFF.
