/* Deterministic PRNG. The state is plain serialisable data so it can live
   inside GameState and travel through structuredClone / JSON.

   FNV-1a string hash → mulberry32. Every random draw returns a NEW state; the
   engine never keeps a closure-based generator. */

import type { RngState } from "./types"

function hashSeed(seed: string): number {
    let h = 0x811c9dc5
    for (let i = 0; i < seed.length; i++) {
        h ^= seed.charCodeAt(i)
        h = Math.imul(h, 0x01000193)
    }
    // Avoid the degenerate all-zero state.
    return (h >>> 0) || 0x9e3779b9
}

export function createRng(seed: string): RngState {
    return { s: hashSeed(seed) }
}

export function nextFloat(rng: RngState): { value: number; rng: RngState } {
    const a = (rng.s + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296
    return { value, rng: { s: a >>> 0 } }
}

/** Uniform integer in [0, bound). `bound` must be ≥ 1. */
export function nextInt(rng: RngState, bound: number): { value: number; rng: RngState } {
    const step = nextFloat(rng)
    return { value: Math.floor(step.value * bound), rng: step.rng }
}

/** Fisher–Yates. Returns a new array; the input is never touched. */
export function shuffle<T>(items: readonly T[], rng: RngState): { items: T[]; rng: RngState } {
    const out = items.slice()
    let r = rng
    for (let i = out.length - 1; i > 0; i--) {
        const step = nextInt(r, i + 1)
        r = step.rng
        const j = step.value
        const a = out[i] as T
        const b = out[j] as T
        out[i] = b
        out[j] = a
    }
    return { items: out, rng: r }
}
