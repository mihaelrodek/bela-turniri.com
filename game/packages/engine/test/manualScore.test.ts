import { describe, expect, it } from "vitest"
import type { ManualDealInput, ManualSide } from "../src/index"
import { EngineError, scoreManualDeal } from "../src/index"

/** A deal with the given card split, no declarations, no štiglja, "us" called. */
function deal(over: Partial<ManualDealInput> = {}): ManualDealInput {
    return {
        caller: "us",
        cards: { us: 100, them: 62 },
        declarations: { us: [], them: [] },
        stiglja: null,
        ...over,
    }
}

const other = (side: ManualSide): ManualSide => (side === "us" ? "them" : "us")

describe("scoreManualDeal — card points (BLOK.md §1, README §1.6)", () => {
    it("scores an ordinary pass: the caller has more, both sides keep their own", () => {
        const outcome = scoreManualDeal(deal({ cards: { us: 100, them: 62 } }))
        expect(outcome.fell).toBe(false)
        expect(outcome.total).toEqual({ us: 100, them: 62 })
        expect(outcome.cards).toEqual({ us: 100, them: 62 })
        expect(outcome.declarations).toEqual({ us: 0, them: 0 })
    })

    it("keeps the two sides' card points at 162 in every ordinary deal", () => {
        for (let us = 0; us <= 162; us++) {
            const outcome = scoreManualDeal(deal({ cards: { us, them: 162 - us } }))
            expect(outcome.cards.us + outcome.cards.them).toBe(162)
            // The deal's points are conserved by the fall rule too: it moves
            // them between the sides, it never creates or destroys any.
            expect(outcome.total.us + outcome.total.them).toBe(162)
        }
    })

    it("gives a passed deal to whoever earned it, caller or not", () => {
        // "them" called and passed on card points alone.
        const outcome = scoreManualDeal(deal({ caller: "them", cards: { us: 60, them: 102 } }))
        expect(outcome.fell).toBe(false)
        expect(outcome.total).toEqual({ us: 60, them: 102 })
    })
})

describe("scoreManualDeal — the fall rule", () => {
    it("falls when the caller has strictly fewer points", () => {
        const outcome = scoreManualDeal(deal({ caller: "us", cards: { us: 62, them: 100 } }))
        expect(outcome.fell).toBe(true)
        expect(outcome.total).toEqual({ us: 0, them: 162 })
    })

    it("falls on an exact tie — the caller must STRICTLY exceed (C === O is a fall)", () => {
        const outcome = scoreManualDeal(deal({ caller: "us", cards: { us: 81, them: 81 } }))
        expect(outcome.fell).toBe(true)
        expect(outcome.total).toEqual({ us: 0, them: 162 })
    })

    it("falls on a tie reached through declarations, not just through cards", () => {
        // C = 71 + 20 = 91, O = 91 + 0 = 91 → equal, so the caller falls.
        const outcome = scoreManualDeal(
            deal({
                caller: "us",
                cards: { us: 71, them: 91 },
                declarations: { us: [20], them: [] },
            }),
        )
        expect(outcome.fell).toBe(true)
        expect(outcome.total).toEqual({ us: 0, them: 182 })
    })

    it("hands the opponents every point of the deal on a fall, declarations included", () => {
        const outcome = scoreManualDeal(
            deal({
                caller: "us",
                cards: { us: 60, them: 102 },
                declarations: { us: [20], them: [50, 20] },
            }),
        )
        // C = 80, O = 172 → fall; the opponents take C + O = 252.
        expect(outcome.fell).toBe(true)
        expect(outcome.total).toEqual({ us: 0, them: 252 })
        expect(outcome.total.us + outcome.total.them).toBe(
            outcome.cards.us + outcome.cards.them + outcome.declarations.us + outcome.declarations.them,
        )
    })

    it("falls when the caller took no card points at all", () => {
        const outcome = scoreManualDeal(deal({ caller: "us", cards: { us: 0, them: 162 } }))
        expect(outcome.fell).toBe(true)
        expect(outcome.total).toEqual({ us: 0, them: 162 })
    })
})

