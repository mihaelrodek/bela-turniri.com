/* ──────────────────────────────────────────────────────────────────────────
   RoomState management (README §3 "Soba", §4).

   A room owns 4 seats, its members' connections, the host, and — once
   started — a `GameRoom` holding the authoritative `GameState`.

   Lifecycle: LOBBY → PLAYING → FINISHED. Empty rooms are deleted after
   `emptyRoomTtlMs` (5 min), finished ones after `finishedRoomTtlMs` (10 min).
   ────────────────────────────────────────────────────────────────────── */

import type {
    BotLevel,
    RoomState,
    RoomStatus,
    RoomSummary,
    Seat,
    SeatInfo,
    ServerMessage,
    TargetScore,
    UserInfo,
} from "@bela/protocol"
import type { Timings } from "./config.js"
import { ProtocolError } from "./errors.js"
import { botName, DEFAULT_BOT_LEVEL } from "./bots.js"
import { GameRoom } from "./gameRoom.js"
import { log } from "./log.js"
import type { Connection } from "./ws.js"

/** Internal seat slot — same as the protocol `SeatInfo["occupant"]` plus the uid. */
export type SeatSlot =
    | { kind: "PLAYER"; uid: string; user: UserInfo; ready: boolean; connected: boolean }
    | { kind: "BOT"; level: BotLevel; name: string }
    | null

/** What a room needs from the registry that owns it. */
export interface RoomHost {
    /** Something visible in the lobby changed. */
    changed(): void
    /** Drop this room from the registry. */
    remove(roomId: string): void
}

export const SEATS: readonly Seat[] = [0, 1, 2, 3]

/** Spectators + seated members; a hard cap so one room cannot soak the process. */
const MAX_MEMBERS = 24

export interface RoomInit {
    id: string
    name: string
    /** 4-digit join code, allocated by the `Lobby` (it alone knows what's taken). */
    code: string
    host: UserInfo
    targetScore: TargetScore
    private: boolean
    lobby: RoomHost
    timings: Timings
}

export class Room {
    readonly id: string
    readonly code: string
    readonly createdAt: number
    readonly private: boolean
    readonly timings: Timings
    name: string
    hostUid: string
    status: RoomStatus
    targetScore: TargetScore
    readonly seats: [SeatSlot, SeatSlot, SeatSlot, SeatSlot]
    readonly conns: Set<Connection>
    game: GameRoom | null

    private readonly lobby: RoomHost
    private deleteTimer: ReturnType<typeof setTimeout> | null
    /** uid → grace timer while a seated player is disconnected. */
    private readonly graceTimers: Map<string, ReturnType<typeof setTimeout>>
    private disposed: boolean

    constructor(init: RoomInit) {
        this.id = init.id
        this.code = init.code
        this.name = init.name
        this.hostUid = init.host.uid
        this.status = "LOBBY"
        this.targetScore = init.targetScore
        this.private = init.private
        this.createdAt = Date.now()
        this.seats = [null, null, null, null]
        this.conns = new Set<Connection>()
        this.game = null
        this.lobby = init.lobby
        this.timings = init.timings
        this.deleteTimer = null
        this.graceTimers = new Map()
        this.disposed = false
    }

    /* ───────────────────────── queries ───────────────────────── */

    isHost(uid: string): boolean {
        return this.hostUid === uid
    }

    slotAt(seat: Seat): SeatSlot {
        return this.seats[seat]
    }

    seatOfUid(uid: string): Seat | null {
        for (const s of SEATS) {
            const slot = this.seats[s]
            if (slot && slot.kind === "PLAYER" && slot.uid === uid) return s
        }
        return null
    }

    /** Does any live connection belong to this uid? */
    hasConnFor(uid: string): boolean {
        for (const c of this.conns) if (c.user?.uid === uid) return true
        return false
    }

    seatsTaken(): number {
        return SEATS.filter((s) => this.seats[s] !== null).length
    }

    humanSeats(): Seat[] {
        return SEATS.filter((s) => this.seats[s]?.kind === "PLAYER")
    }

