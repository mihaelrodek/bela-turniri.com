/* ──────────────────────────────────────────────────────────────────────────
   Seat holds (README §3 "Timeri", §4).

   The behaviour under test, in one line each:
     • `room.leave` mid-game keeps the seat for `reconnectGraceMs`
     • an away seat is NOT auto-played instantly — its turn deadline runs first
     • …but IS auto-played once that deadline expires
     • rejoining inside the window restores the seat and the hand
     • the hold expiring hands the seat to a bot for good
     • `game.active` tells the lobby which room is still holding a seat

   Every timing comes from the server options, so nothing here waits two real
   minutes: `reconnectGraceMs` and `turnTimeoutMs` are shortened per test the
   same way `game.test.ts` shortens bot think delays.
   ────────────────────────────────────────────────────────────────────── */

import { afterEach, describe, expect, it } from "vitest"
import type { GameServer } from "../src/server.js"
import { sleep, startTestServer, TestClient, until } from "./helpers.js"

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

/** Create a room, explicitly fill the empty seats with bots, ready up, start. */
async function startBotRoom(host: TestClient): Promise<string> {
    // These lifecycle tests use a spectator to observe state after the player leaves.
    host.send({ t: "room.create", name: "Soba", targetScore: 501, private: false, allowSpectators: true })
    const joined = await host.nextOfType("room.joined")
    for (const seat of [1, 2, 3] as const) host.send({ t: "room.addBot", seat })
    await host.next((m) => m.t === "room.state" && m.room.seats.every((s) => s.occupant !== null))
    host.send({ t: "room.ready", ready: true })
    await host.nextOfType("room.state")
    host.send({ t: "room.start" })
    await host.next((m) => m.t === "room.state" && m.room.status === "PLAYING")
    return joined.room.id
}

/** Start with three people and one bot, so one explicit exit may use a hold. */
async function startSupportedRoom(host: TestClient): Promise<string> {
    host.send({ t: "room.create", name: "Soba", targetScore: 501, private: false })
    const joined = await host.nextOfType("room.joined")
    // No explicit `room.sit`: joining seats you (README §3.3), and these tests
    // only care that three humans are seated somewhere and ready — pinning the
    // seats here would just restate `SEAT_FILL_ORDER` in a file about holds.
    for (const name of ["Ana", "Bruno"] as const) {
        const player = await connect(name)
        player.send({ t: "room.join", roomId: joined.room.id })
        const seated = await player.nextOfType("room.joined")
        if (seated.yourSeat === null) throw new Error(`${name} was not seated`)
        player.send({ t: "room.ready", ready: true })
    }
    host.send({ t: "room.addBot", seat: 3 })
    host.send({ t: "room.ready", ready: true })
    await host.next((m) => m.t === "room.state" && m.yourSeat === 0
        && m.room.seats.every((s) => s.occupant !== null)
        && m.room.seats.filter((s) => s.occupant?.kind === "PLAYER" && s.occupant.ready).length === 3)
    host.send({ t: "room.start" })
    await host.next((m) => m.t === "room.state" && m.room.status === "PLAYING")
    return joined.room.id
}

