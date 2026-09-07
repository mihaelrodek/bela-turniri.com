import { describe, expect, it } from "vitest"
import type { Card, GameState } from "../src/index"
import { SEATS, legalMoves, newGame, nextSeat, reduce, viewFor } from "../src/index"
import { playing } from "./helpers"

/** A fresh deal with HERC as trump, called by the first bidder. */
function dealtGame(seed: string): GameState {
    const start = newGame({ targetScore: 1001, seed })
    return reduce(start, { type: "BID", seat: start.bidding.turn, trump: "HERC" }).state
}

/** Play one full deal with the first legal card, collecting the cards in play order. */
function playDeal(start: GameState): { state: GameState; played: Card[] } {
    let state = start
    const played: Card[] = []
    while (state.phase === "PLAYING") {
        const seat = state.trick.turn
        const card = legalMoves(state, seat)[0] as Card
        played.push(card)
        state = reduce(state, { type: "PLAY", seat, card }).state
    }
    return { state, played }
}

describe("viewFor — redaction", () => {
    it("shows only my own hand, and sizes for everyone else", () => {
        const state = dealtGame("view-1")
        const view = viewFor(state, 1)
        expect(view.seat).toBe(1)
        expect(view.hand).toEqual(state.hands[1])
        expect(view.handSizes).toEqual({ 0: 8, 1: 8, 2: 8, 3: 8 })
        expect(Object.keys(view)).not.toContain("hands")
        expect(Object.keys(view)).not.toContain("stock")
        expect(Object.keys(view)).not.toContain("rng")
    })

    it("gives a spectator no hand at all", () => {
        const state = dealtGame("view-2")
        const view = viewFor(state, null)
        expect(view.seat).toBeNull()
        expect(view.hand).toEqual([])
        expect(view.legalMoves).toEqual([])
        expect(view.legalBids).toBeNull()
        expect(view.declarations).toEqual({})
    })

    it("copies the arrays it exposes", () => {
        const state = dealtGame("view-3")
        const view = viewFor(state, 0)
        expect(view.hand).not.toBe(state.hands[0])
        view.hand.push("AHERC")
        expect(state.hands[0]).toHaveLength(8)
    })

    it("does not mutate the state", () => {
        const state = dealtGame("view-4")
        const snapshot = structuredClone(state)
        viewFor(state, 0)
        viewFor(state, null)
        expect(state).toEqual(snapshot)
    })
})

describe("viewFor — declarations (README §1.4)", () => {
    it("shows only my own declarations before the first trick is over", () => {
        const state = dealtGame("view-decl")
        const view = viewFor(state, 2)
        expect(view.declarationsRevealed).toBe(false)
        expect(Object.keys(view.declarations)).toEqual(["2"])
        expect(view.declarations[2]).toEqual(state.declarations[2])
    })

    it("shows everyone's once the first trick is done", () => {
        let state = dealtGame("view-decl-2")
        for (let i = 0; i < 4; i++) {
            const seat = state.trick.turn
            state = reduce(state, {
                type: "PLAY",
                seat,
                card: legalMoves(state, seat)[0] as Card,
            }).state
        }
        const view = viewFor(state, 2)
        expect(view.declarationsRevealed).toBe(true)
        expect(Object.keys(view.declarations).sort()).toEqual(["0", "1", "2", "3"])
        for (const seat of SEATS) expect(view.declarations[seat]).toEqual(state.declarations[seat])
        // Spectators see them too, once revealed.
        expect(viewFor(state, null).declarations[0]).toEqual(state.declarations[0])
    })
})

