import type { Card, Declaration, Rank, Seat, Suit, Team, TrickCard } from "@bela/engine"
import { RANKS, SUITS, cardRank, cardSuit, makeCard } from "../util/cards"
import { teamOf } from "../util/seats"

/* ──────────────────────────────────────────────────────────────────────────
   Rules for the IN-BROWSER MOCK ONLY. Dev-only code: nothing outside
   `mock/` may import this file.

   `@bela/engine` is the authority on the rules and the server is the
   authority on a game; this is a deliberately small stand-in so the table can
   be developed and demoed before either exists (`/igra?mock=1`). It follows
   README §1 closely enough to produce a believable deal — legal moves, trick
   winners, declarations, štiglja, pass/fall — and it is NOT a second
   implementation anyone should trust: when the engine lands, the mock keeps
   using this and the real client keeps using the server.
   ────────────────────────────────────────────────────────────────────── */

/** Trump ranking: J > 9 > A > 10 > K > Q > 8 > 7 (README §1.3). */
const TRUMP_STRENGTH: Record<Rank, number> = { J: 7, "9": 6, A: 5, "10": 4, K: 3, Q: 2, "8": 1, "7": 0 }
/** Plain ranking: A > 10 > K > Q > J > 9 > 8 > 7. */
const PLAIN_STRENGTH: Record<Rank, number> = { A: 7, "10": 6, K: 5, Q: 4, J: 3, "9": 2, "8": 1, "7": 0 }

const TRUMP_POINTS: Record<Rank, number> = { J: 20, "9": 14, A: 11, "10": 10, K: 4, Q: 3, "8": 0, "7": 0 }
const PLAIN_POINTS: Record<Rank, number> = { A: 11, "10": 10, K: 4, Q: 3, J: 2, "9": 0, "8": 0, "7": 0 }

export function cardStrength(card: Card, trump: Suit): number {
    return cardSuit(card) === trump ? TRUMP_STRENGTH[cardRank(card)] : PLAIN_STRENGTH[cardRank(card)]
}

export function cardPoints(card: Card, trump: Suit): number {
    return cardSuit(card) === trump ? TRUMP_POINTS[cardRank(card)] : PLAIN_POINTS[cardRank(card)]
}

export function fullDeck(): Card[] {
    const deck: Card[] = []
    for (const suit of SUITS) for (const rank of RANKS) deck.push(makeCard(rank, suit))
    return deck
}

export function shuffle<T>(items: T[], rnd: () => number): T[] {
    const out = [...items]
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1))
        const tmp = out[i]
        out[i] = out[j]
        out[j] = tmp
    }
    return out
}

/** Highest trump if any was played, otherwise the highest card of the led suit. */
export function trickWinner(cards: TrickCard[], trump: Suit): Seat {
    const led = cardSuit(cards[0].card)
    const hasTrump = cards.some((c) => cardSuit(c.card) === trump)
    const relevant = cards.filter((c) => cardSuit(c.card) === (hasTrump ? trump : led))
    let best = relevant[0]
    for (const c of relevant) {
        if (cardStrength(c.card, trump) > cardStrength(best.card, trump)) best = c
    }
    return best.seat
}

export function trickPoints(cards: TrickCard[], trump: Suit): number {
    return cards.reduce((sum, c) => sum + cardPoints(c.card, trump), 0)
}

/**
 * README §1.5. `hand` is the player's remaining cards, `trick` what is on the
 * table so far (empty = this seat leads).
 */
