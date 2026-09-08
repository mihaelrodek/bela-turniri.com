import type { CSSProperties } from "react"
import type { Seat, Team } from "@bela/engine"
import type { SeatInfo } from "@bela/protocol"

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

/** `@bela/protocol` inlines the union in `SeatInfo`; naming it here keeps
 *  every signature that takes one readable. */
export type Occupant = SeatInfo["occupant"]

/** Who is in a seat — a bot's given name, a player's display name, or the
 *  caller's own word for "nobody". */
export function occupantName(occupant: Occupant, fallback: string): string {
    if (occupant === null) return fallback
    return occupant.kind === "BOT" ? occupant.name : occupant.user.name
}

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

/** Where a seat is pinned on the felt.
 *
 *  Partner top-centre, opponents on the flanks at the table's mid height,
 *  and — for a spectator, who has no seat of their own below the felt —
 *  seat 0 along the bottom (game/DESIGN.md §2.2).
 *
 *  Every anchor is expressed against the FOUR GEOMETRY VARIABLES the table's
 *  root sets (`tableGeometry` in components/tableStyles.ts), never against
 *  numbers of its own: `--seat-x` / `--seat-y` are the gaps from the table's
 *  centre to a seat's inner edge, `--table-cy` is where that centre is, and
 *  `--seat-w` / `--seat-h` are the seat block's own size. One place to tune,
 *  and the flank offsets can never drift out of step with the trick's
 *  `REST_X`/`REST_Y` again, because both are stated in the same file.
 *
 *  Each anchor is wrapped in a `min()` against the box's own edge, so a
 *  window short or narrow enough that the ring does not fit degrades to
 *  edge-to-edge instead of pushing a seat outside the felt. (The trick pile
 *  scales down on exactly those screens — see TrickArea's TIGHT/SHORT — so
 *  the two meet in the middle rather than colliding.) */
export const SEAT_ANCHORS: Record<TablePosition, CSSProperties> = {
    top: {
        bottom: "min(calc(100% - var(--seat-h)), calc(var(--cy-bottom) + var(--seat-y)))",
        left: "50%",
        transform: "translateX(-50%)",
    },
    bottom: {
        top: "min(calc(100% - var(--seat-h)), calc(var(--table-cy) + var(--seat-y)))",
        left: "50%",
        transform: "translateX(-50%)",
    },
    left: {
        right: "min(calc(100% - var(--seat-w)), calc(50% + var(--seat-x)))",
        top: "var(--table-cy)",
        transform: "translateY(-50%)",
    },
    right: {
        left: "min(calc(100% - var(--seat-w)), calc(50% + var(--seat-x)))",
        top: "var(--table-cy)",
        transform: "translateY(-50%)",
    },
}

/* There used to be an `isFlank(position)` here, because the flanks rendered a
   different seat from the top and bottom ones. They no longer do — one seat
   anatomy, four anchors (Seat.tsx) — so nothing needs to ask. */

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
