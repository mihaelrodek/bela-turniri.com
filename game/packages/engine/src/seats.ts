/* Seats and teams — README §1.1.
   Seats 0..3, turn order next(seat) = (seat + 1) % 4.
   Teams: 0 and 2 → "A", 1 and 3 → "B". */

import type { Seat, Team } from "./types"

/** Coerce any integer to a Seat by wrapping into 0..3. */
export function seatFrom(n: number): Seat {
    return (((n % 4) + 4) % 4) as Seat
}

export function teamOf(seat: Seat): Team {
    return seat === 0 || seat === 2 ? "A" : "B"
}

export function nextSeat(seat: Seat): Seat {
    return seatFrom(seat + 1)
}

export function partnerOf(seat: Seat): Seat {
    return seatFrom(seat + 2)
}

export function opponentTeam(team: Team): Team {
    return team === "A" ? "B" : "A"
}

/**
 * Distance of `seat` from `from` in turn order (0 = `from` itself, 3 = last).
 * Used for the "closer to next(dealer) wins" declaration tie-break (README §1.4).
 */
export function seatOrderFrom(from: Seat, seat: Seat): number {
    return ((seat - from + 4) % 4) as number
}
