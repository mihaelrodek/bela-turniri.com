/* ──────────────────────────────────────────────────────────────────────────
   The one storage key that says "this tab is still sitting at a table".

   Deliberately a zero-dependency module: `App.tsx` imports it to decide
   whether the app-wide `ActiveRoomWidget` is worth loading at all, and it must
   be able to do that WITHOUT pulling the game chunk (the socket, the protocol
   types, the card renderer) into the bundle every visitor downloads.

   `gameConnection.ts` owns the value; everyone else only asks whether one is
   there. sessionStorage, not localStorage: a held seat belongs to this tab and
   this browsing session, not to the device forever.
   ────────────────────────────────────────────────────────────────────── */

export const STICKY_ROOM_KEY = "bela:game:room"

export function readStickyRoomId(): string | null {
    try {
        return window.sessionStorage.getItem(STICKY_ROOM_KEY)
    } catch {
        // Private mode / site data blocked — membership just won't survive a reload.
        return null
    }
}

export function writeStickyRoomId(roomId: string | null): void {
    try {
        if (roomId === null) window.sessionStorage.removeItem(STICKY_ROOM_KEY)
        else window.sessionStorage.setItem(STICKY_ROOM_KEY, roomId)
    } catch {
        /* noop */
    }
}
