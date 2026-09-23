/* ──────────────────────────────────────────────────────────────────────────
   Room registry + the `lobby.rooms` fan-out (README §3 "Lobby").

   Subscribers get all rooms, including locked private rooms whose join codes
   are redacted unless the subscriber is already a member. Broadcasts are
   debounced 50 ms: a burst of seat changes produces one frame.
   ────────────────────────────────────────────────────────────────────── */

import { LIMITS } from "@bela/protocol"
import type { ActiveSeatInfo, GameEndRule, RoomSummary, TargetScore, TrickReview, WinRateRequirement } from "@bela/protocol"
import type { Timings } from "./config.js"
import { ProtocolError } from "./errors.js"
import { newRoomCode, newRoomId } from "./ids.js"
import type { LiveActivityHub } from "./liveActivity.js"
import { log } from "./log.js"
import { randomRoomName } from "./roomNames.js"
import { DemoRoom, demoUserInfo, RealRoom, Room } from "./room.js"
import type { RoomHost } from "./room.js"
import type { Connection } from "./ws.js"
import { reportRoomCreated } from "./analyticsReporter.js"
// Type-only: nothing under `demo/` loads with the flag off (DEMO-LOBBY.md).
import type {
    DemoIdentity,
    DemoLobbyApi,
    DemoRoomEvents,
    DemoRoomHandle,
    DemoRoomOptions,
    RealRoomEvents,
    RealRoomHandle,
} from "./demo/types.js"

export interface CreateRoomInput {
    gameEndRule?: GameEndRule
    allowSpectators?: boolean
    noDeclarations?: boolean
    allowBela?: boolean
    trickReview?: TrickReview
    /** Trimmed/sanitised by the caller; blank/undefined → an auto-generated name. */
    name?: string
    targetScore: TargetScore
    private: boolean
    minWinRatePercent?: WinRateRequirement
}

/** Shape of `GET /stats` (see `Lobby.stats()`). */
export interface LobbyStats {
    /** Live rooms, real and demo alike. */
    rooms: number
    /** Rooms with `status === "PLAYING"`, real and demo alike. */
    playing: number
    /** Rooms with `status === "LOBBY"` and a free seat, real and demo alike. */
    waiting: number
    /** Seated `PLAYER` + `DEMO` — what a visitor would perceive as "people". */
    players: number
    /** Seated `PLAYER` only — real accounts, excludes `DEMO` and `BOT`. */
    humans: number
}

/** Bail-out after this many collisions — practically unreachable at `MAX_ROOMS` scale. */
const MAX_CODE_ATTEMPTS = 50

const MAX_ROOMS = 500

export class Lobby implements RoomHost, DemoLobbyApi {
    private readonly rooms: Map<string, Room>
    private readonly subscribers: Set<Connection>
    private readonly timings: Timings
    private readonly liveActivity: LiveActivityHub | null
    private debounceTimer: ReturnType<typeof setTimeout> | null
    private disposed: boolean
    /** Null until the demo director asks to watch (DEMO-LOBBY.md "Gosti u
     *  pravim sobama"). Null is also the ONLY state an ordinary server is ever
     *  in, and every guest code path in `room.ts` is downstream of it. */
    private realWatch: RealRoomEvents | null
    /** What the watcher last reported per ordinary room, so `changed()` can
     *  emit a diff instead of the director having to poll everything. */
    private readonly realSnapshot: Map<string, { humans: number; private: boolean; status: string }>

    constructor(timings: Timings, liveActivity: LiveActivityHub | null = null) {
        this.rooms = new Map()
        this.subscribers = new Set()
        this.timings = timings
        this.liveActivity = liveActivity
        this.debounceTimer = null
        this.disposed = false
        this.realWatch = null
        this.realSnapshot = new Map()
    }

    size(): number {
        return this.rooms.size
    }

