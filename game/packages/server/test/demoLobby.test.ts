/* ──────────────────────────────────────────────────────────────────────────
   The PRE-LAUNCH demo lobby, from the mechanics side (game/DEMO-LOBBY.md).

   Two things are being proven here, and they pull in opposite directions:

     1. a fake person is INDISTINGUISHABLE on the wire — a seated, connected,
        ready `PLAYER`, never a `BOT`, in the lobby row, in the room state and
        while a game is running;
     2. a fake person is NOT a player anywhere it would cost something — no
        stats, no karma, no abandonment, no analytics — while still counting as
        somebody where a room would otherwise be dissolved for being empty.

   The director is deliberately absent: these tests ARE the director, so every
   callback is a recorded array and every decision is made by hand.
   ────────────────────────────────────────────────────────────────────── */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Seat } from "@bela/protocol"
import { loadConfig, resolveTimings } from "../src/config.js"
import { Lobby } from "../src/lobby.js"
import type { ServerMessage } from "@bela/protocol"
import type { Connection } from "../src/ws.js"
import type { DemoIdentity, DemoRoomEvents, DemoRoomHandle, DemoRoomOptions, RealRoomHandle } from "../src/demo/types.js"
import { reportGameAbandonment, reportGameResult } from "../src/statsReporter.js"
import { reportGameCompleted, reportGameStarted, reportRoomCreated } from "../src/analyticsReporter.js"
import type { GameState } from "@bela/engine"
import { createRng } from "@bela/engine"
import type { Room } from "../src/room.js"
import { sleep, startTestServer, TestClient, until } from "./helpers.js"
import type { GameServer } from "../src/server.js"

/* ───────────────────────── fixtures ───────────────────────── */

function identity(n: number, tempo?: DemoIdentity["tempo"]): DemoIdentity {
    return {
        uid: `demo:person-${n}`,
        name: `Osoba ${n}`,
        avatarPreset: "kartar",
        gameStats: {
            global: { games: 40 + n, wins: 20, losses: 20 + n, winRate: 0.5 },
            byTargetScore: {},
        },
        karma: 10,
        reliability: { recentAbandons: 0, recentGames: 12, totalAbandons: 1, windowDays: 30 },
        tempo: tempo ?? { fastMs: [5, 10], slowMs: [15, 20], slowChance: 0.2 },
    }
}

const OPTIONS: DemoRoomOptions = {
    targetScore: 1001,
    gameEndRule: "prolaz",
    allowSpectators: true,
    private: false,
    noDeclarations: false,
}

function newLobby(overrides: Record<string, number> = {}): Lobby {
    return new Lobby(resolveTimings({
        declarationsMs: 0,
        turnTimeoutMs: 15_000,
        reconnectGraceMs: 10_000,
        botThinkMinMs: 0,
        botThinkMaxMs: 0,
        dealDoneAutoMs: 0,
        emptyRoomTtlMs: 10,
        finishedRoomTtlMs: 10,
        lobbyDebounceMs: 1,
        ...overrides,
    }))
}

/** Fill a demo room with four fake people; returns the handle. */
function fourSeated(lobby: Lobby, events: DemoRoomEvents = {}, options: DemoRoomOptions = OPTIONS): DemoRoomHandle {
    const handle = lobby.createDemoRoom(options, identity(0), events)
    expect(handle).not.toBeNull()
    for (const seat of [1, 2, 3] as Seat[]) {
        expect(handle!.sit(identity(seat), seat)).toBe(true)
    }
    return handle!
}

function roomOf(lobby: Lobby, handle: DemoRoomHandle): Room {
    const room = lobby.get(handle.id)
    expect(room).toBeDefined()
    return room!
}

/* ───────────────────────── the wire ───────────────────────── */

