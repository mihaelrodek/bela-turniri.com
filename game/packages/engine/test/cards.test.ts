import { describe, expect, it } from "vitest"
import type { Card, Rank, Suit } from "../src/index"
import {
    RANKS,
    SUITS,
    cardPoints,
    cardRank,
    cardStrength,
    cardSuit,
    fullDeck,
    makeCard,
    nextSeat,
    partnerOf,
    opponentTeam,
    sortHand,
    teamOf,
} from "../src/index"

describe("deck", () => {
    it("has 32 distinct cards in a fixed suit-major order", () => {
        const deck = fullDeck()
        expect(deck).toHaveLength(32)
        expect(new Set(deck).size).toBe(32)
        expect(deck[0]).toBe("7HERC")
        expect(deck[7]).toBe("AHERC")
        expect(deck[8]).toBe("7KARA")
        expect(deck[31]).toBe("ATREF")
        expect(fullDeck()).toEqual(deck)
    })

    it("parses and formats every card id", () => {
        for (const suit of SUITS) {
            for (const rank of RANKS) {
                const card = makeCard(rank, suit)
                expect(cardSuit(card)).toBe(suit)
                expect(cardRank(card)).toBe(rank)
            }
        }
    })

    it("card ids are the concatenation rank+suit", () => {
        expect(makeCard("10", "PIK")).toBe("10PIK")
        expect(makeCard("J", "HERC")).toBe("JHERC")
        expect(cardRank("10PIK")).toBe("10")
        expect(cardSuit("10PIK")).toBe("PIK")
    })
})

describe("card points (README §1.3)", () => {
    it("sums to 152 for any trump, i.e. 162 with the last trick", () => {
        for (const trump of SUITS) {
            const total = fullDeck().reduce((sum, c) => sum + cardPoints(c, trump), 0)
            expect(total).toBe(152)
            expect(total + 10).toBe(162)
        }
    })

    it("uses the trump table in the trump suit", () => {
        const expected: Record<Rank, number> = {
            J: 20,
            "9": 14,
            A: 11,
            "10": 10,
            K: 4,
            Q: 3,
            "8": 0,
            "7": 0,
        }
        for (const rank of RANKS) {
            expect(cardPoints(makeCard(rank, "HERC"), "HERC")).toBe(expected[rank])
        }
    })

    it("uses the plain table outside the trump suit", () => {
        const expected: Record<Rank, number> = {
            A: 11,
            "10": 10,
            K: 4,
            Q: 3,
            J: 2,
            "9": 0,
            "8": 0,
            "7": 0,
        }
        for (const rank of RANKS) {
            expect(cardPoints(makeCard(rank, "PIK"), "HERC")).toBe(expected[rank])
        }
    })

    it("a whole trump suit is worth 62 and a plain suit 30", () => {
        const suitTotal = (suit: Suit, trump: Suit) =>
            RANKS.reduce((s, r) => s + cardPoints(makeCard(r, suit), trump), 0)
        expect(suitTotal("HERC", "HERC")).toBe(62)
        expect(suitTotal("PIK", "HERC")).toBe(30)
    })
})

describe("card strength (README §1.3)", () => {
    const strongestFirst = (order: readonly Rank[], suit: Suit, trump: Suit) =>
        order.map((r) => cardStrength(makeCard(r, suit), trump))

    it("orders trump J > 9 > A > 10 > K > Q > 8 > 7", () => {
        const values = strongestFirst(["J", "9", "A", "10", "K", "Q", "8", "7"], "HERC", "HERC")
        expect(values).toEqual([...values].sort((a, b) => b - a))
        expect(new Set(values).size).toBe(8)
    })

    it("orders plain suits A > 10 > K > Q > J > 9 > 8 > 7", () => {
        const values = strongestFirst(["A", "10", "K", "Q", "J", "9", "8", "7"], "PIK", "HERC")
        expect(values).toEqual([...values].sort((a, b) => b - a))
        expect(new Set(values).size).toBe(8)
    })

    it("a trump 7 is not comparable across suits by strength alone", () => {
        // Same numeric strength; the trick rules, not the number, decide.
        expect(cardStrength("7HERC", "HERC")).toBe(cardStrength("7PIK", "HERC"))
    })
})

describe("sortHand", () => {
    it("sorts by SUITS order then natural rank, and is stable across calls", () => {
        const hand: Card[] = ["ATREF", "7HERC", "10KARA", "JHERC", "9PIK", "KTREF", "QKARA"]
        const sorted = sortHand(hand)
        expect(sorted).toEqual(["7HERC", "JHERC", "10KARA", "QKARA", "9PIK", "KTREF", "ATREF"])
        expect(sortHand(sorted)).toEqual(sorted)
    })

    it("does not mutate its input", () => {
        const hand: Card[] = ["ATREF", "7HERC"]
        const snapshot = structuredClone(hand)
        sortHand(hand)
        expect(hand).toEqual(snapshot)
    })

    it("is trump-independent", () => {
        const hand: Card[] = ["7HERC", "JHERC", "AHERC"]
        expect(sortHand(hand)).toEqual(["7HERC", "JHERC", "AHERC"])
    })
})

describe("seats", () => {
    it("teams are 0,2 → A and 1,3 → B", () => {
        expect([teamOf(0), teamOf(1), teamOf(2), teamOf(3)]).toEqual(["A", "B", "A", "B"])
    })

    it("next and partner wrap around", () => {
        expect([nextSeat(0), nextSeat(3)]).toEqual([1, 0])
        expect([partnerOf(0), partnerOf(3)]).toEqual([2, 1])
        expect(opponentTeam("A")).toBe("B")
        expect(opponentTeam("B")).toBe("A")
    })
})
