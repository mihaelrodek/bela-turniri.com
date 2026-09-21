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
    it("lets a stored in-game name outrank the name the browser still holds", async () => {
        // The whole point of the guest uid being a hash of a per-device secret:
        // a guest who renamed themselves cannot get the old name back by
        // clearing it out of localStorage and typing a fresh one, which is what
        // makes the once-a-week limit mean anything for them.
        const named = createAuthenticator(loadConfig({}, { devAllowAnon: false }), {
            get: async () => ({ displayName: null, avatarUrl: null, gameName: "Pero", avatarPreset: null }),
            setGameName: async () => ({ ok: false, error: "UNAVAILABLE" }),
        })
        const user = await named.authenticate({ guest: { ...guest, name: "Ana" } })
        expect(user.name).toBe("Pero")
        expect(user.guest).toBe(true)
    })
    it("rejects blank names, weak secrets and invalid account tokens instead of falling back to guest", async () => {
        await expect(auth.authenticate({ guest: { ...guest, name: " " } })).rejects.toThrow()
        await expect(auth.authenticate({ guest: { ...guest, secret: "Ana" } })).rejects.toThrow()
        await expect(auth.authenticate({ token: "invalid", guest })).rejects.toThrow()
        await expect(auth.authenticate({ devName: "Ana" })).rejects.toThrow()
    })

    it("rejects an offensive guest name — it was just typed, so there is a form to send it back to (moderation, 2026-09-20)", async () => {
        for (const name of ["pička", "p i c k a", "KURAC"]) {
            await expect(auth.authenticate({ guest: { ...guest, name } })).rejects.toMatchObject({ code: "BAD_REQUEST" })
        }
        // A name that merely CONTAINS an allowlisted real surname alongside an
        // ordinary word must still pass.
        await expect(auth.authenticate({ guest: { ...guest, name: "Ivo Picula" } })).resolves.toMatchObject({ name: "Ivo Picula" })
    })

    it("replaces an offensive name from a source the guest did NOT just type with a neutral fallback, rather than failing the login", async () => {
        // A stored `gameName` row can predate the filter (written before
        // 2026-09-20), or a `displayName` synced from elsewhere can carry
        // anything — either way there is no form here to reject it with, so
        // sign-in still succeeds and the seat wears a generated name instead.
        const withBadStoredName = createAuthenticator(loadConfig({}, { devAllowAnon: false }), {
            get: async () => ({ displayName: null, avatarUrl: null, gameName: "pička", avatarPreset: null }),
            setGameName: async () => ({ ok: false, error: "UNAVAILABLE" }),
        })
        const user = await withBadStoredName.authenticate({ guest: { ...guest, name: "Ana" } })
        expect(user.name).not.toBe("pička")
        expect(user.name).toMatch(/^Igrač \d{4}$/)
        // Deterministic per uid, so the seat does not get a new name on every reconnect.
        const again = await withBadStoredName.authenticate({ guest: { ...guest, name: "Ana" } })
        expect(again.name).toBe(user.name)
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