describe("a fake person on the wire", () => {
    it("is a seated, connected, ready PLAYER in the lobby row and the room state", () => {
        const lobby = newLobby()
        const handle = fourSeated(lobby)
        const room = roomOf(lobby, handle)

        const summary = room.toSummary()
        expect(summary.seatsTaken).toBe(4)
        // The row says four people and shows four faces: the two must agree, or
        // "4 igrača" over three names is the tell.
        expect(summary.humans).toBe(4)
        for (const occupant of summary.occupants) {
            expect(occupant).toMatchObject({ kind: "PLAYER", connected: true })
        }

        const state = room.toState()
        for (const seat of [0, 1, 2, 3] as Seat[]) {
            const occupant = state.seats[seat].occupant
            expect(occupant).toMatchObject({ kind: "PLAYER", ready: true, connected: true, holdUntil: null })
            const user = (occupant as { user: { uid: string; name: string; guest?: boolean } }).user
            expect(user.uid).toBe(`demo:person-${seat}`)
            expect(user.name).toBe(`Osoba ${seat}`)
            // A signed-in Google user has no `guest` field at all; a "gost"
            // badge on the whole lobby would give it away.
            expect(user.guest).toBeUndefined()
        }
        // Empty statistics or karma is its own tell (DEMO-LOBBY.md §3). The
        // same applies to the breakdown behind the karma: an empty popover on
        // a fake person's seat would be the tell now that real players carry
        // `reliability` too.
        const first = state.seats[0].occupant as { user: { gameStats: unknown; karma: number; reliability: unknown } }
        expect(first.user.gameStats).toBeTruthy()
        expect(first.user.karma).toBe(10)
        expect(first.user.reliability).toEqual({ recentAbandons: 0, recentGames: 12, totalAbandons: 1, windowDays: 30 })

        expect(JSON.stringify(state)).not.toContain("BOT")
        expect(JSON.stringify(summary)).not.toContain("BOT")
    })

    it("shows the record the director booked after the last game, not the one from sit-down time", () => {
        const lobby = newLobby()
        const person = identity(0)
        const handle = lobby.createDemoRoom(OPTIONS, person, {})!
        person.gameStats.global.wins = 99
        person.karma = 7
        // `reliability` is not booked by the director like `gameStats`/`karma`
        // are, but `demoUserInfo` reads it fresh off the identity on every
        // serialisation same as the others — proven here the same way.
        person.reliability = { recentAbandons: 3, recentGames: 20, totalAbandons: 5, windowDays: 30 }
        const occupant = roomOf(lobby, handle).toState().seats[0].occupant as {
            user: { gameStats: { global: { wins: number } }; karma: number; reliability: { recentAbandons: number } }
        }
        expect(occupant.user.gameStats.global.wins).toBe(99)
        expect(occupant.user.karma).toBe(7)
        expect(occupant.user.reliability.recentAbandons).toBe(3)
    })

    it("stays a PLAYER while the game is running", () => {
        const lobby = newLobby()
        const handle = fourSeated(lobby)
        expect(handle.start()).toBe(true)
        expect(handle.status()).toBe("PLAYING")
        const state = roomOf(lobby, handle).toState()
        expect(state.status).toBe("PLAYING")
        expect(JSON.stringify(state.seats)).not.toContain("BOT")
    })
})

/* ───────────────────────── room life ───────────────────────── */

