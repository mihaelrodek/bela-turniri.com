/* Declarations (zvanja) — README §1.4.

   The engine detects declarations automatically from the finished 8-card hand:
     - four of a kind: J 200, 9 150, A/10/K/Q 100 (no fours of 7 or 8)
     - runs in NATURAL rank order 7 8 9 10 J Q K A: 3 → 20, 4 → 50, 5+ → 100
   Runs inside a suit never overlap: the maximal run is taken, so a run of 8
   counts once for 100. A card may belong to both a run and a four.

   Bela (K+Q of trump, 20) is NOT part of this list: it always scores for the
   team holding it and never takes part in the "strongest declaration" contest. */

import type { Card, Declaration, Rank, Seat, Suit, Team } from "./types"
import { RANKS, SUITS } from "./types"
import { cardRank, cardSuit, makeCard, rankIndex } from "./cards"
import { seatOrderFrom, teamOf } from "./seats"

const FOUR_POINTS: Partial<Record<Rank, 100 | 150 | 200>> = {
    J: 200,
    "9": 150,
    A: 100,
    "10": 100,
    K: 100,
    Q: 100,
}

export function findDeclarations(hand: readonly Card[]): Declaration[] {
    const held = new Set<string>(hand)
    const out: Declaration[] = []

    // Fours, walked in natural rank order for a stable result.
    for (const rank of RANKS) {
        const points = FOUR_POINTS[rank]
        if (points === undefined) continue
        const cards = SUITS.map((suit) => makeCard(rank, suit))
        if (cards.every((c) => held.has(c))) out.push({ kind: "FOUR", cards, points })
    }

    // Maximal runs, suit by suit in SUITS order, low to high inside a suit.
    for (const suit of SUITS) {
        const present: number[] = []
        for (let i = 0; i < RANKS.length; i++) {
            if (held.has(makeCard(RANKS[i] as Rank, suit))) present.push(i)
        }
        let start = 0
        while (start < present.length) {
            let end = start
            while (
                end + 1 < present.length &&
                (present[end + 1] as number) === (present[end] as number) + 1
            ) {
                end++
            }
            const length = end - start + 1
            if (length >= 3) {
                const points: 20 | 50 | 100 = length === 3 ? 20 : length === 4 ? 50 : 100
                const cards = present
                    .slice(start, end + 1)
                    .map((i) => makeCard(RANKS[i] as Rank, suit))
                out.push({ kind: "SEQUENCE", cards, points })
            }
            start = end + 1
        }
    }

    return out
}

/** Highest card of a declaration in NATURAL rank order. */
function topRank(declaration: Declaration): number {
    let best = -1
    for (const card of declaration.cards) {
        const i = rankIndex(cardRank(card))
        if (i > best) best = i
    }
    return best
}

/**
 * README §1.4: more points wins; on a tie the higher top card wins; a FOUR
 * beats a SEQUENCE of the same value (both 100). Returns > 0 when `a` is
 * stronger, < 0 when `b` is, 0 when they are indistinguishable (the caller
 * then falls back to the seat order tie-break).
 */
export function compareDeclarations(a: Declaration, b: Declaration): number {
    if (a.points !== b.points) return a.points - b.points
    if (a.kind !== b.kind) return a.kind === "FOUR" ? 1 : -1
    return topRank(a) - topRank(b)
}

/** K + Q of trump in the same hand (README §1.4). */
export function hasBela(hand: readonly Card[], trump: Suit): boolean {
    let king = false
    let queen = false
    for (const card of hand) {
        if (cardSuit(card) !== trump) continue
        const rank = cardRank(card)
        if (rank === "K") king = true
        else if (rank === "Q") queen = true
    }
    return king && queen
}

/**
 * Which team scores its declarations this deal: the team holding the single
 * strongest declaration. Ties that `compareDeclarations` cannot separate go to
 * the seat closest to next(dealer) in turn order. `null` when nobody declared.
 */
export function declarationsScoringTeam(
    perSeat: Record<Seat, Declaration[]>,
    dealer: Seat,
): Team | null {
    const first = ((dealer + 1) % 4) as Seat
    let bestSeat: Seat | null = null
    let best: Declaration | null = null

    for (const seat of [0, 1, 2, 3] as Seat[]) {
        for (const declaration of perSeat[seat]) {
            if (best === null || bestSeat === null) {
                best = declaration
                bestSeat = seat
                continue
            }
            const cmp = compareDeclarations(declaration, best)
            if (cmp > 0) {
                best = declaration
                bestSeat = seat
            } else if (cmp === 0 && seatOrderFrom(first, seat) < seatOrderFrom(first, bestSeat)) {
                best = declaration
                bestSeat = seat
            }
        }
    }

    return bestSeat === null ? null : teamOf(bestSeat)
}
