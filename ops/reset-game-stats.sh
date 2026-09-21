#!/usr/bin/env bash
#
# Wipe the ONLINE-GAME statistics for bela-turniri.com.
#
# Why this exists: the online Bela game (game/) was play-tested heavily before
# launch, so every profile's "partije / pobjede" card, the admin "Analitika
# igre" tab and the karma numbers are full of games nobody means to keep. This
# resets exactly those, and nothing else.
#
# WHAT IT CLEARS (and why each one)
#   game_result_players      one row per seat of a finished game — the table
#                            every "games played / won" number is computed
#                            from (GameStatsService reads it on every request;
#                            there is no aggregate table anywhere, so clearing
#                            the rows makes every card read 0-0 by itself).
#   game_results             the finished games those seats belong to. Cleared
#                            in the SAME statement as the seats: the FK is
#                            ON DELETE CASCADE, so one TRUNCATE naming both
#                            tables is FK-safe and leaves nothing dangling.
#   game_analytics_events    the run/deal event log behind the admin
#                            "Analitika igre" aggregate (rooms created, games
#                            started, trumps, durations…). Its whole content
#                            is test runs.
#   game_reliability_events  the append-only ledger of confirmed mid-game
#                            abandonments. Karma is DERIVED from it
#                            (10 − abandons in the last 30 days), so the only
#                            way to reset karma is to clear this.
#   user_profiles.game_abandons                  -> 0   lifetime abandon counter
#   user_profiles.game_karma                     -> 10  legacy stored karma
#   user_profiles.game_completed_since_recovery  -> 0   legacy recovery counter
#                            The last two are no longer read (karma is derived
#                            since 2026-09-21) but are still stored, so they
#                            are put back to their schema defaults rather than
#                            left holding numbers from the test period.
#
# WHAT IT NEVER TOUCHES
#   tournaments, pairs, rounds, matches, standings, drinks/cjenik, repassage,
#   blok_sessions, push_subscriptions / push_devices, resources, contact
#   messages, reports/blocks — none of that is online-game statistics.
#   user_profiles rows themselves are kept (only the three game counters are
#   reset), and game_names is kept too: a player's chosen in-game name is
#   identity, not a statistic.
#
# USAGE (from the repo root, on the prod server):
#   ./ops/reset-game-stats.sh                 # DRY RUN: prints counts, changes nothing
#   ./ops/reset-game-stats.sh --yes           # backup, then wipe (asks you to type WIPE)
#   ./ops/reset-game-stats.sh --yes --force   # same, without the typed confirmation
#   ./ops/reset-game-stats.sh --yes --keep-karma
#                                             # wipe games + analytics, keep the
#                                             # abandon ledger and karma counters
#
# A real run always takes a fresh backup first (ops/backup-db.sh) and aborts
# if that backup fails — there is no other undo.
set -euo pipefail

# ── Run from anywhere ──────────────────────────────────────────────────────
# Same reasoning as ops/backup-db.sh: `docker compose` reads .env.prod from
# its WORKING DIRECTORY, so anchor to the repo root instead of trusting the
# caller's (a run from ops/ would otherwise start psql with empty
# POSTGRES_* variables).
cd "$(dirname "${BASH_SOURCE[0]}")/.." || exit 1

CONFIRM_WORD="WIPE"
APPLY=0
FORCE=0
KEEP_KARMA=0

usage() {
    cat >&2 <<'EOF'
Usage: ./ops/reset-game-stats.sh [--yes] [--force] [--keep-karma]

  (no flags)     dry run - print the row counts that WOULD be cleared, exit 0
  --yes          actually delete (takes a backup first, then asks for a typed
                 confirmation)
  --force        with --yes: skip the typed confirmation (for scripted runs)
  --keep-karma   leave game_reliability_events and the user_profiles karma /
                 abandon counters alone; clear only games + analytics
EOF
    exit 1
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --yes|-y) APPLY=1 ;;
        --force) FORCE=1 ;;
        --keep-karma) KEEP_KARMA=1 ;;
        -h|--help) usage ;;
        *) echo "Unknown argument: $1" >&2; usage ;;
    esac
    shift
done

# $POSTGRES_USER / $POSTGRES_DB are interpolated by THIS shell (they pick the
# target on the host side of the `exec`), not inside the container - so they
# have to be in the environment here, not only passed to compose via
# --env-file. Same pattern as ops/backup-db.sh and ops/restore-db.sh.
if [[ ! -f .env.prod ]]; then
    echo "❌ .env.prod not found - run this from the repo root on the server." >&2
    exit 1
fi
set -a
# shellcheck disable=SC1091
. .env.prod
set +a

