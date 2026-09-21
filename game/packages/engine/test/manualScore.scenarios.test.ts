import { describe, expect, it } from "vitest"
import type { ManualDealInput, ManualSide } from "../src/index"
import { EngineError, scoreManualDeal } from "../src/index"

/** A deal with the given overrides, defaulting to: "us" called, 100/62 split, no declarations, no štiglja. */
function deal(over: Partial<ManualDealInput> = {}): ManualDealInput {
    return {
        caller: "us",
        cards: { us: 100, them: 62 },
        declarations: { us: [], them: [] },
        stiglja: null,
        ...over,
    }
}


describe("scoreManualDeal — scenario tests (30+ concrete cases)", () => {
    describe("ordinary deals without štiglja or belot", () => {
        it("caller wins on card points alone: 100/62", () => {
            const outcome = scoreManualDeal(deal({ caller: "us", cards: { us: 100, them: 62 } }))
            expect(outcome.fell).toBe(false)
            expect(outcome.total).toEqual({ us: 100, them: 62 })
            expect(outcome.cards).toEqual({ us: 100, them: 62 })
            expect(outcome.declarations).toEqual({ us: 0, them: 0 })
        })

        it("caller wins on card points alone: 81/81 — no, this is a TIE and therefore a fall", () => {
            // C = 81, O = 81 → equal, NOT strictly greater, so FALL.
            const outcome = scoreManualDeal(deal({ caller: "us", cards: { us: 81, them: 81 } }))
            expect(outcome.fell).toBe(true)
            expect(outcome.total).toEqual({ us: 0, them: 162 })
        })

        it("caller wins on card points alone: 82/80", () => {
            // C = 82 > O = 80 → pass.
            const outcome = scoreManualDeal(deal({ caller: "us", cards: { us: 82, them: 80 } }))
            expect(outcome.fell).toBe(false)
            expect(outcome.total).toEqual({ us: 82, them: 80 })
        })

        it("caller loses on card points: 60/102", () => {
            // C = 60 < O = 102 → fall; caller gets 0, opponents get C + O = 162.
            const outcome = scoreManualDeal(deal({ caller: "us", cards: { us: 60, them: 102 } }))
            expect(outcome.fell).toBe(true)
            expect(outcome.total).toEqual({ us: 0, them: 162 })
        })

        it("caller took zero card points: 0/162", () => {
            // C = 0 < O = 162 → fall.
            const outcome = scoreManualDeal(deal({ caller: "us", cards: { us: 0, them: 162 } }))
            expect(outcome.fell).toBe(true)
            expect(outcome.total).toEqual({ us: 0, them: 162 })
        })

        it("perfectly balanced: 81/81 (a tie is a fall)", () => {
            const outcome = scoreManualDeal(deal({ caller: "them", cards: { us: 81, them: 81 } }))
            expect(outcome.fell).toBe(true)
            // "them" called but did not strictly exceed "us", so "them" falls.
            // Caller ("them") gets 0, other ("us") gets C + O = 162.
            expect(outcome.total).toEqual({ us: 162, them: 0 })
        })

        it("caller's declaration alone turns a card loss into a pass: 70/92 + 50 for caller", () => {
            // C = 70 + 50 = 120 > O = 92 → pass.
            const outcome = scoreManualDeal(
                deal({ caller: "us", cards: { us: 70, them: 92 }, declarations: { us: [50], them: [] } })
            )
            expect(outcome.fell).toBe(false)
            expect(outcome.total).toEqual({ us: 120, them: 92 })
            expect(outcome.declarations).toEqual({ us: 50, them: 0 })
        })

        it("opponent's declaration turns a card win into a fall: 100/62 + 50 for opponent", () => {
            // C = 100 + 0 = 100, O = 62 + 50 = 112 → 100 < 112 → fall.
            const outcome = scoreManualDeal(
                deal({ caller: "us", cards: { us: 100, them: 62 }, declarations: { us: [], them: [50] } })
            )
            expect(outcome.fell).toBe(true)
            expect(outcome.total).toEqual({ us: 0, them: 212 })
        })

        it("balanced by multiple declarations: 80/82 + [20, 20] vs [20]", () => {
            // C = 80 + 40 = 120, O = 82 + 20 = 102 → 120 > 102 → pass.
            const outcome = scoreManualDeal(
                deal({
                    caller: "us",
                    cards: { us: 80, them: 82 },
                    declarations: { us: [20, 20], them: [20] },
                })
            )
            expect(outcome.fell).toBe(false)
            expect(outcome.total).toEqual({ us: 120, them: 102 })
            expect(outcome.declarations).toEqual({ us: 40, them: 20 })
        })

        it("both sides have declarations, caller falls: 71/91 + 20 vs 0", () => {
            // C = 71 + 20 = 91, O = 91 + 0 = 91 → equal → fall.
            const outcome = scoreManualDeal(
                deal({
                    caller: "us",
                    cards: { us: 71, them: 91 },
                    declarations: { us: [20], them: [] },
                })
            )
            expect(outcome.fell).toBe(true)
            expect(outcome.total).toEqual({ us: 0, them: 182 })
            expect(outcome.declarations).toEqual({ us: 20, them: 0 })
        })

        it("heavy declarations on both sides: 62/100 + 150 vs 100", () => {
            // C = 62 + 150 = 212, O = 100 + 100 = 200 → 212 > 200 → pass.
            const outcome = scoreManualDeal(
                deal({
                    caller: "us",
                    cards: { us: 62, them: 100 },
                    declarations: { us: [150], them: [100] },
                })
            )
            expect(outcome.fell).toBe(false)
            expect(outcome.total).toEqual({ us: 212, them: 200 })
        })

        it("when a fall happens, the caller gets 0 and the opponent gets C + O", () => {
            // C = 60 + 20 = 80, O = 102 + 50 + 20 = 172 → 80 < 172 → fall.
            // Caller gets 0, opponent gets 80 + 172 = 252.
            const outcome = scoreManualDeal(
                deal({
                    caller: "us",
                    cards: { us: 60, them: 102 },
                    declarations: { us: [20], them: [50, 20] },
                })
            )
            expect(outcome.fell).toBe(true)
            expect(outcome.total).toEqual({ us: 0, them: 252 })
            expect(outcome.total.us + outcome.total.them).toBe(
                outcome.cards.us + outcome.cards.them + outcome.declarations.us + outcome.declarations.them
            )
        })
    })

    describe("štiglja: one side took all eight tricks (252/0 card split)", () => {
        it("štiglja for 'us': cards 252/0, no declarations, caller wins", () => {
            // Straight win: 252 > 0.
            const outcome = scoreManualDeal(
                deal({ caller: "us", cards: { us: 252, them: 0 }, stiglja: "us" })
            )
            expect(outcome.fell).toBe(false)
            expect(outcome.total).toEqual({ us: 252, them: 0 })
            expect(outcome.cards).toEqual({ us: 252, them: 0 })
        })

        it("štiglja for 'them': cards 0/252, caller falls", () => {
            // Caller had no tricks; štiglja side wins.
            const outcome = scoreManualDeal(
                deal({ caller: "us", cards: { us: 0, them: 252 }, stiglja: "them" })
            )
            expect(outcome.fell).toBe(true)
            expect(outcome.total).toEqual({ us: 0, them: 252 })
        })

        it("štiglja for 'us' with only caller's declarations", () => {
            // C = 252 + 50, O = 0 → pass, caller keeps 302 total (252 + 50).
            const outcome = scoreManualDeal(
                deal({
                    caller: "us",
                    cards: { us: 252, them: 0 },
                    declarations: { us: [50], them: [] },
                    stiglja: "us",
                })
            )
            expect(outcome.fell).toBe(false)
            expect(outcome.total).toEqual({ us: 302, them: 0 })
            expect(outcome.declarations).toEqual({ us: 50, them: 0 })
        })

        it("štiglja for 'them': opponent's declarations are credited to them, caller loses", () => {
            // IMPORTANT: On a štiglja, the opponent's declarations go to the štiglja side.
            // C = 0, O = 252 + 50 = 302 → fall, but already lost to štiglja.
            // Expected: C_total = 0, O_total = 252 + 50 = 302.
            // BUT: we're crediting the opponent's declarations to them, so:
            // C_declarations = 0 (become 0 on a štiglja for the opposite side),
            // O_declarations = 50 (from opponent) + 20 (from caller, creditied to them on štiglja) = 70.
            // Wait, let me re-read the code...
            // Looking at lines 235-240, when there's a štiglja and NO belot:
            // declarations[winner] += declarations[loser]
            // declarations[loser] = 0
            // So if "them" has štiglja and won, "them" gets both its own declarations and caller's.
            // C_declarations was [20], O_declarations was [50].
            // After: C_declarations = 0, O_declarations = 50 + 20 = 70.
            // Total: C = 0 + 0 = 0, O = 252 + 70 = 322.
            const outcome = scoreManualDeal(
                deal({
                    caller: "us",
                    cards: { us: 0, them: 252 },
                    declarations: { us: [20], them: [50] },
                    stiglja: "them",
                })
            )
            expect(outcome.fell).toBe(true)
            expect(outcome.declarations).toEqual({ us: 0, them: 70 })
            expect(outcome.total).toEqual({ us: 0, them: 322 })
        })

        it("štiglja for 'us' with both sides' declarations", () => {
            // Caller is "us" and wins štiglja.
            // C_declarations = [20, 50] = 70, O_declarations = [20] = 20.
            // After štiglja: C_declarations = 70 + 20 = 90, O_declarations = 0.
            // Total: C = 252 + 90 = 342, O = 0 + 0 = 0.
            const outcome = scoreManualDeal(
                deal({
                    caller: "us",
                    cards: { us: 252, them: 0 },
                    declarations: { us: [20, 50], them: [20] },
                    stiglja: "us",
                })
            )
            expect(outcome.fell).toBe(false)
            expect(outcome.declarations).toEqual({ us: 90, them: 0 })
            expect(outcome.total).toEqual({ us: 342, them: 0 })
        })

        it("štiglja for non-caller, opponent called: 'them' called but 'us' took all tricks", () => {
            // "them" called but "us" took štiglja, so "us" wins.
            // C_declarations = [100], O_declarations = [50].
            // After štiglja for "us": C_declarations = 0, O_declarations = 100 + 50 = 150.
            // Wait no, let me re-read. The caller is "them". The štiglja side is "us".
            // So the winner (štiglja side) is "us", the loser is "them" (the caller).
            // declarations[us] += declarations[them] = 50 + 100 = 150.
            // declarations[them] = 0.
            // Total: us = 252 + 150 = 402, them = 0 + 0 = 0.
            const outcome = scoreManualDeal(
                deal({
                    caller: "them",
                    cards: { us: 252, them: 0 },
                    declarations: { us: [50], them: [100] },
                    stiglja: "us",
                })
            )
            expect(outcome.fell).toBe(true)
            expect(outcome.declarations).toEqual({ us: 150, them: 0 })
            expect(outcome.total).toEqual({ us: 402, them: 0 })
        })

        it("štiglja totals 252 points, card conservation: 252 = 252 + 0", () => {
            const outcome = scoreManualDeal(
                deal({ caller: "us", cards: { us: 252, them: 0 }, stiglja: "us" })
            )
            expect(outcome.cards.us + outcome.cards.them).toBe(252)
            expect(outcome.total.us + outcome.total.them).toBe(252)
        })
    })

    describe("belot: one side held all eight cards of one suit (target award)", () => {
        it("belot for 'us' awards the target (1001) with 0/0 card split", () => {
            // Belot awards the target, cards are 0/0, no fall rule.
            const outcome = scoreManualDeal(
                deal({
                    caller: "us",
                    cards: { us: 0, them: 0 },
                    declarations: { us: [], them: [] },
                    belot: "us",
                    target: 1001,
                })
            )
            expect(outcome.total).toEqual({ us: 1001, them: 0 })
            expect(outcome.cards).toEqual({ us: 0, them: 0 })
            expect(outcome.fell).toBe(false)
        })

        it("belot for 'them' awards the target to them regardless of who called", () => {
            const outcome = scoreManualDeal(
                deal({
                    caller: "us",
                    cards: { us: 0, them: 0 },
                    belot: "them",
                    target: 1001,
                })
            )
            expect(outcome.total).toEqual({ us: 0, them: 1001 })
            expect(outcome.fell).toBe(false)
        })

        it("belot respects the game target: 501", () => {
            const outcome = scoreManualDeal(
                deal({
                    caller: "us",
                    cards: { us: 0, them: 0 },
                    belot: "us",
                    target: 501,
                })
            )
            expect(outcome.total.us).toBe(501)
        })

        it("belot respects the game target: 2001", () => {
            const outcome = scoreManualDeal(
                deal({
                    caller: "us",
                    cards: { us: 0, them: 0 },
                    belot: "us",
                    target: 2001,
                })
            )
            expect(outcome.total.us).toBe(2001)
        })

        it("belot reports declarations but never adds them to the award", () => {
            // Declarations are entered but do NOT add to the total on a belot.
            // total = { us: 1001, them: 0 }, not { us: 1001+70, them: 50 }.
            const outcome = scoreManualDeal(
                deal({
                    caller: "us",
                    cards: { us: 0, them: 0 },
                    declarations: { us: [50, 20], them: [50] },
                    belot: "us",
                    target: 1001,
                })
            )
            expect(outcome.total).toEqual({ us: 1001, them: 0 })
            expect(outcome.declarations).toEqual({ us: 70, them: 50 })
        })

        it("belot's fell is always false (no call, no fall)", () => {
            const outcome = scoreManualDeal(
                deal({
                    caller: "them",
                    cards: { us: 0, them: 0 },
                    belot: "us",
                    target: 1001,
                })
            )
            expect(outcome.fell).toBe(false)
        })

        it("belot with a high target: 7001", () => {
            const outcome = scoreManualDeal(
                deal({
                    caller: "us",
                    cards: { us: 0, them: 0 },
                    belot: "them",
                    target: 7001,
                })
            )
            expect(outcome.total).toEqual({ us: 0, them: 7001 })
        })

        it("absent belot field is treated as null (no belot)", () => {
            const withAbsent = scoreManualDeal(deal())
            const withNull = scoreManualDeal(deal({ belot: null }))
            expect(withAbsent).toEqual(withNull)
        })
    })

    describe("invalid input: rejects contradictory or impossible data", () => {
        const rejects = (input: unknown, hint: string) => {
            expect(() => scoreManualDeal(input as ManualDealInput), hint).toThrow(EngineError)
            try {
                scoreManualDeal(input as ManualDealInput)
            } catch (error) {
                expect((error as EngineError).code, hint).toBe("BAD_REQUEST")
            }
        }

        it("rejects card points that do not total 162", () => {
            rejects(deal({ cards: { us: 100, them: 61 } }), "too few: 161")
            rejects(deal({ cards: { us: 100, them: 63 } }), "too many: 163")
            rejects(deal({ cards: { us: 0, them: 0 } }), "both zero: 0")
        })

        it("rejects negative card points", () => {
            rejects(deal({ cards: { us: -10, them: 172 } }), "negative us")
            rejects(deal({ cards: { us: 200, them: -38 } }), "negative them")
        })

        it("rejects fractional or non-finite card points", () => {
            rejects(deal({ cards: { us: 100.5, them: 61.5 } }), "fractional")
            rejects(deal({ cards: { us: Number.NaN, them: 62 } }), "NaN")
            rejects(deal({ cards: { us: Number.POSITIVE_INFINITY, them: 62 } }), "Infinity")
        })

        it("rejects a štiglja with wrong card split", () => {
            rejects(deal({ cards: { us: 162, them: 0 }, stiglja: "us" }), "162/0, no +90")
            rejects(deal({ cards: { us: 100, them: 62 }, stiglja: "us" }), "ordinary split with štiglja")
            rejects(deal({ cards: { us: 252, them: 0 }, stiglja: "them" }), "štiglja side mismatch")
        })

        it("rejects a 252/0 split without a štiglja declaration", () => {
            rejects(deal({ cards: { us: 252, them: 0 }, stiglja: null }), "252 without štiglja")
        })

        it("rejects invalid side values", () => {
            rejects(deal({ caller: "we" as ManualSide }), "caller 'we'")
            rejects(deal({ stiglja: "nobody" as ManualSide }), "štiglja 'nobody'")
            rejects(deal({ belot: "something" as ManualSide }), "belot 'something'")
        })

        it("rejects negative or fractional declarations", () => {
            rejects(deal({ declarations: { us: [-20], them: [] } }), "negative declaration")
            rejects(deal({ declarations: { us: [20.5], them: [] } }), "fractional declaration")
            rejects(deal({ declarations: { us: [Number.NaN], them: [] } }), "NaN declaration")
        })

        it("rejects belot + štiglja together (mutually exclusive)", () => {
            rejects(
                deal({
                    cards: { us: 252, them: 0 },
                    belot: "us",
                    stiglja: "us",
                    target: 1001,
                }),
                "belot and štiglja both for us"
            )
            rejects(
                deal({
                    cards: { us: 0, them: 252 },
                    belot: "us",
                    stiglja: "them",
                    target: 1001,
                }),
                "belot for us, štiglja for them"
            )
        })

        it("rejects belot with non-zero card split (deal was not played)", () => {
            rejects(
                deal({ cards: { us: 100, them: 62 }, belot: "us", target: 1001 }),
                "ordinary split with belot"
            )
            rejects(
                deal({ cards: { us: 162, them: 0 }, belot: "us", target: 1001 }),
                "all points to belot side"
            )
        })

        it("rejects belot with invalid target (missing, zero, negative, fractional, non-finite)", () => {
            rejects(
                deal({ cards: { us: 0, them: 0 }, belot: "us", target: undefined }),
                "missing target"
            )
            rejects(deal({ cards: { us: 0, them: 0 }, belot: "us", target: 0 }), "zero target")
            rejects(deal({ cards: { us: 0, them: 0 }, belot: "us", target: -1001 }), "negative target")
            rejects(deal({ cards: { us: 0, them: 0 }, belot: "us", target: 1001.5 }), "fractional target")
            rejects(deal({ cards: { us: 0, them: 0 }, belot: "us", target: Number.NaN }), "NaN target")
        })

        it("rejects missing or null input", () => {
            rejects(null, "null input")
            rejects(undefined, "undefined input")
        })
    })
})
