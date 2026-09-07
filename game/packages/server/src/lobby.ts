/* ──────────────────────────────────────────────────────────────────────────
   Room registry + the `lobby.rooms` fan-out (README §3 "Lobby").

   Subscribers get public rooms plus any room they are personally in, so a
   private room stays invisible to everyone except its members. Broadcasts are
   debounced 50 ms: a burst of seat changes produces one frame.
   ────────────────────────────────────────────────────────────────────── */

import { LIMITS } from "@bela/protocol"
import type { RoomSummary, TargetScore } from "@bela/protocol"
import type { Timings } from "./config.js"
import { ProtocolError } from "./errors.js"
import { newRoomCode, newRoomId } from "./ids.js"
import { log } from "./log.js"
import { randomRoomName } from "./roomNames.js"
import { Room } from "./room.js"
import type { RoomHost } from "./room.js"
import type { Connection } from "./ws.js"

export interface CreateRoomInput {
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

    /** Lookup by the 4-digit join code (`room.joinByCode`); same room whichever way you found it. */
    findByCode(code: string): Room {
        for (const room of this.rooms.values()) {
            if (room.code === code) return room
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
            lobby: this,
            timings: this.timings,
        })
        this.rooms.set(room.id, room)
        room.attach(conn)
        // Creator is the host and takes seat 0 straight away (README §3).
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
    }

    unsubscribe(conn: Connection): void {
        this.subscribers.delete(conn)
        conn.lobbySubscribed = false
    }

    /** Public rooms, plus private rooms this connection is a member of. */
    roomsFor(conn: Connection): RoomSummary[] {
        const uid = conn.user?.uid ?? null
        const out: RoomSummary[] = []
        for (const room of this.rooms.values()) {
            const mine =
                conn.roomId === room.id || (uid !== null && room.seatOfUid(uid) !== null)
            if (room.private && !mine) continue
            out.push(room.toSummary())
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