describe("a demo room's life", () => {
    it("survives with no connection at all", async () => {
        const lobby = newLobby({ emptyRoomTtlMs: 10 })
        const handle = fourSeated(lobby)
        const room = roomOf(lobby, handle)
        // Both routes that delete a people-less room.
        room.scheduleDeleteIfEmpty()
        expect(room.isEmpty()).toBe(false)
        await sleep(60)
        expect(lobby.size()).toBe(1)
        expect(handle.status()).toBe("LOBBY")
    })

    it("starts with four fake people and nobody real", () => {
        const lobby = newLobby()
        const handle = fourSeated(lobby)
        expect(handle.humanCount()).toBe(0)
        expect(handle.start()).toBe(true)
        expect(handle.score()).toEqual({ A: 0, B: 0 })
        // Starting twice is a no-op, not a second game.
        expect(handle.start()).toBe(false)
    })

    it("refuses to start with an empty seat", () => {
        const lobby = newLobby()
        const handle = lobby.createDemoRoom(OPTIONS, identity(0), {})!
        expect(handle.sit(identity(1), 1)).toBe(true)
        expect(handle.start()).toBe(false)
        expect(handle.status()).toBe("LOBBY")
    })

    it("never seats the same fake person twice at one table", () => {
        const lobby = newLobby()
        const handle = lobby.createDemoRoom(OPTIONS, identity(0), {})!
        expect(handle.sit(identity(0), 2)).toBe(false)
        expect(handle.seatMap()[2]).toBeNull()
    })

    it("hands seats back on leave and tells the director when it is disposed", () => {
        const lobby = newLobby()
        const disposed: boolean[] = []
        const handle = fourSeated(lobby, { onDisposed: () => disposed.push(true) })
        expect(handle.leave(3)).toBe(true)
        expect(handle.seatMap()[3]).toBeNull()
        handle.close()
        expect(lobby.size()).toBe(0)
        expect(disposed).toEqual([true])
        // Every call is a no-op returning false once the room is gone.
        expect(handle.sit(identity(9), 3)).toBe(false)
        expect(handle.start()).toBe(false)
        expect(handle.react(0, "👏")).toBe(false)
    })

    it("keeps a finished table up for the director to wind down", async () => {
        const lobby = newLobby({ finishedRoomTtlMs: 10, emptyRoomTtlMs: 10 })
        const winners: Array<"A" | "B" | null> = []
        const handle = fourSeated(lobby, { onGameOver: (w) => winners.push(w) })
        handle.start()
        const room = roomOf(lobby, handle)
        // Reaching GAME_OVER through the engine would test the engine; the
        // room's own hand-off is what matters here.
        room.onGameOver("A")
        expect(winners).toEqual(["A"])
        // The WIRE says LOBBY — the table is open again for anyone looking at
        // it — while the director polls "FINISHED" and winds the room down.
        expect(room.toSummary().status).toBe("LOBBY")
        expect(handle.status()).toBe("FINISHED")
        await sleep(60)
        expect(lobby.size()).toBe(1)

        // Walking people out of a finished table is the director's sweep.
        expect(handle.leave(3)).toBe(true)
        expect(handle.seatMap()[3]).toBeNull()
        // …and starting another game clears the flag again.
        expect(handle.sit(identity(3), 3)).toBe(true)
        expect(handle.start()).toBe(true)
        expect(handle.status()).toBe("PLAYING")
    })

    it("broadcasts a reaction as the fake person, under the real cooldown", () => {
        const lobby = newLobby()
        const handle = fourSeated(lobby)
        expect(handle.react(0, "👏")).toBe(true)
        // Same sender again inside the cooldown: refused, exactly as a real
        // player's second tap would be.
        expect(handle.react(0, "🍀")).toBe(false)
        expect(handle.react(1, "🍀")).toBe(true)
        // Free text was removed from the protocol in 2026-09; only the fixed
        // emoji travel, and a fake person is held to that too.
        expect(handle.react(2, "💣")).toBe(false)
    })

    it("reports the lobby's own population to the director", () => {
        const lobby = newLobby()
        fourSeated(lobby)
        fourSeated(lobby)
        expect(lobby.totalRoomCount()).toBe(2)
        expect(lobby.realRoomCount()).toBe(0)
    })
})

/* ───────────────────────── real people ───────────────────────── */

