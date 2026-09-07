/* ──────────────────────────────────────────────────────────────────────────
   `tesko` — `srednje` plus a simple determinization search (game/README.md
   §5). We don't know the other three hands, so for each of N random deals of
   the unseen cards (consistent with `handSizes` and `played`) we play out
   just the CURRENT trick — every remaining seat decides with the heuristic
   bot — and average the card-point swing for our team. We pick the candidate
   card with the best average. Bounded: N=40 × ≤8 candidates × ≤3 remaining
   plays, all heuristic lookups — comfortably under 20ms.

   `legalMovesFor` below re-implements README §1.5 for a *hypothetical* hand
   during simulation; the real engine's `legalMoves` needs a full GameState we
   don't have here, only the exported card/seat primitives.
   ────────────────────────────────────────────────────────────────────── */

import type { Card, LegalBids, PlayerView, Seat, Suit, TrickCard } from "@bela/engine"
import {
    SEATS,
    cardStrength,
    cardSuit,
    fullDeck,
    nextSeat,
    partnerOf,
    teamOf,
    trickPoints,
    trickWinner,
} from "@bela/engine"
import type { BidChoice, Bot } from "./index"
import { heuristicBot } from "./heuristicBot"

const DETERMINIZATIONS = 40

function unseenCards(view: PlayerView): Card[] {
    const seen = new Set<Card>(view.hand)
    for (const card of view.played) seen.add(card)
    for (const tc of view.trick.cards) seen.add(tc.card)
    return fullDeck().filter((card) => !seen.has(card))
}

function shuffle(cards: readonly Card[], rng: () => number): Card[] {
    const out = cards.slice()
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1))
        const a = out[i] as Card
        const b = out[j] as Card
        out[i] = b
        out[j] = a
    }
    return out
}

/** One random-but-consistent guess at the other three hands. */
function determinizeHands(view: PlayerView, mySeat: Seat, rng: () => number): Record<Seat, Card[]> {
    const pool = shuffle(unseenCards(view), rng)
    const hands: Partial<Record<Seat, Card[]>> = {}
    let idx = 0
    for (const seat of SEATS) {
        if (seat === mySeat) {
            hands[seat] = view.hand.slice()
            continue
        }
        const n = view.handSizes[seat]
        hands[seat] = pool.slice(idx, idx + n)
        idx += n
    }
    return hands as Record<Seat, Card[]>
}

function winningIndex(cards: readonly TrickCard[], trump: Suit): number {
    let bestIdx = 0
    let best = (cards[0] as TrickCard).card
    for (let i = 1; i < cards.length; i++) {
        const card = (cards[i] as TrickCard).card
        const cs = cardSuit(card)
        const bs = cardSuit(best)
        const wins = cs === bs ? cardStrength(card, trump) > cardStrength(best, trump) : cs === trump
        if (wins) {
            best = card
            bestIdx = i
        }
    }
    return bestIdx
}

/** README §1.5, applied to a hypothetical hand mid-simulation. */
function legalMovesFor(
    hand: readonly Card[],
    trickCards: readonly TrickCard[],
    trump: Suit,
    seat: Seat,
): Card[] {
    if (trickCards.length === 0) return hand.slice()
    const lead = cardSuit((trickCards[0] as TrickCard).card)
    const winning = trickCards[winningIndex(trickCards, trump)] as TrickCard

    const ofLead = hand.filter((card) => cardSuit(card) === lead)
    if (ofLead.length > 0) {
        if (lead !== trump) return ofLead
        const higher = ofLead.filter((card) => cardStrength(card, trump) > cardStrength(winning.card, trump))
        return higher.length > 0 ? higher : ofLead
    }

    if (partnerOf(seat) === winning.seat) return hand.slice()

    const trumps = hand.filter((card) => cardSuit(card) === trump)
    if (trumps.length === 0) return hand.slice()
    if (cardSuit(winning.card) === trump) {
        const higher = trumps.filter((card) => cardStrength(card, trump) > cardStrength(winning.card, trump))
        return higher.length > 0 ? higher : trumps
    }
    return trumps
}

/** A minimal-but-valid PlayerView for a hypothetical seat mid-simulation; only
 *  the fields `heuristicBot.chooseCard` reads are meaningful. */
function buildSubView(base: PlayerView, seat: Seat, hand: Card[], trickCards: TrickCard[]): PlayerView {
    return {
        seat,
        phase: "PLAYING",
        dealNo: base.dealNo,
        dealer: base.dealer,
        hand,
        handSizes: base.handSizes,
        bidding: base.bidding,
        trick: { leader: base.trick.leader, turn: seat, cards: trickCards },
        tricksWon: base.tricksWon,
        lastTrick: base.lastTrick,
        declarations: {},
        declarationsRevealed: base.declarationsRevealed,
        belaDeclared: base.belaDeclared,
        dealScore: base.dealScore,
        score: base.score,
        history: base.history,
        winner: base.winner,
        turn: seat,
        legalMoves: [],
        legalBids: null,
        played: base.played,
    }
}

/** Complete the current trick (mine + the rest, heuristically) and return the
 *  resulting card-point swing for my team: +points if we win it, -points if not. */
function simulateTrickValue(
    base: PlayerView,
    mySeat: Seat,
    myCard: Card,
    hands: Record<Seat, Card[]>,
    trump: Suit,
    rng: () => number,
): number {
    const trickCards: TrickCard[] = [...base.trick.cards, { seat: mySeat, card: myCard }]
    const working: Record<Seat, Card[]> = {
        0: hands[0].slice(),
        1: hands[1].slice(),
        2: hands[2].slice(),
        3: hands[3].slice(),
    }
    working[mySeat] = working[mySeat].filter((card) => card !== myCard)

    let seat = nextSeat(mySeat)
    while (trickCards.length < 4) {
        const hand = working[seat]
        const legalForSeat = legalMovesFor(hand, trickCards, trump, seat)
        const subView = buildSubView(base, seat, hand, trickCards)
        const card = heuristicBot.chooseCard(subView, legalForSeat, rng)
        trickCards.push({ seat, card })
        working[seat] = hand.filter((c) => c !== card)
        seat = nextSeat(seat)
    }

    const winner = trickWinner(trickCards, trump)
    const points = trickPoints(trickCards, trump)
    return teamOf(winner) === teamOf(mySeat) ? points : -points
}

function chooseBid(view: PlayerView, legal: LegalBids, rng: () => number): BidChoice {
    return heuristicBot.chooseBid(view, legal, rng)
}

function chooseCard(view: PlayerView, legal: Card[], rng: () => number): Card {
    if (legal.length <= 1) return legal[0] as Card
    const trump = view.bidding.trump
    const seat = view.seat
    if (trump === null || seat === null) return heuristicBot.chooseCard(view, legal, rng)

    const totals = new Map<Card, number>()
    for (const card of legal) totals.set(card, 0)

    for (let i = 0; i < DETERMINIZATIONS; i++) {
        const hands = determinizeHands(view, seat, rng)
        for (const card of legal) {
            const value = simulateTrickValue(view, seat, card, hands, trump, rng)
            totals.set(card, (totals.get(card) as number) + value)
        }
    }

    let best = legal[0] as Card
    let bestAvg = -Infinity
    for (const card of legal) {
        const avg = (totals.get(card) as number) / DETERMINIZATIONS
        if (avg > bestAvg) {
            bestAvg = avg
            best = card
        }
    }
    return best
}

export const hardBot: Bot = {
    level: "tesko",
    chooseBid,
    chooseCard,
}
