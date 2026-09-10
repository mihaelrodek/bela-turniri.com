import { describe, expect, it } from "vitest"
import type { Card, Declaration, PlayerView, Seat, WonTrick } from "@bela/engine"
import { cardSuit, findDeclarations, legalBids, newGame, reduce, viewFor } from "@bela/engine"
import {
    aceToCash,
    belaLead,
    belaSeat,
    bestTrumpSuit,
    callerTrumpLead,
    callerWasForced,
    declarationRead,
    locatedCards,
    opponentCanHold,
    provablyNoTrumpJack,
    readSeatFromLeads,
    defensiveLead,
    fillCard,
    fillPreferringTen,
    isLastOfADeadSuit,
    partnerAskedForTrump,
    shouldChaseStiglja,
    stigljaIsLive,
    stigljaLead,
    stigljaTakeOver,
    forceOutTheLastTrump,
    iAmDefending,
    nineOnPartnersLowTrump,
    pointsShortOfPass,
    tenThatSecuresThePass,
    handTricks,
    hasBackedTen,
    isSureFutureWinner,
    isThinLead,
    partnerSignal,
    partnerTrickIsSafe,
    quietLeadCard,
    hasWinnersToCash,
    isMasterCard,
    cheapestCard,
    cheapestDiscard,
    cheapestWinningCard,
    isLastToPlay,
    isPartnerHoldingTrick,
    mostValuableCard,
    opponentShownVoidIn,
    outstandingInSuit,
    seatProvablyLacksTrumpJack,
    seatShownVoidIn,
    shouldDrawTrumps,
    shouldDrawTrumpsForPartner,
    shouldSpendAce,
    signalDiscard,
    suitLength,
    suitStrength,
    suitWorthKeeping,
    trumpDrawCard,
    trumpOutlook,
    weakestCard,
    wouldWinTrick,
} from "../src/evaluate"
import { view } from "./helpers"

/** A completed trick in the engine's shape: cards in play order from `leader`. */
function wonTrick(leader: Seat, cards: Card[], winner: Seat): WonTrick {
    return {
        no: 1,
        leader,
        winner,
        plays: cards.map((card, i) => ({ seat: (((leader + i) % 4) as Seat), card })),
        cards,
    }
}

describe("suitStrength (README §5)", () => {
    it("scores J 4, 9 3, A 1.5, 10 1", () => {
        expect(suitStrength(["JHERC"], "HERC")).toBe(4)
        expect(suitStrength(["9HERC"], "HERC")).toBe(3)
        expect(suitStrength(["AHERC"], "HERC")).toBe(1.5)
        expect(suitStrength(["10HERC"], "HERC")).toBe(1)
    })

    it("adds 0.5 for every other card of the suit", () => {
        expect(suitStrength(["KHERC"], "HERC")).toBe(0.5)
        expect(suitStrength(["QHERC", "8HERC", "7HERC"], "HERC")).toBe(1.5)
    })

    it("sums a full holding and ignores other suits", () => {
        const hand: Card[] = ["JHERC", "9HERC", "AHERC", "10HERC", "KHERC", "7PIK"]
        expect(suitStrength(hand, "HERC")).toBe(4 + 3 + 1.5 + 1 + 0.5)
        expect(suitStrength(hand, "PIK")).toBe(0.5)
        expect(suitStrength(hand, "TREF")).toBe(0)
    })
})

describe("mostValuableCard / cheapestCard / weakestCard", () => {
    it("mostValuableCard picks the highest-point card, trump aware", () => {
        expect(mostValuableCard(["JHERC", "7TREF"], "HERC")).toBe("JHERC")
        expect(mostValuableCard(["AKARA", "10KARA", "7HERC"], "HERC")).toBe("AKARA")
    })

    it("cheapestCard picks the lowest-point card and prefers non-trump on ties", () => {
        expect(cheapestCard(["JHERC", "7TREF"], "HERC")).toBe("7TREF")
        expect(cheapestCard(["7HERC", "7TREF"], "HERC")).toBe("7TREF")
    })

    it("weakestCard picks the lowest strength among equal-point cards", () => {
        // 7PIK and 8PIK are both 0 points off-suit; 7 is weaker than 8.
        expect(weakestCard(["8PIK", "7PIK"], "HERC")).toBe("7PIK")
    })
})

describe("isPartnerHoldingTrick / isLastToPlay / wouldWinTrick", () => {
    it("is true only when the partner (not me) currently wins the trick", () => {
        // seat 0's partner is seat 2; trump is HERC (view()'s default).
        const opponentWinning = view({
            seat: 0,
            hand: ["7HERC"],
            trick: {
                leader: 1,
                turn: 0,
                cards: [
                    { seat: 1, card: "JHERC" }, // opponent's trump jack: strongest trump
                    { seat: 2, card: "7HERC" },
                ],
            },
        })
        expect(isPartnerHoldingTrick(opponentWinning)).toBe(false)

        const partnerWinning = view({
            seat: 0,
            hand: ["7HERC"],
            trick: {
                leader: 1,
                turn: 0,
                cards: [
                    { seat: 1, card: "7HERC" },
                    { seat: 2, card: "JHERC" }, // partner's trump jack wins
                ],
            },
        })
        expect(isPartnerHoldingTrick(partnerWinning)).toBe(true)
    })

    it("isLastToPlay is true only with three cards already down", () => {
        const withThree = view({
            seat: 0,
            hand: ["7HERC"],
            trick: {
                leader: 1,
                turn: 0,
                cards: [
                    { seat: 1, card: "7PIK" },
                    { seat: 2, card: "8PIK" },
                    { seat: 3, card: "9PIK" },
                ],
            },
        })
        expect(isLastToPlay(withThree)).toBe(true)
        expect(isLastToPlay(view({ seat: 0, hand: ["7HERC"] }))).toBe(false)
    })

    it("wouldWinTrick checks against the trick as played so far", () => {
        const v = view({
            seat: 0,
            hand: ["JHERC", "7PIK"],
            trick: { leader: 1, turn: 0, cards: [{ seat: 1, card: "APIK" }] },
        })
        expect(wouldWinTrick(v, "JHERC")).toBe(true) // trumping over a plain ace
        expect(wouldWinTrick(v, "7PIK")).toBe(false) // 7 of the led suit loses to the ace
    })
})

describe("cheapestWinningCard (branch 3 + the trump J/9 guard)", () => {
    it("returns null when nothing legal wins", () => {
        const v = view({
            seat: 0,
            hand: ["7PIK"],
            trick: { leader: 1, turn: 0, cards: [{ seat: 1, card: "APIK" }] },
        })
        expect(cheapestWinningCard(v, ["7PIK"])).toBeNull()
    })

    it("picks the cheapest of several winners", () => {
        const v = view({
            seat: 0,
            hand: ["10PIK", "KPIK"],
            trick: { leader: 1, turn: 0, cards: [{ seat: 1, card: "8PIK" }] },
        })
        // Both beat 8PIK; KPIK (4 pts) is cheaper than 10PIK (10 pts).
        expect(cheapestWinningCard(v, ["10PIK", "KPIK"])).toBe("KPIK")
    })

    it("avoids trump J/9 on a poor trick when a non-trump winner exists", () => {
        const v = view({
            seat: 0,
            hand: ["JHERC", "APIK"],
            trick: { leader: 1, turn: 0, cards: [{ seat: 1, card: "7PIK" }] }, // 0-point trick so far
        })
        // APIK already beats 7PIK without spending the trump jack.
        expect(cheapestWinningCard(v, ["JHERC", "APIK"])).toBe("APIK")
    })

    it("plays trump J/9 anyway when it is the only winner", () => {
        const v = view({
            seat: 0,
            hand: ["JHERC", "7TREF"],
            trick: { leader: 1, turn: 0, cards: [{ seat: 1, card: "7PIK" }] },
        })
        expect(cheapestWinningCard(v, ["JHERC", "7TREF"])).toBe("JHERC")
    })
})

describe("cheapestDiscard (branch 4)", () => {
    it("prefers a zero-point non-trump card from the shortest suit", () => {
        const hand: Card[] = ["7TREF", "8KARA", "9KARA", "QHERC"]
        // 7TREF (0pt, non-trump, TREF length 1) beats 8KARA (0pt, non-trump, KARA length 2).
        expect(cheapestDiscard(hand, ["7TREF", "8KARA", "9KARA", "QHERC"], "HERC")).toBe("7TREF")
    })

    it("never discards a scoring card when a zero-point one is legal", () => {
        expect(cheapestDiscard(["APIK", "7PIK"], ["APIK", "7PIK"], "HERC")).toBe("7PIK")
    })
})

describe("suitLength", () => {
    it("counts cards of a suit in the hand", () => {
        expect(suitLength(["7HERC", "8HERC", "7PIK"], "HERC")).toBe(2)
        expect(suitLength(["7HERC"], "TREF")).toBe(0)
    })
})

/* ──────────────────────────────────────────────────────────────────────────
   Fault (2): spending an ace only when it is doing work.
   ────────────────────────────────────────────────────────────────────── */

describe("outstandingInSuit", () => {
    it("counts the cards of a suit still held by the other three players", () => {
        const v = view({
            seat: 0,
            hand: ["APIK", "7PIK"],
            played: ["KPIK", "QPIK"],
            trick: { leader: 1, turn: 0, cards: [{ seat: 1, card: "8PIK" }] },
        })
        expect(outstandingInSuit(v, "PIK")).toBe(3) // 8 − 2 in hand − 2 played − 1 on the table
        expect(outstandingInSuit(v, "TREF")).toBe(8)
    })
})

describe("opponentShownVoidIn", () => {
    it("sees an opponent discard off-suit in the trick in progress", () => {
        const v = view({
            seat: 0,
            hand: ["APIK"],
            trick: {
                leader: 1,
                turn: 0,
                cards: [
                    { seat: 1, card: "7PIK" },
                    { seat: 2, card: "8PIK" },
                    { seat: 3, card: "7TREF" }, // opponent (3) is void in PIK
                ],
            },
        })
        expect(opponentShownVoidIn(v, "PIK")).toBe(true)
        expect(opponentShownVoidIn(v, "TREF")).toBe(false)
    })

    it("reads the seat attribution of completed tricks, partner vs opponent", () => {
        const partnerVoid = view({
            seat: 0,
            hand: ["AKARA"],
            // Seat 2 (my partner) discarded a TREF on a PIK lead — proves
            // nothing about the opponents.
            lastTrick: wonTrick(0, ["7PIK", "KPIK", "8TREF", "8PIK"], 1),
        })
        expect(opponentShownVoidIn(partnerVoid, "PIK")).toBe(false)

        const opponentVoid = view({
            seat: 0,
            hand: ["AKARA"],
            // Seat 3 (an opponent) discarded a TREF on a PIK lead.
            lastTrick: wonTrick(0, ["7PIK", "8PIK", "KPIK", "8TREF"], 2),
        })
        expect(opponentShownVoidIn(opponentVoid, "PIK")).toBe(true)
    })

    it("uses the whole reviewable trick history, not just the last trick", () => {
        const v = view({
            seat: 0,
            hand: ["AKARA"],
            trickHistory: [
                wonTrick(0, ["7PIK", "8PIK", "KPIK", "8TREF"], 2), // seat 3 void in PIK
                wonTrick(1, ["7KARA", "8KARA", "9KARA", "10KARA"], 3),
            ],
            lastTrick: wonTrick(1, ["7KARA", "8KARA", "9KARA", "10KARA"], 3),
        })
        expect(opponentShownVoidIn(v, "PIK")).toBe(true)
    })

    it("proves nothing when the suit was never led", () => {
        const v = view({
            seat: 0,
            hand: ["APIK"],
            lastTrick: wonTrick(0, ["7TREF", "KTREF", "8TREF", "9TREF"], 1),
        })
        expect(opponentShownVoidIn(v, "PIK")).toBe(false)
    })
})

