import { useCallback, useSyncExternalStore } from "react"

/* ──────────────────────────────────────────────────────────────────────────
   useGamePrefs — per-device game preferences (game/DESIGN.md §2.10).

   Plain localStorage + a tiny external store, so any component (the table,
   the hand, the settings sheet) reads the same value and re-renders when it
   changes — no context provider to thread through. Every read/write is
   wrapped in try/catch: storage can be unavailable (private mode, blocked
   site data) and the defaults must still work.
   ────────────────────────────────────────────────────────────────────── */

export type DeckStyle = "madjarice" | "francuske"

export interface GamePrefs {
    /** Card artwork. Bela is played with Hungarian cards — that is the default. */
    deck: DeckStyle
    sound: boolean
    /** Manual "Smanji animacije"; combined with `prefers-reduced-motion` by consumers. */
    reduceMotion: boolean
}

export const DEFAULT_GAME_PREFS: GamePrefs = {
    deck: "madjarice",
    sound: true,
    reduceMotion: false,
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
            deck: parsed.deck === "francuske" ? "francuske" : "madjarice",
            sound: parsed.sound !== false,
            reduceMotion: parsed.reduceMotion === true,
        }
    } catch {
        return DEFAULT_GAME_PREFS
    }
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
