/* ──────────────────────────────────────────────────────────────────────────
   DEMO LOBBY — WHEN things happen (game/DEMO-LOBBY.md §1, §2.2, §2.3).

   A population controller, nothing more. It never touches a seat array, a
   card or a socket: everything it does goes through `DemoRoomHandle` /
   `DemoLobbyApi`, and everything random or timed goes through the injected
   `rng` / `clock`. No `Date.now`, no `Math.random`, no bare `setTimeout` —
   the tests run a simulated hour in a few milliseconds and would not be able
   to otherwise.

   THE PACING MODEL, because it is the whole point:

   There is no such thing as a "playing room" and a "waiting room" here.
   There is one lifecycle — created with one or two people, trickles full,
   plays, empties, closes — and the RATE OF FILLING is the only control knob.
   When fewer rooms are playing than the current target, the fullest waiting
   room gets its fourth person soon; when enough are playing, waiting rooms
   are allowed to sit at two or three people for minutes. The playing/waiting
   ratio therefore emerges from pacing rather than being constructed, which is
   why the lobby never has that "five tables appeared at once" look.

   Targets themselves wander (re-drawn every 2–6 minutes inside the config
   band), the controller moves toward them ONE structural action at a time
   (`structural()` is a mutex on the clock: two rooms never change in the same
   instant), and the gaps between those actions are exponential-ish, 4–40 s.

   A real person suspends all of that for their room: seats fill one at a
   time, nobody fake walks out on them, and the director is what presses
   "start" because the host is a fake person who cannot press anything.
   ────────────────────────────────────────────────────────────────────── */

import { REACTIONS } from "@bela/protocol"
import type { GameEndRule, Seat, TargetScore } from "@bela/protocol"
import { log } from "../log.js"
import { createIdentityPool } from "./identities.js"
import type { DemoIdentityPool, DemoOutcome } from "./identities.js"
import type { DemoDirectorDeps as WiringDeps, DemoDirectorHandle, StartDemoDirector } from "./directorApi.js"
import type { DemoIdentity, DemoRoomEvents, DemoRoomHandle, DemoRoomOptions } from "./types.js"

/* ───────────────────────────── tuning ────────────────────────────────── */

/** Gaps between structural actions: mean ~12 s, never tidier than 4 s, never
 *  a gap so long the lobby looks frozen. */
const STRUCTURAL_GAP_MIN_MS = 4_000
const STRUCTURAL_GAP_MEAN_MS = 12_000
const STRUCTURAL_GAP_MAX_MS = 40_000

/** How long a target lasts before it is re-drawn (DEMO-LOBBY.md §1). */
const TARGET_REDRAW_MIN_MS = 120_000
const TARGET_REDRAW_MAX_MS = 360_000

/** The beat between the fourth fake person sitting down and the deal. */
const START_BEAT_MIN_MS = 2_000
const START_BEAT_MAX_MS = 6_000

/** After a game, people hang around before drifting off (§2.2). */
const LINGER_MIN_MS = 5_000
const LINGER_MAX_MS = 40_000

/** The same, but slower and gentler while a real person is still sitting. */
const HUMAN_LINGER_MIN_MS = 10_000
const HUMAN_LINGER_MAX_MS = 60_000
/** A finished room with a human in it closes anyway after this long. */
const HUMAN_ROOM_MAX_LINGER_MS = 180_000

/** A real person's missing team-mates arrive one at a time (§1). */
const HUMAN_FILL_MIN_MS = 3_000
const HUMAN_FILL_MAX_MS = 12_000
const HUMAN_START_MIN_MS = 2_000
const HUMAN_START_MAX_MS = 5_000
/** Their seat, once they are gone mid-game, is taken over by a new face. */
const HUMAN_REPLACE_MIN_MS = 4_000
const HUMAN_REPLACE_MAX_MS = 15_000
/** Only after this much silence may the room churn around a waiting human. */
const HUMAN_IDLE_MS = 90_000

/** A LOBBY room of four fake people that has not started by now is broken. */
const START_WATCHDOG_MS = 30_000
const SWEEP_MIN_MS = 10_000
const SWEEP_MAX_MS = 20_000

/** Reactions: a few per game, and never twice from one person inside this. */
const REACTION_CHECK_MIN_MS = 15_000
const REACTION_CHECK_MAX_MS = 45_000
const REACTION_PER_PERSON_COOLDOWN_MS = 20_000

/** Real activity the demo yields to: from this many real rooms up, the fake
 *  population shrinks (one room per structural action) toward the floor. */
const REAL_ROOMS_YIELD_FROM = 6
const DEMO_ROOM_FLOOR = 3

/** The lobby is believable within this long of a cold start. */
const BOOT_FIRST_MIN_MS = 300
const BOOT_FIRST_MAX_MS = 1_200
const BOOT_STEP_MIN_MS = 600
const BOOT_STEP_MAX_MS = 1_800