describe("dissolving games without enough people", () => {
    it("keeps a one-player bot game for the reconnect window after an explicit leave", async () => {
        server = await startTestServer({
            timings: { reconnectGraceMs: 30_000, botThinkMinMs: 100_000, botThinkMaxMs: 100_000 },
        })
        const host = await connect("Igrac")
        const roomId = await startBotRoom(host)

        host.send({ t: "room.leave" })
        await host.nextOfType("room.left")
        const room = server.lobby.get(roomId)

        expect(room?.status).toBe("PLAYING")
        expect(room?.slotAt(0)).toMatchObject({ kind: "PLAYER", connected: false })
        expect(room?.holdFor("dev:igrac")?.until ?? 0).toBeGreaterThan(Date.now())
    })

    it("keeps a two-player game for the reconnect window when one person explicitly leaves", async () => {
        server = await startTestServer({
            timings: { reconnectGraceMs: 30_000, botThinkMinMs: 100_000, botThinkMaxMs: 100_000 },
        })
        const host = await connect("Igrac")
        host.send({ t: "room.create", name: "Dvoje", targetScore: 501, private: false })
        const joined = await host.nextOfType("room.joined")
        const partner = await connect("Partner")
        partner.send({ t: "room.join", roomId: joined.room.id })
        // Seat 2 — joining really does make the second arrival the host's
        // partner now, which is the whole point of `SEAT_FILL_ORDER`.
        expect((await partner.nextOfType("room.joined")).yourSeat).toBe(2)
        host.send({ t: "room.addBot", seat: 1 })
        host.send({ t: "room.addBot", seat: 3 })
        partner.send({ t: "room.ready", ready: true })
        host.send({ t: "room.ready", ready: true })
        await host.next((m) => m.t === "room.state"
            && m.room.seats.every((s) => s.occupant !== null)
            && m.room.seats.filter((s) => s.occupant?.kind === "PLAYER" && s.occupant.ready).length === 2)
        host.send({ t: "room.start" })
        await host.next((m) => m.t === "room.state" && m.room.status === "PLAYING")

        host.send({ t: "room.leave" })
        await host.nextOfType("room.left")

        const room = server.lobby.get(joined.room.id)
        expect(room?.status).toBe("PLAYING")
        expect(room?.slotAt(0)).toMatchObject({ kind: "PLAYER", connected: false })
        expect(room?.holdFor("dev:igrac")?.until ?? 0).toBeGreaterThan(Date.now())
    })

    it("removes a solo game when a dropped player's reconnect grace expires", async () => {
        server = await startTestServer({
            timings: { reconnectGraceMs: 40, botThinkMinMs: 100_000, botThinkMaxMs: 100_000 },
        })
        const host = await connect("Igrac")
        const roomId = await startBotRoom(host)

        await host.close()
        await until(() => server?.lobby.get(roomId) === undefined, 3000)

        expect(server.roomCount()).toBe(0)
    })

    it("does not dissolve a running room when a spectator leaves", async () => {
        server = await startTestServer({ timings: { botThinkMinMs: 100_000, botThinkMaxMs: 100_000 } })
        const host = await connect("Igrac")
        const roomId = await startBotRoom(host)
        const spectator = await connect("Gledatelj")
        spectator.send({ t: "room.join", roomId })
        await spectator.nextOfType("room.joined")

        spectator.send({ t: "room.leave" })
        await spectator.nextOfType("room.left")

        expect(server.lobby.get(roomId)?.status).toBe("PLAYING")
        expect(server.lobby.get(roomId)?.slotAt(0)?.kind).toBe("PLAYER")
    })
})

