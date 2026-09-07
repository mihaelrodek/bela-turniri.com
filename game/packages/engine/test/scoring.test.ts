import { describe, expect, it } from "vitest"
import type { Card, Declaration, Seat, Team, WonTrick } from "../src/index"
import { EngineError, fullDeck, scoreDeal, teamOf } from "../src/index"
import { makeState } from "./helpers"

/** Chop the deck into 8 tricks of 4 and hand them to the given winners in order. */
function tricksFor(winners: Seat[]): Record<Team, WonTrick[]> {
    const deck = fullDeck()
    const out: Record<Team, WonTrick[]> = { A: [], B: [] }
    winners.forEach((winner, i) => {
        out[teamOf(winner)].push({ winner, cards: deck.slice(i * 4, i * 4 + 4) as Card[] })
    })
    return out
}

/** A wins tricks 1–7, B takes the last one (JTREF QTREF KTREF ATREF = 20 points). */
const SEVEN_ONE: Seat[] = [0, 0, 0, 0, 0, 0, 0, 1]

const scored = (over: Parameters<typeof makeState>[0]) => scoreDeal(makeState(over))

describe("scoreDeal — card points (README §1.6)", () => {
    it("always distributes 162 points including the last-trick bonus", () => {
        const score = scored({
            phase: "DEAL_DONE",
            bidding: { turn: 0, passes: [], trump: "HERC", caller: 0 },
            tricksWon: tricksFor(SEVEN_ONE),
            trick: { leader: 1, turn: 1, cards: [] },
        })
        expect(score.cardPoints.A + score.cardPoints.B).toBe(162)
        expect(score.cardPoints.A).toBe(132)
        expect(score.cardPoints.B).toBe(30) // 20 in the cards + 10 for the last trick
        expect(score.stiglja).toBeNull()
    })

    it("gives +90 and 252 in total for a štiglja", () => {
        const score = scored({
            phase: "DEAL_DONE",
            bidding: { turn: 0, passes: [], trump: "HERC", caller: 0 },
            tricksWon: tricksFor([0, 0, 0, 0, 0, 0, 0, 0]),
            trick: { leader: 0, turn: 0, cards: [] },
        })
        expect(score.stiglja).toBe("A")
        expect(score.cardPoints.A).toBe(252)
        expect(score.cardPoints.B).toBe(0)
    })

    it("counts a štiglja for the defending team too", () => {
        const score = scored({
            phase: "DEAL_DONE",
            bidding: { turn: 0, passes: [], trump: "HERC", caller: 0 },
            tricksWon: tricksFor([1, 1, 1, 1, 1, 1, 1, 1]),
            trick: { leader: 1, turn: 1, cards: [] },
        })
        expect(score.stiglja).toBe("B")
        expect(score.cardPoints.B).toBe(252)
        expect(score.passed).toBe(false)
        expect(score.total).toEqual({ A: 0, B: 252 })
    })
})

describe("scoreDeal — pass and fall (README §1.6)", () => {
    it("the caller passes when C > O and both keep their points", () => {
        const score = scored({
            phase: "DEAL_DONE",
            bidding: { turn: 0, passes: [], trump: "HERC", caller: 0 },
            tricksWon: tricksFor(SEVEN_ONE),
            trick: { leader: 1, turn: 1, cards: [] },
        })
        expect(score.callerTeam).toBe("A")
        expect(score.passed).toBe(true)
        expect(score.total).toEqual({ A: 132, B: 30 })
    })

    it("the caller falls when C ≤ O and the opponents take everything", () => {
        const score = scored({
            phase: "DEAL_DONE",
            bidding: { turn: 1, passes: [], trump: "HERC", caller: 1 },
            tricksWon: tricksFor(SEVEN_ONE),
            trick: { leader: 1, turn: 1, cards: [] },
        })
        expect(score.callerTeam).toBe("B")
        expect(score.passed).toBe(false)
        expect(score.total).toEqual({ A: 162, B: 0 })
        expect(score.total.A + score.total.B).toBe(162)
    })

    it("an exact tie is a fall — the caller must be strictly ahead", () => {
        // Deliberately small, hand-built tricks: 11 + 10 for A against 11 + 10 for B.
        const tricksWon: Record<Team, WonTrick[]> = {
            A: [{ winner: 0, cards: ["APIK"] }],
            B: [{ winner: 1, cards: ["AHERC", "10HERC"] }],
        }
        const tie = scoreDeal(
            makeState({
                phase: "DEAL_DONE",
                bidding: { turn: 0, passes: [], trump: "HERC", caller: 0 },
                tricksWon,
                trick: { leader: 0, turn: 0, cards: [] },
            }),
        )
        expect(tie.cardPoints).toEqual({ A: 21, B: 21 })
        expect(tie.passed).toBe(false)
        expect(tie.total).toEqual({ A: 0, B: 42 })
    })
})