describe("a real person in a demo room", () => {
    let server: GameServer
    const clients: TestClient[] = []

    beforeEach(async () => {
        server = await startTestServer({ timings: { reconnectGraceMs: 200, emptyRoomTtlMs: 50 } })
    })

    afterEach(async () => {
        for (const c of clients.splice(0)) await c.close()
        await server.close()
    })

    async function client(name: string): Promise<TestClient> {
        const c = await TestClient.connect(server.url())
        clients.push(c)
        await c.hello(name)
        return c
    }

    function demoRoom(events: DemoRoomEvents, seats = 3, options: DemoRoomOptions = OPTIONS): DemoRoomHandle {
        const handle = server.lobby.createDemoRoom(options, identity(0), events)!
        for (let seat = 1; seat < seats; seat++) {
            handle.sit(identity(seat), seat as Seat)
        }
        return handle
    }

    it("is seated through the normal path, and the director hears about it", async () => {
        const seated: Seat[] = []
        const ready: Array<[Seat, boolean]> = []
        const handle = demoRoom({
            onHumanSeated: (seat) => seated.push(seat),
            onHumanReady: (seat, r) => ready.push([seat, r]),
        })

        const c = await client("Ana")
        c.send({ t: "room.join", roomId: handle.id })
        const joined = await c.nextOfType("room.joined")
        expect(joined.yourSeat).not.toBeNull()
        expect(seated).toEqual([joined.yourSeat])
        // The host stays a fake person, so the client never offers "Pokreni igru".
        expect(joined.room.hostUid).toBe("demo:person-0")
        expect(handle.humanCount()).toBe(1)
        expect(handle.seatMap()[joined.yourSeat!]).toBe("HUMAN")

        c.send({ t: "room.ready", ready: true })
        await until(() => ready.length === 1)
        expect(ready[0]).toEqual([joined.yourSeat, true])
    })

    it("frees the seat and leaves the room alive when they walk out before the start", async () => {
        const gone: Seat[] = []
        const handle = demoRoom({ onHumanGone: (seat) => gone.push(seat) })

        const c = await client("Bruno")
        c.send({ t: "room.join", roomId: handle.id })
        const joined = await c.nextOfType("room.joined")
        const seat = joined.yourSeat!

        c.send({ t: "room.leave" })
        await c.nextOfType("room.left")
        await until(() => gone.length === 1)
        expect(gone).toEqual([seat])
        expect(handle.seatMap()[seat]).toBeNull()
        // Their departure must not take the scenery with it.
        expect(server.lobby.get(handle.id)).toBeDefined()
        expect(handle.status()).toBe("LOBBY")
    })

    it("can start the game themselves; the director's own start is then a harmless false", async () => {
        const handle = demoRoom({})
        const c = await client("Cvita")
        c.send({ t: "room.join", roomId: handle.id })
        await c.nextOfType("room.joined")
        c.send({ t: "room.ready", ready: true })
        c.send({ t: "room.start" })
        await c.next((m) => m.t === "room.state" && m.room.status === "PLAYING")
        expect(handle.status()).toBe("PLAYING")
        expect(handle.start()).toBe(false)
    })

    it("adds a real, removable BOT on 'Dodaj bota' — and sweeps it out when the visitor leaves", async () => {
        const handle = demoRoom({}, 2)
        const c = await client("Dino")
        c.send({ t: "room.join", roomId: handle.id })
        const joined = await c.nextOfType("room.joined")
        const free = ([0, 1, 2, 3] as Seat[]).find(
            (s) => joined.room.seats[s].occupant === null,
        )!

        c.send({ t: "room.addBot", seat: free })
        const state = await c.next((m) => m.t === "room.state" && m.room.seats[free].occupant !== null)
        expect(state.t === "room.state" && state.room.seats[free].occupant).toMatchObject({ kind: "BOT" })
        // The director must treat that chair as taken and not his.
        expect(handle.seatMap()[free]).toBe("HUMAN")

        // …and it can be removed again, like any bot.
        c.send({ t: "room.removeBot", seat: free })
        await c.next((m) => m.t === "room.state" && m.room.seats[free].occupant === null)

        // A bot left behind does not stay in the scenery once he is gone.
        c.send({ t: "room.addBot", seat: free })
        await c.next((m) => m.t === "room.state" && m.room.seats[free].occupant !== null)
        c.send({ t: "room.leave" })
        await c.nextOfType("room.left")
        expect(handle.seatMap()[free]).toBeNull()

        // "Makni bota" on a fake person is truthfully "there is no bot there".
        const c2 = await client("Eva")
        c2.send({ t: "room.join", roomId: handle.id })
        await c2.nextOfType("room.joined")
        c2.send({ t: "room.removeBot", seat: 0 })
        expect((await c2.nextOfType("error")).code).toBe("BAD_REQUEST")
    })

    it("is replaced by another person — never by 'Bot X' — when their hold expires mid-game", async () => {
        const gone: Seat[] = []
        const handle = demoRoom({ onHumanGone: (seat) => gone.push(seat) })
        const watcher = await client("Gledatelj")

        const c = await client("Filip")
        c.send({ t: "room.join", roomId: handle.id })
        const joined = await c.nextOfType("room.joined")
        const seat = joined.yourSeat!
        c.send({ t: "room.ready", ready: true })
        await until(() => handle.start())

        // Watch every frame from now on: not one of them may say BOT.
        watcher.send({ t: "room.join", roomId: handle.id })
        await watcher.nextOfType("room.joined")

        c.terminate()
        await until(() => gone.length === 1, 3000)
        expect(gone).toEqual([seat])
        expect(handle.seatMap()[seat]).toBeNull()
        expect(handle.status()).toBe("PLAYING")

        expect(handle.replace(seat, identity(5))).toBe(true)
        expect(handle.seatMap()[seat]).toMatchObject({ uid: "demo:person-5" })

        for (const msg of watcher.received) {
            if (msg.t === "room.state" || msg.t === "room.joined") {
                expect(JSON.stringify(msg.room.seats)).not.toContain("BOT")
            }
        }
    })

    it("never guesses its way into a private demo room", async () => {
        const handle = server.lobby.createDemoRoom({ ...OPTIONS, private: true }, identity(0), {})!
        const room = server.lobby.get(handle.id)!
        const c = await client("Hrvoje")

        // The right four digits, which nobody was ever given.
        c.send({ t: "room.joinByCode", code: room.code })
        const byCode = await c.nextOfType("error")
        expect(byCode.code).toBe("ROOM_NOT_FOUND")

        // The id IS public (every room is listed): the private-room rule answers.
        c.send({ t: "room.join", roomId: handle.id })
        const byId = await c.nextOfType("error")
        expect(byId.code).toBe("ROOM_CODE_REQUIRED")
    })

    it("sees a human turn ring over a fake person, and a move that lands long before it", async () => {
        // A tempo far shorter than the turn timeout: the wire must still carry
        // the ordinary human deadline, or the ring would drain in milliseconds.
        const handle = server.lobby.createDemoRoom(OPTIONS, identity(0, { fastMs: [5, 10], slowMs: [5, 10], slowChance: 0 }), {})!
        for (const seat of [1, 2, 3] as Seat[]) {
            handle.sit(identity(seat, { fastMs: [5, 10], slowMs: [5, 10], slowChance: 0 }), seat)
        }
        const watcher = await client("Publika")
        watcher.send({ t: "room.join", roomId: handle.id })
        await watcher.nextOfType("room.joined")
        handle.start()

        const first = await watcher.nextOfType("game.state")
        expect(first.turnDurationMs).toBe(server.timings.turnTimeoutMs)
        expect(first.turnDeadline).toBeGreaterThan(Date.now() + server.timings.turnTimeoutMs - 1_000)
        // …while the table actually moves at the tempo: several actions inside
        // a fraction of one 15 s deadline.
        await until(() => watcher.received.filter((m) => m.t === "game.state").length > 4, 2_000)
    })
})

