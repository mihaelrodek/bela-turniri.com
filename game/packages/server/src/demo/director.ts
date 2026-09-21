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

   THE THREE-SEAT DEADLINE (owner, 2026-09-21). Pacing alone produced tables
   sitting at 3/4 for many minutes, which no real table ever does: a fourth
   turns up within a minute, or somebody gives up. So a room that reaches THREE
   draws a deadline of 20–70 s, and at that deadline exactly one of two things
   happens — the fourth arrives and the game starts, or somebody leaves and the
   room drops to two (and may climb again later, with a NEW deadline). Starts
   are therefore TIME-driven rather than quota-driven, and the quota is held
   from the other side instead: above target, nothing is pushed past two and
   finished tables wind down fast. A waiting room that has never started after
   6–10 minutes fills up or is closed, so the list visibly turns over.

   GUESTS IN REAL ROOMS (DEMO-LOBBY.md "Gosti u pravim sobama"). A separate,
   much smaller loop: fake people trickle into PUBLIC waiting rooms real people
   opened, through `RealRoomHandle`. Those rooms are REAL rooms and are counted
   outside every demo total here — the director services at most two of them and
   gets out of the way entirely once the lobby has real activity of its own.
   ────────────────────────────────────────────────────────────────────── */

import { REACTIONS } from "@bela/protocol"
import type { GameEndRule, Seat, TargetScore } from "@bela/protocol"
import { log } from "../log.js"
import { createIdentityPool } from "./identities.js"
import type { DemoIdentityPool, DemoOutcome } from "./identities.js"
import type { DemoDirectorDeps as WiringDeps, DemoDirectorHandle, StartDemoDirector } from "./directorApi.js"
import type {
    DemoIdentity,
    DemoRoomEvents,
    DemoRoomHandle,
    DemoRoomOptions,
    RealRoomHandle,
} from "./types.js"

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

/**
 * A room sitting at THREE seated has this long before it resolves one way or
 * the other. Upper bound deliberately under the ~90 s a watcher would call
 * "they are obviously waiting for a real person".
 */
const THREE_DEADLINE_MIN_MS = 20_000
const THREE_DEADLINE_MAX_MS = 70_000
/** At the deadline: this often the fourth turns up, otherwise somebody leaves. */
const THREE_FOURTH_CHANCE = 0.65

/** A waiting room that has never started by now fills up or is replaced. */
const STALE_ROOM_MIN_MS = 6 * 60_000
const STALE_ROOM_MAX_MS = 10 * 60_000
/** The rush that empties a stale room's chairs, one person at a time. */
const RUSH_FILL_MIN_MS = 1_500
const RUSH_FILL_MAX_MS = 5_000

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

/* ── guests in rooms real people opened ───────────────────────────────── */

/** How often the guest loop looks at the real rooms it is servicing. */
const GUEST_TICK_MIN_MS = 4_000
const GUEST_TICK_MAX_MS = 9_000
/** Never more than this many real rooms at once, and none at all once the
 *  lobby has real activity of its own (`REAL_ROOMS_YIELD_FROM`). */
const GUEST_ROOMS_MAX = 2
/** Nobody turns up the second a table opens: people need time to invite
 *  friends, and a room that fills instantly is the tell §3 warns about. */
const GUEST_FIRST_MIN_MS = 25_000
const GUEST_FIRST_MAX_MS = 60_000
const GUEST_NEXT_MIN_MS = 10_000
const GUEST_NEXT_MAX_MS = 35_000
/** A real person arriving or leaving restarts the quiet period. */
const GUEST_QUIET_MIN_MS = 15_000
const GUEST_QUIET_MAX_MS = 40_000
/**
 * The LAST free chair is left alone while ONE real person sits in a room this
 * young: they may be waiting for a friend, and filling their table would be
 * the app taking that decision for them. After it, the fourth may come.
 */
const GUEST_LAST_SEAT_HOLD_MS = 120_000
/** A guest who has waited this long in a table that never starts gives up. */
const GUEST_GIVE_UP_MIN_MS = 4 * 60_000
const GUEST_GIVE_UP_MAX_MS = 6 * 60_000
/** After the game, guests drift off one by one across this window. */
const GUEST_DEPART_MIN_MS = 10_000
const GUEST_DEPART_MAX_MS = 60_000
/** Chance per tick that a guest in a running real game says something. */
const GUEST_REACTION_CHANCE = 0.06

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
    /** The running three-seat deadline, if the room is sitting at three. */
    threeTimer: TimerRec | null
    /** Clock instant after which a room that never started is recycled. */
    staleAt: number
    /** A stale room is being filled to four on purpose; the three-seat
     *  deadline must not fight it by pulling somebody back out. */
    rushing: boolean
    timers: Set<TimerRec>
}