const SEATS: readonly Seat[] = [0, 1, 2, 3]

/* ───────────────────────────── types ─────────────────────────────────── */

/** `directorApi.ts` owns the signature the server wires up; the only thing
 *  added here is a test seam for the cast, so a test can inspect the very
 *  identities the director is handing out. */
export interface DemoDirectorDeps extends WiringDeps {
    pool?: DemoIdentityPool
}

type RoomPhase = "filling" | "playing" | "over" | "closing"

interface TimerRec {
    handle: unknown
    room: DirectedRoom | null
}

interface DirectedRoom {
    readonly id: string
    readonly handle: DemoRoomHandle
    /** Our own mirror of the FAKE occupants — authoritative, because a room
     *  we cannot explain is a room we close (§"never leak a room object"). */
    seats: (DemoIdentity | null)[]
    humanSeats: Set<Seat>
    humanReady: Map<Seat, boolean>
    phase: RoomPhase
    disposed: boolean
    released: boolean
    createdAt: number
    fullSince: number | null
    overAt: number | null
    winner: "A" | "B" | null
    lastHumanActivityAt: number
    /** A human-driven fill chain is already running; do not start a second. */
    humanFillRunning: boolean
    startPending: boolean
    timers: Set<TimerRec>
}

/* ───────────────────────────── rng helpers ───────────────────────────── */

function randInt(rng: () => number, min: number, max: number): number {
    if (max <= min) return min
    return min + Math.floor(rng() * (max - min + 1))
}

function pickFrom<T>(rng: () => number, xs: readonly T[]): T | null {
    if (xs.length === 0) return null
    return xs[Math.min(xs.length - 1, Math.floor(rng() * xs.length))] ?? null
}

/** Exponential-ish gap: mostly short, occasionally long, never on a grid. */
function gapMs(rng: () => number): number {
    const r = Math.min(0.999_999, Math.max(1e-6, rng()))
    const exp = -STRUCTURAL_GAP_MEAN_MS * Math.log(1 - r)
    return Math.round(Math.min(STRUCTURAL_GAP_MAX_MS, Math.max(STRUCTURAL_GAP_MIN_MS, exp)))
}

/* ───────────────────────────── director ──────────────────────────────── */

