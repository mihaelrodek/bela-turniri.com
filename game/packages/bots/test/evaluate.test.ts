import { describe, expect, it } from "vitest"
import type { Card } from "@bela/engine"
import {
    cheapestCard,
    cheapestDiscard,
    cheapestWinningCard,
    isLastToPlay,
    isPartnerHoldingTrick,
    mostValuableCard,
    suitLength,
    suitStrength,
    weakestCard,
    wouldWinTrick,
} from "../src/evaluate"
import { view } from "./helpers"

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
