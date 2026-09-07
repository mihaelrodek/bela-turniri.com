/* End-to-end simulations driving the real engine (@bela/engine) with bots
   choosing every bid and card via their public contract (view + legal + rng),
   exactly as the server will. */

import { describe, expect, it } from "vitest"
import type { Bot } from "../src/index"
import type { GameAction, GameState, Seat } from "@bela/engine"
import { legalBids, legalMoves, newGame, reduce, viewFor } from "@bela/engine"
import { createBot } from "../src/createBot"
import { makeRng } from "./helpers"

const MAX_STEPS = 20_000

function driveGame(
    seed: string,
    targetScore: 501 | 1001,
    botFor: (seat: Seat) => Bot,
): GameState {
    let state = newGame({ seed, targetScore })
    const rngs = new Map<Seat, () => number>(
        ([0, 1, 2, 3] as Seat[]).map((seat) => [seat, makeRng(`${seed}:${seat}`)]),
    )
    let steps = 0

    while (state.phase !== "GAME_OVER") {
        steps++
        if (steps > MAX_STEPS) throw new Error(`game did not terminate after ${MAX_STEPS} steps`)

        let action: GameAction
        if (state.phase === "BIDDING") {
            const seat = state.bidding.turn
            const legal = legalBids(state, seat)
            const view = viewFor(state, seat)
            const rng = rngs.get(seat) as () => number
            const choice = botFor(seat).chooseBid(view, legal, rng)
            if (choice === "PASS") {
                expect(legal.canPass).toBe(true)
                action = { type: "PASS", seat }
            } else {
                expect(legal.suits).toContain(choice)
                action = { type: "BID", seat, trump: choice }
            }
        } else if (state.phase === "PLAYING") {
            const seat = state.trick.turn
            const legal = legalMoves(state, seat)
            expect(legal.length).toBeGreaterThan(0)
            const view = viewFor(state, seat)
            const rng = rngs.get(seat) as () => number
            const card = botFor(seat).chooseCard(view, legal, rng)
            expect(legal).toContain(card)
            action = { type: "PLAY", seat, card }
        } else {
            action = { type: "NEXT_DEAL" }
        }

        state = reduce(state, action).state
    }

    return state
}

describe("bots-only simulation (srednje all round)", () => {
    it("plays 20 seeded games to completion, always choosing legal bids and cards", () => {
        const bot = createBot("srednje")
        for (let i = 0; i < 20; i++) {
            const state = driveGame(`sim-${i}`, 501, () => bot)
            expect(state.phase).toBe("GAME_OVER")
            expect(state.winner).not.toBeNull()
        }
    })
})

describe("strength: srednje beats lako", () => {
    it("wins clearly more than half of 30 seeded games (seats 0/2 = srednje, 1/3 = lako)", () => {
        const srednje = createBot("srednje")
        const lako = createBot("lako")
        const botFor = (seat: Seat): Bot => (seat === 0 || seat === 2 ? srednje : lako)

        const GAMES = 30
        let srednjeWins = 0
        for (let i = 0; i < GAMES; i++) {
            const state = driveGame(`strength-${i}`, 501, botFor)
            if (state.winner === "A") srednjeWins++
        }
        const rate = srednjeWins / GAMES
        // eslint-disable-next-line no-console
        console.log(`srednje vs lako win rate: ${srednjeWins}/${GAMES} = ${(rate * 100).toFixed(1)}%`)
        expect(rate).toBeGreaterThanOrEqual(0.6)
    }, 60_000)
})

describe("strength: tesko vs srednje", () => {
    it("does not lose badly over 10 seeded games (seats 0/2 = tesko, 1/3 = srednje)", () => {
        const tesko = createBot("tesko")
        const srednje = createBot("srednje")
        const botFor = (seat: Seat): Bot => (seat === 0 || seat === 2 ? tesko : srednje)

        const GAMES = 10
        let teskoWins = 0
        for (let i = 0; i < GAMES; i++) {
            const state = driveGame(`hard-${i}`, 501, botFor)
            if (state.winner === "A") teskoWins++
        }
        const rate = teskoWins / GAMES
        // eslint-disable-next-line no-console
        console.log(`tesko vs srednje win rate: ${teskoWins}/${GAMES} = ${(rate * 100).toFixed(1)}%`)
        // No strict assertion — just a sanity floor so a badly broken search fails loudly.
        expect(rate).toBeGreaterThanOrEqual(0.2)
    }, 120_000)
})

describe("determinism", () => {
    it("the same seed and the same bots give an identical final score", () => {
        const bot = createBot("srednje")
        const a = driveGame("determinism-1", 501, () => bot)
        const b = driveGame("determinism-1", 501, () => bot)
        expect(a.score).toEqual(b.score)
        expect(a.winner).toBe(b.winner)
        expect(a.history).toEqual(b.history)
    })

    it("tesko (rng-driven search) is also reproducible for a fixed seed", () => {
        const tesko = createBot("tesko")
        const a = driveGame("determinism-tesko", 501, () => tesko)
        const b = driveGame("determinism-tesko", 501, () => tesko)
        expect(a.score).toEqual(b.score)
        expect(a.winner).toBe(b.winner)
    }, 30_000)
})