describe("viewFor — turn, legal moves and legal bids", () => {
    it("reports the bidding turn during BIDDING and offers bids only to that seat", () => {
        const state = newGame({ targetScore: 1001, seed: "view-bid" })
        const onTurn = state.bidding.turn
        const other = nextSeat(onTurn)
        expect(viewFor(state, onTurn).turn).toBe(onTurn)
        expect(viewFor(state, onTurn).legalBids).toEqual({
            canPass: true,
            suits: ["HERC", "KARA", "PIK", "TREF"],
        })
        expect(viewFor(state, other).legalBids).toBeNull()
        expect(viewFor(state, other).turn).toBe(onTurn)
        expect(viewFor(state, onTurn).legalMoves).toEqual([])
    })

    it("reports the trick turn during PLAYING and fills legalMoves only for that seat", () => {
        const state = dealtGame("view-play")
        const onTurn = state.trick.turn
        const other = nextSeat(onTurn)
        expect(viewFor(state, onTurn).turn).toBe(onTurn)
        expect(viewFor(state, onTurn).legalMoves).toEqual(legalMoves(state, onTurn))
        expect(viewFor(state, onTurn).legalMoves.length).toBeGreaterThan(0)
        expect(viewFor(state, other).legalMoves).toEqual([])
        expect(viewFor(state, onTurn).legalBids).toBeNull()
    })

    it("has no turn once the deal or the game is over", () => {
        const start = dealtGame("view-done")
        const { state } = playDeal(start)
        expect(state.phase).toBe("DEAL_DONE")
        expect(viewFor(state, 0).turn).toBeNull()
        expect(viewFor(state, 0).legalMoves).toEqual([])
        expect(viewFor(state, 0).dealScore).not.toBeNull()
        expect(viewFor(state, 0).history).toHaveLength(1)
    })
})

describe("viewFor — played cards and the last trick", () => {
    it("lists every card of the completed tricks in play order", () => {
        const { state, played } = playDeal(dealtGame("view-played"))
        const view = viewFor(state, null)
        expect(played).toHaveLength(32)
        expect(view.played).toEqual(played)
        expect(new Set(view.played).size).toBe(32)
    })

    it("grows a trick at a time and never includes the trick in progress", () => {
        let state = dealtGame("view-progress")
        const played: Card[] = []
        let completed = 0
        while (state.phase === "PLAYING") {
            const seat = state.trick.turn
            const card = legalMoves(state, seat)[0] as Card
            state = reduce(state, { type: "PLAY", seat, card }).state
            played.push(card)
            if (state.trick.cards.length === 0) completed++
            const view = viewFor(state, seat)
            expect(view.played).toHaveLength(completed * 4)
            expect(view.played).toEqual(played.slice(0, completed * 4))
        }
    })

    it("exposes the last completed trick and the running trick counts", () => {
        let state = dealtGame("view-last")
        expect(viewFor(state, 0).lastTrick).toBeNull()
        expect(viewFor(state, 0).tricksWon).toEqual({ A: 0, B: 0 })

        const first: Card[] = []
        for (let i = 0; i < 4; i++) {
            const seat = state.trick.turn
            const card = legalMoves(state, seat)[0] as Card
            first.push(card)
            state = reduce(state, { type: "PLAY", seat, card }).state
        }
        const view = viewFor(state, 0)
        expect(view.lastTrick?.cards).toEqual(first)
        expect(view.lastTrick?.winner).toBe(state.trick.leader)
        expect(view.tricksWon.A + view.tricksWon.B).toBe(1)
    })

    it("keeps the last trick and the scores visible in DEAL_DONE", () => {
        const { state } = playDeal(dealtGame("view-deal-done"))
        const view = viewFor(state, 1)
        expect(view.lastTrick).not.toBeNull()
        expect(view.tricksWon.A + view.tricksWon.B).toBe(8)
        expect(view.played).toHaveLength(32)
        expect(view.score).toEqual(state.score)
        expect(view.handSizes).toEqual({ 0: 0, 1: 0, 2: 0, 3: 0 })
    })
})

describe("viewFor — trivia", () => {
    it("carries the bela flag and the trick in progress", () => {
        const state = playing({
            trump: "HERC",
            leader: 0,
            cards: [{ seat: 0, card: "APIK" }],
            hands: { 1: ["7PIK", "KPIK"] },
        })
        const view = viewFor(state, 1)
        expect(view.trick.cards).toEqual([{ seat: 0, card: "APIK" }])
        expect(view.trick.cards[0]).not.toBe(state.trick.cards[0])
        expect(view.belaDeclared).toBeNull()
        expect(view.handSizes).toEqual({ 0: 0, 1: 2, 2: 0, 3: 0 })
    })
})