    hasConnectedHuman(): boolean {
        return SEATS.some((s) => {
            const slot = this.seats[s]
            return slot?.kind === "PLAYER" && slot.connected
        })
    }

    isEmpty(): boolean {
        return this.conns.size === 0
    }

    /* ───────────────────────── serialisation ───────────────────────── */

    private seatInfo(seat: Seat): SeatInfo {
        const slot = this.seats[seat]
        if (!slot) return { seat, occupant: null }
        if (slot.kind === "BOT") {
            return { seat, occupant: { kind: "BOT", level: slot.level, name: slot.name } }
        }
        return {
            seat,
            occupant: {
                kind: "PLAYER",
                user: slot.user,
                ready: slot.ready,
                connected: slot.connected,
            },
        }
    }

    toSummary(): RoomSummary {
        return {
            id: this.id,
            name: this.name,
            code: this.code,
            hostUid: this.hostUid,
            status: this.status,
            targetScore: this.targetScore,
            private: this.private,
            seatsTaken: this.seatsTaken(),
            humans: this.humanSeats().length,
            createdAt: this.createdAt,
        }
    }

    toState(): RoomState {
        const spectators: UserInfo[] = []
        const seen = new Set<string>()
        for (const c of this.conns) {
            const u = c.user
            if (!u) continue
            if (seen.has(u.uid)) continue
            if (this.seatOfUid(u.uid) !== null) continue
            seen.add(u.uid)
            spectators.push(u)
        }
        return {
            ...this.toSummary(),
            seats: [this.seatInfo(0), this.seatInfo(1), this.seatInfo(2), this.seatInfo(3)],
            spectators,
            turnTimeoutMs: this.timings.turnTimeoutMs,
        }
    }

    /* ───────────────────────── messaging ───────────────────────── */

    broadcast(msg: ServerMessage): void {
        for (const c of this.conns) c.send(msg)
    }

    /** `room.joined` addressed to one member (their own seat included). */
    joinedMessageFor(conn: Connection): ServerMessage {
        const uid = conn.user?.uid ?? null
        return {
            t: "room.joined",
            room: this.toState(),
            yourSeat: uid ? this.seatOfUid(uid) : null,
        }
    }

    broadcastState(): void {
        const room = this.toState()
        for (const c of this.conns) {
            const uid = c.user?.uid ?? null
            c.send({ t: "room.state", room, yourSeat: uid ? this.seatOfUid(uid) : null })
        }
    }

    /* ───────────────────────── membership ───────────────────────── */

    /**
     * Attach a connection. Returns true when this was a reconnect into a seat
     * the room was still holding for that uid.
     */
    attach(conn: Connection): boolean {
        const user = conn.user
        if (!user) throw new ProtocolError("UNAUTHENTICATED")
        if (this.conns.size >= MAX_MEMBERS && !this.hasConnFor(user.uid)) {
            throw new ProtocolError("ROOM_FULL", "Soba je puna.")
        }
        this.cancelDeleteTimer()
        this.conns.add(conn)
        conn.roomId = this.id

        const grace = this.graceTimers.get(user.uid)
        if (grace) {
            clearTimeout(grace)
            this.graceTimers.delete(user.uid)
        }
        const seat = this.seatOfUid(user.uid)
        let reconnected = false
        if (seat !== null) {
            const slot = this.seats[seat]
            if (slot && slot.kind === "PLAYER") {
                reconnected = !slot.connected
                slot.connected = true
                slot.user = user
            }
        }
        this.lobby.changed()
        this.game?.onPresenceChanged()
        return reconnected
    }

    /** Socket died or navigated away: keep the seat for the grace period. */
    onDisconnect(conn: Connection): void {
        if (!this.conns.delete(conn)) return
        const user = conn.user
        conn.roomId = null
        if (user && !this.hasConnFor(user.uid)) {
            const seat = this.seatOfUid(user.uid)
            if (seat !== null) {
                const slot = this.seats[seat]
                if (slot && slot.kind === "PLAYER") slot.connected = false
                this.startGrace(user.uid, seat)
            }
        }
        // A dropped socket does not cost you the host badge — the grace period
        // (or an explicit leave) does.
        this.afterMembershipChange(null)
    }

