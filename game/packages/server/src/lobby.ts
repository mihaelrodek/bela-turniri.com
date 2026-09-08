/* ──────────────────────────────────────────────────────────────────────────
   Room registry + the `lobby.rooms` fan-out (README §3 "Lobby").

   Subscribers get all rooms, including locked private rooms whose join codes
   are redacted unless the subscriber is already a member. Broadcasts are
   debounced 50 ms: a burst of seat changes produces one frame.
   ────────────────────────────────────────────────────────────────────── */

import { LIMITS } from "@bela/protocol"
import type { ActiveSeatInfo, RoomSummary, TargetScore, TrickReview } from "@bela/protocol"
import type { Timings } from "./config.js"
import { ProtocolError } from "./errors.js"
import { newRoomCode, newRoomId } from "./ids.js"
import { log } from "./log.js"
import { randomRoomName } from "./roomNames.js"
import { Room } from "./room.js"
import type { RoomHost } from "./room.js"
import type { Connection } from "./ws.js"

export interface CreateRoomInput {
    allowSpectators?: boolean
    noDeclarations?: boolean
    allowBela?: boolean
    trickReview?: TrickReview
    /** Trimmed/sanitised by the caller; blank/undefined → an auto-generated name. */
    name?: string
    targetScore: TargetScore
    private: boolean
}

/** Bail-out after this many collisions — practically unreachable at `MAX_ROOMS` scale. */
const MAX_CODE_ATTEMPTS = 50

const MAX_ROOMS = 500

export class Lobby implements RoomHost {
    private readonly rooms: Map<string, Room>
    private readonly subscribers: Set<Connection>
    private readonly timings: Timings
    private debounceTimer: ReturnType<typeof setTimeout> | null
    private disposed: boolean

    constructor(timings: Timings) {
        this.rooms = new Map()
        this.subscribers = new Set()
        this.timings = timings
        this.debounceTimer = null
        this.disposed = false
    }

    size(): number {
        return this.rooms.size
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

    /** Lookup by the 4-digit join code (`room.joinByCode`); same room whichever way you found it. */
    findByCode(code: string): Room {
        for (const room of this.rooms.values()) {
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
            private: input.private,
            allowSpectators: input.allowSpectators,
            noDeclarations: input.noDeclarations,
            allowBela: input.allowBela,
            trickReview: input.trickReview,
            lobby: this,
            timings: this.timings,
        })
        this.rooms.set(room.id, room)
        room.attach(conn)
        // Creator is the host and takes seat 0 straight away (README §3).
        // `attach` already auto-seats into the lowest free seat, which in a
        // brand-new room IS seat 0; this states the invariant and is a no-op.
        room.sit(conn, 0)
        log.info("room.created", { room: room.id, code: room.code, host: user.uid, private: input.private })
        this.changed()
        return room
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
            const mine =
                conn.roomId === room.id || (uid !== null && room.seatOfUid(uid) !== null)
            out.push(room.toSummary(mine))
        }
        out.sort((a, b) => b.createdAt - a.createdAt)
        return out
    }

    /** Something changed; broadcast once per debounce window. */
    changed(): void {
        if (this.disposed || this.debounceTimer) return
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
        if (this.debounceTimer) clearTimeout(this.debounceTimer)
        this.debounceTimer = null
        for (const room of this.rooms.values()) room.dispose()
        this.rooms.clear()
        this.subscribers.clear()
    }
}
