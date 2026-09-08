/* ──────────────────────────────────────────────────────────────────────────
   JOINING: a seat if there is one, a clear refusal if there is not
   (README §3 "Soba", §3.2).

   Three faults are pinned here, all of them found with two real accounts:

     1. A second player entered a room with three empty seats and was told
        "sva su mjesta zauzeta". Nothing seated a joiner — sitting was a
        separate `room.sit` the room screen no longer offers — so everyone
        after the host landed seatless at a half-empty table.
     2. "Omogući gledatelje" only gated a room that had already STARTED, so a
        room created without spectators still collected them in the lobby.
     3. The lobby list said nothing about who was in a room and let you click
        into a full one.

   The invariant the first two share is one sentence: **pass `assertCanJoin`
   and you get a seat, or the room genuinely had none and said so.** Both
   halves come from `Room.canAdmitNewcomer()`, which is also what the lobby row
   publishes as `joinable` — the message and the state cannot drift apart
   because there is only one of them.

   WHICH seat is the fourth fault, found the same way: seats alternate teams
   (0+2 vs 1+3), so handing out the lowest free one put the second arrival
   opposite the host and the third beside him — a table that fills "vi, mi, vi,
   mi" instead of finishing a pair. `SEAT_FILL_ORDER` is 0→2→1→3, and the
   assertions below state that order rather than following it.
   ────────────────────────────────────────────────────────────────────── */

import { afterEach, describe, expect, it } from "vitest"
import type { RoomSummary } from "@bela/protocol"
import type { GameServer } from "../src/server.js"
import { startTestServer, TestClient } from "./helpers.js"

let server: GameServer | null = null
const clients: TestClient[] = []

async function connect(devName: string): Promise<TestClient> {
    if (!server) throw new Error("server not started")
    const c = await TestClient.connect(server.url())
    clients.push(c)
    await c.hello(devName)
    return c
}

/** Seats 1–3 become bots: the table is full without a second human. */
async function fillWithBots(host: TestClient): Promise<void> {
    for (const seat of [1, 2, 3] as const) host.send({ t: "room.addBot", seat })
    await host.next((m) => m.t === "room.state" && m.room.seats.every((s) => s.occupant !== null))
}

afterEach(async () => {
    for (const c of clients) await c.close()
    clients.length = 0
    await server?.close()
    server = null
})

describe("a free seat is always given to the joiner", () => {
    it("seats the second player as the host's PARTNER, not as his opponent", async () => {
        server = await startTestServer()
        const host = await connect("Domacin")
        host.send({ t: "room.create", name: "Soba", targetScore: 501, private: false })
        const created = await host.nextOfType("room.joined")
        expect(created.yourSeat).toBe(0)

        const guest = await connect("Gost")
        guest.send({ t: "room.join", roomId: created.room.id })
        const joined = await guest.nextOfType("room.joined")

        // Seat 2, not seat 1: `SEAT_FILL_ORDER` finishes the host's pair first.
        // Seat 1 would seat him ACROSS the table from the host, which is what
        // made a room fill in an order nobody could predict from outside.
        expect(joined.yourSeat).toBe(2)
        expect(joined.room.seats[2].occupant).toMatchObject({ kind: "PLAYER" })
        expect(joined.room.seats[1].occupant).toBeNull()
        // The bug's signature: a seatless member of a half-empty room.
        expect(joined.room.spectators).toEqual([])
        expect(server.lobby.get(created.room.id)!.seatOfUid("dev:gost")).toBe(2)
    })

    it("seats a code-joiner of a private room the same way", async () => {
        server = await startTestServer()
        const host = await connect("Domacin")
        host.send({ t: "room.create", name: "Tajna", targetScore: 501, private: true })
        const created = await host.nextOfType("room.joined")

        const guest = await connect("Gost")
        guest.send({ t: "room.joinByCode", code: created.room.code })
        const joined = await guest.nextOfType("room.joined")
        expect(joined.yourSeat).toBe(2)
    })

    it("fills one pair, then the other — 0, 2, 1, 3 — and only then refuses", async () => {
        server = await startTestServer()
        const host = await connect("Domacin")
        host.send({ t: "room.create", name: "Soba", targetScore: 501, private: false })
        const created = await host.nextOfType("room.joined")

        // The host holds 0. Ana completes his pair (2), Bruno opens the other
        // one (1), Cvita completes it (3) — NOT 1, 2, 3.
        for (const [name, seat] of [["Ana", 2], ["Bruno", 1], ["Cvita", 3]] as const) {
            const player = await connect(name)
            player.send({ t: "room.join", roomId: created.room.id })
            expect((await player.nextOfType("room.joined")).yourSeat).toBe(seat)
        }

        const late = await connect("Zakasnio")
        late.send({ t: "room.join", roomId: created.room.id })
        const err = await late.nextOfType("error")
        expect(err.code).toBe("ROOM_FULL")
        expect(err.ref).toBe("room.join")
    })

    it("never leaves a pair half-built while the other one has two", async () => {
        // The property behind the order, stated without seat numbers: at every
        // head-count the two pairs differ by at most one, so 2 people at a
        // table are always partners and 3 are always a pair plus one.
        server = await startTestServer()
        const host = await connect("Domacin")
        host.send({ t: "room.create", name: "Soba", targetScore: 501, private: false })
        const created = await host.nextOfType("room.joined")
        const room = server.lobby.get(created.room.id)!

        const pairSizes = (): [number, number] => [
            ([0, 2] as const).filter((s) => room.slotAt(s) !== null).length,
            ([1, 3] as const).filter((s) => room.slotAt(s) !== null).length,
        ]
        expect(pairSizes()).toEqual([1, 0])

        for (const [name, expected] of [
            ["Ana", [2, 0]],
            ["Bruno", [2, 1]],
            ["Cvita", [2, 2]],
        ] as const) {
            const player = await connect(name)
            player.send({ t: "room.join", roomId: created.room.id })
            await player.nextOfType("room.joined")
            expect(pairSizes()).toEqual(expected)
        }
    })

    it("takes a seat freed by someone who left", async () => {
        server = await startTestServer()
        const host = await connect("Domacin")
        host.send({ t: "room.create", name: "Soba", targetScore: 501, private: false })
        const created = await host.nextOfType("room.joined")
        await fillWithBots(host)
        host.send({ t: "room.removeBot", seat: 2 })
        await host.next((m) => m.t === "room.state" && m.room.seats[2].occupant === null)

        const guest = await connect("Gost")
        guest.send({ t: "room.join", roomId: created.room.id })
        expect((await guest.nextOfType("room.joined")).yourSeat).toBe(2)
    })
})

