import { afterEach, describe, expect, it } from "vitest"
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

afterEach(async () => {
    for (const c of clients) await c.close()
    clients.length = 0
    await server?.close()
    server = null
})

describe("lobby", () => {
    it("broadcasts rooms to subscribers after a create", async () => {
        server = await startTestServer()
        const watcher = await connect("Gledatelj")
        watcher.send({ t: "lobby.subscribe" })
        const first = await watcher.nextOfType("lobby.rooms")
        expect(first.rooms).toEqual([])

        const host = await connect("Domacin")
        host.send({ t: "room.create", name: "Bela večer", targetScore: 1001, private: false })
        await host.nextOfType("room.joined")

        const update = await watcher.next((m) => m.t === "lobby.rooms" && m.rooms.length > 0)
        if (update.t !== "lobby.rooms") throw new Error("unexpected")
        expect(update.rooms).toHaveLength(1)
        const summary = update.rooms[0]
        expect(summary?.name).toBe("Bela večer")
        expect(summary?.hostUid).toBe("dev:domacin")
        expect(summary?.status).toBe("LOBBY")
        expect(summary?.humans).toBe(1)
        expect(summary?.seatsTaken).toBe(1)
        expect(server.roomCount()).toBe(1)
    })

    it("hides private rooms from other subscribers", async () => {
        server = await startTestServer()
        const watcher = await connect("Gledatelj")
        watcher.send({ t: "lobby.subscribe" })
        await watcher.nextOfType("lobby.rooms")

        const host = await connect("Domacin")
        host.send({ t: "room.create", name: "Tajna", targetScore: 501, private: true })
        await host.nextOfType("room.joined")

        // give the debounced broadcast a chance, then assert nothing showed up
        await new Promise((r) => setTimeout(r, 60))
        const withRooms = watcher.received.filter(
            (m) => m.t === "lobby.rooms" && m.rooms.length > 0,
        )
        expect(withRooms).toHaveLength(0)
    })
})

describe("room code and name", () => {
    it("assigns a unique 4-digit code to every room", async () => {
        server = await startTestServer()
        const host = await connect("Domacin")
        host.send({ t: "room.create", name: "Soba", targetScore: 501, private: false })
        const joined = await host.nextOfType("room.joined")
        expect(joined.room.code).toMatch(/^\d{4}$/)

        const host2 = await connect("Domacin2")
        host2.send({ t: "room.create", name: "Soba 2", targetScore: 501, private: false })
        const joined2 = await host2.nextOfType("room.joined")
        expect(joined2.room.code).toMatch(/^\d{4}$/)
        expect(joined2.room.code).not.toBe(joined.room.code)
    })

    it("auto-generates a two-word Croatian name when none is given", async () => {
        server = await startTestServer()
        const host = await connect("Domacin")
        host.send({ t: "room.create", targetScore: 501, private: false })
        const joined = await host.nextOfType("room.joined")
        expect(joined.room.name).toMatch(/^[a-z]+-[a-z]+$/)
    })

    it("auto-generates a name when the given one is blank", async () => {
        server = await startTestServer()
        const host = await connect("Domacin")
        host.send({ t: "room.create", name: "   ", targetScore: 501, private: false })
        const joined = await host.nextOfType("room.joined")
        expect(joined.room.name).toMatch(/^[a-z]+-[a-z]+$/)
    })

    it("keeps a given non-blank name as-is", async () => {
        server = await startTestServer()
        const host = await connect("Domacin")
        host.send({ t: "room.create", name: "Bela večer", targetScore: 501, private: false })
        const joined = await host.nextOfType("room.joined")
        expect(joined.room.name).toBe("Bela večer")
    })
})

