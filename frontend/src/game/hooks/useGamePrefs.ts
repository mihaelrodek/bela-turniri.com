import { useCallback, useSyncExternalStore } from "react"
import { DEFAULT_DECK, isDeckStyle, type DeckStyle } from "../util/cards"

/* ──────────────────────────────────────────────────────────────────────────
   useGamePrefs — per-device game preferences (game/DESIGN.md §2.10).

   Plain localStorage + a tiny external store, so any component (the table,
   the hand, the settings sheet) reads the same value and re-renders when it
   changes — no context provider to thread through. Every read/write is
   wrapped in try/catch: storage can be unavailable (private mode, blocked
   site data) and the defaults must still work.
   ────────────────────────────────────────────────────────────────────── */

/** Re-exported for the many components that only ever import from this hook.
 *  The registry — ids, defaults, `isHungarianDeck`, `deckHasImages` — lives in
 *  `../util/cards`, which has no React dependency. */
export type { DeckStyle }

export interface GamePrefs {
    /** Card artwork. Bela is played with Hungarian cards, so the default is a
     *  Hungarian deck; see the registry in `../util/cards`. */
    deck: DeckStyle
    sound: boolean
    /** Manual "Smanji animacije"; combined with `prefers-reduced-motion` by consumers. */
    reduceMotion: boolean
    alwaysReady: boolean
    /** "Drži zaslon uključenim" — hold a Screen Wake Lock while a deal is
     *  running, so a phone lying on the table does not lock mid-hand. */
    keepAwake: boolean
}

export const DEFAULT_GAME_PREFS: GamePrefs = {
    deck: DEFAULT_DECK,
    sound: true,
    reduceMotion: false,
    // ON for everybody (2026-09-09, user request). Sitting down IS saying you
    // are ready in a four-seat game people opened on purpose; the switch stays
    // so anybody who wants the extra beat can turn it off.
    alwaysReady: true,
    // ON by default (2026-09-20, user request): a game of bela has long
    // stretches where the player only watches, which is exactly when iOS
    // decides the screen may go off.
    keepAwake: true,
}

const STORAGE_KEY = "bela:game:prefs:v1"

let current: GamePrefs = load()
const listeners = new Set<() => void>()

function load(): GamePrefs {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return DEFAULT_GAME_PREFS
        const parsed = JSON.parse(raw) as Partial<GamePrefs>
        return {
            deck: migrateDeck(parsed.deck),
            sound: parsed.sound !== false,
            reduceMotion: parsed.reduceMotion === true,
            // Absent reads as the default (true), so an install from before
            // this change starts ready rather than being silently opted out;
            // only a stored `false` turns it off.
            alwaysReady: parsed.alwaysReady !== false,
            // Same "absent means the default" rule as `alwaysReady`.
            keepAwake: parsed.keepAwake !== false,
        }
    } catch {
        return DEFAULT_GAME_PREFS
    }
}

/**
 * Stored deck → a deck that still exists.
 *
 * Until 2026-09-20 there was ONE Hungarian deck, stored as `"madjarice"`; it
 * is now `klasicne` (same artwork, since the licensed set is what that pref
 * had been showing), so an existing install keeps the cards it knows. Any
 * other unknown value — a deck removed later, a hand-edited key — falls back
 * to the default rather than rendering nothing.
 */
function migrateDeck(stored: unknown): DeckStyle {
    if (stored === "madjarice") return "klasicne"
    return isDeckStyle(stored) ? stored : DEFAULT_DECK
}

function persist(next: GamePrefs) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
        // Storage unavailable — keep the in-memory value for this session.
    }
}

export function getGamePrefs(): GamePrefs {
    return current
}

export function setGamePrefs(patch: Partial<GamePrefs>) {
    current = { ...current, ...patch }
    persist(current)
    listeners.forEach((l) => l())
}

function subscribe(l: () => void) {
    listeners.add(l)
    return () => {
        listeners.delete(l)
    }
}

export function useGamePrefs(): [GamePrefs, (patch: Partial<GamePrefs>) => void] {
    const prefs = useSyncExternalStore(subscribe, getGamePrefs, () => DEFAULT_GAME_PREFS)
    const update = useCallback((patch: Partial<GamePrefs>) => setGamePrefs(patch), [])
    return [prefs, update]
}