    /**
     * Snapshot for the public, unauthenticated `GET /stats` endpoint (nav
     * "Igraj" live-room pull, 2026-09-22). Runs on every visitor's poll, so
     * it stays a single pass over `this.rooms` with no allocation beyond the
     * returned object.
     *
     * DEMO ROOMS ARE COUNTED, ON PURPOSE. The whole point of the demo lobby
     * is to be indistinguishable from real activity (DEMO-LOBBY.md), and the
     * owner wants the nav pull to look busy from minute one — excluding demo
     * rooms here would defeat that. `players` therefore counts every seated
     * `PLAYER` *and* `DEMO` (via `Room.humanSeats()`, same helper the wire
     * state uses), never a `BOT`.
     *
     * `humans` is the strict subset — real accounts only, `Room.
     * realHumanSeats()`, the same helper `statsReporter.ts` uses for game
     * eligibility. It is not surfaced in the nav today but is kept alongside
     * `players` so the product can switch the pull to "real humans only"
     * later without another server round-trip.
     */
    stats(): LobbyStats {
        let playing = 0
        let waiting = 0
        let players = 0
        let humans = 0
        for (const room of this.rooms.values()) {
            if (room.status === "PLAYING") playing++
            else if (room.status === "LOBBY" && room.nextSeatForNewcomer() !== null) waiting++
            players += room.humanSeats().length
            humans += room.realHumanSeats().length
        }
        return { rooms: this.rooms.size, playing, waiting, players, humans }
    }

    get(roomId: string): Room | undefined {
        return this.rooms.get(roomId)
    }

    require(roomId: string): Room {
        const room = this.rooms.get(roomId)
        if (!room) throw new ProtocolError("ROOM_NOT_FOUND")
        return room
    }

    /** The room still holding a seat (or a membership) for this uid — reconnect target. */
    findRoomForUid(uid: string): Room | undefined {
        for (const room of this.rooms.values()) {
            if (room.seatOfUid(uid) !== null) return room
        }
        return undefined
    }

    /** `game.active` payload for this uid across every live room (README §3). */
    activeSeatFor(uid: string): ActiveSeatInfo | null {
        for (const room of this.rooms.values()) {
            const info = room.activeSeatFor(uid)
            if (info) return info
        }
        return null
    }

    /** Tell one connection which seat is still theirs (or that none is). */
    sendActiveSeat(conn: Connection): void {
        const uid = conn.user?.uid
        conn.send({ t: "game.active", seat: uid ? this.activeSeatFor(uid) : null })
    }

    /**
     * ONE GAME AT A TIME (README §3.2).
     *
     * A uid can only own one seat, and the seat they already have wins. This
     * used to be the opposite: turning up anywhere else silently forfeited the
     * old seat (`abandonSeatsExcept`), so a stray click on a lobby row handed
     * a live table to a bot with no warning and no way back. Now the second
     * room is REFUSED, and the way out is deliberate — walk back in
     * (`room.join`, which `keepRoomId` always allows) or give the seat up
     * (`room.leave`, the lobby's "Napusti igru").
     *
     * `keepRoomId` is the room being entered: returning to your own room is
     * never blocked by your own seat in it.
     */
    requireNoSeatElsewhere(uid: string, keepRoomId: string | null): void {
        for (const room of this.rooms.values()) {
            if (room.id === keepRoomId) continue
            if (room.seatOfUid(uid) === null) continue
            throw new ProtocolError(
                "ALREADY_IN_GAME",
                `Već imate sjedalo u sobi "${room.name}". Vratite se u nju ili je napustite.`,
            )
        }
    }

    /**
     * Lookup by the 4-digit join code (`room.joinByCode`); same room whichever
     * way you found it.
     *
     * A PRIVATE DEMO ROOM IS NOT FINDABLE. Its code is never handed to anyone,
     * so the only way to arrive with it is to have guessed four digits — and
     * the least surprising answer to a guess is the one every other wrong guess
     * gets: ROOM_NOT_FOUND. Anything else (letting them in, or a distinct
     * error) would either seat a real person among scenery or tell them their
     * guess was right. Entering by ROOM ID needs no special case: the room is
     * private, so `assertCanJoin` demands the code it will never match.
     */
    findByCode(code: string): Room {
        for (const room of this.rooms.values()) {
            if (room.demo) continue
            if (room.private && room.code === code) return room
        }
        throw new ProtocolError("ROOM_NOT_FOUND")
    }

    /** A 4-digit code not currently held by any live room. Freed automatically once `remove()`s. */
    private allocateCode(): string {
        for (let i = 0; i < MAX_CODE_ATTEMPTS; i++) {
            const code = newRoomCode()
            let taken = false
            for (const room of this.rooms.values()) {
                if (room.code === code) {
                    taken = true
                    break
                }
            }
            if (!taken) return code
        }
        throw new ProtocolError("BAD_REQUEST", "Nije moguće dodijeliti šifru sobe, pokušajte kasnije.")
    }

