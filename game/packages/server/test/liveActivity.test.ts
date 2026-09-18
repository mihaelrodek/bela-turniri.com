/* Live Activity fan-out (README §3 "Live Activity"). The per-recipient shape
   and the throttle are exercised on `LiveActivityHub` directly against
   hand-built rooms, like `statsReporter.test.ts` does — a real table would
   only add engine noise. Where the WIRING is the point (the socket message,
   a dropped connection, `room.leave`, game over) a real server runs with a
   recording notifier injected, like `gameName.test.ts` injects profiles. */

import { afterEach, describe, expect, it, vi } from "vitest"
import type { GameState, Seat } from "@bela/engine"
import { loadConfig } from "../src/config.js"
import { createLiveActivityNotifier, LiveActivityHub } from "../src/liveActivity.js"
import type { LiveActivityBody, LiveActivityRoom, LiveActivitySnapshot } from "../src/liveActivity.js"
import type { SeatSlot } from "../src/room.js"
import type { GameServer } from "../src/server.js"
import { sleep, startTestServer, TestClient, until } from "./helpers.js"

/* ───────────────────────── unit rig ───────────────────────── */

function human(uid: string, connected: boolean): SeatSlot {
    return { kind: "PLAYER", uid, user: { uid, name: uid, avatarUrl: null }, ready: true, connected }
}

const BOT: SeatSlot = { kind: "BOT", name: "Bot" }

function fakeRoom(slots: [SeatSlot, SeatSlot, SeatSlot, SeatSlot]): LiveActivityRoom {
    return { id: "room-1", targetScore: 1001, slotAt: (seat: Seat) => slots[seat] }
}

function snap(over: { phase?: GameState["phase"]; scoreA?: number; scoreB?: number; turn?: Seat; winner?: "A" | "B" | null } = {}, turnDeadline: number | null = 123): LiveActivitySnapshot {
    const turn = over.turn ?? 0
    const state = {
        phase: over.phase ?? "PLAYING",
        score: { A: over.scoreA ?? 0, B: over.scoreB ?? 0 },
        bidding: { turn, passes: [], trump: "PIK", caller: 0 },
        trick: { leader: turn, turn, cards: [] },
        winner: over.winner ?? null,
    } as unknown as GameState
    return { state, turnDeadline }
}

function recorder(): { bodies: LiveActivityBody[]; send: (b: LiveActivityBody) => void } {
    const bodies: LiveActivityBody[] = []
    return { bodies, send: (b) => { bodies.push(b) } }
}

afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
})

