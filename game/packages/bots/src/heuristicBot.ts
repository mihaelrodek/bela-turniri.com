/* ──────────────────────────────────────────────────────────────────────────
   `srednje` — the heuristic bot (game/README.md §5). Bidding: threshold 5.5
   on `suitStrength`, dealer forced to call the best suit with no threshold.
   Play: priority list — (1) partner holds the trick and I'm last → most
   valuable legal card; (2) partner holds the trick, I'm not last → cheapest
   legal card; (3) I can win → cheapest winning card (see evaluate.ts for the
   trump J/9 guard); (4) otherwise discard the cheapest card, preferring
   non-trump and the shortest suit. Leading follows its own rule below.
   ────────────────────────────────────────────────────────────────────── */

import type { Card, LegalBids, PlayerView, Seat, Suit } from "@bela/engine"
import { SUITS, cardRank, cardSuit, makeCard, teamOf } from "@bela/engine"
import type { BidChoice, Bot } from "./index"
import {
    bestSuit,
    cheapestCard,
    cheapestDiscard,
    cheapestWinningCard,
    isLastToPlay,
    isPartnerHoldingTrick,
    mostValuableCard,
    suitLength,
    suitStrength,
    weakestCard,
} from "./evaluate"

const BID_THRESHOLD = 5.5

function chooseBid(view: PlayerView, legal: LegalBids, _rng: () => number): BidChoice {
    const best = bestSuit(view.hand, legal.suits)
    if (!legal.canPass) return best // dealer forced (mus): best suit, no threshold
    return suitStrength(view.hand, best) >= BID_THRESHOLD ? best : "PASS"
}

/**
 * Opening a trick: trump J if my team called and I hold it (draw trumps);
 * else an ace of a non-trump suit; else the lowest card of my shortest
 * non-trump suit; else the weakest card I have.
 */
function leadCard(view: PlayerView, legal: readonly Card[], trump: Suit): Card {
    const seat = view.seat as Seat
    const caller = view.bidding.caller
    if (caller !== null && teamOf(caller) === teamOf(seat)) {
        const trumpJack = makeCard("J", trump)
        if (legal.includes(trumpJack)) return trumpJack
    }

    const aces = legal.filter((card) => cardRank(card) === "A" && cardSuit(card) !== trump)
    if (aces.length > 0) return aces[0] as Card

    const nonTrumpLens = SUITS.filter((suit) => suit !== trump)
        .map((suit) => ({ suit, len: suitLength(view.hand, suit) }))
        .filter((entry) => entry.len > 0)
        .sort((a, b) => a.len - b.len)
    if (nonTrumpLens.length > 0) {
        const shortest = (nonTrumpLens[0] as { suit: Suit; len: number }).suit
        const candidates = legal.filter((card) => cardSuit(card) === shortest)
        return weakestCard(candidates, trump)
    }

    return weakestCard(legal, trump)
}

function chooseCard(view: PlayerView, legal: Card[], _rng: () => number): Card {
    if (legal.length === 1) return legal[0] as Card
    const trump = view.bidding.trump
    if (trump === null) return legal[0] as Card

    if (view.trick.cards.length === 0) return leadCard(view, legal, trump)

    if (isPartnerHoldingTrick(view)) {
        return isLastToPlay(view) ? mostValuableCard(legal, trump) : cheapestCard(legal, trump)
    }

    const winner = cheapestWinningCard(view, legal)
    if (winner !== null) return winner

    return cheapestDiscard(view.hand, legal, trump)
}

export const heuristicBot: Bot = {
    level: "srednje",
    chooseBid,
    chooseCard,
}
