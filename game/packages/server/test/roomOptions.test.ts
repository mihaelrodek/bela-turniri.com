/* `room.setOptions` — the host retunes the room's rules in the LOBBY (README §3).
 *
 * Every "nothing changed" assertion here is made against a LATER broadcast
 * rather than against the absence of one: a refusal that silently wrote the
 * value anyway would still send no `room.state`, so only the next state the
 * server publishes can prove the room really kept its old settings.
 */

import { afterEach, describe, expect, it } from "vitest"
import type { GameServer } from "../src/server.js"
import { startTestServer, TestClient } from "./helpers.js"

let server: GameServer | null = null
const clients: TestClient[] = []

describe("room.setOptions", () => {
    it("lets the host change the target score in the lobby and shows it to every member", async () => {
        server = await startTestServer()
        const host = await connect("Domacin")
        host.send({ t: "room.create", name: "Soba", targetScore: 1001, private: false })
        const joined = await host.nextOfType("room.joined")
        expect(joined.room.targetScore).toBe(1001)

        const guest = await connect("Gost")
        guest.send({ t: "room.join", roomId: joined.room.id })
        await guest.nextOfType("room.joined")

        host.send({ t: "room.setOptions", targetScore: 701 })
        const hostState = await host.next((m) => m.t === "room.state" && m.room.targetScore === 701)
        if (hostState.t !== "room.state") throw new Error("expected room.state")
        expect(hostState.room.id).toBe(joined.room.id)
        // The other member is not merely allowed to find out — the room
        // broadcasts to everyone in it, exactly like `setPrivate`.
        const guestState = await guest.next((m) => m.t === "room.state" && m.room.targetScore === 701)
        expect(guestState.t).toBe("room.state")
    })

    it("republishes the new settings to the lobby list", async () => {
        server = await startTestServer()
        const watcher = await connect("Gledatelj")
        watcher.send({ t: "lobby.subscribe" })
        await watcher.nextOfType("lobby.rooms")

        const host = await connect("Domacin")
        host.send({ t: "room.create", name: "Soba", targetScore: 501, private: false })
        const joined = await host.nextOfType("room.joined")
        await watcher.next((m) => m.t === "lobby.rooms" && m.rooms.some((r) => r.id === joined.room.id))

        host.send({ t: "room.setOptions", gameEndRule: "dosta", noDeclarations: true })
        const listed = await watcher.next(
            (m) => m.t === "lobby.rooms" && m.rooms[0]?.gameEndRule === "dosta",
        )
        if (listed.t !== "lobby.rooms") throw new Error("expected lobby.rooms")
        expect(listed.rooms[0]?.noDeclarations).toBe(true)
    })

    it("refuses a non-host and leaves the room untouched", async () => {
        server = await startTestServer()
        const host = await connect("Domacin")
        host.send({ t: "room.create", name: "Soba", targetScore: 1001, private: false })
        const joined = await host.nextOfType("room.joined")

        const guest = await connect("Gost")
        guest.send({ t: "room.join", roomId: joined.room.id })
        await guest.nextOfType("room.joined")

        guest.send({ t: "room.setOptions", targetScore: 501, trickReview: "all" })
        expect((await guest.nextOfType("error")).code).toBe("NOT_HOST")

        // A change the host IS allowed to make, purely to force a fresh
        // broadcast we can read the rejected fields off.
        host.send({ t: "room.setOptions", allowSpectators: true })
        const state = await host.next((m) => m.t === "room.state" && m.room.allowSpectators)
        if (state.t !== "room.state") throw new Error("expected room.state")
        expect(state.room.targetScore).toBe(1001)
        expect(state.room.trickReview).toBe("off")
    })

    it("refuses a change once the game is running and leaves the room untouched", async () => {
        server = await startTestServer()
        const host = await connect("Domacin")
        host.send({ t: "room.create", name: "Soba", targetScore: 501, private: false })
        await host.nextOfType("room.joined")
        await fillWithBots(host)
        host.send({ t: "room.ready", ready: true })
        await host.next((m) => m.t === "room.state" && m.room.seats[0].occupant?.kind === "PLAYER" && m.room.seats[0].occupant.ready)
        host.send({ t: "room.start" })
        await host.nextOfType("game.state")

        host.send({ t: "room.setOptions", targetScore: 1001, noDeclarations: true })
        expect((await host.nextOfType("error")).code).toBe("ALREADY_STARTED")

        // `setPrivate` still works mid-game (privacy is not a rule of the deal),
        // so it gives us a broadcast that proves the deal's rules held.
        host.send({ t: "room.setPrivate", private: true })
        const state = await host.next((m) => m.t === "room.state" && m.room.private)
        if (state.t !== "room.state") throw new Error("expected room.state")
        expect(state.room.status).toBe("PLAYING")
        expect(state.room.targetScore).toBe(501)
        expect(state.room.noDeclarations).toBe(false)
    })

    it("leaves absent fields alone", async () => {
        server = await startTestServer()
        const host = await connect("Domacin")
        host.send({
            t: "room.create",
            name: "Soba",
            targetScore: 701,
            private: false,
            gameEndRule: "dosta",
            allowSpectators: true,
            noDeclarations: true,
            allowBela: false,
        })
        const joined = await host.nextOfType("room.joined")
        expect(joined.room.trickReview).toBe("off")

        host.send({ t: "room.setOptions", trickReview: "leaderPair" })
        const state = await host.next((m) => m.t === "room.state" && m.room.trickReview === "leaderPair")
        if (state.t !== "room.state") throw new Error("expected room.state")
        expect(state.room.targetScore).toBe(701)
        expect(state.room.gameEndRule).toBe("dosta")
        expect(state.room.allowSpectators).toBe(true)
        expect(state.room.noDeclarations).toBe(true)
        expect(state.room.allowBela).toBe(false)
    })

    it("refuses an invalid target score instead of coercing it", async () => {
        server = await startTestServer()
        const host = await connect("Domacin")
        host.send({ t: "room.create", name: "Soba", targetScore: 1001, private: false })
        await host.nextOfType("room.joined")

        host.send({ t: "room.setOptions", targetScore: 123 as 501 })
        expect((await host.nextOfType("error")).code).toBe("BAD_REQUEST")
        host.send({ t: "room.setOptions", gameEndRule: "krivo" as "prolaz" })
        expect((await host.nextOfType("error")).code).toBe("BAD_REQUEST")
        host.send({ t: "room.setOptions", trickReview: "sve" as "all" })
        expect((await host.nextOfType("error")).code).toBe("BAD_REQUEST")
        host.send({ t: "room.setOptions", allowSpectators: "da" as unknown as boolean })
        expect((await host.nextOfType("error")).code).toBe("BAD_REQUEST")

        host.send({ t: "room.setPrivate", private: true })
        const state = await host.next((m) => m.t === "room.state" && m.room.private)
        if (state.t !== "room.state") throw new Error("expected room.state")
        expect(state.room.targetScore).toBe(1001)
        expect(state.room.gameEndRule).toBe("prolaz")
        expect(state.room.trickReview).toBe("off")
        expect(state.room.allowSpectators).toBe(false)
    })

    it("resolves noDeclarations/allowBela exactly as room.create would", async () => {
        server = await startTestServer()
        // Reference room: created straight away with the pair we are after.
        const reference = await connect("Referenca")
        reference.send({ t: "room.create", name: "Ref", targetScore: 501, private: false, noDeclarations: true, allowBela: false })
        const created = await reference.nextOfType("room.joined")
        expect(created.room.noDeclarations).toBe(true)
        expect(created.room.allowBela).toBe(false)

        // Same pair, reached by editing a default room afterwards.
        const host = await connect("Domacin")
        host.send({ t: "room.create", name: "Soba", targetScore: 501, private: false })
        await host.nextOfType("room.joined")
        host.send({ t: "room.setOptions", noDeclarations: true, allowBela: false })
        const edited = await host.next((m) => m.t === "room.state" && m.room.noDeclarations)
        if (edited.t !== "room.state") throw new Error("expected room.state")
        expect(edited.room.noDeclarations).toBe(created.room.noDeclarations)
        expect(edited.room.allowBela).toBe(created.room.allowBela)

        // And the other half of the rule: with declarations back ON the bela
        // always counts, so a lone `allowBela: false` cannot turn it off —
        // `room.create` ignores it the same way.
        host.send({ t: "room.setOptions", noDeclarations: false, allowBela: false })
        const back = await host.next((m) => m.t === "room.state" && !m.room.noDeclarations)
        if (back.t !== "room.state") throw new Error("expected room.state")
        expect(back.room.allowBela).toBe(true)

        const control = await connect("Kontrola")
        control.send({ t: "room.create", name: "Kontrola", targetScore: 501, private: false, allowBela: false })
        const controlJoined = await control.nextOfType("room.joined")
        expect(controlJoined.room.allowBela).toBe(true)
    })
})

/** Seats 1–3 become bots, so the table is startable. */
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
