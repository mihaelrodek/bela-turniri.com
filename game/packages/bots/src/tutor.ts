/* ──────────────────────────────────────────────────────────────────────────
   Tutor — the pure half of "Nauči kartati belu" (2026-09-29, owner request).

   The tutorial in `frontend/src/game/learn` runs ENTIRELY in the browser: no
   room, no socket, no karma, no stats. Everything it needs to decide lives
   here, as plain functions over the engine, so it can be tested with vitest
   (the frontend has no test runner):

     • the PRACTICE GAME driver — `newPracticeGame`, `botAction`, and the
       learner's own actions go through the engine's `reduce` unchanged, so
       the practice deal is a real deal with the real legal-move rules;
     • the COACH — `hintForPlay` / `hintForBid` ask the one heuristic bot what
       it would do from the learner's own redacted view and attach a REASON
       CATEGORY. The category is derived from simple, checkable facts about
       the view and the chosen card (is the trick empty, does the card win,
       who holds the trick, how many points is it). It never claims to know
       WHY the bot chose the card — BOT.md has dozens of rules and this does
       not re-derive them; it only describes what the chosen card DOES;
     • `whyIllegal` — which README §1.5 obligation a tapped card breaks;
     • `scenarioState` / `forcedBidState` — hand-built positions for the
       lessons, so their "which cards may you play?" tasks are answered by
       the engine's own `legalMoves` / `legalBids`, not by copied rules.

   Nothing here changes a bot decision, so `BOT_VERSION` does not move.
   ────────────────────────────────────────────────────────────────────── */

import type { Card, GameAction, GameState, PlayerView, Seat, Suit, TrickCard } from "@bela/engine"
import {
    QUICK_TARGET,
    cardPoints,
    cardRank,
    cardStrength,
    cardSuit,
    legalBids,
    legalMoves,
    newGame,
    partnerOf,
    trickWinner,
    viewFor,
} from "@bela/engine"
import type { TargetScore } from "@bela/engine"
import { heuristicBot } from "./heuristicBot"

/* ───────────────────────────── practice game ───────────────────────────── */

/** The learner always sits on seat 0; seats 1–3 are bots, seat 2 the partner. */
export const LEARNER_SEAT: Seat = 0

/**
 * A fresh practice game. It is played as "Brza 163" — the engine's own quick
 * discipline: to 163, or whoever leads after the third deal (README §1.7) —
 * so a first game is over in a few minutes and still ends by a real rule.
 */
export function newPracticeGame(seed: string): GameState {
    return newGame({ targetScore: QUICK_TARGET as TargetScore, seed })
}

/** The seat that has to act now, or null when nobody does — including the
 *  `DECLARING` window, which is the table's clock and nobody's turn. */
export function seatToAct(state: GameState): Seat | null {
    if (state.phase === "BIDDING") return state.bidding.turn
    if (state.phase === "PLAYING") return state.trick.turn
    return null
}

/** What a bot sees: its own redacted view plus the public trick record, the
 *  same thing the game server hands it (README §1.8, `recallTricks`). */
export function botView(state: GameState, seat: Seat): PlayerView {
    return viewFor(state, seat, { recallTricks: true })
}

/**
 * The move of whichever BOT is on turn, or null when it is the learner's turn
 * or nobody's. The action is not applied — the caller passes it to `reduce`.
 *
 * In the `DECLARING` window (README §1.4) it is the table's own
 * `FINISH_DECLARING`: the practice game has no opt-out prompt, so the window
 * closes at once with everybody — the learner included — declaring.
 */
export function botAction(state: GameState, rng: () => number): GameAction | null {
    if (state.phase === "DECLARING") return { type: "FINISH_DECLARING" }
    const seat = seatToAct(state)
    if (seat === null || seat === LEARNER_SEAT) return null
    const view = botView(state, seat)
    if (state.phase === "BIDDING") {
        const choice = heuristicBot.chooseBid(view, legalBids(state, seat), rng)
        return choice === "PASS" ? { type: "PASS", seat } : { type: "BID", seat, trump: choice }
    }
    const legal = legalMoves(state, seat)
    if (legal.length === 0) return null
    return { type: "PLAY", seat, card: heuristicBot.chooseCard(view, legal, rng) }
}

