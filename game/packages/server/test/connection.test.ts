import { afterEach, describe, expect, it } from "vitest"
import type { GameServer } from "../src/server.js"
import { startTestServer, TestClient } from "./helpers.js"

let server: GameServer | null = null

afterEach(async () => {
    await server?.close()
    server = null
})

describe("health endpoint", () => {
    it("reports ok and the room count", async () => {
        server = await startTestServer()
        const res = await fetch(`http://127.0.0.1:${server.port()}/health`)
        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ ok: true, rooms: 0 })
    })

    it("404s anything else", async () => {
        server = await startTestServer()
        const res = await fetch(`http://127.0.0.1:${server.port()}/nope`)
        expect(res.status).toBe(404)
    })
})

describe("hello", () => {
    it("accepts an anonymous dev hello and derives a dev uid", async () => {
        server = await startTestServer()
        const client = await TestClient.connect(server.url())
        const ok = await client.hello("Pero Perić")
        expect(ok.user.uid).toBe("dev:pero-peric")
        expect(ok.user.name).toBe("Pero Perić")
        expect(ok.user.avatarUrl).toBeNull()
        expect(ok.v).toBe(1)
        await client.close()
    })

    it("rejects an anonymous hello when dev anon is off", async () => {
        server = await startTestServer({ env: { GAME_LOG_LEVEL: "error" } })
        const client = await TestClient.connect(server.url())
        client.send({ t: "hello", v: 1, devName: "Pero" })
        const err = await client.nextOfType("error")
        expect(err.code).toBe("UNAUTHENTICATED")
        expect(err.message.length).toBeGreaterThan(0)
        await client.close()
    })

    it("requires hello before anything else", async () => {
        server = await startTestServer()
        const client = await TestClient.connect(server.url())
        client.send({ t: "lobby.subscribe" })
        const err = await client.nextOfType("error")
        expect(err.code).toBe("UNAUTHENTICATED")
        expect(err.ref).toBe("lobby.subscribe")
        // the connection survives and can still authenticate
        const ok = await client.hello("Ana")
        expect(ok.user.uid).toBe("dev:ana")
        await client.close()
    })

    it("accepts the bare / upgrade path too", async () => {
        server = await startTestServer()
        const client = await TestClient.connect(`ws://127.0.0.1:${server.port()}/`)
        const ok = await client.hello("Ana")
        expect(ok.user.uid).toBe("dev:ana")
        await client.close()
    })

    it("rejects an unknown upgrade path", async () => {
        server = await startTestServer()
        await expect(
            TestClient.connect(`ws://127.0.0.1:${server.port()}/nope`),
        ).rejects.toThrow()
    })

    it("answers ping with pong before hello", async () => {
        server = await startTestServer()
        const client = await TestClient.connect(server.url())
        client.send({ t: "ping" })
        await client.nextOfType("pong")
        await client.close()
    })
})

describe("bad input", () => {
    it("never crashes the connection", async () => {
        server = await startTestServer()
        const client = await TestClient.connect(server.url())
        await client.hello("Ana")

        client.sendRaw("{ not json")
        let err = await client.nextOfType("error")
        expect(err.code).toBe("BAD_REQUEST")

        client.sendRaw(JSON.stringify({ t: "totally.unknown" }))
        err = await client.nextOfType("error")
        expect(err.code).toBe("BAD_REQUEST")

        client.sendRaw(JSON.stringify({ t: "room.sit", seat: 9 }))
        err = await client.nextOfType("error")
        expect(err.code).toBe("BAD_REQUEST")

        client.sendRaw(JSON.stringify({ t: "room.stand" }))
        err = await client.nextOfType("error")
        expect(err.code).toBe("NOT_IN_ROOM")

        // still alive
        client.send({ t: "ping" })
        await client.nextOfType("pong")
        expect(client.ws.readyState).toBe(1)
        await client.close()
    })
})

describe("rate limiting", () => {
    it("emits RATE_LIMITED once the bucket is empty", async () => {
        server = await startTestServer({ rateLimits: { messagesPerSecond: 3 } })
        const client = await TestClient.connect(server.url())
        for (let i = 0; i < 20; i += 1) client.send({ t: "ping" })
        const err = await client.nextOfType("error")
        expect(err.code).toBe("RATE_LIMITED")
        await client.close()
    })

    it("rate-limits chat separately", async () => {
        server = await startTestServer({
            rateLimits: { messagesPerSecond: 100, chatPerSecond: 1 },
        })
        const client = await TestClient.connect(server.url())
        await client.hello("Ana")
        client.send({ t: "room.create", name: "Test", targetScore: 501, private: false })
        await client.nextOfType("room.joined")

        client.send({ t: "chat.send", text: "bok" })
        const msg = await client.nextOfType("chat.msg")
        expect(msg.msg.text).toBe("bok")
        expect(msg.msg.from.uid).toBe("dev:ana")

        client.send({ t: "chat.send", text: "opet" })
        const err = await client.nextOfType("error")
        expect(err.code).toBe("RATE_LIMITED")
        await client.close()
    })

    it("trims and rejects empty chat", async () => {
        server = await startTestServer({ rateLimits: { messagesPerSecond: 100 } })
        const client = await TestClient.connect(server.url())
        await client.hello("Ana")
        client.send({ t: "room.create", name: "Test", targetScore: 501, private: false })
        await client.nextOfType("room.joined")
        client.send({ t: "chat.send", text: "   " })
        const err = await client.nextOfType("error")
        expect(err.code).toBe("BAD_REQUEST")
        await client.close()
    })
})