describe("seat hold on an explicit leave", () => {
    it("keeps the seat for the hold window instead of bot-ifying it immediately", async () => {
        server = await startTestServer({
            timings: { reconnectGraceMs: 30_000, botThinkMinMs: 100_000, botThinkMaxMs: 100_000 },
        })
        const host = await connect("Igrac")
        const roomId = await startSupportedRoom(host)
        const room = server.lobby.get(roomId)
        if (!room) throw new Error("room missing")

        host.send({ t: "room.leave" })
        await host.nextOfType("room.left")

        // The seat is STILL the human's — this is the regression the whole
        // feature exists for (it used to be a bot the moment you walked out).
        const slot = room.slotAt(0)
        expect(slot?.kind).toBe("PLAYER")
        if (slot?.kind === "PLAYER") {
            expect(slot.uid).toBe("dev:igrac")
            expect(slot.connected).toBe(false)
        }
        const hold = room.holdFor("dev:igrac")
        expect(hold?.reason).toBe("left")
        expect(hold?.seat).toBe(0)
        expect(hold?.until ?? 0).toBeGreaterThan(Date.now())
        expect(room.toState().seats[0].occupant).toMatchObject({ kind: "PLAYER", connected: false })
    })

    it("frees the seat outright when the leave happens in the lobby", async () => {
        server = await startTestServer()
        const host = await connect("Domacin")
        host.send({ t: "room.create", name: "Soba", targetScore: 501, private: false })
        const joined = await host.nextOfType("room.joined")
        const guest = await connect("Gost")
        guest.send({ t: "room.join", roomId: joined.room.id })
        // Auto-seated into 2 by `SEAT_FILL_ORDER` — no `room.sit` needed, and
        // sitting into the seat you already hold is a no-op anyway.
        expect((await guest.nextOfType("room.joined")).yourSeat).toBe(2)

        guest.send({ t: "room.leave" })
        await guest.nextOfType("room.left")
        const room = server.lobby.get(joined.room.id)!
        expect(room.slotAt(2)).toBeNull()
        expect(room.holdFor("dev:gost")).toBeNull()
    })

    it("converts the held seat to a bot once the hold expires", async () => {
        server = await startTestServer({
            timings: { reconnectGraceMs: 60, botThinkMinMs: 100_000, botThinkMaxMs: 100_000 },
        })
        const host = await connect("Igrac")
        const roomId = await startSupportedRoom(host)
        const room = server.lobby.get(roomId)
        if (!room) throw new Error("room missing")

        host.send({ t: "room.leave" })
        await host.nextOfType("room.left")
        expect(room.slotAt(0)?.kind).toBe("PLAYER")

        await until(() => room.slotAt(0)?.kind === "BOT", 3000)
        expect(room.holdFor("dev:igrac")).toBeNull()
        const slot = room.slotAt(0)
        if (slot?.kind === "BOT") expect(slot.name).toBe("Bot Ivo")
    })

    it("restores the seat and the game state when the same uid rejoins in time", async () => {
        server = await startTestServer({
            timings: { reconnectGraceMs: 30_000, botThinkMinMs: 100_000, botThinkMaxMs: 100_000 },
        })
        const host = await connect("Igrac")
        const roomId = await startSupportedRoom(host)
        const room = server.lobby.get(roomId)
        if (!room) throw new Error("room missing")
        const before = await host.nextOfType("game.state")

        host.send({ t: "room.leave" })
        await host.nextOfType("room.left")
        expect(room.holdFor("dev:igrac")).not.toBeNull()

        host.send({ t: "room.join", roomId })
        const rejoined = await host.nextOfType("room.joined")
        expect(rejoined.yourSeat).toBe(0)
        expect(rejoined.room.status).toBe("PLAYING")
        const after = await host.nextOfType("game.state")
        expect(after.view.seat).toBe(0)
        expect(after.view.dealNo).toBe(before.view.dealNo)
        expect(after.view.hand).toEqual(before.view.hand)

        expect(room.holdFor("dev:igrac")).toBeNull()
        const slot = room.slotAt(0)
        expect(slot?.kind).toBe("PLAYER")
        if (slot?.kind === "PLAYER") expect(slot.connected).toBe(true)
    })

    it("keeps a held seat when its owner tries to open another room — the new room is refused", async () => {
        // One game at a time (README §3.2). This used to be the opposite: a
        // second `room.create` silently forfeited the held seat.
        server = await startTestServer({
            timings: { reconnectGraceMs: 30_000, botThinkMinMs: 100_000, botThinkMaxMs: 100_000 },
        })
        const host = await connect("Igrac")
        const roomId = await startSupportedRoom(host)
        const room = server.lobby.get(roomId)!

        host.send({ t: "room.leave" })
        await host.nextOfType("room.left")
        expect(room.slotAt(0)?.kind).toBe("PLAYER")

        host.send({ t: "room.create", name: "Druga", targetScore: 501, private: false })
        const refused = await host.nextOfType("error")
        expect(refused.code).toBe("ALREADY_IN_GAME")
        expect(refused.ref).toBe("room.create")
        expect(server.roomCount()).toBe(1)

        await sleep(50)
        expect(room.slotAt(0)?.kind).toBe("PLAYER")
        expect(room.holdFor("dev:igrac")).not.toBeNull()
    })
})

