/* ──────────────────────────────────────────────────────────────────────────
   ONE GAME AT A TIME (README §3.2).

   Holding a seat in a room means every other room is closed to you until you
   go back to it or give it up. The client disables the buttons from
   `game.active`, but the client is not a security boundary — everything here
   goes straight at the server.

   The other half of the rule matters just as much: returning to your OWN room
   must never be refused, from any of the three routes into it.
   ────────────────────────────────────────────────────────────────────── */

import { afterEach, describe, expect, it } from "vitest"
import type { GameServer } from "../src/server.js"
import { sleep, startTestServer, TestClient } from "./helpers.js"

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

/** Create a room, ready up, start it — the three empty seats become bots. */
async function startSoloRoom(host: TestClient, name = "Prva"): Promise<string> {
    host.send({ t: "room.create", name, targetScore: 501, private: false })
    const joined = await host.nextOfType("room.joined")
    host.send({ t: "room.ready", ready: true })
    await host.nextOfType("room.state")
    host.send({ t: "room.start" })
    await host.next((m) => m.t === "room.state" && m.room.status === "PLAYING")
    return joined.room.id
}

async function addSupportPlayers(roomId: string, code?: string): Promise<void> {
    // Joining seats you (README §3.3); which seat is `SEAT_FILL_ORDER`'s
    // business and joinSeating.test.ts's, not this file's.
    for (const name of ["Ana", "Bruno"] as const) {
        const player = await connect(name)
        player.send(code ? { t: "room.joinByCode", code } : { t: "room.join", roomId })
        const seated = await player.nextOfType("room.joined")
        if (seated.yourSeat === null) throw new Error(`${name} was not seated`)
        player.send({ t: "room.ready", ready: true })
    }
}

/** Three people and one bot: one exit still leaves a playable human table. */
async function startSupportedRoom(host: TestClient, name = "Prva"): Promise<string> {
    host.send({ t: "room.create", name, targetScore: 501, private: false })
    const joined = await host.nextOfType("room.joined")
    await addSupportPlayers(joined.room.id)
    host.send({ t: "room.ready", ready: true })
    await host.next((m) => m.t === "room.state"
        && m.room.seats.filter((s) => s.occupant?.kind === "PLAYER" && s.occupant.ready).length === 3)
    host.send({ t: "room.start" })
    await host.next((m) => m.t === "room.state" && m.room.status === "PLAYING")
    return joined.room.id
}

