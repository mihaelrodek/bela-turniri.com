import { afterEach, describe, expect, it } from "vitest"
import type { GameServer } from "../src/server.js"
import { startTestServer, TestClient } from "./helpers.js"

let server: GameServer | null = null
const clients: TestClient[] = []

describe("room visibility and rules", () => {
    it("lists private rooms without exposing their code and requires the code for entry", async () => {
        server = await startTestServer()
        const watcher = await connect("Watcher")
        watcher.send({ t: "lobby.subscribe" })
        await watcher.nextOfType("lobby.rooms")
        const host = await connect("Host")
        host.send({ t: "room.create", targetScore: 1001, private: false })
        const joined = await host.nextOfType("room.joined")
        expect(joined.room.code).toBe("")
        expect(joined.room.allowSpectators).toBe(false)
        expect(joined.room.noDeclarations).toBe(false)
        expect(joined.room.allowBela).toBe(true)
        await watcher.next((m) => m.t === "lobby.rooms" && m.rooms.some((r) => r.id === joined.room.id))
        host.send({ t: "room.setPrivate", private: true })
        const privateState = await host.next((m) => m.t === "room.state" && m.room.private)
        if (privateState.t !== "room.state") throw new Error("expected room")
        expect(privateState.room.code).toMatch(/^\d{4}$/)

        const listed = await watcher.next((m) => m.t === "lobby.rooms" && m.rooms[0]?.private === true)
        if (listed.t !== "lobby.rooms") throw new Error("expected lobby")
        expect(listed.rooms[0]?.id).toBe(joined.room.id)
        expect(listed.rooms[0]?.code).toBe("")

        watcher.send({ t: "room.join", roomId: joined.room.id })
        expect((await watcher.nextOfType("error")).code).toBe("ROOM_CODE_REQUIRED")
        watcher.send({ t: "room.joinByCode", code: privateState.room.code })
        expect((await watcher.nextOfType("room.joined")).room.id).toBe(joined.room.id)
    })

    it("rejects privacy changes from a guest", async () => {
        server = await startTestServer()
        const host = await connect("Host")
        host.send({ t: "room.create", targetScore: 501, private: true })
        const joined = await host.nextOfType("room.joined")
        const guest = await connect("Guest")
        guest.send({ t: "room.joinByCode", code: joined.room.code })
        await guest.nextOfType("room.joined")
        guest.send({ t: "room.setPrivate", private: false })
        expect((await guest.nextOfType("error")).code).toBe("NOT_HOST")
    })

    it("carries no-declaration rules into a running game and permits changing privacy", async () => {
        server = await startTestServer()
        const host = await connect("Host")
        host.send({ t: "room.create", targetScore: 501, private: false, noDeclarations: true, allowBela: false })
        const joined = await host.nextOfType("room.joined")
        expect(joined.room.noDeclarations).toBe(true)
        expect(joined.room.allowBela).toBe(false)
        host.send({ t: "room.ready", ready: true })
        await host.next((m) => m.t === "room.state" && m.room.seats[0].occupant?.kind === "PLAYER" && m.room.seats[0].occupant.ready)
        host.send({ t: "room.start" })
        const state = await host.nextOfType("game.state")
        expect(state.view.phase).toBe("BIDDING")
        host.send({ t: "room.setPrivate", private: true })
        const changed = await host.next((m) => m.t === "room.state" && m.room.status === "PLAYING" && m.room.private)
        if (changed.t !== "room.state") throw new Error("expected room")
        expect(changed.room.code).toMatch(/^\d{4}$/)
        for (const slot of changed.room.seats) {
            if (slot.occupant?.kind === "BOT") expect(slot.occupant.name).toMatch(/^Bot /)
        }
    })

    it("rejects malformed rules before creating a room", async () => {
        server = await startTestServer()
        const host = await connect("Host")
        host.send({ t: "room.create", targetScore: 501, private: false, noDeclarations: "yes" as unknown as boolean })
        expect((await host.nextOfType("error")).code).toBe("BAD_REQUEST")
        expect(server.roomCount()).toBe(0)
        host.send({ t: "room.create", targetScore: 501, private: false, allowSpectators: "yes" as unknown as boolean })
        expect((await host.nextOfType("error")).code).toBe("BAD_REQUEST")
        expect(server.roomCount()).toBe(0)
    })

    it("blocks unknown spectators by default and admits them only when enabled", async () => {
        server = await startTestServer()
        const host = await connect("BezGledatelja")
        host.send({ t: "room.create", targetScore: 501, private: false })
        const closed = await host.nextOfType("room.joined")
        // Fill the table first: with a free seat the newcomer would simply be
        // SEATED, and the spectator rule would never come into it.
        await fillWithBots(host)

        const stranger = await connect("Nepoznati")
        stranger.send({ t: "room.join", roomId: closed.room.id })
        expect((await stranger.nextOfType("error")).code).toBe("ROOM_FULL")

        host.send({ t: "room.ready", ready: true })
        await host.next((m) => m.t === "room.state" && m.room.seats[0].occupant?.kind === "PLAYER" && m.room.seats[0].occupant.ready)
        host.send({ t: "room.start" })
        await host.nextOfType("game.state")

        stranger.send({ t: "room.join", roomId: closed.room.id })
        expect((await stranger.nextOfType("error")).code).toBe("SPECTATORS_DISABLED")

        const openHost = await connect("SGledateljima")
        openHost.send({ t: "room.create", targetScore: 501, private: false, allowSpectators: true })
        const open = await openHost.nextOfType("room.joined")
        expect(open.room.allowSpectators).toBe(true)
        await fillWithBots(openHost)
        openHost.send({ t: "room.ready", ready: true })
        await openHost.next((m) => m.t === "room.state" && m.room.seats[0].occupant?.kind === "PLAYER" && m.room.seats[0].occupant.ready)
        openHost.send({ t: "room.start" })
        await openHost.nextOfType("game.state")

        stranger.send({ t: "room.join", roomId: open.room.id })
        const watching = await stranger.nextOfType("room.joined")
        expect(watching.yourSeat).toBeNull()
    })
})

