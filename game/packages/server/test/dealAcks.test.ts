/* ──────────────────────────────────────────────────────────────────────────
   `game.nextDeal` is an ACK, not a command (README §3.1, 2026-09-20).

   The deal on screen advances when every CONNECTED human seat has said it is
   done with the receipt; `dealDoneAutoMs` is only what happens when one of
   those acks never arrives. Every test here therefore runs with a fallback
   timer long enough that it could not possibly be the thing that moved the
   table — if a deal advances, an ack did it.

   Covered: the solo-against-bots case (one ack IS all of them), a full table
   of four (three acks are not enough, the fourth moves it), a spectator (no
   seat, no vote), the reset between deals, and a seat that drops while the
   table is waiting for it.
   ────────────────────────────────────────────────────────────────────── */

import { afterEach, describe, expect, it } from "vitest"
import type { PlayerView, Seat, ServerMessage } from "@bela/protocol"
import { SEATS } from "@bela/engine"
import type { GameServer } from "../src/server.js"
import { sleep, startTestServer, TestClient } from "./helpers.js"

let server: GameServer | null = null
const clients: TestClient[] = []

/** Long enough that the fallback timer cannot be what advanced a deal. */
const NEVER = 60_000

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

function latestView(c: TestClient): PlayerView | null {
    let view: PlayerView | null = null
    for (const m of c.received) if (m.t === "game.state") view = m.view
    return view
}

function isGameState(m: ServerMessage): m is Extract<ServerMessage, { t: "game.state" }> {
    return m.t === "game.state"
}

/** One human, three bots, already playing. */
async function startSoloRoom(host: TestClient): Promise<string> {
    host.send({ t: "room.create", name: "Soba", targetScore: 1001, private: false, allowSpectators: true })
    const joined = await host.nextOfType("room.joined")
    for (const seat of [1, 2, 3] as const) host.send({ t: "room.addBot", seat })
    await host.next((m) => m.t === "room.state" && m.room.seats.every((s) => s.occupant !== null))
    host.send({ t: "room.ready", ready: true })
    await host.nextOfType("room.state")
    host.send({ t: "room.start" })
    await host.next((m) => m.t === "room.state" && m.room.status === "PLAYING")
    return joined.room.id
}

/** Four humans, already playing: nothing moves unless a test moves it. */
async function startHumanTable(): Promise<Map<Seat, TestClient>> {
    const host = await connect("Ana")
    host.send({ t: "room.create", name: "Soba", targetScore: 1001, private: false })
    const joined = await host.nextOfType("room.joined")
    const seated = new Map<Seat, TestClient>()
    seated.set(joined.yourSeat ?? 0, host)
    for (const name of ["Bruno", "Ceca", "Dario"]) {
        const c = await connect(name)
        c.send({ t: "room.join", roomId: joined.room.id })
        const seat = (await c.nextOfType("room.joined")).yourSeat
        if (seat === null) throw new Error(`${name} was not seated`)
        seated.set(seat, c)
    }
    for (const c of seated.values()) c.send({ t: "room.ready", ready: true })
    await host.next(
        (m) =>
            m.t === "room.state" &&
            SEATS.every((s) => {
                const occupant = m.room.seats[s].occupant
                return occupant?.kind === "PLAYER" && occupant.ready
            }),
    )
    host.send({ t: "room.start" })
    await host.next((m) => m.t === "room.state" && m.room.status === "PLAYING")
    return seated
}

/** Dumbest legal policy for every seat this map holds, until `done`. */
async function driveUntil(
    seated: Map<Seat, TestClient>,
    done: (view: PlayerView) => boolean,
    timeoutMs = 30_000,
): Promise<PlayerView> {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
        for (const [seat, c] of seated) {
            const view = latestView(c)
            if (!view) continue
            if (done(view)) return view
            if (view.turn !== seat) continue
            if (view.phase === "BIDDING") {
                const legal = view.legalBids
                if (!legal) continue
                if (legal.canPass) c.send({ t: "game.pass" })
                else if (legal.suits[0]) c.send({ t: "game.bid", trump: legal.suits[0] })
            } else if (view.phase === "PLAYING") {
                const card = view.legalMoves[0]
                if (card) c.send({ t: "game.play", card })
            }
            break
        }
        await sleep(5)
    }
    throw new Error("table never reached the wanted state")
}