/* ───────────────────────────────── coach ───────────────────────────────── */

/**
 * What the suggested card DOES. Every member is decided by a check written
 * out in `hintForPlay`; none of them is a guess at the bot's motive.
 */
export type PlayHintReason =
    /** The rules leave exactly one card. */
    | "onlyCard"
    /** Opening the trick with a trump. */
    | "leadTrump"
    /** Opening the trick with a plain-suit ace. */
    | "leadAce"
    /** Opening the trick with a card worth no points. */
    | "leadLow"
    /** Opening the trick with anything else. */
    | "lead"
    /** Wins the trick by trumping a plain-suit lead. */
    | "ruff"
    /** Wins the trick; it is the weakest of several cards that would. */
    | "takeCheap"
    /** Wins the trick. */
    | "take"
    /** Does not win; partner is CERTAIN to take the trick (we play last, or
     *  partner holds it with the jack of trump) and the card is the most
     *  valuable of the legal cards that do not win, worth more than 0. */
    | "feedPartner"
    /** Does not win; partner holds the trick; the card is a DISCARD (not of
     *  the led suit) from a suit in which this hand holds neither the ace nor
     *  the ten, while it holds an ace in another suit. */
    | "signalDiscard"
    /** Does not win; partner holds the trick; neither of the two above. */
    | "partnerHolds"
    /** No legal card can win; this is (one of) the cheapest of them. */
    | "cantWinLow"
    /** No legal card can win. */
    | "cantWin"
    /** A legal card could win, and the suggestion keeps it. */
    | "saveStrong"

export interface PlayHint {
    card: Card
    reason: PlayHintReason
}

/** Would `card`, played now by the view's own seat, be holding the trick? */
function wouldWin(view: PlayerView, card: Card): boolean {
    const trump = view.bidding.trump
    const seat = view.seat
    if (trump === null || seat === null) return false
    const cards: TrickCard[] = [...view.trick.cards, { seat, card }]
    return trickWinner(cards, trump) === seat
}

/**
 * The card the heuristic bot would play from this view, with what it does.
 * Null when it is not this seat's turn to play.
 */
export function hintForPlay(view: PlayerView, rng: () => number): PlayHint | null {
    const trump = view.bidding.trump
    const seat = view.seat
    const legal = view.legalMoves
    if (view.phase !== "PLAYING" || trump === null || seat === null || legal.length === 0) return null

    const card = heuristicBot.chooseCard(view, legal, rng)
    return { card, reason: describePlay(view, card) }
}

/** The reason category for `card` — exported so the checks can be tested
 *  against a card of the test's choosing, independent of the bot's pick. */
export function describePlay(view: PlayerView, card: Card): PlayHintReason {
    const trump = view.bidding.trump as Suit
    const seat = view.seat as Seat
    const legal = view.legalMoves
    if (legal.length === 1) return "onlyCard"

    const onTable = view.trick.cards
    if (onTable.length === 0) {
        if (cardSuit(card) === trump) return "leadTrump"
        if (cardRank(card) === "A") return "leadAce"
        if (cardPoints(card, trump) === 0) return "leadLow"
        return "lead"
    }

    const winners = legal.filter((c) => wouldWin(view, c))
    if (winners.includes(card)) {
        const lead = cardSuit((onTable[0] as TrickCard).card)
        if (cardSuit(card) === trump && lead !== trump) return "ruff"
        // Cards that win the same trick are all trumps or all of the led
        // suit, so their strengths are comparable.
        const weakest = winners.every((c) => cardStrength(card, trump) <= cardStrength(c, trump))
        return winners.length > 1 && weakest ? "takeCheap" : "take"
    }

    const holder = trickWinner(onTable, trump)
    if (holder === partnerOf(seat)) {
        const holding = (onTable.find((c) => c.seat === holder) as TrickCard).card
        const certain =
            onTable.length === 3 || (cardSuit(holding) === trump && cardRank(holding) === "J")
        const losers = legal.filter((c) => !winners.includes(c))
        const richest = losers.every((c) => cardPoints(card, trump) >= cardPoints(c, trump))
        if (certain && richest && cardPoints(card, trump) > 0) return "feedPartner"

        const lead = cardSuit((onTable[0] as TrickCard).card)
        const suit = cardSuit(card)
        const holds = (s: Suit, rank: string) => view.hand.some((c) => cardSuit(c) === s && cardRank(c) === rank)
        const aceElsewhere = view.hand.some((c) => cardSuit(c) !== suit && cardRank(c) === "A")
        if (suit !== lead && !holds(suit, "A") && !holds(suit, "10") && aceElsewhere) return "signalDiscard"
        return "partnerHolds"
    }
    if (winners.length > 0) return "saveStrong"
    const cheapest = legal.every((c) => cardPoints(card, trump) <= cardPoints(c, trump))
    return cheapest ? "cantWinLow" : "cantWin"
}