/** Seats 1–3 become bots, so the table has no room for a newcomer. */
async function fillWithBots(host: TestClient): Promise<void> {
    for (const seat of [1, 2, 3] as const) host.send({ t: "room.addBot", seat })
    await host.next((m) => m.t === "room.state" && m.room.seats.every((s) => s.occupant !== null))
}

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
        expect(summary?.status).toBe("LOBBY")
        expect(summary?.humans).toBe(1)
        expect(summary?.seatsTaken).toBe(1)
        expect(server.roomCount()).toBe(1)
        // No uid on the public row: `lobby.rooms` goes to everyone.
        expect(summary).not.toHaveProperty("hostUid")
    })

    it("removes a lobby immediately when its last human explicitly leaves bots behind", async () => {
        server = await startTestServer()
        const watcher = await connect("Gledatelj")
        watcher.send({ t: "lobby.subscribe" })
        await watcher.nextOfType("lobby.rooms")

        const host = await connect("Domacin")
        host.send({ t: "room.create", name: "Prazan stol", targetScore: 501, private: false })
        const joined = await host.nextOfType("room.joined")
        host.send({ t: "room.addBot", seat: 1 })
        await host.next((m) => m.t === "room.state" && m.room.seats[1].occupant?.kind === "BOT")
        await watcher.next((m) => m.t === "lobby.rooms" && m.rooms.some((r) => r.id === joined.room.id))

        host.send({ t: "room.leave" })
        await host.nextOfType("room.left")
        expect(server.roomCount()).toBe(0)

        const update = await watcher.next((m) => m.t === "lobby.rooms" && m.rooms.length === 0)
        if (update.t !== "lobby.rooms") throw new Error("unexpected")
        expect(update.rooms).toEqual([])
    })

    it("shows private rooms to other subscribers without their code", async () => {
        server = await startTestServer()
        const watcher = await connect("Gledatelj")
        watcher.send({ t: "lobby.subscribe" })
        await watcher.nextOfType("lobby.rooms")

        const host = await connect("Domacin")
        host.send({ t: "room.create", name: "Tajna", targetScore: 501, private: true })
        const joined = await host.nextOfType("room.joined")

        const update = await watcher.next((m) => m.t === "lobby.rooms" && m.rooms.length > 0)
        if (update.t !== "lobby.rooms") throw new Error("unexpected")
        expect(update.rooms[0]).toMatchObject({ id: joined.room.id, private: true, code: "" })
    })
})

