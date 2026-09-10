/* The in-game name over the socket (`profile.setName`) — the guest half of it
   especially, since a guest has no bearer token to reach the app's REST API
   with and this is the ONLY way they can be renamed. */

import { describe, expect, it } from "vitest"
import type { ProfileLookup, SetGameNameResult } from "../src/profiles.js"
import { startTestServer, TestClient } from "./helpers.js"

function stubProfiles(setGameName: (uid: string, name: string) => Promise<SetGameNameResult>): ProfileLookup {
    return { get: async () => null, setGameName }
}

describe("profile.setName", () => {
    it("renames the seat, tells the room, and answers with the next allowed instant", async () => {
        const nextChangeAt = Date.now() + 7 * 24 * 60 * 60 * 1000
        const server = await startTestServer({
            profiles: stubProfiles(async (_uid, name) => ({ ok: true, name, nextChangeAt })),
        })
        const client = await TestClient.connect(server.url())
        try {
            client.send({ t: "hello", v: 1, devName: "Ana" })
            await client.nextOfType("hello.ok")
            client.send({ t: "room.create", targetScore: 501, private: false })
            const joined = await client.nextOfType("room.joined")

            client.send({ t: "profile.setName", name: "  Pero  " })
            const reply = await client.nextOfType("profile.name")
            expect(reply.name).toBe("Pero")
            expect(reply.nextChangeAt).toBe(nextChangeAt)

            // The room broadcasts its own copies of the seats, so the table
            // catches up without a message of its own.
            const state = await client.nextOfType("room.state")
            const seat = state.room.seats[joined.yourSeat!].occupant
            expect(seat?.kind === "PLAYER" && seat.user.name).toBe("Pero")
        } finally { await client.close(); await server.close() }
    })

    it("sends the standing name with the deadline BEFORE refusing a second change", async () => {
        // An error frame has nowhere to carry a timestamp, so a client that
        // only heard "no" could not tell the player when to come back.
        const nextChangeAt = Date.now() + 60_000
        const server = await startTestServer({
            profiles: stubProfiles(async () => ({ ok: false, error: "RATE_LIMITED", nextChangeAt })),
        })
        const client = await TestClient.connect(server.url())
        try {
            client.send({ t: "hello", v: 1, devName: "Ana" })
            await client.nextOfType("hello.ok")
            client.send({ t: "profile.setName", name: "Pero" })
            const reply = await client.nextOfType("profile.name")
            expect(reply.name).toBe("Ana")
            expect(reply.nextChangeAt).toBe(nextChangeAt)
            const error = await client.nextOfType("error")
            expect(error.code).toBe("NAME_RATE_LIMITED")
            expect(error.ref).toBe("profile.setName")
        } finally { await client.close(); await server.close() }
    })

    it("refuses a name the protocol cannot carry without asking the backend", async () => {
        let asked = 0
        const server = await startTestServer({
            profiles: stubProfiles(async (_uid, name) => { asked += 1; return { ok: true, name, nextChangeAt: 0 } }),
        })
        const client = await TestClient.connect(server.url())
        try {
            client.send({ t: "hello", v: 1, devName: "Ana" })
            await client.nextOfType("hello.ok")
            for (const name of ["   ", "x".repeat(17)]) {
                client.send({ t: "profile.setName", name })
                expect((await client.nextOfType("error")).code).toBe("BAD_REQUEST")
            }
            expect(asked).toBe(0)
        } finally { await client.close(); await server.close() }
    })
})