/** What the suggested bid rests on — facts about the six cards in hand. */
export type BidHintReason =
    /** Pass, and the six cards hold no jack and no nine at all. */
    | "passNoTop"
    /** Pass, and every jack or nine held has at most one card of its suit
     *  beside it. */
    | "passShort"
    /** Pass, with neither of the two facts above. */
    | "pass"
    /** Holds both the jack and the nine of the suit. */
    | "jackAndNine"
    /** Holds the jack of the suit. */
    | "jack"
    /** Holds the nine of the suit. */
    | "nine"
    /** Holds neither, but three or more cards of the suit. */
    | "length"
    /** None of the above. */
    | "plain"

export interface BidHint {
    choice: Suit | "PASS"
    reason: BidHintReason
    /** The dealer after three passes: passing is not allowed ("mus"). */
    forced: boolean
    /** Cards of the suggested suit in hand; 0 for a pass. */
    count: number
}

/**
 * The bid the heuristic bot would make from this view, with the facts about
 * the hand that can be shown next to it. Null when it is not this seat's bid.
 */
export function hintForBid(view: PlayerView, rng: () => number): BidHint | null {
    const legal = view.legalBids
    if (view.phase !== "BIDDING" || legal === null || view.seat === null || view.turn !== view.seat) return null

    const choice = heuristicBot.chooseBid(view, legal, rng)
    const forced = !legal.canPass
    if (choice === "PASS") return { choice, reason: passReason(view.hand), forced, count: 0 }

    const inSuit = view.hand.filter((c) => cardSuit(c) === choice)
    const jack = inSuit.some((c) => cardRank(c) === "J")
    const nine = inSuit.some((c) => cardRank(c) === "9")
    const reason: BidHintReason =
        jack && nine ? "jackAndNine" : jack ? "jack" : nine ? "nine" : inSuit.length >= 3 ? "length" : "plain"
    return { choice, reason, forced, count: inSuit.length }
}

/** What can be SAID about a hand the bot passes on — facts, not its motive. */
function passReason(hand: readonly Card[]): BidHintReason {
    const tops = hand.filter((c) => cardRank(c) === "J" || cardRank(c) === "9")
    if (tops.length === 0) return "passNoTop"
    const backed = tops.some((top) => hand.filter((c) => cardSuit(c) === cardSuit(top)).length >= 3)
    return backed ? "pass" : "passShort"
}

/* ───────────────────────────── who takes a trick ───────────────────────────── */

/** Why the winning card of a trick wins — read off the cards themselves. */
export type TrickReason =
    /** No trump was played: the strongest card of the led suit. */
    | "highestOfLed"
    /** A plain suit was led and a trump was played on it. */
    | "trumpBeats"
    /** Trump was led: the strongest trump. */
    | "highestTrump"

export interface TrickVerdict {
    winner: TrickCard
    /** The suit of the first card. */
    lead: Suit
    reason: TrickReason
}

/**
 * Who takes a COMPLETE or partial trick and why. The winner is the engine's
 * `trickWinner`; the reason only names which of its two rules applied.
 */
export function describeTrick(trick: readonly TrickCard[], trump: Suit): TrickVerdict | null {
    const first = trick[0]
    if (first === undefined) return null
    const seat = trickWinner(trick, trump)
    const winner = trick.find((c) => c.seat === seat) as TrickCard
    const lead = cardSuit(first.card)
    const reason: TrickReason =
        lead === trump ? "highestTrump" : cardSuit(winner.card) === trump ? "trumpBeats" : "highestOfLed"
    return { winner, lead, reason }
}

/* ─────────────────────────── why a card is illegal ─────────────────────────── */

