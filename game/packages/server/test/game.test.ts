import { afterEach, describe, expect, it } from "vitest"
import type { PlayerView, Seat, ServerMessage, TargetScore } from "@bela/protocol"
import type { GameServer } from "../src/server.js"
import { startTestServer, TestClient, until } from "./helpers.js"

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
async function startSoloRoom(
    host: TestClient,
    targetScore: TargetScore = 501,
): Promise<string> {
    // Several presence tests attach an observer after play starts.
    host.send({ t: "room.create", name: "Soba", targetScore, private: false, allowSpectators: true })
    const joined = await host.nextOfType("room.joined")
    host.send({ t: "room.ready", ready: true })
    await host.nextOfType("room.state")
    host.send({ t: "room.start" })
    await host.next((m) => m.t === "room.state" && m.room.status === "PLAYING")
    return joined.room.id
}

function isGameState(m: ServerMessage): m is Extract<ServerMessage, { t: "game.state" }> {
    return m.t === "game.state"
}

/**
 * Drives one human seat with the dumbest legal policy there is: pass whenever
 * passing is allowed, otherwise take the first legal suit; always play
 * `legalMoves[0]`; confirm every finished deal.
 */
async function playUntilGameOver(
    client: TestClient,
    seat: Seat,
    timeoutMs = 60_000,
): Promise<PlayerView> {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
        const msg = await client.next(isGameState, 15_000)
        if (!isGameState(msg)) continue
        const view = msg.view
        if (view.phase === "GAME_OVER") return view
        if (view.phase === "DEAL_DONE") {
            client.send({ t: "game.nextDeal" })
            continue
        }
        if (view.turn !== seat) continue
        if (view.phase === "BIDDING") {
            const legal = view.legalBids
            if (!legal) continue
            if (legal.canPass) {
                client.send({ t: "game.pass" })
            } else {
                const suit = legal.suits[0]
                if (suit) client.send({ t: "game.bid", trump: suit })
            }
            continue
        }
        if (view.phase === "PLAYING") {
            const card = view.legalMoves[0]
            if (card) client.send({ t: "game.play", card })
        }
    }
    throw new Error("game did not reach GAME_OVER in time")
}

describe("a full game", () => {
    it(
        "plays through to GAME_OVER with one human and three bots",
        async () => {
            server = await startTestServer({
                rateLimits: { messagesPerSecond: 5000, chatPerSecond: 5000 },
            })
            const host = await connect("Igrac")
            const roomId = await startSoloRoom(host, 501)

            const view = await playUntilGameOver(host, 0)
            expect(view.phase).toBe("GAME_OVER")
            expect(view.winner === "A" || view.winner === "B").toBe(true)
            expect(view.history.length).toBeGreaterThan(0)
            const winning = view.winner === "A" ? view.score.A : view.score.B
            expect(winning).toBeGreaterThanOrEqual(501)

            expect(host.received.some((m) => m.t === "game.events" && m.events.some((e) => e.type === "GAME_OVER"))).toBe(true)

            const states = host.received.filter(isGameState)
            // README §1.7: the deal that crossed the target ended the game
            // where it was scored, so the table was never left sitting in a
            // decided DEAL_DONE waiting for a "Sljedeća podjela" that would
            // only have ended the game anyway.
            expect(
                states.filter(
                    (m) =>
                        m.view.phase === "DEAL_DONE" &&
                        (m.view.score.A >= 501 || m.view.score.B >= 501) &&
                        m.view.score.A !== m.view.score.B,
                ),
            ).toEqual([])

            // README §2/§3: every view carries the current deal's points from
            // COMPLETED tricks — at most the 152 that live in the cards.
            expect(states.some((m) => m.view.currentDealPoints.A + m.view.currentDealPoints.B > 0)).toBe(true)
            for (const m of states) {
                expect(m.view.currentDealPoints.A + m.view.currentDealPoints.B).toBeLessThanOrEqual(152)
            }

            const room = server.lobby.get(roomId)!
            expect(room.status).toBe("LOBBY")
            const before = room.toState()
            expect(before.seats[0].occupant).toMatchObject({ kind: "PLAYER", ready: false })
            expect(before.seats.slice(1).every((s) => s.occupant?.kind === "BOT")).toBe(true)
            host.send({ t: "room.start" })
            expect((await host.nextOfType("error")).code).toBe("BAD_REQUEST")
            host.send({ t: "room.ready", ready: true })
            await host.next((m) => m.t === "room.state" && m.room.seats[0].occupant?.kind === "PLAYER" && m.room.seats[0].occupant.ready)
            host.send({ t: "room.start" })
            const restarted = await host.nextOfType("game.state")
            expect(restarted.view.phase).toBe("BIDDING")
            expect(restarted.view.score).toEqual({ A: 0, B: 0 })
            expect(restarted.view.history).toEqual([])
            expect(restarted.view.dealNo).toBe(1)
            expect(room.id).toBe(roomId)
            expect(room.toState().seats.map((s) => s.occupant?.kind)).toEqual(before.seats.map((s) => s.occupant?.kind))
            expect(room.targetScore).toBe(before.targetScore)
            expect(room.private).toBe(before.private)

        },
        90_000,
    )

    it(
        "plays a 701 room through to GAME_OVER",
        async () => {
            server = await startTestServer({
                rateLimits: { messagesPerSecond: 5000, chatPerSecond: 5000 },
            })
            const host = await connect("Igrac701")
            await startSoloRoom(host, 701)

            const view = await playUntilGameOver(host, 0)
            expect(view.phase).toBe("GAME_OVER")
            expect(view.winner === "A" || view.winner === "B").toBe(true)
            const winning = view.winner === "A" ? view.score.A : view.score.B
            expect(winning).toBeGreaterThanOrEqual(701)
        },
        90_000,
    )

    it("blocks humans and bots until declarations have been shown, with a fresh turn timer afterwards", async () => {
        server = await startTestServer({ timings: { declarationsMs: 100, botThinkMinMs: 100_000, botThinkMaxMs: 100_000 } })
        const host = await connect("Zvanja")
        const roomId = await startSoloRoom(host, 501)
        await host.nextOfType("game.state")
        const game = server.lobby.get(roomId)!.game!
        game.state = { ...game.state, dealer: 3, bidding: { ...game.state.bidding, turn: 0 } }
        host.send({ t: "game.bid", trump: "HERC" })
        const paused = await host.nextOfType("game.state")
        expect(paused.declarationsPending).toBe(true)
        expect(paused.view.declarationsRevealed).toBe(true)
        expect(paused.view.legalMoves).toEqual([])
        expect(paused.turnDeadline).toBeNull()
        const card = paused.view.hand[0]!
        host.send({ t: "game.play", card })
        expect((await host.nextOfType("error")).code).toBe("BAD_REQUEST")
        expect(game.state.trick.cards).toEqual([])
        const resumed = await host.nextOfType("game.state")
        expect(resumed.declarationsPending).toBe(false)
        expect(resumed.view.legalMoves).toContain(card)
        expect(resumed.turnDeadline).not.toBeNull()
        host.send({ t: "game.play", card })
        const played = await host.nextOfType("game.state")
        expect(played.view.trick.cards).toHaveLength(1)
    })

    it("rejects a move from the wrong seat and keeps playing", async () => {
        server = await startTestServer({
            timings: { botThinkMinMs: 100_000, botThinkMaxMs: 100_000 },
            rateLimits: { messagesPerSecond: 5000 },
        })
        const host = await connect("Igrac")
        const roomId = await startSoloRoom(host, 501)
        const room = server.lobby.get(roomId)
        expect(room).toBeDefined()

        const first = await host.nextOfType("game.state")
        expect(first.view.phase).toBe("BIDDING")
        // An obviously invalid card while it is (at most) our bidding turn.
        host.send({ t: "game.play", card: "AHERC" })
        const err = await host.nextOfType("error")
        expect(["NOT_YOUR_TURN", "ILLEGAL_MOVE", "BAD_REQUEST"]).toContain(err.code)
        expect(host.ws.readyState).toBe(1)
    })
})

