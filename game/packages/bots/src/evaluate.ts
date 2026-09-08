/* ──────────────────────────────────────────────────────────────────────────
   Pure scoring/judgment helpers shared by the bots (game/README.md §5). No
   RNG, no I/O — every function here is a plain function of cards/PlayerView
   so it can be unit-tested with hand-built PlayerViews.
   ────────────────────────────────────────────────────────────────────── */

import type { Card, Declaration, PlayerView, Seat, Suit, TrickCard, WonTrick } from "@bela/engine"
import {
    RANKS,
    SEATS,
    cardPoints,
    cardRank,
    cardStrength,
    cardSuit,
    makeCard,
    partnerOf,
    teamOf,
    trickWinner,
} from "@bela/engine"

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

/** "Strongest" card by rank inside its own suit; only meaningful for cards of
 *  ONE suit (`cardStrength` is not comparable across suits). */
export function strongestCard(cards: readonly Card[], trump: Suit): Card {
    let best = cards[0] as Card
    let bestStrength = cardStrength(best, trump)
    for (let i = 1; i < cards.length; i++) {
        const card = cards[i] as Card
        const strength = cardStrength(card, trump)
        if (strength > bestStrength) {
            best = card
            bestStrength = strength
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

/* ──────────────────────────────────────────────────────────────────────────
   Counting and inference helpers. Everything below reads ONLY the PlayerView,
   i.e. public information: my own hand, the cards on the table, the completed
   tricks (`played`, plus the seat-attributed `trickHistory`/`lastTrick`) and
   the declarations, which are public once the trump is set (README §1.4).
   ────────────────────────────────────────────────────────────────────── */

/**
 * The completed tricks this seat may look at, oldest first. `trickHistory` is
 * the full seat-attributed record when the room allows reviewing tricks;
 * `null`/`undefined` means it may not, and then the only attributed trick left
 * is the last one (`played` is a flat card list with no seats).
 */
function reviewableTricks(view: PlayerView): readonly WonTrick[] {
    const history = view.trickHistory
    if (history !== undefined && history !== null) return history
    return view.lastTrick === null ? [] : [view.lastTrick]
}

/**
 * How many cards of `suit` are still held by the other three players: the 8 of
 * the suit minus the ones I hold and the ones already face up (completed tricks
 * plus the trick in progress).
 */
export function outstandingInSuit(view: PlayerView, suit: Suit): number {
    let accounted = 0
    for (const card of view.hand) if (cardSuit(card) === suit) accounted++
    for (const card of view.played) if (cardSuit(card) === suit) accounted++
    for (const tc of view.trick.cards) if (cardSuit(tc.card) === suit) accounted++
    return 8 - accounted
}

/**
 * Every card of `suit` that is neither in my hand nor face up — i.e. the ones
 * the other three seats can still be holding. `outstandingInSuit` is its size.
 */
export function outstandingCardsInSuit(view: PlayerView, suit: Suit): Card[] {
    const seen = new Set<Card>(view.hand)
    for (const card of view.played) seen.add(card)
    for (const tc of view.trick.cards) seen.add(tc.card)
    return RANKS.map((rank) => makeCard(rank, suit)).filter((card) => !seen.has(card))
}

/**
 * True when nothing still in play beats `card` inside its own suit — a
 * "master" card. For a plain suit that means it wins the trick whenever the
 * suit is led and nobody ruffs; for the trump suit it wins outright.
 */
export function isMasterCard(view: PlayerView, card: Card): boolean {
    const trump = view.bidding.trump
    if (trump === null) return false
    const mine = cardStrength(card, trump)
    return outstandingCardsInSuit(view, cardSuit(card)).every(
        (other) => cardStrength(other, trump) < mine,
    )
}

/**
 * Does this hand still hold anything that will actually take a trick once the
 * opponents are out of trumps — an ace, a 10 whose ace is gone, a top trump?
 * This is the "and then what?" test for drawing trumps: stripping the table
 * with nothing to cash afterwards is the deal the user described as
 * "ide do kraja … ali ništa ne napravi s tim".
 */
export function hasWinnersToCash(view: PlayerView): boolean {
    return view.hand.some((card) => isMasterCard(view, card))
}

/**
 * True when `seat` has provably shown void in `suit` — followed a lead of
 * `suit` with something else — in the trick in progress or in any trick this
 * seat can review. Never guesses: `false` means "not proven", not "he still
 * holds the suit".
 */
export function seatShownVoidIn(view: PlayerView, seat: Seat, suit: Suit): boolean {
    const showsVoid = (plays: readonly TrickCard[]): boolean => {
        const led = plays[0]
        if (led === undefined || cardSuit(led.card) !== suit) return false
        return plays.some((p) => p.seat === seat && cardSuit(p.card) !== suit)
    }

    if (showsVoid(view.trick.cards)) return true
    for (const trick of reviewableTricks(view)) if (showsVoid(trick.plays)) return true
    return false
}

/**
 * True when an OPPONENT has provably shown void in `suit`. Same caveat as
 * `seatShownVoidIn`: "not proven" is the default.
 */
export function opponentShownVoidIn(view: PlayerView, suit: Suit): boolean {
    const seat = view.seat
    if (seat === null) return false
    return SEATS.some((s) => teamOf(s) !== teamOf(seat) && seatShownVoidIn(view, s, suit))
}

/**
 * Fault (2): should I spend the ace of `suit` now, or keep it back?
 *
 * A bare ace led into a suit nobody has touched yet is 11 points handed to
 * whoever happens to be void and trumps it; kept back, the same ace can still
 * fill a trick my partner wins. So we only spend it when it is actually doing
 * work:
 *   (a) I also hold the 10 of that suit — the 10 then rides home behind the
 *       ace instead of being caught later (21 points, not 11 gambled);
 *   (b) it cannot be trumped by an OPPONENT any more — no trump outside my
 *       hand at all, or none that an opponent can still be holding
 *       (`trumpOutlook().opponentMax`). My partner ruffing my ace costs us
 *       nothing, so a trump left only on our side is not a reason to hold back;
 *   (c) it is unlikely to survive to be cashed later:
 *       - an opponent has already shown void in the suit, so there is no
 *         quieter round of it coming;
 *       - the suit is nearly exhausted (≤ 2 cards of it outside my hand), same
 *         conclusion from the count instead of from a seen discard;
 *       - the deal is nearly over (≤ 2 cards in hand) and there is no later
 *         trick to cash it in.
 * The trump ace is not covered here: it is never "unsupported" — nothing can
 * trump it.
 */
export function shouldSpendAce(view: PlayerView, suit: Suit): boolean {
    const trump = view.bidding.trump
    if (trump === null || suit === trump) return true
    if (view.hand.includes(makeCard("10", suit))) return true
    if (view.hand.length <= 2) return true
    if (trumpOutlook(view).opponentMax === 0) return true
    if (opponentShownVoidIn(view, suit)) return true
    return outstandingInSuit(view, suit) <= 2
}

/* ──────────────────────────────────────────────────────────────────────────
   Fault (3): drawing trumps for a partner who called.
   ────────────────────────────────────────────────────────────────────── */

/** True when the trump was called by my partner (not by me, not by an opponent). */
export function partnerCalledTrump(view: PlayerView): boolean {
    const seat = view.seat
    const caller = view.bidding.caller
    if (seat === null || caller === null) return false
    return caller === partnerOf(seat)
}

/**
 * True when the call was a forced one ("mus", README §1.2.4) rather than a
 * choice. The view carries no `forced` flag, but the sequence is fixed:
 * bidding opens at next(dealer) and the dealer speaks last, so three recorded
 * passes with the dealer as the caller can only be the forced call — nobody
 * else can ever be on turn after three passes. `game.ts` keeps `bidding.passes`
 * when it applies the BID, so this stays readable for the whole deal.
 */
export function callerWasForced(view: PlayerView): boolean {
    const caller = view.bidding.caller
    return caller !== null && caller === view.dealer && view.bidding.passes.length === 3
}

/**
 * Does `declaration` prove that its owner does NOT hold the jack of `trump`?
 *
 * README §1.4: sequences use the NATURAL order 7 8 9 10 J Q K A and the engine
 * always takes the MAXIMAL run in a suit. That maximality is the whole
 * inference: a trump run cannot skip over the jack, so
 *   - a trump run ending at the 10 (…-9-10) would have continued into the jack
 *     had its owner held it → he does not;
 *   - a trump run starting at the queen (Q-K-…) would have started one card
 *     lower for the same reason → he does not.
 * Any other run says nothing (7-8-9 stops two below the jack, a run containing
 * the jack obviously disproves it), and runs in other suits say nothing at all.
 */
function sequenceDeniesTrumpJack(declaration: Declaration, trump: Suit): boolean {
    if (declaration.kind !== "SEQUENCE") return false
    const cards = declaration.cards
    const low = cards[0]
    const high = cards[cards.length - 1]
    if (low === undefined || high === undefined) return false
    if (cardSuit(low) !== trump) return false
    // `cards` is ascending in natural rank order (engine contract).
    const jack = RANKS.indexOf("J")
    const lowIdx = RANKS.indexOf(cardRank(low))
    const highIdx = RANKS.indexOf(cardRank(high))
    if (lowIdx <= jack && jack <= highIdx) return false // the run contains the jack
    return highIdx === jack - 1 || lowIdx === jack + 1
}

/** Did `seat` declare four jacks (which means he holds the trump jack too)? */
function declaredFourJacks(declarations: readonly Declaration[]): boolean {
    return declarations.some(
        (d) => d.kind === "FOUR" && d.cards.every((card) => cardRank(card) === "J"),
    )
}

/**
 * True when the revealed declarations PROVE that `seat` has no trump jack.
 * "Not proven" (false) is the default: no declarations, unrevealed
 * declarations, or declarations that simply do not touch the jack.
 */
export function seatProvablyLacksTrumpJack(view: PlayerView, seat: Seat): boolean {
    const trump = view.bidding.trump
    if (trump === null || !view.declarationsRevealed) return false

    const own = view.declarations[seat] ?? []
    if (declaredFourJacks(own)) return false // he holds all four, trump jack included

    for (const [key, list] of Object.entries(view.declarations)) {
        const other = Number(key) as Seat
        if (other !== seat && declaredFourJacks(list ?? [])) return true
    }

    return own.some((d) => sequenceDeniesTrumpJack(d, trump))
}

/**
 * Fault (3), REASON half: my partner called the trump, so he almost certainly
 * called on strength (the jack) — that is a reason to consider drawing for
 * him. It is NOT on its own an instruction to lead trump; `shouldDrawTrumps`
 * adds the counting guards. Exceptions, both spelled out by the rules:
 *   - the call was a mus (README §1.2.4): the dealer had to name something, it
 *     proves no strength at all;
 *   - his declarations prove he has no trump jack (see
 *     `seatProvablyLacksTrumpJack`) AND I do not hold it either — then nobody
 *     on our side controls the suit and drawing just feeds the opponents.
 */
export function shouldDrawTrumpsForPartner(view: PlayerView): boolean {
    const seat = view.seat
    const trump = view.bidding.trump
    if (seat === null || trump === null) return false
    if (!partnerCalledTrump(view)) return false
    if (callerWasForced(view)) return false

    const iHoldTheJack = view.hand.includes(makeCard("J", trump))
    if (iHoldTheJack) return true
    return !seatProvablyLacksTrumpJack(view, partnerOf(seat))
}

/** How the trump suit is distributed among the seats I cannot see. */
export interface TrumpOutlook {
    /** Trumps still held by the other three seats together. */
    readonly outstanding: number
    /**
     * Hard upper bound on how many of those the OPPONENTS can hold: 0 means
     * they are provably stripped (no trump left at all, or every opponent has
     * shown void in it / has no cards). Drawing past this point only pulls my
     * own partner's trumps out.
     */
    readonly opponentMax: number
    /**
     * The share of `outstanding` the opponents are expected to hold, splitting
     * it by remaining hand size across the seats that can still hold a trump.
     * A soft stop for the case the bound above cannot prove — with `trickReview`
     * off a bot sees seat attribution only for the trick in progress and the
     * last completed one, so voids are usually NOT provable and the count is
     * all we have.
     */
    readonly opponentExpected: number
}

const EMPTY_OUTLOOK: TrumpOutlook = { outstanding: 0, opponentMax: 0, opponentExpected: 0 }

export function trumpOutlook(view: PlayerView): TrumpOutlook {
    const seat = view.seat
    const trump = view.bidding.trump
    if (seat === null || trump === null) return EMPTY_OUTLOOK
    const outstanding = outstandingInSuit(view, trump)
    if (outstanding <= 0) return EMPTY_OUTLOOK

    let opponentCards = 0
    let partnerCards = 0
    for (const other of SEATS) {
        if (other === seat) continue
        // A seat that has shown void in trump can hold none of them; a seat
        // with no cards left obviously cannot either.
        const capacity = seatShownVoidIn(view, other, trump) ? 0 : view.handSizes[other]
        if (teamOf(other) === teamOf(seat)) partnerCards += capacity
        else opponentCards += capacity
    }

    const total = opponentCards + partnerCards
    return {
        outstanding,
        opponentMax: Math.min(outstanding, opponentCards),
        opponentExpected: total === 0 ? 0 : Math.min(outstanding, (outstanding * opponentCards) / total),
    }
}

/**
 * Below one expected opponent trump there is nothing left to strip: another
 * trump lead would only pull my own partner's trumps out.
 */
const MIN_OPPONENT_TRUMPS = 1

/**
 * Fault (3), reworked 2026-09-08 — should I OPEN a trick with a trump?
 *
 * Drawing trumps has exactly one purpose: strip the opponents so our own
 * winners can be cashed without being ruffed. So every one of these must hold,
 * and each of them is one of the ways the previous, unbounded version of this
 * rule went wrong:
 *   1. my side called the trump. The calling team promised the points and has
 *      to protect them; the defending team gains nothing by clearing the way
 *      for the caller's long suit;
 *   2. I actually hold a trump (otherwise there is nothing to lead);
 *   3. either I hold the top trump still in play — then the lead is a
 *      guaranteed trick, not a gamble — or my PARTNER called on strength and
 *      the jack is (as far as the declarations show) on our side
 *      (`shouldDrawTrumpsForPartner`). Leading a small trump with neither is
 *      just feeding the opponents' jack;
 *   4. the opponents can still HAVE a trump (`opponentMax > 0`), and enough of
 *      the outstanding ones are likely theirs rather than my partner's
 *      (`opponentExpected >= 1`). This is the stop condition the old rule
 *      lacked: it led trump on every single lead for the whole deal;
 *   5. our side has something to cash afterwards (`hasWinnersToCash`). Note
 *      that (3) makes this automatic in the top-trump case — a master trump is
 *      itself a winner.
 *
 * Only called when this seat is on lead; mid-trick play never routes here.
 */
export function shouldDrawTrumps(view: PlayerView): boolean {
    const seat = view.seat
    const trump = view.bidding.trump
    const caller = view.bidding.caller
    if (seat === null || trump === null || caller === null) return false
    if (teamOf(caller) !== teamOf(seat)) return false

    const myTrumps = view.hand.filter((card) => cardSuit(card) === trump)
    if (myTrumps.length === 0) return false

    const holdsTopTrump = myTrumps.some((card) => isMasterCard(view, card))
    if (!holdsTopTrump && !shouldDrawTrumpsForPartner(view)) return false

    const outlook = trumpOutlook(view)
    if (outlook.opponentMax <= 0) return false
    if (outlook.opponentExpected < MIN_OPPONENT_TRUMPS) return false

    return hasWinnersToCash(view)
}

/**
 * Which trump to draw with, given `shouldDrawTrumps` said yes: the top trump
 * when I hold it (a certain trick), otherwise my cheapest one — in the support
 * case the partner holds the high trumps and there is no point forcing my own
 * 10/A under his jack. Returns null when `legal` holds no trump at all.
 */
export function trumpDrawCard(view: PlayerView, legal: readonly Card[]): Card | null {
    const trump = view.bidding.trump
    if (trump === null) return null
    const trumps = legal.filter((card) => cardSuit(card) === trump)
    if (trumps.length === 0) return null
    const masters = trumps.filter((card) => isMasterCard(view, card))
    return masters.length > 0 ? strongestCard(masters, trump) : weakestCard(trumps, trump)
}
