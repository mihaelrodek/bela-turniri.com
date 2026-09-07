/* Shared test scaffolding for @bela/bots. Not a test file itself. */

import type { Card, PlayerView, Seat } from "@bela/engine"

/** Build a full PlayerView for unit tests, overriding whatever fields the
 *  scenario cares about. Defaults: seat 0, trump HERC, empty trick. */
export function view(over: Partial<PlayerView> & { seat: Seat; hand: Card[] }): PlayerView {
    const base: PlayerView = {
        seat: over.seat,
        phase: "PLAYING",
        dealNo: 1,
        dealer: 3,
        hand: over.hand,
        handSizes: { 0: 8, 1: 8, 2: 8, 3: 8 },
        bidding: { turn: 0, passes: [], trump: "HERC", caller: 0 },
        trick: { leader: over.seat, turn: over.seat, cards: [] },
        tricksWon: { A: 0, B: 0 },
        lastTrick: null,
        declarations: {},
        declarationsRevealed: false,
        belaDeclared: null,
        dealScore: null,
        score: { A: 0, B: 0 },
        history: [],
        winner: null,
        turn: over.seat,
        legalMoves: [],
        legalBids: null,
        played: [],
    }
    return { ...base, ...over }
}

/** Deterministic mulberry32-family PRNG seeded from a string; matches the
 *  `() => number` shape bots expect. Not the engine's own RNG — bots never
 *  see GameState — but reproducible for a given seed string, which is all
 *  the determinism tests require. */
export function makeRng(seedStr: string): () => number {
    let h = 1779033703 ^ seedStr.length
    for (let i = 0; i < seedStr.length; i++) {
        h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353)
        h = (h << 13) | (h >>> 19)
    }
    let a = h >>> 0
    return function next(): number {
        a = (a + 0x6d2b79f5) | 0
        let t = Math.imul(a ^ (a >>> 15), 1 | a)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}
