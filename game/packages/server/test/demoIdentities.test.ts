/* The demo cast (`src/demo/identities.ts`). Everything asserted here is a
 * thing a real user would SEE: a name above a seat, a win percentage next to
 * it, and how long the seat takes to play a card. A pool that fails any of
 * these gives the whole demo lobby away (DEMO-LOBBY.md §3).
 *
 * The rng is seeded, so a failure here is reproducible rather than a flake. */

import { describe, expect, it } from "vitest"
import { DEFAULTS, KARMA_MAX, LIMITS, AVATAR_PRESETS, validatePlayerName } from "@bela/protocol"
import type { PlayerGameStats } from "@bela/protocol"
import { createIdentityPool, DEMO_TEMPO_CEILING_MS, DEMO_TEMPO_HEADROOM_MS } from "../src/demo/identities.js"

/** Deterministic, dependency-free PRNG — the tests must not depend on
 *  `Math.random` any more than the director does. */
function seeded(seed: number): () => number {
    let a = seed >>> 0
    return () => {
        a = (a + 0x6d2b79f5) >>> 0
        let t = a
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

function bucketTotals(stats: PlayerGameStats): { games: number; wins: number; losses: number } {
    let games = 0
    let wins = 0
    let losses = 0
    for (const rec of Object.values(stats.byTargetScore)) {
        if (!rec) continue
        games += rec.games
        wins += rec.wins
        losses += rec.losses
    }
    return { games, wins, losses }
}

describe("createIdentityPool", () => {
    it("builds a full cast of names a real user could plausibly have", () => {
        const pool = createIdentityPool(seeded(1), 90)
        expect(pool.size).toBeGreaterThanOrEqual(60)

        const seen = new Set<string>()
        for (const id of pool.all()) {
            expect(id.uid.startsWith("demo:")).toBe(true)
            expect(validatePlayerName(id.name).ok).toBe(true)
            expect(id.name.length).toBeLessThanOrEqual(LIMITS.playerNameMax)
            expect(id.name.length).toBeGreaterThan(0)
            // The one word that would give it away instantly.
            expect(id.name.toLowerCase()).not.toContain("bot")
            // No truncated surname: a name ending in a bare letter must carry
            // the abbreviating dot ("Dado K.", never "Dado K").
            expect(/\s[A-ZŠĐČĆŽ]$/u.test(id.name)).toBe(false)
            expect(seen.has(id.name)).toBe(false)
            seen.add(id.name)
            expect(AVATAR_PRESETS as readonly string[]).toContain(id.avatarPreset)
        }
        expect(new Set(pool.all().map((i) => i.uid)).size).toBe(pool.size)
    })

    it("shows all three shapes real users arrive with", () => {
        const names = createIdentityPool(seeded(7), 90).all().map((i) => i.name)
        // "Marko Babić" — a Google display name.
        expect(names.some((n) => /^[A-ZŠĐČĆŽ][^\s]+ [A-ZŠĐČĆŽ][^\s.]{2,}$/u.test(n))).toBe(true)
        // "Dado K." — the shortened form a long surname has to take.
        expect(names.some((n) => /\s[A-ZŠĐČĆŽ]\.$/u.test(n))).toBe(true)
        // "stari vuk" — a guest nickname.
        expect(names.some((n) => /^[a-zšđčćž]/u.test(n))).toBe(true)
    })

    it("gives everyone a record whose buckets add up to the global one", () => {
        for (const seed of [2, 3, 4, 5]) {
            for (const id of createIdentityPool(seeded(seed), 90).all()) {
                const g = id.gameStats.global
                expect(g.games).toBe(g.wins + g.losses)
                expect(g.wins).toBeGreaterThanOrEqual(0)
                expect(g.losses).toBeGreaterThanOrEqual(0)
                expect(g.winRate).toBeCloseTo(g.wins / g.games, 2)

                const totals = bucketTotals(id.gameStats)
                expect(totals.games).toBe(g.games)
                expect(totals.wins).toBe(g.wins)
                expect(totals.losses).toBe(g.losses)

                for (const rec of Object.values(id.gameStats.byTargetScore)) {
                    if (!rec) continue
                    expect(rec.games).toBe(rec.wins + rec.losses)
                    expect(rec.wins).toBeLessThanOrEqual(rec.games)
                }
            }
        }
    })

    it("has no perfect record past ten games, and a believable spread", () => {
        const pool = createIdentityPool(seeded(11), 90)
        let newcomers = 0
        let veterans = 0
        for (const id of pool.all()) {
            const g = id.gameStats.global
            if (g.games > 10) {
                expect(g.wins).toBeGreaterThan(0)
                expect(g.losses).toBeGreaterThan(0)
                expect(g.winRate).toBeGreaterThanOrEqual(0.4)
                expect(g.winRate).toBeLessThanOrEqual(0.63)
            }
            if (g.games <= 12) newcomers += 1
            if (g.games >= 150) veterans += 1
            expect(id.karma).toBeLessThanOrEqual(KARMA_MAX)
            expect(id.karma).toBeGreaterThanOrEqual(KARMA_MAX - 2)
        }
        // Both ends of the population exist — a lobby of only veterans (or
        // only newcomers) reads as generated.
        expect(newcomers).toBeGreaterThan(0)
        expect(veterans).toBeGreaterThan(0)
    })

    it("gives everyone their own tempo, always inside the turn deadline", () => {
        const pool = createIdentityPool(seeded(13), 90)
        const signatures = new Set<string>()
        for (const id of pool.all()) {
            const t = id.tempo
            expect(t.fastMs[0]).toBeLessThan(t.fastMs[1])
            expect(t.slowMs[0]).toBeLessThan(t.slowMs[1])
            expect(t.fastMs[1]).toBeLessThanOrEqual(t.slowMs[0])
            expect(t.slowChance).toBeGreaterThanOrEqual(0.08)
            expect(t.slowChance).toBeLessThanOrEqual(0.25)
            // The slowest possible draw still lands well before the server
            // would play the card for them.
            expect(t.slowMs[1]).toBeLessThanOrEqual(DEMO_TEMPO_CEILING_MS)
            expect(t.slowMs[1]).toBeLessThan(DEFAULTS.turnTimeoutMs - DEMO_TEMPO_HEADROOM_MS)
            signatures.add(`${t.fastMs[0]}-${t.fastMs[1]}-${t.slowMs[0]}-${t.slowMs[1]}-${t.slowChance}`)
        }
        // Four seats that think in lockstep is the tell; the cast must not be
        // three profiles copy-pasted.
        expect(signatures.size).toBeGreaterThan(pool.size / 2)
    })

    it("never hands the same person out twice at once", () => {
        const pool = createIdentityPool(seeded(17), 40)
        const held: string[] = []
        for (;;) {
            const person = pool.acquire(0)
            if (!person) break
            expect(held).not.toContain(person.uid)
            held.push(person.uid)
        }
        expect(held.length).toBe(pool.size)
        expect(pool.inUseCount()).toBe(pool.size)
        expect(pool.acquire(0)).toBeNull()
    })

    it("rests a person before they can reappear", () => {
        const pool = createIdentityPool(seeded(19), 3)
        const taken: string[] = []
        for (;;) {
            const person = pool.acquire(0)
            if (!person) break
            taken.push(person.uid)
        }
        const first = pool.all()[0]
        expect(first).toBeDefined()
        if (!first) return
        pool.release(first, "left", 0)
        expect(pool.isInUse(first)).toBe(false)
        // Straight back into a room would be the giveaway.
        expect(pool.acquire(0)).toBeNull()
        expect(pool.acquire(301_000)?.uid).toBe(first.uid)
        void taken
    })

    it("books a finished game into the record and keeps the totals honest", () => {
        const pool = createIdentityPool(seeded(23), 10)
        const person = pool.acquire(0)
        expect(person).not.toBeNull()
        if (!person) return
        const before = person.gameStats.global.games
        const winsBefore = person.gameStats.global.wins

        pool.release(person, "won", 1_000)
        expect(person.gameStats.global.games).toBe(before + 1)
        expect(person.gameStats.global.wins).toBe(winsBefore + 1)

        const again = pool.acquire(400_000)
        expect(again).not.toBeNull()
        if (again) pool.release(again, "lost", 400_000)

        for (const id of pool.all()) {
            const g = id.gameStats.global
            expect(g.games).toBe(g.wins + g.losses)
            const totals = bucketTotals(id.gameStats)
            expect(totals.games).toBe(g.games)
            expect(totals.wins).toBe(g.wins)
            expect(totals.losses).toBe(g.losses)
        }
    })

    it("never throws on a hostile size and never invents a bad name", () => {
        expect(() => createIdentityPool(seeded(29), 0)).not.toThrow()
        expect(createIdentityPool(seeded(29), 0).size).toBe(0)
        // Far more people than the name lists can supply uniquely: the pool
        // comes back smaller rather than looping or duplicating.
        const huge = createIdentityPool(seeded(31), 5_000)
        expect(huge.size).toBeLessThan(5_000)
        expect(new Set(huge.all().map((i) => i.name)).size).toBe(huge.size)
    })
})