describe("room code and name", () => {
    it("assigns a unique 4-digit code to private rooms", async () => {
        server = await startTestServer()
        const host = await connect("Domacin")
        host.send({ t: "room.create", name: "Soba", targetScore: 501, private: true })
        const joined = await host.nextOfType("room.joined")
        expect(joined.room.code).toMatch(/^\d{4}$/)

        const host2 = await connect("Domacin2")
        host2.send({ t: "room.create", name: "Soba 2", targetScore: 501, private: true })
        const joined2 = await host2.nextOfType("room.joined")
        expect(joined2.room.code).toMatch(/^\d{4}$/)
        expect(joined2.room.code).not.toBe(joined.room.code)
    })

    it("auto-generates a two-word Croatian name when none is given", async () => {
        server = await startTestServer()
        const host = await connect("Domacin")
        host.send({ t: "room.create", targetScore: 501, private: false })
        const joined = await host.nextOfType("room.joined")
        expect(joined.room.name).toMatch(/^[a-zčćđšž]+-[a-zčćđšž]+$/)
    })

    it("auto-generates a name when the given one is blank", async () => {
        server = await startTestServer()
        const host = await connect("Domacin")
        host.send({ t: "room.create", name: "   ", targetScore: 501, private: false })
        const joined = await host.nextOfType("room.joined")
        expect(joined.room.name).toMatch(/^[a-zčćđšž]+-[a-zčćđšž]+$/)
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
        // A real spectator needs both halves: no seat left to auto-take, and a
        // room that allows watching.
        host.send({ t: "room.create", name: "Soba", targetScore: 501, private: false, allowSpectators: true })
        const joined = await host.nextOfType("room.joined")
        await fillWithBots(host)

        const guest = await connect("Gost")
        guest.send({ t: "room.join", roomId: joined.room.id })
        expect((await guest.nextOfType("room.joined")).yourSeat).toBeNull()

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

    it("refuses a taken seat and lets a seated player move elsewhere", async () => {
        server = await startTestServer()
        const host = await connect("Domacin")
        host.send({ t: "room.create", name: "Soba", targetScore: 501, private: false })
        const joined = await host.nextOfType("room.joined")
        const roomId = joined.room.id

        const guest = await connect("Gost")
        guest.send({ t: "room.join", roomId })
        const guestJoined = await guest.nextOfType("room.joined")
        // Joining a lobby with free seats seats you; nobody waits in the wings.
        // Seat 2 — `SEAT_FILL_ORDER` completes the host's pair first.
        expect(guestJoined.yourSeat).toBe(2)
        expect(guestJoined.room.spectators).toEqual([])

        guest.send({ t: "room.sit", seat: 0 })
        const err = await guest.nextOfType("error")
        expect(err.code).toBe("SEAT_TAKEN")

        // Moving to a seat that is NOT the one he was auto-seated into, so the
        // move is a real move and not a no-op.
        guest.send({ t: "room.sit", seat: 1 })
        const state = await guest.next(
            (m) => m.t === "room.state" && m.yourSeat === 1,
        )
        if (state.t !== "room.state") throw new Error("unexpected")
        expect(state.room.seats[1]?.occupant?.kind).toBe("PLAYER")
        expect(state.room.seats[2]?.occupant).toBeNull()
    })

    it("only the host may add bots or start", async () => {
        server = await startTestServer()
        const host = await connect("Domacin")
        host.send({ t: "room.create", name: "Soba", targetScore: 501, private: false })
        const joined = await host.nextOfType("room.joined")

        const guest = await connect("Gost")
        guest.send({ t: "room.join", roomId: joined.room.id })
        await guest.nextOfType("room.joined")

        guest.send({ t: "room.addBot", seat: 1 })
        expect((await guest.nextOfType("error")).code).toBe("NOT_HOST")

        guest.send({ t: "room.start" })
        expect((await guest.nextOfType("error")).code).toBe("NOT_HOST")
    })

    it("adds and removes bots", async () => {
        server = await startTestServer()
        const host = await connect("Domacin")
        host.send({ t: "room.create", name: "Soba", targetScore: 501, private: false })
        await host.nextOfType("room.joined")

        host.send({ t: "room.addBot", seat: 1 })
        const withBot = await host.next(
            (m) => m.t === "room.state" && m.room.seats[1]?.occupant?.kind === "BOT",
        )
        if (withBot.t !== "room.state") throw new Error("unexpected")
        const occupant = withBot.room.seats[1]?.occupant
        expect(occupant?.kind).toBe("BOT")
        if (occupant?.kind === "BOT") {
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
        // Standing up means becoming a spectator, so it needs a room that has
        // them — otherwise "Bez gledatelja" and the room's own state disagree.
        host.send({ t: "room.create", name: "Soba", targetScore: 501, private: false, allowSpectators: true })
        await host.nextOfType("room.joined")
        host.send({ t: "room.stand" })
        await host.nextOfType("room.state")
        host.send({ t: "room.start" })
        const err = await host.nextOfType("error")
        expect(err.code).toBe("NOT_ENOUGH_PLAYERS")
    })

    it("fills every empty seat with a strong bot and deals", async () => {
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
            if (occupant?.kind === "BOT") expect(occupant.name).toMatch(/^Bot /)
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