describe("turns while a seat is away", () => {
    it("does not auto-play for an away seat before its turn deadline", async () => {
        server = await startTestServer({
            timings: { reconnectGraceMs: 30_000, turnTimeoutMs: 10_000, botThinkMinMs: 0, botThinkMaxMs: 0 },
        })
        const host = await connect("Igrac")
        const roomId = await startBotRoom(host)
        const room = server.lobby.get(roomId)
        if (!room) throw new Error("room missing")

        // A spectator stays behind so we can watch the table without being on it.
        const watcher = await connect("Gledatelj")
        watcher.send({ t: "room.join", roomId })
        await watcher.nextOfType("room.joined")

        // The three bots play instantly, so the table is already parked on
        // seat 0 by the time we walk out.
        await until(() => room.game?.state.phase !== "DEAL_DONE" && currentSeat(room) === 0)
        await host.close()

        const stateAfterLeave = await watcher.next(
            (m) => m.t === "game.state" || m.t === "room.state",
            2000,
        )
        expect(stateAfterLeave.t).toBeDefined()

        await sleep(600)
        expect(currentSeat(room)).toBe(0)
        expect(watcher.received.some((m) => m.t === "game.state" && m.autoPlayed)).toBe(false)
        // The normal deadline is what is running, not a bot think delay.
        const last = [...watcher.received].reverse().find((m) => m.t === "game.state")
        expect(last && last.t === "game.state" ? last.turnDeadline : null).not.toBeNull()
    })

    it("auto-plays for an away seat once the turn deadline expires", async () => {
        server = await startTestServer({
            timings: { reconnectGraceMs: 30_000, turnTimeoutMs: 250, botThinkMinMs: 0, botThinkMaxMs: 0 },
        })
        const host = await connect("Igrac")
        const roomId = await startBotRoom(host)
        const watcher = await connect("Gledatelj")
        watcher.send({ t: "room.join", roomId })
        await watcher.nextOfType("room.joined")

        await host.close()

        const auto = await watcher.next((m) => m.t === "game.state" && m.autoPlayed === true, 10_000)
        expect(auto.t).toBe("game.state")
        // Still their seat: one timed-out turn is not a forfeit.
        const room = server.lobby.get(roomId)!
        expect(room.slotAt(0)?.kind).toBe("PLAYER")
    })
})

