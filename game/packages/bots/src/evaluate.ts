/* ──────────────────────────────────────────────────────────────────────────
   Pure scoring/judgment helpers shared by the bots (game/README.md §5). No
   RNG, no I/O — every function here is a plain function of cards/PlayerView
   so it can be unit-tested with hand-built PlayerViews.
   ────────────────────────────────────────────────────────────────────── */

import type { Card, PlayerView, Seat, Suit } from "@bela/engine"
import { cardPoints, cardRank, cardStrength, cardSuit, teamOf, trickWinner } from "@bela/engine"

/**
 * README §5 bidding heuristic: value of holding `hand` if `suit` becomes
 * trump. J 4, 9 3, A 1.5, 10 1, +0.5 per additional card of the suit.
 */
export function suitStrength(hand: readonly Card[], suit: Suit): number {
    let score = 0
    for (const card of hand) {
        if (cardSuit(card) !== suit) continue
        const rank = cardRank(card)
        if (rank === "J") score += 4
        else if (rank === "9") score += 3
        else if (rank === "A") score += 1.5
        else if (rank === "10") score += 1
        else score += 0.5
    }
    return score
}

/** The suit with the highest `suitStrength`; ties keep the first candidate. */
export function bestSuit(hand: readonly Card[], suits: readonly Suit[]): Suit {
    let best = suits[0] as Suit
    let bestScore = -Infinity
    for (const suit of suits) {
        const score = suitStrength(hand, suit)
        if (score > bestScore) {
            best = suit
            bestScore = score
        }
    }
    return best
}

/** How many cards of `suit` are in `hand`. */
export function suitLength(hand: readonly Card[], suit: Suit): number {
    let n = 0
    for (const card of hand) if (cardSuit(card) === suit) n++
    return n
}

/** Provisional winner of the trick as played so far, or null if it's empty. */
export function currentTrickWinner(view: PlayerView): Seat | null {
    if (view.trick.cards.length === 0) return null
    const trump = view.bidding.trump
    if (trump === null) return null
    return trickWinner(view.trick.cards, trump)
}

/** True when my partner (not me) currently holds the trick. */
export function isPartnerHoldingTrick(view: PlayerView): boolean {
    const seat = view.seat
    if (seat === null) return false
    const winner = currentTrickWinner(view)
    if (winner === null) return false
    return winner !== seat && teamOf(winner) === teamOf(seat)
}

/** True when this seat is about to play the trick's 4th (last) card. */
export function isLastToPlay(view: PlayerView): boolean {
    return view.trick.cards.length === 3
}

/** Would playing `card` right now make this seat the (provisional) winner? */
export function wouldWinTrick(view: PlayerView, card: Card): boolean {
    const seat = view.seat
    const trump = view.bidding.trump
    if (seat === null || trump === null) return false
    const cards = [...view.trick.cards, { seat, card }]
    return trickWinner(cards, trump) === seat
}

/** Highest-point card among `cards` (first occurrence wins ties). */
export function mostValuableCard(cards: readonly Card[], trump: Suit): Card {
    let best = cards[0] as Card
    let bestPoints = cardPoints(best, trump)
    for (let i = 1; i < cards.length; i++) {
        const card = cards[i] as Card
        const points = cardPoints(card, trump)
        if (points > bestPoints) {
            best = card
            bestPoints = points
        }
    }
    return best
}

/** Lowest-point card among `cards`; ties prefer a non-trump card. */
export function cheapestCard(cards: readonly Card[], trump: Suit): Card {
    let best = cards[0] as Card
    let bestPoints = cardPoints(best, trump)
    let bestIsTrump = cardSuit(best) === trump
    for (let i = 1; i < cards.length; i++) {
        const card = cards[i] as Card
        const points = cardPoints(card, trump)
        const isTrump = cardSuit(card) === trump
        if (points < bestPoints || (points === bestPoints && bestIsTrump && !isTrump)) {
            best = card
            bestPoints = points
            bestIsTrump = isTrump
        }
    }
    return best
}

/** "Weakest" card by trick-taking value: fewest points, then lowest strength. */
export function weakestCard(cards: readonly Card[], trump: Suit): Card {
    let best = cards[0] as Card
    let bestPoints = cardPoints(best, trump)
    let bestStrength = cardStrength(best, trump)
    for (let i = 1; i < cards.length; i++) {
        const card = cards[i] as Card
        const points = cardPoints(card, trump)
        const strength = cardStrength(card, trump)
        if (points < bestPoints || (points === bestPoints && strength < bestStrength)) {
            best = card
            bestPoints = points
            bestStrength = strength
        }
    }
    return best
}

/**
 * README §5 branch 3: the cheapest legal card that wins the trick right now,
 * or null when none does. Avoids spending trump J/9 on a poor trick (< 10
 * points accumulated) when a cheaper or non-trump winner is also available.
 */
export function cheapestWinningCard(view: PlayerView, legal: readonly Card[]): Card | null {
    const trump = view.bidding.trump
    if (trump === null) return null
    const winners = legal.filter((card) => wouldWinTrick(view, card))
    if (winners.length === 0) return null

    const trickValueSoFar = view.trick.cards.reduce(
        (sum, tc) => sum + cardPoints(tc.card, trump),
        0,
    )
    const isTopTrump = (card: Card): boolean =>
        cardSuit(card) === trump && (cardRank(card) === "J" || cardRank(card) === "9")
    const safeWinners = winners.filter((card) => !isTopTrump(card))
    const pool = trickValueSoFar < 10 && safeWinners.length > 0 ? safeWinners : winners
    return cheapestCard(pool, trump)
}

/**
 * README §5 branch 4: discard the cheapest legal card by points, preferring a
 * non-trump card and, among ties, a card from the shortest suit in `hand`.
 */
export function cheapestDiscard(hand: readonly Card[], legal: readonly Card[], trump: Suit): Card {
    const suitLen = new Map<Suit, number>()
    for (const card of hand) {
        const suit = cardSuit(card)
        suitLen.set(suit, (suitLen.get(suit) ?? 0) + 1)
    }
    const score = (card: Card): readonly [number, number, number] => [
        cardPoints(card, trump),
        cardSuit(card) === trump ? 1 : 0,
        suitLen.get(cardSuit(card)) ?? 0,
    ]
    let best = legal[0] as Card
    let bestScore = score(best)
    for (let i = 1; i < legal.length; i++) {
        const card = legal[i] as Card
        const s = score(card)
        const isBetter =
            s[0] < bestScore[0] ||
            (s[0] === bestScore[0] &&
                (s[1] < bestScore[1] || (s[1] === bestScore[1] && s[2] < bestScore[2])))
        if (isBetter) {
            best = card
            bestScore = s
        }
    }
    return best
}