    /** Explicit `room.leave`: the seat goes now, not after the grace period. */
    leave(conn: Connection): void {
        const user = conn.user
        this.conns.delete(conn)
        conn.roomId = null
        if (user) {
            const grace = this.graceTimers.get(user.uid)
            if (grace) {
                clearTimeout(grace)
                this.graceTimers.delete(user.uid)
            }
            if (!this.hasConnFor(user.uid)) this.releaseSeat(user.uid)
        }
        conn.send({ t: "room.left" })
        this.afterMembershipChange(user?.uid ?? null)
    }

    private afterMembershipChange(leavingUid: string | null): void {
        if (leavingUid !== null && this.isHost(leavingUid)) this.transferHost(leavingUid)
        this.broadcastState()
        this.lobby.changed()
        this.game?.onPresenceChanged()
        this.scheduleDeleteIfEmpty()
    }

    /** Free (LOBBY) or bot-ify (PLAYING) the seat held by `uid`. */
    private releaseSeat(uid: string): void {
        const seat = this.seatOfUid(uid)
        if (seat === null) return
        if (this.status === "PLAYING") this.seats[seat] = this.makeBotSlot(seat)
        else this.seats[seat] = null
    }

    private startGrace(uid: string, seat: Seat): void {
        const existing = this.graceTimers.get(uid)
        if (existing) clearTimeout(existing)
        const timer = setTimeout(() => {
            this.graceTimers.delete(uid)
            if (this.disposed) return
            if (this.hasConnFor(uid)) return
            const slot = this.seats[seat]
            if (!slot || slot.kind !== "PLAYER" || slot.uid !== uid) return
            // Grace expired: the bot takes the seat permanently (README §3 "Timeri").
            this.seats[seat] = this.makeBotSlot(seat)
            if (this.isHost(uid)) this.transferHost(uid)
            log.info("seat.botified", { room: this.id, seat, uid })
            this.broadcastState()
            this.lobby.changed()
            this.game?.onPresenceChanged()
        }, this.timings.reconnectGraceMs)
        if (typeof timer.unref === "function") timer.unref()
        this.graceTimers.set(uid, timer)
    }

    private transferHost(leavingUid: string): void {
        for (const s of SEATS) {
            const slot = this.seats[s]
            if (slot?.kind === "PLAYER" && slot.uid !== leavingUid) {
                this.hostUid = slot.uid
                return
            }
        }
        for (const c of this.conns) {
            const u = c.user
            if (u && u.uid !== leavingUid) {
                this.hostUid = u.uid
                return
            }
        }
    }

    private makeBotSlot(seat: Seat, level: BotLevel = DEFAULT_BOT_LEVEL): SeatSlot {
        return { kind: "BOT", level, name: botName(seat) }
    }

    /* ───────────────────────── seat commands ───────────────────────── */

    private requireUser(conn: Connection): UserInfo {
        const u = conn.user
        if (!u) throw new ProtocolError("UNAUTHENTICATED")
        if (!this.conns.has(conn)) throw new ProtocolError("NOT_IN_ROOM")
        return u
    }

    private requireLobby(): void {
        if (this.status !== "LOBBY") {
            throw new ProtocolError("ALREADY_STARTED", "Igra je već započela.")
        }
    }

    private requireHost(conn: Connection): UserInfo {
        const u = this.requireUser(conn)
        if (!this.isHost(u.uid)) throw new ProtocolError("NOT_HOST")
        return u
    }

    sit(conn: Connection, seat: Seat): void {
        const user = this.requireUser(conn)
        this.requireLobby()
        const target = this.seats[seat]
        if (target) {
            if (target.kind === "PLAYER" && target.uid === user.uid) return
            throw new ProtocolError("SEAT_TAKEN")
        }
        const previous = this.seatOfUid(user.uid)
        if (previous !== null) this.seats[previous] = null
        this.seats[seat] = { kind: "PLAYER", uid: user.uid, user, ready: false, connected: true }
        this.broadcastState()
        this.lobby.changed()
    }