/** The README §1.5 obligation a card breaks. */
export type IllegalReason =
    /** Holds the led suit and the card is of another one. */
    | "followSuit"
    /** Of the led suit, but a stronger card of it is held ("iber"). */
    | "mustOvertake"
    /** Holds none of the led suit, holds a trump, and the card is not one. */
    | "mustTrump"
    /** A trump, but a trump that beats the one on the table is held. */
    | "mustOvertrump"

/**
 * Why `card` may not be played from this view, or null when it may (or when
 * it is not this seat's turn — then nothing is playable and there is no rule
 * to name). Legality itself is the ENGINE's answer (`view.legalMoves`); this
 * only names the obligation, by looking at which legal cards remain.
 */
export function whyIllegal(view: PlayerView, card: Card): IllegalReason | null {
    const trump = view.bidding.trump
    const legal = view.legalMoves
    if (view.phase !== "PLAYING" || trump === null || legal.length === 0) return null
    if (legal.includes(card)) return null
    const first = view.trick.cards[0]
    if (first === undefined) return null

    const lead = cardSuit(first.card)
    const holdsLead = view.hand.some((c) => cardSuit(c) === lead)
    if (holdsLead) {
        if (cardSuit(card) !== lead) return "followSuit"
        return lead === trump ? "mustOvertrump" : "mustOvertake"
    }
    // No card of the led suit: a rejected card is either not a trump while
    // trumps are held, or a trump too weak while a stronger one is held.
    return cardSuit(card) === trump ? "mustOvertrump" : "mustTrump"
}

/* ─────────────────────────── lesson positions ─────────────────────────── */

export interface Scenario {
    /** The learner's cards. */
    hand: readonly Card[]
    /** Cards already on the table, in play order, with the seat that threw
     *  each. The seat after the last one must be the learner's. */
    trick: readonly TrickCard[]
    trump: Suit
}

/**
 * A hand-built PLAYING position for a lesson, with the learner on turn. Built
 * on top of a real `newGame` state so every field the engine may read exists;
 * only the fields that define the position are replaced. The other three
 * hands are left empty — `legalMoves` reads the acting seat's hand only.
 */
export function scenarioState(scenario: Scenario): GameState {
    const base = newGame({ targetScore: 1001, seed: "bela-lesson" })
    const leader: Seat = scenario.trick[0]?.seat ?? LEARNER_SEAT
    return {
        ...base,
        phase: "PLAYING",
        stock: [],
        hands: { 0: scenario.hand.slice(), 1: [], 2: [], 3: [] },
        bidding: { turn: LEARNER_SEAT, passes: [], trump: scenario.trump, caller: leader },
        trick: {
            leader,
            turn: LEARNER_SEAT,
            cards: scenario.trick.map((c) => ({ ...c })),
        },
    }
}

/** The cards the ENGINE allows in a lesson position. */
export function scenarioLegalMoves(scenario: Scenario): Card[] {
    return legalMoves(scenarioState(scenario), LEARNER_SEAT)
}

/** The learner's redacted view of a lesson position. */
export function scenarioView(scenario: Scenario): PlayerView {
    return viewFor(scenarioState(scenario), LEARNER_SEAT)
}

/**
 * A BIDDING position in which `passed` seats have already said "dalje" and
 * the learner is on turn. With three passes the learner is the dealer and the
 * engine's `legalBids` refuses the pass — the "mus" the bidding lesson shows.
 */
export function biddingState(hand: readonly Card[], passed: 0 | 1 | 2 | 3): GameState {
    const base = newGame({ targetScore: 1001, seed: "bela-lesson" })
    // The seats that spoke before the learner, in turn order, ending just
    // before seat 0: e.g. three passes = seats 1, 2, 3.
    const passes: Seat[] = []
    for (let i = passed; i >= 1; i--) passes.push(((4 - i) % 4) as Seat)
    // Bidding opens at next(dealer), so the first speaker fixes the dealer.
    const first: Seat = passes[0] ?? LEARNER_SEAT
    const dealer = ((first + 3) % 4) as Seat
    return {
        ...base,
        phase: "BIDDING",
        dealer,
        hands: { 0: hand.slice(), 1: [], 2: [], 3: [] },
        bidding: { turn: LEARNER_SEAT, passes, trump: null, caller: null },
    }
}