describe("scoreManualDeal — declarations tip the deal either way", () => {
    it("turns a losing card split into a pass", () => {
        const cards = { us: 70, them: 92 }
        expect(scoreManualDeal(deal({ caller: "us", cards })).fell).toBe(true)

        const rescued = scoreManualDeal(
            deal({ caller: "us", cards, declarations: { us: [50], them: [] } }),
        )
        // C = 120 > O = 92.
        expect(rescued.fell).toBe(false)
        expect(rescued.total).toEqual({ us: 120, them: 92 })
    })

    it("turns a winning card split into a fall", () => {
        const cards = { us: 100, them: 62 }
        expect(scoreManualDeal(deal({ caller: "us", cards })).fell).toBe(false)

        const lost = scoreManualDeal(
            deal({ caller: "us", cards, declarations: { us: [], them: [50] } }),
        )
        // C = 100 vs O = 112 → fall, everything to them.
        expect(lost.fell).toBe(true)
        expect(lost.total).toEqual({ us: 0, them: 212 })
    })

    it("sums repeated declarations rather than keeping only the strongest", () => {
        const outcome = scoreManualDeal(
            deal({ caller: "us", cards: { us: 100, them: 62 }, declarations: { us: [20, 20, 50], them: [] } }),
        )
        expect(outcome.declarations.us).toBe(90)
        expect(outcome.total).toEqual({ us: 190, them: 62 })
    })

    it("accepts declaration values outside the five buttons — the blok does not referee", () => {
        const outcome = scoreManualDeal(
            deal({ caller: "us", cards: { us: 100, them: 62 }, declarations: { us: [30], them: [] } }),
        )
        expect(outcome.declarations.us).toBe(30)
    })
})

describe("scoreManualDeal — štiglja", () => {
    it.each<ManualSide>(["us", "them"])("scores a štiglja for %s as 252/0", (side) => {
        const cards = { us: 0, them: 0 }
        cards[side] = 252
        const outcome = scoreManualDeal(deal({ caller: side, cards, stiglja: side }))
        expect(outcome.cards[side]).toBe(252)
        expect(outcome.cards[other(side)]).toBe(0)
        expect(outcome.fell).toBe(false)
        expect(outcome.total[side]).toBe(252)
        expect(outcome.total[other(side)]).toBe(0)
    })

    it("falls when the caller was štiglja'd by the opponents", () => {
        const outcome = scoreManualDeal(
            deal({ caller: "us", cards: { us: 0, them: 252 }, stiglja: "them" }),
        )
        expect(outcome.fell).toBe(true)
        expect(outcome.total).toEqual({ us: 0, them: 252 })
    })

    it("still counts the loser's declarations on a štiglja", () => {
        // A štiglja does not silence declarations: the side with no tricks may
        // still have shown one, and on the caller's fall it all goes over.
        const outcome = scoreManualDeal(
            deal({
                caller: "us",
                cards: { us: 0, them: 252 },
                declarations: { us: [20], them: [] },
                stiglja: "them",
            }),
        )
        expect(outcome.declarations.us).toBe(20)
        expect(outcome.fell).toBe(true)
        expect(outcome.total).toEqual({ us: 0, them: 272 })
    })

    it("keeps the card points at 252/0 for a štiglja", () => {
        const outcome = scoreManualDeal(
            deal({ caller: "them", cards: { us: 252, them: 0 }, stiglja: "us" }),
        )
        expect(outcome.cards.us + outcome.cards.them).toBe(252)
    })
})

/** A belot deal: nothing was played, so the card split is 0/0. */
function belotDeal(side: ManualSide, over: Partial<ManualDealInput> = {}): ManualDealInput {
    return {
        caller: "us",
        cards: { us: 0, them: 0 },
        declarations: { us: [], them: [] },
        stiglja: null,
        belot: side,
        target: 1001,
        ...over,
    }
}

describe("scoreManualDeal — belot (BLOK.md §1.2)", () => {
    it.each<ManualSide>(["us", "them"])("awards the whole target to %s", (side) => {
        const outcome = scoreManualDeal(belotDeal(side))
        expect(outcome.total[side]).toBe(1001)
        expect(outcome.total[other(side)]).toBe(0)
        // No trick was played and no call went down.
        expect(outcome.cards).toEqual({ us: 0, them: 0 })
        expect(outcome.fell).toBe(false)
    })

    it("awards THE GAME'S target, not a hard-coded 1001", () => {
        for (const target of [501, 701, 1001, 2001]) {
            expect(scoreManualDeal(belotDeal("us", { target })).total.us).toBe(target)
        }
    })

    it("wins for the side that showed it even when the OTHER side called", () => {
        // The caller is irrelevant to a belot: it is not a call that can go
        // down, it is eight cards of one suit.
        const outcome = scoreManualDeal(belotDeal("them", { caller: "us" }))
        expect(outcome.total).toEqual({ us: 0, them: 1001 })
        expect(outcome.fell).toBe(false)
    })

    it("reports declarations but never adds them to the award", () => {
        const outcome = scoreManualDeal(
            belotDeal("us", { declarations: { us: [20], them: [50] } }),
        )
        expect(outcome.declarations).toEqual({ us: 20, them: 50 })
        expect(outcome.total).toEqual({ us: 1001, them: 0 })
    })

    it("treats an absent belot exactly like a null one", () => {
        const withNull = scoreManualDeal(deal({ belot: null }))
        const withAbsent = scoreManualDeal(deal())
        expect(withAbsent).toEqual(withNull)
    })

    it("ignores `target` entirely on a deal with no belot", () => {
        // Nothing reads it there, so nothing about it can be wrong.
        expect(scoreManualDeal(deal({ target: -7 })).total).toEqual({ us: 100, them: 62 })
    })
})