describe("a seated player may not start or join a second game", () => {
    it("refuses room.create while seated at a live table", async () => {
        server = await startTestServer({ timings: { botThinkMinMs: 100_000, botThinkMaxMs: 100_000 } })
        const host = await connect("Igrac")
        const roomId = await startSupportedRoom(host)

        host.send({ t: "room.create", name: "Druga", targetScore: 1001, private: false })
        const err = await host.nextOfType("error")
        expect(err.code).toBe("ALREADY_IN_GAME")
        expect(err.message).toContain("Prva")
        // Nothing was created and the first table is untouched.
        expect(server.roomCount()).toBe(1)
        expect(server.lobby.get(roomId)!.slotAt(0)?.kind).toBe("PLAYER")
    })

    it("refuses room.join into somebody else's room while seated", async () => {
        server = await startTestServer({ timings: { botThinkMinMs: 100_000, botThinkMaxMs: 100_000 } })
        const other = await connect("Drugi")
        other.send({ t: "room.create", name: "Tudja", targetScore: 501, private: false })
        const theirs = await other.nextOfType("room.joined")

        const host = await connect("Igrac")
        const roomId = await startSupportedRoom(host)

        host.send({ t: "room.join", roomId: theirs.room.id })
        const err = await host.nextOfType("error")
        expect(err.code).toBe("ALREADY_IN_GAME")
        expect(err.ref).toBe("room.join")

        // Neither room moved: we are still seated in ours, still a stranger in theirs.
        expect(server.lobby.get(roomId)!.seatOfUid("dev:igrac")).toBe(0)
        expect(server.lobby.get(theirs.room.id)!.seatOfUid("dev:igrac")).toBeNull()
    })

    it("refuses room.joinByCode into another room while seated", async () => {
        server = await startTestServer({ timings: { botThinkMinMs: 100_000, botThinkMaxMs: 100_000 } })
        const other = await connect("Drugi")
        other.send({ t: "room.create", name: "Tajna", targetScore: 501, private: true })
        const theirs = await other.nextOfType("room.joined")

        const host = await connect("Igrac")
        await startSoloRoom(host)

        host.send({ t: "room.joinByCode", code: theirs.room.code })
        const err = await host.nextOfType("error")
        expect(err.code).toBe("ALREADY_IN_GAME")
        expect(server.lobby.get(theirs.room.id)!.seatOfUid("dev:igrac")).toBeNull()
    })

    it("refuses a second room even while the first one only HOLDS the seat", async () => {
        server = await startTestServer({
            timings: { reconnectGraceMs: 30_000, botThinkMinMs: 100_000, botThinkMaxMs: 100_000 },
        })
        const host = await connect("Igrac")
        const roomId = await startSupportedRoom(host)

        host.send({ t: "room.leave" })
        await host.nextOfType("room.left")
        expect(server.lobby.get(roomId)!.holdFor("dev:igrac")).not.toBeNull()

        host.send({ t: "room.create", targetScore: 501, private: false })
        expect((await host.nextOfType("error")).code).toBe("ALREADY_IN_GAME")
        expect(server.roomCount()).toBe(1)
        // The hold is exactly where it was — refusing must not cost the seat.
        expect(server.lobby.get(roomId)!.holdFor("dev:igrac")).not.toBeNull()
    })

    it("stops blocking once the seat is actually given up", async () => {
        server = await startTestServer({
            timings: { reconnectGraceMs: 30_000, botThinkMinMs: 100_000, botThinkMaxMs: 100_000 },
        })
        const host = await connect("Igrac")
        const roomId = await startSoloRoom(host)

        host.send({ t: "room.leave" })
        await host.nextOfType("room.left")
        await host.next((m) => m.t === "game.active" && m.seat === null)
        expect(server.lobby.get(roomId)).toBeUndefined()

        host.send({ t: "room.create", name: "Druga", targetScore: 1001, private: false })
        const joined = await host.nextOfType("room.joined")
        expect(joined.room.name).toBe("Druga")
        expect(joined.yourSeat).toBe(0)
    })

    it("never blocks a spectator, who holds no seat anywhere", async () => {
        server = await startTestServer()
        const other = await connect("Drugi")
        other.send({ t: "room.create", name: "Tudja", targetScore: 501, private: false, allowSpectators: true })
        const theirs = await other.nextOfType("room.joined")
        // Nobody is a spectator while a seat is free — the join would take it.
        for (const seat of [1, 2, 3] as const) other.send({ t: "room.addBot", seat })
        await other.next((m) => m.t === "room.state" && m.room.seats.every((s) => s.occupant !== null))

        const watcher = await connect("Gledatelj")
        watcher.send({ t: "room.join", roomId: theirs.room.id })
        const joined = await watcher.nextOfType("room.joined")
        expect(joined.yourSeat).toBeNull()

        watcher.send({ t: "room.create", name: "Svoja", targetScore: 501, private: false })
        const mine = await watcher.nextOfType("room.joined")
        expect(mine.room.name).toBe("Svoja")
    })
})

