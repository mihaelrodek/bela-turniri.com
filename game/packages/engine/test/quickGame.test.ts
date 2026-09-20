/* "Brza 163" — the quick discipline (README §1.7, added 2026-09-20).

   The rule under test, precisely: at the END of a deal, a team at or past 163
   wins (higher total if both are); otherwise, once the third deal has been
   scored, whoever leads wins however small the lead; an exactly level score
   decides nothing and buys another deal. No pass/fall condition, no `dosta`
   race, never a draw.

   Most of these tests drive the rule through `NEXT_DEAL` on a hand-built
   DEAL_DONE state rather than through a played-out deal: `gameWinner` is the
   single place the question is asked, both settlement and `NEXT_DEAL` route
   into it, and only this way can the score and the deal number be stated
   exactly instead of hoped for out of a shuffle. */

import { describe, expect, it } from "vitest"
import type { DealScore, GameState, Team } from "../src/index"
import {
    QUICK_MAX_DEALS,
    QUICK_TARGET,
    TARGET_SCORES,
    isQuickGame,
    legalMoves,
    newGame,
    reduce,
    viewFor,
} from "../src/index"
import { makeState } from "./helpers"

/** A settled deal, reduced to the two fields the end-of-game question reads:
 *  which deal it was and whether the caller passed. */
function settled(dealNo: number, passed = true, callerTeam: Team = "A"): DealScore {
    return {
        dealNo,
        trump: "HERC",
        caller: callerTeam === "A" ? 0 : 1,
        callerTeam,
        cardPoints: { A: 0, B: 0 },
        declarationPoints: { A: 0, B: 0 },
        stiglja: null,
        passed,
        total: { A: 0, B: 0 },
    }
}

/** DEAL_DONE, `dealNo` deals played, totals as given. */
function dealDone(opts: {
    dealNo: number
    score: Record<Team, number>
    targetScore?: 163 | 501 | 701 | 1001
    passed?: boolean
    callerTeam?: Team
}): GameState {
    const dealScore = settled(opts.dealNo, opts.passed ?? true, opts.callerTeam ?? "A")
    return makeState({
        config: { targetScore: opts.targetScore ?? QUICK_TARGET, seed: "brza", gameEndRule: "prolaz" },
        phase: "DEAL_DONE",
        dealNo: opts.dealNo,
        score: opts.score,
        dealScore,
        history: Array.from({ length: opts.dealNo }, (_, i) => settled(i + 1)),
    })
}

describe("Brza 163 — constants", () => {
    it("names the discipline by its target score", () => {
        expect(QUICK_TARGET).toBe(163)
        expect(QUICK_MAX_DEALS).toBe(3)
        expect(isQuickGame(163)).toBe(true)
        expect(isQuickGame(501)).toBe(false)
        expect(isQuickGame(701)).toBe(false)
        expect(isQuickGame(1001)).toBe(false)
        expect(isQuickGame(undefined)).toBe(false)
        expect(isQuickGame(null)).toBe(false)
        expect(TARGET_SCORES).toEqual([163, 501, 701, 1001])
    })
})

describe("Brza 163 — the target falls", () => {
    it("ends after the first deal when a team is at 163", () => {
        const result = reduce(dealDone({ dealNo: 1, score: { A: 163, B: 20 } }), { type: "NEXT_DEAL" })
        expect(result.state.phase).toBe("GAME_OVER")
        expect(result.state.winner).toBe("A")
        expect(result.events).toEqual([{ type: "GAME_OVER", winner: "A", score: { A: 163, B: 20 } }])
    })

    it("ends after the second deal when a team is past 163", () => {
        const result = reduce(dealDone({ dealNo: 2, score: { A: 90, B: 240 } }), { type: "NEXT_DEAL" })
        expect(result.state.phase).toBe("GAME_OVER")
        expect(result.state.winner).toBe("B")
    })

    it("gives it to the higher total when BOTH are past 163", () => {
        const result = reduce(dealDone({ dealNo: 2, score: { A: 171, B: 200 } }), { type: "NEXT_DEAL" })
        expect(result.state.winner).toBe("B")
    })

    it("ignores the pass/fall verdict — the caller need not have passed", () => {
        const fell = dealDone({ dealNo: 1, score: { A: 200, B: 40 }, passed: false, callerTeam: "B" })
        expect(reduce(fell, { type: "NEXT_DEAL" }).state.winner).toBe("A")
    })

    it("plays on while both teams are below 163", () => {
        const result = reduce(dealDone({ dealNo: 1, score: { A: 120, B: 42 } }), { type: "NEXT_DEAL" })
        expect(result.state.phase).toBe("BIDDING")
        expect(result.state.winner).toBeNull()
        expect(result.state.dealNo).toBe(2)
        expect(result.state.score).toEqual({ A: 120, B: 42 })
    })
})

