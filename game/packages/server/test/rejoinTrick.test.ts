/* ──────────────────────────────────────────────────────────────────────────
   Rejoining mid-trick (README §3 "Igra", §4 `sendStateTo`).

   The reported bug was "leave a running game, come back, and the card a bot
   had already thrown is gone from the felt". These tests pin down the half of
   the contract the SERVER owns, because the client's fix depends on it:

     • the first `game.state` a returning seat receives already carries every
       card lying in the current trick — `viewFor` copies `state.trick`, so a
       joiner needs nothing else to paint the middle of the table;
     • no `game.events` are replayed on that join. That matters as much: the
       UI's event queue treats a `DEALT` as "wipe the felt", so a server that
       helpfully re-sent the deal's history would blank the very trick the
       state had just delivered.

   Both routes back in are covered — the explicit `room.leave` + `room.join`
   the lobby's "Vrati se u igru" button uses, and the `hello` reattach a
   dropped socket (a page reload) comes back through.

   No bots take a turn while a test is asserting: all four seats are real test
   clients, so nothing moves unless this file moves it.
   ────────────────────────────────────────────────────────────────────── */

import { afterEach, describe, expect, it } from "vitest"
import type { PlayerView, Seat, ServerMessage } from "@bela/protocol"
import { SEATS } from "@bela/engine"
import type { TrickCard } from "@bela/engine"
import type { GameServer } from "../src/server.js"
import { sleep, startTestServer, TestClient } from "./helpers.js"

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

/** The most recent `game.state` this client has seen, without moving its cursor. */
function latestView(c: TestClient): PlayerView | null {
    let view: PlayerView | null = null
    for (const m of c.received) if (m.t === "game.state") view = m.view
    return view
}

/** A table of four humans: nothing happens on its own, so a test can freeze
 *  the game mid-trick and take its time asserting. */
async function startHumanTable(): Promise<{
    seated: Map<Seat, TestClient>
    names: Map<Seat, string>
    roomId: string
}> {
    const host = await connect("Ana")
    host.send({ t: "room.create", name: "Soba", targetScore: 501, private: false })
    const joined = await host.nextOfType("room.joined")
    const roomId = joined.room.id

    const seated = new Map<Seat, TestClient>()
    // Who sits where is `SEAT_FILL_ORDER`'s business (0→2→1→3, README §3.3),
    // not this file's — so the seat→name map is RECORDED as people are seated
    // rather than assumed. It used to be `["Ana","Bruno","Ceca","Dario"][seat]`,
    // which silently meant "seat n is the n-th to arrive" and stopped being
    // true the moment the fill order changed.
    const names = new Map<Seat, string>()
    seated.set(joined.yourSeat ?? 0, host)
    names.set(joined.yourSeat ?? 0, "Ana")

    for (const name of ["Bruno", "Ceca", "Dario"]) {
        const c = await connect(name)
        c.send({ t: "room.join", roomId })
        const joinedSeat = (await c.nextOfType("room.joined")).yourSeat
        if (joinedSeat === null) throw new Error(`${name} was not seated`)
        seated.set(joinedSeat, c)
        names.set(joinedSeat, name)
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
    return { seated, names, roomId }
}

/**
 * Play the dumbest legal move for whoever is on turn, one action at a time,
 * until `done` holds. Bidding passes whenever it may and otherwise takes the
 * first legal suit; playing takes `legalMoves[0]`.
 */
async function driveUntil(
    seated: Map<Seat, TestClient>,
    done: (view: PlayerView) => boolean,
    timeoutMs = 20_000,
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
        await sleep(10)
    }
    throw new Error("table never reached the wanted state")
}

/** A seat that is NOT on turn, so leaving it cannot stall the table. */
function idleSeat(seated: Map<Seat, TestClient>, view: PlayerView): Seat {
    for (const seat of seated.keys()) {
        if (seat !== view.turn) return seat
    }
    throw new Error("no idle seat")
}

function isGameState(m: ServerMessage): m is Extract<ServerMessage, { t: "game.state" }> {
    return m.t === "game.state"
}

describe("a seat that comes back mid-trick", () => {
    it("is sent the cards already lying in the trick, and no replayed events", async () => {
        // A generous turn deadline: nothing may be auto-played out from under
        // the assertions while a seat is away.
        server = await startTestServer({
            timings: { turnTimeoutMs: 60_000, reconnectGraceMs: 60_000 },
            rateLimits: { messagesPerSecond: 5000, chatPerSecond: 5000 },
        })
        const { seated, names, roomId } = await startHumanTable()

        // Freeze the table with a partly-played trick on the felt.
        const midTrick = await driveUntil(
            seated,
            (view) => view.phase === "PLAYING" && view.trick.cards.length >= 2 && view.trick.cards.length < 4,
        )
        const onFelt: TrickCard[] = midTrick.trick.cards
        expect(onFelt.length).toBeGreaterThanOrEqual(2)

        // The player walks out through the header's back arrow: `room.leave`
        // holds the seat, and the lobby offers "Vrati se u igru".
        const seat = idleSeat(seated, midTrick)
        const leaver = seated.get(seat)
        if (!leaver) throw new Error("no client for seat")
        const name = names.get(seat)
        if (!name) throw new Error("no name for seat")
        leaver.send({ t: "room.leave" })
        await leaver.nextOfType("room.left")
        await leaver.close()

        // …and walks back in. A fresh socket, so its message log holds exactly
        // what the rejoin delivered and nothing from before.
        const back = await connect(name)
        back.send({ t: "room.join", roomId })
        const rejoined = await back.nextOfType("room.joined")
        expect(rejoined.yourSeat).toBe(seat)

        const state = await back.next(isGameState)
        if (!isGameState(state)) throw new Error("expected game.state")
        expect(state.view.phase).toBe("PLAYING")
        // THE regression: the trick is in the very first state a returning
        // seat gets. A client that renders it has a full felt immediately.
        expect(state.view.trick.cards).toEqual(onFelt)
        expect(state.view.trick.leader).toBe(midTrick.trick.leader)

        // …and nothing was replayed that would wipe it again (`DEALT` is the
        // UI's "clear the felt" signal).
        await sleep(50)
        expect(back.received.filter((m) => m.t === "game.events")).toHaveLength(0)
    })

    it("gets the same trick back through the hello reattach a reload uses", async () => {
        server = await startTestServer({
            timings: { turnTimeoutMs: 60_000, reconnectGraceMs: 60_000 },
            rateLimits: { messagesPerSecond: 5000, chatPerSecond: 5000 },
        })
        const { seated, names } = await startHumanTable()

        const midTrick = await driveUntil(
            seated,
            (view) => view.phase === "PLAYING" && view.trick.cards.length >= 2 && view.trick.cards.length < 4,
        )
        const onFelt: TrickCard[] = midTrick.trick.cards
        expect(onFelt.length).toBeGreaterThanOrEqual(2)

        // A reload is a dead socket, not a `room.leave`: the hold's reason is
        // "disconnect", so the plain `hello` walks straight back to the seat.
        const seat = idleSeat(seated, midTrick)
        const dropped = seated.get(seat)
        if (!dropped) throw new Error("no client for seat")
        const name = names.get(seat)
        if (!name) throw new Error("no name for seat")
        dropped.terminate()

        const back = await connect(name)
        const state = await back.next(isGameState)
        if (!isGameState(state)) throw new Error("expected game.state")
        expect(state.view.seat).toBe(seat)
        expect(state.view.trick.cards).toEqual(onFelt)
        expect(back.received.filter((m) => m.t === "game.events")).toHaveLength(0)
    })
})