COMPOSE=(docker compose -f docker-compose.prod.yaml --env-file .env.prod)

# psql on the postgres service; callers add whatever flags they need
# (-P pager=off for the count tables, --single-transaction for the wipe).
psql_run() {
    "${COMPOSE[@]}" exec -T postgres \
        psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 "$@"
}

counts_sql() {
    cat <<'SQL'
SELECT 'game_results'                                  AS tablica, count(*) AS redaka FROM game_results
UNION ALL SELECT 'game_result_players',                          count(*) FROM game_result_players
UNION ALL SELECT 'game_analytics_events',                        count(*) FROM game_analytics_events
UNION ALL SELECT 'game_reliability_events',                      count(*) FROM game_reliability_events
UNION ALL SELECT 'user_profiles.game_abandons > 0',              count(*) FROM user_profiles WHERE game_abandons <> 0
UNION ALL SELECT 'user_profiles.game_karma <> 10',               count(*) FROM user_profiles WHERE game_karma <> 10
UNION ALL SELECT 'user_profiles.game_completed_since_recovery>0', count(*) FROM user_profiles WHERE game_completed_since_recovery <> 0;
SQL
}

print_counts() {
    counts_sql | psql_run -P pager=off
}

echo "📊 Trenutno stanje statistike online igre (baza: $POSTGRES_DB)"
print_counts

if [[ "$KEEP_KARMA" -eq 1 ]]; then
    echo "ℹ️  --keep-karma: game_reliability_events i karma/napuštanja na user_profiles ostaju netaknuti."
fi

if [[ "$APPLY" -eq 0 ]]; then
    cat <<EOF

🔍 DRY RUN - ništa nije obrisano.
   Obrisalo bi se: game_result_players + game_results, game_analytics_events$( [[ "$KEEP_KARMA" -eq 0 ]] && echo ", game_reliability_events" || true )
$( [[ "$KEEP_KARMA" -eq 0 ]] && echo "   Resetiralo bi se: user_profiles.game_abandons -> 0, game_karma -> 10, game_completed_since_recovery -> 0" || true )
   Ne dira: turnire, parove, profile kao takve, blok, push pretplate, imena za igru.

   Za stvarno brisanje:  ./ops/reset-game-stats.sh --yes
EOF
    exit 0
fi

# ── Real run ───────────────────────────────────────────────────────────────
echo ""
echo "💾 Radim svjež backup prije brisanja…"
if ! ./ops/backup-db.sh; then
    echo "❌ Backup nije uspio - PREKIDAM, ništa nije obrisano." >&2
    exit 1
fi

if [[ "$FORCE" -eq 0 ]]; then
    echo ""
    echo "⚠️  Ovo trajno briše statistiku online igre iznad. Nema undo osim restorea backupa."
    read -r -p "Upiši '$CONFIRM_WORD' za nastavak: " TYPED
    if [[ "$TYPED" != "$CONFIRM_WORD" ]]; then
        echo "Prekinuto - ništa nije promijenjeno."
        exit 1
    fi
fi

# Everything in ONE transaction: --single-transaction wraps the whole stream,
# and ON_ERROR_STOP makes the first failure roll the lot back, so the database
# is never left with games cleared but karma still counting them.
{
    # game_result_players first in the list is cosmetic - TRUNCATE naming both
    # tables in one statement handles the FK between them regardless of order;
    # naming them together is what makes TRUNCATE legal here at all.
    echo "TRUNCATE TABLE game_result_players, game_results RESTART IDENTITY;"
    echo "TRUNCATE TABLE game_analytics_events RESTART IDENTITY;"
    if [[ "$KEEP_KARMA" -eq 0 ]]; then
        echo "TRUNCATE TABLE game_reliability_events RESTART IDENTITY;"
        # Plain UPDATE, not TRUNCATE: user_profiles holds real profiles that
        # must survive - only the three game counters go back to their
        # schema defaults (10 / 0 / 0).
        echo "UPDATE user_profiles SET game_abandons = 0, game_karma = 10, game_completed_since_recovery = 0 WHERE game_abandons <> 0 OR game_karma <> 10 OR game_completed_since_recovery <> 0;"
    fi
} | psql_run --single-transaction

echo ""
echo "📊 Stanje nakon brisanja:"
print_counts

cat <<'EOF'

✅ Statistika online igre je obrisana.

   Restart game servera NIJE potreban. Game server keshira profile ~5 minuta,
   pa se brojke kod igrača koji su trenutno spojeni osvježe unutar ~5 min
   (ili odmah nakon ponovnog spajanja). Frontend ne sprema ništa o game
   statistici lokalno, pa je dovoljan refresh stranice.
EOF
