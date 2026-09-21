/* ──────────────────────────────────────────────────────────────────────────
   DEMO LOBBY — WHO the fake people are (game/DEMO-LOBBY.md §2, table row 1).

   Pure data plus an injected `rng`: this module knows nothing about rooms,
   seats or time beyond "this person is resting". The director asks for a
   person (`acquire`) and gives them back (`release`), which is also where a
   finished game is booked into the record — that is the only reason
   `DemoIdentity.gameStats` is mutable.

   The three things that would give the illusion away live here:

     1. NAMES. Real users of this app look three different ways — a Google
        display name ("Marko Babić"), a shortened one ("Dado K.") and a guest
        nickname ("stari vuk"). A pool of only one shape reads as generated.
        Several first names are 10 characters and several surnames 14, so a
        full "First Surname" often blows past `LIMITS.playerNameMax`; such a
        pair is either shortened to "First S." or dropped, never truncated
        mid-word (a chopped surname is the most obvious tell of all).
     2. STATS. A `PlayerGameStats` whose buckets do not add up to its global
        record, or a 40-0 veteran, is a lie the client renders faithfully.
        Everything here is built so `sum(byTargetScore) === global` exactly,
        and nobody past ten games has a perfect record.
     3. TEMPO. Four seats that all think for the same 1.8 s are unmistakable.
        Each person carries their own profile, and even the slowest draw stays
        well under `DEFAULTS.turnTimeoutMs` (15 s) — a fake player who times
        out and gets played for by the bot would look broken, not slow.
   ────────────────────────────────────────────────────────────────────── */

import { AVATAR_PRESETS, DEFAULTS, KARMA_MAX, LIMITS, validatePlayerName } from "@bela/protocol"
import type { GameStatRecord, PlayerGameStats, PlayerReliability } from "@bela/protocol"
import { DEMO_FIRST_NAMES, DEMO_NICKNAMES, DEMO_SURNAMES } from "./names.js"
import { DEMO_UID_PREFIX } from "./types.js"
import type { DemoClock, DemoIdentity, DemoTempo } from "./types.js"

/** Outcome booked against a person's record when the director lets them go. */
export type DemoOutcome = "won" | "lost" | "left"

export interface DemoIdentityPool {
    /** How many people exist at all (may be under the requested size when the
     *  name generator ran out of unique, valid candidates). */
    readonly size: number
    /**
     * A person who is in no room right now and has rested long enough since
     * their last one. `null` when everybody is busy or resting — the caller
     * treats that as "not now" and tries again later, never as an error.
     */
    acquire(now?: number): DemoIdentity | null
    /** Give a person back. `outcome` books a win/loss so a recurring face's
     *  record moves by exactly the games they were seen playing. */
    release(identity: DemoIdentity, outcome?: DemoOutcome, now?: number): void
    /** Introspection for the director's watchdog and for tests. */
    inUseCount(): number
    isInUse(identity: DemoIdentity): boolean
    /** Every person, resting or not — tests assert the pool's invariants. */
    all(): readonly DemoIdentity[]
}

/* ───────────────────────────── rng helpers ───────────────────────────── */

function randInt(rng: () => number, min: number, max: number): number {
    if (max <= min) return min
    return min + Math.floor(rng() * (max - min + 1))
}

function randFloat(rng: () => number, min: number, max: number): number {
    return min + rng() * (max - min)
}

function pick<T>(rng: () => number, xs: readonly T[]): T | null {
    if (xs.length === 0) return null
    // `noUncheckedIndexedAccess`: the index is in range, but say so explicitly.
    return xs[Math.min(xs.length - 1, Math.floor(rng() * xs.length))] ?? null
}

/* ─────────────────────────────── names ───────────────────────────────── */

/** Fold to a comparison key so "Marko Babić" and "marko babic" cannot both
 *  exist in one lobby — two near-identical names two rows apart read as a
 *  generator, not as two people. */
function nameKey(name: string): string {
    return name
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "d")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "")
}

function slugForUid(name: string, index: number): string {
    const base = nameKey(name) || "igrac"
    return `${DEMO_UID_PREFIX}${base}-${index}`
}

/** `null` when the candidate is unusable (too long, empty, offensive). Never
 *  throws: a blocklisted surname is simply a name we do not use. */