describe("room.joinByCode", () => {
    it("joins a room by its code, including a private one", async () => {
        server = await startTestServer()
        const host = await connect("Domacin")
        host.send({ t: "room.create", name: "Tajna", targetScore: 501, private: true })
        const joined = await host.nextOfType("room.joined")
        const code = joined.room.code

        const guest = await connect("Gost")
        guest.send({ t: "room.joinByCode", code })
        const guestJoined = await guest.nextOfType("room.joined")
        expect(guestJoined.room.id).toBe(joined.room.id)
        expect(guestJoined.room.name).toBe("Tajna")
    })

    it("404s an unknown code", async () => {
        server = await startTestServer()
        const guest = await connect("Gost")
        guest.send({ t: "room.joinByCode", code: "0000" })
        const err = await guest.nextOfType("error")
        expect(err.code).toBe("ROOM_NOT_FOUND")
    })
})

describe("chat.react", () => {
    it("broadcasts a reaction with the sender's seat and rate-limits a fast repeat", async () => {
        server = await startTestServer()
        const host = await connect("Domacin")
        host.send({ t: "room.create", name: "Soba", targetScore: 501, private: false })
        const joined = await host.nextOfType("room.joined")

        const guest = await connect("Gost")
        guest.send({ t: "room.join", roomId: joined.room.id })
        await guest.nextOfType("room.joined")

        host.send({ t: "chat.react", reaction: "🔥" })
        const reaction = await guest.nextOfType("chat.reaction")
        expect(reaction.reaction).toBe("🔥")
        expect(reaction.from.uid).toBe("dev:domacin")
        expect(reaction.seat).toBe(0)

        host.send({ t: "chat.react", reaction: "🎉" })
        const err = await host.nextOfType("error")
        expect(err.code).toBe("RATE_LIMITED")
    })

    it("reports the sender's seat as null when spectating", async () => {
        server = await startTestServer()
        const host = await connect("Domacin")
        host.send({ t: "room.create", name: "Soba", targetScore: 501, private: false })
        const joined = await host.nextOfType("room.joined")

        const guest = await connect("Gost")
        guest.send({ t: "room.join", roomId: joined.room.id })
        await guest.nextOfType("room.joined")

        guest.send({ t: "chat.react", reaction: "😢" })
        const reaction = await host.nextOfType("chat.reaction")
        expect(reaction.seat).toBeNull()
    })
})

describe("room seats", () => {
    it("auto-seats the creator at seat 0 as host", async () => {
        server = await startTestServer()
        const host = await connect("Domacin")
        host.send({ t: "room.create", name: "Soba", targetScore: 501, private: false })
        const joined = await host.nextOfType("room.joined")
        expect(joined.yourSeat).toBe(0)
        expect(joined.room.hostUid).toBe("dev:domacin")
        expect(joined.room.seats[0]?.occupant?.kind).toBe("PLAYER")
        expect(joined.room.seats[1]?.occupant).toBeNull()
    })

    it("refuses a taken seat and lets a spectator sit elsewhere", async () => {
        server = await startTestServer()
        const host = await connect("Domacin")
        host.send({ t: "room.create", name: "Soba", targetScore: 501, private: false })
        const joined = await host.nextOfType("room.joined")
        const roomId = joined.room.id

        const guest = await connect("Gost")
        guest.send({ t: "room.join", roomId })
        const guestJoined = await guest.nextOfType("room.joined")
        expect(guestJoined.yourSeat).toBeNull()
        expect(guestJoined.room.spectators.map((u) => u.uid)).toContain("dev:gost")

        guest.send({ t: "room.sit", seat: 0 })
        const err = await guest.nextOfType("error")
        expect(err.code).toBe("SEAT_TAKEN")

        guest.send({ t: "room.sit", seat: 2 })
        const state = await guest.next(
            (m) => m.t === "room.state" && m.yourSeat === 2,
        )
        if (state.t !== "room.state") throw new Error("unexpected")
        expect(state.room.seats[2]?.occupant?.kind).toBe("PLAYER")
    })

    it("only the host may add bots or start", async () => {
        server = await startTestServer()
        const host = await connect("Domacin")
        host.send({ t: "room.create", name: "Soba", targetScore: 501, private: false })
        const joined = await host.nextOfType("room.joined")

        const guest = await connect("Gost")
        guest.send({ t: "room.join", roomId: joined.room.id })
        await guest.nextOfType("room.joined")

        guest.send({ t: "room.addBot", seat: 1, level: "lako" })
        expect((await guest.nextOfType("error")).code).toBe("NOT_HOST")

        guest.send({ t: "room.start" })
        expect((await guest.nextOfType("error")).code).toBe("NOT_HOST")
    })

    it("adds and removes bots by level", async () => {
        server = await startTestServer()
        const host = await connect("Domacin")
        host.send({ t: "room.create", name: "Soba", targetScore: 501, private: false })
        await host.nextOfType("room.joined")

        host.send({ t: "room.addBot", seat: 1, level: "lako" })
        const withBot = await host.next(
            (m) => m.t === "room.state" && m.room.seats[1]?.occupant?.kind === "BOT",
        )
        if (withBot.t !== "room.state") throw new Error("unexpected")
        const occupant = withBot.room.seats[1]?.occupant
        expect(occupant?.kind).toBe("BOT")
        if (occupant?.kind === "BOT") {
            expect(occupant.level).toBe("lako")
            expect(occupant.name).toBe("Bot Ana")
        }

        host.send({ t: "room.removeBot", seat: 1 })
        const cleared = await host.next(
            (m) => m.t === "room.state" && m.room.seats[1]?.occupant === null,
        )
        expect(cleared.t).toBe("room.state")
    })
})