describe("LiveActivityHub", () => {
    it("builds us/them per recipient, for both teams", () => {
        const rec = recorder()
        const hub = new LiveActivityHub(rec)
        const room = fakeRoom([human("a", false), human("b", false), BOT, BOT])
        hub.onGameState(room, snap({ scoreA: 312, scoreB: 140, turn: 1 }, 5000))

        const a = rec.bodies.find((b) => b.uid === "a")!
        const b = rec.bodies.find((x) => x.uid === "b")!
        expect(a.event).toBe("update")
        expect(a.state).toEqual({
            roomId: "room-1", phase: "playing", scoreUs: 312, scoreThem: 140, target: 1001,
            yourTurn: false, turnSeat: 1, turnDeadline: 5000, trump: "PIK", winner: null,
        })
        expect(b.state).toMatchObject({ scoreUs: 140, scoreThem: 312, yourTurn: true, turnSeat: 1 })

        // …and the end keeps the same sides: team A won, so seat 0 is "us".
        hub.endAll(room, snap({ phase: "GAME_OVER", scoreA: 1010, scoreB: 900, winner: "A" }))
        const ends = rec.bodies.filter((x) => x.event === "end")
        expect(ends.find((x) => x.uid === "a")!.state).toMatchObject({ phase: "gameOver", winner: "us", scoreUs: 1010, turnSeat: null, turnDeadline: null })
        expect(ends.find((x) => x.uid === "b")!.state).toMatchObject({ phase: "gameOver", winner: "them", scoreUs: 900 })
    })

    it("skips a connected player without a token, reaches one with a token", () => {
        const rec = recorder()
        const hub = new LiveActivityHub(rec)
        const room = fakeRoom([human("a", true), human("b", true), BOT, BOT])
        hub.tokens.set("b", { activityToken: "tok-b" })
        hub.onGameState(room, snap({ scoreA: 10 }))
        expect(rec.bodies.map((x) => x.uid)).toEqual(["b"])
        expect(rec.bodies[0]!.iosActivityToken).toBe("tok-b")
    })

    it("sends nothing when nothing the activity shows changed", () => {
        const rec = recorder()
        const hub = new LiveActivityHub(rec, undefined, { throttleMs: 0 })
        const room = fakeRoom([human("a", false), BOT, BOT, BOT])
        hub.onGameState(room, snap({ scoreA: 10 }))
        hub.onGameState(room, snap({ scoreA: 10 }))
        expect(rec.bodies).toHaveLength(1)
    })

    it("does not push merely because a socket dropped", () => {
        // The app drew this state itself while connected; the drop alone
        // changes nothing on the lock screen.
        const rec = recorder()
        const hub = new LiveActivityHub(rec, undefined, { throttleMs: 0 })
        const slots: [SeatSlot, SeatSlot, SeatSlot, SeatSlot] = [human("a", true), BOT, BOT, BOT]
        const room = fakeRoom(slots)
        hub.onGameState(room, snap({ scoreA: 10 }))
        slots[0] = human("a", false)
        hub.onGameState(room, snap({ scoreA: 10 }))
        expect(rec.bodies).toHaveLength(0)
        hub.onGameState(room, snap({ scoreA: 20 }))
        expect(rec.bodies).toHaveLength(1)
    })

    it("coalesces a burst into the first state plus the trailing one", () => {
        vi.useFakeTimers()
        const rec = recorder()
        const hub = new LiveActivityHub(rec)
        const room = fakeRoom([human("a", false), BOT, BOT, BOT])

        hub.onGameState(room, snap({ scoreA: 10 }))
        vi.advanceTimersByTime(100)
        hub.onGameState(room, snap({ scoreA: 20 }))
        vi.advanceTimersByTime(100)
        hub.onGameState(room, snap({ scoreA: 30 }))
        expect(rec.bodies.map((b) => b.state.scoreUs)).toEqual([10])

        vi.advanceTimersByTime(1000)
        expect(rec.bodies.map((b) => b.state.scoreUs)).toEqual([10, 30])
    })

    it("never lets a trailing update land after the end", () => {
        vi.useFakeTimers()
        const rec = recorder()
        const hub = new LiveActivityHub(rec)
        const room = fakeRoom([human("a", false), BOT, BOT, BOT])
        hub.tokens.set("a", { activityToken: "tok" })
        hub.onGameState(room, snap({ scoreA: 10 }))
        hub.onGameState(room, snap({ scoreA: 20 }))
        hub.endFor(room, snap({ scoreA: 20 }), "a")
        vi.advanceTimersByTime(2000)
        expect(rec.bodies.map((b) => b.event)).toEqual(["update", "end"])
        // The end carried the token, then it was forgotten.
        expect(rec.bodies[1]!.iosActivityToken).toBe("tok")
        expect(hub.tokens.get("a")).toBeNull()
    })

    it("a throwing notifier never reaches the game", () => {
        const hub = new LiveActivityHub({ send: () => { throw new Error("boom") } })
        const room = fakeRoom([human("a", false), BOT, BOT, BOT])
        expect(() => hub.onGameState(room, snap({ scoreA: 1 }))).not.toThrow()
        expect(() => hub.endAll(room, snap())).not.toThrow()
    })
})

describe("createLiveActivityNotifier", () => {
    it("posts to the internal endpoint and swallows a network failure", async () => {
        const fetchMock = vi.fn().mockRejectedValue(new Error("network down"))
        vi.stubGlobal("fetch", fetchMock)
        const notifier = createLiveActivityNotifier(loadConfig({}, { gameResultsToken: "secret", backendInternalUrl: "http://backend:8085/api" }))
        const body: LiveActivityBody = { uid: "u", event: "update", state: { roomId: "r", phase: "playing", scoreUs: 0, scoreThem: 0, target: 501, yourTurn: false, turnSeat: null, turnDeadline: null, trump: null, winner: null } }
        expect(() => notifier.send(body)).not.toThrow()
        await sleep(0)
        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
        expect(url).toBe("http://backend:8085/api/internal/live-activity")
        expect((init.headers as Record<string, string>)["X-Internal-Token"]).toBe("secret")
        expect(JSON.parse(init.body as string)).toEqual(body)
    })

    it("is a silent no-op without GAME_RESULTS_TOKEN", () => {
        const fetchMock = vi.fn()
        vi.stubGlobal("fetch", fetchMock)
        const notifier = createLiveActivityNotifier(loadConfig({}, { gameResultsToken: null }))
        notifier.send({ uid: "u", event: "end", state: {} as LiveActivityBody["state"] })
        expect(fetchMock).not.toHaveBeenCalled()
    })
})

/* ───────────────────────── wired into a real server ───────────────────────── */

let server: GameServer | null = null
const clients: TestClient[] = []

afterEach(async () => {
    for (const c of clients) await c.close()
    clients.length = 0
    await server?.close()
    server = null
})

