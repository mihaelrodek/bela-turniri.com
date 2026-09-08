import { describe, expect, it } from "vitest"
import type { Card, Declaration, PlayerView, Seat, WonTrick } from "@bela/engine"
import { findDeclarations, legalBids, newGame, reduce, viewFor } from "@bela/engine"
import {
    callerWasForced,
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
    suitLength,
    suitStrength,
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

    it("keeps a bare ace of an untouched suit", () => {
        expect(shouldSpendAce(fresh(["APIK", "7PIK", "8TREF", "9TREF"]), "PIK")).toBe(false)
    })

    it("spends the ace when the 10 of the suit is in hand behind it", () => {
        expect(shouldSpendAce(fresh(["APIK", "10PIK", "8TREF", "9TREF"]), "PIK")).toBe(true)
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

    it("spends the ace when the suit is nearly exhausted", () => {
        const v = view({
            seat: 0,
            hand: ["APIK", "7PIK", "8TREF", "9TREF"],
            played: ["8PIK", "9PIK", "10PIK", "JPIK", "QPIK"], // only KPIK is left out there
            bidding: { turn: 1, passes: [], trump: "HERC", caller: 1 },
        })
        expect(shouldSpendAce(v, "PIK")).toBe(true)
    })

    it("spends the ace when an opponent has shown void in the suit", () => {
        const v = view({
            seat: 0,
            hand: ["APIK", "7PIK", "8TREF", "9TREF"],
            bidding: { turn: 1, passes: [], trump: "HERC", caller: 1 },
            lastTrick: wonTrick(0, ["7PIK", "8PIK", "KPIK", "8TREF"], 2), // seat 3 void
        })
        expect(shouldSpendAce(v, "PIK")).toBe(true)
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