describe("shouldSpendAce (fault 2)", () => {
    const fresh = (hand: Card[]): PlayerView =>
        view({ seat: 0, hand, bidding: { turn: 1, passes: [], trump: "HERC", caller: 1 } })

    it("spends the ace on the first round of a suit with enough of it outside my hand", () => {
        // Two PIK in hand → six outside, shared by three seats: a void is the exception.
        expect(shouldSpendAce(fresh(["APIK", "7PIK", "8TREF", "9TREF"]), "PIK")).toBe(true)
        expect(shouldSpendAce(fresh(["APIK", "10PIK", "8TREF", "9TREF"]), "PIK")).toBe(true)
    })

    it("keeps the ace of a suit I hold most of — somebody is void", () => {
        // Five PIK in hand → three outside for three seats.
        expect(shouldSpendAce(fresh(["APIK", "10PIK", "KPIK", "QPIK", "JPIK", "8TREF"]), "PIK")).toBe(false)
    })

    it("keeps the ace after the first round of the suit has gone", () => {
        const v = view({
            seat: 0,
            hand: ["APIK", "7PIK", "8TREF", "9TREF"],
            played: ["8PIK", "9PIK", "KPIK", "7HERC"], // PIK has been led once already
            bidding: { turn: 1, passes: [], trump: "HERC", caller: 1 },
        })
        expect(shouldSpendAce(v, "PIK")).toBe(false)
    })

    it("keeps the ace when my partner has shown void in the suit and may hold a trump", () => {
        // Seat 2 (my partner) threw a KARA on the PIK lead: leading the ace
        // now would force him to ruff it (§1.5 has no partner exception).
        // Both opponents have shown void in TRUMP (HERC) — nobody threw one on
        // the two HERC leads — so the "opponents cannot ruff" rule alone would
        // spend the ace; the partner veto is what keeps it.
        const v = view({
            seat: 0,
            hand: ["APIK", "7PIK", "8TREF", "9TREF"],
            played: ["7PIK", "8KARA", "KPIK", "8PIK", "7HERC", "7KARA", "8HERC", "7TREF"],
            bidding: { turn: 1, passes: [], trump: "HERC", caller: 1 },
            handSizes: { 0: 4, 1: 4, 2: 4, 3: 4 },
            trickHistory: [
                wonTrick(1, ["7PIK", "8KARA", "KPIK", "8PIK"], 3),
                wonTrick(2, ["7HERC", "7KARA", "8HERC", "7TREF"], 0), // seats 3 and 1 → no trump
            ],
        })
        expect(trumpOutlook(v).opponentMax).toBe(0)
        expect(shouldSpendAce(v, "PIK")).toBe(false)
    })

    it("spends the ace when nothing can trump it any more", () => {
        // All eight trumps accounted for: four in hand, four already played.
        const v = view({
            seat: 0,
            hand: ["APIK", "7PIK", "7HERC", "8HERC", "9HERC", "10HERC"],
            played: ["JHERC", "QHERC", "KHERC", "AHERC"],
            bidding: { turn: 1, passes: [], trump: "HERC", caller: 1 },
        })
        expect(shouldSpendAce(v, "PIK")).toBe(true)
    })

    it("keeps the ace when the suit is nearly exhausted — whoever is void would ruff it", () => {
        const v = view({
            seat: 0,
            hand: ["APIK", "7PIK", "8TREF", "9TREF"],
            played: ["8PIK", "9PIK", "10PIK", "JPIK", "QPIK"], // only KPIK is left out there
            bidding: { turn: 1, passes: [], trump: "HERC", caller: 1 },
        })
        expect(shouldSpendAce(v, "PIK")).toBe(false)
    })

    it("keeps the ace when an opponent has shown void in the suit", () => {
        const v = view({
            seat: 0,
            hand: ["APIK", "7PIK", "8TREF", "9TREF"],
            bidding: { turn: 1, passes: [], trump: "HERC", caller: 1 },
            lastTrick: wonTrick(0, ["7PIK", "8PIK", "KPIK", "8TREF"], 2), // seat 3 void
        })
        expect(shouldSpendAce(v, "PIK")).toBe(false)
    })

    it("spends the ace at the end of the deal, when there is no later trick", () => {
        expect(shouldSpendAce(fresh(["APIK", "8TREF"]), "PIK")).toBe(true)
    })

    it("never withholds the trump ace — nothing can trump it", () => {
        expect(shouldSpendAce(fresh(["AHERC", "7PIK", "8TREF", "9TREF"]), "HERC")).toBe(true)
    })
})

/* ──────────────────────────────────────────────────────────────────────────
   Fault (3): drawing trumps for a partner who called.
   ────────────────────────────────────────────────────────────────────── */

describe("callerWasForced (mus, README §1.2.4)", () => {
    it("is true for the dealer calling after three passes", () => {
        const v = view({
            seat: 0,
            hand: ["7HERC"],
            dealer: 2,
            bidding: { turn: 2, passes: [3, 0, 1], trump: "HERC", caller: 2 },
        })
        expect(callerWasForced(v)).toBe(true)
    })

    it("is false when the dealer called of his own accord (nobody had passed)", () => {
        const v = view({
            seat: 0,
            hand: ["7HERC"],
            dealer: 2,
            bidding: { turn: 2, passes: [], trump: "HERC", caller: 2 },
        })
        expect(callerWasForced(v)).toBe(false)
    })

    it("is false when someone other than the dealer called", () => {
        const v = view({
            seat: 0,
            hand: ["7HERC"],
            dealer: 2,
            bidding: { turn: 3, passes: [3, 0], trump: "HERC", caller: 1 },
        })
        expect(callerWasForced(v)).toBe(false)
    })

    it("matches the engine: a real three-pass deal ends in a forced dealer call", () => {
        let state = newGame({ seed: "mus-derivation", targetScore: 501 })
        for (let i = 0; i < 3; i++) {
            state = reduce(state, { type: "PASS", seat: state.bidding.turn }).state
        }
        expect(state.bidding.turn).toBe(state.dealer)
        expect(legalBids(state, state.dealer).canPass).toBe(false)
        state = reduce(state, { type: "BID", seat: state.dealer, trump: "HERC" }).state
        expect(callerWasForced(viewFor(state, 0))).toBe(true)
    })

    it("matches the engine: a voluntary first-hand call is not forced", () => {
        let state = newGame({ seed: "mus-derivation", targetScore: 501 })
        state = reduce(state, { type: "BID", seat: state.bidding.turn, trump: "HERC" }).state
        expect(callerWasForced(viewFor(state, 0))).toBe(false)
    })
})

describe("seatProvablyLacksTrumpJack (declarations, README §1.4)", () => {
    const withDeclarations = (per: Partial<Record<Seat, Declaration[]>>): PlayerView =>
        view({
            seat: 0,
            hand: ["7HERC"],
            bidding: { turn: 1, passes: [], trump: "HERC", caller: 2 },
            declarations: per,
            declarationsRevealed: true,
        })

    const seq = (cards: Card[]): Declaration => ({
        kind: "SEQUENCE",
        cards,
        points: cards.length === 3 ? 20 : cards.length === 4 ? 50 : 100,
    })

    it("a trump 8-9-10 run proves it: a maximal run would have swallowed the jack", () => {
        const v = withDeclarations({ 2: [seq(["8HERC", "9HERC", "10HERC"])] })
        expect(seatProvablyLacksTrumpJack(v, 2)).toBe(true)
    })

    it("a trump Q-K-A run proves it: it would have started at the jack", () => {
        const v = withDeclarations({ 2: [seq(["QHERC", "KHERC", "AHERC"])] })
        expect(seatProvablyLacksTrumpJack(v, 2)).toBe(true)
    })

    it("a run that contains the jack proves the opposite", () => {
        const v = withDeclarations({ 2: [seq(["9HERC", "10HERC", "JHERC"])] })
        expect(seatProvablyLacksTrumpJack(v, 2)).toBe(false)
    })

    it("a run that stops short of the jack's neighbours proves nothing", () => {
        const v = withDeclarations({ 2: [seq(["7HERC", "8HERC", "9HERC"])] })
        expect(seatProvablyLacksTrumpJack(v, 2)).toBe(false)
    })

    it("a run in another suit proves nothing about the trump jack", () => {
        const v = withDeclarations({ 2: [seq(["8PIK", "9PIK", "10PIK"])] })
        expect(seatProvablyLacksTrumpJack(v, 2)).toBe(false)
    })

    it("his own four jacks prove he HAS it", () => {
        const four: Declaration = {
            kind: "FOUR",
            cards: ["JHERC", "JKARA", "JPIK", "JTREF"],
            points: 200,
        }
        // Even alongside a run that would otherwise deny it.
        const v = withDeclarations({ 2: [four, seq(["QHERC", "KHERC", "AHERC"])] })
        expect(seatProvablyLacksTrumpJack(v, 2)).toBe(false)
    })

    it("somebody else's four jacks prove he does not", () => {
        const four: Declaration = {
            kind: "FOUR",
            cards: ["JHERC", "JKARA", "JPIK", "JTREF"],
            points: 200,
        }
        const v = withDeclarations({ 1: [four] })
        expect(seatProvablyLacksTrumpJack(v, 2)).toBe(true)
    })

    it("no declarations at all proves nothing", () => {
        expect(seatProvablyLacksTrumpJack(withDeclarations({ 2: [] }), 2)).toBe(false)
        expect(seatProvablyLacksTrumpJack(withDeclarations({}), 2)).toBe(false)
    })

    it("proves nothing while declarations are still hidden", () => {
        const v = view({
            seat: 0,
            hand: ["7HERC"],
            bidding: { turn: 1, passes: [], trump: "HERC", caller: 2 },
            declarations: { 2: [seq(["8HERC", "9HERC", "10HERC"])] },
            declarationsRevealed: false,
        })
        expect(seatProvablyLacksTrumpJack(v, 2)).toBe(false)
    })

    it("matches the engine: findDeclarations really does report the maximal run", () => {
        const withoutJack = findDeclarations([
            "8HERC", "9HERC", "10HERC", "QHERC", "KHERC", "AHERC", "7PIK", "8TREF",
        ])
        expect(withoutJack.map((d) => d.cards)).toEqual([
            ["8HERC", "9HERC", "10HERC"],
            ["QHERC", "KHERC", "AHERC"],
        ])
        const withJack = findDeclarations([
            "8HERC", "9HERC", "10HERC", "JHERC", "7PIK", "8PIK", "7TREF", "8TREF",
        ])
        expect(withJack.map((d) => d.cards)).toEqual([
            ["8HERC", "9HERC", "10HERC", "JHERC"],
        ])
    })
})

describe("shouldDrawTrumpsForPartner (fault 3)", () => {
    const withCaller = (caller: Seat, over: Partial<PlayerView> = {}): PlayerView => {
        const base = view({
            seat: 0,
            hand: ["7HERC", "8HERC", "APIK", "7TREF"],
            dealer: 3,
            bidding: { turn: 1, passes: [], trump: "HERC", caller },
        })
        return { ...base, ...over }
    }

    it("draws when my partner called of his own accord", () => {
        expect(shouldDrawTrumpsForPartner(withCaller(2))).toBe(true)
    })

    it("does not draw when I called myself", () => {
        expect(shouldDrawTrumpsForPartner(withCaller(0))).toBe(false)
    })

    it("does not draw when an opponent called", () => {
        expect(shouldDrawTrumpsForPartner(withCaller(1))).toBe(false)
        expect(shouldDrawTrumpsForPartner(withCaller(3))).toBe(false)
    })

    it("does not draw when the partner was on mus (dealer, three passes)", () => {
        const v = view({
            seat: 0,
            hand: ["7HERC", "8HERC", "APIK", "7TREF"],
            dealer: 2,
            bidding: { turn: 2, passes: [3, 0, 1], trump: "HERC", caller: 2 },
        })
        expect(shouldDrawTrumpsForPartner(v)).toBe(false)
    })

    it("does not draw when his declarations deny the jack and I have none either", () => {
        const v = withCaller(2, {
            declarations: {
                2: [{ kind: "SEQUENCE", cards: ["8HERC", "9HERC", "10HERC"], points: 20 }],
            },
            declarationsRevealed: true,
        })
        expect(shouldDrawTrumpsForPartner(v)).toBe(false)
    })

    it("still draws when his declarations deny the jack but I hold it myself", () => {
        const v = withCaller(2, {
            hand: ["JHERC", "7HERC", "APIK", "7TREF"],
            declarations: {
                2: [{ kind: "SEQUENCE", cards: ["8HERC", "9HERC", "10HERC"], points: 20 }],
            },
            declarationsRevealed: true,
        })
        expect(shouldDrawTrumpsForPartner(v)).toBe(true)
    })
})

describe("isMasterCard / hasWinnersToCash", () => {
    it("an unplayed ace is master of its suit; the king under it is not", () => {
        const v = view({ seat: 0, hand: ["APIK", "KPIK"] })
        expect(isMasterCard(v, "APIK")).toBe(true)
        expect(isMasterCard(v, "KPIK")).toBe(false)
    })

    it("a 10 becomes master once the ace of its suit is face up", () => {
        const v = view({ seat: 0, hand: ["10PIK"], played: ["APIK", "7KARA", "8KARA", "9KARA"] })
        expect(isMasterCard(v, "10PIK")).toBe(true)
    })

    it("ranks the trump suit by the trump order, not the plain one", () => {
        // Plain order would make the ace master; in trump J and 9 beat it.
        const v = view({ seat: 0, hand: ["AHERC"] })
        expect(isMasterCard(v, "AHERC")).toBe(false)
        const jackGone = view({ seat: 0, hand: ["AHERC"], played: ["JHERC", "9HERC"] })
        expect(isMasterCard(jackGone, "AHERC")).toBe(true)
    })

    it("hasWinnersToCash is false for a hand that will never take a trick", () => {
        expect(hasWinnersToCash(view({ seat: 0, hand: ["7HERC", "8HERC", "7PIK", "8TREF"] }))).toBe(
            false,
        )
        expect(hasWinnersToCash(view({ seat: 0, hand: ["7HERC", "APIK"] }))).toBe(true)
    })
})

