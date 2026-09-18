import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createRng, type DealScore, type GameState, type Seat } from "@bela/engine"
import type { Room, SeatSlot } from "../src/room.js"
import { reportGameCompleted, reportGameStarted } from "../src/analyticsReporter.js"

function deal(dealNo: number, caller: Seat, passed: boolean): DealScore {
    return {
        dealNo,
        trump: dealNo === 1 ? "HERC" : "PIK",
        caller,
        callerTeam: caller === 0 || caller === 2 ? "A" : "B",
        cardPoints: { A: 100, B: 62 },
        declarationPoints: { A: 20, B: 0 },
        stiglja: null,
        belot: null,
        passed,
        total: passed ? { A: 120, B: 62 } : { A: 0, B: 182 },
    }
}

function room(): Room {
    const seats: SeatSlot[] = [0, 1, 2, 3].map((seat) => seat === 3
        ? { kind: "BOT", name: "Bot Ante" }
        : { kind: "PLAYER", uid: `u${seat}`, user: { uid: `u${seat}`, name: `P${seat}`, avatarUrl: null }, ready: true, connected: true })
    return {
        id: "room-1",
        targetScore: 1001,
        slotAt: (seat: Seat) => seats[seat] ?? null,
        analyticsOptions: () => ({ targetScore: 1001, private: false, gameEndRule: "PROLAZ" }),
    } as unknown as Room
}

function finishedState(): GameState {
    const history = [deal(1, 1, false), deal(2, 0, true)]
    return {
        config: { targetScore: 1001, seed: "analytics" },
        dealNo: 2,
        dealer: 1,
        phase: "GAME_OVER",
        hands: { 0: [], 1: [], 2: [], 3: [] }, stock: [],
        bidding: { turn: 0, passes: [], trump: null, caller: null },
        trick: { leader: 0, turn: 0, cards: [] }, tricksWon: { A: [], B: [] },
        declarations: { 0: [], 1: [], 2: [], 3: [] }, declarationsScoringTeam: null,
        belaDeclared: null, belaRefused: null, dealScore: history[1]!,
        score: { A: 1001, B: 800 }, history, rng: createRng("analytics"), winner: "A",
    }
}

describe("global game analytics reporter", () => {
    const runId = "11111111-1111-4111-8111-111111111111"
    let fetchMock: ReturnType<typeof vi.fn>

    beforeEach(() => {
        fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }))
        vi.stubGlobal("fetch", fetchMock)
        vi.stubEnv("GAME_RESULTS_TOKEN", "secret")
        vi.stubEnv("BACKEND_INTERNAL_URL", "http://backend:8085/api")
    })

    afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

    it("uses one run id and preserves deal facts for private admin aggregation", async () => {
        const table = room()
        reportGameStarted(runId, table, Date.now() - 60_000)
        reportGameCompleted(runId, table, finishedState(), Date.now() - 60_000, 3)
        await new Promise((resolve) => setTimeout(resolve, 0))

        expect(fetchMock).toHaveBeenCalledTimes(2)
        const started = JSON.parse(fetchMock.mock.calls[0]![1].body)
        const completed = JSON.parse(fetchMock.mock.calls[1]![1].body)
        expect(started).toMatchObject({ eventId: `${runId}:started`, runId, type: "GAME_STARTED" })
        expect(started.data.seats[3]).toMatchObject({ kind: "BOT", guest: false })
        expect(completed).toMatchObject({ eventId: `${runId}:completed`, runId, type: "GAME_COMPLETED" })
        expect(completed.data.autoPlayedActions).toBe(3)
        expect(completed.data.deals).toEqual([
            expect.objectContaining({ trump: "HERC", caller: 1, callPosition: 1, passed: false }),
            expect.objectContaining({ trump: "PIK", caller: 0, callPosition: 3, passed: true }),
        ])
    })
})