describe("Brza 163 — three deals and out", () => {
    it("ends after the third deal on the higher total, however small", () => {
        const result = reduce(dealDone({ dealNo: QUICK_MAX_DEALS, score: { A: 84, B: 78 } }), { type: "NEXT_DEAL" })
        expect(result.state.phase).toBe("GAME_OVER")
        expect(result.state.winner).toBe("A")
        expect(result.state.score).toEqual({ A: 84, B: 78 })
    })

    it("a one-point lead after the third deal is a win", () => {
        const result = reduce(dealDone({ dealNo: 3, score: { A: 80, B: 81 } }), { type: "NEXT_DEAL" })
        expect(result.state.winner).toBe("B")
    })

    it("an exact tie after the third deal buys a fourth", () => {
        const result = reduce(dealDone({ dealNo: 3, score: { A: 81, B: 81 } }), { type: "NEXT_DEAL" })
        expect(result.state.phase).toBe("BIDDING")
        expect(result.state.winner).toBeNull()
        expect(result.state.dealNo).toBe(4)
        expect(result.events).toEqual([{ type: "DEALT", dealNo: 4, dealer: result.state.dealer }])
    })

    it("decides on the fourth deal, and on every deal after it", () => {
        expect(reduce(dealDone({ dealNo: 4, score: { A: 101, B: 95 } }), { type: "NEXT_DEAL" }).state.winner).toBe("A")
        expect(reduce(dealDone({ dealNo: 7, score: { A: 95, B: 101 } }), { type: "NEXT_DEAL" }).state.winner).toBe("B")
        // …and a tie keeps buying one more, so there is never a draw.
        expect(reduce(dealDone({ dealNo: 4, score: { A: 99, B: 99 } }), { type: "NEXT_DEAL" }).state.phase).toBe("BIDDING")
    })
})

describe("Brza 163 — no mid-deal finish", () => {
    it("drops a `dosta` asked for at creation", () => {
        const state = newGame({ targetScore: QUICK_TARGET, seed: "dosta-quick", gameEndRule: "dosta" })
        expect(state.config.gameEndRule).toBe("prolaz")
    })

    it("never ends a quick game before the deal is scored", () => {
        // `gameEndRule: "dosta"` is deliberately asked for: even so, no
        // GAME_OVER may appear without a DEAL_SCORED in front of it.
        let state = newGame({ targetScore: QUICK_TARGET, seed: "no-mid-deal", gameEndRule: "dosta" })
        state = reduce(state, { type: "BID", seat: state.bidding.turn, trump: "HERC" }).state
        let scored = false
        let guard = 0
        while (state.phase === "PLAYING" && guard++ < 40) {
            const seat = state.trick.turn
            const result = reduce(state, { type: "PLAY", seat, card: legalMoves(state, seat)[0]! })
            for (const event of result.events) {
                if (event.type === "DEAL_SCORED") scored = true
                if (event.type === "GAME_OVER") expect(scored).toBe(true)
            }
            state = result.state
        }
        expect(state.phase === "DEAL_DONE" || state.phase === "GAME_OVER").toBe(true)
        expect(state.history.length).toBe(1)
    })
})