describe("trumpOutlook — counting the trumps the opponents can still hold", () => {
    it("counts what is left and splits it by remaining hand size", () => {
        // 8 trumps, I hold 2 and none are face up → 6 outstanding across three
        // seats of 8 cards each; two of them are opponents.
        const v = view({ seat: 0, hand: ["7HERC", "8HERC"] })
        const outlook = trumpOutlook(v)
        expect(outlook.outstanding).toBe(6)
        expect(outlook.opponentMax).toBe(6)
        expect(outlook.opponentExpected).toBeCloseTo(4, 6)
    })

    it("is empty once every trump is accounted for", () => {
        const v = view({
            seat: 0,
            hand: ["JHERC"],
            played: ["7HERC", "8HERC", "9HERC", "10HERC", "QHERC", "KHERC", "AHERC"],
        })
        expect(trumpOutlook(v)).toEqual({ outstanding: 0, opponentMax: 0, opponentExpected: 0 })
    })

    it("drops an opponent's share to zero once he has shown void in trump", () => {
        const v = view({
            seat: 0,
            hand: ["7HERC", "8HERC"],
            lastTrick: wonTrick(0, ["9HERC", "7PIK", "10HERC", "7TREF"], 0),
            played: ["9HERC", "7PIK", "10HERC", "7TREF"],
        })
        // Seats 1 and 3 (both opponents) discarded on a trump lead.
        expect(seatShownVoidIn(v, 1, "HERC")).toBe(true)
        expect(seatShownVoidIn(v, 3, "HERC")).toBe(true)
        expect(seatShownVoidIn(v, 2, "HERC")).toBe(false)
        const outlook = trumpOutlook(v)
        expect(outlook.outstanding).toBe(4)
        expect(outlook.opponentMax).toBe(0)
        expect(outlook.opponentExpected).toBe(0)
    })
})

describe("shouldDrawTrumps (fault 3, bounded)", () => {
    const partnerCalled = (over: Partial<PlayerView> = {}): PlayerView => ({
        ...view({
            seat: 0,
            hand: ["7HERC", "8HERC", "APIK", "7TREF"],
            dealer: 3,
            bidding: { turn: 1, passes: [], trump: "HERC", caller: 2 },
        }),
        ...over,
    })

    it("draws when the opponents can still hold trumps and we have a winner to cash", () => {
        expect(shouldDrawTrumps(partnerCalled())).toBe(true)
    })

    it("does not draw once the opponents are provably out of trumps", () => {
        const v = partnerCalled({
            hand: ["JHERC", "APIK"],
            played: ["7HERC", "8HERC", "9HERC", "10HERC", "QHERC", "KHERC", "AHERC"],
        })
        expect(shouldDrawTrumps(v)).toBe(false)
    })

    it("does not draw when we have nothing to cash afterwards", () => {
        expect(shouldDrawTrumps(partnerCalled({ hand: ["7HERC", "8HERC", "7PIK", "7TREF"] }))).toBe(
            false,
        )
    })

    it("does not draw when the outstanding trumps are probably my partner's", () => {
        // One trump left in play and three seats that could hold it: the
        // opponents' expected share is under one whole trump.
        const v = partnerCalled({
            hand: ["8HERC", "APIK", "KPIK"],
            handSizes: { 0: 3, 1: 3, 2: 3, 3: 3 },
            played: [
                "7HERC", "9HERC", "10HERC", "QHERC", "KHERC", "AHERC",
                "7PIK", "8PIK", "9PIK", "10PIK", "7TREF", "8TREF",
                "9TREF", "10TREF", "7KARA", "8KARA", "9KARA", "10KARA",
                "QKARA", "KKARA",
            ],
        })
        const outlook = trumpOutlook(v)
        expect(outlook.outstanding).toBe(1)
        expect(outlook.opponentExpected).toBeCloseTo(2 / 3, 6)
        expect(shouldDrawTrumps(v)).toBe(false)
    })

    it("never draws for the defending team, jack or no jack", () => {
        const v = partnerCalled({
            hand: ["JHERC", "9HERC", "APIK"],
            bidding: { turn: 1, passes: [], trump: "HERC", caller: 1 },
        })
        expect(shouldDrawTrumps(v)).toBe(false)
    })

    it("as the caller, draws only while holding the top trump left", () => {
        const called = (hand: Card[], played: Card[] = []): PlayerView =>
            partnerCalled({
                hand,
                played,
                bidding: { turn: 1, passes: [], trump: "HERC", caller: 0 },
            })
        expect(shouldDrawTrumps(called(["JHERC", "7HERC", "APIK"]))).toBe(true)
        expect(shouldDrawTrumps(called(["7HERC", "8HERC", "APIK"]))).toBe(false)
        // …and the 9 takes over as the top trump once the jack is gone.
        expect(
            shouldDrawTrumps(called(["9HERC", "7HERC", "APIK"], ["JHERC", "7PIK", "8PIK", "9PIK"])),
        ).toBe(true)
    })

    it("is unchanged by a partner's mus call", () => {
        const v = view({
            seat: 0,
            hand: ["7HERC", "8HERC", "APIK", "7TREF"],
            dealer: 2,
            bidding: { turn: 2, passes: [3, 0, 1], trump: "HERC", caller: 2 },
        })
        expect(callerWasForced(v)).toBe(true)
        expect(shouldDrawTrumps(v)).toBe(false)
    })
})

describe("trumpDrawCard", () => {
    it("leads the top trump when I hold it", () => {
        const v = view({ seat: 0, hand: ["JHERC", "7HERC", "APIK"] })
        expect(trumpDrawCard(v, ["JHERC", "7HERC", "APIK"])).toBe("JHERC")
    })

    it("leads the cheapest trump when the top ones are elsewhere", () => {
        const v = view({ seat: 0, hand: ["AHERC", "7HERC", "APIK"] })
        expect(trumpDrawCard(v, ["AHERC", "7HERC", "APIK"])).toBe("7HERC")
    })

    it("is null with no trump to lead", () => {
        const v = view({ seat: 0, hand: ["APIK", "7TREF"] })
        expect(trumpDrawCard(v, ["APIK", "7TREF"])).toBeNull()
    })
})

/* ──────────────────────────────────────────────────────────────────────────
   2026-09-09: filling the partner's trick, and quiet leads.
   ────────────────────────────────────────────────────────────────────── */

describe("partnerTrickIsSafe", () => {
    const partnerLeads = (
        cards: { seat: Seat; card: Card }[],
        over: Partial<Omit<PlayerView, "seat" | "hand">> = {},
    ): PlayerView => view({ seat: 0, hand: ["APIK", "7TREF"], trick: { leader: 2, turn: 0, cards }, ...over })

    it("is false when the partner is not holding the trick", () => {
        expect(partnerTrickIsSafe(partnerLeads([{ seat: 2, card: "7KARA" }, { seat: 3, card: "AKARA" }]))).toBe(false)
    })

    it("is true when I am the last to play", () => {
        const v = view({
            seat: 0,
            hand: ["APIK", "7TREF"],
            trick: {
                leader: 1,
                turn: 0,
                cards: [{ seat: 1, card: "7KARA" }, { seat: 2, card: "KKARA" }, { seat: 3, card: "8KARA" }],
            },
        })
        expect(partnerTrickIsSafe(v)).toBe(true)
    })

    it("third to play: true behind a master trump", () => {
        expect(partnerTrickIsSafe(partnerLeads([{ seat: 2, card: "JHERC" }, { seat: 3, card: "7HERC" }]))).toBe(true)
    })

    it("third to play: false behind a plain card that is not the master", () => {
        expect(partnerTrickIsSafe(partnerLeads([{ seat: 2, card: "KKARA" }, { seat: 3, card: "7KARA" }]))).toBe(false)
    })

    it("third to play: false behind a plain master while the fourth player may ruff", () => {
        expect(partnerTrickIsSafe(partnerLeads([{ seat: 2, card: "AKARA" }, { seat: 3, card: "7KARA" }]))).toBe(false)
    })

    it("third to play: true behind a plain master once the fourth player has shown void in trump", () => {
        const v = partnerLeads([{ seat: 2, card: "AKARA" }, { seat: 3, card: "7KARA" }], {
            lastTrick: wonTrick(2, ["JHERC", "7HERC", "8HERC", "7PIK"], 2), // seat 1 threw a PIK on trump
        })
        expect(partnerTrickIsSafe(v)).toBe(true)
    })

    it("third to play: true behind a plain master when no trump is left at all", () => {
        const v = partnerLeads([{ seat: 2, card: "AKARA" }, { seat: 3, card: "7KARA" }], {
            played: ["7HERC", "8HERC", "9HERC", "10HERC", "JHERC", "QHERC", "KHERC", "AHERC"],
        })
        expect(partnerTrickIsSafe(v)).toBe(true)
    })

    // 2026-09-09: the master-trump case no longer depends on WHERE I sit. A
    // master trump cannot be beaten by anything anyone still holds, so it does
    // not matter how many seats play after me — the earlier rule only allowed
    // it with exactly two cards down and refused the same certain trick here.
    // A partner cannot really be the leader while I am second to play (he sits
    // two seats away), so this position is hand-built to pin the contract.
    it("second to play: a master TRUMP is safe with two seats still to come", () => {
        const v = partnerLeads([{ seat: 2, card: "JHERC" }])
        expect(isLastToPlay(v)).toBe(false)
        expect(partnerTrickIsSafe(v)).toBe(true)
    })

    it("second to play: a plain master is NOT safe while either follower may ruff", () => {
        // AKARA is the master of its suit, but nobody behind me has shown
        // void in trump, so the trick can still be ruffed away.
        const v = partnerLeads([{ seat: 2, card: "AKARA" }])
        expect(isMasterCard(v, "AKARA")).toBe(true)
        expect(partnerTrickIsSafe(v)).toBe(false)
    })

    it("second to play: a plain master IS safe once no trump is left at all", () => {
        const v = partnerLeads([{ seat: 2, card: "AKARA" }], {
            played: ["7HERC", "8HERC", "9HERC", "10HERC", "JHERC", "QHERC", "KHERC", "AHERC"],
        })
        expect(partnerTrickIsSafe(v)).toBe(true)
    })
})

describe("fillCard / isSureFutureWinner", () => {
    it("feeds the most valuable card that is not a sure trick of its own", () => {
        const v = view({
            seat: 0,
            hand: ["APIK", "10TREF", "7TREF"],
            played: ["7HERC", "8HERC", "9HERC", "10HERC", "JHERC", "QHERC", "KHERC", "AHERC"],
        })
        expect(isSureFutureWinner(v, "APIK")).toBe(true)
        expect(isSureFutureWinner(v, "10TREF")).toBe(false) // ATREF is still out
        expect(fillCard(v, ["APIK", "10TREF", "7TREF"])).toBe("10TREF")
    })

    it("a master trump is always a sure winner; a plain master is not while opponents may ruff", () => {
        const v = view({ seat: 0, hand: ["JHERC", "APIK"] })
        expect(isSureFutureWinner(v, "JHERC")).toBe(true)
        expect(isSureFutureWinner(v, "APIK")).toBe(false)
        expect(fillCard(v, ["JHERC", "APIK"])).toBe("APIK")
    })

    it("when every card is a sure winner, gives the cheapest", () => {
        const v = view({ seat: 0, hand: ["JHERC", "9HERC"] })
        expect(fillCard(v, ["JHERC", "9HERC"])).toBe("9HERC")
    })
})

describe("quietLeadCard", () => {
    it("points before suit length: never a bare ten when a seven exists", () => {
        const v = view({ seat: 0, hand: ["10PIK", "7TREF", "8TREF", "9TREF"] })
        expect(quietLeadCard(v, v.hand, new Set())).toBe("7TREF")
    })

    it("among equal points prefers the shortest suit, then the lowest card", () => {
        const v = view({ seat: 0, hand: ["8PIK", "7TREF", "8TREF", "9TREF"] })
        expect(quietLeadCard(v, v.hand, new Set())).toBe("8PIK")
    })

    it("skips the kept aces and the trumps, falling back to the weakest card when nothing else is left", () => {
        const v = view({ seat: 0, hand: ["APIK", "7HERC", "JHERC"] })
        expect(quietLeadCard(v, v.hand, new Set<Card>(["APIK"]))).toBe("7HERC")
    })
})

/* ──────────────────────────────────────────────────────────────────────────
   2026-09-09: the unwritten rules — signalling (BOT.md §2/§3), bidding over
   the whole hand (§1), and the leading rules (§5).
   ────────────────────────────────────────────────────────────────────── */

describe("hasBackedTen (BOT.md §2.3)", () => {
    it("is false for a 10 standing on its own — that one is food", () => {
        expect(hasBackedTen(["10PIK", "7TREF", "8TREF"], "PIK")).toBe(false)
    })

    it("is true for the 10 with its own ace", () => {
        expect(hasBackedTen(["10PIK", "APIK"], "PIK")).toBe(true)
    })

    it("is true for the 10 with the king — the king is the entry", () => {
        expect(hasBackedTen(["10PIK", "KPIK"], "PIK")).toBe(true)
    })

    it("is false for A+K without the 10: there is no 10 to back", () => {
        expect(hasBackedTen(["APIK", "KPIK"], "PIK")).toBe(false)
    })

    it("does not read a backing card out of another suit", () => {
        expect(hasBackedTen(["10PIK", "ATREF", "KTREF"], "PIK")).toBe(false)
    })
})