/** One real room the guest loop is servicing. */
interface GuestRoom {
    readonly id: string
    handle: RealRoomHandle
    /** Our mirror, reconciled against `handle.guests()` on every tick. */
    guests: Map<string, DemoIdentity>
    /** uid → the instant that guest gives up waiting and leaves. */
    giveUpAt: Map<string, number>
    /** uid → when they drift off after the game (set once it is over). */
    departAt: Map<string, number>
    /** No guest may arrive before this: the room is young, or a real person
     *  just came or went. */
    quietUntil: number
    /** Earliest arrival for the NEXT guest, once the quiet period is over. */
    nextGuestAt: number
    /** The game has run at least once, so departures rather than arrivals. */
    played: boolean
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
        room.threeTimer = null
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
            room.rushing = false
            room.threeTimer = null
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
            threeTimer: null,
            staleAt: now + randInt(rng, STALE_ROOM_MIN_MS, STALE_ROOM_MAX_MS),
            rushing: false,
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
        armThreeDeadline(room)
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
            room.rushing = false
            room.threeTimer = null
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
        // Before the deal: the room simply rejoins the normal pacing — which
        // now includes the three-seat deadline if that is where it was left.
        room.startPending = false
        armThreeDeadline(room)
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

    /* ── the three-seat deadline (owner, 2026-09-21) ─────────────────── */

    function playingCount(): number {
        return liveRooms().filter(isPlaying).length
    }

    /** Full, all-fake rooms whose start beat is already ticking. They count
     *  against the ceiling: two deadlines resolving seconds apart must not both
     *  believe they are the one table that still fits. */
    function pendingStartCount(): number {
        return liveRooms().filter((r) => !isPlaying(r) && r.startPending && r.humanSeats.size === 0).length
    }

    /**
     * Is there room for one MORE playing table?
     *
     * One above the wandering target is allowed — starts are time-driven now,
     * so the average is held by holding rooms at two on the other side, not by
     * refusing the fourth person who is already on their way. The band's own
     * maximum plus one is the hard ceiling and is never crossed.
     *
     * ALWAYS evaluated inside `structural()`, so the answer cannot go stale
     * between being read and being acted on.
     */
    function startHeadroom(): boolean {
        const ceiling = Math.min(targetPlaying + 1, config.playingRooms[1] + 1)
        return playingCount() + pendingStartCount() + 1 <= ceiling
    }

    /**
     * A room just reached three seated: draw its deadline. Re-armed rather than
     * refreshed — a room that drops to two and climbs back gets a NEW one, so
     * the wait never compounds into the "obviously waiting for a human" look.
     */
    function armThreeDeadline(room: DirectedRoom): void {
        if (room.disposed || room.phase !== "filling" || room.rushing) return
        if (room.threeTimer) return
        // A real person's table has its own, faster pacing (§2.3) and is never
        // one of these: nobody fake walks out on a human.
        if (room.humanSeats.size > 0 || hasHuman(room)) return
        if (occupiedCount(room) !== 3) return
        room.threeTimer = schedule(
            randInt(rng, THREE_DEADLINE_MIN_MS, THREE_DEADLINE_MAX_MS),
            () => {
                room.threeTimer = null
                resolveThree(room)
            },
            room,
        )
    }

    /** The deadline fired: the fourth arrives, or somebody gives up. */
    function resolveThree(room: DirectedRoom): void {
        if (room.disposed) return
        syncPhase(room)
        if (room.phase !== "filling" || room.rushing) return
        if (room.humanSeats.size > 0 || hasHuman(room)) return
        if (occupiedCount(room) !== 3) {
            // It moved while the timer was in flight; whatever moved it will
            // arm a fresh deadline if it is back at three.
            armThreeDeadline(room)
            return
        }
        // 65/35 toward the fourth arriving — drawn here, but only honoured
        // inside the mutex below, where the headroom answer is still true.
        const wantsFourth = rng() < THREE_FOURTH_CHANCE
        structural(() => {
            if (room.disposed || room.phase !== "filling") return
            if (occupiedCount(room) !== 3) return
            // With no headroom there is only one believable outcome left, and
            // it is the one that also relieves the pressure: somebody leaves.
            if (wantsFourth && startHeadroom()) addPerson(room)
            else removePerson(room)
        })
    }

