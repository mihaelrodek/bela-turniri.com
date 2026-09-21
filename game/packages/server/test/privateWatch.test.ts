/* A PRIVATE room that allows spectators can be WATCHED without its code once
 * the game runs (owner, 2026-09-21) — and only watched: sitting still needs
 * the code, and the code itself must never reach a spectator.
 */

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

/** A private room with three bots and a running game; returns host + room id + code. */
async function runningPrivateRoom(allowSpectators: boolean) {
    server = await startTestServer()
    const host = await connect("Domacin")
    host.send({ t: "room.create", name: "Soba", targetScore: 501, private: true, allowSpectators })
    const joined = await host.nextOfType("room.joined")
    for (const seat of [1, 2, 3] as const) host.send({ t: "room.addBot", seat })
    host.send({ t: "room.ready", ready: true })
    await host.next((m) => m.t === "room.state" && m.room.seats[0].occupant?.kind === "PLAYER" && m.room.seats[0].occupant.ready)
    host.send({ t: "room.start" })
    await host.nextOfType("game.state")
    return { host, roomId: joined.room.id, code: joined.room.code }
}

describe("watching a running private game", () => {
    it("lets a stranger in without the code when spectators are allowed — and does not hand them the code", async () => {
        const { roomId, code } = await runningPrivateRoom(true)
        expect(code).not.toBe("")

        const stranger = await connect("Prolaznik")
        stranger.send({ t: "room.join", roomId })
        const joined = await stranger.nextOfType("room.joined")
        expect(joined.yourSeat).toBeNull()
        expect(joined.room.code).toBe("")

        // Nor through the lobby list…
        stranger.send({ t: "lobby.subscribe" })
        const list = await stranger.nextOfType("lobby.rooms")
        expect(list.rooms.find((r) => r.id === roomId)?.code).toBe("")

        // …nor in a later broadcast.
        const host = clients[0] as TestClient
        host.send({ t: "room.setPrivate", private: true })
        const state = await stranger.nextOfType("room.state")
        expect(state.room.code).toBe("")
    })

    it("still asks for the code when spectators are NOT allowed", async () => {
        const { roomId } = await runningPrivateRoom(false)
        const stranger = await connect("Prolaznik")
        stranger.send({ t: "room.join", roomId })
        const error = await stranger.nextOfType("error")
        expect(["ROOM_CODE_REQUIRED", "SPECTATORS_DISABLED"]).toContain(error.code)
    })

    it("still asks for the code in the WAITING room, spectators allowed or not", async () => {
        server = await startTestServer()
        const host = await connect("Domacin")
        host.send({ t: "room.create", name: "Soba", targetScore: 501, private: true, allowSpectators: true })
        const joined = await host.nextOfType("room.joined")

        const stranger = await connect("Prolaznik")
        stranger.send({ t: "room.join", roomId: joined.room.id })
        expect((await stranger.nextOfType("error")).code).toBe("ROOM_CODE_REQUIRED")
    })

    it("keeps sending the code to the people who hold a seat", async () => {
        const { host, code } = await runningPrivateRoom(true)
        host.send({ t: "room.setPrivate", private: true })
        const state = await host.nextOfType("room.state")
        expect(state.room.code).toBe(code)
    })
})

afterEach(async () => {
    for (const c of clients) await c.close()
    clients.length = 0
    if (server) await server.close()
    server = null
})