describe("suitWorthKeeping (BOT.md §2.1)", () => {
    it("four or more cards outlast the other three hands", () => {
        // No ace, no backed ten, and QPIK is nothing while A/10/K are out:
        // length is the only reason this suit is worth keeping.
        const v = view({ seat: 0, hand: ["7PIK", "8PIK", "9PIK", "QPIK", "7TREF"] })
        expect(suitWorthKeeping(v, "PIK")).toBe(true)
    })

    it("the ace is a trick on its own", () => {
        const v = view({ seat: 0, hand: ["APIK", "7PIK", "7TREF"] })
        expect(suitWorthKeeping(v, "PIK")).toBe(true)
    })

    it("a backed ten inherits the suit once the ace has gone", () => {
        const v = view({ seat: 0, hand: ["10PIK", "KPIK", "7TREF"] })
        expect(suitWorthKeeping(v, "PIK")).toBe(true)
    })

    it("a master card counts even without ace, ten or length", () => {
        // A and 10 of PIK are face up, so my lone king is the best left.
        const v = view({ seat: 0, hand: ["KPIK", "7TREF"], played: ["APIK", "10PIK"] })
        expect(isMasterCard(v, "KPIK")).toBe(true)
        expect(suitWorthKeeping(v, "PIK")).toBe(true)
    })

    it("is false for two suits that hold nothing at all", () => {
        const v = view({ seat: 0, hand: ["7PIK", "8PIK", "QTREF", "7TREF"] })
        expect(suitWorthKeeping(v, "PIK")).toBe(false)
        expect(suitWorthKeeping(v, "TREF")).toBe(false)
    })

    it("the trump suit is always worth keeping, even holding none of it", () => {
        const v = view({ seat: 0, hand: ["7PIK", "8PIK"] })
        expect(suitWorthKeeping(v, "HERC")).toBe(true)
    })
})

describe("signalDiscard (BOT.md §2)", () => {
    /** Seat 0, trump HERC, nothing face up — the hand is the whole scenario. */
    const mixed = (hand: Card[]): PlayerView => view({ seat: 0, hand })

    it("says nothing at all while the OPPONENTS are taking the trick", () => {
        const hand: Card[] = ["8PIK", "7PIK", "QTREF", "JTREF", "9TREF", "AKARA", "10KARA"]
        const v = mixed(hand)
        // The very hand that produces a message when feeding produces none here:
        // every rank of the message is paid for in real points.
        expect(signalDiscard(v, hand, true)).toBe("8PIK")
        expect(signalDiscard(v, hand, false)).toBeNull()
        expect(signalDiscard(mixed(["APIK", "10PIK", "AKARA", "7KARA"]), ["APIK", "10PIK", "AKARA", "7KARA"], false)).toBeNull()
    })

    it("abandons the SHORTEST worthless suit, and throws its HIGHEST card", () => {
        const hand: Card[] = ["8PIK", "7PIK", "QTREF", "JTREF", "9TREF", "AKARA", "10KARA"]
        const v = mixed(hand)
        expect(suitWorthKeeping(v, "KARA")).toBe(true) // the ace keeps it
        expect(suitWorthKeeping(v, "PIK")).toBe(false)
        expect(suitWorthKeeping(v, "TREF")).toBe(false)
        // PIK is two cards to TREF's three, so the shorter message finishes first.
        expect(signalDiscard(v, hand, true)).toBe("8PIK")

        // …and once PIK is empty the same rule opens TREF at the top.
        const rest: Card[] = ["QTREF", "JTREF", "9TREF", "AKARA", "10KARA"]
        expect(signalDiscard(mixed(rest), rest, true)).toBe("QTREF")
    })

    it("with every suit worth keeping, out goes the ace whose own 10 is at home", () => {
        const hand: Card[] = ["APIK", "10PIK", "AKARA", "7KARA"]
        const v = mixed(hand)
        expect(suitWorthKeeping(v, "PIK")).toBe(true)
        expect(suitWorthKeeping(v, "KARA")).toBe(true)
        expect(signalDiscard(v, hand, true)).toBe("APIK")
    })

    it("never throws a BARE ace — that one is a trick", () => {
        const hand: Card[] = ["APIK", "7PIK", "AKARA", "7KARA"]
        const chosen = signalDiscard(mixed(hand), hand, true)
        expect(chosen).not.toBe("APIK")
        expect(chosen).not.toBe("AKARA")
        expect(chosen).toBe("7PIK")
    })

    it("is null when only trumps are on offer — there is nothing to choose between", () => {
        const v = view({ seat: 0, hand: ["JHERC", "7HERC", "APIK"] })
        expect(signalDiscard(v, ["JHERC", "7HERC"], true)).toBeNull()
    })

    /* The example the rule was written from (BOT.md §2.3): trump KARA, my
       partner runs five trumps, and I hold HERC A-10-K, TREF A-10, PIK 8-7 and
       the KARA 7. Junk goes before anything valuable, and an ace only goes
       because its own 10 stays at home to inherit the suit. */
    it("the worked example: five trump leads, junk before the aces", () => {
        /** One step of the run: what I hold, what is face up, what he led. */
        const step = (hand: Card[], played: Card[], lead: Card, follow: Card): PlayerView =>
            view({
                seat: 0,
                hand,
                played,
                bidding: { turn: 2, passes: [], trump: "KARA", caller: 2 },
                // Partner (seat 2) leads, seat 3 follows, I am third to play.
                trick: {
                    leader: 2,
                    turn: 0,
                    cards: [{ seat: 2, card: lead }, { seat: 3, card: follow }],
                },
            })

        const full: Card[] = ["AHERC", "10HERC", "KHERC", "ATREF", "10TREF", "8PIK", "7PIK", "7KARA"]

        // 1. I still hold a trump, so §1.5 leaves exactly one legal card. A
        //    forced card carries no message and none is invented for it.
        const t1 = step(full, [], "JKARA", "8KARA")
        expect(signalDiscard(t1, ["7KARA"], true)).toBeNull()

        // 2. Void in trump now. PIK is the only suit with no trick in it, so it
        //    is abandoned from the top: "there is nothing for me here".
        const after1: Card[] = ["JKARA", "8KARA", "7KARA", "QKARA"]
        const t2Hand: Card[] = ["AHERC", "10HERC", "KHERC", "ATREF", "10TREF", "8PIK", "7PIK"]
        const t2 = step(t2Hand, after1, "9KARA", "9PIK")
        expect(signalDiscard(t2, t2Hand, true)).toBe("8PIK")

        // 3. …and the rest of the same suit, still high to low.
        const after2: Card[] = [...after1, "9KARA", "9PIK", "8PIK", "7HERC"]
        const t3Hand: Card[] = ["AHERC", "10HERC", "KHERC", "ATREF", "10TREF", "7PIK"]
        const t3 = step(t3Hand, after2, "AKARA", "JPIK")
        expect(signalDiscard(t3, t3Hand, true)).toBe("7PIK")

        // 4. Only HERC and TREF are left and both are worth keeping, so one
        //    has to be broken into — and the ace with its own 10 behind it is
        //    the one card that costs nothing.
        const after3: Card[] = [...after2, "AKARA", "JPIK", "7PIK", "8HERC"]
        const t4Hand: Card[] = ["AHERC", "10HERC", "KHERC", "ATREF", "10TREF"]
        const t4 = step(t4Hand, after3, "10KARA", "QPIK")
        expect(signalDiscard(t4, t4Hand, true)).toBe("AHERC")

        // 5. The second ace goes for exactly the same reason. The two tens and
        //    the king come home as the masters of their suits.
        const after4: Card[] = [...after3, "10KARA", "QPIK", "AHERC", "9HERC"]
        const t5Hand: Card[] = ["10HERC", "KHERC", "ATREF", "10TREF"]
        const t5 = step(t5Hand, after4, "KKARA", "KPIK")
        expect(signalDiscard(t5, t5Hand, true)).toBe("ATREF")
    })
})

describe("partnerSignal (BOT.md §3)", () => {
    /** Seat 0, trump HERC, so my partner is seat 2 and the plain suits are
     *  KARA/PIK/TREF. `wonTrick(1, …)` deals the cards to seats 1, 2, 3, 0. */
    const withHistory = (trickHistory: WonTrick[]): PlayerView =>
        view({ seat: 0, hand: ["7PIK", "8TREF"], trickHistory })

    it("says nothing before anybody has discarded", () => {
        expect(partnerSignal(withHistory([]))).toEqual({ wants: null, avoids: [] })
    })

    it("says nothing when he has only ever followed suit", () => {
        const v = withHistory([wonTrick(1, ["7KARA", "8KARA", "9KARA", "10KARA"], 0)])
        expect(partnerSignal(v)).toEqual({ wants: null, avoids: [] })
    })

    it("an ACE thrown away asks for that suit — his 10 is still at home", () => {
        const v = withHistory([
            wonTrick(1, ["7HERC", "7TREF", "8HERC", "9HERC"], 3), // he pitched a TREF
            wonTrick(1, ["10HERC", "AKARA", "JHERC", "QHERC"], 3), // …then the KARA ace
        ])
        // The ace outranks the "untouched suit" reading, and the suit he asked
        // for is dropped from `avoids`: it is the one he wants led.
        expect(partnerSignal(v)).toEqual({ wants: "KARA", avoids: ["TREF"] })
    })

    it("discards from every plain suit but one name the one he is protecting", () => {
        const v = withHistory([
            wonTrick(1, ["7HERC", "7KARA", "8HERC", "9HERC"], 3),
            wonTrick(1, ["10HERC", "8PIK", "JHERC", "QHERC"], 3),
        ])
        expect(partnerSignal(v)).toEqual({ wants: "TREF", avoids: ["KARA", "PIK"] })
    })

    it("does NOT guess while two suits are still untouched", () => {
        const v = withHistory([wonTrick(1, ["7HERC", "7KARA", "8HERC", "9HERC"], 3)])
        // PIK and TREF are both candidates, so the bot invents nothing — but it
        // still records the suit he threw from.
        expect(partnerSignal(v)).toEqual({ wants: null, avoids: ["KARA"] })
    })

    it("reads only MY partner's discards, not an opponent's", () => {
        // Seat 3 (an opponent) pitched the KARA ace; seat 2 followed suit.
        const v = withHistory([wonTrick(1, ["7HERC", "8HERC", "AKARA", "9HERC"], 3)])
        expect(partnerSignal(v)).toEqual({ wants: null, avoids: [] })
    })
})

describe("handTricks / bestTrumpSuit (BOT.md §1)", () => {
    it("prices each line of the document's table", () => {
        expect(handTricks(["JHERC"], "HERC")).toBe(1)
        expect(handTricks(["9HERC"], "HERC")).toBe(0.9)
        expect(handTricks(["AHERC"], "HERC")).toBe(0.55)
        expect(handTricks(["10HERC"], "HERC")).toBe(0.3)
        expect(handTricks(["APIK"], "HERC")).toBe(0.8) // a plain ace is nearly a trump 9
        expect(handTricks(["10PIK", "KPIK"], "HERC")).toBe(0.45) // backed ten
        expect(handTricks(["10PIK"], "HERC")).toBe(0.1) // bare ten: food
        expect(handTricks(["KHERC", "QHERC"], "HERC")).toBe(0.2) // bela
    })

    it("pays 0.45 for every trump past the third, and nothing for the first three", () => {
        // Three worthless trumps are worth nothing at all…
        expect(handTricks(["7HERC", "8HERC", "QHERC", "7PIK"], "HERC")).toBe(0)
        // …the fourth is a ruff waiting to happen (here alongside the bela)…
        expect(handTricks(["7HERC", "8HERC", "QHERC", "KHERC"], "HERC")).toBeCloseTo(0.65, 10)
        // …and length adds to the ranks rather than replacing them.
        expect(handTricks(["7HERC", "8HERC", "QHERC", "JHERC"], "HERC")).toBeCloseTo(1.45, 10)
    })

    it("scores the document's own example hands", () => {
        // "dečko i dva strana asa" — the hand the old trump-only score refused.
        expect(
            handTricks(["JHERC", "7HERC", "APIK", "7PIK", "ATREF", "7TREF"], "HERC"),
        ).toBeCloseTo(2.6, 10)
        // "dečko i mala u adutu te strani as"
        expect(
            handTricks(["JHERC", "7HERC", "APIK", "7PIK", "8TREF", "9TREF"], "HERC"),
        ).toBeCloseTo(1.8, 10)
        // "bela (K+Q) i 9 u adutu te bezec 10 u strancu"
        expect(
            handTricks(["9HERC", "KHERC", "QHERC", "10PIK", "KPIK", "7TREF"], "HERC"),
        ).toBeCloseTo(1.55, 10)
    })

    it("names the suit by the TRUMP holding, never by the plain aces", () => {
        // Three plain aces and one long, weak suit. TREF holds no honour worth
        // the name, but it is the only suit this hand could actually run — and
        // it is LAST in the suit order, so no tie-break can be doing the work.
        const hand: Card[] = ["AHERC", "AKARA", "APIK", "10TREF", "QTREF", "KTREF"]
        expect(bestTrumpSuit(hand, ["HERC", "KARA", "PIK", "TREF"])).toBe("TREF")
        expect(suitStrength(hand, "TREF")).toBe(2)
        expect(suitStrength(hand, "HERC")).toBe(1.5)

        // …and here is why the choice cannot be made with `handTricks`: the
        // aces are most of it and they are worth the same whichever suit is
        // named, so all three ace suits score identically.
        expect(handTricks(hand, "HERC")).toBeCloseTo(handTricks(hand, "KARA"), 10)
        expect(handTricks(hand, "HERC")).toBeCloseTo(handTricks(hand, "PIK"), 10)
    })

    it("names the jack's suit when there is a jack", () => {
        const hand: Card[] = ["JTREF", "7TREF", "AHERC", "AKARA", "7PIK", "8PIK"]
        expect(bestTrumpSuit(hand, ["HERC", "KARA", "PIK", "TREF"])).toBe("TREF")
    })
})