    /**
     * A waiting room old enough to be suspicious: fill it to four and let it
     * play, or close it so a fresh one takes its place. Either way the list
     * turns over, which is the thing a watcher actually notices.
     */
    function recycleStale(room: DirectedRoom): void {
        if (room.disposed || room.phase !== "filling" || room.rushing) return
        if (room.humanSeats.size > 0 || hasHuman(room)) return
        structural(() => {
            if (room.disposed || room.phase !== "filling" || room.rushing) return
            if (!startHeadroom() || occupiedCount(room) === 0) {
                closeRoom(room)
                return
            }
            room.rushing = true
            room.threeTimer = null
            rushFill(room)
        })
    }

    /** The stale room's remaining chairs, one person at a time. */
    function rushFill(room: DirectedRoom): void {
        if (room.disposed || room.phase !== "filling" || room.humanSeats.size > 0) return
        if (occupiedCount(room) >= 4) {
            armStartBeat(room)
            return
        }
        schedule(
            randInt(rng, RUSH_FILL_MIN_MS, RUSH_FILL_MAX_MS),
            () => {
                if (room.disposed) return
                syncPhase(room)
                if (room.phase !== "filling" || room.humanSeats.size > 0) return
                structural(() => {
                    addPerson(room)
                    rushFill(room)
                })
            },
            room,
        )
    }

    /* ── after the game: linger, then leave one by one ───────────────── */