function acceptName(candidate: string): string | null {
    // "Škarabot" is a real surname and "bot" a real tell. Nothing a fake
    // person is called may contain it, in any case or position.
    if (/bot/i.test(candidate)) return null
    const verdict = validatePlayerName(candidate)
    if (!verdict.ok) return null
    if (verdict.name.length > LIMITS.playerNameMax) return null
    return verdict.name
}

/**
 * One name candidate in one of the three shapes real users arrive with. The
 * caller checks it and asks again on a miss, so this may return `null`.
 */
function makeNameCandidate(rng: () => number): string | null {
    const roll = rng()
    // Nicknames are what makes a lobby look lived-in (owner, 2026-09-21): a
    // wall of "First S." reads as a phone book. A good two fifths of the cast.
    if (roll < 0.42) {
        // Guest nickname, as typed: lower case is what these actually look
        // like in the wild, so only sometimes give it a capital.
        const nick = pick(rng, DEMO_NICKNAMES)
        if (nick === null) return null
        return rng() < 0.35 ? nick.charAt(0).toUpperCase() + nick.slice(1) : nick
    }

    const first = pick(rng, DEMO_FIRST_NAMES)
    const surname = pick(rng, DEMO_SURNAMES)
    if (first === null || surname === null) return null

    if (roll < 0.68) {
        // "Dado K." — the shape a long surname has to take anyway.
        return `${first} ${surname.charAt(0)}.`
    }
    const full = `${first} ${surname}`
    if (full.length <= LIMITS.playerNameMax) return full
    // Too long for the seat label: shorten rather than truncate mid-surname.
    return `${first} ${surname.charAt(0)}.`
}

/* ─────────────────────────────── stats ───────────────────────────────── */

const TARGET_KEYS = ["163", "501", "701", "1001"] as const
type TargetKey = (typeof TARGET_KEYS)[number]

function record(games: number, wins: number): GameStatRecord {
    const losses = games - wins
    // 0..1 fraction, the same unit the server compares `minWinRatePercent`
    // against (`room.ts`), rounded the way a stored record is.
    const winRate = games === 0 ? 0 : Math.round((wins / games) * 1000) / 1000
    return { games, wins, losses, winRate }
}

/** Split `total` over `weights`, exactly — the remainder goes to the heaviest
 *  bucket so the parts always sum back to the whole. */
function splitByWeights(total: number, weights: readonly number[]): number[] {
    const sum = weights.reduce((a, b) => a + b, 0)
    if (sum <= 0 || weights.length === 0) return weights.map(() => 0)
    const parts = weights.map((w) => Math.floor((total * w) / sum))
    let assigned = parts.reduce((a, b) => a + b, 0)
    let i = 0
    while (assigned < total) {
        const at = i % parts.length
        parts[at] = (parts[at] ?? 0) + 1
        assigned += 1
        i += 1
    }
    return parts
}

/**
 * A believable record. The shape is `PlayerGameStats`, and the one hard rule
 * is arithmetic: every bucket's games/wins/losses sum to the global record.
 *
 * Three populations, because a lobby of nothing but 300-game veterans is as
 * obviously generated as a lobby of nothing but newcomers:
 *   newcomer  2..12 games, any win rate (a genuine 3-0 is fine here)
 *   regular  20..150 games
 *   veteran 150..600 games
 * Anyone past ten games lands in 42..61 %, and never 100 % or 0 %.
 */
function makeGameStats(rng: () => number): PlayerGameStats {
    const roll = rng()
    const games = roll < 0.25 ? randInt(rng, 2, 12) : roll < 0.75 ? randInt(rng, 20, 150) : randInt(rng, 150, 600)

    let wins: number
    if (games <= 10) {
        wins = randInt(rng, 0, games)
    } else {
        const rate = randFloat(rng, 0.42, 0.61)
        // Clamp off the perfect records: nobody with a real history is 0 % or
        // 100 %, and the client shows the percentage next to the name.
        wins = Math.min(games - 1, Math.max(1, Math.round(games * rate)))
    }

    // Which disciplines this person plays at all. 1001 is the house default,
    // so everybody has it; the quick 163 is the rarest.
    const keys: TargetKey[] = ["1001"]
    if (rng() < 0.70) keys.push("501")
    if (rng() < 0.60) keys.push("701")
    if (rng() < 0.40) keys.push("163")

    const weights = keys.map((k) => (k === "1001" ? randFloat(rng, 2, 5) : randFloat(rng, 0.4, 1.6)))
    const perGames = splitByWeights(games, weights)

    // Hand out the wins bucket by bucket, keeping the remainder feasible:
    // never more than this bucket has games, never so few that the buckets
    // still to come cannot absorb what is left.
    const byTargetScore: PlayerGameStats["byTargetScore"] = {}
    let winsLeft = wins
    let gamesLeft = games
    for (let i = 0; i < keys.length; i++) {
        const key = keys[i]
        const g = perGames[i] ?? 0
        if (key === undefined) continue
        gamesLeft -= g
        if (g === 0) continue
        const lo = Math.max(0, winsLeft - gamesLeft)
        const hi = Math.min(g, winsLeft)
        const w = i === keys.length - 1 ? winsLeft : randInt(rng, lo, hi)
        byTargetScore[key] = record(g, w)
        winsLeft -= w
    }

    return { global: record(games, wins), byTargetScore }
}