describe("isThinLead (BOT.md §5.5)", () => {
    const v = view({
        seat: 0,
        hand: ["7HERC", "7PIK", "AKARA", "10TREF", "7TREF", "8TREF"],
    })

    it("is true for a singleton plain card — 2:1 against whatever you hoped for", () => {
        expect(isThinLead(v, "7PIK")).toBe(true)
    })

    it("is true for a 10 that is not the master of its suit", () => {
        expect(isMasterCard(v, "10TREF")).toBe(false) // the ace is still out
        expect(isThinLead(v, "10TREF")).toBe(true)
    })

    it("is false for a trump: the whole rule is about plain suits", () => {
        expect(isThinLead(v, "7HERC")).toBe(false)
    })

    it("is false for a singleton that IS the master of its suit", () => {
        expect(isThinLead(v, "AKARA")).toBe(false)
    })

    it("is false for a card from a suit I hold more than one of", () => {
        expect(isThinLead(v, "7TREF")).toBe(false)
    })

    it("is false for a master 10, singleton or not", () => {
        const aceGone = view({
            seat: 0,
            hand: ["10PIK", "7HERC", "8HERC", "9HERC"],
            played: ["APIK", "7KARA", "8KARA", "9KARA"],
        })
        expect(isMasterCard(aceGone, "10PIK")).toBe(true)
        expect(isThinLead(aceGone, "10PIK")).toBe(false)
    })

    it("is false once the hand is down to three cards — everything is thin then", () => {
        const end = view({ seat: 0, hand: ["7PIK", "10TREF", "8TREF"] })
        expect(isThinLead(end, "7PIK")).toBe(false)
        expect(isThinLead(end, "10TREF")).toBe(false)
    })
})

describe("aceToCash (BOT.md §5.3)", () => {
    it("is null while an opponent can still hold a trump", () => {
        const v = view({ seat: 0, hand: ["APIK", "7PIK", "8TREF"] })
        expect(trumpOutlook(v).opponentMax).toBeGreaterThan(0)
        expect(aceToCash(v, v.hand)).toBeNull()
    })

    it("cashes the ace once they provably cannot ruff it", () => {
        // Every trump is accounted for: four in my hand, four face up.
        const v = view({
            seat: 0,
            hand: ["APIK", "7PIK", "7HERC", "8HERC", "9HERC", "10HERC"],
            played: ["JHERC", "QHERC", "KHERC", "AHERC"],
        })
        expect(trumpOutlook(v).opponentMax).toBe(0)
        expect(aceToCash(v, v.hand)).toBe("APIK")
    })

    it("never cashes a SOLO ace — it would ask him to keep a 10 I can never reach", () => {
        const v = view({
            seat: 0,
            hand: ["APIK", "8TREF", "7HERC", "8HERC", "9HERC", "10HERC"],
            played: ["JHERC", "QHERC", "KHERC", "AHERC"],
        })
        expect(trumpOutlook(v).opponentMax).toBe(0)
        expect(aceToCash(v, v.hand)).toBeNull()
    })

    it("never offers the trump ace: this rule is about the plain suits", () => {
        const v = view({
            seat: 0,
            hand: ["AHERC", "10HERC", "9HERC", "8HERC", "7HERC", "JHERC", "QHERC", "KHERC"],
        })
        expect(trumpOutlook(v).opponentMax).toBe(0) // I hold every trump there is
        expect(aceToCash(v, v.hand)).toBeNull()
    })
})

describe("callerTrumpLead (BOT.md §5.2)", () => {
    const asCaller = (hand: Card[], caller: Seat = 0): PlayerView =>
        view({
            seat: 0,
            hand,
            dealer: 3,
            bidding: { turn: 0, passes: [], trump: "HERC", caller },
        })

    it("is null when this seat is not the caller — the sequence is the caller's", () => {
        const hand: Card[] = ["JHERC", "9HERC", "AHERC", "APIK"]
        expect(callerTrumpLead(asCaller(hand, 2), hand)).toBeNull()
        expect(callerTrumpLead(asCaller(hand, 1), hand)).toBeNull()
    })

    it("J+9+A of trump AND a plain ace → the trump ACE first", () => {
        // "ne odbacuj potkovanu 10, imat ćeš vremena": the ace draws while the
        // jack and the nine stay behind it.
        const hand: Card[] = ["JHERC", "9HERC", "AHERC", "APIK", "7PIK"]
        expect(callerTrumpLead(asCaller(hand), hand)).toBe("AHERC")
    })

    it("J+9+A of trump WITHOUT a plain ace → the 9, so the ace and jack follow", () => {
        const hand: Card[] = ["JHERC", "9HERC", "AHERC", "7PIK", "8PIK"]
        expect(callerTrumpLead(asCaller(hand), hand)).toBe("9HERC")
    })

    it("is null when the J-9-A sequence is broken — trumpDrawCard keeps its own rule", () => {
        const noNine: Card[] = ["JHERC", "AHERC", "10HERC", "APIK"]
        expect(callerTrumpLead(asCaller(noNine), noNine)).toBeNull()
        const noTrump: Card[] = ["APIK", "10PIK", "8TREF"]
        expect(callerTrumpLead(asCaller(noTrump), noTrump)).toBeNull()
    })

    it("offers only what is LEGAL: the jack held back by §1.5 is not the ace's stand-in", () => {
        // The sequence needs all three in `legal`; with the jack unplayable the
        // rule steps aside rather than substituting something else.
        const hand: Card[] = ["JHERC", "9HERC", "AHERC", "APIK"]
        expect(callerTrumpLead(asCaller(hand), ["9HERC", "AHERC"])).toBeNull()
    })
    /* "Podigravati dečka u glavu, kad nemaš više od tri aduta, jedino ćeš ako
       imaš sve najjače strance" (BOT.md §5.2). Re-instated 2026-09-09 at the
       user's request after the measurement had taken it out; BOT.md §11 keeps
       what it costs. Note the condition is about the PLAIN suits — asking
       `hasWinnersToCash` instead made this branch dead code, because the trump
       jack is itself a master. */
    it("does not lead the jack 'u glavu' on a short trump holding", () => {
        const v = view({
            seat: 0,
            hand: ["JHERC", "7HERC", "7PIK", "8PIK"],
            bidding: { turn: 1, passes: [], trump: "HERC", caller: 0 },
        })
        // Two trumps, and the spades are headed by nothing: the jack wins one
        // trick and gives the lead straight back. Go under with the seven.
        expect(callerTrumpLead(v, v.hand)).toBe("7HERC")
    })

    it("…but does lead it when every plain suit I hold is headed by a master", () => {
        const v = view({
            seat: 0,
            hand: ["JHERC", "7HERC", "APIK", "KPIK"],
            bidding: { turn: 1, passes: [], trump: "HERC", caller: 0 },
        })
        // PIK is topped by its ace, so the lead comes back to a hand that can
        // cash — "osim ako držiš sve najjače strance".
        expect(callerTrumpLead(v, v.hand)).toBeNull()
    })

    it("a hand of nothing but trumps has no plain suit to protect", () => {
        const v = view({
            seat: 0,
            hand: ["JHERC", "7HERC"],
            bidding: { turn: 1, passes: [], trump: "HERC", caller: 0 },
        })
        expect(callerTrumpLead(v, v.hand)).toBeNull()
    })

    it("a hand of nothing but trumps has no plain suit to protect", () => {
        const v = view({
            seat: 0,
            hand: ["JHERC", "7HERC"],
            bidding: { turn: 1, passes: [], trump: "HERC", caller: 0 },
        })
        expect(callerTrumpLead(v, v.hand)).toBeNull()
    })

})

/* ──────────────────────────────────────────────────────────────────────────
   BOT.md §9 — the second batch of unwritten rules, 2026-09-09.
   ────────────────────────────────────────────────────────────────────── */

describe("iAmDefending", () => {
    /** Seat 0 is team A with seat 2; seats 1 and 3 are the other pair. */
    const called = (caller: Seat | null): PlayerView =>
        view({ seat: 0, hand: ["7HERC"], bidding: { turn: 1, passes: [], trump: "HERC", caller } })

    it("is true when the OTHER pair named the trump", () => {
        expect(iAmDefending(called(1))).toBe(true)
        expect(iAmDefending(called(3))).toBe(true)
    })

    it("is false when I called, and false when my partner did", () => {
        expect(iAmDefending(called(0))).toBe(false)
        expect(iAmDefending(called(2))).toBe(false)
    })

    it("is false before there is a caller at all — nobody is defending yet", () => {
        expect(iAmDefending(called(null))).toBe(false)
    })
})

describe("fillPreferringTen (BOT.md §4 — A or 10 by who called)", () => {
    /** Seat 0, trump HERC, and `caller` decides which side is defending. */
    const withCaller = (caller: Seat, hand: Card[]): PlayerView =>
        view({ seat: 0, hand, bidding: { turn: 1, passes: [], trump: "HERC", caller } })

    it("defending, a plain ace chosen and its 10 on offer → the TEN goes instead", () => {
        // "tako da igrač koji je zvao misli da njegov suigrač ima tog asa jer
        // ti bježiš sa 10" — the caller reads the missing ace as his partner's.
        const v = withCaller(1, ["APIK", "10PIK", "7TREF"])
        expect(fillPreferringTen(v, "APIK", ["APIK", "10PIK", "7TREF"])).toBe("10PIK")
    })

    it("is null when OUR side called — then the ace goes, so my partner keeps his 10", () => {
        const hand: Card[] = ["APIK", "10PIK", "7TREF"]
        expect(fillPreferringTen(withCaller(0, hand), "APIK", hand)).toBeNull()
        expect(fillPreferringTen(withCaller(2, hand), "APIK", hand)).toBeNull()
    })

    it("is null when the chosen card is not an ace — there is nothing to disguise", () => {
        const hand: Card[] = ["APIK", "10PIK", "KPIK"]
        const v = withCaller(1, hand)
        expect(fillPreferringTen(v, "10PIK", hand)).toBeNull()
        expect(fillPreferringTen(v, "KPIK", hand)).toBeNull()
    })

    it("is null when the 10 of that same suit is not in the pool", () => {
        // The 10 is in another suit, and the ace's own 10 is nowhere.
        const hand: Card[] = ["APIK", "10TREF", "7TREF"]
        expect(fillPreferringTen(withCaller(1, hand), "APIK", hand)).toBeNull()
    })

    it("is null for the TRUMP ace: the rule is about the plain suits", () => {
        const hand: Card[] = ["AHERC", "10HERC", "7TREF"]
        expect(fillPreferringTen(withCaller(1, hand), "AHERC", hand)).toBeNull()
    })
})

describe("nineOnPartnersLowTrump (BOT.md §9 — obveze devetke)", () => {
    /** Seat 0's partner is seat 2; he is the trick's leader in every case. */
    const partnerOpened = (card: Card, hand: Card[] = ["9HERC", "QHERC", "7PIK"]): PlayerView =>
        view({
            seat: 0,
            hand,
            trick: { leader: 2, turn: 0, cards: [{ seat: 2, card }] },
        })

    it("partner opened with the trump 7 or 8 → the nine, the card that draws", () => {
        expect(nineOnPartnersLowTrump(partnerOpened("7HERC"), ["9HERC", "QHERC"])).toBe("9HERC")
        expect(nineOnPartnersLowTrump(partnerOpened("8HERC"), ["9HERC", "QHERC"])).toBe("9HERC")
    })

    it("is null on an empty trick — there is no opening to answer", () => {
        const v = view({ seat: 0, hand: ["9HERC", "QHERC"] })
        expect(nineOnPartnersLowTrump(v, v.hand)).toBeNull()
    })

    it("is null when the low trump came from an OPPONENT", () => {
        const v = view({
            seat: 0,
            hand: ["9HERC", "QHERC", "7PIK"],
            trick: { leader: 1, turn: 0, cards: [{ seat: 1, card: "7HERC" }] },
        })
        expect(nineOnPartnersLowTrump(v, ["9HERC", "QHERC"])).toBeNull()
    })

    it("is null when my partner opened a PLAIN suit", () => {
        expect(nineOnPartnersLowTrump(partnerOpened("7PIK"), ["9HERC", "QHERC"])).toBeNull()
    })

    it("is null when he opened a HIGH trump — he is not asking to be gone over", () => {
        expect(nineOnPartnersLowTrump(partnerOpened("AHERC"), ["9HERC", "QHERC"])).toBeNull()
    })

    it("is null when I do not hold the nine", () => {
        expect(nineOnPartnersLowTrump(partnerOpened("8HERC"), ["QHERC", "KHERC"])).toBeNull()
    })
})