describe("room start", () => {
    it("refuses to start when the seated human is not ready", async () => {
        server = await startTestServer()
        const host = await connect("Domacin")
        host.send({ t: "room.create", name: "Soba", targetScore: 501, private: false })
        await host.nextOfType("room.joined")
        host.send({ t: "room.start" })
        const err = await host.nextOfType("error")
        expect(err.code).toBe("BAD_REQUEST")
        expect(err.message).toContain("spremni")
    })

    it("refuses to start with nobody seated", async () => {
        server = await startTestServer()
        const host = await connect("Domacin")
        host.send({ t: "room.create", name: "Soba", targetScore: 501, private: false })
        await host.nextOfType("room.joined")
        host.send({ t: "room.stand" })
        await host.nextOfType("room.state")
        host.send({ t: "room.start" })
        const err = await host.nextOfType("error")
        expect(err.code).toBe("NOT_ENOUGH_PLAYERS")
    })

    it("fills every empty seat with a srednje bot and deals", async () => {
        server = await startTestServer()
        const host = await connect("Domacin")
        host.send({ t: "room.create", name: "Soba", targetScore: 501, private: false })
        await host.nextOfType("room.joined")
        host.send({ t: "room.ready", ready: true })
        await host.nextOfType("room.state")
        host.send({ t: "room.start" })

        const playing = await host.next(
            (m) => m.t === "room.state" && m.room.status === "PLAYING",
        )
        if (playing.t !== "room.state") throw new Error("unexpected")
        expect(playing.yourSeat).toBe(0)
        for (const seat of [1, 2, 3] as const) {
            const occupant = playing.room.seats[seat]?.occupant
            expect(occupant?.kind).toBe("BOT")
            if (occupant?.kind === "BOT") expect(occupant.level).toBe("srednje")
        }

        const state = await host.nextOfType("game.state")
        expect(state.view.seat).toBe(0)
        expect(state.view.phase).toBe("BIDDING")
        expect(state.view.hand).toHaveLength(6)
        expect(state.view.handSizes[1]).toBe(6)

        // starting twice is refused
        host.send({ t: "room.start" })
        const err = await host.nextOfType("error")
        expect(err.code).toBe("ALREADY_STARTED")
    })
})
