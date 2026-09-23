/* ──────────────────────────────────────────────────────────────────────────
   ZAPIS PARTIJE (README §8.8) — the full replay that rides along with the
   stats report.

   Two halves, because the claim has two halves:

     1. END TO END. A real game is played through a real server (one human
        seat, three bots) and the POST to `/internal/game-results` is
        captured. The replay it carries must agree with what the ENGINE says
        happened — the client's own final `PlayerView.history` is the
        reference — and its hands must be a whole 32-card deck per deal.
     2. WHAT IS NOT RECORDED. A table with nobody real on it is not reported,
        replay or no replay, unless `GAME_REPLAY_BOT_SAMPLE` deliberately asks
        for the baseline; and an implausibly large replay is dropped rather
        than costing the result its row.
   ────────────────────────────────────────────────────────────────────── */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fullDeck } from "@bela/engine"
import type { Card, DealScore, GameState } from "@bela/engine"
import type { PlayerView, Seat, ServerMessage, TargetScore } from "@bela/protocol"
import type { DemoIdentity } from "../src/demo/types.js"
import type { GameReplay, ReplayDeal } from "../src/replay.js"
import type { Room, SeatSlot } from "../src/room.js"
import type { GameServer } from "../src/server.js"
import { reportGameResult } from "../src/statsReporter.js"
import { startTestServer, TestClient } from "./helpers.js"

const RESULTS_PATH = "/internal/game-results"

interface CapturedPost {
    url: string
    body: Record<string, unknown>
}

/** Every POST the reporter made to the RESULTS endpoint, in order. */
function resultPosts(fetchMock: ReturnType<typeof vi.fn>): CapturedPost[] {
    return fetchMock.mock.calls
        .map(([url, init]) => ({ url: String(url), init: init as RequestInit }))
        .filter((c) => c.url.endsWith(RESULTS_PATH))
        .map((c) => ({ url: c.url, body: JSON.parse(c.init.body as string) as Record<string, unknown> }))
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
    // Everything server-to-server goes through `fetch`; the analytics
    // reporter and the profile lookups use the same mock and are ignored.
    fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ recorded: true }), { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)
    vi.stubEnv("GAME_RESULTS_TOKEN", "secret-token")
    vi.stubEnv("BACKEND_INTERNAL_URL", "http://backend:8085/api")
    vi.stubEnv("GAME_REPLAY_BOT_SAMPLE", "")
})

afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
})

/* ═══════════════════ 1. a real game, end to end ═══════════════════ */

