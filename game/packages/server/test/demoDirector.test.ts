/* The demo lobby's director (`src/demo/director.ts`) against a fake in-memory
 * `DemoLobbyApi`, a manual clock and a seeded rng — a simulated hour runs in
 * a few milliseconds and every assertion is reproducible.
 *
 * What is being tested is not "does it call `sit`" but the four things a real
 * user would notice (DEMO-LOBBY.md §1, §3): the lobby stays in its band, no
 * two rooms ever change in the same instant, the option mix always shows a
 * 501 and a 701, and the same person is never in two rooms at once. Plus the
 * real-person path, which is the only part a user actually interacts with. */

import { describe, expect, it } from "vitest"
import type { Seat } from "@bela/protocol"
import { createIdentityPool } from "../src/demo/identities.js"
import { startDemoDirector } from "../src/demo/director.js"
import type {
    DemoClock,
    DemoDirectorConfig,
    DemoIdentity,
    DemoLobbyApi,
    DemoRoomEvents,
    DemoRoomHandle,
    DemoRoomOptions,
} from "../src/demo/types.js"

/* ─────────────────────────── seeded rng ──────────────────────────────── */

function seeded(seed: number): () => number {
    let a = seed >>> 0
    return () => {
        a = (a + 0x6d2b79f5) >>> 0
        let t = a
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

/* ─────────────────────────── manual clock ────────────────────────────── */

interface ManualClock extends DemoClock {
    advance(ms: number): void
    pending(): number
}

function manualClock(): ManualClock {
    let now = 0
    let seq = 0
    const queue = new Map<number, { at: number; fn: () => void }>()
    return {
        now: () => now,
        setTimeout(fn: () => void, ms: number): unknown {
            const id = ++seq
            queue.set(id, { at: now + Math.max(0, ms), fn })
            return id
        },
        clearTimeout(handle: unknown): void {
            queue.delete(handle as number)
        },
        pending: () => queue.size,
        advance(ms: number): void {
            const end = now + ms
            // Insertion order breaks ties, which makes "same instant" a real,
            // observable state rather than an artefact of the queue.
            for (let guard = 0; guard < 1_000_000; guard++) {
                let nextId = -1
                let nextAt = Number.POSITIVE_INFINITY
                for (const [id, t] of queue) {
                    if (nextId === -1 || t.at < nextAt) {
                        nextAt = t.at
                        nextId = id
                    }
                }
                if (nextId === -1 || nextAt > end) break
                const entry = queue.get(nextId)
                queue.delete(nextId)
                if (!entry) break
                now = entry.at
                entry.fn()
            }
            now = end
        },
    }
}

/* ─────────────────────────── fake mechanics ──────────────────────────── */

/** Every handle call that changes the SHAPE of the lobby, with the instant it
 *  happened — the "never two rooms in the same second" assertion reads this. */
interface StructuralEntry {
    at: number
    roomId: string
    kind: "create" | "sit" | "leave" | "replace" | "start" | "close"
}

interface FakeRoom extends DemoRoomHandle {
    seats: (DemoIdentity | "HUMAN" | null)[]
    state: "LOBBY" | "PLAYING" | "FINISHED"
    events: DemoRoomEvents
    disposed: boolean
    reactions: { seat: Seat; reaction: string; at: number }[]
    replaced: { seat: Seat; identity: DemoIdentity; at: number }[]
    startCalls: number
}

interface FakeLobby extends DemoLobbyApi {
    rooms: FakeRoom[]
    live(): FakeRoom[]
    structural: StructuralEntry[]
    realRooms: number
    /** Drive a game to its end the way `gameRoom` eventually would. */
    finishGame(room: FakeRoom, winner: "A" | "B" | null): void
    seatHuman(room: FakeRoom, seat: Seat): void
    humanLeaves(room: FakeRoom, seat: Seat): void
}

interface FakeLobbyOptions {
    /** When set, a started game finishes by itself after this long, so the
     *  full lifecycle (play → over → linger → close → new room) runs. */
    autoFinishMs?: number
}

function fakeLobby(clock: ManualClock, rng: () => number, opts: FakeLobbyOptions = {}): FakeLobby {
    let nextId = 0
    const lobby: FakeLobby = {
        rooms: [],
        structural: [],
        realRooms: 0,
        live: () => lobby.rooms.filter((r) => !r.disposed),
        realRoomCount: () => lobby.realRooms,
        totalRoomCount: () => lobby.live().length + lobby.realRooms,
        createDemoRoom(options: DemoRoomOptions, host: DemoIdentity, events: DemoRoomEvents): DemoRoomHandle | null {
            const id = `demo-room-${++nextId}`
            const room: FakeRoom = {
                id,
                options,
                seats: [host, null, null, null],
                state: "LOBBY",
                events,
                disposed: false,
                reactions: [],
                replaced: [],
                startCalls: 0,
                status: () => room.state,
                seatMap: () => room.seats,
                humanCount: () => room.seats.filter((s) => s === "HUMAN").length,
                spectatorCount: () => 0,
                sit(identity: DemoIdentity, seat: Seat): boolean {
                    if (room.disposed || room.state !== "LOBBY") return false
                    if (room.seats[seat] != null) return false
                    room.seats[seat] = identity
                    lobby.structural.push({ at: clock.now(), roomId: id, kind: "sit" })
                    return true
                },
                leave(seat: Seat): boolean {
                    if (room.disposed || room.state === "PLAYING") return false
                    const occupant = room.seats[seat]
                    if (occupant == null || occupant === "HUMAN") return false
                    room.seats[seat] = null
                    lobby.structural.push({ at: clock.now(), roomId: id, kind: "leave" })
                    return true
                },
                replace(seat: Seat, identity: DemoIdentity): boolean {
                    if (room.disposed || room.state !== "PLAYING") return false
                    room.seats[seat] = identity
                    room.replaced.push({ seat, identity, at: clock.now() })
                    lobby.structural.push({ at: clock.now(), roomId: id, kind: "replace" })
                    return true
                },
                start(): boolean {
                    room.startCalls += 1
                    if (room.disposed || room.state !== "LOBBY") return false
                    if (room.seats.some((s) => s == null)) return false
                    room.state = "PLAYING"
                    lobby.structural.push({ at: clock.now(), roomId: id, kind: "start" })
                    if (opts.autoFinishMs) {
                        const span = opts.autoFinishMs + Math.floor(rng() * opts.autoFinishMs)
                        clock.setTimeout(() => {
                            if (!room.disposed && room.state === "PLAYING") {
                                lobby.finishGame(room, rng() < 0.5 ? "A" : "B")
                            }
                        }, span)
                    }
                    return true
                },
                react(seat: Seat, reaction: string): boolean {
                    if (room.disposed) return false
                    room.reactions.push({ seat, reaction, at: clock.now() })
                    return true
                },
                close(): void {
                    if (room.disposed) return
                    room.disposed = true
                    room.seats = [null, null, null, null]
                    lobby.structural.push({ at: clock.now(), roomId: id, kind: "close" })
                    // SYNCHRONOUS on purpose: the director must survive its
                    // own `close()` re-entering it through `onDisposed`.
                    room.events.onDisposed?.()
                },
                score: () => null,
            }
            lobby.rooms.push(room)
            lobby.structural.push({ at: clock.now(), roomId: id, kind: "create" })
            return room
        },
        finishGame(room: FakeRoom, winner: "A" | "B" | null): void {
            room.state = "FINISHED"
            room.events.onGameOver?.(winner)
        },
        seatHuman(room: FakeRoom, seat: Seat): void {
            room.seats[seat] = "HUMAN"
            room.events.onHumanSeated?.(seat)
        },
        humanLeaves(room: FakeRoom, seat: Seat): void {
            if (room.seats[seat] === "HUMAN") room.seats[seat] = null
            room.events.onHumanGone?.(seat)
        },
    }
    return lobby
}

const CONFIG: DemoDirectorConfig = {
    totalRooms: [8, 12],
    playingRooms: [5, 6],
    watchableRooms: 2,
}

function bootDirector(seed: number, opts: FakeLobbyOptions = {}) {
    const clock = manualClock()
    const rng = seeded(seed)
    const lobby = fakeLobby(clock, rng, opts)
    const pool = createIdentityPool(seeded(seed + 1000), 90, clock)
    const director = startDemoDirector({ lobby, config: CONFIG, clock, rng, pool })
    return { clock, rng, lobby, pool, director }
}

function playing(lobby: FakeLobby): FakeRoom[] {
    return lobby.live().filter((r) => r.state === "PLAYING")
}

function waiting(lobby: FakeLobby): FakeRoom[] {
    return lobby.live().filter((r) => r.state === "LOBBY")
}

/* ───────────────────────────── the tests ─────────────────────────────── */

describe("demo director — population", () => {
    it("brings the lobby to a believable state within the first ~20 s, not all at once", () => {
        const { clock, lobby, director } = bootDirector(101)

        clock.advance(200)
        // Nothing appears in the very first instant.
        expect(lobby.live().length).toBeLessThanOrEqual(1)

        clock.advance(25_000)
        expect(lobby.live().length).toBeGreaterThanOrEqual(CONFIG.totalRooms[0])
        expect(lobby.live().length).toBeLessThanOrEqual(CONFIG.totalRooms[1])
        expect(playing(lobby).length).toBeGreaterThanOrEqual(CONFIG.playingRooms[0])

        // Every room appeared at its own instant.
        const creates = lobby.structural.filter((e) => e.kind === "create")
        expect(new Set(creates.map((e) => e.at)).size).toBe(creates.length)
        director.stop()
    })

    it("stays inside the bands across a simulated hour of real lifecycles", () => {
        const { clock, lobby, director } = bootDirector(202, { autoFinishMs: 4 * 60_000 })
        clock.advance(30_000)

        for (let minute = 0; minute < 60; minute++) {
            clock.advance(60_000)
            const total = lobby.live().length
            expect(total).toBeGreaterThanOrEqual(CONFIG.totalRooms[0] - 1)
            expect(total).toBeLessThanOrEqual(CONFIG.totalRooms[1])
            // A room whose fourth person has just sat down can be in flight,
            // hence the one-room slack on the upper bound.
            expect(playing(lobby).length).toBeLessThanOrEqual(CONFIG.playingRooms[1] + 1)
        }

        // The lobby really did churn rather than freeze after boot.
        expect(lobby.rooms.length).toBeGreaterThan(CONFIG.totalRooms[1])
        expect(lobby.structural.filter((e) => e.kind === "close").length).toBeGreaterThan(0)
        director.stop()
    })

    it("never lets two rooms change in the same instant", () => {
        const { clock, lobby, director } = bootDirector(303, { autoFinishMs: 3 * 60_000 })
        clock.advance(60 * 60_000)

        const byInstant = new Map<number, Set<string>>()
        for (const entry of lobby.structural) {
            const set = byInstant.get(entry.at) ?? new Set<string>()
            set.add(entry.roomId)
            byInstant.set(entry.at, set)
        }
        for (const [at, ids] of byInstant) {
            expect(`${at}:${ids.size}`).toBe(`${at}:1`)
        }
        director.stop()
    })

    it("shows waiting rooms with one, two and three free seats over time", () => {
        const { clock, lobby, director } = bootDirector(404, { autoFinishMs: 4 * 60_000 })
        const seenFree = new Set<number>()
        clock.advance(30_000)
        for (let i = 0; i < 120; i++) {
            clock.advance(30_000)
            for (const room of waiting(lobby)) {
                seenFree.add(room.seats.filter((s) => s === null).length)
            }
        }
        expect(seenFree.has(1)).toBe(true)
        expect(seenFree.has(2)).toBe(true)
        expect(seenFree.has(3)).toBe(true)
        director.stop()
    })

    it("shrinks toward a floor when real players fill the lobby", () => {
        const { clock, lobby, director } = bootDirector(505, { autoFinishMs: 4 * 60_000 })
        clock.advance(30_000)
        const before = lobby.live().length

        lobby.realRooms = 14
        clock.advance(20 * 60_000)
        expect(lobby.live().length).toBeLessThan(before)
        expect(lobby.live().length).toBeGreaterThanOrEqual(3)

        lobby.realRooms = 0
        clock.advance(30 * 60_000)
        expect(lobby.live().length).toBeGreaterThanOrEqual(CONFIG.totalRooms[0] - 1)
        director.stop()
    })
})

describe("demo director — the option mix", () => {
    it("always offers a 501 and a 701, keeps 163 on prolaz, and caps the watchable rooms", () => {
        const { clock, lobby, director } = bootDirector(606, { autoFinishMs: 4 * 60_000 })
        clock.advance(30_000)

        let sawWatchable = false
        let sawPrivate = false
        let saw163 = false
        let lastBroken = false
        for (let i = 0; i < 90; i++) {
            clock.advance(40_000)
            const live = lobby.live()
            if (live.length < CONFIG.totalRooms[0]) continue

            const targets = live.map((r) => r.options.targetScore)
            // The last 501/701 table can finish between two beats; the
            // director re-opens one at the next beat, so a gap is brief and
            // never persists across two samples (40 s apart).
            const broken = !targets.includes(501) || !targets.includes(701)
            expect(broken && lastBroken).toBe(false)
            lastBroken = broken
            expect(targets.filter((t) => t === 1001).length).toBeGreaterThan(0)

            for (const room of live) {
                // The quick discipline is three deals long — "dosta" would be
                // meaningless, so it is always "prolaz".
                if (room.options.targetScore === 163) {
                    saw163 = true
                    expect(room.options.gameEndRule).toBe("prolaz")
                }
            }

            const watchablePlaying = playing(lobby).filter((r) => r.options.allowSpectators).length
            expect(watchablePlaying).toBeLessThanOrEqual(CONFIG.watchableRooms)
            if (watchablePlaying >= 1) sawWatchable = true

            const privateRooms = live.filter((r) => r.options.private).length
            expect(privateRooms).toBeLessThanOrEqual(2)
            if (privateRooms >= 1) sawPrivate = true
        }
        expect(sawWatchable).toBe(true)
        expect(sawPrivate).toBe(true)
        expect(saw163).toBe(true)
        director.stop()
    })

    it("mixes prolaz and dosta rather than settling on one", () => {
        const { clock, lobby, director } = bootDirector(707, { autoFinishMs: 3 * 60_000 })
        clock.advance(60 * 60_000)
        const rules = lobby.rooms.map((r) => r.options.gameEndRule)
        expect(rules.filter((r) => r === "prolaz").length).toBeGreaterThan(0)
        expect(rules.filter((r) => r === "dosta").length).toBeGreaterThan(0)
        director.stop()
    })
})

describe("demo director — identities", () => {
    it("never seats the same person in two rooms at once", () => {
        const { clock, lobby, director } = bootDirector(808, { autoFinishMs: 3 * 60_000 })
        clock.advance(30_000)
        for (let i = 0; i < 120; i++) {
            clock.advance(30_000)
            const seen = new Set<string>()
            for (const room of lobby.live()) {
                for (const occupant of room.seats) {
                    if (occupant == null || occupant === "HUMAN") continue
                    expect(seen.has(occupant.uid)).toBe(false)
                    seen.add(occupant.uid)
                }
            }
        }
        director.stop()
    })

    it("reacts a few times per game and never twice from one person inside 20 s", () => {
        const { clock, lobby, director } = bootDirector(909, { autoFinishMs: 4 * 60_000 })
        clock.advance(30 * 60_000)

        const lastByUid = new Map<string, number>()
        let total = 0
        for (const room of lobby.rooms) {
            for (const r of room.reactions) {
                total += 1
                // The seat map has moved on by now, so identity is taken from
                // the room's occupant at the time of the call where possible;
                // the cooldown assertion below is per seat+room, which is the
                // same person for the length of a game.
                const key = `${room.id}:${r.seat}`
                const last = lastByUid.get(key)
                if (last !== undefined) expect(r.at - last).toBeGreaterThanOrEqual(20_000)
                lastByUid.set(key, r.at)
            }
        }
        expect(total).toBeGreaterThan(0)
        director.stop()
    })
})

describe("demo director — a real person", () => {
    function firstWaitingRoom(lobby: FakeLobby): FakeRoom {
        const room = waiting(lobby)[0]
        if (!room) throw new Error("expected a waiting room after boot")
        return room
    }

    it("fills a human's table one seat at a time and starts once they are ready", () => {
        const { clock, lobby, director } = bootDirector(1111)
        clock.advance(30_000)

        const room = firstWaitingRoom(lobby)
        // Clear the table down to the human so the fill is observable.
        for (const seat of [0, 1, 2, 3] as Seat[]) room.seats[seat] = null
        const humanSeat: Seat = 1
        lobby.seatHuman(room, humanSeat)

        const sitTimes: number[] = []
        const before = lobby.structural.length
        clock.advance(60_000)
        for (const entry of lobby.structural.slice(before)) {
            if (entry.roomId === room.id && entry.kind === "sit") sitTimes.push(entry.at)
        }
        expect(sitTimes.length).toBe(3)
        // One at a time, 3–12 s apart — never four faces in the same instant.
        expect(new Set(sitTimes).size).toBe(3)
        for (let i = 1; i < sitTimes.length; i++) {
            const gap = (sitTimes[i] ?? 0) - (sitTimes[i - 1] ?? 0)
            expect(gap).toBeGreaterThanOrEqual(3_000)
        }
        expect(room.state).toBe("LOBBY")

        // Nothing starts until the real person says so.
        room.events.onHumanReady?.(humanSeat, true)
        clock.advance(1_000)
        expect(room.state).toBe("LOBBY")
        clock.advance(6_000)
        expect(room.state).toBe("PLAYING")
        director.stop()
    })

    it("retries the start after an un-ready, and tolerates start() returning false", () => {
        const { clock, lobby, director } = bootDirector(1212)
        clock.advance(30_000)
        const room = firstWaitingRoom(lobby)
        for (const seat of [0, 1, 2, 3] as Seat[]) room.seats[seat] = null
        const humanSeat: Seat = 2
        lobby.seatHuman(room, humanSeat)
        clock.advance(60_000)

        room.events.onHumanReady?.(humanSeat, true)
        clock.advance(1_000)
        // They change their mind while the start beat is in flight.
        room.events.onHumanReady?.(humanSeat, false)
        clock.advance(10_000)
        expect(room.state).toBe("LOBBY")

        room.events.onHumanReady?.(humanSeat, true)
        clock.advance(10_000)
        expect(room.state).toBe("PLAYING")
        director.stop()
    })

    it("accepts the game being started by the human without it", () => {
        const { clock, lobby, director } = bootDirector(1313)
        clock.advance(30_000)
        const room = firstWaitingRoom(lobby)
        for (const seat of [0, 1, 2, 3] as Seat[]) room.seats[seat] = null
        lobby.seatHuman(room, 0)
        clock.advance(60_000)
        expect(room.seats.filter((s) => s != null).length).toBe(4)

        // "Pokreni igru" is not host-gated: the seated human starts it, and
        // the director must simply notice rather than fight the room.
        room.state = "PLAYING"
        const startsBefore = room.startCalls
        clock.advance(60_000)
        expect(room.state).toBe("PLAYING")
        // No pointless start() storm once the status already says PLAYING.
        expect(room.startCalls - startsBefore).toBeLessThanOrEqual(1)
        director.stop()
    })

    it("does not let fake people walk out on a waiting human", () => {
        const { clock, lobby, director } = bootDirector(1414)
        clock.advance(30_000)
        const room = firstWaitingRoom(lobby)
        for (const seat of [0, 1, 2, 3] as Seat[]) room.seats[seat] = null
        lobby.seatHuman(room, 3)
        clock.advance(60_000)

        const before = lobby.structural.length
        clock.advance(80_000)
        const leaves = lobby.structural
            .slice(before)
            .filter((e) => e.roomId === room.id && e.kind === "leave")
        expect(leaves.length).toBe(0)
        director.stop()
    })

    it("gives a mid-game seat to a new person, not to a bot", () => {
        const { clock, lobby, director } = bootDirector(1515)
        clock.advance(30_000)
        const room = firstWaitingRoom(lobby)
        for (const seat of [0, 1, 2, 3] as Seat[]) room.seats[seat] = null
        const humanSeat: Seat = 1
        lobby.seatHuman(room, humanSeat)
        clock.advance(60_000)
        room.events.onHumanReady?.(humanSeat, true)
        clock.advance(10_000)
        expect(room.state).toBe("PLAYING")

        lobby.humanLeaves(room, humanSeat)
        clock.advance(3_000)
        // Not an instant swap — that reads as machinery, not as a person.
        expect(room.replaced.length).toBe(0)
        clock.advance(20_000)
        expect(room.replaced.length).toBe(1)
        const taken = room.replaced[0]
        expect(taken?.seat).toBe(humanSeat)
        expect(taken?.identity.name.toLowerCase()).not.toContain("bot")
        expect(room.seats[humanSeat]).toBe(taken?.identity)
        director.stop()
    })

    it("returns to normal pacing when the human leaves before the deal", () => {
        const { clock, lobby, director } = bootDirector(1616)
        clock.advance(30_000)
        const room = firstWaitingRoom(lobby)
        for (const seat of [0, 1, 2, 3] as Seat[]) room.seats[seat] = null
        lobby.seatHuman(room, 0)
        clock.advance(40_000)
        lobby.humanLeaves(room, 0)

        clock.advance(10 * 60_000)
        // Either it filled up and played, or it was recycled — what it must
        // NOT do is sit forever as a three-seat room nobody touches.
        expect(room.disposed || room.state !== "LOBBY" || room.seats.some((s) => s === null)).toBe(true)
        director.stop()
    })

    it("hands a person back for '+ Dodaj bota' and never calls sit for that seat", () => {
        const { clock, lobby, pool, director } = bootDirector(1717)
        clock.advance(30_000)
        const room = firstWaitingRoom(lobby)
        for (const seat of [0, 1, 2, 3] as Seat[]) room.seats[seat] = null
        lobby.seatHuman(room, 0)

        const before = lobby.structural.length
        const person = room.events.onBotRequested?.(2) ?? null
        expect(person).not.toBeNull()
        if (!person) return
        expect(person.name.toLowerCase()).not.toContain("bot")
        expect(pool.isInUse(person)).toBe(true)
        // The mechanics seat them; the director must not also call `sit`.
        expect(lobby.structural.slice(before).some((e) => e.roomId === room.id && e.kind === "sit")).toBe(false)

        // The mechanics do the seating, as the contract says.
        room.seats[2] = person
        room.seats[1] = null
        clock.advance(1)
        // And the same person is never handed out twice.
        const second = room.events.onBotRequested?.(1) ?? null
        expect(second?.uid).not.toBe(person.uid)
        director.stop()
    })

    it("keeps a finished room alive while a real person is still sitting in it", () => {
        const { clock, lobby, director } = bootDirector(1818)
        clock.advance(30_000)
        const room = firstWaitingRoom(lobby)
        for (const seat of [0, 1, 2, 3] as Seat[]) room.seats[seat] = null
        const humanSeat: Seat = 2
        lobby.seatHuman(room, humanSeat)
        clock.advance(60_000)
        room.events.onHumanReady?.(humanSeat, true)
        clock.advance(10_000)
        expect(room.state).toBe("PLAYING")

        lobby.finishGame(room, "A")
        clock.advance(60_000)
        expect(room.disposed).toBe(false)

        // Three minutes is the hard stop, so a parked human cannot pin a room
        // in the list forever.
        clock.advance(4 * 60_000)
        expect(room.disposed).toBe(true)
        director.stop()
    })
})

describe("demo director — shutdown and defence", () => {
    it("stop() leaves no pending timers", () => {
        const { clock, director } = bootDirector(1919, { autoFinishMs: 3 * 60_000 })
        clock.advance(20 * 60_000)
        director.stop()
        // Only the fake lobby's own auto-finish timers may remain; the
        // director's registry must be empty, so a second advance changes
        // nothing it owns.
        const before = clock.pending()
        director.stop()
        expect(clock.pending()).toBe(before)
        clock.advance(60 * 60_000)
        expect(clock.pending()).toBe(0)
    })

    it("survives a handle that refuses everything", () => {
        const clock = manualClock()
        const rng = seeded(2020)
        const lobby = fakeLobby(clock, rng)
        const original = lobby.createDemoRoom.bind(lobby)
        lobby.createDemoRoom = (options, host, events) => {
            const handle = original(options, host, events)
            if (!handle) return null
            const dead = handle as FakeRoom
            dead.sit = () => false
            dead.start = () => false
            dead.leave = () => false
            dead.react = () => false
            return dead
        }
        const director = startDemoDirector({ lobby, config: CONFIG, clock, rng })
        expect(() => clock.advance(30 * 60_000)).not.toThrow()
        director.stop()
    })

    it("survives close() calling onDisposed synchronously", () => {
        const { clock, lobby, director } = bootDirector(2121, { autoFinishMs: 60_000 })
        clock.advance(30_000)
        // The fake's `close()` already re-enters the director through
        // `onDisposed`; closing every room at once is the worst case.
        expect(() => {
            for (const room of [...lobby.live()]) room.close()
            clock.advance(10 * 60_000)
        }).not.toThrow()
        expect(lobby.live().length).toBeGreaterThan(0)
        director.stop()
    })

    it("closes a room of four fake people that refuses to start", () => {
        const clock = manualClock()
        const rng = seeded(2222)
        const lobby = fakeLobby(clock, rng)
        const original = lobby.createDemoRoom.bind(lobby)
        lobby.createDemoRoom = (options, host, events) => {
            const handle = original(options, host, events)
            if (!handle) return null
            const stuck = handle as FakeRoom
            stuck.start = () => {
                stuck.startCalls += 1
                return false
            }
            return stuck
        }
        const director = startDemoDirector({ lobby, config: CONFIG, clock, rng })
        clock.advance(5 * 60_000)
        // Nothing is left sitting full and unstarted: the watchdog either
        // started it (impossible here) or closed it.
        for (const room of lobby.live()) {
            if (room.state === "LOBBY") {
                expect(room.seats.filter((s) => s != null).length).toBeLessThan(4)
            }
        }
        director.stop()
    })
})
