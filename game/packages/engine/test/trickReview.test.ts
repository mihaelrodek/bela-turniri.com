/* ──────────────────────────────────────────────────────────────────────────
   "Gledanje štihova" — the three visibility states (README §1.8).

   The point of these tests is the NEGATIVE case: a seat that must not review
   the tricks does not RECEIVE them. `viewFor` is what leaves the server, so a
   `trickHistory` of `null` is the whole enforcement — anything weaker would
   be a UI decoration a browser console undoes in one line.
   ────────────────────────────────────────────────────────────────────── */

import { describe, expect, it } from "vitest"
import type { Card, GameState, Seat, TrickReview, WonTrick } from "../src/index"
import { SEATS, legalMoves, newGame, partnerOf, reduce, teamOf, viewFor } from "../src/index"

/** A dealt game with HERC as trump and the given review rule. */
function dealt(seed: string, trickReview?: TrickReview): GameState {
    const start = newGame({ targetScore: 1001, seed, trickReview })
    return reduce(start, { type: "BID", seat: start.bidding.turn, trump: "HERC" }).state
}

/** Play `count` complete tricks with the first legal card each time. */
function playTricks(start: GameState, count: number): GameState {
    let state = start
    for (let trick = 0; trick < count; trick++) {
        for (let i = 0; i < 4; i++) {
            const seat = state.trick.turn
            state = reduce(state, { type: "PLAY", seat, card: legalMoves(state, seat)[0] as Card }).state
        }
    }
    return state
}