describe("spectators off means refused, never silently watching", () => {
    it("refuses a join into a full room with ROOM_FULL", async () => {
        server = await startTestServer()
        const host = await connect("Domacin")
        host.send({ t: "room.create", name: "Soba", targetScore: 501, private: false })
        const created = await host.nextOfType("room.joined")
        expect(created.room.allowSpectators).toBe(false)
        await fillWithBots(host)

        const guest = await connect("Gost")
        guest.send({ t: "room.join", roomId: created.room.id })
        const err = await guest.nextOfType("error")
        expect(err.code).toBe("ROOM_FULL")

        // Refused means refused: no membership, no spectator entry, nothing
        // for the room to contradict its own "Bez gledatelja" badge with.
        const room = server.lobby.get(created.room.id)!
        expect(room.hasConnFor("dev:gost")).toBe(false)
        expect(room.toState().spectators).toEqual([])
    })

    it("refuses the same join by code, with the code accepted", async () => {
        server = await startTestServer()
        const host = await connect("Domacin")
        host.send({ t: "room.create", name: "Tajna", targetScore: 501, private: true })
        const created = await host.nextOfType("room.joined")
        await fillWithBots(host)

        const guest = await connect("Gost")
        guest.send({ t: "room.joinByCode", code: created.room.code })
        const err = await guest.nextOfType("error")
        expect(err.code).toBe("ROOM_FULL")
        expect(err.ref).toBe("room.joinByCode")
    })

    it("admits the same joiner as a spectator once the host allows them", async () => {
        server = await startTestServer()
        const host = await connect("Domacin")
        host.send({ t: "room.create", name: "Soba", targetScore: 501, private: false, allowSpectators: true })
        const created = await host.nextOfType("room.joined")
        await fillWithBots(host)

        const guest = await connect("Gost")
        guest.send({ t: "room.join", roomId: created.room.id })
        const joined = await guest.nextOfType("room.joined")
        expect(joined.yourSeat).toBeNull()
        expect(joined.room.spectators.map((u) => u.uid)).toContain("dev:gost")
    })

    it("refuses standing up in a room that has no spectators", async () => {
        server = await startTestServer()
        const host = await connect("Domacin")
        host.send({ t: "room.create", name: "Soba", targetScore: 501, private: false })
        await host.nextOfType("room.joined")

        host.send({ t: "room.stand" })
        expect((await host.nextOfType("error")).code).toBe("SPECTATORS_DISABLED")
        // Still seated — the seat was not given up on the way to the error.
        host.send({ t: "room.ready", ready: true })
        await host.next((m) => m.t === "room.state" && m.yourSeat === 0)
    })
})

