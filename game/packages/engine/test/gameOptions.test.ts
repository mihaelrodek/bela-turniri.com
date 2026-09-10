import { describe, expect, it } from "vitest"
import { legalMoves, newGame, reduce, viewFor } from "../src/index"
import { playing } from "./helpers"

describe("declaration options", () => {
    it("suppresses declarations and their reveal for an entire deal", () => {
        const start = newGame({ targetScore: 1001, seed: "options", noDeclarations: true, allowBela: false })
        let state = reduce(start, { type: "BID", seat: start.bidding.turn, trump: "HERC" }).state
        expect(Object.values(state.declarations).flat()).toEqual([])
        while (state.phase === "PLAYING") {
            const seat = state.trick.turn
            const result = reduce(state, { type: "PLAY", seat, card: legalMoves(state, seat)[0]! })
            expect(result.events.some((e) => e.type === "DECLARATIONS_REVEALED" || e.type === "BELA")).toBe(false)
            state = result.state
        }
        expect(state.dealScore?.declarationPoints).toEqual({ A: 0, B: 0 })
        expect(state.dealScore!.total.A + state.dealScore!.total.B).toBe(state.dealScore!.stiglja ? 252 : 162)
        const next = reduce(state, { type: "NEXT_DEAL" }).state
        expect(next.config.noDeclarations).toBe(true)
        expect(next.config.allowBela).toBe(false)
        expect(viewFor(next, 0).currentDealPoints).toEqual({ A: 0, B: 0 })
    })

    it.each([
        [true, false, false],
        [true, true, true],
        [false, false, true],
        [false, true, true],
    ])("noDeclarations=%s, allowBela=%s produces bela=%s", (noDeclarations, allowBela, expected) => {
        const state = playing({ trump: "HERC", leader: 0, hands: { 0: ["KHERC", "QHERC"] } })
        state.config = { ...state.config, noDeclarations, allowBela }
        const result = reduce(state, { type: "PLAY", seat: 0, card: "KHERC" })
        expect(result.events.some((e) => e.type === "BELA")).toBe(expected)
        expect(result.state.belaDeclared).toBe(expected ? "A" : null)
    })

    it("keeps standard declarations enabled by default", () => {
        const base = newGame({ targetScore: 1001, seed: "defaults" })
        expect(base.config.gameEndRule).toBe("prolaz")
        const standard = reduce(base, { type: "BID", seat: base.bidding.turn, trump: "HERC" }).state
        const explicit = reduce({ ...base, config: { ...base.config, noDeclarations: false } },
            { type: "BID", seat: base.bidding.turn, trump: "HERC" }).state
        expect(standard.declarations).toEqual(explicit.declarations)
        expect(standard.belaDeclared).toBeNull()
    })
})
