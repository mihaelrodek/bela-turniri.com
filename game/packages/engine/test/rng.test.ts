import { describe, expect, it } from "vitest"
import { createRng, fullDeck, nextFloat, shuffle } from "../src/index"

describe("createRng", () => {
    it("is a pure function of the seed string", () => {
        expect(createRng("abc")).toEqual(createRng("abc"))
        expect(createRng("abc")).not.toEqual(createRng("abd"))
    })

    it("produces plain serialisable data", () => {
        const rng = createRng("seed")
        expect(structuredClone(rng)).toEqual(rng)
        expect(Object.keys(rng)).toEqual(["s"])
    })

    it("never starts from a degenerate empty state", () => {
        expect(Number.isInteger(createRng("").s)).toBe(true)
        expect(createRng("").s).not.toBe(0)
    })
})

describe("nextFloat", () => {
    it("returns values in [0, 1) and a new state each time", () => {
        let rng = createRng("floats")
        const seen: number[] = []
        for (let i = 0; i < 500; i++) {
            const step = nextFloat(rng)
            expect(step.value).toBeGreaterThanOrEqual(0)
            expect(step.value).toBeLessThan(1)
            expect(step.rng).not.toBe(rng)
            rng = step.rng
            seen.push(step.value)
        }
        // A sane generator does not repeat itself over 500 draws.
        expect(new Set(seen).size).toBeGreaterThan(490)
    })

    it("does not mutate the state it was given", () => {
        const rng = createRng("immutable")
        const snapshot = structuredClone(rng)
        nextFloat(rng)
        nextFloat(rng)
        expect(rng).toEqual(snapshot)
    })

    it("is deterministic: same state ⇒ same value", () => {
        const rng = createRng("det")
        expect(nextFloat(rng)).toEqual(nextFloat(rng))
    })
})

describe("shuffle", () => {
    it("returns a permutation and a fresh array", () => {
        const deck = fullDeck()
        const snapshot = structuredClone(deck)
        const out = shuffle(deck, createRng("s1"))
        expect(out.items).not.toBe(deck)
        expect(deck).toEqual(snapshot)
        expect([...out.items].sort()).toEqual([...deck].sort())
    })

    it("is deterministic for the same seed and different for others", () => {
        const a = shuffle(fullDeck(), createRng("s1"))
        const b = shuffle(fullDeck(), createRng("s1"))
        const c = shuffle(fullDeck(), createRng("s2"))
        expect(a.items).toEqual(b.items)
        expect(a.rng).toEqual(b.rng)
        expect(a.items).not.toEqual(c.items)
    })

    it("actually mixes the deck", () => {
        const out = shuffle(fullDeck(), createRng("mix"))
        expect(out.items).not.toEqual(fullDeck())
    })

    it("handles empty and single-element inputs", () => {
        const rng = createRng("edge")
        expect(shuffle([], rng).items).toEqual([])
        expect(shuffle(["x"], rng).items).toEqual(["x"])
    })
})