/* ───────────────────────── nothing leaks ───────────────────────── */

describe("a fake person costs nothing anywhere", () => {
    let fetchMock: ReturnType<typeof vi.fn>

    beforeEach(() => {
        fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }))
        vi.stubGlobal("fetch", fetchMock)
        vi.stubEnv("GAME_RESULTS_TOKEN", "secret")
        vi.stubEnv("BACKEND_INTERNAL_URL", "http://backend:8085/api")
    })

    afterEach(() => {
        vi.unstubAllGlobals()
        vi.unstubAllEnvs()
    })

    function gameOverState(): GameState {
        return {
            config: { targetScore: 1001, seed: "demo" },
            dealNo: 1,
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
            dealScore: null,
            score: { A: 1001, B: 300 },
            history: [],
            rng: createRng("demo"),
            winner: "A",
        } as unknown as GameState
    }

    it("is never named to the stats or reliability endpoints", async () => {
        const lobby = newLobby()
        const handle = fourSeated(lobby)
        handle.start()
        const room = roomOf(lobby, handle)

        // A table of fake people is counted exactly as a table of bots: §8.1's
        // "both teams need a human" fails, so nothing is sent at all.
        reportGameResult(room, gameOverState(), "result-1")
        // And a demo uid is refused outright even if one somehow got here.
        reportGameAbandonment("run-1", "demo:person-1")
        await sleep(20)
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it("never reaches the admin analytics, with or without a real player in the room", async () => {
        const lobby = newLobby()
        const handle = fourSeated(lobby)
        handle.start()
        const room = roomOf(lobby, handle)

        reportRoomCreated(room)
        reportGameStarted("run-1", room, Date.now())
        reportGameCompleted("run-1", room, gameOverState(), Date.now(), 0)
        await sleep(20)
        expect(fetchMock).not.toHaveBeenCalled()
    })
})

/* ───────────────────────── flag off ───────────────────────── */