describe("a finished human game carries its replay", () => {
    let server: GameServer | null = null
    const clients: TestClient[] = []

    afterEach(async () => {
        for (const c of clients) await c.close()
        clients.length = 0
        await server?.close()
        server = null
    })

    async function connect(devName: string): Promise<TestClient> {
        if (!server) throw new Error("server not started")
        const c = await TestClient.connect(server.url())
        clients.push(c)
        await c.hello(devName)
        return c
    }

    /** Host at seat 0, bots in 1-3, started. Same rig as `game.test.ts`. */
    async function startSoloRoom(host: TestClient, targetScore: TargetScore): Promise<void> {
        host.send({ t: "room.create", name: "Soba", targetScore, private: false })
        await host.nextOfType("room.joined")
        for (const seat of [1, 2, 3] as const) host.send({ t: "room.addBot", seat })
        await host.next((m) => m.t === "room.state" && m.room.seats.every((s) => s.occupant !== null))
        host.send({ t: "room.ready", ready: true })
        await host.nextOfType("room.state")
        host.send({ t: "room.start" })
        await host.next((m) => m.t === "room.state" && m.room.status === "PLAYING")
    }

    function isGameState(m: ServerMessage): m is Extract<ServerMessage, { t: "game.state" }> {
        return m.t === "game.state"
    }

    /** The dumbest legal policy there is — the replay does not care how well
     *  anybody played, only that what it recorded is what happened. */
    async function playUntilGameOver(client: TestClient, seat: Seat): Promise<PlayerView> {
        const deadline = Date.now() + 60_000
        while (Date.now() < deadline) {
            const msg = await client.next(isGameState, 15_000)
            if (!isGameState(msg)) continue
            const view = msg.view
            if (view.phase === "GAME_OVER") return view
            if (view.phase === "DEAL_DONE") {
                client.send({ t: "game.nextDeal" })
                continue
            }
            if (view.turn !== seat) continue
            if (view.phase === "BIDDING") {
                const legal = view.legalBids
                if (!legal) continue
                if (legal.canPass) client.send({ t: "game.pass" })
                else {
                    const suit = legal.suits[0]
                    if (suit) client.send({ t: "game.bid", trump: suit })
                }
                continue
            }
            if (view.phase === "PLAYING") {
                const card = view.legalMoves[0]
                if (card) client.send({ t: "game.play", card })
            }
        }
        throw new Error("game did not reach GAME_OVER in time")
    }

    it(
        "records every deal, its 32 dealt cards and its tricks, agreeing with the engine",
        async () => {
            server = await startTestServer({ rateLimits: { messagesPerSecond: 5000 } })
            const host = await connect("Igrac")
            await startSoloRoom(host, 501)

            const final = await playUntilGameOver(host, 0)
            expect(final.phase).toBe("GAME_OVER")
            // The report is fire-and-forget; give its microtask a turn.
            await new Promise((r) => setTimeout(r, 50))

            const posts = resultPosts(fetchMock)
            expect(posts).toHaveLength(1)
            const body = posts[0]!.body
            const replay = body["replay"] as GameReplay | undefined
            expect(replay, "the result must carry a replay").toBeDefined()
            if (!replay) return

            /* ---- the envelope ---- */
            expect(replay.version).toBe(1)
            expect(replay.botVersion).toMatch(/^\d{4}-\d{2}-\d{2}$/)
            expect(replay.settings.targetScore).toBe(501)
            expect(replay.settings.gameEndRule).toBe("prolaz")
            expect(replay.winner).toBe(final.winner)
            expect(replay.scoreA).toBe(final.score.A)
            expect(replay.scoreB).toBe(final.score.B)
            expect(replay.dealsCount).toBe(final.history.length)
            expect(replay.durationMs).toBeGreaterThanOrEqual(0)
            expect(new Date(replay.playedAt).toISOString()).toBe(replay.playedAt)
            expect(replay.truncated).toBeUndefined()

            /* ---- the seats: one person, three bots, no uid on a bot ---- */
            expect(replay.seats.map((s) => s.kind)).toEqual(["PLAYER", "BOT", "BOT", "BOT"])
            expect(replay.seats.map((s) => s.team)).toEqual(["A", "B", "A", "B"])
            expect(replay.seats[0]!.name).toBe("Igrac")
            expect(replay.seats[0]!.uid).toBeTruthy()
            expect(replay.seats.slice(1).every((s) => s.uid === null)).toBe(true)

            /* ---- the deals AGREE WITH THE ENGINE ---- */
            // Every deal the engine settled is on record, in order, with the
            // same arithmetic. This is the consistency claim: `final.history`
            // is the engine's own account of the game.
            const scored = replay.deals.filter((d): d is ReplayDeal & { dealScore: DealScore } => d.dealScore !== null)
            expect(scored.map((d) => d.dealScore)).toEqual(final.history)
            expect(replay.deals.length).toBeGreaterThanOrEqual(final.history.length)

            const deck = new Set<Card>(fullDeck())
            let runningA = 0
            let runningB = 0
            for (const deal of replay.deals) {
                if (deal.hands === null) {
                    // Only ever the last deal, and only if it ended during
                    // bidding — which cannot happen in a plain `prolaz` game.
                    throw new Error(`deal ${deal.dealNo} has no recorded hands`)
                }
                expect(deal.dealer).toBeGreaterThanOrEqual(0)
                expect(deal.dealer).toBeLessThanOrEqual(3)

                // All 32 cards, once each: the four hands together ARE the deck.
                const all = ([0, 1, 2, 3] as Seat[]).flatMap((s) => deal.hands![s])
                expect(all).toHaveLength(32)
                expect(new Set(all).size).toBe(32)
                expect(all.every((c) => deck.has(c))).toBe(true)
                for (const seat of [0, 1, 2, 3] as Seat[]) {
                    expect(deal.hands[seat]).toHaveLength(8)
                    // The talon: the LAST two of the eight, and they really
                    // are in that seat's hand.
                    expect(deal.talon![seat]).toHaveLength(2)
                    for (const card of deal.talon![seat]) {
                        expect(deal.hands[seat]).toContain(card)
                    }
                }
                // Every talon card belongs to exactly one seat.
                const talonAll = ([0, 1, 2, 3] as Seat[]).flatMap((s) => deal.talon![s])
                expect(new Set(talonAll).size).toBe(8)

                /* bidding: passes then exactly one call, by the seat the
                   deal's trump belongs to */
                const calls = deal.bidding.filter((b) => b.action === "CALL")
                expect(calls).toHaveLength(1)
                expect(calls[0]!.trump).toBe(deal.dealScore?.trump)
                expect(calls[0]!.seat).toBe(deal.dealScore?.caller)
                expect(typeof calls[0]!.forced).toBe("boolean")
                // A forced call is the DEALER's, and only ever after three passes.
                if (calls[0]!.forced === true) {
                    expect(calls[0]!.seat).toBe(deal.dealer)
                    expect(deal.bidding.filter((b) => b.action === "PASS")).toHaveLength(3)
                }

                /* tricks: eight of them, four plays each, every card from the
                   hand of the seat that played it, and the winner among them */
                expect(deal.tricks).toHaveLength(8)
                expect(deal.tricks.map((t) => t.no)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
                const played: Card[] = []
                for (const trick of deal.tricks) {
                    expect(trick.plays).toHaveLength(4)
                    expect(trick.plays[0]!.seat).toBe(trick.leader)
                    expect(trick.plays.map((p) => p.seat)).toContain(trick.winner)
                    // Turn order, no seat twice.
                    expect(new Set(trick.plays.map((p) => p.seat)).size).toBe(4)
                    for (const play of trick.plays) {
                        expect(deal.hands[play.seat]).toContain(play.card)
                        played.push(play.card)
                    }
                }
                // Eight tricks × four cards = the whole deal, each card once.
                expect(new Set(played).size).toBe(32)

                /* declarations name real cards from the declaring hand */
                for (const decl of deal.declarations) {
                    expect(decl.cards.length).toBeGreaterThanOrEqual(3)
                    for (const card of decl.cards) expect(deal.hands[decl.seat]).toContain(card)
                }

                /* the running score is the sum of what came before */
                runningA += deal.dealScore!.total.A
                runningB += deal.dealScore!.total.B
                expect(deal.runningScore).toEqual({ A: runningA, B: runningB })
            }
            expect({ A: runningA, B: runningB }).toEqual(final.score)

            /* ---- nothing private leaked in ---- */
            const serialised = JSON.stringify(replay)
            expect(serialised).not.toContain("demo:")
            expect(serialised).not.toContain("token")

            // Rough size budget for the owner's retention planning.
            expect(Buffer.byteLength(serialised, "utf8")).toBeLessThan(512 * 1024)
        },
        90_000,
    )
})

/* ═══════════════════ 2. what is NOT recorded ═══════════════════ */

type SeatKind = "human" | "bot" | "demo"

function demoIdentity(seat: number): DemoIdentity {
    return { uid: `demo:person-${seat}`, name: `Lažni ${seat}`, tempo: "NORMAL" } as unknown as DemoIdentity
}

function buildRoom(kinds: readonly [SeatKind, SeatKind, SeatKind, SeatKind]): Room {
    const seats: SeatSlot[] = kinds.map((kind, seat): SeatSlot => {
        if (kind === "bot") return { kind: "BOT", name: `Bot ${seat}` }
        if (kind === "demo") return { kind: "DEMO", identity: demoIdentity(seat) }
        return {
            kind: "PLAYER",
            uid: `uid-${seat}`,
            user: { uid: `uid-${seat}`, name: `Player ${seat}`, avatarUrl: null },
            ready: true,
            connected: true,
        }
    })
    return {
        targetScore: 1001,
        gameEndRule: "prolaz",
        noDeclarations: false,
        allowBela: true,
        trickReview: "off",
        slotAt: (seat: Seat) => seats[seat] ?? null,
    } as unknown as Room
}

function dealScore(dealNo: number): DealScore {
    return {
        dealNo, trump: "HERC", caller: 0, callerTeam: "A",
        cardPoints: { A: 100, B: 62 }, declarationPoints: { A: 0, B: 0 },
        stiglja: null, passed: false, total: { A: 100, B: 62 },
    }
}

function gameOverState(): GameState {
    return {
        config: { targetScore: 1001, seed: "test" },
        dealNo: 1, dealer: 3, phase: "GAME_OVER",
        hands: { 0: [], 1: [], 2: [], 3: [] }, stock: [],
        bidding: { turn: 0, passes: [], trump: null, caller: null },
        trick: { leader: 0, turn: 0, cards: [] },
        tricksWon: { A: [], B: [] },
        declarations: { 0: [], 1: [], 2: [], 3: [] },
        declarationsScoringTeam: null, belaDeclared: null, belaRefused: null,
        dealScore: dealScore(1), score: { A: 1041, B: 789 },
        history: [dealScore(1)], rng: { s: 1 }, winner: "A",
    } as unknown as GameState
}

function tinyReplay(deals: ReplayDeal[] = []): GameReplay {
    return {
        version: 1, botVersion: "2026-09-23",
        settings: { targetScore: 1001, gameEndRule: "prolaz", noDeclarations: false, allowBela: true, trickReview: "off" },
        seats: [], deals, winner: "A", scoreA: 1041, scoreB: 789, dealsCount: 1,
        playedAt: new Date().toISOString(), durationMs: 1,
    }
}

describe("a table with nobody real on it", () => {
    it("is not recorded, not even for its replay (the default)", async () => {
        reportGameResult(buildRoom(["bot", "demo", "bot", "demo"]), gameOverState(), undefined, tinyReplay())
        await new Promise((r) => setTimeout(r, 10))
        expect(resultPosts(fetchMock)).toHaveLength(0)
    })

    it("IS recorded when GAME_REPLAY_BOT_SAMPLE asks for the baseline", async () => {
        vi.stubEnv("GAME_REPLAY_BOT_SAMPLE", "1")
        reportGameResult(buildRoom(["bot", "bot", "bot", "bot"]), gameOverState(), undefined, tinyReplay())
        await new Promise((r) => setTimeout(r, 10))
        const posts = resultPosts(fetchMock)
        expect(posts).toHaveLength(1)
        // Baseline data, never a competitive record.
        expect(posts[0]!.body["eligible"]).toBe(false)
        expect(posts[0]!.body["replay"]).toBeDefined()
    })

    it("a fake person's uid never travels, even inside a sampled replay", async () => {
        vi.stubEnv("GAME_REPLAY_BOT_SAMPLE", "1")
        reportGameResult(buildRoom(["demo", "demo", "demo", "demo"]), gameOverState(), undefined, tinyReplay())
        await new Promise((r) => setTimeout(r, 10))
        expect(JSON.stringify(resultPosts(fetchMock)[0]!.body)).not.toContain("demo:")
    })
})

describe("an implausibly large replay", () => {
    it("is dropped, and the game is still recorded", async () => {
        // One fake deal carrying ~800 KB of cards.
        const bloated = tinyReplay([{
            dealNo: 1, dealer: 0,
            hands: { 0: Array.from({ length: 100_000 }, () => "AHERC" as Card), 1: [], 2: [], 3: [] },
            talon: null, bidding: [], declarations: [], declarationsScoringTeam: null,
            belaDeclared: null, belaRefused: null, belot: null, tricks: [],
            dealScore: null, runningScore: { A: 0, B: 0 },
        }])
        reportGameResult(buildRoom(["human", "human", "human", "human"]), gameOverState(), undefined, bloated)
        await new Promise((r) => setTimeout(r, 10))

        const posts = resultPosts(fetchMock)
        expect(posts).toHaveLength(1)
        expect(posts[0]!.body["replay"]).toBeUndefined()
        // The result itself survived the drop — that is the whole point.
        expect(posts[0]!.body["scoreA"]).toBe(1041)
        expect(posts[0]!.body["eligible"]).toBe(true)
    })
})
