import type { RoomState, Seat } from "@bela/protocol"
import type { Declaration } from "@bela/engine"

/* ──────────────────────────────────────────────────────────────────────────
   Declaration helpers of the "Pregled zvanja" popup (`DeclarationsReveal`),
   pulled out of it on 2026-10-11 for a bottom notice that was dropped the
   next day (the owner wants no words for a declaration anywhere — the
   cards on the felt and a "+N" badge are the whole reveal). Kept here, not
   moved back, so the next reader of the popup does not have to ask.
   ────────────────────────────────────────────────────────────────────── */

/** Who sits there — a bot's given name, a player's display name, or the
 *  caller's own word for "nobody". `occupantName` in seats.ts does the same
 *  from an occupant; this one takes the seat. */
export function seatName(seats: RoomState["seats"], seat: Seat, fallback: string): string {
    const occupant = seats[seat]?.occupant
    if (!occupant) return fallback
    return occupant.kind === "BOT" ? occupant.name : occupant.user.name
}

export function totalPoints(declarations: readonly Declaration[]): number {
    return declarations.reduce((sum, d) => sum + d.points, 0)
}
