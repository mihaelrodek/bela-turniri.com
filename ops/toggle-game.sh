#!/usr/bin/env bash
#
# Flip the production kill switch for the online bela feature ("Igraj").
#
# Usage (from the repo root, on the prod server):
#   ./ops/toggle-game.sh on
#   ./ops/toggle-game.sh off
#   ./ops/toggle-game.sh status
#
# How it works: Caddy serves ops/game-flag/ENABLED's presence as
# /game-status.json (see the Caddyfile, "0a. Game feature flag"), and the
# SPA (NavBar + GameFeatureGate) hides the "Igraj" link / bounces the /igra
# routes to "/" whenever that reads false. The file lives on a host
# bind-mount into the edge container, so this takes effect immediately -
# no rebuild, no redeploy, no Caddy reload needed. A fresh box has no flag
# file, so the feature defaults to OFF until you run `on` here.
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

FLAG="ops/game-flag/ENABLED"
mkdir -p ops/game-flag

case "${1:-}" in
    on)
        touch "$FLAG"
        echo "✅ Igra ON - /igra je vidljiva i dostupna."
        ;;
    off)
        rm -f "$FLAG"
        echo "🚫 Igra OFF - /igra je skrivena, novi posjetitelji odbijeni na /."
        ;;
    status)
        if [[ -f "$FLAG" ]]; then
            echo "Igra je UKLJUČENA."
        else
            echo "Igra je ISKLJUČENA."
        fi
        ;;
    *)
        echo "Usage: $0 on|off|status" >&2
        exit 1
        ;;
esac
