/**
 * Bridge between the single mounted `GameRoomExitGuard` (rendered only while
 * on a game table route — `App.tsx` mounts it exactly when `onTable`) and
 * things outside its component tree that need its own "ostani u sobi /
 * izađi" decision. Today that is only the Android hardware back button
 * (`NativeShell.tsx`'s `backButton` listener lives above the router, well
 * outside any page's component tree). A module singleton — the same pattern
 * `gameConnection.ts` uses — rather than a context, because the back button
 * listener is not React at all.
 *
 * `requestTableExit` makes EXACTLY the guard's own click-intercept decision
 * (see GameRoomExitGuard.tsx):
 *   - not seated at all → `leaveTable()` runs immediately, no dialog;
 *   - seated but the room is not `PLAYING` (lobby/finished) → same: a lobby
 *     seat is not resumable play and needs no confirmation;
 *   - seated during an active game → opens the SAME dialog a nav-link click
 *     would; `leaveTable` only runs if the player confirms "Izađi iz sobe",
 *     never on "Ostani u sobi".
 *
 * Returns `false` when no table route is mounted at all (`GameRoomExitGuard`
 * unregisters on unmount) — the caller treats that as "nothing to guard",
 * meaning `leaveTable` was NOT invoked and normal back handling should run.
 */
let impl: ((leaveTable: () => void) => void) | null = null

export function registerExitGuard(fn: ((leaveTable: () => void) => void) | null): void {
    impl = fn
}

export function requestTableExit(leaveTable: () => void): boolean {
    if (!impl) return false
    impl(leaveTable)
    return true
}
