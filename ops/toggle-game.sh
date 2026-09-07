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