describe("with GAME_DEMO_LOBBY unset", () => {
    it("there is no demo config at all", () => {
        expect(loadConfig({}).demo).toBeNull()
        expect(loadConfig({ GAME_DEMO_ROOMS: "8-12" }).demo).toBeNull()
    })

    it("parses and clamps the bands when it is set", () => {
        expect(loadConfig({ GAME_DEMO_LOBBY: "1" }).demo).toEqual({
            totalRooms: [8, 12],
            playingRooms: [5, 6],
            watchableRooms: 2,
        })
        expect(loadConfig({
            GAME_DEMO_LOBBY: "true",
            GAME_DEMO_ROOMS: "4-2",
            GAME_DEMO_PLAYING: "9",
            GAME_DEMO_WATCHABLE: "99",
        }).demo).toEqual({
            // Reversed bands are ordered, and nothing may exceed the band
            // outside it: a typo makes the lobby smaller, never impossible.
            totalRooms: [2, 4],
            playingRooms: [4, 4],
            watchableRooms: 4,
        })
        expect(loadConfig({ GAME_DEMO_LOBBY: "1", GAME_DEMO_ROOMS: "osam" }).demo?.totalRooms).toEqual([8, 12])
    })

    it("leaves an ordinary room exactly as it was — its last member still deletes it", async () => {
        const server = await startTestServer()
        try {
            const c = await TestClient.connect(server.url())
            await c.hello("Ivo")
            c.send({ t: "room.create", targetScore: 1001, private: false })
            await c.nextOfType("room.joined")
            expect(server.lobby.realRoomCount()).toBe(1)
            await c.close()
            await until(() => server.lobby.size() === 0)
        } finally {
            await server.close()
        }
    })
})

/* ─────────────── guests in rooms real people opened ───────────────
   DEMO-LOBBY.md "Gosti u pravim sobama". The whole feature hangs off one
   call — `Lobby.watchRealRooms` — which only the director makes, so every
   test here first proves that the door is shut, then opens it. */

