/* ──────────────────────────────────────────────────────────────────────────
   `Lobby.stats()` and the `GET /stats` HTTP endpoint it backs (nav "Igraj"
   live-room pull, 2026-09-22).

   Two things are being proven:
     1. the counting rules — `playing`/`waiting` by room status and a free
        seat, `players` including demo seats, `humans` excluding them and
        bots — against both real rooms (via a live server + WS client) and
        demo rooms (via `Lobby.createDemoRoom` directly, no director needed);
     2. the HTTP endpoint is public (no auth), `no-store`, and mirrors
        `lobby.stats()` exactly.
   ────────────────────────────────────────────────────────────────────── */

import { afterEach, describe, expect, it } from "vitest"
import type { Seat } from "@bela/protocol"
import type { DemoIdentity, DemoRoomOptions } from "../src/demo/types.js"
import { resolveTimings } from "../src/config.js"
import { Lobby } from "../src/lobby.js"
import type { GameServer } from "../src/server.js"
import { startTestServer, TestClient } from "./helpers.js"

/* ───────────────────────── demo-room fixtures ───────────────────────── */

function identity(n: number): DemoIdentity {
    return {
        uid: `demo:person-${n}`,
        name: `Osoba ${n}`,
        avatarPreset: "kartar",
        gameStats: { global: { games: 10, wins: 5, losses: 5, winRate: 0.5 }, byTargetScore: {} },
        karma: 10,
        reliability: { recentAbandons: 0, recentGames: 12, totalAbandons: 1, windowDays: 30 },
        tempo: { fastMs: [5, 10], slowMs: [15, 20], slowChance: 0.2 },
    }
}

const DEMO_OPTIONS: DemoRoomOptions = {
    targetScore: 1001,
    gameEndRule: "prolaz",
    allowSpectators: true,
    private: false,
    noDeclarations: false,
}

function newLobby(): Lobby {
    return new Lobby(resolveTimings({
        declarationsMs: 0,
        turnTimeoutMs: 15_000,
        reconnectGraceMs: 10_000,
        botThinkMinMs: 0,
        botThinkMaxMs: 0,
        dealDoneAutoMs: 0,
        emptyRoomTtlMs: 60_000,
        finishedRoomTtlMs: 60_000,
        lobbyDebounceMs: 1,
    }))
}

/* ───────────────────────── Lobby.stats() ───────────────────────── */

describe("Lobby.stats()", () => {
    it("is all zeroes for an empty lobby", () => {
        const lobby = newLobby()
        expect(lobby.stats()).toEqual({ rooms: 0, playing: 0, waiting: 0, players: 0, humans: 0 })
    })

    it("counts a demo room with a free seat as waiting, and its fake people as players but not humans", () => {
        const lobby = newLobby()
        const handle = lobby.createDemoRoom(DEMO_OPTIONS, identity(0), {})
        expect(handle).not.toBeNull()
        handle!.sit(identity(1), 1 as Seat)

        expect(lobby.stats()).toEqual({ rooms: 1, playing: 0, waiting: 1, players: 2, humans: 0 })
    })

    it("stops counting a demo room as waiting once every seat is taken", () => {
        const lobby = newLobby()
        const handle = lobby.createDemoRoom(DEMO_OPTIONS, identity(0), {})
        expect(handle).not.toBeNull()
        for (const seat of [1, 2, 3] as Seat[]) expect(handle!.sit(identity(seat), seat)).toBe(true)

        // Still LOBBY (nobody called room.start) but full — neither waiting nor playing.
        expect(lobby.stats()).toEqual({ rooms: 1, playing: 0, waiting: 0, players: 4, humans: 0 })
    })

    it("keeps a private demo room out of `waiting` the same as a public one would be once full, but still in `rooms`/`players`", () => {
        const lobby = newLobby()
        const handle = lobby.createDemoRoom({ ...DEMO_OPTIONS, private: true }, identity(0), {})
        expect(handle).not.toBeNull()

        // Demo rooms are counted everywhere on purpose — DEMO-LOBBY.md: they
        // must look exactly like real activity, including to this pull.
        expect(lobby.stats()).toEqual({ rooms: 1, playing: 0, waiting: 1, players: 1, humans: 0 })
    })
})

/* ───────────────────────── real rooms + the HTTP endpoint ───────────────────────── */

let server: GameServer | null = null
const clients: TestClient[] = []

async function connect(devName: string): Promise<TestClient> {
    if (!server) throw new Error("server not started")
    const c = await TestClient.connect(server.url())
    clients.push(c)
    await c.hello(devName)
    return c
}

afterEach(async () => {
    for (const c of clients) await c.close()
    clients.length = 0
    await server?.close()
    server = null
})

describe("GET /stats", () => {
    it("mirrors lobby.stats() for a real, playing room and counts bots out of humans/players", async () => {
        server = await startTestServer()
        const host = await connect("Domacin")
        host.send({ t: "room.create", targetScore: 501, private: false })
        await host.nextOfType("room.joined")
        for (const seat of [1, 2, 3] as const) host.send({ t: "room.addBot", seat })
        await host.next((m) => m.t === "room.state" && m.room.seats.every((s) => s.occupant !== null))
        host.send({ t: "room.ready", ready: true })
        await host.next((m) => m.t === "room.state" && m.room.seats[0].occupant?.kind === "PLAYER" && m.room.seats[0].occupant.ready)
        host.send({ t: "room.start" })
        await host.nextOfType("game.state")

        expect(server.lobby.stats()).toEqual({ rooms: 1, playing: 1, waiting: 0, players: 1, humans: 1 })

        const res = await fetch(`http://127.0.0.1:${server.port()}/stats`)
        expect(res.status).toBe(200)
        expect(res.headers.get("cache-control")).toBe("no-store")
        expect(await res.json()).toEqual({ rooms: 1, playing: 1, waiting: 0, players: 1, humans: 1 })
    })

    it("reports a freshly created room (one human, three empty seats) as waiting, not playing", async () => {
        server = await startTestServer()
        const host = await connect("Domacin")
        host.send({ t: "room.create", targetScore: 501, private: false })
        await host.nextOfType("room.joined")

        const res = await fetch(`http://127.0.0.1:${server.port()}/stats`)
        expect(await res.json()).toEqual({ rooms: 1, playing: 0, waiting: 1, players: 1, humans: 1 })
    })

    it("needs no auth — an anonymous fetch with no hello sent works", async () => {
        server = await startTestServer()
        const res = await fetch(`http://127.0.0.1:${server.port()}/stats`)
        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ rooms: 0, playing: 0, waiting: 0, players: 0, humans: 0 })
    })
})
