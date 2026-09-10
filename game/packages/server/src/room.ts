/* ──────────────────────────────────────────────────────────────────────────
   RoomState management (README §3 "Soba", §4).

   A room owns 4 seats, its members' connections, the host, and — once
   started — a `GameRoom` holding the authoritative `GameState`.

   Lifecycle: LOBBY → PLAYING → LOBBY. A lobby explicitly abandoned by its
   last human is deleted immediately. Rooms emptied by a dropped socket keep
   their reconnect window and use `emptyRoomTtlMs`; finished ones use
   `finishedRoomTtlMs`.

   Seats survive absence. Leaving the table or losing the socket during a game
   starts a `reconnectGraceMs` SEAT HOLD (2 min): the seat still belongs to
   that uid, the room reports them as `connected: false` with a `holdUntil`,
   and only when the hold expires does a bot take over for good. Meanwhile the
   game runs their turns on the ordinary timer — see `gameRoom.ts`.
   ────────────────────────────────────────────────────────────────────── */

import type {
    ActiveSeatInfo,
    GameEndRule,
    RoomOccupant,
    RoomState,
    RoomStatus,
    RoomSummary,
    Seat,
    SeatInfo,
    ServerMessage,
    TargetScore,
    TrickReview,
    UserInfo,
} from "@bela/protocol"
import { DEFAULT_GAME_END_RULE, DEFAULT_TRICK_REVIEW } from "@bela/protocol"
import type { Timings } from "./config.js"
import { ProtocolError } from "./errors.js"
import { botName } from "./bots.js"
import { GameRoom } from "./gameRoom.js"
import { log } from "./log.js"
import type { Connection } from "./ws.js"

/** Internal seat slot — same as the protocol `SeatInfo["occupant"]` plus the uid. */
export type SeatSlot =
    | { kind: "PLAYER"; uid: string; user: UserInfo; ready: boolean; connected: boolean }
    | { kind: "BOT"; name: string }
    | null

/** What a room needs from the registry that owns it. */
export interface RoomHost {
    /** Something visible in the lobby changed. */
    changed(): void
    /** Drop this room from the registry. */
    remove(roomId: string): void
}

/**
 * Why a seat is being held for someone who is not here right now.
 *
 *   • `disconnect` — the socket died (tab closed, tunnel, laptop lid). A fresh
 *     `hello` from the same uid walks straight back into the room: that IS a
 *     reconnect and nobody chose to leave.
 *   • `left` — an explicit `room.leave`. The seat is still theirs for the whole
 *     hold window, but a later `hello` must NOT silently re-seat them: they may
 *     be sitting in the lobby deciding, and re-attaching there would cancel the
 *     hold and make the forfeit unreachable. They come back through
 *     `room.join` / `room.joinByCode` — the button the lobby shows them.
 */
export type HoldReason = "disconnect" | "left"

export interface SeatHold {
    seat: Seat
    reason: HoldReason
    /** Epoch ms at which the seat is forfeited. */
    until: number
}

export const SEATS: readonly Seat[] = [0, 1, 2, 3]

/**
 * The order an arriving player fills an empty table in — README §3.3.
 *
 * NOT seat order, and that is the whole point. Seats alternate teams (0+2 are
 * one pair, 1+3 the other, README §1.1), so filling 0→1→2→3 puts the second
 * arrival OPPOSITE the host, the third beside him, and leaves both pairs
 * half-built until the fourth person shows up: from outside the table looks
 * like it seats people at random, and the host watching his own room fill sees
 * "oni" grow before "mi" is even whole.
 *
 * 0→2→1→3 completes the first pair, then the second. Two people at a table
 * are always partners, three are always a full pair plus one — which is what
 * anyone who has ever waited for a fourth expects to see.
 *
 * ONE array, because both halves of the promise read it: `nextSeatForNewcomer`
 * hands out the seat and `canAdmitNewcomer` (hence `RoomSummary.joinable`)
 * decides whether there is one. Reorder it here and both move together.
 */
export const SEAT_FILL_ORDER: readonly Seat[] = [0, 2, 1, 3]

/** Spectators + seated members; a hard cap so one room cannot soak the process. */
const MAX_MEMBERS = 24

/**
 * The one rule tying the two declaration switches together, written down once
 * so `room.create` and `room.setOptions` cannot drift apart.
 *
 * "Bez zvanja" is what `allowBela` qualifies: with declarations ON the bela is
 * a declaration like any other and ALWAYS counts, so `allowBela: false` sent
 * against a room that scores declarations means nothing and is not stored.
 * Only a room that turned declarations off gets to say "…but keep the bela"
 * (the default) or "not even the bela".
 */
