import type { CSSProperties } from "react"
import type { Seat, Team } from "@bela/engine"

/* ──────────────────────────────────────────────────────────────────────────
   Seat geometry for the table.

   The engine numbers seats 0..3 and turn order is `(seat + 1) % 4`. The UI
   must show MY seat at the bottom and lay the others out so that play runs
   COUNTER-CLOCKWISE on screen, which is how bela is dealt and played at a
   real table: the player after me is the one on my RIGHT.

     rel 0 → bottom (me)
     rel 1 → right   (plays after me)
     rel 2 → top     (my partner)
     rel 3 → left    (plays before me)

   bottom → right → top → left is counter-clockwise in screen coordinates.
   ────────────────────────────────────────────────────────────────────── */

export const SEATS: readonly Seat[] = [0, 1, 2, 3]

/** Seats 0 and 2 are team A, seats 1 and 3 are team B (README §1.1). */
export function teamOf(seat: Seat): Team {
    return seat % 2 === 0 ? "A" : "B"
}

export function nextSeat(seat: Seat): Seat {
    return ((seat + 1) % 4) as Seat
}

export function partnerOf(seat: Seat): Seat {
    return ((seat + 2) % 4) as Seat
}

export function otherTeam(team: Team): Team {
    return team === "A" ? "B" : "A"
}

export type TablePosition = "bottom" | "right" | "top" | "left"

const POSITIONS: readonly TablePosition[] = ["bottom", "right", "top", "left"]

/** How far `seat` sits from `mySeat` in turn order. Spectators (null) look at
 *  the table from seat 0's chair, which keeps the layout stable for them. */
export function relativeIndex(seat: Seat, mySeat: Seat | null): number {
    const base = mySeat ?? 0
    return (seat - base + 4) % 4
}

export function positionOf(seat: Seat, mySeat: Seat | null): TablePosition {
    return POSITIONS[relativeIndex(seat, mySeat)]
}

/** Seats in render order, starting from mine at the bottom. */
export function seatsFromMe(mySeat: Seat | null): Seat[] {
    const base = mySeat ?? 0
    return [0, 1, 2, 3].map((i) => ((base + i) % 4) as Seat)
}

/** Where a seat is pinned on the felt. Shared by the live table and the
 *  room's preview of it, so the two never drift apart.
 *
 *  Partner top-centre, opponents on the flanks at mid height, me hugging the
 *  bottom edge right above the hand tray (game/DESIGN.md §1 "Stol"). The
 *  flanks sit slightly ABOVE centre because the trick's own cards fan
 *  downward from the middle, and the bottom row is a compact horizontal pill
 *  rather than a column, so it costs the felt almost no height. */
export const SEAT_ANCHORS: Record<TablePosition, CSSProperties> = {
    bottom: { bottom: "0px", left: "50%", transform: "translateX(-50%)" },
    top: { top: "0px", left: "50%", transform: "translateX(-50%)" },
    left: { left: "0px", top: "46%", transform: "translateY(-50%)" },
    right: { right: "0px", top: "46%", transform: "translateY(-50%)" },
}

/** Seats on the flanks stack their card fan vertically; top/bottom horizontally. */
export function isFlank(position: TablePosition): boolean {
    return position === "left" || position === "right"
}

/**
 * Deterministic 0..1 noise from two small integers. Used for the trick's
 * scatter: a card must land at the same angle and offset on every re-render
 * of the same trick (a trick that reshuffles itself looks broken) but two
 * consecutive tricks must not look like a stamped copy of each other.
 */
export function seatNoise(seat: Seat, trickIndex: number, salt = 0): number {
    const x = Math.sin((seat + 1) * 127.1 + (trickIndex + 1) * 311.7 + salt * 74.7) * 43758.5453
    return x - Math.floor(x)
}

/**
 * How a thrown card lies on the felt: tilted TOWARD its own seat by 12–22°,
 * plus a couple of pixels of scatter. Stable for a given (seat, trick).
 */
export function cardScatter(
    seat: Seat,
    mySeat: Seat | null,
    trickIndex: number,
): { tilt: number; dx: number; dy: number } {
    const position = positionOf(seat, mySeat)
    const magnitude = 12 + seatNoise(seat, trickIndex, 1) * 10
    // Flanks lean away from their own side; the two centre seats take their
    // sign from the noise so the pile never looks mirror-symmetric.
    const sign = position === "left" ? -1 : position === "right" ? 1 : seatNoise(seat, trickIndex, 2) < 0.5 ? -1 : 1
    return {
        tilt: magnitude * sign,
        dx: (seatNoise(seat, trickIndex, 3) - 0.5) * 12,
        dy: (seatNoise(seat, trickIndex, 4) - 0.5) * 12,
    }
}

/**
 * Unit vector pointing from the centre of the table toward a position, used
 * by the trick animation: a card flies IN from its owner's edge and, when the
 * trick is won, slides OUT toward the winner.
 */
export function positionVector(position: TablePosition): { x: number; y: number } {
    switch (position) {
        case "bottom": return { x: 0, y: 1 }
        case "top": return { x: 0, y: -1 }
        case "left": return { x: -1, y: 0 }
        case "right": return { x: 1, y: 0 }
    }
}
