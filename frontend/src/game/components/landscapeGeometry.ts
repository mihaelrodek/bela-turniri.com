import type { CSSProperties } from "react"
import type { TablePosition } from "../util/seats"
import { LANDSCAPE_RAIL_W } from "./tableStyles"

/* ──────────────────────────────────────────────────────────────────────────
   Landscape geometry (2026-10-12, owner): where the seats and the declared
   cards go when the whole screen is the felt (`pages/GameRoomLandscape`).

   Its OWN anchor map, handed to `Table` and `DeclarationsOnTable` as props
   — the portrait `SEAT_ANCHORS` in util/seats.ts are untouched. The flight
   directions (`positionVector`) are the same four compass points on both
   layouts, so `TrickArea` and `CardFlight` need nothing new: a partner's
   card still comes from the top, an opponent's from its flank.

   Read against the variables `landscapeTableGeometry()` sets on the table
   root (`--seat-w`, `--seat-h`, `--seat-gutter`, `--table-cy`): the box is
   the felt above the turn pill, its centre is the trick's centre, the
   partner hangs from its top edge, and the flanks sit at mid-height just
   inboard of the rail (left) and the corner buttons (right).
   ────────────────────────────────────────────────────────────────────── */

export const LANDSCAPE_SEAT_ANCHORS: Record<TablePosition, CSSProperties> = {
    top: {
        top: "0px",
        left: "50%",
        transform: "translateX(-50%)",
    },
    // A spectator's bottom seat: at the foot of the felt, above the pill.
    bottom: {
        bottom: "0px",
        left: "50%",
        transform: "translateX(-50%)",
    },
    left: {
        left: "var(--seat-gutter)",
        top: "var(--table-cy)",
        transform: "translateY(-50%)",
    },
    right: {
        right: "var(--seat-gutter)",
        top: "var(--table-cy)",
        transform: "translateY(-50%)",
    },
}

/* ── each seat's hand of card backs (`SeatCardFan` in Seat.tsx) ──────────
   Seventh pass (2026-10-12, owner — "kao klasične bela aplikacije"): the
   backs lie IN FRONT of the player, facing the middle of the table — a
   vertical column just inboard of each flank seat (the backs turned 90°,
   their long axis pointing at the centre, stacked down the column), a
   horizontal row just under the partner. Their numbers live HERE, not in
   Seat.tsx, because the declared cards' slots and the trick's budget
   (`computeLandscapeScale`) are placed past them: one set of constants
   draws the fan and clears it, so the two cannot drift apart. Nothing is
   zoomed and each back only jitters ±1.5°, so these are exact sizes. */
/** One back: a `sm` CardBack (56 × 90) at this scale — 20 × 32 px. */
export const SEAT_FAN_SCALE = 0.36
export const SEAT_FAN_BACK_W = 56 * SEAT_FAN_SCALE
export const SEAT_FAN_BACK_H = 90 * SEAT_FAN_SCALE
/** The visible strip of every back but the last — 30 % of a back's short
 *  side, i.e. ~70 % overlap. */
export const SEAT_FAN_STEP = 6
/** The fan's thickness across its flow (a back's LONG side, in both the
 *  column, where the backs lie sideways, and the row, where they stand). */
export const SEAT_FAN_THICK = Math.ceil(SEAT_FAN_BACK_H)
/** The longest fan — eight backs along the flow. */
export const SEAT_FAN_MAX_LEN = Math.ceil(SEAT_FAN_BACK_W + 7 * SEAT_FAN_STEP)
/** Air between the seat block and its fan. */
export const SEAT_FAN_GAP = 4
/** How far the fan sticks out of the seat block, toward the centre. */
export const SEAT_FAN_DEPTH = SEAT_FAN_GAP + SEAT_FAN_THICK
/** The avatar's centre, from the top of the seat block (the turn frame's
 *  10 px padding + 2 px border + half the 48 px avatar frame, `Seat.tsx`):
 *  a flank's column is centred on THIS, not on the block. */
export const SEAT_AVATAR_CY = 36
/** Felt between a flank's column of backs and that seat's declared cards. */
const DECL_FLANK_AIR = 16
/** Felt between the partner's row of backs and the partner's declared cards. */
const DECL_TOP_AIR = 8

/** Where a seat's backs go, relative to its seat block — always the side
 *  facing the middle of the table. */
export type FanPlacement = "left" | "right" | "above" | "below"

export const LANDSCAPE_FAN_PLACEMENT: Record<TablePosition, FanPlacement> = {
    top: "below",
    // A spectator's bottom seat: the backs above it, toward the centre.
    bottom: "above",
    left: "right",
    right: "left",
}

/** The declared cards' slots, landscape: a row under the partner's row of
 *  backs, ROWS inboard of each flank seat's column of backs — one row per
 *  declaration, stacked, centred on the seat's height — and the viewer's
 *  own row at the foot of the felt. Every slot starts past its seat's fan
 *  (`SEAT_FAN_DEPTH`) plus some air, so the cards lie on the felt and never
 *  on a hand (sixth and seventh pass, 2026-10-12, owner). Each slot scales
 *  about the edge nearest its seat, so `--decl-k` always grows INWARD. */
export function landscapeDeclSlot(position: TablePosition, spectator: boolean): CSSProperties {
    switch (position) {
        case "top":
            return {
                left: "50%",
                top: `calc(var(--seat-h) + ${SEAT_FAN_DEPTH + DECL_TOP_AIR}px)`,
                transform: "translate(-50%, 0) scale(var(--decl-k, 1))",
                transformOrigin: "top center",
            }
        case "bottom":
            return {
                left: "50%",
                bottom: spectator ? `calc(var(--seat-h) + ${SEAT_FAN_DEPTH + DECL_TOP_AIR}px)` : "2px",
                transform: "translate(-50%, 0) scale(var(--decl-k, 1))",
                transformOrigin: "bottom center",
            }
        case "left":
            return {
                left: `calc(var(--seat-gutter) + var(--seat-w) + ${SEAT_FAN_DEPTH + DECL_FLANK_AIR}px)`,
                top: "var(--table-cy)",
                transform: "translate(0, -50%) scale(var(--decl-k, 1))",
                transformOrigin: "left center",
            }
        case "right":
            return {
                right: `calc(var(--seat-gutter) + var(--seat-w) + ${SEAT_FAN_DEPTH + DECL_FLANK_AIR}px)`,
                top: "var(--table-cy)",
                transform: "translate(0, -50%) scale(var(--decl-k, 1))",
                transformOrigin: "right center",
            }
    }
}

/** How far the felt's content stays off the screen edges: the rail on the
 *  left, the corner buttons on the right, plus the landscape cutout. */
export const LANDSCAPE_RAIL = `${LANDSCAPE_RAIL_W}px`