export function legalMoves(hand: Card[], trick: TrickCard[], trump: Suit, seat: Seat): Card[] {
    if (trick.length === 0) return [...hand]

    const led = cardSuit(trick[0].card)
    const ofLed = hand.filter((c) => cardSuit(c) === led)
    const trumps = hand.filter((c) => cardSuit(c) === trump)
    const currentWinner = trickWinner(trick, trump)
    const bestTrumpDown = trick
        .filter((c) => cardSuit(c.card) === trump)
        .reduce<number>((max, c) => Math.max(max, cardStrength(c.card, trump)), -1)

    // 1. Holding the led suit means following it.
    if (ofLed.length > 0) {
        if (led !== trump) return ofLed
        // In trump you must go over the highest trump down, if you can.
        const higher = ofLed.filter((c) => cardStrength(c, trump) > bestTrumpDown)
        return higher.length > 0 ? higher : ofLed
    }

    // 2. Void in the led suit. Partner already holding the trick frees you.
    if (teamOf(currentWinner) === teamOf(seat) && currentWinner !== seat) return [...hand]

    // Otherwise trump if you hold one, over the best trump down when possible.
    if (trumps.length > 0) {
        const higher = trumps.filter((c) => cardStrength(c, trump) > bestTrumpDown)
        return higher.length > 0 ? higher : trumps
    }
    return [...hand]
}

const FOUR_POINTS: Partial<Record<Rank, Declaration["points"]>> = {
    J: 200,
    "9": 150,
    A: 100,
    "10": 100,
    K: 100,
    Q: 100,
}

/** Terca 20, kvarta 50, five-or-longer 100 (README §1.4). */
function sequencePoints(length: number): Declaration["points"] | null {
    if (length >= 5) return 100
    if (length === 4) return 50
    if (length === 3) return 20
    return null
}

/**
 * Four-of-a-kind plus the longest non-overlapping runs per suit, in natural
 * rank order. Bela is NOT here — it is scored separately and announced when
 * the first of the two cards is played (README §1.4).
 */
export function findDeclarations(hand: Card[]): Declaration[] {
    const out: Declaration[] = []

    for (const rank of RANKS) {
        const points = FOUR_POINTS[rank]
        if (!points) continue
        const cards = SUITS.map((s) => makeCard(rank, s)).filter((c) => hand.includes(c))
        if (cards.length === 4) out.push({ kind: "FOUR", cards, points })
    }

    for (const suit of SUITS) {
        const ranksHeld = RANKS.filter((r) => hand.includes(makeCard(r, suit)))
        let run: Rank[] = []
        const flush = () => {
            const points = sequencePoints(run.length)
            if (points) out.push({ kind: "SEQUENCE", cards: run.map((r) => makeCard(r, suit)), points })
            run = []
        }
        for (const rank of RANKS) {
            if (ranksHeld.includes(rank)) {
                run.push(rank)
            } else {
                flush()
            }
        }
        flush()
    }

    return out
}

/** Highest card of a declaration, by natural rank order. */
function topRankIndex(declaration: Declaration): number {
    return declaration.cards.reduce((max, c) => Math.max(max, RANKS.indexOf(cardRank(c))), -1)
}

/**
 * Which team defends its declarations. Bigger points win; equal points go to
 * the higher top card; still equal, to the seat nearer `next(dealer)` in turn
 * order — and "four of a kind" beats a 100-point run (README §1.4).
 */
export function declarationsScoringTeam(
    perSeat: Record<Seat, Declaration[]>,
    dealer: Seat,
): Team | null {
    let bestSeat: Seat | null = null
    let best: Declaration | null = null
    const order = [0, 1, 2, 3].map((i) => (((dealer + 1 + i) % 4) as Seat))

    for (const seat of order) {
        for (const declaration of perSeat[seat]) {
            if (
                best === null
                || declaration.points > best.points
                || (declaration.points === best.points && topRankIndex(declaration) > topRankIndex(best))
                || (declaration.points === best.points
                    && topRankIndex(declaration) === topRankIndex(best)
                    && declaration.kind === "FOUR" && best.kind === "SEQUENCE")
            ) {
                best = declaration
                bestSeat = seat
            }
        }
    }
    return bestSeat === null ? null : teamOf(bestSeat)
}

export function declarationTotal(declarations: Declaration[]): number {
    return declarations.reduce((sum, d) => sum + d.points, 0)
}