describe("returning to your own room still works", () => {
    it("lets room.join walk back into the room that holds your seat", async () => {
        server = await startTestServer({
            timings: { reconnectGraceMs: 30_000, botThinkMinMs: 100_000, botThinkMaxMs: 100_000 },
        })
        const host = await connect("Igrac")
        const roomId = await startSupportedRoom(host)
        const before = await host.nextOfType("game.state")

        host.send({ t: "room.leave" })
        await host.nextOfType("room.left")

        host.send({ t: "room.join", roomId })
        const rejoined = await host.nextOfType("room.joined")
        expect(rejoined.yourSeat).toBe(0)
        expect(rejoined.room.status).toBe("PLAYING")
        const after = await host.nextOfType("game.state")
        expect(after.view.hand).toEqual(before.view.hand)
        expect(server.lobby.get(roomId)!.holdFor("dev:igrac")).toBeNull()
    })

    it("lets room.joinByCode walk back into your own private room", async () => {
        server = await startTestServer({
            timings: { reconnectGraceMs: 30_000, botThinkMinMs: 100_000, botThinkMaxMs: 100_000 },
        })
        const host = await connect("Igrac")
        host.send({ t: "room.create", name: "Moja", targetScore: 501, private: true })
        const joined = await host.nextOfType("room.joined")
        await addSupportPlayers(joined.room.id, joined.room.code)
        host.send({ t: "room.ready", ready: true })
        await host.next((m) => m.t === "room.state"
            && m.room.seats.filter((s) => s.occupant?.kind === "PLAYER" && s.occupant.ready).length === 3)
        host.send({ t: "room.start" })
        await host.next((m) => m.t === "room.state" && m.room.status === "PLAYING")

        host.send({ t: "room.leave" })
        await host.nextOfType("room.left")

        host.send({ t: "room.joinByCode", code: joined.room.code })
        const back = await host.nextOfType("room.joined")
        expect(back.room.id).toBe(joined.room.id)
        expect(back.yourSeat).toBe(0)
    })

    it("still reconnects a dropped socket into its own room automatically", async () => {
        server = await startTestServer({
            timings: { reconnectGraceMs: 30_000, botThinkMinMs: 100_000, botThinkMaxMs: 100_000 },
        })
        const host = await connect("Igrac")
        const roomId = await startSoloRoom(host)

        await host.close()
        clients.length = 0
        await sleep(50)

        const again = await connect("Igrac")
        const joined = await again.nextOfType("room.joined")
        expect(joined.room.id).toBe(roomId)
        expect(joined.yourSeat).toBe(0)
    })
})

describe("gledanje štihova rides with the room", () => {
    it("defaults to off and reaches every view as no history at all", async () => {
        server = await startTestServer()
        const host = await connect("Igrac")
        host.send({ t: "room.create", name: "Soba", targetScore: 501, private: false })
        const joined = await host.nextOfType("room.joined")
        expect(joined.room.trickReview).toBe("off")

        host.send({ t: "room.ready", ready: true })
        await host.nextOfType("room.state")
        host.send({ t: "room.start" })
        const state = await host.nextOfType("game.state")
        expect(state.view.trickHistory ?? null).toBeNull()
    })

    it("carries 'all' into the running game, with seat attribution", async () => {
        // A short turn deadline lets the server auto-play our own seat too, so
        // the deal runs to a completed trick without the test playing cards.
        server = await startTestServer({ timings: { turnTimeoutMs: 30 } })
        const host = await connect("Igrac")
        host.send({ t: "room.create", name: "Soba", targetScore: 501, private: false, trickReview: "all" })
        const joined = await host.nextOfType("room.joined")
        expect(joined.room.trickReview).toBe("all")

        host.send({ t: "room.ready", ready: true })
        await host.nextOfType("room.state")
        host.send({ t: "room.start" })
        await host.nextOfType("game.state")

        // The bots play the whole deal on their own; wait for a trick to land.
        const withHistory = await host.next(
            (m) => m.t === "game.state" && (m.view.trickHistory?.length ?? 0) > 0,
            4000,
        )
        if (withHistory.t !== "game.state") throw new Error("expected game.state")
        const first = withHistory.view.trickHistory?.[0]
        expect(first?.plays).toHaveLength(4)
        expect(first?.plays.map((p) => p.card)).toEqual(first?.cards)
        expect(first?.plays[0]?.seat).toBe(first?.leader)
    })

    it("rejects a malformed trickReview before creating a room", async () => {
        server = await startTestServer()
        const host = await connect("Igrac")
        host.send({
            t: "room.create",
            targetScore: 501,
            private: false,
            trickReview: "sometimes" as unknown as "all",
        })
        expect((await host.nextOfType("error")).code).toBe("BAD_REQUEST")
        expect(server.roomCount()).toBe(0)
    })
})
