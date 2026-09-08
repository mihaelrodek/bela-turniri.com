/* ──────────────────────────────────────────────────────────────────────────
   The heuristic bot — the one and only bot (game/README.md §5). Bidding:
   threshold 5.5 on `suitStrength`, dealer forced to call the best suit with
   no threshold.
   Play: priority list — (1) partner holds the trick and I'm last → the most
   valuable card that does NOT take it off him; (2) partner holds the trick,
   I'm not last → the cheapest such card; (3) I can win → cheapest winning card
   (see evaluate.ts for the trump J/9 guard); (4) otherwise discard the
   cheapest card, preferring non-trump and the shortest suit. Leading follows
   its own rule below.
   ────────────────────────────────────────────────────────────────────── */

import type { Card, LegalBids, PlayerView, Suit } from "@bela/engine"
import { SUITS, cardRank, cardSuit, makeCard } from "@bela/engine"
import type { BidChoice, Bot } from "./index"
import {
    bestSuit,
    cheapestCard,
    cheapestDiscard,
    cheapestWinningCard,
    isLastToPlay,
    isPartnerHoldingTrick,
    mostValuableCard,
    shouldDrawTrumps,
    shouldSpendAce,
    suitLength,
    suitStrength,
    trumpDrawCard,
    weakestCard,
    wouldWinTrick,
} from "./evaluate"

const BID_THRESHOLD = 5.5

function chooseBid(view: PlayerView, legal: LegalBids, _rng: () => number): BidChoice {
    const best = bestSuit(view.hand, legal.suits)
    if (!legal.canPass) return best // dealer forced (mus): best suit, no threshold
    return suitStrength(view.hand, best) >= BID_THRESHOLD ? best : "PASS"
}

/**
 * Opening a trick, in priority order:
 *  1. a trump, but only when drawing them has a point right now
 *     (`shouldDrawTrumps`: my side called, the opponents can still hold one,
 *     and we have winners to cash afterwards) — the top trump if I hold it,
 *     otherwise my cheapest (`trumpDrawCard`);
 *  2. an ace of a non-trump suit, but only one worth spending
 *     (`shouldSpendAce`) — the 10 behind it, or it will not survive anyway;
 *  3. the lowest card of my shortest non-trump suit, never burning an ace I
 *     just decided to keep;
 *  4. the weakest card I have.
 */
function leadCard(view: PlayerView, legal: readonly Card[], trump: Suit): Card {
    if (shouldDrawTrumps(view)) {
        const draw = trumpDrawCard(view, legal)
        if (draw !== null) return draw
    }

    const aces = legal.filter((card) => cardRank(card) === "A" && cardSuit(card) !== trump)
    const worthSpending = aces.filter((card) => shouldSpendAce(view, cardSuit(card)))
    if (worthSpending.length > 0) {
        // Prefer an ace with its own 10 behind it over one we are only cashing
        // because it is about to be trumped.
        const backedByTen = worthSpending.find((card) =>
            view.hand.includes(makeCard("10", cardSuit(card))),
        )
        return backedByTen ?? (worthSpending[0] as Card)
    }

    // Aces we chose to keep must not leak back in as "the lowest card of my
    // shortest suit" when that suit happens to be a singleton ace.
    const kept = new Set<Card>(aces)
    const pool = legal.filter((card) => !kept.has(card))
    const source: readonly Card[] = pool.length > 0 ? pool : legal

    const nonTrumpLens = SUITS.filter((suit) => suit !== trump)
        .map((suit) => ({
            suit,
            len: suitLength(view.hand, suit),
            candidates: source.filter((card) => cardSuit(card) === suit),
        }))
        .filter((entry) => entry.candidates.length > 0)
        .sort((a, b) => a.len - b.len)
    const shortest = nonTrumpLens[0]
    if (shortest !== undefined) return weakestCard(shortest.candidates, trump)

    return weakestCard(source, trump)
}

function chooseCard(view: PlayerView, legal: Card[], _rng: () => number): Card {
    if (legal.length === 1) return legal[0] as Card
    const trump = view.bidding.trump
    if (trump === null) return legal[0] as Card

    if (view.trick.cards.length === 0) return leadCard(view, legal, trump)

    if (isPartnerHoldingTrick(view)) {
        // Never take a trick my own partner already holds: the points land on
        // our side either way, so beating him only burns a card that would
        // have won a LATER trick (`legalMoves` allows it — the judgement is
        // ours). The filter is dropped only when the rules leave no choice,
        // e.g. partner led trump and I am forced to go over him.
        const notBeating = legal.filter((card) => !wouldWinTrick(view, card))
        const pool = notBeating.length > 0 ? notBeating : legal
        return isLastToPlay(view) ? mostValuableCard(pool, trump) : cheapestCard(pool, trump)
    }

    const winner = cheapestWinningCard(view, legal)
    if (winner !== null) return winner

    return cheapestDiscard(view.hand, legal, trump)
}

export const heuristicBot: Bot = {
    chooseBid,
    chooseCard,
}