describe("defensiveLead (BOT.md §7 — the four hand shapes)", () => {
    /** Seat 0 defending: seat 1 (an opponent) called HERC. */
    const defending = (hand: Card[]): PlayerView =>
        view({ seat: 0, hand, bidding: { turn: 1, passes: [], trump: "HERC", caller: 1 } })

    it("is null when OUR OWN side called — this is the defenders' opening book", () => {
        const hand: Card[] = ["7HERC", "APIK", "7PIK", "10TREF", "KTREF", "7KARA"]
        const ours = view({
            seat: 0,
            hand,
            bidding: { turn: 1, passes: [], trump: "HERC", caller: 0 },
        })
        expect(defensiveLead(ours, hand)).toBeNull()
        const partners = view({
            seat: 0,
            hand,
            bidding: { turn: 1, passes: [], trump: "HERC", caller: 2 },
        })
        expect(defensiveLead(partners, hand)).toBeNull()
    })

    it("is null on three cards or fewer — the endgame cashes what there is", () => {
        const hand: Card[] = ["APIK", "10TREF", "KTREF"]
        expect(defensiveLead(defending(hand), hand)).toBeNull()
    })

    it("shape 1: an ace here and a backed 10 there → open the TEN's suit, low", () => {
        // "Tad ćeš imati dvije boje za potencijalni štih": the ace suit waits,
        // and the king goes out ahead of its own ten.
        const hand: Card[] = ["APIK", "7PIK", "10TREF", "KTREF", "7KARA", "8KARA"]
        expect(defensiveLead(defending(hand), hand)).toBe("KTREF")
    })

    it("shape 2: three or more trumps → the longest plain suit I hold no ace in", () => {
        // "igraš boju gdje si dug, a nemaš asa" — TREF (three) over KARA (one),
        // and PIK is out of the running because the ace lives there.
        const hand: Card[] = ["7HERC", "8HERC", "QHERC", "APIK", "7KARA", "7TREF", "8TREF", "9TREF"]
        expect(defensiveLead(defending(hand), hand)).toBe("7TREF")
    })

    it("shape 3: exactly two plain aces → the third suit", () => {
        // "otvaraj treću boju gdje nemaš asa": PIK and TREF are held back.
        const hand: Card[] = ["7HERC", "APIK", "7PIK", "ATREF", "7TREF", "7KARA", "8KARA"]
        expect(defensiveLead(defending(hand), hand)).toBe("7KARA")
    })

    it("shape 4: no ace and no backed 10 → the long suit", () => {
        // "nego solo kartu boje koju bi možda sjekao" — the long one, not the
        // singleton TREF pair's worth of hope.
        const hand: Card[] = ["7HERC", "7PIK", "8PIK", "9PIK", "7TREF", "8TREF"]
        expect(defensiveLead(defending(hand), hand)).toBe("7PIK")
    })

    it("is null for a hand that is none of the four shapes", () => {
        // One ace, no backed 10 anywhere else, two trumps: shape 1 has no ten
        // to point at, shape 2 wants three trumps, shape 3 wants two aces, and
        // shape 4 wants no ace at all. The ordinary opening book is better.
        const hand: Card[] = ["7HERC", "APIK", "7PIK", "8PIK", "7TREF", "8TREF"]
        expect(defensiveLead(defending(hand), hand)).toBeNull()

        // …and a backed 10 sitting INSIDE the ace suit is not a second suit,
        // so shape 1 does not fire on it either.
        const together: Card[] = ["7HERC", "APIK", "10PIK", "7PIK", "7TREF", "8TREF"]
        expect(defensiveLead(defending(together), together)).toBeNull()
    })

    it("never opens a singleton, even when it is the only ace-less suit left", () => {
        // Three trumps put this in shape 2, but both ace-less suits are one
        // card: a singleton lead is 2:1 against, so the rule steps aside.
        const hand: Card[] = ["7HERC", "8HERC", "QHERC", "APIK", "10PIK", "KPIK", "7KARA", "7TREF"]
        expect(defensiveLead(defending(hand), hand)).toBeNull()
    })

    it("never opens a suit I hold the ace in, even when that suit is my longest", () => {
        const hand: Card[] = ["7HERC", "8HERC", "QHERC", "APIK", "7PIK", "8PIK", "7TREF", "8TREF"]
        const chosen = defensiveLead(defending(hand), hand)
        expect(chosen).toBe("7TREF")
        expect(cardSuit(chosen as Card)).not.toBe("PIK")
    })
})

describe("declarationRead (BOT.md §9 — an opponent's declared ace)", () => {
    /** Seat 0: seat 1 plays AFTER me (left), seat 3 plays BEFORE me (right). */
    const withDeclarations = (
        per: Partial<Record<Seat, Declaration[]>>,
        revealed = true,
    ): PlayerView =>
        view({
            seat: 0,
            hand: ["7PIK", "8TREF"],
            bidding: { turn: 1, passes: [], trump: "HERC", caller: 1 },
            declarations: per,
            declarationsRevealed: revealed,
        })

    const seq = (cards: Card[]): Declaration => ({ kind: "SEQUENCE", cards, points: 20 })

    it("says nothing while the declarations are still hidden", () => {
        const hidden = withDeclarations({ 1: [seq(["QPIK", "KPIK", "APIK"])] }, false)
        expect(declarationRead(hidden)).toEqual({ avoid: [], prefer: [] })
    })

    it("the opponent on my LEFT plays after me, so his ace suit goes in `avoid`", () => {
        const v = withDeclarations({ 1: [seq(["QPIK", "KPIK", "APIK"])] })
        expect(declarationRead(v)).toEqual({ avoid: ["PIK"], prefer: [] })
    })

    it("the opponent on my RIGHT plays before me, so his ace suit goes in `prefer`", () => {
        // He has to spend it under my own cards.
        const v = withDeclarations({ 3: [seq(["QKARA", "KKARA", "AKARA"])] })
        expect(declarationRead(v)).toEqual({ avoid: [], prefer: ["KARA"] })
    })

    it("reads both opponents at once", () => {
        const v = withDeclarations({
            1: [seq(["QPIK", "KPIK", "APIK"])],
            3: [seq(["QKARA", "KKARA", "AKARA"])],
        })
        expect(declarationRead(v)).toEqual({ avoid: ["PIK"], prefer: ["KARA"] })
    })

    it("ignores my own declarations and my partner's — the rule is about opponents", () => {
        const v = withDeclarations({
            0: [seq(["QPIK", "KPIK", "APIK"])],
            2: [seq(["QKARA", "KKARA", "AKARA"])],
        })
        expect(declarationRead(v)).toEqual({ avoid: [], prefer: [] })
    })

    it("ignores the TRUMP ace: opening trump is not what this decides", () => {
        // Four aces from the seat on my left: the three plain suits are named,
        // HERC is the trump and is dropped.
        const fourAces: Declaration = {
            kind: "FOUR",
            cards: ["AHERC", "AKARA", "APIK", "ATREF"],
            points: 100,
        }
        const v = withDeclarations({ 1: [fourAces] })
        expect(declarationRead(v)).toEqual({ avoid: ["KARA", "PIK", "TREF"], prefer: [] })
    })

    it("says nothing about a declaration that names no ace", () => {
        const v = withDeclarations({ 1: [seq(["7PIK", "8PIK", "9PIK"])] })
        expect(declarationRead(v)).toEqual({ avoid: [], prefer: [] })
    })
})

describe("pointsShortOfPass (BOT.md §8 — the pass is 82)", () => {
    /** Seat 0 is team A. */
    const banked = (cards: number, declarations?: number): PlayerView =>
        view({
            seat: 0,
            hand: ["10PIK", "7TREF"],
            currentDealPoints: { A: cards, B: 0 },
            ...(declarations === undefined ? {} : { declarationPoints: { A: declarations, B: 0 } }),
        })

    it("is the whole 82 before a trick has been settled", () => {
        expect(pointsShortOfPass(banked(0))).toBe(82)
    })

    it("subtracts the card points collected so far", () => {
        expect(pointsShortOfPass(banked(50))).toBe(32)
    })

    it("counts the declaration bonus towards the pass too", () => {
        expect(pointsShortOfPass(banked(50, 20))).toBe(12)
    })

    it("is zero exactly on the pass, and negative once it is banked", () => {
        expect(pointsShortOfPass(banked(82))).toBe(0)
        expect(pointsShortOfPass(banked(90))).toBe(-8)
        expect(pointsShortOfPass(banked(62, 20))).toBe(0)
    })
})

describe("tenThatSecuresThePass (BOT.md §8)", () => {
    /** Seat 0, team A, with `cards` already banked and `trick` on the table. */
    const scenario = (cards: number, trick: { seat: Seat; card: Card }[]): PlayerView =>
        view({
            seat: 0,
            hand: ["10PIK", "APIK", "7TREF"],
            currentDealPoints: { A: cards, B: 0 },
            trick: { leader: 2, turn: 0, cards: trick },
        })

    it("is null once the pass is already banked — the 10 can wait", () => {
        const v = scenario(90, [{ seat: 2, card: "JHERC" }])
        expect(pointsShortOfPass(v)).toBeLessThan(0)
        expect(tenThatSecuresThePass(v, ["10PIK", "7TREF"])).toBeNull()
    })

    it("is null when the pool holds no PLAIN 10 — the trump 10 is not this rule's", () => {
        const v = scenario(60, [{ seat: 2, card: "JHERC" }])
        expect(tenThatSecuresThePass(v, ["APIK", "7TREF"])).toBeNull()
        expect(tenThatSecuresThePass(v, ["10HERC", "7TREF"])).toBeNull()
    })

    it("is null while this trick plus the 10 still falls short of the pass", () => {
        // 32 short, and a 13-point trick with the ten in it reaches 23.
        const v = scenario(50, [
            { seat: 2, card: "10KARA" },
            { seat: 3, card: "QPIK" },
        ])
        expect(pointsShortOfPass(v)).toBe(32)
        expect(tenThatSecuresThePass(v, ["10PIK", "7TREF"])).toBeNull()
    })

    it("feeds the 10 the moment this trick carries us over", () => {
        // 22 short, the same 13 points on the table: 13 + 10 = 23 is the pass.
        const v = scenario(60, [
            { seat: 2, card: "10KARA" },
            { seat: 3, card: "QPIK" },
        ])
        expect(pointsShortOfPass(v)).toBe(22)
        expect(tenThatSecuresThePass(v, ["10PIK", "7TREF"])).toBe("10PIK")
    })
})

describe("forceOutTheLastTrump (BOT.md §9)", () => {
    /** Six trumps face up, so the one I do not hold is the only one left. */
    const sixTrumpsGone: Card[] = ["8HERC", "9HERC", "10HERC", "QHERC", "KHERC", "AHERC"]

    it("leads the low card of my longest ace-less suit to make the last trump fall", () => {
        // JHERC is the only trump unaccounted for and it beats my 7; PIK is
        // three cards and holds no ace, so it is the suit that "runs away".
        const hand: Card[] = ["7HERC", "7PIK", "8PIK", "9PIK", "7TREF"]
        const v = view({ seat: 0, hand, played: sixTrumpsGone, handSizes: { 0: 5, 1: 5, 2: 5, 3: 5 } })
        expect(forceOutTheLastTrump(v, hand)).toBe("7PIK")
    })

    it("is null when I hold no trump at all — there is nothing to protect", () => {
        const hand: Card[] = ["7PIK", "8PIK", "9PIK", "7TREF"]
        const v = view({
            seat: 0,
            hand,
            played: [...sixTrumpsGone, "7HERC"],
            handSizes: { 0: 4, 1: 4, 2: 4, 3: 4 },
        })
        expect(forceOutTheLastTrump(v, hand)).toBeNull()
    })

    it("is null while MORE than one trump is still outstanding", () => {
        // Only five are face up, so two are still out: this is the middle game
        // and drawing them is `shouldDrawTrumps`' business, not this rule's.
        const hand: Card[] = ["7HERC", "7PIK", "8PIK", "9PIK", "7TREF"]
        const v = view({ seat: 0, hand, played: sixTrumpsGone.slice(0, 5) })
        expect(forceOutTheLastTrump(v, hand)).toBeNull()
    })

    it("is null when the one trump left does NOT beat my best", () => {
        // I hold the jack and the 7 is the straggler: nothing to force out.
        const hand: Card[] = ["JHERC", "7PIK", "8PIK", "9PIK", "7TREF"]
        const v = view({ seat: 0, hand, played: sixTrumpsGone })
        expect(forceOutTheLastTrump(v, hand)).toBeNull()
    })

    it("is null when the opponents provably cannot hold it — it is my partner's", () => {
        // Both opponents discarded on a trump lead, so the outstanding jack can
        // only be seat 2's, and forcing my own partner achieves nothing.
        const hand: Card[] = ["7HERC", "7PIK", "8PIK", "9PIK", "7TREF"]
        const played: Card[] = ["9HERC", "7KARA", "10HERC", "8KARA", "8HERC", "QHERC", "KHERC", "AHERC"]
        const v = view({
            seat: 0,
            hand,
            played,
            handSizes: { 0: 5, 1: 5, 2: 5, 3: 5 },
            lastTrick: wonTrick(0, ["9HERC", "7KARA", "10HERC", "8KARA"], 2),
        })
        expect(trumpOutlook(v).opponentMax).toBe(0)
        expect(forceOutTheLastTrump(v, hand)).toBeNull()
    })

    it("never leads a singleton: the running-away suit has to be a real suit", () => {
        // The shape is right — one trump out, above mine, possibly an
        // opponent's — but every ace-less plain suit is one card.
        const hand: Card[] = ["7HERC", "APIK", "10PIK", "7KARA", "7TREF"]
        const v = view({ seat: 0, hand, played: sixTrumpsGone, handSizes: { 0: 5, 1: 5, 2: 5, 3: 5 } })
        expect(forceOutTheLastTrump(v, hand)).toBeNull()
    })
})

/* ──────────────────────────────────────────────────────────────────────────
   Štiglja and the rules re-instated on 2026-09-09 (BOT.md §8 and §11).
   ────────────────────────────────────────────────────────────────────── */

