import { useSyncExternalStore } from "react"
import { useLocation } from "react-router-dom"
import { LANDSCAPE_TABLE_QUERY } from "../landscapeQuery"
import { usePreferNormalLayout, useTablePlaying } from "../landscapeTableStore"

/* ──────────────────────────────────────────────────────────────────────────
   useLandscapeTable — is THIS screen the full-screen landscape table?
   (2026-10-12, owner.)

   Three facts, all required: the route is a game room (`/igra/soba/*`),
   the viewport matches `LANDSCAPE_TABLE_QUERY` (a phone held sideways), and
   a TABLE is up — `landscapeTableStore`, written by the room page from its
   room status (third pass, 2026-10-12, owner): the waiting room and the
   finished game keep the ordinary layout and chrome however the phone is
   held. The query is the ONE constant in `landscapeQuery.ts` (re-exported
   by `tableStyles.ts` for `css` blocks), so a `css` block on the room page
   and this hook can never disagree about where the mode starts.

   `App.tsx` reads it to leave the NavBar, SiteFooter, MobileTabBar out of
   the tree; `GameRoomPage` reads it to swap the column for
   `GameRoomLandscape`. Portrait and md+ desktop are untouched: the query is
   false there, and so is this.

   A fourth fact (2026-10-12, owner): the player has not asked for the
   ordinary layout with the rotation button (`preferNormal` in
   `landscapeTableStore`, remembered per device).
   ────────────────────────────────────────────────────────────────────── */

const ROOM_PREFIX = "/igra/soba/"

function subscribe(onChange: () => void): () => void {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {}
    const list = window.matchMedia(LANDSCAPE_TABLE_QUERY)
    list.addEventListener("change", onChange)
    return () => list.removeEventListener("change", onChange)
}

function snapshot(): boolean {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false
    return window.matchMedia(LANDSCAPE_TABLE_QUERY).matches
}

function serverSnapshot(): boolean {
    return false
}

/** True while the viewport is a landscape phone (route-independent). */
export function useLandscapeTableMedia(): boolean {
    return useSyncExternalStore(subscribe, snapshot, serverSnapshot)
}

/** True on a game-room route on a landscape phone while the table is up,
 *  unless the player switched to the ordinary layout. */
export function useLandscapeTable(): boolean {
    const { pathname } = useLocation()
    const landscape = useLandscapeTableMedia()
    const playing = useTablePlaying()
    const preferNormal = usePreferNormalLayout()
    return landscape && playing && !preferNormal && pathname.startsWith(ROOM_PREFIX)
}
