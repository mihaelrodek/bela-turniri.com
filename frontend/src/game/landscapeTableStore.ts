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
