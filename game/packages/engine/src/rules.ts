/* Legal moves, legal bids, trick resolution — README §1.2 (bidding) and §1.5. */

import type { Card, GameState, LegalBids, Seat, Suit, TrickCard } from "./types"
import { SUITS, EngineError } from "./types"
import { cardPoints, cardStrength, cardSuit, sortHand } from "./cards"
import { partnerOf } from "./seats"

/**
 * Index of the winning card inside a completed or partial trick.
 * `cards` must be in play order, i.e. cards[0] is the leader's card.
 * Highest trump wins; otherwise the highest card of the led suit.
 */
export function winningCardIndex(cards: readonly Card[], trump: Suit): number {
    if (cards.length === 0) throw new EngineError("BAD_REQUEST", "Prazan štih nema pobjednika.")
    let bestIdx = 0
    let best = cards[0] as Card
    for (let i = 1; i < cards.length; i++) {
        const card = cards[i] as Card
        const cs = cardSuit(card)
        const bs = cardSuit(best)
        const wins =
            cs === bs
                ? cardStrength(card, trump) > cardStrength(best, trump)
                : cs === trump
        if (wins) {
            best = card
            bestIdx = i
        }
    }
    return bestIdx
}

export function trickWinner(cards: readonly TrickCard[], trump: Suit): Seat {
    const idx = winningCardIndex(
        cards.map((c) => c.card),
        trump,
    )
    return (cards[idx] as TrickCard).seat
}

/** Card points of a trick. Accepts raw cards or TrickCards. Excludes the +10 for the last trick. */
export function trickPoints(cards: readonly (Card | TrickCard)[], trump: Suit): number {
    let sum = 0
    for (const c of cards) sum += cardPoints(typeof c === "string" ? c : c.card, trump)
    return sum
}

/**
 * README §1.2.4: after three passes the dealer is forced to call ("mus"),
 * so `canPass` is false for them. Empty/false when it is not this seat's turn.
 */
export function legalBids(state: GameState, seat: Seat): LegalBids {
    if (state.phase !== "BIDDING" || state.bidding.turn !== seat) {
        return { canPass: false, suits: [] }
    }
    return { canPass: !isForcedBid(state, seat), suits: SUITS.slice() }
}

export function isForcedBid(state: GameState, seat: Seat): boolean {
    return seat === state.dealer && state.bidding.passes.length === 3
}

/**
 * README §1.5. Returns [] when it is not this seat's turn or we are not playing.
 * The result keeps the hand's (sorted) order.
 */
export function legalMoves(state: GameState, seat: Seat): Card[] {
    if (state.phase !== "PLAYING" || state.trick.turn !== seat) return []
    const trump = state.bidding.trump
    if (trump === null) return []

    const hand = state.hands[seat]
    const played = state.trick.cards
    if (played.length === 0) return sortHand(hand)

    const lead = cardSuit((played[0] as TrickCard).card)
    const winnerIdx = winningCardIndex(
        played.map((p) => p.card),
        trump,
    )
    const winning = played[winnerIdx] as TrickCard
    const winningCard = winning.card

    const ofLead = hand.filter((c) => cardSuit(c) === lead)

    // 1. Holding the led suit: must follow it.
    if (ofLead.length > 0) {
        if (lead !== trump) return ofLead
        // Trumps were led: must go over the current best trump if able.
        const higher = ofLead.filter(
            (c) => cardStrength(c, trump) > cardStrength(winningCard, trump),
        )
        return higher.length > 0 ? higher : ofLead
    }

    // 2. Void in the led suit.
    if (partnerOf(seat) === winning.seat) return hand.slice() // partner is winning → anything

    const trumps = hand.filter((c) => cardSuit(c) === trump)
    if (trumps.length === 0) return hand.slice() // no trumps → anything

    if (cardSuit(winningCard) === trump) {
        const higher = trumps.filter(
            (c) => cardStrength(c, trump) > cardStrength(winningCard, trump),
        )
        return higher.length > 0 ? higher : trumps
    }
    return trumps
}
