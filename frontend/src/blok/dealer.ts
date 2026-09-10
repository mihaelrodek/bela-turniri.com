import type { BlokDealerSeat, BlokDealDirection, BlokNewGameDealer, BlokSide } from "./types"

/* Seat order for each "smjer kartanja", read from the scorekeeper's own seat
   at the bottom of the drawn table: dealing to the RIGHT hands over to the
   right-hand opponent first, then the partner, then the left-hand opponent.
   (On screen that traces counter-clockwise — which is exactly why the setting
   is named after the direction people say, not after the rotation.) */
const RIGHT: readonly BlokDealerSeat[] = ["self", "rightOpponent", "partner", "leftOpponent"]
const LEFT: readonly BlokDealerSeat[] = ["self", "leftOpponent", "partner", "rightOpponent"]

export const DEALER_SEATS: readonly BlokDealerSeat[] = ["self", "rightOpponent", "partner", "leftOpponent"]

/** Dealer for a zero-based deal offset from the selected first dealer. */
export function dealerAt(first: BlokDealerSeat, direction: BlokDealDirection, offset: number): BlokDealerSeat {
    const order = direction === "left" ? LEFT : RIGHT
    const start = order.indexOf(first)
    const normalizedOffset = Math.max(0, Math.floor(offset))
    return order[(start + normalizedOffset) % order.length]
}

/** Reconstruct the stored first dealer when the user corrects who deals at a
 *  later point. This keeps the whole sequence derived from one stable setup. */
export function firstDealerFor(
    current: BlokDealerSeat,
    direction: BlokDealDirection,
    offset: number,
): BlokDealerSeat {
    const order = direction === "left" ? LEFT : RIGHT
    const currentIndex = order.indexOf(current)
    const normalizedOffset = Math.max(0, Math.floor(offset)) % order.length
    return order[(currentIndex - normalizedOffset + order.length) % order.length]
}

/** Which pair a seat belongs to, from the scorekeeper's chair. */
export function sideOfDealerSeat(seat: BlokDealerSeat): BlokSide {
    return seat === "self" || seat === "partner" ? "us" : "them"
}

/**
 * Who deals the FIRST deal of the next game (BLOK.md §3.3.4).
 *
 * `from` is where the rotation had got to — the seat that would have dealt the
 * finished game's next deal. Under `"next"` that IS the answer. Under
 * `"winner"` the rotation keeps stepping the same way until it reaches a seat
 * of the winning pair, so the losers are skipped rather than the direction
 * reversed: dealing left with the win on our side, the left-hand opponent is
 * passed over and the partner deals.
 *
 * `winner` null (nobody won it, or the game was abandoned) falls back to
 * `"next"`: there is no winning pair to step towards, and inventing one would
 * move the deal on the strength of a game that never finished.
 */
export function nextGameDealer(
    from: BlokDealerSeat,
    direction: BlokDealDirection,
    mode: BlokNewGameDealer,
    winner: BlokSide | null,
): BlokDealerSeat {
    if (mode !== "winner" || winner === null) return from
    for (let step = 0; step < DEALER_SEATS.length; step++) {
        const seat = dealerAt(from, direction, step)
        if (sideOfDealerSeat(seat) === winner) return seat
    }
    return from
}