    create(conn: Connection, input: CreateRoomInput): Room {
        const user = conn.user
        if (!user) throw new ProtocolError("UNAUTHENTICATED")
        if (this.rooms.size >= MAX_ROOMS) {
            throw new ProtocolError("BAD_REQUEST", "Previše otvorenih soba, pokušajte kasnije.")
        }
        const trimmed = (input.name ?? "").trim().slice(0, LIMITS.roomNameMax)
        const name = trimmed.length > 0 ? trimmed : randomRoomName()
        const room = new Room({
            id: newRoomId(),
            code: this.allocateCode(),
            name,
            host: user,
            targetScore: input.targetScore,
            gameEndRule: input.gameEndRule,
            private: input.private,
            minWinRatePercent: input.minWinRatePercent,
            allowSpectators: input.allowSpectators,
            noDeclarations: input.noDeclarations,
            allowBela: input.allowBela,
            trickReview: input.trickReview,
            lobby: this,
            timings: this.timings,
            liveActivity: this.liveActivity,
        })
        this.rooms.set(room.id, room)
        room.attach(conn)
        // Creator is the host and takes seat 0 straight away (README §3).
        // `attach` already auto-seats into the lowest free seat, which in a
        // brand-new room IS seat 0; this states the invariant and is a no-op.
        room.sit(conn, 0)
        log.info("room.created", { room: room.id, code: room.code, host: user.uid, private: input.private })
        reportRoomCreated(room)
        this.changed()
        return room
    }

    /* ───────────────────────── demo lobby (DEMO-LOBBY.md) ───────────────────────── */

    /**
     * Open a room with no connection behind it: the host is a fake person,
     * already sitting on seat 0.
     *
     * Deliberately NOT `create()`: there is no `Connection` to attach, no
     * `reportRoomCreated` (a demo room must not appear in the admin analytics),
     * and the host badge goes to a uid no socket will ever present. Everything
     * else — the id, the code allocation, the `MAX_ROOMS` ceiling, the lobby
     * fan-out — is the same, because from the lobby's side this is an ordinary
     * room that happens to be full of people who are not real.
     */
    createDemoRoom(options: DemoRoomOptions, host: DemoIdentity, events: DemoRoomEvents): DemoRoomHandle | null {
        if (this.disposed) return null
        if (this.rooms.size >= MAX_ROOMS) return null
        const room = new Room({
            id: newRoomId(),
            code: this.allocateCode(),
            name: randomRoomName(),
            host: demoUserInfo(host),
            targetScore: options.targetScore,
            gameEndRule: options.gameEndRule,
            private: options.private,
            allowSpectators: options.allowSpectators,
            noDeclarations: options.noDeclarations,
            lobby: this,
            timings: this.timings,
            liveActivity: this.liveActivity,
            demo: { events },
        })
        this.rooms.set(room.id, room)
        if (!room.demoSit(host, 0)) {
            // Unreachable (a brand-new room's seat 0 is free), but a half-built
            // demo room must never be left in the lobby.
            this.rooms.delete(room.id)
            room.dispose()
            return null
        }
        log.info("demo.room.created", { room: room.id, private: options.private, target: options.targetScore })
        this.changed()
        return new DemoRoom(room)
    }

    /** Rooms real people opened — activity the director yields to. */
    realRoomCount(): number {
        let count = 0
        for (const room of this.rooms.values()) if (!room.demo) count++
        return count
    }

    totalRoomCount(): number {
        return this.rooms.size
    }

    /* ─────────── guests in real rooms (DEMO-LOBBY.md "Gosti u pravim sobama") ───────────
       The director asks to watch; from then on every `changed()` — and the
       lobby calls that on essentially every room mutation — produces a diff.
       Nothing below runs, and `realWaitingRooms()` stays empty, until that one
       call has been made, which is the flag gate for the whole feature. */

    watchRealRooms(events: RealRoomEvents): void {
        this.realWatch = events
        // Seed the snapshot so rooms that already existed are announced once.
        this.syncRealRooms()
    }

    /**
     * Rooms a guest could walk into right now: ordinary, public, still in the
     * LOBBY, with at least one real person seated and a chair free. The
     * director applies its own pacing on top; this is only "possible", never
     * "due".
     */
    realWaitingRooms(): readonly RealRoomHandle[] {
        if (!this.realWatch || this.disposed) return []
        const out: RealRoomHandle[] = []
        for (const room of this.rooms.values()) {
            if (room.demo || room.private) continue
            if (room.status !== "LOBBY") continue
            if (room.realHumanSeats().length === 0) continue
            if (room.nextSeatForNewcomer() === null) continue
            out.push(new RealRoom(room))
        }
        return out
    }

