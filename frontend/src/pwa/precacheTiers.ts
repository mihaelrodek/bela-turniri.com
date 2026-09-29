import { isNative } from "../platform"
import { isGamesSite } from "../site"
import { gameEnabledOnce } from "../game/hooks/useGameEnabled"

/* ──────────────────────────────────────────────────────────────────────────
   Which optional precache tiers THIS page asks the service worker for.

   `/precache-manifest.json` (vite.config.ts → `bela-precache-manifest`)
   splits the offline cache into the SHELL tier, which `public/sw.js` always
   keeps (app shell + the /blok scorepad), and optional tiers it fetches only
   when a page asks — today just `game`: the online table's route chunks, all
   card art and the sounds, ~4.4 MB. A visitor who opens one tournament link
   on mobile data must not download that.

   The game tier is asked for when ALL of these hold:
     • the device is not in data-saver mode (`navigator.connection.saveData`)
       — then no optional tier is asked for at all;
     • this is a games domain (the game IS the site there), or the player has
       opened the game on this device before (GAME_MARKER, set by
       `GameFeatureGate` once the game actually rendered);
     • the kill switch is on (`/game-status.json`) — the same promise the nav
       and GameFeatureGate already share, so this adds no request.

   Asking is idempotent and cheap in the worker (a per-tier build stamp), and
   the worker never prunes a tier it already holds just because a page load
   did not ask for it — see PRECACHE TIERS in public/sw.js.
   ────────────────────────────────────────────────────────────────────── */

/** localStorage: "1" once the online game has rendered on this device. */
const GAME_MARKER = "bela:gamePrecache"

/** At most one game-tier request per page session from the gate. */
let gameAsked = false

function precacheAvailable(): boolean {
    return import.meta.env.PROD
        && !isNative
        && typeof navigator !== "undefined"
        && "serviceWorker" in navigator
}

function saveData(): boolean {
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
    return connection?.saveData === true
}

function gameVisited(): boolean {
    try {
        return localStorage.getItem(GAME_MARKER) === "1"
    } catch {
        return false
    }
}

function markGameVisited(): void {
    try {
        localStorage.setItem(GAME_MARKER, "1")
    } catch {
        /* private mode / storage blocked — the next load just won't ask */
    }
}

/** `ready` rather than `controller`: a first-ever install has no controller
 *  yet, and `ready` resolves once there is an active worker to ask. */
function post(tiers: string[]): void {
    navigator.serviceWorker.ready
        .then((registration) => {
            registration.active?.postMessage({ type: "bela:precache", tiers })
        })
        .catch(() => {
            /* no worker ever became active — nothing to refresh */
        })
}

/**
 * The per-page-load precache check (called from SwUpdateToast on `load`): the
 * shell always, the game tier when the rules in the header allow it.
 */
export function requestPrecacheOnLoad(): void {
    if (!precacheAvailable()) return
    if (saveData() || !(isGamesSite || gameVisited())) {
        post([])
        return
    }
    gameEnabledOnce()
        .then((enabled) => {
            if (enabled) gameAsked = true
            post(enabled ? ["game"] : [])
        })
        .catch(() => post([]))
}

/**
 * The online game has just rendered (kill switch on): remember that for later
 * loads and, unless data saver is on, ask for the game tier now — so the very
 * first visit to the lobby already warms the table's chunks and card art.
 */
export function requestGamePrecache(): void {
    if (!precacheAvailable()) return
    markGameVisited()
    if (gameAsked || saveData()) return
    gameAsked = true
    post(["game"])
}