describe("guests in an ordinary room", () => {
    /** The least a `Connection` can be and still pass through `Lobby.create`. */
    function conn(uid: string, name: string): Connection {
        const sent: ServerMessage[] = []
        return {
            id: uid,
            user: { uid, name, avatarUrl: null, avatarPreset: "kartar", karma: 10 },
            roomId: null,
            lobbySubscribed: false,
            sent,
            send: (msg: ServerMessage) => {
                sent.push(msg)
            },
            error: () => undefined,
            close: () => undefined,
        } as unknown as Connection & { sent: ServerMessage[] }
    }

    function publicRoom(lobby: Lobby, c: Connection): Room {
        return lobby.create(c, { targetScore: 1001, private: false })
    }

    function watched(lobby: Lobby): { opened: string[]; changed: string[]; closed: string[] } {
        const seen = { opened: [] as string[], changed: [] as string[], closed: [] as string[] }
        lobby.watchRealRooms({
            onRoomOpened: (r) => seen.opened.push(r.id),
            onRoomChanged: (_r, what) => seen.changed.push(what),
            onRoomClosed: (id) => seen.closed.push(id),
        })
        return seen
    }

    function handleFor(lobby: Lobby, room: Room): RealRoomHandle {
        const handle = lobby.realWaitingRooms().find((h) => h.id === room.id)
        expect(handle).toBeDefined()
        return handle!
    }

    it("is exposed only after watchRealRooms — the flag-off lobby offers nothing", () => {
        const lobby = newLobby()
        const room = publicRoom(lobby, conn("real:1", "Ivo"))
        // Nobody asked to watch: no handles, so `guestSit` is unreachable and
        // the room is exactly the ordinary room it was.
        expect(lobby.realWaitingRooms()).toEqual([])
        expect(room.toState().seats.filter((s) => s.occupant !== null).length).toBe(1)

        watched(lobby)
        expect(lobby.realWaitingRooms().map((h) => h.id)).toEqual([room.id])
    })

    it("serialises a guest as a seated, connected, ready PLAYER — never a BOT", () => {
        const lobby = newLobby()
        const room = publicRoom(lobby, conn("real:1", "Ivo"))
        watched(lobby)
        const handle = handleFor(lobby, room)
        expect(handle.sitGuest(identity(7))).toBe(true)

        const state = room.toState()
        const seat = state.seats.find((s) => s.occupant?.kind === "PLAYER" && s.occupant.user.uid === "demo:person-7")
        expect(seat).toBeDefined()
        const occupant = seat?.occupant
        if (!occupant || occupant.kind !== "PLAYER") throw new Error("expected a PLAYER")
        expect(occupant.ready).toBe(true)
        expect(occupant.connected).toBe(true)
        expect(occupant.holdUntil).toBeNull()
        expect(occupant.user.name).toBe("Osoba 7")
        // And in the public lobby row, where a BOT would be drawn faded out.
        const summary = room.toSummary()
        expect(summary.occupants.some((o) => o?.kind === "BOT")).toBe(false)
        expect(summary.humans).toBe(2)
        // It took the room's own fill order, so the two of them are partners.
        expect(room.slotAt(2)?.kind).toBe("DEMO")
    })

    it("never becomes the host, and never takes a private room", () => {
        const lobby = newLobby()
        const host = conn("real:1", "Ivo")
        const room = publicRoom(lobby, host)
        watched(lobby)
        const handle = handleFor(lobby, room)
        expect(handle.sitGuest(identity(1))).toBe(true)
        expect(handle.sitGuest(identity(2))).toBe(true)
        expect(room.hostUid).toBe("real:1")

        // The host locks the room: the guests stay (they are "people"), but
        // nobody new walks in.
        room.setPrivate(host, true)
        expect(room.guestIdentities().length).toBe(2)
        expect(handle.isPublic()).toBe(false)
        expect(handle.sitGuest(identity(3))).toBe(false)
        expect(lobby.realWaitingRooms()).toEqual([])
        expect(room.hostUid).toBe("real:1")
    })

    it("counts as occupied and ready for the real host's Pokreni igru", () => {
        const lobby = newLobby()
        const host = conn("real:1", "Ivo")
        const room = publicRoom(lobby, host)
        watched(lobby)
        const handle = handleFor(lobby, room)
        for (const n of [1, 2, 3]) expect(handle.sitGuest(identity(n))).toBe(true)
        room.setReady(host, true)
        room.start(host)
        expect(room.status).toBe("PLAYING")
        // Mid-deal a guest cannot stand up and walk off with the cards.
        expect(handle.removeGuest(identity(1))).toBe(false)
        room.dispose()
    })

    it("still lets the real host add and remove a visible bot", () => {
        const lobby = newLobby()
        const host = conn("real:1", "Ivo")
        const room = publicRoom(lobby, host)
        watched(lobby)
        handleFor(lobby, room).sitGuest(identity(1))
        const free = room.nextSeatForNewcomer()
        expect(free).not.toBeNull()
        room.addBot(host, free!)
        expect(room.slotAt(free!)?.kind).toBe("BOT")
        room.removeBot(host, free!)
        expect(room.slotAt(free!)).toBeNull()
    })

    it("does not keep the room alive: the last real person leaving removes it", () => {
        const lobby = newLobby()
        const host = conn("real:1", "Ivo")
        const room = publicRoom(lobby, host)
        const seen = watched(lobby)
        const handle = handleFor(lobby, room)
        expect(handle.sitGuest(identity(1))).toBe(true)
        expect(handle.sitGuest(identity(2))).toBe(true)

        room.leave(host)
        // Exactly what an ordinary lobby room does when its last human goes.
        expect(lobby.get(room.id)).toBeUndefined()
        expect(seen.closed).toContain(room.id)
        // And the handle is dead, so the director releases its people.
        expect(handle.guests()).toEqual([])
        expect(handle.humanCount()).toBe(0)
        expect(handle.sitGuest(identity(3))).toBe(false)
    })

    it("refuses a room with nobody real in it", () => {
        const lobby = newLobby()
        const host = conn("real:1", "Ivo")
        const room = publicRoom(lobby, host)
        watched(lobby)
        const handle = handleFor(lobby, room)
        room.leave(host)
        expect(handle.sitGuest(identity(1))).toBe(false)
    })

    it("reports a real person coming and going, and the game starting", () => {
        const lobby = newLobby()
        const host = conn("real:1", "Ivo")
        const room = publicRoom(lobby, host)
        const seen = watched(lobby)
        expect(seen.opened).toContain(room.id)

        const second = conn("real:2", "Ana")
        room.attach(second)
        expect(seen.changed).toContain("human")
        seen.changed.length = 0
        room.setPrivate(host, true)
        expect(seen.changed).toContain("options")
    })
})
