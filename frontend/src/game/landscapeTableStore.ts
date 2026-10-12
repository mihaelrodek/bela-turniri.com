import { useSyncExternalStore } from "react"

/* ──────────────────────────────────────────────────────────────────────────
   landscapeTableStore — "is a game TABLE up right now?" (2026-10-12, owner,
   third pass).

   The full-screen landscape layout and the hidden chrome apply ONLY while
   the room is actually playing: a waiting room, a finished game whose
   result dialog is up, and every other route keep the ordinary layout even
   with the phone held sideways. `App.tsx` has to know that too, and it has
   no socket — so the room page WRITES the fact here from its own room
   status, and both read it through `useSyncExternalStore`. A module-level
   boolean, nothing more: one writer (`GameRoomPage`), reset to false when
   that page unmounts or the room is left.
   ────────────────────────────────────────────────────────────────────── */

let playing = false
const listeners = new Set<() => void>()

/** Written by `GameRoomPage` only: the table (not the room screen) is up. */
export function setTablePlaying(value: boolean): void {
    if (playing === value) return
    playing = value
    for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
}

function getSnapshot(): boolean {
    return playing
}

function getServerSnapshot(): boolean {
    return false
}

/** True while a game table is up on the room page. */
export function useTablePlaying(): boolean {
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

/* ── the player's own choice of layout (2026-10-12, owner) ───────────────
   A landscape phone gets the full-screen table by default; the rotation
   button in the room (`LayoutToggleButton`) lets the player go back to the
   ordinary layout and return. `preferNormal` is that override: when true,
   `useLandscapeTable` is false whatever the screen. Per device, in
   `localStorage` — every access wrapped, a private window or blocked
   storage simply means "the default", never a throw. */
const PREFER_NORMAL_KEY = "bela:game:preferNormalLayout"

function readPreferNormal(): boolean {
    try {
        return typeof window !== "undefined" && window.localStorage.getItem(PREFER_NORMAL_KEY) === "1"
    } catch {
        return false
    }
}

let preferNormal = readPreferNormal()
const preferListeners = new Set<() => void>()

/** Set (and remember on this device) the player's layout override. */
export function setPreferNormalLayout(value: boolean): void {
    if (preferNormal === value) return
    preferNormal = value
    try {
        if (value) window.localStorage.setItem(PREFER_NORMAL_KEY, "1")
        else window.localStorage.removeItem(PREFER_NORMAL_KEY)
    } catch {
        // Storage unavailable: the choice holds for this page's life only.
    }
    for (const listener of preferListeners) listener()
}

function subscribePrefer(listener: () => void): () => void {
    preferListeners.add(listener)
    return () => preferListeners.delete(listener)
}

function getPreferSnapshot(): boolean {
    return preferNormal
}

/** True while the player has asked for the ordinary layout on a landscape
 *  phone. */
export function usePreferNormalLayout(): boolean {
    return useSyncExternalStore(subscribePrefer, getPreferSnapshot, getServerSnapshot)
}