describe("game.active", () => {
    it("tells the lobby which room is holding a seat, and stops once it is gone", async () => {
        server = await startTestServer({
            timings: { reconnectGraceMs: 30_000, botThinkMinMs: 100_000, botThinkMaxMs: 100_000 },
        })
        const host = await connect("Igrac")
        const roomId = await startSupportedRoom(host)

        host.send({ t: "room.leave" })
        await host.nextOfType("room.left")

        const active = await host.next((m) => m.t === "game.active" && m.seat !== null)
        if (active.t !== "game.active" || !active.seat) throw new Error("expected an active seat")
        expect(active.seat.roomId).toBe(roomId)
        expect(active.seat.seat).toBe(0)
        expect(active.seat.status).toBe("PLAYING")
        expect(active.seat.present).toBe(false)
        expect(active.seat.holdUntil ?? 0).toBeGreaterThan(Date.now())
        expect(active.seat.roomName).toBe("Soba")

        // Walking back in clears the hold and reports us as present.
        host.send({ t: "room.join", roomId })
        await host.nextOfType("room.joined")
        const back = await host.next((m) => m.t === "game.active" && m.seat?.present === true)
        if (back.t !== "game.active" || !back.seat) throw new Error("expected a present seat")
        expect(back.seat.holdUntil).toBeNull()
    })

    it("lets a second room.leave from the lobby forfeit the held seat outright", async () => {
        server = await startTestServer({
            timings: { reconnectGraceMs: 30_000, botThinkMinMs: 100_000, botThinkMaxMs: 100_000 },
        })
        const host = await connect("Igrac")
        const roomId = await startSupportedRoom(host)
        const room = server.lobby.get(roomId)!

        host.send({ t: "room.leave" })
        await host.nextOfType("room.left")
        expect(room.slotAt(0)?.kind).toBe("PLAYER")

        // The lobby's "napusti igru" button: we are no longer in the room, so
        // this is the only way to give the seat back before the hold runs out.
        host.send({ t: "room.leave" })
        await host.nextOfType("room.left")
        expect(room.slotAt(0)?.kind).toBe("BOT")
        const cleared = await host.next((m) => m.t === "game.active" && m.seat === null)
        expect(cleared.t).toBe("game.active")
    })

    it("reports a held seat to a brand-new connection without re-seating it", async () => {
        server = await startTestServer({
            timings: { reconnectGraceMs: 30_000, botThinkMinMs: 100_000, botThinkMaxMs: 100_000 },
        })
        const host = await connect("Igrac")
        const roomId = await startSupportedRoom(host)
        host.send({ t: "room.leave" })
        await host.nextOfType("room.left")

        const fresh = await connect("Igrac")
        const active = await fresh.next((m) => m.t === "game.active")
        if (active.t !== "game.active" || !active.seat) throw new Error("expected an active seat")
        expect(active.seat.roomId).toBe(roomId)
        expect(active.seat.holdUntil ?? 0).toBeGreaterThan(Date.now())
        // An explicit leave is not undone behind the user's back: no room.joined.
        expect(fresh.received.some((m) => m.t === "room.joined")).toBe(false)
        expect(server.lobby.get(roomId)!.holdFor("dev:igrac")).not.toBeNull()
    })

    it("still walks a dropped socket straight back into its room", async () => {
        server = await startTestServer({
            timings: { reconnectGraceMs: 30_000, botThinkMinMs: 100_000, botThinkMaxMs: 100_000 },
        })
        const host = await connect("Igrac")
        const roomId = await startBotRoom(host)
        const room = server.lobby.get(roomId)!

        await host.close()
        clients.length = 0
        await until(() => room.holdFor("dev:igrac")?.reason === "disconnect")

        const again = await connect("Igrac")
        const joined = await again.nextOfType("room.joined")
        expect(joined.room.id).toBe(roomId)
        expect(joined.yourSeat).toBe(0)
        expect(room.holdFor("dev:igrac")).toBeNull()
    })

    it("starts a fresh full reconnect window after every successful reconnect", async () => {
        server = await startTestServer({
            timings: { reconnectGraceMs: 30_000, botThinkMinMs: 100_000, botThinkMaxMs: 100_000 },
        })
        const first = await connect("Igrac")
        const roomId = await startBotRoom(first)
        const room = server.lobby.get(roomId)!

        await first.close()
        clients.length = 0
        await until(() => room.holdFor("dev:igrac")?.reason === "disconnect")
        const firstUntil = room.holdFor("dev:igrac")!.until

        const second = await connect("Igrac")
        await second.nextOfType("room.joined")
        expect(room.holdFor("dev:igrac")).toBeNull()

        await sleep(10)
        await second.close()
        clients.length = 0
        await until(() => room.holdFor("dev:igrac")?.reason === "disconnect")
        const secondUntil = room.holdFor("dev:igrac")!.until

        expect(secondUntil).toBeGreaterThan(firstUntil)
        expect(secondUntil).toBeGreaterThan(Date.now() + 29_000)
        expect(room.slotAt(0)).toMatchObject({ kind: "PLAYER", connected: false })
    })
})

function currentSeat(room: NonNullable<ReturnType<GameServer["lobby"]["get"]>>): number | null {
    const st = room.game?.state
    if (!st) return null
    if (st.phase === "BIDDING") return st.bidding.turn
    if (st.phase === "PLAYING") return st.trick.turn
    return null
}
