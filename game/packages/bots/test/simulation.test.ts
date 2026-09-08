/* End-to-end simulations driving the real engine (@bela/engine) with bots
   choosing every bid and card via their public contract (view + legal + rng),
   exactly as the server will. */

import { describe, expect, it } from "vitest"
import type { BidChoice, Bot } from "../src/index"
import type { Card, GameAction, GameState, LegalBids, PlayerView, Seat } from "@bela/engine"
import { legalBids, legalMoves, newGame, reduce, viewFor } from "@bela/engine"
import { createBot } from "../src/index"
import { bestSuit } from "../src/evaluate"
import { makeRng, view } from "./helpers"

const MAX_STEPS = 20_000

/* ──────────────────────────────────────────────────────────────────────────
   TEST BASELINE — not a shipped bot.

   There is exactly one bot in `@bela/bots` (README §5); difficulty levels were
   removed. This uniform-random legal player exists ONLY here, as the fixed
   yardstick the strength test measures the real bot against, so a regression
   in the heuristic still fails loudly. Its behaviour is unchanged from the
   weakest bot that used to ship, so the ≥60 % margin below is directly
   comparable to the guard it replaces.
   Do not export it and do not wire it into the server.
   ────────────────────────────────────────────────────────────────────── */
const randomBaseline: Bot = {
    chooseBid(v: PlayerView, legal: LegalBids): BidChoice {
        // Passes whenever it may; when forced (mus) it calls its strongest suit.
        return legal.canPass ? "PASS" : bestSuit(v.hand, legal.suits)
    },
    chooseCard(_v: PlayerView, legal: Card[], rng: () => number): Card {
        const idx = Math.floor(rng() * legal.length)
        return legal[Math.min(Math.max(idx, 0), legal.length - 1)] as Card
    },
}

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
            const v = viewFor(state, seat)
            const rng = rngs.get(seat) as () => number
            const choice = botFor(seat).chooseBid(v, legal, rng)
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
            const v = viewFor(state, seat)
            const rng = rngs.get(seat) as () => number
            const card = botFor(seat).chooseCard(v, legal, rng)
            expect(legal).toContain(card)
            action = { type: "PLAY", seat, card }
        } else {
            action = { type: "NEXT_DEAL" }
        }

        state = reduce(state, action).state
    }

    return state
}

describe("bots-only simulation", () => {
    it("plays 20 seeded games to completion, always choosing legal bids and cards", () => {
        const bot = createBot()
        for (let i = 0; i < 20; i++) {
            const state = driveGame(`sim-${i}`, 501, () => bot)
            expect(state.phase).toBe("GAME_OVER")
            expect(state.winner).not.toBeNull()
        }
    })
})

/* The baseline is a yardstick, so it has to stay the yardstick it was: these
   three assertions pin its behaviour exactly where it has always been. */
describe("test baseline (random legal play)", () => {
    it("always returns a legal card, uniformly across the rng range", () => {
        const legal: Card[] = ["7HERC", "JHERC", "APIK"]
        const v = view({ seat: 0, hand: legal })
        expect(randomBaseline.chooseCard(v, legal, () => 0)).toBe("7HERC")
        expect(randomBaseline.chooseCard(v, legal, () => 0.3)).toBe("7HERC")
        expect(randomBaseline.chooseCard(v, legal, () => 0.4)).toBe("JHERC")
        expect(randomBaseline.chooseCard(v, legal, () => 0.99999)).toBe("APIK")
    })

    it("passes whenever it can", () => {
        const v = view({ seat: 0, hand: ["JHERC", "9HERC", "APIK"] })
        expect(
            randomBaseline.chooseBid(v, { canPass: true, suits: ["HERC", "KARA", "PIK", "TREF"] }, () => 0),
        ).toBe("PASS")
    })

    it("calls the strongest suit when forced (mus), never passing", () => {
        const v = view({ seat: 3, hand: ["JHERC", "9HERC", "7PIK", "8PIK", "7TREF", "8TREF"] })
        expect(
            randomBaseline.chooseBid(v, { canPass: false, suits: ["HERC", "KARA", "PIK", "TREF"] }, () => 0),
        ).toBe("HERC")
    })
})

describe("strength: the bot beats random legal play", () => {
    it("wins clearly more than half of 30 seeded games (seats 0/2 = bot, 1/3 = baseline)", () => {
        const bot = createBot()
        const botFor = (seat: Seat): Bot => (seat === 0 || seat === 2 ? bot : randomBaseline)

        const GAMES = 30
        let botWins = 0
        for (let i = 0; i < GAMES; i++) {
            const state = driveGame(`strength-${i}`, 501, botFor)
            if (state.winner === "A") botWins++
        }
        const rate = botWins / GAMES
        // eslint-disable-next-line no-console
        console.log(`bot vs random baseline win rate: ${botWins}/${GAMES} = ${(rate * 100).toFixed(1)}%`)
        expect(rate).toBeGreaterThanOrEqual(0.6)
    }, 60_000)
})

describe("determinism", () => {
    it("the same seed and the same bots give an identical final score", () => {
        const bot = createBot()
        const a = driveGame("determinism-1", 501, () => bot)
        const b = driveGame("determinism-1", 501, () => bot)
        expect(a.score).toEqual(b.score)
        expect(a.winner).toBe(b.winner)
        expect(a.history).toEqual(b.history)
    })
})