describe("presence", () => {
    it("keeps the seat across a reconnect", async () => {
        server = await startTestServer({
            timings: { botThinkMinMs: 100_000, botThinkMaxMs: 100_000, reconnectGraceMs: 30_000 },
        })
        const host = await connect("Igrac")
        const roomId = await startSoloRoom(host, 501)
        const room = server.lobby.get(roomId)
        if (!room) throw new Error("room missing")

        await host.close()
        clients.length = 0
        await until(() => {
            const slot = room.slotAt(0)
            return slot?.kind === "PLAYER" && !slot.connected
        })
        // the seat is still held for the same uid
        expect(room.seatOfUid("dev:igrac")).toBe(0)

        const again = await connect("Igrac")
        const joined = await again.nextOfType("room.joined")
        expect(joined.room.id).toBe(roomId)
        expect(joined.yourSeat).toBe(0)
        const state = await again.nextOfType("game.state")
        expect(state.view.seat).toBe(0)
        const slot = room.slotAt(0)
        expect(slot?.kind).toBe("PLAYER")
        if (slot?.kind === "PLAYER") expect(slot.connected).toBe(true)
    })

    it("lets the bot play for a disconnected human (autoPlayed) once the turn deadline passes", async () => {
        // The bot no longer jumps in the instant the socket dies — the seat is
        // held and the ordinary turn timer runs first (see seatHold.test.ts),
        // so this shortens `turnTimeoutMs` rather than waiting it out.
        server = await startTestServer({ timings: { reconnectGraceMs: 30_000, turnTimeoutMs: 250 } })
        const host = await connect("Igrac")
        const roomId = await startSoloRoom(host, 501)
        const room = server.lobby.get(roomId)
        if (!room) throw new Error("room missing")

        // a spectator stays behind to observe the table
        const watcher = await connect("Gledatelj")
        watcher.send({ t: "room.join", roomId })
        await watcher.nextOfType("room.joined")

        await host.close()
        clients.splice(clients.indexOf(host), 1)
        await until(() => {
            const slot = room.slotAt(0)
            return slot?.kind === "PLAYER" && !slot.connected
        })

        const auto = await watcher.next(
            (m) => m.t === "game.state" && m.autoPlayed === true,
            15_000,
        )
        expect(auto.t).toBe("game.state")
        if (auto.t === "game.state") {
            // spectators never see anybody's cards
            expect(auto.view.seat).toBeNull()
            expect(auto.view.hand).toEqual([])
        }
        // the seat is still the human's — the grace period has not expired
        const slot = room.slotAt(0)
        expect(slot?.kind).toBe("PLAYER")
    })

    it("dissolves a solo room once the reconnect grace period expires", async () => {
        server = await startTestServer({
            timings: {
                reconnectGraceMs: 40,
                botThinkMinMs: 100_000,
                botThinkMaxMs: 100_000,
            },
        })
        const host = await connect("Igrac")
        const roomId = await startSoloRoom(host, 501)
        await host.close()
        clients.length = 0
        await until(() => server?.lobby.get(roomId) === undefined, 3000)
        expect(server.roomCount()).toBe(0)
    })
})