/* ─────────────────────────────── tempo ───────────────────────────────── */

/**
 * The ceiling every draw must stay under. A fake player whose think time
 * reaches `turnTimeoutMs` gets auto-played by the real turn timer, which
 * looks like a bug rather than like a slow uncle — so stay at 60 % of the
 * default even if an operator raises the timeout.
 */
const TEMPO_CEILING_MS = Math.floor(DEFAULTS.turnTimeoutMs * 0.6)

function clampMs(ms: number): number {
    return Math.max(300, Math.min(TEMPO_CEILING_MS, Math.round(ms)))
}

function makeTempo(rng: () => number): DemoTempo {
    const roll = rng()
    // fast / average / slow, with a jittered band each so no two people share
    // a profile byte for byte.
    const base =
        roll < 0.35
            ? { fast: [900, 2200] as const, slow: [3200, 6500] as const, chance: [0.08, 0.15] as const }
            : roll < 0.80
              ? { fast: [1500, 4000] as const, slow: [4000, 8000] as const, chance: [0.10, 0.20] as const }
              : { fast: [2500, 6000] as const, slow: [5500, 8800] as const, chance: [0.15, 0.25] as const }

    const fastLo = clampMs(randFloat(rng, base.fast[0], base.fast[0] + 400))
    const fastHi = clampMs(Math.max(fastLo + 300, randFloat(rng, base.fast[1] - 500, base.fast[1])))
    const slowLo = clampMs(Math.max(fastHi + 200, randFloat(rng, base.slow[0], base.slow[0] + 800)))
    const slowHi = clampMs(Math.max(slowLo + 400, randFloat(rng, base.slow[1] - 1200, base.slow[1])))
    return {
        fastMs: [fastLo, fastHi],
        slowMs: [slowLo, slowHi],
        slowChance: Math.round(randFloat(rng, base.chance[0], base.chance[1]) * 100) / 100,
    }
}

/* ─────────────────────────────── karma ───────────────────────────────── */

function makeKarma(rng: () => number): number {
    const roll = rng()
    // Karma only ever drops by abandoning a game, so most people sit at the
    // cap; a couple of dents make the column look lived-in.
    if (roll < 0.78) return KARMA_MAX
    if (roll < 0.93) return KARMA_MAX - 1
    return KARMA_MAX - 2
}

/**
 * `PlayerReliability` consistent with `karma` (2026-09-21 redesign: karma =
 * `KARMA_MAX` minus abandons in the rolling window), so the popup a fake
 * person's karma opens is never empty and never contradicts the number
 * beside it — the whole point of a demo lobby is that nothing gives it away.
 *
 * `recentGames` (finished, eligible games in the same window) is drawn
 * independently — it says nothing about `karma`, only that this person has
 * been active — and `totalAbandons` (lifetime) is never less than
 * `recentAbandons`: the rolling window is a subset of "ever".
 */
function makeReliability(rng: () => number, karma: number): PlayerReliability {
    const recentAbandons = KARMA_MAX - karma
    const recentGames = randInt(rng, 8, 60)
    const totalAbandons = recentAbandons + randInt(rng, 0, 4)
    return { recentAbandons, recentGames, totalAbandons, windowDays: 30 }
}

/* ──────────────────────────────── pool ───────────────────────────────── */

interface PoolEntry {
    identity: DemoIdentity
    inUse: boolean
    /** Nobody reappears the instant they left: a face that hops straight from
     *  a finished table into a fresh one is the single most visible tell. */
    restUntil: number
}

