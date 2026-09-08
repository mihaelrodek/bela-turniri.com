import { describe, expect, it } from "vitest"
import { createAuthenticator } from "../src/auth.js"
import { loadConfig } from "../src/config.js"
import { startTestServer, TestClient } from "./helpers.js"

describe("guest identity", () => {
    const auth = createAuthenticator(loadConfig({}, { devAllowAnon: false }))
    const guest = { name: "Ana", secret: "ab".repeat(32) }
    it("supports production guests and stable reconnect identities without sharing their secret", async () => {
        const first = await auth.authenticate({ guest })
        expect(first.guest).toBe(true)
        expect(first.uid).toMatch(/^guest:[a-f0-9]{64}$/)
        expect(JSON.stringify(first)).not.toContain(guest.secret)
        expect(await auth.authenticate({ guest })).toEqual(first)
        expect((await auth.authenticate({ guest: { ...guest, secret: "cd".repeat(32) } })).uid).not.toBe(first.uid)
        expect((await auth.authenticate({ guest: { ...guest, name: "Novo ime" } })).uid).toBe(first.uid)
    })
    it("rejects blank names, weak secrets and invalid account tokens instead of falling back to guest", async () => {
        await expect(auth.authenticate({ guest: { ...guest, name: " " } })).rejects.toThrow()
        await expect(auth.authenticate({ guest: { ...guest, secret: "Ana" } })).rejects.toThrow()
        await expect(auth.authenticate({ token: "invalid", guest })).rejects.toThrow()
        await expect(auth.authenticate({ devName: "Ana" })).rejects.toThrow()
    })
    it("lets a guest create a room and recover the same seat after reconnecting", async () => {
        const server = await startTestServer({ env: { GAME_LOG_LEVEL: "error" } })
        const clients: TestClient[] = []
        try {
            const one = await TestClient.connect(server.url()); clients.push(one)
            one.send({ t: "hello", v: 1, guest })
            const hello = await one.nextOfType("hello.ok")
            one.send({ t: "room.create", targetScore: 501, private: false })
            const joined = await one.nextOfType("room.joined")
            const two = await TestClient.connect(server.url()); clients.push(two)
            two.send({ t: "hello", v: 1, guest })
            expect((await two.nextOfType("hello.ok")).user.uid).toBe(hello.user.uid)
            const recovered = await two.nextOfType("room.joined")
            expect(recovered.room.id).toBe(joined.room.id)
            expect(recovered.yourSeat).toBe(joined.yourSeat)
        } finally { for (const client of clients) await client.close(); await server.close() }
    })
})