function belaCounts(noDeclarations: boolean, allowBela: boolean | undefined): boolean {
    return !noDeclarations || allowBela !== false
}

/** Fields of `room.setOptions` — every one optional, absent = leave alone. */
export interface RoomOptionsPatch {
    targetScore?: TargetScore
    gameEndRule?: GameEndRule
    allowSpectators?: boolean
    noDeclarations?: boolean
    allowBela?: boolean
    trickReview?: TrickReview
}

export interface RoomInit {
    gameEndRule?: GameEndRule
    allowSpectators?: boolean
    noDeclarations?: boolean
    allowBela?: boolean
    trickReview?: TrickReview
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
    private: boolean
    // Not readonly: the host may still retune these in the LOBBY via
    // `setOptions` (README §3). They are the DEAL's rules, so `requireLobby`
    // there keeps them frozen for as long as a game is running — `GameRoom`
    // copies them into the engine config once, at `room.start`.
    allowSpectators: boolean
    noDeclarations: boolean
    allowBela: boolean
    gameEndRule: GameEndRule
    /** "Gledanje štihova" — same for the whole room, editable until the deal starts. */
    trickReview: TrickReview
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
    /** uid → the seat hold running while a seated player is away. */
    private readonly holds: Map<string, SeatHold & { timer: ReturnType<typeof setTimeout> }>
    private disposed: boolean