/**
 * Build the cast. `size` is an upper bound: a candidate that fails
 * `validatePlayerName`, exceeds `LIMITS.playerNameMax` or collides with a
 * name already taken is discarded, and generation stops after a bounded
 * number of attempts rather than looping forever on an exhausted name list.
 */
/** Hard ceiling on the cast, whatever the caller asks for. */
const MAX_POOL_SIZE = 400

export function createIdentityPool(rng: () => number, size = 90, clock?: DemoClock): DemoIdentityPool {
    const entries: PoolEntry[] = []
    const takenNames = new Set<string>()
    const takenUids = new Set<string>()

    // A lobby never needs more than a few hundred people, and an unbounded
    // `size` would only buy a longer boot for names nobody will ever see.
    size = Math.max(0, Math.min(Math.floor(size), MAX_POOL_SIZE))
    const maxAttempts = size * 40
    for (let attempt = 0; attempt < maxAttempts && entries.length < size; attempt++) {
        const candidate = makeNameCandidate(rng)
        if (candidate === null) continue
        const name = acceptName(candidate)
        if (name === null) continue
        const key = nameKey(name)
        if (key === "" || takenNames.has(key)) continue

        const uid = slugForUid(name, entries.length)
        if (takenUids.has(uid)) continue

        takenNames.add(key)
        takenUids.add(uid)
        const karma = makeKarma(rng)
        entries.push({
            identity: {
                uid,
                name,
                avatarPreset: pick(rng, AVATAR_PRESETS) ?? "kralj",
                gameStats: makeGameStats(rng),
                karma,
                reliability: makeReliability(rng, karma),
                tempo: makeTempo(rng),
            },
            inUse: false,
            restUntil: 0,
        })
    }

    const byUid = new Map<string, PoolEntry>()
    for (const e of entries) byUid.set(e.identity.uid, e)

    function nowOf(explicit?: number): number {
        if (typeof explicit === "number") return explicit
        return clock ? clock.now() : 0
    }

    function acquire(now?: number): DemoIdentity | null {
        const t = nowOf(now)
        const free: PoolEntry[] = []
        for (const e of entries) {
            if (!e.inUse && e.restUntil <= t) free.push(e)
        }
        const chosen = pick(rng, free)
        if (chosen === null) return null
        chosen.inUse = true
        return chosen.identity
    }

    function book(identity: DemoIdentity, outcome: DemoOutcome): void {
        if (outcome !== "won" && outcome !== "lost") return
        const stats = identity.gameStats
        const key: TargetKey = "1001"
        // The director books against the discipline it knows the person just
        // played; it passes that through `release` only as win/loss, so the
        // bucket is the house default. Totals stay consistent either way.
        const prev = stats.byTargetScore[key] ?? { games: 0, wins: 0, losses: 0, winRate: 0 }
        const won = outcome === "won" ? 1 : 0
        stats.byTargetScore[key] = record(prev.games + 1, prev.wins + won)
        identity.gameStats = {
            global: record(stats.global.games + 1, stats.global.wins + won),
            byTargetScore: stats.byTargetScore,
        }
    }

    function release(identity: DemoIdentity, outcome?: DemoOutcome, now?: number): void {
        const entry = byUid.get(identity.uid)
        if (!entry) return
        if (outcome) book(identity, outcome)
        entry.inUse = false
        // One to five minutes away before this face can reappear anywhere.
        entry.restUntil = nowOf(now) + randInt(rng, 60_000, 300_000)
    }

    return {
        size: entries.length,
        acquire,
        release,
        inUseCount: () => entries.reduce((n, e) => n + (e.inUse ? 1 : 0), 0),
        isInUse: (identity) => byUid.get(identity.uid)?.inUse === true,
        all: () => entries.map((e) => e.identity),
    }
}

/** The slowest a fake person may ever be seen to think (60 % of the default
 *  turn timeout). Exposed for tests. */
export const DEMO_TEMPO_CEILING_MS = TEMPO_CEILING_MS

/**
 * Safety margin the table keeps between a fake person's drawn think time and
 * the turn deadline (`gameRoom.delayFor`). Under the default timings no draw
 * comes anywhere near it; it only bites when an operator shortens
 * `turnTimeoutMs`, and then it is what stops a "slow uncle" from turning into
 * a seat the server has to auto-play for.
 */
export const DEMO_TEMPO_HEADROOM_MS = 2_500