    stand(conn: Connection): void {
        const user = this.requireUser(conn)
        this.requireLobby()
        const seat = this.seatOfUid(user.uid)
        if (seat === null) throw new ProtocolError("BAD_REQUEST", "Ne sjedite za stolom.")
        this.seats[seat] = null
        this.broadcastState()
        this.lobby.changed()
    }

    addBot(conn: Connection, seat: Seat, level: BotLevel): void {
        this.requireHost(conn)
        this.requireLobby()
        if (this.seats[seat]) throw new ProtocolError("SEAT_TAKEN")
        this.seats[seat] = this.makeBotSlot(seat, level)
        this.broadcastState()
        this.lobby.changed()
    }

    removeBot(conn: Connection, seat: Seat): void {
        this.requireHost(conn)
        this.requireLobby()
        const slot = this.seats[seat]
        if (!slot || slot.kind !== "BOT") {
            throw new ProtocolError("BAD_REQUEST", "Na tom sjedalu nema bota.")
        }
        this.seats[seat] = null
        this.broadcastState()
        this.lobby.changed()
    }

    setReady(conn: Connection, ready: boolean): void {
        const user = this.requireUser(conn)
        this.requireLobby()
        const seat = this.seatOfUid(user.uid)
        if (seat === null) throw new ProtocolError("BAD_REQUEST", "Prvo sjednite za stol.")
        const slot = this.seats[seat]
        if (slot && slot.kind === "PLAYER") slot.ready = ready
        this.broadcastState()
    }

    /* ───────────────────────── start / finish ───────────────────────── */

    start(conn: Connection): void {
        this.requireHost(conn)
        this.requireLobby()
        const humans = this.humanSeats()
        if (humans.length === 0) {
            throw new ProtocolError(
                "NOT_ENOUGH_PLAYERS",
                "Za početak igre potreban je barem jedan igrač za stolom.",
            )
        }
        for (const s of humans) {
            const slot = this.seats[s]
            if (slot?.kind === "PLAYER" && !slot.ready) {
                throw new ProtocolError("BAD_REQUEST", "Nisu svi igrači spremni.")
            }
        }
        for (const s of SEATS) {
            if (!this.seats[s]) this.seats[s] = this.makeBotSlot(s)
        }
        this.status = "PLAYING"
        this.game = new GameRoom(this, this.timings)
        log.info("room.start", { room: this.id, target: this.targetScore })
        this.broadcastState()
        this.lobby.changed()
        this.game.begin()
    }

    /** Called by the GameRoom when the engine reaches GAME_OVER. */
    onGameOver(): void {
        if (this.status === "FINISHED") return
        this.status = "FINISHED"
        log.info("room.finished", { room: this.id })
        this.broadcastState()
        this.lobby.changed()
        this.scheduleDelete(this.timings.finishedRoomTtlMs)
    }

    /* ───────────────────────── deletion ───────────────────────── */

    private cancelDeleteTimer(): void {
        if (this.deleteTimer) {
            clearTimeout(this.deleteTimer)
            this.deleteTimer = null
        }
    }

    scheduleDeleteIfEmpty(): void {
        if (!this.isEmpty()) return
        this.scheduleDelete(this.timings.emptyRoomTtlMs)
    }

    private scheduleDelete(ms: number): void {
        this.cancelDeleteTimer()
        const timer = setTimeout(() => {
            this.deleteTimer = null
            if (this.disposed) return
            if (this.status !== "FINISHED" && !this.isEmpty()) return
            log.info("room.deleted", { room: this.id, status: this.status })
            this.lobby.remove(this.id)
        }, ms)
        if (typeof timer.unref === "function") timer.unref()
        this.deleteTimer = timer
    }

    dispose(): void {
        this.disposed = true
        this.cancelDeleteTimer()
        for (const t of this.graceTimers.values()) clearTimeout(t)
        this.graceTimers.clear()
        this.game?.dispose()
        this.game = null
    }
}