    constructor(init: RoomInit) {
        this.id = init.id
        this.code = init.code
        this.name = init.name
        this.hostUid = init.host.uid
        this.status = "LOBBY"
        this.targetScore = init.targetScore
        this.private = init.private
        this.allowSpectators = init.allowSpectators === true
        this.noDeclarations = init.noDeclarations === true
        this.allowBela = belaCounts(this.noDeclarations, init.allowBela)
        this.gameEndRule = init.gameEndRule ?? DEFAULT_GAME_END_RULE
        this.trickReview = init.trickReview ?? DEFAULT_TRICK_REVIEW
        this.createdAt = Date.now()
        this.seats = [null, null, null, null]
        this.conns = new Set<Connection>()
        this.game = null
        this.lobby = init.lobby
        this.timings = init.timings
        this.deleteTimer = null
        this.holds = new Map()
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

    /** The running seat hold for this uid, if any (timer stripped). */
    holdFor(uid: string): SeatHold | null {
        const hold = this.holds.get(uid)
        if (!hold) return null
        return { seat: hold.seat, reason: hold.reason, until: hold.until }
    }

    /** `game.active` payload for this uid — null when they hold no seat here. */
    activeSeatFor(uid: string): ActiveSeatInfo | null {
        const seat = this.seatOfUid(uid)
        if (seat === null) return null
        const hold = this.holds.get(uid)
        return {
            roomId: this.id,
            roomName: this.name,
            code: this.private ? this.code : "",
            status: this.status,
            targetScore: this.targetScore,
            seat,
            present: this.hasConnFor(uid),
            holdUntil: hold ? hold.until : null,
        }
    }

    seatsTaken(): number {
        return SEATS.filter((s) => this.seats[s] !== null).length
    }

    /**
     * The seat the next arrival gets, or null when the table is full.
     *
     * Not the lowest free seat — the first free seat in `SEAT_FILL_ORDER`, so
     * one pair fills before the other. Everything about WHY lives on that
     * constant; this is just where the array is read.
     */
    nextSeatForNewcomer(): Seat | null {
        for (const s of SEAT_FILL_ORDER) if (this.seats[s] === null) return s
        return null
    }

    /**
     * Could somebody who is not already here enter this room at all?
     *
     * ONE PREDICATE, two call sites: `assertCanJoin` enforces it and
     * `toSummary().joinable` publishes it, so the lobby row and the server can
     * never disagree about whether a room is full. It deliberately ignores the
     * private-room code — that is a separate question with its own error.
     */
    canAdmitNewcomer(): boolean {
        if (this.conns.size >= MAX_MEMBERS) return false
        // Seats cannot be taken mid-game, so a running table only admits
        // people the host explicitly opened it to.
        if (this.status === "PLAYING") return this.allowSpectators
        return this.nextSeatForNewcomer() !== null || this.allowSpectators
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

    /** Other human-owned seats, including a temporarily disconnected player
     * whose reconnect hold is still active. */
    private otherHumanCount(uid: string): number {
        let count = 0
        for (const seat of SEATS) {
            const slot = this.seats[seat]
            if (slot?.kind === "PLAYER" && slot.uid !== uid) count++
        }
        return count
    }

    isEmpty(): boolean {
        return this.conns.size === 0
    }

    /* ───────────────────────── serialisation ───────────────────────── */

    private seatInfo(seat: Seat): SeatInfo {
        const slot = this.seats[seat]
        if (!slot) return { seat, occupant: null }
        if (slot.kind === "BOT") {
            return { seat, occupant: { kind: "BOT", name: slot.name } }
        }
        return {
            seat,
            occupant: {
                kind: "PLAYER",
                user: slot.user,
                ready: slot.ready,
                connected: slot.connected,
                holdUntil: this.holds.get(slot.uid)?.until ?? null,
            },
        }
    }

    /** One seat for the PUBLIC lobby list: a display name, nothing else. */
    private occupantOf(seat: Seat): RoomOccupant {
        const slot = this.seats[seat]
        if (!slot) return null
        if (slot.kind === "BOT") return { kind: "BOT", name: slot.name }
        return { kind: "PLAYER", name: slot.user.name, connected: slot.connected }
    }

    /**
     * The lobby row. Sent to EVERY `lobby.rooms` subscriber, in the room or
     * not, so it must stay free of anything private: the join code is redacted
     * unless the receiver is a member (`includePrivateCode`), uids never
     * travel at all (`hostUid` lives on `RoomState`), and `occupants` carries
     * display names only.
     */
    toSummary(includePrivateCode = false): RoomSummary {
        return {
            id: this.id,
            name: this.name,
            code: this.private && includePrivateCode ? this.code : "",
            status: this.status,
            targetScore: this.targetScore,
            gameEndRule: this.gameEndRule,
            noDeclarations: this.noDeclarations,
            private: this.private,
            allowSpectators: this.allowSpectators,
            seatsTaken: this.seatsTaken(),
            humans: this.humanSeats().length,
            occupants: [
                this.occupantOf(0),
                this.occupantOf(1),
                this.occupantOf(2),
                this.occupantOf(3),
            ],
            joinable: this.canAdmitNewcomer(),
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
            ...this.toSummary(true),
            hostUid: this.hostUid,
            allowBela: this.allowBela,
            trickReview: this.trickReview,
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
     * Enforce admission before attaching a new connection (README §3.2).
     *
     * Anyone already here — a seat holder walking back in, or a second tab of
     * the same uid — is always let through. For a newcomer the ONLY question
     * is `canAdmitNewcomer()`, the same predicate `toSummary().joinable`
     * publishes: pass it and `attach` either seats them (a free seat in the
     * lobby) or lets them watch (spectators on). Fail it and the join is
     * REFUSED here — never silently downgraded to spectating, which is how a
     * room with three empty seats used to tell the second player it was full.
     */
    assertCanJoin(conn: Connection, codeProvided: boolean): void {
        const uid = conn.user?.uid
        const returningPlayer = uid !== undefined && this.seatOfUid(uid) !== null
        const alreadyHere = uid !== undefined && this.hasConnFor(uid)
        if (this.private && !codeProvided && !returningPlayer && !alreadyHere) {
            throw new ProtocolError("ROOM_CODE_REQUIRED", "Za ulaz u privatnu sobu potrebna je šifra.")
        }
        if (returningPlayer || alreadyHere) return
        if (this.canAdmitNewcomer()) return
        // Two distinct refusals, because the fix differs: a running table that
        // never wanted an audience vs. a table with nowhere left to sit.
        if (this.status === "PLAYING" && !this.allowSpectators) {
            throw new ProtocolError("SPECTATORS_DISABLED", "Gledatelji nisu omogućeni za ovu igru.")
        }
        throw new ProtocolError("ROOM_FULL", "Soba je puna — nema slobodnog sjedala.")
    }

    /**
     * Attach a connection. Returns true when this was a reconnect into a seat
     * the room was still holding for that uid.
     *
     * AUTO-SEAT: a newcomer entering a room in `LOBBY` that still has a free
     * seat is SEATED, not parked as a spectator. Sitting used to be a separate
     * `room.sit` the redesigned room screen no longer offers, so a second
     * player landed seatless at a half-empty table and was told it was full.
     * Seating here — in the one place every entry route goes through
     * (`hello`, `room.join`, `room.joinByCode`, `Lobby.create`) — is what makes
     * `assertCanJoin`'s promise true: pass the check, get the seat.
     *
     * WHICH seat is `SEAT_FILL_ORDER` (0→2→1→3): one pair fills before the
     * other, so the second person to arrive is the host's partner.
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

        // Whichever route brought them back (`hello`, `room.join`,
        // `room.joinByCode`), being here again cancels the hold.
        this.cancelHold(user.uid)
        const seat = this.seatOfUid(user.uid)
        let reconnected = false
        if (seat !== null) {
            const slot = this.seats[seat]
            if (slot && slot.kind === "PLAYER") {
                reconnected = !slot.connected
                slot.connected = true
                slot.user = user
            }
        } else if (this.status === "LOBBY") {
            const free = this.nextSeatForNewcomer()
            if (free !== null) {
                this.seats[free] = { kind: "PLAYER", uid: user.uid, user, ready: false, connected: true }
                log.info("seat.autoSeated", { room: this.id, seat: free, uid: user.uid })
            }
        }
        this.lobby.changed()
        this.game?.onPresenceChanged()
        return reconnected
    }

    /** Socket died: keep the seat for the hold window. */
    onDisconnect(conn: Connection): void {
        if (!this.conns.delete(conn)) return
        const user = conn.user
        conn.roomId = null
        if (user && !this.hasConnFor(user.uid)) this.holdOrRelease(user.uid, "disconnect")
        // A dropped socket does not cost you the host badge — the hold expiring
        // (or an explicit leave from the lobby seat) does.
        this.afterMembershipChange(null)
    }

    /**
     * Explicit `room.leave`. During PLAYING this does NOT hand the seat to a
     * bot any more: walking back to the lobby is not a forfeit, it starts the
     * same `reconnectGraceMs` hold a dropped socket gets (README §3 "Timeri").
     * In LOBBY there is nothing to hold — the seat is freed immediately so the
     * table doesn't look full to everyone else.
     */
    leave(conn: Connection): void {
        const user = conn.user
        const leavingSeat = user ? this.seatOfUid(user.uid) : null
        this.conns.delete(conn)
        conn.roomId = null
        if (user && leavingSeat !== null && !this.hasConnFor(user.uid)) {
            // Every active table gets the same reconnect window, including a
            // single player with three bots. A refresh and an app setting
            // change must never destroy the room merely because nobody else
            // happens to be connected. If the player does not return, the
            // hold-expiry path below dissolves an unsustainable room.
            this.holdOrRelease(user.uid, "left")
        }
        conn.send({ t: "room.left" })
        // An explicit exit from an otherwise abandoned lobby is final. Bots
        // are not room members and must not keep a public room advertised.
        // A dropped socket takes the separate onDisconnect path, where its
        // human seat is retained for reconnect instead of reaching this rule.
        if (this.status === "LOBBY" && this.isEmpty() && this.humanSeats().length === 0) {
            log.info("room.deleted", { room: this.id, status: this.status, reason: "last-member-left" })
            this.lobby.remove(this.id)
            return
        }
        this.afterMembershipChange(user?.uid ?? null)
    }

    /** Close a running room that can no longer sustain a human-vs-human game. */
    private dissolveAfterPlayersLeft(): void {
        const remaining = [...this.conns]
        this.conns.clear()
        for (const member of remaining) {
            member.roomId = null
            member.send({ t: "room.left" })
            member.send({ t: "game.active", seat: null })
        }
        log.info("room.dissolved", { room: this.id, reason: "fewer-than-two-humans" })
        this.lobby.remove(this.id)
    }

    /**
     * Give up the seat here and now, no hold. This is the lobby's "Napusti
     * igru": the only way to hand a held seat back before its hold runs out,
     * and — since one game at a time is now enforced by refusal rather than by
     * forfeit (README §3.2) — the only way to become free to open another room.
     */
    abandonSeat(uid: string): void {
        this.cancelHold(uid)
        if (this.seatOfUid(uid) === null) return
        this.releaseSeat(uid)
        if (this.isHost(uid)) this.transferHost(uid)
        log.info("seat.abandoned", { room: this.id, uid })
        this.broadcastState()
        this.lobby.changed()
        this.game?.onPresenceChanged()
    }

    private afterMembershipChange(leavingUid: string | null): void {
        if (leavingUid !== null && this.isHost(leavingUid)) this.transferHost(leavingUid)
        this.broadcastState()
        this.lobby.changed()
        this.game?.onPresenceChanged()
        this.scheduleDeleteIfEmpty()
    }

    /** PLAYING → mark the seat away and start the hold; LOBBY → just free it. */
    private holdOrRelease(uid: string, reason: HoldReason): void {
        const seat = this.seatOfUid(uid)
        if (seat === null) return
        if (this.status !== "PLAYING" && reason === "left") {
            this.cancelHold(uid)
            this.seats[seat] = null
            return
        }
        const slot = this.seats[seat]
        if (slot && slot.kind === "PLAYER") slot.connected = false
        this.startHold(uid, seat, reason)
    }

    /** Free (LOBBY) or bot-ify (PLAYING) the seat held by `uid`. */
    private releaseSeat(uid: string): void {
        const seat = this.seatOfUid(uid)
        if (seat === null) return
        if (this.status === "PLAYING") this.seats[seat] = this.makeBotSlot(seat)
        else this.seats[seat] = null
    }

    private cancelHold(uid: string): void {
        const hold = this.holds.get(uid)
        if (!hold) return
        clearTimeout(hold.timer)
        this.holds.delete(uid)
    }

    private startHold(uid: string, seat: Seat, reason: HoldReason): void {
        this.cancelHold(uid)
        const until = Date.now() + this.timings.reconnectGraceMs
        const timer = setTimeout(() => {
            this.holds.delete(uid)
            if (this.disposed) return
            if (this.hasConnFor(uid)) return
            const slot = this.seats[seat]
            if (!slot || slot.kind !== "PLAYER" || slot.uid !== uid) return
            // A disconnected solo/two-person table may wait out its reconnect
            // grace, but it must not turn into a one-person or bot-only game
            // when that grace expires.
            if (this.status === "PLAYING" && this.otherHumanCount(uid) < 2) {
                this.dissolveAfterPlayersLeft()
                return
            }
            // Hold expired (README §3 "Timeri"): mid-game the bot takes the seat
            // for good; in the lobby the seat simply opens up again.
            this.seats[seat] = this.status === "PLAYING" ? this.makeBotSlot(seat) : null
            if (this.isHost(uid)) this.transferHost(uid)
            log.info("seat.holdExpired", { room: this.id, seat, uid, reason })
            this.broadcastState()
            this.lobby.changed()
            this.game?.onPresenceChanged()
        }, this.timings.reconnectGraceMs)
        if (typeof timer.unref === "function") timer.unref()
        this.holds.set(uid, { seat, reason, until, timer })
        log.info("seat.hold", { room: this.id, seat, uid, reason, until })
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

    private makeBotSlot(seat: Seat): SeatSlot {
        return { kind: "BOT", name: botName(seat) }
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
        // The other way a no-spectator room could end up showing a spectator:
        // standing up in it. "Bez gledatelja" has to mean nobody in the room
        // without a seat, whichever direction they arrived from — the way out
        // of the chair here is `room.leave`.
        if (!this.allowSpectators) {
            throw new ProtocolError("SPECTATORS_DISABLED", "Ova soba nema gledatelja — izađite iz sobe umjesto ustajanja.")
        }
        const seat = this.seatOfUid(user.uid)
        if (seat === null) throw new ProtocolError("BAD_REQUEST", "Ne sjedite za stolom.")
        this.seats[seat] = null
        this.broadcastState()
        this.lobby.changed()
    }

    addBot(conn: Connection, seat: Seat): void {
        this.requireHost(conn)
        this.requireLobby()
        if (this.seats[seat]) throw new ProtocolError("SEAT_TAKEN")
        this.seats[seat] = this.makeBotSlot(seat)
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

    /**
     * A player changed their in-game name (`profile.setName`). Their seat and
     * their spectator entry both carry a COPY of the `UserInfo` taken when
     * they sat down, so the new name has to be written into those copies or
     * the table keeps showing the old one until they rejoin.
     *
     * Nothing else about the room moves; the caller broadcasts.
     */
    renameOccupant(uid: string, name: string): void {
        for (const slot of this.seats) {
            if (slot && slot.kind === "PLAYER" && slot.uid === uid) {
                slot.user = { ...slot.user, name }
            }
        }
        for (const c of this.conns) {
            if (c.user?.uid === uid) c.user = { ...c.user, name }
        }
    }

    setPrivate(conn: Connection, isPrivate: boolean): void {
        this.requireHost(conn)
        this.private = isPrivate
        this.broadcastState()
        this.lobby.changed()
    }

    /**
     * `room.setOptions` — the host retunes the room's own rules while it is
     * still in the LOBBY (README §3).
     *
     * Two guards, and both matter. HOST ONLY, like every other room-wide
     * switch (`setPrivate`, `addBot`): these are settings everyone at the table
     * plays under. LOBBY ONLY, unlike `setPrivate`: the target score, the end
     * rule and the declaration switches are the *deal's* rules and `GameRoom`
     * has already copied them into the engine config — changing them mid-game
     * would leave the room advertising one game and the engine scoring another.
     *
     * Only the fields PRESENT in the patch are written, so a client can flip
     * one switch without restating the other five. Values are validated in
     * `ws.ts` (same place `room.create` validates its own), so anything that
     * gets here is already of the right shape.
     */
    setOptions(conn: Connection, patch: RoomOptionsPatch): void {
        this.requireHost(conn)
        this.requireLobby()
        if (patch.targetScore !== undefined) this.targetScore = patch.targetScore
        if (patch.gameEndRule !== undefined) this.gameEndRule = patch.gameEndRule
        if (patch.allowSpectators !== undefined) this.allowSpectators = patch.allowSpectators
        if (patch.trickReview !== undefined) this.trickReview = patch.trickReview
        // The declaration pair is resolved TOGETHER through the same rule
        // `room.create` uses, whichever half of it the patch carries: a room
        // that scores declarations always counts the bela.
        const noDeclarations = patch.noDeclarations ?? this.noDeclarations
        const allowBela = patch.allowBela ?? this.allowBela
        this.noDeclarations = noDeclarations
        this.allowBela = belaCounts(noDeclarations, allowBela)
        log.info("room.options", {
            room: this.id,
            target: this.targetScore,
            gameEndRule: this.gameEndRule,
            allowSpectators: this.allowSpectators,
            noDeclarations: this.noDeclarations,
            allowBela: this.allowBela,
            trickReview: this.trickReview,
        })
        this.broadcastState()
        // `targetScore`, `gameEndRule`, `noDeclarations` and `allowSpectators`
        // all live on the public `RoomSummary` too, so the lobby rows have to
        // be redrawn — same fan-out `setPrivate` triggers.
        this.lobby.changed()
    }

    /* ───────────────────────── start / finish ───────────────────────── */

    start(conn: Connection): void {
        const user = this.requireUser(conn)
        this.requireLobby()
        const humans = this.humanSeats()
        if (humans.length === 0) {
            throw new ProtocolError(
                "NOT_ENOUGH_PLAYERS",
                "Za početak igre potreban je barem jedan igrač za stolom.",
            )
        }
        if (this.seatOfUid(user.uid) === null) {
            throw new ProtocolError("BAD_REQUEST", "Samo igrač za stolom može pokrenuti igru.")
        }
        for (const s of humans) {
            const slot = this.seats[s]
            if (slot?.kind === "PLAYER" && !slot.ready) {
                throw new ProtocolError("BAD_REQUEST", "Nisu svi igrači spremni.")
            }
        }
        if (this.seats.some((slot) => slot === null)) {
            throw new ProtocolError(
                "NOT_ENOUGH_PLAYERS",
                "Za početak igre moraju biti popunjena sva četiri mjesta.",
            )
        }
        if (!this.allowSpectators) {
            for (const member of [...this.conns]) {
                const uid = member.user?.uid
                if (uid && this.seatOfUid(uid) !== null) continue
                this.conns.delete(member)
                member.roomId = null
                member.send({ t: "room.left" })
                member.send({ t: "game.active", seat: null })
            }
        }
        this.cancelDeleteTimer()
        this.game?.dispose()
        this.status = "PLAYING"
        this.game = new GameRoom(this, this.timings)
        log.info("room.start", { room: this.id, target: this.targetScore })
        this.broadcastState()
        this.lobby.changed()
        this.game.begin()
    }

    /** Called by the GameRoom when the engine reaches GAME_OVER. */
    onGameOver(): void {
        if (this.status !== "PLAYING") return
        this.status = "LOBBY"
        for (const slot of this.seats) {
            if (slot?.kind === "PLAYER") slot.ready = false
        }
        log.info("room.finished", { room: this.id })
        this.broadcastState()
        this.lobby.changed()
        this.scheduleDeleteIfEmpty()
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
        for (const hold of this.holds.values()) clearTimeout(hold.timer)
        this.holds.clear()
        this.game?.dispose()
        this.game = null
    }
}
