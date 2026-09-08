/* README §8: the Node server reports GAME_OVER to the backend only when
   §8.1's counting rule holds. These tests exercise `reportGameResult`
   directly against hand-built `Room`-shaped objects and a hand-built
   terminal `GameState`, per the task's own suggestion — wiring a full
   room + gameRoom just to reach GAME_OVER would test the engine, not this
   module. */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { DealScore, GameState, Seat } from "@bela/engine"
import { createRng } from "@bela/engine"
import type { TargetScore } from "@bela/protocol"
import type { Room, SeatSlot } from "../src/room.js"
import { reportGameResult } from "../src/statsReporter.js"

type SeatKind = "human" | "bot"

function buildRoom(kinds: readonly [SeatKind, SeatKind, SeatKind, SeatKind], targetScore: TargetScore = 1001): Room {
    const seats: SeatSlot[] = kinds.map((kind, seat): SeatSlot => {
        if (kind === "bot") return { kind: "BOT", name: `Bot ${seat}` }
        const uid = `uid-${seat}`
        return {
            kind: "PLAYER",
            uid,
            user: { uid, name: `Player ${seat}`, avatarUrl: null },
            ready: true,
            connected: true,
        }
    })
    return {
        targetScore,
        slotAt: (seat: Seat) => seats[seat] ?? null,
    } as unknown as Room
}

function dealScore(dealNo: number): DealScore {
    return {
        dealNo,
        trump: "HERC",
        caller: 0,
        callerTeam: "A",
        cardPoints: { A: 100, B: 62 },
        declarationPoints: { A: 0, B: 0 },
        stiglja: null,
        passed: false,
        total: { A: 100, B: 62 },
    }
}

function buildGameOverState(over: Partial<GameState> = {}): GameState {
    return {
        config: { targetScore: 1001, seed: "test" },
        dealNo: 3,
        dealer: 3,
        phase: "GAME_OVER",
        hands: { 0: [], 1: [], 2: [], 3: [] },
        stock: [],
        bidding: { turn: 0, passes: [], trump: null, caller: null },
        trick: { leader: 0, turn: 0, cards: [] },
        tricksWon: { A: [], B: [] },
        declarations: { 0: [], 1: [], 2: [], 3: [] },
        declarationsScoringTeam: null,
        belaDeclared: null,
        belaRefused: null,
        dealScore: dealScore(3),
        score: { A: 1041, B: 789 },
        history: [dealScore(1), dealScore(2), dealScore(3)],
        rng: createRng("test"),
        winner: "A",
        ...over,
    }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

describe("reportGameResult", () => {
    let fetchMock: ReturnType<typeof vi.fn>

    beforeEach(() => {
        fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ recorded: true }), { status: 200 }))
        vi.stubGlobal("fetch", fetchMock)
        vi.stubEnv("GAME_RESULTS_TOKEN", "secret-token")
        vi.stubEnv("BACKEND_INTERNAL_URL", "http://backend:8085/api")
    })

    afterEach(() => {
        vi.unstubAllEnvs()
        vi.unstubAllGlobals()
    })

    it("reports guests as humans without persisting their browser identity", async () => {
        const room = buildRoom(["human", "human", "bot", "bot"])
        const guest = room.slotAt(1)
        if (guest?.kind !== "PLAYER") throw new Error("expected player")
        guest.user.guest = true
        reportGameResult(room, buildGameOverState())
        await new Promise((r) => setTimeout(r, 0))
        const body = JSON.parse(fetchMock.mock.calls[0]![1].body)
        expect(body.players[1]).toEqual({ seat: 1, team: "B", uid: null, isBot: false, isGuest: true })
        expect(body.players[0].uid).toBe("uid-0")
    })

    it("does not report a 1-human-3-bots game (one whole team is all bots)", async () => {
        const room = buildRoom(["human", "bot", "bot", "bot"])
        const state = buildGameOverState()
        reportGameResult(room, state)
        await new Promise((r) => setTimeout(r, 0))
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it("reports a 2-humans-vs-2-humans game with the exact body from README §8.4", async () => {
        const room = buildRoom(["human", "human", "human", "human"], 1001)
        const state = buildGameOverState({
            score: { A: 1041, B: 789 },
            winner: "A",
            history: [dealScore(1), dealScore(2), dealScore(3)],
        })
        reportGameResult(room, state)
        await new Promise((r) => setTimeout(r, 0))

        expect(fetchMock).toHaveBeenCalledTimes(1)
        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
        expect(url).toBe("http://backend:8085/api/internal/game-results")
        expect(init.method).toBe("POST")
        const headers = init.headers as Record<string, string>
        expect(headers["Content-Type"]).toBe("application/json")
        expect(headers["X-Internal-Token"]).toBe("secret-token")

        const body = JSON.parse(init.body as string) as Record<string, unknown>
        expect(body["resultId"]).toMatch(UUID_RE)
        expect(typeof body["playedAt"]).toBe("string")
        expect(new Date(body["playedAt"] as string).toISOString()).toBe(body["playedAt"])
        expect(body["targetScore"]).toBe(1001)
        expect(body["winnerTeam"]).toBe("A")
        expect(body["scoreA"]).toBe(1041)
        expect(body["scoreB"]).toBe(789)
        expect(body["dealsCount"]).toBe(3)
        expect(body["players"]).toEqual([
            { seat: 0, team: "A", uid: "uid-0", isBot: false },
            { seat: 1, team: "B", uid: "uid-1", isBot: false },
            { seat: 2, team: "A", uid: "uid-2", isBot: false },
            { seat: 3, team: "B", uid: "uid-3", isBot: false },
        ])
    })

    it("reports a human+bot vs 2-humans game (mixed team is still eligible)", async () => {
        const room = buildRoom(["human", "human", "bot", "human"])
        const state = buildGameOverState({ winner: "B" })
        reportGameResult(room, state)
        await new Promise((r) => setTimeout(r, 0))

        expect(fetchMock).toHaveBeenCalledTimes(1)
        const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
        const body = JSON.parse(init.body as string) as { players: unknown[] }
        expect(body.players).toEqual([
            { seat: 0, team: "A", uid: "uid-0", isBot: false },
            { seat: 1, team: "B", uid: "uid-1", isBot: false },
            { seat: 2, team: "A", uid: null, isBot: true },
            { seat: 3, team: "B", uid: "uid-3", isBot: false },
        ])
    })

    it("never throws when fetch rejects, and doesn't affect the caller", async () => {
        fetchMock.mockRejectedValue(new Error("network down"))
        const room = buildRoom(["human", "human", "human", "human"])
        const state = buildGameOverState()

        expect(() => reportGameResult(room, state)).not.toThrow()
        await new Promise((r) => setTimeout(r, 0))
        // No unhandled rejection escaped, and the state object is untouched.
        expect(state.phase).toBe("GAME_OVER")
        expect(state.winner).toBe("A")
    })

    it("skips the network call entirely when GAME_RESULTS_TOKEN is unset", async () => {
        vi.stubEnv("GAME_RESULTS_TOKEN", "")
        const room = buildRoom(["human", "human", "human", "human"])
        const state = buildGameOverState()
        reportGameResult(room, state)
        await new Promise((r) => setTimeout(r, 0))
        expect(fetchMock).not.toHaveBeenCalled()
    })
})