describe("scoreManualDeal — invalid input throws BAD_REQUEST", () => {
    const rejects = (input: unknown, hint: string) => {
        expect(() => scoreManualDeal(input as ManualDealInput), hint).toThrow(EngineError)
        try {
            scoreManualDeal(input as ManualDealInput)
        } catch (error) {
            expect((error as EngineError).code, hint).toBe("BAD_REQUEST")
        }
    }

    it("rejects a card split that does not total 162", () => {
        rejects(deal({ cards: { us: 100, them: 61 } }), "too few")
        rejects(deal({ cards: { us: 100, them: 63 } }), "too many")
        rejects(deal({ cards: { us: 0, them: 0 } }), "empty")
    })

    it("rejects negative and non-integer card points", () => {
        rejects(deal({ cards: { us: -10, them: 172 } }), "negative")
        rejects(deal({ cards: { us: 100.5, them: 61.5 } }), "fractional")
        rejects(deal({ cards: { us: Number.NaN, them: 62 } }), "NaN")
        rejects(deal({ cards: { us: Number.POSITIVE_INFINITY, them: 62 } }), "Infinity")
    })

    it("rejects a štiglja that contradicts the card split", () => {
        // 162/0 is the split the engine would have to "repair" by adding 90 —
        // it refuses instead; the caller stores 252/0 (BLOK.md §2).
        rejects(deal({ cards: { us: 162, them: 0 }, stiglja: "us" }), "no +90")
        rejects(deal({ cards: { us: 100, them: 62 }, stiglja: "us" }), "ordinary split")
        rejects(deal({ cards: { us: 252, them: 0 }, stiglja: "them" }), "wrong side")
        rejects(deal({ cards: { us: 252, them: 0 }, stiglja: null }), "252 without a štiglja")
    })

    it("rejects a bad caller or štiglja value", () => {
        rejects(deal({ caller: "we" as ManualSide }), "caller")
        rejects(deal({ stiglja: "nobody" as ManualSide }), "štiglja")
        rejects({ ...deal(), caller: undefined }, "missing caller")
    })

    it("rejects bad declarations", () => {
        rejects(deal({ declarations: { us: [-20], them: [] } }), "negative")
        rejects(deal({ declarations: { us: [20.5], them: [] } }), "fractional")
        rejects(deal({ declarations: { us: [Number.NaN], them: [] } }), "NaN")
        rejects({ ...deal(), declarations: { us: 20, them: [] } }, "not an array")
        rejects({ ...deal(), declarations: null }, "missing declarations")
    })

    it("rejects a belot that contradicts the rest of the deal", () => {
        // Both at once is impossible: a belot ends the deal before a trick is
        // led, so nobody can also have taken all eight of them.
        rejects(
            belotDeal("us", { stiglja: "us", cards: { us: 252, them: 0 } }),
            "belot + štiglja",
        )
        rejects(belotDeal("us", { stiglja: "them" }), "belot + opponents' štiglja")
        // The deal was not played, so no side took anything in tricks.
        rejects(belotDeal("us", { cards: { us: 100, them: 62 } }), "ordinary split")
        rejects(belotDeal("us", { cards: { us: 162, them: 0 } }), "all the card points")
        rejects(belotDeal("us", { cards: { us: 0, them: 162 } }), "points to the other side")
    })

    it("rejects a belot with no usable target", () => {
        rejects(belotDeal("us", { target: undefined }), "missing")
        rejects(belotDeal("us", { target: 0 }), "zero")
        rejects(belotDeal("us", { target: -1001 }), "negative")
        rejects(belotDeal("us", { target: 1001.5 }), "fractional")
        rejects(belotDeal("us", { target: Number.NaN }), "NaN")
        rejects(belotDeal("us", { target: Number.POSITIVE_INFINITY }), "Infinity")
    })

    it("rejects a bad belot value", () => {
        rejects(deal({ belot: "nobody" as ManualSide }), "not a side")
    })

    it("rejects a missing cards object and a missing input", () => {
        rejects({ ...deal(), cards: null }, "missing cards")
        rejects(null, "null input")
    })

    it("does not mutate its input", () => {
        const input = deal({
            caller: "us",
            cards: { us: 60, them: 102 },
            declarations: { us: [20], them: [50] },
        })
        const snapshot = JSON.parse(JSON.stringify(input))
        scoreManualDeal(input)
        expect(input).toEqual(snapshot)
    })
})