    function armDeparture(room: DirectedRoom): void {
        const human = hasHuman(room)
        // The other half of the three-seat deadline's bargain: because starts
        // are now time-driven and may run one over target, a finished table
        // that the lobby no longer needs winds down quickly rather than
        // lingering for the full 40 s.
        const crowded = !human && playingCount() >= targetPlaying
        const min = human ? HUMAN_LINGER_MIN_MS : crowded ? 3_000 : LINGER_MIN_MS
        const max = human ? HUMAN_LINGER_MAX_MS : crowded ? 15_000 : LINGER_MAX_MS
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
        // Up to three, so the room stays a waiting room and the variety of one,
        // two and three free seats comes from here — EXCEPT while more tables
        // are playing than the target wants. Then arrivals only ever take a
        // room from one to two: nothing is pushed to three, because three is
        // now a countdown to a start (`armThreeDeadline`) and that is exactly
        // what the lobby has too much of.
        const cap = playing > targetPlaying ? 2 : 3
        const fillable = waiting.filter((r) => occupiedCount(r) < cap)
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
        // Three seated starts a clock: this room now resolves within a minute
        // or so instead of sitting there advertising a free chair for ages.
        else armThreeDeadline(room)
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

                if (room.phase === "filling" && room.humanSeats.size === 0 && !hasHuman(room)) {
                    // Backstop for the three-seat deadline: every path that
                    // reaches three arms one itself, but a room that got there
                    // some other way (a human left it at three, a handle moved
                    // under us) must not escape the rule.
                    armThreeDeadline(room)
                    // And the room that never started at all: recycled, so the
                    // list is not the same eight rows it was ten minutes ago.
                    if (now > room.staleAt) recycleStale(room)
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

    /* ── guests in rooms real people opened ──────────────────────────── */

    const guestRooms = new Map<string, GuestRoom>()

    /** Books a guest back into the pool; always paired with them leaving. */
    function releaseGuest(gr: GuestRoom, uid: string): void {
        const identity = gr.guests.get(uid)
        gr.guests.delete(uid)
        gr.giveUpAt.delete(uid)
        gr.departAt.delete(uid)
        // "left", never won/lost: a guest's record moves only for games the
        // DIRECTOR ran, and it does not own this room's game.
        if (identity) pool.release(identity, "left", clock.now())
    }

    function forgetGuestRoom(id: string): void {
        const gr = guestRooms.get(id)
        if (!gr) return
        guestRooms.delete(id)
        for (const uid of [...gr.guests.keys()]) releaseGuest(gr, uid)
    }

    /** A real person came or went: back off before the next guest arrives. */
    function restartQuietPeriod(gr: GuestRoom): void {
        gr.quietUntil = Math.max(gr.quietUntil, clock.now() + randInt(rng, GUEST_QUIET_MIN_MS, GUEST_QUIET_MAX_MS))
    }

    function serviceGuestRoom(gr: GuestRoom, now: number, yielding: boolean): void {
        const handle = gr.handle
        let status: "LOBBY" | "PLAYING" | "FINISHED" | null = null
        let seated: readonly DemoIdentity[] = []
        let humans = 0
        try {
            status = handle.status()
            seated = handle.guests()
            humans = handle.humanCount()
        } catch (err) {
            log.warn("demo guest handle threw", { roomId: gr.id, err })
            forgetGuestRoom(gr.id)
            return
        }

        // RECONCILE FIRST, always: the room is the truth. A guest whose seat is
        // gone — the room removed them, the room itself is gone — must be back
        // in the pool before anything else is decided.
        const present = new Set(seated.map((i) => i.uid))
        for (const uid of [...gr.guests.keys()]) {
            if (!present.has(uid)) releaseGuest(gr, uid)
        }

        // Nobody real left in it: the room is on its way out (its own emptiness
        // rules remove it and take the guests with it). Stop servicing it.
        if (humans === 0) {
            forgetGuestRoom(gr.id)
            return
        }

        if (status === "PLAYING") {
            gr.played = true
            if (gr.guests.size > 0 && rng() < GUEST_REACTION_CHANCE) {
                const candidates = [...gr.guests.values()].filter((i) => {
                    const last = lastReactionAt.get(i.uid)
                    return last === undefined || now - last >= REACTION_PER_PERSON_COOLDOWN_MS
                })
                const who = pickFrom(rng, candidates)
                const reaction = pickFrom(rng, REACTIONS)
                if (who && reaction !== null) {
                    try {
                        if (handle.react(who, reaction)) lastReactionAt.set(who.uid, now)
                    } catch (err) {
                        log.warn("demo guest react threw", { roomId: gr.id, err })
                    }
                }
            }
            return
        }
        if (status !== "LOBBY") return

        // Yielding to real activity: the guests excuse themselves, one a tick.
        if (yielding) {
            const leaving = [...gr.guests.values()][0]
            if (!leaving) {
                guestRooms.delete(gr.id)
                return
            }
            structural(() => {
                if (handle.removeGuest(leaving)) releaseGuest(gr, leaving.uid)
            })
            return
        }

        // ONE structural action per room per tick, like everywhere else here.

        // After the game: they drift off over 10–60 s, not in a block.
        if (gr.played) {
            for (const uid of gr.guests.keys()) {
                if (!gr.departAt.has(uid)) gr.departAt.set(uid, now + randInt(rng, GUEST_DEPART_MIN_MS, GUEST_DEPART_MAX_MS))
            }
            for (const [uid, at] of gr.departAt) {
                if (at > now) continue
                const identity = gr.guests.get(uid)
                if (!identity) continue
                structural(() => {
                    if (handle.removeGuest(identity)) releaseGuest(gr, uid)
                })
                return
            }
            return
        }

        // Waited long enough in a table that never starts: gives up. Somebody
        // else may turn up later — that is what makes it look like a lobby.
        for (const [uid, at] of gr.giveUpAt) {
            if (at > now) continue
            const identity = gr.guests.get(uid)
            if (!identity) continue
            structural(() => {
                if (handle.removeGuest(identity)) releaseGuest(gr, uid)
            })
            // Their chair opening up is itself a change; let the room settle.
            gr.nextGuestAt = Math.max(gr.nextGuestAt, now + randInt(rng, GUEST_NEXT_MIN_MS, GUEST_NEXT_MAX_MS))
            return
        }

        // A locked room takes no NEW guests; the ones sitting in it stay.
        if (!handle.isPublic()) return
        if (now < gr.quietUntil || now < gr.nextGuestAt) return

        let free: readonly Seat[] = []
        try {
            free = handle.freeSeats()
        } catch {
            return
        }
        if (free.length === 0) return
        // LEAVE A CHAIR FOR THE FRIEND. One real person in a young room is
        // very likely waiting for somebody they invited; taking the last seat
        // would answer that for them. After two minutes the friend is not
        // coming, and the fourth guest may sit down.
        if (free.length === 1 && humans <= 1 && now - handle.createdAt < GUEST_LAST_SEAT_HOLD_MS) return

        const person = pool.acquire(now)
        if (!person) return
        // Provisional, so two ticks cannot both decide an arrival is due while
        // the first one's structural action is still deferred.
        gr.nextGuestAt = now + GUEST_NEXT_MIN_MS
        structural(() => {
            let ok = false
            try {
                ok = handle.sitGuest(person)
            } catch (err) {
                log.warn("demo guest sit threw", { roomId: gr.id, err })
            }
            if (!ok) {
                pool.release(person, "left", clock.now())
                return
            }
            gr.guests.set(person.uid, person)
            gr.giveUpAt.set(person.uid, clock.now() + randInt(rng, GUEST_GIVE_UP_MIN_MS, GUEST_GIVE_UP_MAX_MS))
            gr.nextGuestAt = clock.now() + randInt(rng, GUEST_NEXT_MIN_MS, GUEST_NEXT_MAX_MS)
        })
    }

    function guestStep(): void {
        if (stopped) return
        const now = clock.now()
        let realRooms = 0
        try {
            realRooms = lobby.realRoomCount()
        } catch {
            realRooms = 0
        }
        const yielding = realRooms >= REAL_ROOMS_YIELD_FROM
        for (const gr of [...guestRooms.values()]) guard(() => serviceGuestRoom(gr, now, yielding))

        if (yielding || guestRooms.size >= GUEST_ROOMS_MAX) return
        let candidates: readonly RealRoomHandle[] = []
        try {
            candidates = lobby.realWaitingRooms?.() ?? []
        } catch (err) {
            log.warn("demo realWaitingRooms threw", { err })
            return
        }
        for (const handle of candidates) {
            if (guestRooms.size >= GUEST_ROOMS_MAX) break
            if (guestRooms.has(handle.id)) continue
            guestRooms.set(handle.id, {
                id: handle.id,
                handle,
                guests: new Map(),
                giveUpAt: new Map(),
                departAt: new Map(),
                // The quiet period runs from when the REAL person opened the
                // room, not from when we noticed it.
                quietUntil: handle.createdAt + randInt(rng, GUEST_FIRST_MIN_MS, GUEST_FIRST_MAX_MS),
                nextGuestAt: 0,
                played: handle.status() === "PLAYING",
            })
        }
    }

    function guestLoop(): void {
        schedule(randInt(rng, GUEST_TICK_MIN_MS, GUEST_TICK_MAX_MS), () => {
            guestStep()
            guestLoop()
        })
    }

    /** Optional on the API: a lobby without it simply never gets guests. */
    function watchRealRooms(): void {
        if (!lobby.watchRealRooms) return
        try {
            lobby.watchRealRooms({
                onRoomOpened: (room) =>
                    guard(() => {
                        const gr = guestRooms.get(room.id)
                        if (gr) gr.handle = room
                    }),
                onRoomChanged: (room, what) =>
                    guard(() => {
                        const gr = guestRooms.get(room.id)
                        if (!gr) return
                        gr.handle = room
                        if (what === "human") restartQuietPeriod(gr)
                        if (what === "status" && room.status() === "PLAYING") gr.played = true
                    }),
                onRoomClosed: (id) => guard(() => forgetGuestRoom(id)),
            })
        } catch (err) {
            log.warn("demo watchRealRooms failed", { err })
        }
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

    /* ── status line ────────────────────────────────────────────────────
       One INFO line a minute, so `docker compose logs game | grep demo.status`
       answers "what are the fake people doing right now" without a debugger:
       how many rooms, how many of them playing, where the real people are. */
    function statusLine(): void {
        if (stopped) return
        try {
            const live = liveRooms()
            const playing = live.filter(isPlaying)
            const withHumans = live.filter(hasHuman)
            log.info("demo.status", {
                rooms: live.length,
                wantRooms: effectiveTotal(),
                playing: playing.length,
                wantPlaying: targetPlaying,
                waiting: live.length - playing.length,
                watchable: playing.filter((r) => r.handle.options.allowSpectators).length,
                private: live.filter((r) => r.handle.options.private).length,
                targets: live.map((r) => r.handle.options.targetScore).sort((a, b) => a - b).join(","),
                seated: live.map((r) => occupiedCount(r)).join(""),
                roomsWithHumans: withHumans.length,
                spectators: live.reduce((sum, r) => sum + r.handle.spectatorCount(), 0),
                realRooms: lobby.realRoomCount(),
                // Rooms real people opened that fake people are sitting in.
                // Deliberately NOT part of any total above: they are real
                // rooms, and the demo population never counts them.
                guestRooms: guestRooms.size,
                guestsSeated: [...guestRooms.values()].reduce((sum, gr) => sum + gr.guests.size, 0),
                castInUse: pool.inUseCount(),
                cast: pool.size,
                timers: timers.size,
            })
        } catch (err) {
            log.warn("demo status failed", { err })
        }
        schedule(60_000, statusLine)
    }

    boot()
    redrawTargets()
    sweep()
    watchRealRooms()
    guestLoop()
    schedule(60_000, statusLine)

    return {
        stop(): void {
            if (stopped) return
            stopped = true
            // Guests sit in REAL rooms, which outlive the director: walk them
            // out before the timers go, or a real table is left with fake
            // people nobody is driving any more.
            for (const gr of [...guestRooms.values()]) {
                for (const identity of [...gr.guests.values()]) {
                    try {
                        gr.handle.removeGuest(identity)
                    } catch {
                        /* a room that will not answer is one we are leaving anyway */
                    }
                }
                forgetGuestRoom(gr.id)
            }
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