    /** Diff the ordinary rooms against the last snapshot and fire the events. */
    private syncRealRooms(): void {
        const watch = this.realWatch
        if (!watch) return
        const seen = new Set<string>()
        for (const room of this.rooms.values()) {
            if (room.demo) continue
            seen.add(room.id)
            const next = {
                humans: room.realHumanSeats().length,
                private: room.private,
                status: room.status as string,
            }
            const prev = this.realSnapshot.get(room.id)
            this.realSnapshot.set(room.id, next)
            try {
                if (!prev) {
                    watch.onRoomOpened?.(new RealRoom(room))
                    continue
                }
                // One event per beat, humans first: a real person arriving or
                // leaving is the only change that restarts the quiet period.
                if (prev.humans !== next.humans) watch.onRoomChanged?.(new RealRoom(room), "human")
                else if (prev.status !== next.status) watch.onRoomChanged?.(new RealRoom(room), "status")
                else if (prev.private !== next.private) watch.onRoomChanged?.(new RealRoom(room), "options")
            } catch (err) {
                // The demo lobby is scenery; a throwing director never costs a
                // real room its fan-out.
                log.warn("demo.realWatch.failed", { room: room.id, err })
            }
        }
        for (const id of [...this.realSnapshot.keys()]) {
            if (seen.has(id)) continue
            this.realSnapshot.delete(id)
            try {
                watch.onRoomClosed?.(id)
            } catch (err) {
                log.warn("demo.realWatch.failed", { room: id, err })
            }
        }
    }

    remove(roomId: string): void {
        const room = this.rooms.get(roomId)
        if (!room) return
        this.rooms.delete(roomId)
        room.dispose()
        this.changed()
    }

    /* ───────────────────────── subscriptions ───────────────────────── */

    subscribe(conn: Connection): void {
        this.subscribers.add(conn)
        conn.lobbySubscribed = true
        conn.send({ t: "lobby.rooms", rooms: this.roomsFor(conn) })
        this.sendActiveSeat(conn)
    }

    unsubscribe(conn: Connection): void {
        this.subscribers.delete(conn)
        conn.lobbySubscribed = false
    }

    /** Every live room is discoverable. Private-room codes stay redacted for outsiders. */
    roomsFor(conn: Connection): RoomSummary[] {
        const uid = conn.user?.uid ?? null
        const out: RoomSummary[] = []
        for (const room of this.rooms.values()) {
            // The private code goes to people who HOLD a seat, not to everyone
            // who is merely in the room: a spectator of a running private game
            // must not be handed the way in.
            const mine = uid !== null && room.seatOfUid(uid) !== null
            out.push(room.toSummary(mine))
        }
        // Tables still gathering players come first (newest first — those are
        // the ones a visitor can sit at), then the running games, LONGEST
        // running first, then anything finished (2026-09-21, user request: the
        // list was one mix of both ordered by creation time).
        const rank = (r: RoomSummary): number => (r.status === "LOBBY" ? 0 : r.status === "PLAYING" ? 1 : 2)
        out.sort((a, b) => {
            if (rank(a) !== rank(b)) return rank(a) - rank(b)
            if (a.status === "PLAYING") return (a.startedAt ?? a.createdAt) - (b.startedAt ?? b.createdAt)
            return b.createdAt - a.createdAt
        })
        return out
    }

    /** Something changed; broadcast once per debounce window. */
    changed(): void {
        if (this.disposed) return
        // BEFORE the debounce guard: the fan-out to clients may be coalesced,
        // but the director must see every real-room transition, and two of them
        // inside one 50 ms window would otherwise collapse into one.
        if (this.realWatch) this.syncRealRooms()
        if (this.debounceTimer) return
        const timer = setTimeout(() => {
            this.debounceTimer = null
            this.flush()
        }, this.timings.lobbyDebounceMs)
        if (typeof timer.unref === "function") timer.unref()
        this.debounceTimer = timer
    }

    private flush(): void {
        if (this.disposed) return
        for (const conn of this.subscribers) {
            conn.send({ t: "lobby.rooms", rooms: this.roomsFor(conn) })
            // Rides along with every fan-out: a hold starting, being cancelled
            // or expiring all go through `changed()`, so the lobby's "you have
            // a game running" card never needs its own poll.
            this.sendActiveSeat(conn)
        }
    }

    dispose(): void {
        this.disposed = true
        this.realWatch = null
        this.realSnapshot.clear()
        if (this.debounceTimer) clearTimeout(this.debounceTimer)
        this.debounceTimer = null
        for (const room of this.rooms.values()) room.dispose()
        this.rooms.clear()
        this.subscribers.clear()
    }
}