describe("stigljaIsLive / shouldChaseStiglja (BOT.md §8)", () => {
    /** Team A holds every trick so far and is past the 82-point pass. */
    const chasing = (over: Partial<PlayerView> = {}): PlayerView =>
        view({
            tricksWon: { A: 5, B: 0 },
            currentDealPoints: { A: 90, B: 0 },
            ...over,
            seat: 0,
            hand: (over.hand ?? ["AHERC", "APIK"]) as Card[],
        })

    it("is dead the moment the opponents take a trick", () => {
        expect(stigljaIsLive(chasing())).toBe(true)
        expect(stigljaIsLive(chasing({ tricksWon: { A: 5, B: 1 } }))).toBe(false)
    })

    it("is dead with no cards left to play for", () => {
        expect(stigljaIsLive(chasing({ hand: [] }))).toBe(false)
    })

    it("does not chase while the pass is still in doubt — 'ne riskiraj pad'", () => {
        expect(shouldChaseStiglja(chasing({ currentDealPoints: { A: 40, B: 0 } }))).toBe(false)
        expect(shouldChaseStiglja(chasing())).toBe(true)
    })

    it("counts the declaration bonus and the points on the table towards the pass", () => {
        const byDeclarations = chasing({
            currentDealPoints: { A: 62, B: 0 },
            declarationPoints: { A: 20, B: 0 },
        })
        expect(shouldChaseStiglja(byDeclarations)).toBe(true)

        // 70 banked, 12 on the table: with every trick so far ours, the trick
        // in progress is ours too, so the pass is already there.
        const byTable = chasing({
            currentDealPoints: { A: 70, B: 0 },
            trick: { leader: 2, turn: 0, cards: [{ seat: 2, card: "AKARA" }, { seat: 3, card: "JHERC" }] },
        })
        expect(shouldChaseStiglja(byTable)).toBe(true)
        expect(shouldChaseStiglja(chasing({ currentDealPoints: { A: 70, B: 0 } }))).toBe(false)
    })
})

describe("stigljaLead / stigljaTakeOver (BOT.md §8)", () => {
    it("leads only from a hand where every card is a master", () => {
        // 9HERC is not a master: JHERC is still out there.
        const loose = view({
            seat: 0,
            hand: ["9HERC", "APIK"],
            tricksWon: { A: 5, B: 0 },
            currentDealPoints: { A: 90, B: 0 },
        })
        expect(stigljaLead(loose, loose.hand)).toBeNull()
    })

    it("cashes the trump first while a ruff is still possible", () => {
        const v = view({
            seat: 0,
            hand: ["JHERC", "APIK"],
            handSizes: { 0: 2, 1: 2, 2: 2, 3: 2 },
            played: ["7PIK", "8PIK", "9PIK", "10PIK", "JPIK", "QPIK", "KPIK"],
            tricksWon: { A: 5, B: 0 },
            currentDealPoints: { A: 90, B: 0 },
        })
        // Both cards are masters; HERC is unaccounted for, so a plain lead
        // could be ruffed and the trump goes first.
        expect(stigljaLead(v, v.hand)).toBe("JHERC")
    })

    it("keeps the trump for last once nobody can ruff", () => {
        const v = view({
            seat: 0,
            hand: ["JHERC", "APIK"],
            played: [
                "7HERC", "8HERC", "9HERC", "10HERC", "QHERC", "KHERC", "AHERC",
                "7PIK", "8PIK", "9PIK", "10PIK", "JPIK", "QPIK", "KPIK",
            ],
            tricksWon: { A: 5, B: 0 },
            currentDealPoints: { A: 90, B: 0 },
        })
        expect(stigljaLead(v, v.hand)).toBe("APIK")
    })

    it("takes a trick off the partner when it is not safe and the štiglja is alive", () => {
        const v = view({
            seat: 0,
            hand: ["AKARA", "7TREF"],
            tricksWon: { A: 5, B: 0 },
            currentDealPoints: { A: 90, B: 0 },
            // Partner leads a plain king; seat 1 can still beat it or ruff.
            trick: { leader: 2, turn: 0, cards: [{ seat: 2, card: "KKARA" }] },
        })
        expect(partnerTrickIsSafe(v)).toBe(false)
        expect(stigljaTakeOver(v, ["AKARA", "7TREF"])).toBe("AKARA")
    })

    it("never takes it off him once the trick is safe, nor outside a chase", () => {
        const safe = view({
            seat: 0,
            hand: ["AKARA", "7TREF"],
            tricksWon: { A: 5, B: 0 },
            currentDealPoints: { A: 90, B: 0 },
            trick: {
                leader: 1,
                turn: 0,
                cards: [{ seat: 1, card: "7KARA" }, { seat: 2, card: "JHERC" }, { seat: 3, card: "8KARA" }],
            },
        })
        expect(stigljaTakeOver(safe, ["AKARA", "7TREF"])).toBeNull()

        const notChasing = view({
            seat: 0,
            hand: ["AKARA", "7TREF"],
            tricksWon: { A: 4, B: 1 },
            currentDealPoints: { A: 90, B: 20 },
            trick: { leader: 2, turn: 0, cards: [{ seat: 2, card: "KKARA" }] },
        })
        expect(stigljaTakeOver(notChasing, ["AKARA", "7TREF"])).toBeNull()
    })
})

describe("isLastOfADeadSuit / partnerAskedForTrump (BOT.md §2.2a, §5)", () => {
    it("knows the card of a suit nobody else can hold", () => {
        const v = view({
            seat: 0,
            hand: ["7PIK", "8HERC"],
            played: ["8PIK", "9PIK", "10PIK", "JPIK", "QPIK", "KPIK", "APIK"],
        })
        expect(isLastOfADeadSuit(v, "7PIK")).toBe(true)
        expect(isLastOfADeadSuit(v, "8HERC")).toBe(false) // the trump never counts
    })

    it("reads a partner's low trump opening as 'vrati aduta'", () => {
        const base: { seat: Seat; hand: Card[]; handSizes: Record<Seat, number> } = {
            seat: 0,
            hand: ["7HERC", "8PIK"],
            handSizes: { 0: 2, 1: 2, 2: 2, 3: 2 },
        }
        const asked = view({
            ...base,
            trickHistory: [wonTrick(2, ["8HERC", "10HERC", "7PIK", "9PIK"], 2)],
        })
        expect(partnerAskedForTrump(asked)).toBe(true)

        // An opponent's low trump opening says nothing to me.
        const opponent = view({
            ...base,
            trickHistory: [wonTrick(1, ["8HERC", "10HERC", "7PIK", "9PIK"], 1)],
        })
        expect(partnerAskedForTrump(opponent)).toBe(false)

        // Nor does a HIGH trump opening.
        const high = view({
            ...base,
            trickHistory: [wonTrick(2, ["AHERC", "10HERC", "7PIK", "9PIK"], 2)],
        })
        expect(partnerAskedForTrump(high)).toBe(false)
    })

    it("stops asking once the opponents provably hold no trump", () => {
        const v = view({
            seat: 0,
            hand: ["7HERC", "8PIK"],
            handSizes: { 0: 2, 1: 2, 2: 2, 3: 2 },
            played: ["8HERC", "9HERC", "10HERC", "JHERC", "QHERC", "KHERC", "AHERC"],
            trickHistory: [wonTrick(2, ["8HERC", "10HERC", "7PIK", "9PIK"], 2)],
        })
        expect(trumpOutlook(v).opponentMax).toBe(0)
        expect(partnerAskedForTrump(v)).toBe(false)
    })
})

/* ── INFERENCE — who holds what (BOT.md §11) ──────────────────────────── */

/** A SEQUENCE in the engine's shape: cards ascending in natural rank order. */
function seqDecl(cards: Card[]): Declaration {
    return { kind: "SEQUENCE", cards, points: cards.length === 3 ? 20 : cards.length === 4 ? 50 : 100 }
}

describe("locatedCards (BOT.md §11)", () => {
    it("locates nothing when nobody declared", () => {
        const v = view({ seat: 0, hand: ["7HERC", "8PIK"] })
        expect(locatedCards(v).size).toBe(0)
    })

    it("puts every card of my partner's sequence in HIS hand", () => {
        // A declaration NAMES its cards, so each one is proof of an owner —
        // the largest free read in the deal.
        const v = view({
            seat: 0,
            hand: ["7HERC", "8HERC"],
            declarations: { 2: [seqDecl(["8PIK", "9PIK", "10PIK"])] },
        })
        const located = locatedCards(v)
        expect(located.get("8PIK")).toBe(2)
        expect(located.get("9PIK")).toBe(2)
        expect(located.get("10PIK")).toBe(2)
        expect(located.size).toBe(3)
    })

    it("a FOUR locates all four of its cards", () => {
        const four: Declaration = {
            kind: "FOUR",
            cards: ["JHERC", "JKARA", "JPIK", "JTREF"],
            points: 200,
        }
        const v = view({ seat: 0, hand: ["7HERC", "8PIK"], declarations: { 1: [four] } })
        const located = locatedCards(v)
        expect([...located.keys()].sort()).toEqual(["JHERC", "JKARA", "JPIK", "JTREF"])
        expect([...located.values()]).toEqual([1, 1, 1, 1])
    })

    it("drops cards that are face up — a located card that has been played is just a played card", () => {
        const v = view({
            seat: 0,
            hand: ["7HERC", "8HERC"],
            declarations: { 2: [seqDecl(["8PIK", "9PIK", "10PIK"])] },
            played: ["8PIK"], // completed trick
            trick: { leader: 2, turn: 0, cards: [{ seat: 2, card: "9PIK" }] }, // trick in progress
        })
        const located = locatedCards(v)
        expect(located.has("8PIK")).toBe(false)
        expect(located.has("9PIK")).toBe(false)
        expect(located.get("10PIK")).toBe(2) // the only one still in his hand
        expect(located.size).toBe(1)
    })

    it("keeps both seats apart when two of them declared", () => {
        const v = view({
            seat: 0,
            hand: ["7HERC", "8HERC"],
            declarations: {
                0: [seqDecl(["7HERC", "8HERC", "9HERC"])],
                2: [seqDecl(["QTREF", "KTREF", "ATREF"])],
            },
        })
        const located = locatedCards(v)
        expect(located.get("7HERC")).toBe(0)
        expect(located.get("9HERC")).toBe(0)
        expect(located.get("QTREF")).toBe(2)
        expect(located.get("ATREF")).toBe(2)
        expect(located.size).toBe(6)
    })
})

describe("readSeatFromLeads (BOT.md §11)", () => {
    /** Seat 0 watching; trump HERC; `caller` names the seat that called it. */
    const withCaller = (caller: Seat, over: Partial<PlayerView> = {}): PlayerView => {
        const base = view({
            seat: 0,
            hand: ["7PIK", "8TREF"],
            bidding: { turn: 1, passes: [], trump: "HERC", caller },
        })
        return { ...base, ...over }
    }

    it("the CALLER opened with the trump ACE → he holds the jack and the nine", () => {
        // He would not spend the ace with either of them missing: the card
        // above it would take the trick off him.
        const v = withCaller(2, {
            trickHistory: [wonTrick(2, ["AHERC", "7HERC", "7PIK", "8PIK"], 2)],
        })
        expect(readSeatFromLeads(v, 2).holds).toEqual(["JHERC", "9HERC"])
        expect(readSeatFromLeads(v, 2).lacks).toEqual([])
    })

    it("the CALLER opened with the trump NINE → he holds the jack and the ace", () => {
        const v = withCaller(2, {
            trickHistory: [wonTrick(2, ["9HERC", "7HERC", "7PIK", "8PIK"], 2)],
        })
        expect(readSeatFromLeads(v, 2).holds).toEqual(["JHERC", "AHERC"])
    })

    it("ANY seat opening the trump KING or QUEEN denies the jack — with it he leads it", () => {
        // Seat 1 is not the caller; the K/Q reading does not care who called,
        // because leading one is what you do INSTEAD of leading the jack.
        const king = withCaller(2, {
            trickHistory: [wonTrick(1, ["KHERC", "7HERC", "8HERC", "7PIK"], 1)],
        })
        expect(readSeatFromLeads(king, 1)).toEqual({ holds: [], lacks: ["JHERC"] })

        const queen = withCaller(2, {
            trickHistory: [wonTrick(1, ["QHERC", "7HERC", "8HERC", "7PIK"], 1)],
        })
        expect(readSeatFromLeads(queen, 1)).toEqual({ holds: [], lacks: ["JHERC"] })
    })

    it("says nothing about a seat that never opened a trick", () => {
        // Seat 2 played the trump ace, but seat 1 LED it: only an opening is a
        // sentence, following suit is an obligation.
        const v = withCaller(2, {
            trickHistory: [wonTrick(1, ["7HERC", "AHERC", "8HERC", "7PIK"], 2)],
        })
        expect(readSeatFromLeads(v, 2)).toEqual({ holds: [], lacks: [] })
    })

    it("says nothing about a PLAIN-suit opening", () => {
        const v = withCaller(2, {
            trickHistory: [wonTrick(2, ["APIK", "7PIK", "8PIK", "9PIK"], 2)],
        })
        expect(readSeatFromLeads(v, 2)).toEqual({ holds: [], lacks: [] })
    })

    it("says nothing when a NON-caller opens the trump ace or nine", () => {
        // The sequencing is the caller's own convention (`callerTrumpLead`);
        // a defender leading the same card is not saying it.
        const ace = withCaller(2, {
            trickHistory: [wonTrick(1, ["AHERC", "7HERC", "8HERC", "7PIK"], 1)],
        })
        expect(readSeatFromLeads(ace, 1)).toEqual({ holds: [], lacks: [] })

        const nine = withCaller(2, {
            trickHistory: [wonTrick(3, ["9HERC", "7HERC", "8HERC", "7PIK"], 3)],
        })
        expect(readSeatFromLeads(nine, 3)).toEqual({ holds: [], lacks: [] })
    })

    it("reads the trick in progress as well as the completed ones", () => {
        const v = withCaller(2, {
            trick: { leader: 2, turn: 3, cards: [{ seat: 2, card: "AHERC" }] },
        })
        expect(readSeatFromLeads(v, 2).holds).toEqual(["JHERC", "9HERC"])
    })

    it("accumulates both halves across history and the current trick", () => {
        // Seat 1 opened the king in trick one and seat 2 (the caller) is
        // opening the ace right now: two seats, two sentences, read apart.
        const v = withCaller(2, {
            trickHistory: [wonTrick(1, ["KHERC", "7HERC", "8HERC", "7PIK"], 1)],
            trick: { leader: 2, turn: 3, cards: [{ seat: 2, card: "AHERC" }] },
        })
        expect(readSeatFromLeads(v, 1).lacks).toEqual(["JHERC"])
        expect(readSeatFromLeads(v, 2).holds).toEqual(["JHERC", "9HERC"])
    })

    it("says nothing at all before a trump is named", () => {
        const v = view({
            seat: 0,
            hand: ["7PIK"],
            bidding: { turn: 1, passes: [], trump: null, caller: null },
        })
        expect(readSeatFromLeads(v, 2)).toEqual({ holds: [], lacks: [] })
    })
})