describe("WonTrick records who played what", () => {
    it("stores the leader and every play with its seat, in play order", () => {
        let state = dealt("attribution")
        const leader = state.trick.leader
        const thrown: { seat: Seat; card: Card }[] = []
        for (let i = 0; i < 4; i++) {
            const seat = state.trick.turn
            const card = legalMoves(state, seat)[0] as Card
            thrown.push({ seat, card })
            state = reduce(state, { type: "PLAY", seat, card }).state
        }

        const stored = [...state.tricksWon.A, ...state.tricksWon.B][0] as WonTrick
        expect(stored.no).toBe(1)
        expect(stored.leader).toBe(leader)
        expect(stored.plays).toEqual(thrown)
        // The legacy fields the bots and the scoring read are still there.
        expect(stored.cards).toEqual(thrown.map((p) => p.card))
        expect(stored.winner).toBe(state.trick.leader)
    })

    it("numbers the tricks of the deal 1..8 across both teams' buckets", () => {
        const state = playTricks(dealt("numbering"), 8)
        const numbers = [...state.tricksWon.A, ...state.tricksWon.B].map((t) => t.no).sort((a, b) => a - b)
        expect(numbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
        // …and the review comes back in play order, not bucket order.
        const history = viewFor({ ...state, config: { ...state.config, trickReview: "all" } }, 0).trickHistory
        expect(history?.map((t) => t.no)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    })
})

describe("viewFor — trick review 'off' (the default)", () => {
    it("gives nobody a history, not even a spectator", () => {
        const state = playTricks(dealt("off-rule"), 3)
        for (const seat of SEATS) expect(viewFor(state, seat).trickHistory, `seat ${seat}`).toBeNull()
        expect(viewFor(state, null).trickHistory).toBeNull()
    })

    it("is what an unset trickReview means", () => {
        const state = playTricks(dealt("default-rule", undefined), 2)
        expect(state.config.trickReview).toBeUndefined()
        for (const seat of SEATS) expect(viewFor(state, seat).trickHistory).toBeNull()
    })

    it("still shows the last trick — that one is on the table, not in the history", () => {
        const state = playTricks(dealt("off-last"), 1)
        const view = viewFor(state, 0)
        expect(view.trickHistory).toBeNull()
        expect(view.lastTrick).not.toBeNull()
        expect(view.lastTrick?.cards).toHaveLength(4)
    })
})

describe("viewFor — trick review 'leaderPair'", () => {
    it("gives it to the seat that LEADS the current trick and to its partner only", () => {
        const state = playTricks(dealt("leader-pair", "leaderPair"), 3)
        const leader = state.trick.leader
        const partner = partnerOf(leader)

        expect(viewFor(state, leader).trickHistory).toHaveLength(3)
        expect(viewFor(state, partner).trickHistory).toHaveLength(3)

        // The negative case: the other team receives NOTHING.
        for (const seat of SEATS) {
            if (teamOf(seat) === teamOf(leader)) continue
            const view = viewFor(state, seat)
            expect(view.trickHistory, `seat ${seat} must not review`).toBeNull()
            // Not merely empty — absent from the frame the server sends.
            expect(JSON.parse(JSON.stringify(view)).trickHistory).toBeNull()
        }
        expect(viewFor(state, null).trickHistory).toBeNull()
    })

    it("follows the lead as it moves from trick to trick", () => {
        let state = dealt("leader-moves", "leaderPair")
        const seen = new Set<string>()
        for (let trick = 1; trick <= 4; trick++) {
            state = playTricks(state, 1)
            const leaderTeam = teamOf(state.trick.leader)
            seen.add(leaderTeam)
            for (const seat of SEATS) {
                const allowed = teamOf(seat) === leaderTeam
                expect(
                    viewFor(state, seat).trickHistory === null,
                    `trick ${trick}, seat ${seat}`,
                ).toBe(!allowed)
            }
        }
        // The scenario is only meaningful if the lead actually changed hands.
        expect(seen.size).toBe(2)
    })

    it("is the pair of the LEADER, not of the seat on the move", () => {
        // One card into the trick the turn has moved to the seat on the
        // leader's left — an opponent. The review has not moved with it.
        let state = playTricks(dealt("leader-not-turn", "leaderPair"), 1)
        const leader = state.trick.leader
        const opener = state.trick.turn
        state = reduce(state, {
            type: "PLAY",
            seat: opener,
            card: legalMoves(state, opener)[0] as Card,
        }).state
        expect(state.trick.turn).not.toBe(leader)
        expect(teamOf(state.trick.turn)).not.toBe(teamOf(leader))
        expect(viewFor(state, state.trick.turn).trickHistory).toBeNull()
        expect(viewFor(state, leader).trickHistory).toHaveLength(1)
    })
})

describe("viewFor — trick review 'all'", () => {
    it("gives every seat and every spectator the same history, with attribution", () => {
        const state = playTricks(dealt("all-rule", "all"), 4)
        const reference = viewFor(state, 0).trickHistory as WonTrick[]
        expect(reference).toHaveLength(4)
        for (const seat of SEATS) expect(viewFor(state, seat).trickHistory).toEqual(reference)
        expect(viewFor(state, null).trickHistory).toEqual(reference)

        for (const trick of reference) {
            expect(trick.plays).toHaveLength(4)
            expect(trick.plays.map((p) => p.card)).toEqual(trick.cards)
            expect(trick.plays[0]?.seat).toBe(trick.leader)
            expect(new Set(trick.plays.map((p) => p.seat)).size).toBe(4)
        }
    })

    it("hands out copies, so a reader cannot edit the game's own tricks", () => {
        const state = playTricks(dealt("all-copies", "all"), 2)
        const history = viewFor(state, 0).trickHistory as WonTrick[]
        history[0]!.plays[0]!.card = "AHERC"
        history[0]!.cards.push("AHERC")
        const stored = [...state.tricksWon.A, ...state.tricksWon.B].find((t) => t.no === 1) as WonTrick
        expect(stored.cards).toHaveLength(4)
        expect(stored.plays[0]?.card).not.toBe(history[0]?.plays[0]?.card)
    })

    it("says nothing before the first trick is complete", () => {
        const state = dealt("all-empty", "all")
        expect(viewFor(state, 0).trickHistory).toEqual([])
    })
})

describe("trick review is a visibility rule, not a rule of play", () => {
    it("does not change a single move, score or event of an otherwise identical deal", () => {
        const run = (trickReview: TrickReview): GameState => {
            let state = newGame({ targetScore: 1001, seed: "same-deal", trickReview })
            state = reduce(state, { type: "BID", seat: state.bidding.turn, trump: "HERC" }).state
            return playTricks(state, 8)
        }
        const off = run("off")
        const all = run("all")
        expect(all.dealScore).toEqual(off.dealScore)
        expect(all.score).toEqual(off.score)
        expect({ ...all, config: off.config }).toEqual(off)
    })

    it("rides along into the next deal", () => {
        const state = playTricks(dealt("carries", "leaderPair"), 8)
        const next = reduce(state, { type: "NEXT_DEAL" }).state
        expect(next.config.trickReview).toBe("leaderPair")
    })
})