describe("Brza 163 — table state", () => {
    it("publishes the deal plan in the view", () => {
        const quick = newGame({ targetScore: QUICK_TARGET, seed: "view-quick" })
        const view = viewFor(quick, quick.bidding.turn)
        expect(view.targetScore).toBe(163)
        expect(view.maxDeals).toBe(QUICK_MAX_DEALS)
        expect(view.dealNo).toBe(1)
    })

    it("leaves maxDeals null for the open-ended disciplines", () => {
        for (const target of [501, 701, 1001] as const) {
            const state = newGame({ targetScore: target, seed: `view-${target}` })
            expect(viewFor(state, 0).maxDeals).toBeNull()
        }
    })

    it("still picks the first dealer at random and then rotates", () => {
        const dealers = new Set<number>()
        for (let i = 0; i < 40; i++) {
            dealers.add(newGame({ targetScore: QUICK_TARGET, seed: `seed-${i}` }).dealer)
        }
        expect(dealers.size).toBeGreaterThan(1)
        const rotated = reduce(dealDone({ dealNo: 1, score: { A: 10, B: 20 } }), { type: "NEXT_DEAL" }).state
        expect(rotated.dealer).toBe(((3 + 1) % 4))
    })
})

describe("the ordinary disciplines are untouched", () => {
    it("501/701/1001 ask only who has the points — never who called or passed", () => {
        for (const target of [501, 701, 1001] as const) {
            // Past the target and ahead, although the caller fell: won.
            const fell = dealDone({ dealNo: 3, score: { A: target + 40, B: 10 }, targetScore: target, passed: false })
            expect(reduce(fell, { type: "NEXT_DEAL" }).state.winner).toBe("A")
            // Passed and past the target: won.
            const won = dealDone({ dealNo: 3, score: { A: target + 40, B: 10 }, targetScore: target })
            expect(reduce(won, { type: "NEXT_DEAL" }).state.winner).toBe("A")
            // Level at the target decides nothing: another deal.
            const level = dealDone({ dealNo: 3, score: { A: target + 40, B: target + 40 }, targetScore: target })
            expect(reduce(level, { type: "NEXT_DEAL" }).state.phase).toBe("BIDDING")
            // Below the target nobody wins, whoever called.
            const below = dealDone({ dealNo: 3, score: { A: target - 40, B: 10 }, targetScore: target })
            expect(reduce(below, { type: "NEXT_DEAL" }).state.phase).toBe("BIDDING")
        }
    })

    it("does not end a 501 game after three deals", () => {
        const three = dealDone({ dealNo: QUICK_MAX_DEALS, score: { A: 300, B: 180 }, targetScore: 501 })
        const result = reduce(three, { type: "NEXT_DEAL" })
        expect(result.state.phase).toBe("BIDDING")
        expect(result.state.dealNo).toBe(4)
    })

    it("keeps `dosta` working where it is meaningful", () => {
        const state = newGame({ targetScore: 1001, seed: "dosta-1001", gameEndRule: "dosta" })
        expect(state.config.gameEndRule).toBe("dosta")
    })
})

describe("Brza 163 — a whole game", () => {
    it("always produces a winner and a loser", () => {
        for (const seed of ["brza-a", "brza-b", "brza-c", "brza-d"]) {
            let state = newGame({ targetScore: QUICK_TARGET, seed })
            let guard = 0
            while (state.phase !== "GAME_OVER" && guard++ < 400) {
                if (state.phase === "BIDDING") {
                    state = reduce(state, { type: "BID", seat: state.bidding.turn, trump: "HERC" }).state
                } else if (state.phase === "PLAYING") {
                    const seat = state.trick.turn
                    state = reduce(state, { type: "PLAY", seat, card: legalMoves(state, seat)[0]! }).state
                } else {
                    state = reduce(state, { type: "NEXT_DEAL" }).state
                }
            }
            expect(state.phase).toBe("GAME_OVER")
            const winner = state.winner
            expect(winner).not.toBeNull()
            const loser: Team = winner === "A" ? "B" : "A"
            expect(state.score[winner!]).toBeGreaterThan(state.score[loser])
            // A belot ends a game on the spot and books the target; every
            // other game runs a full number of deals, and never more than
            // three unless the third one left the totals level.
            const belot = state.history.some((deal) => deal.belot)
            if (!belot) {
                expect(state.history.length).toBeGreaterThanOrEqual(1)
                if (state.history.length < QUICK_MAX_DEALS) {
                    expect(Math.max(state.score.A, state.score.B)).toBeGreaterThanOrEqual(QUICK_TARGET)
                }
            }
        }
    })
})