export const startDemoDirector = ((deps: DemoDirectorDeps): DemoDirectorHandle => {
    const { lobby, config, clock, rng } = deps
    const pool = deps.pool ?? createIdentityPool(rng, 90, clock)

    const rooms = new Map<string, DirectedRoom>()
    const timers = new Set<TimerRec>()
    const lastReactionAt = new Map<string, number>()

    let stopped = false
    /** The clock instant of the last structural action — the mutex that keeps
     *  two rooms from changing in the same tick. */
    let lastStructuralAt = Number.NEGATIVE_INFINITY
    let targetTotal = randInt(rng, config.totalRooms[0], config.totalRooms[1])
    let targetPlaying = clampPlaying(randInt(rng, config.playingRooms[0], config.playingRooms[1]))

    function clampPlaying(n: number): number {
        return Math.max(0, Math.min(n, targetTotal))
    }

    /* ── timers: one registry, so `stop()` really is a full stop ─────── */

    function schedule(ms: number, fn: () => void, room: DirectedRoom | null = null): TimerRec | null {
        if (stopped) return null
        if (room && room.disposed) return null
        const rec: TimerRec = { handle: null, room }
        timers.add(rec)
        room?.timers.add(rec)
        rec.handle = clock.setTimeout(() => {
            timers.delete(rec)
            rec.room?.timers.delete(rec)
            if (stopped) return
            if (rec.room && rec.room.disposed) return
            guard(fn)
        }, Math.max(0, Math.round(ms)))
        return rec
    }

    /** Nothing thrown inside a timer may take the server down: the demo lobby
     *  is scenery, and scenery must never be the reason a real game dies. */
    function guard(fn: () => void): void {
        try {
            fn()
        } catch (err) {
            log.warn("demo director step failed", { err })
        }
    }

    function clearRoomTimers(room: DirectedRoom): void {
        for (const rec of [...room.timers]) {
            room.timers.delete(rec)
            timers.delete(rec)
            try {
                clock.clearTimeout(rec.handle)
            } catch {
                /* a clock that cannot clear is still a stopped director */
            }
        }
    }

    /* ── the structural mutex ────────────────────────────────────────── */

    /**
     * One structural change per clock instant. Anything that alters the SHAPE
     * of the lobby — a room appearing or disappearing, a person sitting down
     * or standing up, a game starting — goes through here. A collision is
     * deferred by a fraction of a second rather than dropped, so the action
     * still happens, just visibly after the other one.
     */
    function structural(fn: () => void): void {
        if (stopped) return
        const now = clock.now()
        if (now === lastStructuralAt) {
            schedule(randInt(rng, 250, 1_200), () => structural(fn))
            return
        }
        lastStructuralAt = now
        guard(fn)
    }

    /* ── room bookkeeping ────────────────────────────────────────────── */

    function liveRooms(): DirectedRoom[] {
        // Always iterate a SNAPSHOT: a handle call inside the loop can fire
        // `onDisposed` synchronously and mutate `rooms` underneath us.
        return [...rooms.values()].filter((r) => !r.disposed)
    }

    function seatMapOf(room: DirectedRoom): (DemoIdentity | "HUMAN" | null)[] {
        try {
            return [...room.handle.seatMap()]
        } catch {
            return [null, null, null, null]
        }
    }

    function statusOf(room: DirectedRoom): "LOBBY" | "PLAYING" | "FINISHED" | null {
        try {
            return room.handle.status()
        } catch {
            return null
        }
    }

    function occupiedCount(room: DirectedRoom): number {
        return seatMapOf(room).reduce<number>((n, s) => n + (s === null ? 0 : 1), 0)
    }

    function freeSeats(room: DirectedRoom): Seat[] {
        const map = seatMapOf(room)
        return SEATS.filter((s) => (map[s] ?? null) === null)
    }

    function fakeSeats(room: DirectedRoom): Seat[] {
        return SEATS.filter((s) => room.seats[s] != null)
    }

    function isPlaying(room: DirectedRoom): boolean {
        return room.phase === "playing"
    }

    /**
     * `handle.status()` is the truth, not our phase. "Pokreni igru" is not
     * host-gated on the client, so any seated REAL person can start the game
     * out from under us; equally a game can end while a timer of ours is in
     * flight. Every scheduled action on a room re-reads the status first.
     */
    function syncPhase(room: DirectedRoom): "LOBBY" | "PLAYING" | "FINISHED" | null {
        if (room.disposed) return null
        const status = statusOf(room)
        if (status === null || room.phase === "closing") return status
        if (status === "PLAYING" && room.phase !== "playing") {
            room.phase = "playing"
            room.startPending = false
            room.fullSince = null
            armReactions(room)
        } else if (status === "FINISHED" && room.phase !== "over") {
            onGameOver(room, null)
        } else if (status === "LOBBY" && room.phase === "playing") {
            room.phase = "filling"
        }
        return status
    }

    function hasHuman(room: DirectedRoom): boolean {
        if (room.humanSeats.size > 0) return true
        try {
            return room.handle.humanCount() > 0
        } catch {
            return false
        }
    }

    function outcomeFor(room: DirectedRoom, seat: Seat): DemoOutcome {
        if (room.winner === null) return "left"
        const team = seat === 0 || seat === 2 ? "A" : "B"
        return team === room.winner ? "won" : "lost"
    }

    function releaseSeat(room: DirectedRoom, seat: Seat, outcome: DemoOutcome): void {
        const identity = room.seats[seat] ?? null
        if (!identity) return
        room.seats[seat] = null
        pool.release(identity, outcome, clock.now())
    }

    function releaseAll(room: DirectedRoom): void {
        if (room.released) return
        room.released = true
        for (const seat of SEATS) releaseSeat(room, seat, outcomeFor(room, seat))
    }

    /* ── options: the mix the lobby must always show ─────────────────── */

    function chooseOptions(): DemoRoomOptions {
        const live = liveRooms()
        const targets = live.map((r) => {
            try {
                return r.handle.options.targetScore
            } catch {
                return null
            }
        })

        let targetScore: TargetScore
        if (!targets.includes(501)) targetScore = 501
        else if (!targets.includes(701)) targetScore = 701
        else {
            const roll = rng()
            // "Brza 163" is a guest appearance, not a fixture.
            targetScore = roll < 0.08 ? 163 : roll < 0.20 ? 501 : roll < 0.32 ? 701 : 1001
        }

        // The quick discipline is always "prolaz" (it is three deals long —
        // "dosta" would be meaningless); the rest run roughly 65/35.
        const gameEndRule: GameEndRule = targetScore === 163 ? "prolaz" : rng() < 0.65 ? "prolaz" : "dosta"

        // Spectators are chosen at CREATION and counted across the whole live
        // set, so as rooms graduate from waiting to playing the playing set
        // converges on exactly `watchableRooms`.
        let watchable = 0
        let privateRooms = 0
        for (const r of live) {
            try {
                if (r.handle.options.allowSpectators) watchable += 1
                if (r.handle.options.private) privateRooms += 1
            } catch {
                /* a handle that cannot answer is one we are about to drop */
            }
        }
        const allowSpectators = watchable < config.watchableRooms

        // One or two locked rooms as scenery, never more.
        const isPrivate = privateRooms === 0 ? rng() < 0.6 : privateRooms === 1 ? rng() < 0.25 : false

        return { targetScore, gameEndRule, allowSpectators, private: isPrivate }
    }

    /* ── creating and closing ────────────────────────────────────────── */

    function createRoom(seatCount: number, startImmediately: boolean): DirectedRoom | null {
        const now = clock.now()
        const host = pool.acquire(now)
        if (!host) return null

        // The events are built BEFORE the room record exists (the handle is
        // what `createDemoRoom` returns), and the mechanics are free to fire
        // one synchronously from inside that call — hence the holder rather
        // than a closure over a `const` that is still in its dead zone.
        const holder: { room?: DirectedRoom } = {}
        let handle: DemoRoomHandle | null = null
        try {
            const options = chooseOptions()
            handle = lobby.createDemoRoom(options, host, roomEvents(() => holder.room))
        } catch (err) {
            log.warn("demo room creation threw", { err })
            handle = null
        }
        if (!handle) {
            pool.release(host, "left", now)
            return null
        }

        const room: DirectedRoom = {
            id: handle.id,
            handle,
            seats: [null, null, null, null],
            humanSeats: new Set(),
            humanReady: new Map(),
            phase: "filling",
            disposed: false,
            released: false,
            createdAt: now,
            fullSince: null,
            overAt: null,
            winner: null,
            lastHumanActivityAt: now,
            humanFillRunning: false,
            startPending: false,
            timers: new Set(),
        }
        holder.room = room
        rooms.set(room.id, room)

        // The lobby is free to seat the host itself; if it did not, do it.
        const map = seatMapOf(room)
        let hostSeated = false
        for (const seat of SEATS) {
            const occupant = map[seat] ?? null
            if (occupant !== null && occupant !== "HUMAN" && occupant.uid === host.uid) {
                room.seats[seat] = host
                hostSeated = true
            }
        }
        if (!hostSeated) {
            if (trySit(room, host, 0)) hostSeated = true
            else pool.release(host, "left", now)
        }

        // The rest of the opening cast sits down with the host: a room that
        // appears with two people in it is normal, a room that appears empty
        // and fills in the same second is not.
        const wanted = Math.max(1, seatCount) - (hostSeated ? 1 : 0)
        for (let i = 0; i < wanted; i++) {
            const person = pool.acquire(clock.now())
            if (!person) break
            const seat = pickFrom(rng, freeSeats(room))
            if (seat === null) {
                pool.release(person, "left", clock.now())
                break
            }
            if (!trySit(room, person, seat)) {
                pool.release(person, "left", clock.now())
                break
            }
        }

        if (startImmediately) {
            if (occupiedCount(room) >= 4) tryStart(room)
        } else if (occupiedCount(room) >= 4) {
            armStartBeat(room)
        }
        armWatchdog(room)
        return room
    }

    function trySit(room: DirectedRoom, identity: DemoIdentity, seat: Seat): boolean {
        let ok = false
        try {
            ok = room.handle.sit(identity, seat)
        } catch (err) {
            log.warn("demo sit threw", { roomId: room.id, err })
            ok = false
        }
        if (ok) room.seats[seat] = identity
        return ok
    }

    function tryStart(room: DirectedRoom): boolean {
        if (room.disposed || room.phase === "playing") return false
        let ok = false
        try {
            ok = room.handle.start()
        } catch (err) {
            log.warn("demo start threw", { roomId: room.id, err })
            ok = false
        }
        room.startPending = false
        if (ok) {
            room.phase = "playing"
            room.fullSince = null
            armReactions(room)
        }
        return ok
    }

    function closeRoom(room: DirectedRoom): void {
        if (room.disposed || room.phase === "closing") return
        room.phase = "closing"
        clearRoomTimers(room)
        releaseAll(room)
        try {
            room.handle.close()
        } catch (err) {
            log.warn("demo close threw", { roomId: room.id, err })
        }
        // `close()` may or may not have called `onDisposed` synchronously;
        // either way the room must not survive in our table.
        schedule(0, () => {
            const known = rooms.get(room.id)
            if (known === room) rooms.delete(room.id)
        })
    }

    /* ── events from the mechanics ───────────────────────────────────── */

    function roomEvents(self: () => DirectedRoom | undefined): DemoRoomEvents {
        return {
            onHumanSeated: (seat: Seat) => guard(() => onHumanSeated(self(), seat)),
            onHumanReady: (seat: Seat, ready: boolean) => guard(() => onHumanReady(self(), seat, ready)),
            onHumanGone: (seat: Seat) => guard(() => onHumanGone(self(), seat)),
            onBotRequested: (seat: Seat): DemoIdentity | null => onBotRequested(self(), seat),
            onGameOver: (winner: "A" | "B" | null) => guard(() => onGameOver(self(), winner)),
            onDisposed: () => guard(() => onDisposed(self())),
        }
    }

    function onDisposed(room: DirectedRoom | undefined): void {
        if (!room) return
        room.disposed = true
        clearRoomTimers(room)
        releaseAll(room)
        // Deferred so a synchronous `close() → onDisposed` cannot mutate the
        // table while an enclosing loop is walking it.
        schedule(0, () => {
            const known = rooms.get(room.id)
            if (known === room) rooms.delete(room.id)
        })
    }

    /**
     * "+ Dodaj bota" on a free seat, pressed by a real person in a demo room.
     * We hand back a PERSON and book the seat ourselves — the mechanics seat
     * them, so calling `sit` here too would fight it. Called synchronously
     * from inside the mechanics' message handler, so nothing here may re-enter
     * the handle; the "are we four now?" follow-up is deferred to the next
     * tick like every other re-entrancy hazard in this file.
     */
    function onBotRequested(room: DirectedRoom | undefined, seat: Seat): DemoIdentity | null {
        if (!room || room.disposed || room.phase === "closing") return null
        const person = pool.acquire(clock.now())
        if (!person) return null
        room.seats[seat] = person
        room.humanSeats.delete(seat)
        schedule(
            0,
            () => {
                if (room.disposed) return
                if (syncPhase(room) !== "LOBBY" || room.phase !== "filling") return
                if (occupiedCount(room) < 4) return
                if (room.humanSeats.size > 0) maybeStartForHuman(room)
                else armStartBeat(room)
            },
            room,
        )
        return person
    }

    function onGameOver(room: DirectedRoom | undefined, winner: "A" | "B" | null): void {
        if (!room || room.disposed || room.phase === "over" || room.phase === "closing") return
        room.phase = "over"
        room.winner = winner
        room.overAt = clock.now()

        // A reaction or two while the result is on screen.
        const cheers = randInt(rng, 1, 2)
        for (let i = 0; i < cheers; i++) {
            schedule(randInt(rng, 800, 6_000), () => emitReaction(room), room)
        }
        armDeparture(room)
    }

    function onHumanSeated(room: DirectedRoom | undefined, seat: Seat): void {
        if (!room || room.disposed) return
        room.humanSeats.add(seat)
        room.seats[seat] = null
        room.lastHumanActivityAt = clock.now()
        // This room leaves the population pacing entirely: a real person
        // waiting is the one case where speed beats realism.
        armHumanFill(room)
    }

    function onHumanReady(room: DirectedRoom | undefined, seat: Seat, ready: boolean): void {
        if (!room || room.disposed) return
        room.humanReady.set(seat, ready)
        room.lastHumanActivityAt = clock.now()
        if (!ready || room.phase !== "filling") return
        maybeStartForHuman(room)
    }

    function onHumanGone(room: DirectedRoom | undefined, seat: Seat): void {
        if (!room || room.disposed) return
        room.humanSeats.delete(seat)
        room.humanReady.delete(seat)
        room.lastHumanActivityAt = clock.now()

        if (statusOf(room) === "PLAYING") {
            // Mid-game: a NEW FACE takes the seat, never "Bot Ana" (§2.3).
            schedule(
                randInt(rng, HUMAN_REPLACE_MIN_MS, HUMAN_REPLACE_MAX_MS),
                () => {
                    if (room.disposed || statusOf(room) !== "PLAYING") return
                    const replacement = pool.acquire(clock.now())
                    if (!replacement) return
                    structural(() => {
                        let ok = false
                        try {
                            ok = room.handle.replace(seat, replacement)
                        } catch (err) {
                            log.warn("demo replace threw", { roomId: room.id, err })
                        }
                        if (ok) room.seats[seat] = replacement
                        else pool.release(replacement, "left", clock.now())
                    })
                },
                room,
            )
            return
        }
        // Before the deal: the room simply rejoins the normal pacing.
        room.startPending = false
    }

    /* ── the human fast path ─────────────────────────────────────────── */

    function armHumanFill(room: DirectedRoom): void {
        if (room.humanFillRunning) return
        room.humanFillRunning = true
        stepHumanFill(room)
    }

    function stepHumanFill(room: DirectedRoom): void {
        if (room.disposed || room.phase !== "filling") {
            room.humanFillRunning = false
            return
        }
        if (room.humanSeats.size === 0) {
            room.humanFillRunning = false
            return
        }
        const free = freeSeats(room)
        if (free.length === 0) {
            room.humanFillRunning = false
            maybeStartForHuman(room)
            return
        }
        // One seat at a time, 3–12 s apart: four people materialising at once
        // is the tell §3 warns about.
        schedule(
            randInt(rng, HUMAN_FILL_MIN_MS, HUMAN_FILL_MAX_MS),
            () => {
                // A seated human may have pressed "Pokreni igru" themselves
                // while this timer was in flight — re-read before acting.
                syncPhase(room)
                if (room.disposed || room.phase !== "filling" || room.humanSeats.size === 0) {
                    room.humanFillRunning = false
                    return
                }
                const seat = pickFrom(rng, freeSeats(room))
                const person = seat === null ? null : pool.acquire(clock.now())
                if (seat !== null && person) {
                    structural(() => {
                        if (!trySit(room, person, seat)) pool.release(person, "left", clock.now())
                        room.humanFillRunning = false
                        stepHumanFill(room)
                    })
                    return
                }
                room.humanFillRunning = false
                stepHumanFill(room)
            },
            room,
        )
    }

    function everyHumanReady(room: DirectedRoom): boolean {
        for (const seat of room.humanSeats) {
            if (room.humanReady.get(seat) !== true) return false
        }
        return room.humanSeats.size > 0
    }

    function maybeStartForHuman(room: DirectedRoom): void {
        if (room.disposed || room.phase !== "filling" || room.startPending) return
        if (occupiedCount(room) < 4 || !everyHumanReady(room)) return
        room.startPending = true
        schedule(
            randInt(rng, HUMAN_START_MIN_MS, HUMAN_START_MAX_MS),
            () => {
                room.startPending = false
                syncPhase(room)
                if (room.disposed || room.phase !== "filling") return
                if (occupiedCount(room) < 4 || !everyHumanReady(room)) return
                // A `false` here is ordinary — somebody un-readied between the
                // timer being set and it firing, or a seated human started the
                // game themselves. The next ready event retries.
                structural(() => {
                    tryStart(room)
                })
            },
            room,
        )
    }

    /* ── start beat and watchdog for all-fake rooms ──────────────────── */

    function armStartBeat(room: DirectedRoom): void {
        if (room.startPending || room.phase !== "filling") return
        if (room.humanSeats.size > 0) {
            maybeStartForHuman(room)
            return
        }
        room.startPending = true
        room.fullSince = clock.now()
        schedule(
            randInt(rng, START_BEAT_MIN_MS, START_BEAT_MAX_MS),
            () => {
                room.startPending = false
                syncPhase(room)
                if (room.disposed || room.phase !== "filling") return
                if (room.humanSeats.size > 0) {
                    maybeStartForHuman(room)
                    return
                }
                if (occupiedCount(room) < 4) return
                structural(() => {
                    tryStart(room)
                })
            },
            room,
        )
    }

    function armWatchdog(room: DirectedRoom): void {
        schedule(
            START_WATCHDOG_MS + randInt(rng, 0, 5_000),
            () => {
                if (room.disposed) return
                syncPhase(room)
                if (room.phase !== "filling") return
                if (room.humanSeats.size > 0) return
                if (occupiedCount(room) < 4) {
                    armWatchdog(room)
                    return
                }
                // Four fake people and still no deal: force it, and if the
                // room refuses, it is not a room we can explain — close it.
                structural(() => {
                    if (!tryStart(room)) closeRoom(room)
                    else armWatchdog(room)
                })
            },
            room,
        )
    }

    /* ── after the game: linger, then leave one by one ───────────────── */

    function armDeparture(room: DirectedRoom): void {
        const human = hasHuman(room)
        const min = human ? HUMAN_LINGER_MIN_MS : LINGER_MIN_MS
        const max = human ? HUMAN_LINGER_MAX_MS : LINGER_MAX_MS
        const seated = fakeSeats(room)
        if (seated.length === 0) {
            finishDeparture(room)
            return
        }
        // Spread the departures across the linger window; each person leaves
        // on their own timer, so nobody ever walks out in lockstep.
        const order = [...seated]
        for (let i = order.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1))
            const a = order[i]
            const b = order[j]
            if (a === undefined || b === undefined) continue
            order[i] = b
            order[j] = a
        }
        let at = randInt(rng, min, Math.max(min + 1, Math.floor(max / 2)))
        for (const seat of order) {
            const when = at
            schedule(
                when,
                () => {
                    if (room.disposed) return
                    structural(() => {
                        try {
                            room.handle.leave(seat)
                        } catch (err) {
                            log.warn("demo leave threw", { roomId: room.id, err })
                        }
                        releaseSeat(room, seat, outcomeFor(room, seat))
                    })
                },
                room,
            )
            at += randInt(rng, 1_200, Math.max(2_000, Math.floor((max - min) / 3)))
        }
        schedule(at + randInt(rng, 1_000, 6_000), () => finishDeparture(room), room)
    }

    function finishDeparture(room: DirectedRoom): void {
        if (room.disposed) return
        if (hasHuman(room)) {
            const since = room.overAt ?? clock.now()
            if (clock.now() - since < HUMAN_ROOM_MAX_LINGER_MS) {
                // Wait for the real person to leave on their own; three
                // minutes is the hard stop so a parked human cannot pin a
                // room in the list forever.
                schedule(randInt(rng, 5_000, 15_000), () => finishDeparture(room), room)
                return
            }
        }
        structural(() => closeRoom(room))
    }

    /* ── reactions ───────────────────────────────────────────────────── */

    function armReactions(room: DirectedRoom): void {
        schedule(
            randInt(rng, REACTION_CHECK_MIN_MS, REACTION_CHECK_MAX_MS),
            () => {
                if (room.disposed || !isPlaying(room)) return
                // Not every window produces one — that is what keeps it from
                // reading as a metronome.
                if (rng() < 0.45) emitReaction(room)
                armReactions(room)
            },
            room,
        )
    }

    function emitReaction(room: DirectedRoom): void {
        if (room.disposed) return
        const now = clock.now()
        const candidates = fakeSeats(room).filter((s) => {
            const identity = room.seats[s]
            if (!identity) return false
            const last = lastReactionAt.get(identity.uid)
            return last === undefined || now - last >= REACTION_PER_PERSON_COOLDOWN_MS
        })
        const seat = pickFrom(rng, candidates)
        if (seat === null) return
        const identity = room.seats[seat]
        const reaction = pickFrom(rng, REACTIONS)
        if (!identity || reaction === null) return
        try {
            if (room.handle.react(seat, reaction)) lastReactionAt.set(identity.uid, now)
        } catch (err) {
            log.warn("demo react threw", { roomId: room.id, err })
        }
    }

    /* ── the population loop ─────────────────────────────────────────── */

    function effectiveTotal(): number {
        let real = 0
        try {
            real = lobby.realRoomCount()
        } catch {
            real = 0
        }
        if (real < REAL_ROOMS_YIELD_FROM) return targetTotal
        // Yield gradually: every real room past the threshold costs the demo
        // population one room, down to a floor of three.
        const shrunk = targetTotal - (real - REAL_ROOMS_YIELD_FROM + 1)
        return Math.max(DEMO_ROOM_FLOOR, Math.min(targetTotal, shrunk))
    }

    /** Rooms the population loop is allowed to touch: no humans inside. */
    function pacedRooms(): DirectedRoom[] {
        return liveRooms().filter((r) => r.humanSeats.size === 0 && !hasHuman(r))
    }

    function structuralStep(): void {
        if (stopped) return
        const wantTotal = effectiveTotal()
        const live = liveRooms()
        const paced = pacedRooms()
        const playing = live.filter(isPlaying).length
        const waiting = paced.filter((r) => r.phase === "filling")

        if (live.length < wantTotal) {
            structural(() => {
                createRoom(randInt(rng, 1, 2), false)
            })
            return
        }

        // The mix is only ever repaired at CREATION (`chooseOptions`), so when
        // the last 501 or 701 table finishes and closes, the lobby would go
        // without one until the population happened to need a new room. A
        // missing target is itself a reason to open a room — one over the
        // wandering target is fine, the hard ceiling is not.
        const offered = live.map((r) => r.handle.options.targetScore)
        const mixBroken = !offered.includes(501) || !offered.includes(701)
        if (mixBroken && live.length <= config.totalRooms[1]) {
            structural(() => {
                createRoom(randInt(rng, 1, 2), false)
            })
            return
        }

        if (live.length > wantTotal) {
            // Prefer a room that has already served its purpose.
            const over = paced.find((r) => r.phase === "over")
            const emptiest = [...waiting].sort((a, b) => occupiedCount(a) - occupiedCount(b))[0]
            const victim = over ?? emptiest ?? null
            if (victim) {
                structural(() => closeRoom(victim))
                return
            }
        }

        if (waiting.length === 0) return

        if (playing < targetPlaying) {
            // Push the fullest waiting room over the line first — this is the
            // ONLY thing holding the playing/waiting ratio.
            const fullest = [...waiting].sort((a, b) => occupiedCount(b) - occupiedCount(a))[0]
            if (fullest) {
                structural(() => addPerson(fullest))
            }
            return
        }

        // Enough tables are playing: waiting rooms breathe instead of filling.
        // They sit at two or three for minutes, and sometimes somebody leaves.
        const roll = rng()
        if (roll < 0.25) {
            const leavers = waiting.filter((r) => occupiedCount(r) >= 2)
            const room = pickFrom(rng, leavers)
            if (room) {
                structural(() => removePerson(room))
            }
            return
        }
        // Only up to three, so the room stays a waiting room; the variety of
        // one, two and three free seats comes from here.
        const fillable = waiting.filter((r) => occupiedCount(r) < 3)
        const room = pickFrom(rng, fillable)
        if (room) {
            structural(() => addPerson(room))
        }
    }

    function addPerson(room: DirectedRoom): void {
        if (room.disposed) return
        syncPhase(room)
        if (room.phase !== "filling") return
        const seat = pickFrom(rng, freeSeats(room))
        if (seat === null) return
        const person = pool.acquire(clock.now())
        if (!person) return
        if (!trySit(room, person, seat)) {
            pool.release(person, "left", clock.now())
            return
        }
        if (occupiedCount(room) >= 4) armStartBeat(room)
    }

    function removePerson(room: DirectedRoom): void {
        if (room.disposed) return
        syncPhase(room)
        if (room.phase !== "filling") return
        const seats = fakeSeats(room)
        // Never empty a room this way; an empty room is the population loop's
        // job to close, not a person's to cause.
        if (seats.length <= 1) return
        const seat = pickFrom(rng, seats)
        if (seat === null) return
        try {
            if (!room.handle.leave(seat)) return
        } catch (err) {
            log.warn("demo leave threw", { roomId: room.id, err })
            return
        }
        releaseSeat(room, seat, "left")
    }

    function loop(): void {
        schedule(gapMs(rng), () => {
            structuralStep()
            loop()
        })
    }

    function redrawTargets(): void {
        schedule(randInt(rng, TARGET_REDRAW_MIN_MS, TARGET_REDRAW_MAX_MS), () => {
            targetTotal = randInt(rng, config.totalRooms[0], config.totalRooms[1])
            targetPlaying = clampPlaying(randInt(rng, config.playingRooms[0], config.playingRooms[1]))
            redrawTargets()
        })
    }

    /* ── the sweep: watchdogs, idle humans, rooms we cannot explain ──── */

    function sweep(): void {
        schedule(randInt(rng, SWEEP_MIN_MS, SWEEP_MAX_MS), () => {
            const now = clock.now()
            for (const room of liveRooms()) {
                const status = statusOf(room)
                if (status === null) {
                    // A handle that will not answer is a room we cannot
                    // explain; drop it rather than leak it.
                    structural(() => closeRoom(room))
                    continue
                }
                // Resync: a real person may have started the game, or it may
                // have ended, without an event of ours ever firing.
                syncPhase(room)

                if (room.phase === "filling" && room.humanSeats.size === 0 && occupiedCount(room) === 0) {
                    structural(() => closeRoom(room))
                    continue
                }

                // A human parked in a lobby seat: after a minute and a half of
                // silence the room is allowed a little churn again, rarely.
                if (
                    room.phase === "filling" &&
                    room.humanSeats.size > 0 &&
                    now - room.lastHumanActivityAt > HUMAN_IDLE_MS &&
                    rng() < 0.2
                ) {
                    structural(() => removePerson(room))
                    schedule(randInt(rng, 6_000, 20_000), () => structural(() => addPerson(room)), room)
                }
            }
            sweep()
        })
    }

    /* ── boot ────────────────────────────────────────────────────────── */

    /**
     * A cold start must not look like a cold start. The playing quota is
     * created as full rooms and started, then the waiting rooms follow — one
     * room per tick, spread over the first ~20 s.
     *
     * The handle has no fast-forward, so these games genuinely begin at 0:0;
     * DEMO-LOBBY.md §2.2 wants a few deals rewound, which only the mechanics
     * side can provide.
     */
    function boot(): void {
        let at = randInt(rng, BOOT_FIRST_MIN_MS, BOOT_FIRST_MAX_MS)
        for (let i = 0; i < targetPlaying; i++) {
            schedule(at, () => {
                structural(() => {
                    createRoom(4, true)
                })
            })
            at += randInt(rng, BOOT_STEP_MIN_MS, BOOT_STEP_MAX_MS)
        }
        const waitingCount = Math.max(0, targetTotal - targetPlaying)
        for (let i = 0; i < waitingCount; i++) {
            schedule(at, () => {
                structural(() => {
                    createRoom(randInt(rng, 1, 3), false)
                })
            })
            at += randInt(rng, BOOT_STEP_MIN_MS, BOOT_STEP_MAX_MS)
        }
        schedule(at + 500, () => {
            loop()
        })
    }

    log.warn("DEMO LOBBY ACTIVE — fake players are in the lobby; never ship this enabled", {
        totalRooms: config.totalRooms,
        playingRooms: config.playingRooms,
        watchableRooms: config.watchableRooms,
        cast: pool.size,
    })

    boot()
    redrawTargets()
    sweep()

    return {
        stop(): void {
            if (stopped) return
            stopped = true
            for (const rec of [...timers]) {
                timers.delete(rec)
                rec.room?.timers.delete(rec)
                try {
                    clock.clearTimeout(rec.handle)
                } catch {
                    /* nothing left to do; the director is down either way */
                }
            }
            rooms.clear()
        },
    }
}) satisfies StartDemoDirector