describe("game.nextDeal as a per-seat ack", () => {
    it("advances immediately when the table's only human acks", async () => {
        server = await startTestServer({
            timings: { dealDoneAutoMs: NEVER },
            rateLimits: { messagesPerSecond: 5000 },
        })
        const host = await connect("Igrac")
        await startSoloRoom(host)
        const seated = new Map<Seat, TestClient>([[0, host]])

        const done = await driveUntil(seated, (v) => v.phase === "DEAL_DONE" || v.phase === "GAME_OVER")
        expect(done.phase).toBe("DEAL_DONE")
        const dealNo = done.dealNo

        // Nothing moves on its own: the fallback is a minute away.
        await sleep(150)
        expect(latestView(host)?.phase).toBe("DEAL_DONE")

        host.send({ t: "game.nextDeal" })
        const next = await host.next((m) => isGameState(m) && m.view.dealNo !== dealNo, 4000)
        expect(isGameState(next) && next.view.phase).toBe("BIDDING")
    }, 45_000)

    it("waits for every connected human and then advances on the last ack", async () => {
        server = await startTestServer({
            timings: { dealDoneAutoMs: NEVER },
            rateLimits: { messagesPerSecond: 5000 },
        })
        const seated = await startHumanTable()

        const done = await driveUntil(seated, (v) => v.phase === "DEAL_DONE" || v.phase === "GAME_OVER")
        expect(done.phase).toBe("DEAL_DONE")
        const dealNo = done.dealNo

        const order = [...seated.entries()]
        // Three of four: the table must NOT move.
        for (const [, c] of order.slice(0, 3)) c.send({ t: "game.nextDeal" })
        await sleep(200)
        for (const [, c] of order) expect(latestView(c)?.dealNo).toBe(dealNo)

        // A repeat from somebody who already acked is not a fourth vote.
        order[0]?.[1].send({ t: "game.nextDeal" })
        await sleep(150)
        expect(latestView(order[0]?.[1] as TestClient)?.dealNo).toBe(dealNo)

        const last = order[3]?.[1] as TestClient
        last.send({ t: "game.nextDeal" })
        const next = await last.next((m) => isGameState(m) && m.view.dealNo !== dealNo, 4000)
        expect(isGameState(next) && next.view.phase).toBe("BIDDING")
    }, 60_000)

    it("does not count a spectator, and starts the acks over on the next deal", async () => {
        server = await startTestServer({
            timings: { dealDoneAutoMs: NEVER },
            rateLimits: { messagesPerSecond: 5000 },
        })
        const host = await connect("Igrac")
        const roomId = await startSoloRoom(host)
        const watcher = await connect("Gledatelj")
        watcher.send({ t: "room.join", roomId })
        await watcher.nextOfType("room.joined")
        const seated = new Map<Seat, TestClient>([[0, host]])

        const done = await driveUntil(seated, (v) => v.phase === "DEAL_DONE" || v.phase === "GAME_OVER")
        expect(done.phase).toBe("DEAL_DONE")
        const dealNo = done.dealNo

        // Watching is not voting: the server answers NOT_YOUR_TURN and the
        // deal stays exactly where it was.
        watcher.send({ t: "game.nextDeal" })
        await sleep(200)
        expect(latestView(host)?.dealNo).toBe(dealNo)

        host.send({ t: "game.nextDeal" })
        await host.next((m) => isGameState(m) && m.view.dealNo !== dealNo, 4000)

        // The next deal must ask again — an ack does not carry over.
        const second = await driveUntil(seated, (v) => v.phase === "DEAL_DONE" || v.phase === "GAME_OVER")
        expect(second.phase).toBe("DEAL_DONE")
        expect(second.dealNo).not.toBe(dealNo)
        await sleep(200)
        expect(latestView(host)?.phase).toBe("DEAL_DONE")
        host.send({ t: "game.nextDeal" })
        await host.next((m) => isGameState(m) && m.view.dealNo !== second.dealNo, 4000)
    }, 60_000)

    it("stops waiting for a seat that drops while the receipt is up", async () => {
        server = await startTestServer({
            timings: { dealDoneAutoMs: NEVER, reconnectGraceMs: 60_000 },
            rateLimits: { messagesPerSecond: 5000 },
        })
        const seated = await startHumanTable()

        const done = await driveUntil(seated, (v) => v.phase === "DEAL_DONE" || v.phase === "GAME_OVER")
        expect(done.phase).toBe("DEAL_DONE")
        const dealNo = done.dealNo

        const order = [...seated.entries()]
        const stayers = order.slice(0, 3)
        const leaver = order[3]?.[1] as TestClient
        for (const [, c] of stayers) c.send({ t: "game.nextDeal" })
        await sleep(150)
        expect(latestView(stayers[0]?.[1] as TestClient)?.dealNo).toBe(dealNo)

        // The fourth seat's socket dies. Its seat goes on hold — a held seat
        // does not vote, so the three who are here are now all of them.
        const watching = (stayers[0]?.[1] as TestClient).next(
            (m) => isGameState(m) && m.view.dealNo !== dealNo,
            5000,
        )
        await leaver.close()
        const next = await watching
        expect(isGameState(next) && next.view.phase).toBe("BIDDING")
    }, 60_000)
})
