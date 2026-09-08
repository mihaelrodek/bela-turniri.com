import type { BlokDealerSeat, BlokDealDirection } from "./types"

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