describe("belaSeat (BOT.md §11)", () => {
    it("is null while no bela has been announced", () => {
        const v = view({
            seat: 0,
            hand: ["7PIK"],
            belaDeclared: null,
            trickHistory: [wonTrick(2, ["KHERC", "7HERC", "8HERC", "7PIK"], 2)],
        })
        expect(belaSeat(v)).toBeNull()
    })

    it("pins the TEAM in `belaDeclared` to the seat that played the first trump K/Q", () => {
        // `belaDeclared` is a team, which is not enough to reason with; the
        // trick record says which of the two seats actually holds K+Q.
        const v = view({
            seat: 0,
            hand: ["7PIK"],
            belaDeclared: "A",
            trickHistory: [wonTrick(2, ["KHERC", "7HERC", "8HERC", "7PIK"], 2)],
        })
        expect(belaSeat(v)).toBe(2)
    })

    it("finds it in the trick in progress too", () => {
        const v = view({
            seat: 0,
            hand: ["7PIK"],
            belaDeclared: "B",
            trick: { leader: 1, turn: 2, cards: [{ seat: 1, card: "QHERC" }] },
        })
        expect(belaSeat(v)).toBe(1)
    })

    it("ignores a trump K/Q played by the OTHER team", () => {
        // Team A announced the bela; seat 1 is team B, so his king is just a
        // king and the announcing seat is still unknown.
        const v = view({
            seat: 0,
            hand: ["7PIK"],
            belaDeclared: "A",
            trickHistory: [wonTrick(1, ["KHERC", "7HERC", "8HERC", "7PIK"], 1)],
        })
        expect(belaSeat(v)).toBeNull()
    })

    it("takes the FIRST of the pair's two cards, not the later one", () => {
        const v = view({
            seat: 0,
            hand: ["7PIK"],
            belaDeclared: "A",
            trickHistory: [
                wonTrick(0, ["KHERC", "7HERC", "8HERC", "7PIK"], 0),
                wonTrick(2, ["QHERC", "9HERC", "8PIK", "9PIK"], 2),
            ],
        })
        expect(belaSeat(v)).toBe(0)
    })
})

describe("opponentCanHold (BOT.md §11)", () => {
    it("is false for a card in my own hand", () => {
        const v = view({ seat: 0, hand: ["AHERC", "7PIK"] })
        expect(opponentCanHold(v, "AHERC")).toBe(false)
    })

    it("is false for a card already face up", () => {
        const v = view({
            seat: 0,
            hand: ["7PIK"],
            played: ["AHERC"],
            trick: { leader: 1, turn: 0, cards: [{ seat: 1, card: "KHERC" }] },
        })
        expect(opponentCanHold(v, "AHERC")).toBe(false) // completed trick
        expect(opponentCanHold(v, "KHERC")).toBe(false) // trick in progress
    })

    it("is false for a card a declaration locates with my PARTNER", () => {
        const v = view({
            seat: 0,
            hand: ["7PIK"],
            declarations: { 2: [seqDecl(["QTREF", "KTREF", "ATREF"])] },
        })
        expect(opponentCanHold(v, "ATREF")).toBe(false)
    })

    it("is false for a card my OWN declaration names", () => {
        // Realistically the card is in my hand as well (the check at the top
        // of the function), but the located map agrees: it is on our side.
        const v = view({
            seat: 0,
            hand: ["7HERC", "8HERC", "9HERC"],
            declarations: { 0: [seqDecl(["7HERC", "8HERC", "9HERC"])] },
        })
        expect(locatedCards(v).get("9HERC")).toBe(0)
        expect(opponentCanHold(v, "9HERC")).toBe(false)
    })

    it("is TRUE for a card located with an OPPONENT — located is not the same as ours", () => {
        const v = view({
            seat: 0,
            hand: ["7PIK"],
            declarations: { 1: [seqDecl(["QTREF", "KTREF", "ATREF"])] },
        })
        expect(opponentCanHold(v, "ATREF")).toBe(true)
    })

    it("is true for an unseen card nothing accounts for", () => {
        const v = view({ seat: 0, hand: ["7PIK"] })
        expect(opponentCanHold(v, "AHERC")).toBe(true)
    })

    it("is false for the trump K and Q once the bela is on MY side", () => {
        // Seat 2 (my partner) announced it, so both of the bela's cards are
        // his — an opponent can hold neither.
        const v = view({
            seat: 0,
            hand: ["7PIK"],
            belaDeclared: "A",
            played: ["KHERC"],
            trickHistory: [wonTrick(2, ["KHERC", "7HERC", "8HERC", "7PIK"], 2)],
        })
        expect(belaSeat(v)).toBe(2)
        expect(opponentCanHold(v, "QHERC")).toBe(false)
    })

    it("…but a bela on the OPPONENTS' side proves the opposite", () => {
        const v = view({
            seat: 0,
            hand: ["7PIK"],
            belaDeclared: "B",
            played: ["KHERC"],
            trickHistory: [wonTrick(1, ["KHERC", "7HERC", "8HERC", "7PIK"], 1)],
        })
        expect(belaSeat(v)).toBe(1)
        expect(opponentCanHold(v, "QHERC")).toBe(true)
    })

    it("is false for a card my PARTNER's lead proved he holds", () => {
        // Seat 2 called and opened with the trump ace: he holds the jack and
        // the nine, so neither is an opponent's any more.
        const v = view({
            seat: 0,
            hand: ["7PIK", "8TREF"],
            bidding: { turn: 1, passes: [], trump: "HERC", caller: 2 },
            played: ["AHERC", "7HERC", "7PIK", "8PIK"],
            trickHistory: [wonTrick(2, ["AHERC", "7HERC", "7PIK", "8PIK"], 2)],
        })
        expect(opponentCanHold(v, "JHERC")).toBe(false)
        expect(opponentCanHold(v, "9HERC")).toBe(false)
        expect(opponentCanHold(v, "10HERC")).toBe(true) // nothing said about that one
    })

    it("does NOT read my own seat that way — my hand is the only thing that decides", () => {
        // I am the caller and I opened with the trump ace, so the convention
        // would "prove" I hold the jack. I do not, and inferring about myself
        // would make a card I cannot see disappear from the count.
        const v = view({
            seat: 0,
            hand: ["7PIK", "8TREF"],
            bidding: { turn: 1, passes: [], trump: "HERC", caller: 0 },
            played: ["AHERC", "7HERC", "7PIK", "8PIK"],
            trickHistory: [wonTrick(0, ["AHERC", "7HERC", "7PIK", "8PIK"], 0)],
        })
        expect(readSeatFromLeads(v, 0).holds).toContain("JHERC")
        expect(opponentCanHold(v, "JHERC")).toBe(true)
    })
})

describe("provablyNoTrumpJack (BOT.md §11)", () => {
    it("is true from a trump run that stops at the 10 — a maximal run would have swallowed the jack", () => {
        const v = view({
            seat: 0,
            hand: ["7PIK"],
            bidding: { turn: 1, passes: [], trump: "HERC", caller: 2 },
            declarations: { 1: [seqDecl(["8HERC", "9HERC", "10HERC"])] },
            declarationsRevealed: true,
        })
        expect(provablyNoTrumpJack(v, 1)).toBe(true)
    })

    it("is true from a trump run that starts at the queen", () => {
        const v = view({
            seat: 0,
            hand: ["7PIK"],
            bidding: { turn: 1, passes: [], trump: "HERC", caller: 2 },
            declarations: { 1: [seqDecl(["QHERC", "KHERC", "AHERC"])] },
            declarationsRevealed: true,
        })
        expect(provablyNoTrumpJack(v, 1)).toBe(true)
    })

    it("is true from a KING or QUEEN opening — the spoken half the old function could not hear", () => {
        const king = view({
            seat: 0,
            hand: ["7PIK"],
            bidding: { turn: 1, passes: [], trump: "HERC", caller: 2 },
            trickHistory: [wonTrick(1, ["KHERC", "7HERC", "8HERC", "7PIK"], 1)],
        })
        expect(seatProvablyLacksTrumpJack(king, 1)).toBe(false) // no declaration says it
        expect(provablyNoTrumpJack(king, 1)).toBe(true)

        const queen = view({
            seat: 0,
            hand: ["7PIK"],
            bidding: { turn: 1, passes: [], trump: "HERC", caller: 2 },
            trick: { leader: 3, turn: 0, cards: [{ seat: 3, card: "QHERC" }] },
        })
        expect(provablyNoTrumpJack(queen, 3)).toBe(true)
    })

    it("is false when nothing proves it", () => {
        const v = view({
            seat: 0,
            hand: ["7PIK"],
            bidding: { turn: 1, passes: [], trump: "HERC", caller: 2 },
            trickHistory: [wonTrick(1, ["APIK", "7PIK", "8PIK", "9PIK"], 1)],
        })
        expect(provablyNoTrumpJack(v, 1)).toBe(false)
    })
})

describe("belaLead (BOT.md §11)", () => {
    /** Seat 0, trump HERC, my partner (seat 2) called: the seat the sending
     *  convention belongs to. */
    const asCallersPartner = (hand: Card[], over: Partial<PlayerView> = {}): PlayerView => {
        const base = view({
            seat: 0,
            hand,
            bidding: { turn: 1, passes: [], trump: "HERC", caller: 2 },
            trick: { leader: 0, turn: 0, cards: [] },
        })
        return { ...base, ...over }
    }

    it("leads the KING with the bela — 'bela, and no jack here'", () => {
        const hand: Card[] = ["KHERC", "QHERC", "7PIK", "8TREF"]
        const v = asCallersPartner(hand)
        expect(trumpOutlook(v).opponentMax).toBeGreaterThan(0)
        expect(belaLead(v, hand)).toBe("KHERC")
    })

    it("leads the QUEEN with the bela AND the nine — 'on će znati da je devet kod tebe'", () => {
        const hand: Card[] = ["KHERC", "QHERC", "9HERC", "7PIK"]
        expect(belaLead(asCallersPartner(hand), hand)).toBe("QHERC")
    })

    it("is null with the trump jack in hand — then the JACK is the lead", () => {
        // The bela's cards are what you lead INSTEAD of the jack, which is
        // exactly what makes the message readable.
        const hand: Card[] = ["KHERC", "QHERC", "JHERC", "7PIK"]
        expect(belaLead(asCallersPartner(hand), hand)).toBeNull()
    })

    it("is null when I called myself, or when the opponents called", () => {
        const hand: Card[] = ["KHERC", "QHERC", "7PIK", "8TREF"]
        const mine = asCallersPartner(hand, {
            bidding: { turn: 1, passes: [], trump: "HERC", caller: 0 },
        })
        expect(belaLead(mine, hand)).toBeNull()

        const theirs = asCallersPartner(hand, {
            bidding: { turn: 1, passes: [], trump: "HERC", caller: 1 },
        })
        expect(belaLead(theirs, hand)).toBeNull()
    })

    it("is null without BOTH the king and the queen — there is no bela to announce", () => {
        const noQueen: Card[] = ["KHERC", "9HERC", "7PIK", "8TREF"]
        expect(belaLead(asCallersPartner(noQueen), noQueen)).toBeNull()

        const noKing: Card[] = ["QHERC", "9HERC", "7PIK", "8TREF"]
        expect(belaLead(asCallersPartner(noKing), noKing)).toBeNull()
    })

    it("is null once the opponents provably hold no trump — the message has nothing left to organise", () => {
        const hand: Card[] = ["KHERC", "QHERC", "7PIK", "8TREF"]
        const v = asCallersPartner(hand, {
            handSizes: { 0: 4, 1: 4, 2: 4, 3: 4 },
            played: ["7HERC", "8HERC", "9HERC", "10HERC", "JHERC", "AHERC"],
        })
        expect(trumpOutlook(v).opponentMax).toBe(0)
        expect(belaLead(v, hand)).toBeNull()
    })

    it("is null when the card it wants is not legal", () => {
        // §1.5 has left me on a suit obligation: the king is in my hand but
        // not in `legalMoves`, and the bot never chooses outside that list.
        const hand: Card[] = ["KHERC", "QHERC", "7PIK", "8TREF"]
        expect(belaLead(asCallersPartner(hand), ["7PIK", "8TREF"])).toBeNull()
    })
})