async function connect(devName: string): Promise<{ client: TestClient; uid: string }> {
    const client = await TestClient.connect(server!.url())
    clients.push(client)
    const ok = await client.hello(devName)
    return { client, uid: ok.user.uid }
}

/** One human in seat 0, three bots, started. */
async function startBotRoom(host: TestClient): Promise<string> {
    host.send({ t: "room.create", name: "Soba", targetScore: 501, private: false })
    const joined = await host.nextOfType("room.joined")
    for (const seat of [1, 2, 3] as const) host.send({ t: "room.addBot", seat })
    await host.next((m) => m.t === "room.state" && m.room.seats.every((s) => s.occupant !== null))
    host.send({ t: "room.ready", ready: true })
    await host.nextOfType("room.state")
    host.send({ t: "room.start" })
    await host.next((m) => m.t === "room.state" && m.room.status === "PLAYING")
    return joined.room.id
}

describe("live activity wiring", () => {
    it("stores tokens from the socket and refuses a malformed one", async () => {
        const rec = recorder()
        server = await startTestServer({ liveActivity: rec })
        const { client, uid } = await connect("Ana")
        client.send({ t: "liveActivity.tokens", activityToken: "act-1" })
        client.send({ t: "liveActivity.tokens", pushToStartToken: "pts-1" })
        await until(() => server!.liveActivity.tokens.get(uid)?.pushToStartToken === "pts-1")
        expect(server.liveActivity.tokens.get(uid)).toMatchObject({ activityToken: "act-1", pushToStartToken: "pts-1" })

        client.send({ t: "liveActivity.tokens", activityToken: "x".repeat(513) })
        expect((await client.nextOfType("error")).code).toBe("BAD_REQUEST")
    })

    it("updates a disconnected seat, but not a connected one without a token", async () => {
        const rec = recorder()
        server = await startTestServer({
            liveActivity: rec,
            timings: { turnTimeoutMs: 150, reconnectGraceMs: 30_000 },
        })
        const { client, uid } = await connect("Ana")
        await startBotRoom(client)

        // Connected, no token: the table moves on (timeouts + bots), nothing is pushed.
        await sleep(800)
        expect(rec.bodies.filter((b) => b.event === "update")).toHaveLength(0)

        client.terminate()
        await until(() => rec.bodies.some((b) => b.uid === uid && b.event === "update"), 4000)
        const update = rec.bodies.find((b) => b.event === "update")!
        expect(update.state.target).toBe(501)
    })

    it("a registered iOS token makes a connected player reachable", async () => {
        const rec = recorder()
        server = await startTestServer({ liveActivity: rec, timings: { turnTimeoutMs: 150 } })
        const { client, uid } = await connect("Ana")
        client.send({ t: "liveActivity.tokens", activityToken: "act-1" })
        await startBotRoom(client)
        await until(() => rec.bodies.some((b) => b.uid === uid && b.event === "update"), 4000)
        expect(rec.bodies[0]!.iosActivityToken).toBe("act-1")
    })

    it("ends the activity on room.leave", async () => {
        const rec = recorder()
        server = await startTestServer({ liveActivity: rec })
        const { client, uid } = await connect("Ana")
        await startBotRoom(client)
        client.send({ t: "room.leave" })
        await client.nextOfType("room.left")
        const end = rec.bodies.find((b) => b.uid === uid && b.event === "end")
        expect(end?.state).toMatchObject({ phase: "gameOver", winner: null, turnSeat: null })
    })

    it("ends every seated human's activity on game over, with the winner", async () => {
        const rec = recorder()
        server = await startTestServer({
            liveActivity: rec,
            timings: { botThinkMinMs: 100_000, botThinkMaxMs: 100_000 },
        })
        const { client, uid } = await connect("Ana")
        const roomId = await startBotRoom(client)

        // Reaching GAME_OVER for real would replay a whole game through the
        // engine; forcing the terminal state and re-running the scheduler
        // exercises exactly the branch that announces it.
        const game = server.lobby.get(roomId)!.game!
        game.state = { ...game.state, phase: "GAME_OVER", winner: "A", score: { A: 520, B: 300 } }
        ;(game as unknown as { schedule(): void }).schedule()

        const ends = rec.bodies.filter((b) => b.event === "end")
        expect(ends).toHaveLength(1)
        expect(ends[0]!.uid).toBe(uid)
        expect(ends[0]!.state).toMatchObject({ phase: "gameOver", winner: "us", scoreUs: 520, scoreThem: 300 })

        // Closing the server disposes the room; the finished game owes nobody a second end.
        await server.close()
        server = null
        expect(rec.bodies.filter((b) => b.event === "end")).toHaveLength(1)
    })
})
