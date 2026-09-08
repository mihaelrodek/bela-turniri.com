/* Shared test scaffolding. Not a test file itself (vitest only picks up
   *.test.ts), just a way to hand-build GameState for the pure-rule tests. */

import { expect } from "vitest"
import type { Card, GameState, Seat, Suit, TrickCard, WonTrick } from "../src/index"
import { EngineError, createRng } from "../src/index"

/**
 * A completed trick in the shape the engine stores (`WonTrick`): its position
 * in the deal, who led, who won, and every play with its seat. Seats are
 * handed out from `leader` in play order — enough for the scoring and review
 * tests, which care about the cards and the order, not about who was dealt what.
 */
export function won(no: number, winner: Seat, cards: Card[], leader: Seat = winner): WonTrick {
    return {
        no,
        leader,
        winner,
        plays: cards.map((card, i) => ({ seat: (((leader + i) % 4) as Seat), card })),
        cards: cards.slice(),
    }
}

/** Assert that `fn` throws an EngineError carrying exactly `code`. */
export function expectEngineError(fn: () => unknown, code: EngineError["code"]): void {
    let thrown: unknown = null
    let threw = false
    try {
        fn()
    } catch (error) {
        threw = true
        thrown = error
    }
    expect(threw, `expected an EngineError with code ${code}`).toBe(true)
    expect(thrown).toBeInstanceOf(EngineError)
    expect((thrown as EngineError).code).toBe(code)
}

export function makeState(over: Partial<GameState> = {}): GameState {
    const base: GameState = {
        config: { targetScore: 1001, seed: "test" },
        dealNo: 1,
        dealer: 3,
        phase: "PLAYING",
        hands: { 0: [], 1: [], 2: [], 3: [] },
        stock: [],
        bidding: { turn: 0, passes: [], trump: "HERC", caller: 0 },
        trick: { leader: 0, turn: 0, cards: [] },
        tricksWon: { A: [], B: [] },
        declarations: { 0: [], 1: [], 2: [], 3: [] },
        declarationsScoringTeam: null,
        belaDeclared: null,
        belaRefused: null,
        dealScore: null,
        score: { A: 0, B: 0 },
        history: [],
        rng: createRng("test"),
        winner: null,
    }
    return { ...base, ...over }
}

/** A PLAYING state with a trick already in progress. `turn` is derived from the trick. */
export function playing(opts: {
    trump: Suit
    hands: Partial<Record<Seat, Card[]>>
    leader: Seat
    cards?: TrickCard[]
    turn?: Seat
    dealer?: Seat
}): GameState {
    const hands: Record<Seat, Card[]> = { 0: [], 1: [], 2: [], 3: [] }
    for (const s of [0, 1, 2, 3] as Seat[]) hands[s] = opts.hands[s] ?? []
    const cards = opts.cards ?? []
    const turn = opts.turn ?? (((opts.leader + cards.length) % 4) as Seat)
    return makeState({
        phase: "PLAYING",
        dealer: opts.dealer ?? 3,
        hands,
        bidding: { turn: 0, passes: [], trump: opts.trump, caller: 0 },
        trick: { leader: opts.leader, turn, cards },
    })
}

export function tc(seat: Seat, card: Card): TrickCard {
    return { seat, card }
}

/** Every card the deal still accounts for — used to assert nothing is lost or duplicated. */
export function allCards(state: GameState): Card[] {
    const out: Card[] = [...state.stock]
    for (const s of [0, 1, 2, 3] as Seat[]) out.push(...state.hands[s])
    for (const t of state.trick.cards) out.push(t.card)
    for (const team of ["A", "B"] as const) {
        for (const won of state.tricksWon[team]) out.push(...won.cards)
    }
    return out
}