describe("scoreDeal — declarations and bela (README §1.4, §1.6)", () => {
    const declaration = (points: 100 | 200): Declaration => ({
        kind: "FOUR",
        cards: ["JHERC", "JKARA", "JPIK", "JTREF"],
        points,
    })

    it("only the winning team's declarations score", () => {
        const score = scored({
            phase: "DEAL_DONE",
            bidding: { turn: 0, passes: [], trump: "HERC", caller: 0 },
            tricksWon: tricksFor(SEVEN_ONE),
            trick: { leader: 1, turn: 1, cards: [] },
            declarations: { 0: [declaration(200)], 1: [declaration(100)], 2: [], 3: [] },
            declarationsScoringTeam: "A",
        })
        expect(score.declarationPoints).toEqual({ A: 200, B: 0 })
        expect(score.total).toEqual({ A: 332, B: 30 })
    })

    it("adds up both partners' declarations", () => {
        const score = scored({
            phase: "DEAL_DONE",
            bidding: { turn: 0, passes: [], trump: "HERC", caller: 0 },
            tricksWon: tricksFor(SEVEN_ONE),
            trick: { leader: 1, turn: 1, cards: [] },
            declarations: { 0: [declaration(200)], 1: [], 2: [declaration(100)], 3: [] },
            declarationsScoringTeam: "A",
        })
        expect(score.declarationPoints.A).toBe(300)
    })

    it("declarations can flip the deal from a pass to a fall", () => {
        const score = scored({
            phase: "DEAL_DONE",
            bidding: { turn: 0, passes: [], trump: "HERC", caller: 0 },
            tricksWon: tricksFor(SEVEN_ONE),
            trick: { leader: 1, turn: 1, cards: [] },
            declarations: { 0: [], 1: [declaration(200)], 2: [], 3: [] },
            declarationsScoringTeam: "B",
        })
        expect(score.passed).toBe(false)
        expect(score.total).toEqual({ A: 0, B: 362 })
    })

    it("bela always scores 20 for its team, whoever won the declarations", () => {
        const score = scored({
            phase: "DEAL_DONE",
            bidding: { turn: 0, passes: [], trump: "HERC", caller: 0 },
            tricksWon: tricksFor(SEVEN_ONE),
            trick: { leader: 1, turn: 1, cards: [] },
            declarations: { 0: [declaration(200)], 1: [], 2: [], 3: [] },
            declarationsScoringTeam: "A",
            belaDeclared: "B",
        })
        expect(score.declarationPoints).toEqual({ A: 200, B: 20 })
    })

    it("scores bela even when nobody has any other declaration", () => {
        const score = scored({
            phase: "DEAL_DONE",
            bidding: { turn: 0, passes: [], trump: "HERC", caller: 0 },
            tricksWon: tricksFor(SEVEN_ONE),
            trick: { leader: 1, turn: 1, cards: [] },
            declarationsScoringTeam: null,
            belaDeclared: "A",
        })
        expect(score.declarationPoints).toEqual({ A: 20, B: 0 })
    })
})

describe("scoreDeal — guards", () => {
    it("refuses to score a deal without a trump", () => {
        expect(() =>
            scored({
                phase: "DEAL_DONE",
                bidding: { turn: 0, passes: [], trump: null, caller: null },
            }),
        ).toThrowError(EngineError)
    })

    it("does not mutate the state", () => {
        const state = makeState({
            phase: "DEAL_DONE",
            bidding: { turn: 0, passes: [], trump: "HERC", caller: 0 },
            tricksWon: tricksFor(SEVEN_ONE),
            trick: { leader: 1, turn: 1, cards: [] },
        })
        const snapshot = structuredClone(state)
        scoreDeal(state)
        expect(state).toEqual(snapshot)
    })
})