describe("the lobby row says who is in there — and nothing private", () => {
    function rowFor(rooms: RoomSummary[], id: string): RoomSummary {
        const row = rooms.find((r) => r.id === id)
        if (!row) throw new Error("room missing from lobby.rooms")
        return row
    }

    it("carries the occupants by name, bots as bots, empty seats as null", async () => {
        server = await startTestServer()
        const watcher = await connect("Promatrac")
        watcher.send({ t: "lobby.subscribe" })
        await watcher.nextOfType("lobby.rooms")

        const host = await connect("Domacin")
        host.send({ t: "room.create", name: "Soba", targetScore: 501, private: false })
        const created = await host.nextOfType("room.joined")
        host.send({ t: "room.addBot", seat: 3 })
        await host.next((m) => m.t === "room.state" && m.room.seats[3].occupant?.kind === "BOT")

        const update = await watcher.next(
            (m) => m.t === "lobby.rooms" && rowFor(m.rooms, created.room.id).occupants[3] !== null,
        )
        if (update.t !== "lobby.rooms") throw new Error("expected lobby.rooms")
        const row = rowFor(update.rooms, created.room.id)

        expect(row.occupants[0]).toEqual({ kind: "PLAYER", name: "Domacin", connected: true })
        expect(row.occupants[1]).toBeNull()
        expect(row.occupants[2]).toBeNull()
        expect(row.occupants[3]).toEqual({ kind: "BOT", name: "Bot Jana" })
        expect(row.seatsTaken).toBe(2)
        expect(row.humans).toBe(1)
        expect(row.joinable).toBe(true)
    })

    it("never carries a private room's join code or anybody's uid to outsiders", async () => {
        server = await startTestServer()
        const watcher = await connect("Promatrac")
        watcher.send({ t: "lobby.subscribe" })
        await watcher.nextOfType("lobby.rooms")

        const host = await connect("Domacin")
        host.send({ t: "room.create", name: "Tajna", targetScore: 501, private: true })
        const created = await host.nextOfType("room.joined")
        expect(created.room.code).toMatch(/^\d{4}$/)

        const update = await watcher.next((m) => m.t === "lobby.rooms" && m.rooms.length > 0)
        if (update.t !== "lobby.rooms") throw new Error("expected lobby.rooms")
        const row = rowFor(update.rooms, created.room.id)

        expect(row.private).toBe(true)
        expect(row.code).toBe("")
        // Whole-row sweep, so a future field cannot smuggle either one in.
        const serialised = JSON.stringify(row)
        expect(serialised).not.toContain(created.room.code)
        expect(serialised).not.toContain("dev:domacin")
        expect(row).not.toHaveProperty("hostUid")
    })

    it("still gives a member of the private room its code", async () => {
        server = await startTestServer()
        const host = await connect("Domacin")
        host.send({ t: "room.create", name: "Tajna", targetScore: 501, private: true })
        const created = await host.nextOfType("room.joined")
        host.send({ t: "lobby.subscribe" })

        const rooms = await host.next((m) => m.t === "lobby.rooms" && m.rooms.length > 0)
        if (rooms.t !== "lobby.rooms") throw new Error("expected lobby.rooms")
        expect(rowFor(rooms.rooms, created.room.id).code).toBe(created.room.code)
    })

    it("turns joinable off exactly when the server would refuse the join", async () => {
        server = await startTestServer()
        const watcher = await connect("Promatrac")
        watcher.send({ t: "lobby.subscribe" })
        await watcher.nextOfType("lobby.rooms")

        const closedHost = await connect("Zatvoreni")
        closedHost.send({ t: "room.create", name: "Zatvorena", targetScore: 501, private: false })
        const closed = await closedHost.nextOfType("room.joined")
        await fillWithBots(closedHost)

        const openHost = await connect("Otvoreni")
        openHost.send({ t: "room.create", name: "Otvorena", targetScore: 501, private: false, allowSpectators: true })
        const open = await openHost.nextOfType("room.joined")
        await fillWithBots(openHost)

        const update = await watcher.next(
            (m) => m.t === "lobby.rooms"
                && m.rooms.length === 2
                && m.rooms.every((r) => r.seatsTaken === 4),
        )
        if (update.t !== "lobby.rooms") throw new Error("expected lobby.rooms")
        expect(rowFor(update.rooms, closed.room.id).joinable).toBe(false)
        expect(rowFor(update.rooms, open.room.id).joinable).toBe(true)

        // And the flag is the truth, not a hint: the server answers the same.
        const guest = await connect("Gost")
        guest.send({ t: "room.join", roomId: closed.room.id })
        expect((await guest.nextOfType("error")).code).toBe("ROOM_FULL")
        guest.send({ t: "room.join", roomId: open.room.id })
        expect((await guest.nextOfType("room.joined")).yourSeat).toBeNull()
    })
})
